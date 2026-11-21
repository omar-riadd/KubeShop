# Cluster Teardown Runbook (`docs/runbooks/teardown.md`)

Follow this **exact order** when tearing down the KubeShop AWS EKS environment. Running `terraform destroy` while Kubernetes-managed LoadBalancers or EBS volumes still exist will leave orphaned AWS NLBs/ENIs and cause VPC deletion to hang.

> **Destructive Action**: Confirm human approval before executing teardown against any live AWS account.

---

## Step 1: Delete Argo CD Applications & Wait for Load Balancers (`make cluster-down`)
Run the scripted teardown helper from the repository root:

```bash
make cluster-down
```

What `make cluster-down` performs:
1. Deletes all Argo CD `Application` resources (`kubectl -n argocd delete applications --all --wait=true`), triggering finalizers to remove:
   - Envoy Gateway internet-facing AWS Network Load Balancer
   - ExternalDNS Route 53 records (`dev`, `staging`, `app`)
   - CloudNativePG, Prometheus, and Loki EBS `gp3` PVCs
2. Polls all namespaces until zero `type=LoadBalancer` Services remain.

---

## Step 2: Verify Zero Orphaned Kubernetes Cloud Resources
Confirm no residual LoadBalancers or PVCs remain before destroying the cluster:

```bash
kubectl get svc -A | grep LoadBalancer || echo "No LoadBalancers remaining"
kubectl get pvc -A || echo "No PVCs remaining"
```

---

## Step 3: Destroy Main Terraform Stack
```bash
terraform -chdir=infra/terraform/envs/main destroy
```

This removes EKS worker nodes, the EKS control plane, IRSA roles, GitHub OIDC roles, Secrets Manager entries, AWS Budgets, NAT Gateway, and the VPC.

---

## Step 4: Verify Clean AWS Account (Zero Ongoing Cost)
Run quick AWS CLI checks in `eu-central-1` to confirm zero orphaned billable resources:

```bash
aws elbv2 describe-load-balancers --region eu-central-1 --query 'LoadBalancers[*].LoadBalancerName'
aws ec2 describe-nat-gateways --region eu-central-1 --filter Name=state,Values=available --query 'NatGateways[*].NatGatewayId'
aws ec2 describe-volumes --region eu-central-1 --filters Name=status,Values=available --query 'Volumes[*].VolumeId'
aws ec2 describe-network-interfaces --region eu-central-1 --filters Name=description,Values="*kubeshop*" --query 'NetworkInterfaces[*].NetworkInterfaceId'
```

All four commands should return empty lists (`[]`).

---

## Step 5: Optional — Retire Remote State Bucket
Only perform this if permanently retiring the project:
1. Remove `prevent_destroy = true` from `infra/terraform/bootstrap/`.
2. Empty versioned objects from `kubeshop-tfstate-<AWS_ACCOUNT_ID>`.
3. Run `terraform -chdir=infra/terraform/bootstrap destroy`.
