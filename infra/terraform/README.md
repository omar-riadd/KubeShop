# KubeShop Terraform Infrastructure

Provisions the AWS foundation for KubeShop (single Amazon EKS cluster in `eu-central-1` hosting `dev`, `staging`, and `prod` namespaces).

## Directory Layout

- `bootstrap/` — One-time S3 remote state bucket (versioned, SSE-KMS encrypted, public access blocked, TLS-only bucket policy). Uses Terraform >= 1.11 native S3 state locking (`use_lockfile = true`; no DynamoDB table required).
- `modules/` — Reusable internal modules:
  - `network/` — 3-AZ VPC, public + private subnets, single NAT Gateway (cost-optimized), EKS Load Balancer subnet tags.
  - `eks/` — EKS cluster with KMS envelope encryption, Access Entries (`API` mode, no `aws-auth` ConfigMap), IRSA OIDC provider, `api`/`audit` control-plane logs, `vpc-cni` (with NetworkPolicy enabled), `coredns`, `kube-proxy`, `metrics-server`, plus `spot` (general/non-prod) and `ondemand` (`workload=prod` tainted) node groups.
  - `iam-irsa/` — Least-privilege IRSA roles (`kubeshop-<addon>`) for AWS Load Balancer Controller, ExternalDNS, cert-manager, External Secrets Operator, and EBS CSI Driver.
  - `secrets/` — KMS-encrypted AWS Secrets Manager entries (`kubeshop/<env>/redis`, `kubeshop/platform/slack-webhook`, `kubeshop/platform/grafana-admin`).
  - `github-oidc/` — GitHub Actions OIDC provider and `kubeshop-terraform-plan` (read-only + lockfile) / `kubeshop-terraform-apply` (restricted to protected `aws-prod-apply` environment) roles.
  - `budget/` — Monthly AWS Budgets cost alerts at 50%, 80%, and 100%.
- `envs/main/` — Root stack wiring all modules plus Helm bootstrap releases for `aws-load-balancer-controller`, `argo-cd`, and `argocd-apps` (root Application pointing at `gitops/bootstrap`).

## Local Validation (No AWS Credentials / Zero Cost)

```bash
terraform fmt -check -recursive infra/terraform
terraform -chdir=infra/terraform/bootstrap init -backend=false && terraform -chdir=infra/terraform/bootstrap validate
terraform -chdir=infra/terraform/envs/main init -backend=false && terraform -chdir=infra/terraform/envs/main validate
tflint --chdir=infra/terraform/envs/main --init && tflint --chdir=infra/terraform/envs/main --recursive
trivy config --severity HIGH,CRITICAL infra/terraform
```

## Apply Order (Requires AWS Account & Approval)

1. **Bootstrap remote state** (once per AWS account):
   ```bash
   terraform -chdir=infra/terraform/bootstrap init
   terraform -chdir=infra/terraform/bootstrap apply \
     -var="state_bucket_name=kubeshop-tfstate-<AWS_ACCOUNT_ID>"
   ```
2. **Provision main cluster stack**:
   ```bash
   cp infra/terraform/envs/main/terraform.tfvars.example infra/terraform/envs/main/terraform.tfvars
   # Edit terraform.tfvars with your Route 53 zone ID, GitHub owner, state bucket ARN, and budget email.
   export TF_VAR_slack_webhook_url="<SLACK_WEBHOOK_URL>"

   terraform -chdir=infra/terraform/envs/main init \
     -backend-config="bucket=kubeshop-tfstate-<AWS_ACCOUNT_ID>" \
     -backend-config="region=eu-central-1"
   terraform -chdir=infra/terraform/envs/main plan -out=tfplan
   terraform -chdir=infra/terraform/envs/main apply tfplan
   ```
3. **Configure kubeconfig**:
   ```bash
   aws eks update-kubeconfig --region eu-central-1 --name kubeshop
   ```

## Teardown Order (Important — Prevents Orphaned AWS Resources)

Always delete Kubernetes-managed load balancers, DNS records, and EBS volumes **before** running `terraform destroy`, otherwise VPC/subnet deletion will hang on orphaned ENIs and NLBs:

1. Run `make cluster-down` (deletes all Argo CD Applications and waits until all `LoadBalancer` Services are removed).
2. Verify no orphaned NLBs or EBS volumes remain in AWS EC2/ELB consoles.
3. Destroy the main stack:
   ```bash
   terraform -chdir=infra/terraform/envs/main destroy
   ```
4. Optionally delete the bootstrap state bucket only when permanently retiring the project (remove `prevent_destroy = true` first).
