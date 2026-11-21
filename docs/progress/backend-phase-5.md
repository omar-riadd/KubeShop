# Backend Phase 5 Progress (Task B-05: Terraform EKS Infrastructure)

## What was done
- Created `infra/terraform/bootstrap/` provisioning a versioned, KMS-encrypted S3 state bucket with public access blocked, TLS-only bucket policy, and lifecycle rules (Terraform >= 1.11 native S3 lockfile; no DynamoDB table).
- Created 6 reusable internal modules under `infra/terraform/modules/`:
  - `network`: 3-AZ VPC (`terraform-aws-modules/vpc/aws` `6.8.0`), public + private subnets, single NAT Gateway, EKS ELB/NLB subnet tags, restricted default SG.
  - `eks`: Amazon EKS (`terraform-aws-modules/eks/aws` `21.30.2`, Kubernetes `1.35`), KMS envelope encryption for Secrets, `API` Access Entries (no `aws-auth` ConfigMap), IRSA OIDC, `api`/`audit` control-plane logs, `vpc-cni` (`enableNetworkPolicy=true`), `coredns`, `kube-proxy`, `eks-pod-identity-agent`, `metrics-server`, plus `spot` (general/non-prod) and `ondemand` (`workload=prod` tainted) managed node groups with IMDSv2 and encrypted gp3 volumes.
  - `iam-irsa`: Least-privilege IRSA roles (`kubeshop-<addon>`) for `aws-load-balancer-controller`, `external-dns`, `cert-manager`, `external-secrets`, and `ebs-csi`.
  - `secrets`: KMS-encrypted AWS Secrets Manager entries for `kubeshop/{dev,staging,prod}/redis`, `kubeshop/platform/slack-webhook`, and `kubeshop/platform/grafana-admin`.
  - `github-oidc`: GitHub Actions IAM OIDC provider + `kubeshop-terraform-plan` (read-only + S3 `.tflock`) and `kubeshop-terraform-apply` (restricted to `environment:aws-prod-apply`).
  - `budget`: Monthly AWS Budgets cost alerts at 50%, 80%, and 100%.
- Created `infra/terraform/envs/main/` wiring all modules, `aws-ebs-csi-driver` EKS addon, S3 native lockfile backend (`use_lockfile = true`), and Helm v3 bootstrap releases (`aws-load-balancer-controller` `3.6.3`, `argo-cd` `10.18.2`, `argocd-apps` `2.0.8` pointing at `gitops/bootstrap`).
- Added `infra/terraform/README.md` (apply order + safe teardown order), `terraform.tfvars.example`, `trivy.yaml` (skips `.terraform/` cache), and `.trivyignore` (documented `AVD-AWS-0104` exception for EKS worker node NAT egress).

## How to verify
```bash
terraform fmt -check -recursive infra/terraform
terraform -chdir=infra/terraform/bootstrap init -backend=false && terraform -chdir=infra/terraform/bootstrap validate
terraform -chdir=infra/terraform/envs/main init -backend=false && terraform -chdir=infra/terraform/envs/main validate
tflint --chdir=infra/terraform/envs/main --init && tflint --chdir=infra/terraform/envs/main --recursive
trivy config --severity HIGH,CRITICAL --exit-code 1 infra/terraform
```

## Live Verification Status
- Live `terraform plan` was successfully executed and verified against AWS Account `<AWS_ACCOUNT_ID>` (Route 53 hosted zone `<HOSTED_ZONE_ID>` / `lab.internal.`):
  - `bootstrap`: Plan generated 9 resources to add (S3 state bucket, KMS key & alias, bucket policies, public access blocks).
  - `envs/main`: Plan generated 111 resources to add, 0 to change, 0 to destroy.
- `terraform apply` remains safely deferred until explicit user confirmation is requested.
