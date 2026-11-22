# Cluster Bootstrap Runbook (`docs/runbooks/bootstrap.md`)

This runbook documents the deterministic, reproducible steps to provision the KubeShop AWS EKS cluster and bootstrap Argo CD GitOps from scratch.

> **Cost Warning**: Running `terraform apply` creates billable AWS resources (~$0.355/hr; see [docs/cost.md](../cost.md)). Always confirm approval before provisioning.

---

## Prerequisites
- AWS CLI authenticated with permissions to create VPC, EKS, IAM, KMS, Secrets Manager, and Budgets.
- Terraform `>= 1.11`, `kubectl`, `helm`, and `kubectl-argo-rollouts` plugin installed.
- Route 53 Hosted Zone ID for `<BASE_DOMAIN>` (see [docs/PLACEHOLDERS.md](../PLACEHOLDERS.md)).
- Slack Incoming Webhook URL for Alertmanager notifications.
- Repository setup complete ([docs/runbooks/repo-setup.md](repo-setup.md)).

---

## Step 1: Bootstrap Terraform Remote State (One-Time)
Provisions the KMS-encrypted, versioned S3 state bucket using Terraform native S3 lockfiles (`use_lockfile = true`, no DynamoDB table required):

```bash
terraform -chdir=infra/terraform/bootstrap init
terraform -chdir=infra/terraform/bootstrap apply \
  -var="state_bucket_name=kubeshop-tfstate-<AWS_ACCOUNT_ID>"
```

Record the output `state_bucket_arn` for Step 2.

---

## Step 2: Provision EKS Cluster & Bootstrap Argo CD
1. Copy and populate `terraform.tfvars` (git-ignored):
   ```bash
   cp infra/terraform/envs/main/terraform.tfvars.example infra/terraform/envs/main/terraform.tfvars
   ```
   Set `route53_zone_id`, `github_owner`, `state_bucket_arn`, and `budget_email`.
2. Configure sensitive credentials (never commit to git):
   - **Slack webhook**:
     ```bash
     export TF_VAR_slack_webhook_url="<SLACK_WEBHOOK_URL>"
     ```
   - **Private GitHub repository credentials for Argo CD** (fine-grained PAT with `Contents: Read-only` on the GitOps repo):
     - *Preferred (AWS Secrets Manager)*: create secret `kubeshop/github-pat` containing the PAT string, then set `argocd_repo_creds_secret_name = "kubeshop/github-pat"` in `terraform.tfvars`.
     - *Alternative (env var)*:
       ```bash
       export TF_VAR_github_pat="<GITHUB_FINE_GRAINED_PAT>"
       ```
     Terraform automatically provisions `kubernetes_secret_v1.argocd_repo_creds` (`kubeshop-repo-creds` in namespace `argocd` with label `argocd.argoproj.io/secret-type=repository`) before `argocd-root-app` reconciles.
3. Initialize, review plan, and apply:
   ```bash
   terraform -chdir=infra/terraform/envs/main init \
     -backend-config="bucket=kubeshop-tfstate-<AWS_ACCOUNT_ID>" \
     -backend-config="region=eu-central-1"

   terraform -chdir=infra/terraform/envs/main plan -out=tfplan
   terraform -chdir=infra/terraform/envs/main apply tfplan
   ```
   This provisions the VPC, EKS cluster, Spot + On-Demand node groups, IRSA roles, AWS Secrets Manager placeholders, GitHub OIDC roles, Budget alerts, AWS Load Balancer Controller, Argo CD, and the root GitOps Application (`gitops/bootstrap`).

---

## Step 3: Verify Cluster & Argo CD Sync Waves
1. Configure `kubeconfig`:
   ```bash
   aws eks update-kubeconfig --region eu-central-1 --name kubeshop
   ```
2. Watch platform addons and app environments reconcile:
   ```bash
   kubectl get applications -n argocd
   ```
   Expected progression:
   - **Wave 0**: `cert-manager`, `external-secrets`, `kyverno`, `argo-rollouts`, `cloudnative-pg`, `keda`, `kube-prometheus-stack` → `Synced / Healthy`
   - **Wave 1**: `envoy-gateway`, `external-dns`, `loki`, `tempo`, `alloy`, `otel-collector`, `opencost` → `Synced / Healthy`
   - **Wave 2**: `platform-manifests` (`ClusterIssuer`, `Gateway`, `ClusterSecretStore`, Kyverno policies, SLO rules, dashboards) → `Synced / Healthy`
   - **Apps**: `baseline-{dev,staging,prod}` and `{web,catalog,cart,orders}-{dev,staging,prod}` → `Synced / Healthy`

---

## Step 4: Post-Bootstrap Verification
1. Verify TLS certificate and Gateway NLB address:
   ```bash
   kubectl get gateway kubeshop-gw -n gateway-system
   kubectl get certificate -n gateway-system
   ```
2. Verify external access and run k6 smoke test against `dev`:
   ```bash
   curl -fsSL https://dev.<BASE_DOMAIN>/api/catalog/version
   BASE_URL=https://dev.<BASE_DOMAIN> k6 run tests/load/smoke.js
   ```
3. Access Argo CD and Grafana locally (never exposed publicly):
   ```bash
   kubectl port-forward svc/argocd-server -n argocd 8443:443
   kubectl port-forward svc/kube-prometheus-stack-grafana -n monitoring 3000:80
   ```
