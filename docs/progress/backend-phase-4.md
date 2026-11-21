# Backend Phase 4 Progress (Task B-04: Shared Workload Helm Chart)

## What was done
- Implemented shared workload Helm chart `deploy/charts/app` rendering all 4 workloads (`catalog`, `cart`, `orders`, `web`):
  - `templates/rollout.yaml`: Argo Rollouts resource supporting `canary` (with Prometheus analysis steps) and `blueGreen` (for web with active/preview services)
  - `templates/services.yaml`: Stable, canary, and preview Service definitions (port 80 -> 8080, admin port 9090 for Go backends)
  - `templates/httproute.yaml`: Kubernetes Gateway API `HTTPRoute` attached to `kubeshop-gw`
  - `templates/autoscaling.yaml`: HorizontalPodAutoscaler (CPU) or KEDA `ScaledObject` targeting Rollouts
  - `templates/pdb.yaml`: PodDisruptionBudget enforcing high availability (`minAvailable: 1`)
  - `templates/servicemonitor.yaml`: Prometheus Operator ServiceMonitor scraping `:9090/metrics`
  - `templates/networkpolicy.yaml`: Restrictive NetworkPolicy per workload allowing only required ingress and egress paths
  - `templates/migration-job.yaml`: PreSync hook Job executing database migrations for `orders`
  - `values.schema.json`: Strict JSON schema validation for all chart inputs
- Created base values under `gitops/apps/base/` (`catalog.yaml`, `cart.yaml`, `orders.yaml`, `web.yaml`) and environment overrides under `gitops/apps/envs/{dev,staging,prod}/`.

## How to verify
```bash
helm lint deploy/charts/app
for env in dev staging prod; do
  for app in catalog cart orders web; do
    helm template "${app}" deploy/charts/app --namespace "kubeshop-${env}" \
      -f "gitops/apps/base/${app}.yaml" -f "gitops/apps/envs/${env}/${app}.yaml" \
      | kubeconform -strict -ignore-missing-schemas -summary
  done
done
```
