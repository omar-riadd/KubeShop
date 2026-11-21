# Backend Phase 6 Progress (Task B-06: GitOps & Platform Addons + `env-baseline` Chart)

## What was done
- Created `deploy/charts/env-baseline/` Helm chart with:
  - `ResourceQuota` and `LimitRange` guardrails
  - Default-deny + explicit allow `NetworkPolicy` set (`default-deny-all`, `allow-dns-egress`, `redis-policy`, `orders-db-policy` including `cnpg-system` + peer replication + VPC API egress, `synthetic-traffic-policy`)
  - Hardened non-root, `readOnlyRootFilesystem: true` Redis Deployment (`redis:7.4-alpine`, `--save "" --appendonly no`, password from `cart-redis` secret, `/data` `emptyDir`)
  - `ExternalSecret` (`cart-redis`) syncing `kubeshop/<env>/redis` from `ClusterSecretStore aws-secrets-manager`
  - CloudNativePG `Cluster` (`orders-db`, `postgresql:17.2`, 1 instance in dev/staging, 2 in prod, explicit resources & `gp3` storage)
  - Hardened k6 `synthetic-traffic` Deployment + ConfigMap (`grafana/k6:0.56.0`, ~1 req/s browsing → cart → occasional order)
- Created per-environment baseline values in `gitops/apps/envs/{dev,staging,prod}/baseline.yaml`.
- Created Argo CD GitOps hierarchy:
  - `gitops/bootstrap/bootstrap.yaml` (root Applications for AppProjects, platform addons, workloads)
  - `gitops/apps/project.yaml` (`platform` and `kubeshop` AppProjects)
  - `gitops/apps/applicationset.yaml` (`kubeshop-baseline` + matrix `kubeshop-apps` with managed `pod-security.kubernetes.io/enforce=restricted` & `kubeshop.io/gateway-access=true` namespace labels)
  - `gitops/platform/applicationset.yaml` (Wave 0/1 pinned Helm addons + Wave 2 manifests)
  - Pinned `values.yaml` for all 14 platform addons (`cert-manager`, `external-secrets`, `kyverno`, `argo-rollouts` with Gateway API plugin `v0.18.0`, `cloudnative-pg`, `keda`, `kube-prometheus-stack`, `envoy-gateway` `v1.10.0`, `external-dns`, `loki`, `tempo`, `alloy`, `otel-collector`, `opencost`)
  - Wave 2 manifests: Let's Encrypt `ClusterIssuer`, Envoy Gateway `EnvoyProxy` (AWS NLB annotations) + `GatewayClass eg` + `Gateway kubeshop-gw` + HTTP→HTTPS redirect `HTTPRoute`, `ClusterSecretStore aws-secrets-manager`, and Argo Rollouts `ClusterAnalysisTemplate`s (`success-rate`, `latency-p95`, `web-healthz`)
- Added `docs/runbooks/promotion.md`.

## How to verify
```bash
helm lint deploy/charts/env-baseline
for env in dev staging prod; do
  helm template "baseline-${env}" deploy/charts/env-baseline --namespace "kubeshop-${env}" -f "gitops/apps/envs/${env}/baseline.yaml" | kubeconform -strict -ignore-missing-schemas -summary
done
trivy config --severity HIGH,CRITICAL --exit-code 1 deploy/charts/env-baseline
trivy config --severity HIGH,CRITICAL --exit-code 1 gitops/
```

## Known gaps / Deferred
- Live Argo CD sync verification against EKS is deferred until `terraform apply` is approved and executed.
