# Cluster Teardown Runbook (`docs/runbooks/teardown.md`)

Follow this **exact order** when tearing down the KubeShop AWS EKS environment. Running `terraform destroy` while Kubernetes-managed LoadBalancers or EBS volumes still exist will leave orphaned AWS NLBs/ENIs and cause VPC deletion to hang.

> **Destructive Action**: Confirm human approval before executing teardown against any live AWS account.

---

## Step 1: Delete Argo CD Applications & Wait for Load Balancers (`make cluster-down`)
Run the scripted teardown helper from the repository root:

```bash
make cluster-down
```

What `make cluster-down` ([`scripts/cluster-down.sh`](../../scripts/cluster-down.sh)) performs (run as your normal user, **not** `sudo`):
1. Detaches `kubeshop-root` (`--cascade=orphan`) so it cannot race or self-heal child apps.
2. Deletes workload Applications (`kubeshop-workloads`, `baseline-*`, `catalog-*`, `cart-*`, `orders-*`, `web-*`) with bounded timeouts.
3. Deletes `*-manifests` Applications first so Envoy Gateway `Gateway`/NLB and Route 53 records clean up before controllers are removed.
4. Polls all namespaces until zero `type=LoadBalancer` Services remain.
5. Deletes StatefulSet PVCs (`kubeshop-*`, `monitoring`, `observability`) and waits for EBS `PersistentVolume`s to drain while the EBS CSI driver is still running.
6. Deletes platform addon Applications and `kubeshop-projects`, clearing any stuck Argo CD finalizers if CRDs were already removed.

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
Run quick AWS CLI checks in `eu-central-1` (and all other active regions) to confirm zero orphaned billable resources:

```bash
# Core networking and compute checks in cluster region
aws elbv2 describe-load-balancers --region eu-central-1 --query 'LoadBalancers[*].LoadBalancerName'
aws ec2 describe-nat-gateways --region eu-central-1 --filter Name=state,Values=available --query 'NatGateways[*].NatGatewayId'
aws ec2 describe-volumes --region eu-central-1 --filters Name=status,Values=available --query 'Volumes[*].VolumeId'
aws ec2 describe-network-interfaces --region eu-central-1 --filters Name=description,Values="*kubeshop*" --query 'NetworkInterfaces[*].NetworkInterfaceId'
aws eks list-clusters --region eu-central-1
aws route53 list-hosted-zones

# Multi-region loop check across all 17 regions:
for r in $(aws ec2 describe-regions --query 'Regions[].RegionName' --output text); do
  clusters=$(aws eks list-clusters --region "$r" --query 'clusters' --output text)
  vms=$(aws ec2 describe-instances --region "$r" --query "Reservations[].Instances[?State.Name!='terminated'].InstanceId" --output text)
  lbs=$(aws elbv2 describe-load-balancers --region "$r" --query 'LoadBalancers[].LoadBalancerName' --output text)
  [ -n "$clusters" ] && echo "[$r] Active EKS: $clusters"
  [ -n "$vms" ] && echo "[$r] Active EC2: $vms"
  [ -n "$lbs" ] && echo "[$r] Active ELB: $lbs"
done
```

All commands should return empty lists (`[]`) or zero output, confirming zero billable resources.

---

## Step 5: Optional — Retire Remote State Bucket
Only perform this if permanently retiring the project:
1. Remove `prevent_destroy = true` from `infra/terraform/bootstrap/`.
2. Empty versioned objects from `kubeshop-tfstate-<AWS_ACCOUNT_ID>`.
3. Run `terraform -chdir=infra/terraform/bootstrap destroy`.
