# Backend Phase 7 Progress (Task B-07: Observability — Dashboards, SLOs, Alerts)

## What was done
- Wired `kube-prometheus-stack` manifests (`monitoring` namespace) into `gitops/platform/applicationset.yaml` (`platform-manifests`) and enabled `alertmanagerConfigSelector` in `gitops/platform/kube-prometheus-stack/values.yaml`.
- Added `gitops/platform/kube-prometheus-stack/manifests/external-secrets.yaml`: syncs `grafana-admin` and `alertmanager-slack` from AWS Secrets Manager (`kubeshop/platform/*`).
- Added `gitops/platform/kube-prometheus-stack/manifests/alertmanager-config.yaml`: routes `Watchdog` to `null` and `warning`/`critical` alerts to Slack via `alertmanager-slack` Secret ref (never inline).
- Added `gitops/platform/kube-prometheus-stack/manifests/prometheus-rules.yaml`:
  - 28-day SLO recording rules (`5m`, `30m`, `1h`, `6h`) for `catalog`/`cart` availability (99.5%), `orders` `POST /api/orders` availability (99.5%), `catalog` latency <300ms (95%), and `orders` latency <800ms (95%).
  - Multi-window multi-burn-rate alerts (`14.4x` fast burn = critical, `6x` slow burn = warning).
  - Operational alerts: `Watchdog`, `PodCrashLooping`, `RolloutAborted`, `ArgoAppOutOfSync`, `PVCFillingUp`, `CertificateExpiringSoon`, `NodeNotReady`.
- Added 5 Grafana dashboards as code (`grafana_dashboard: "1"` ConfigMaps):
  1. `dashboard-service-red.yaml` — Service RED (`namespace`, `service` variables)
  2. `dashboard-slo-overview.yaml` — SLO Overview (error budget remaining & burn rates)
  3. `dashboard-rollouts-canary.yaml` — Argo Rollouts Canary Comparison
  4. `dashboard-k8s-capacity.yaml` — Kubernetes Capacity & Autoscaling
  5. `dashboard-cost-opencost.yaml` — FinOps & OpenCost

## How to verify
```bash
kubeconform -strict -ignore-missing-schemas -summary gitops/platform/kube-prometheus-stack/manifests/*.yaml
python3 -c '
import glob, json, yaml
for p in sorted(glob.glob("gitops/platform/kube-prometheus-stack/manifests/dashboard-*.yaml")):
    doc = yaml.safe_load(open(p))
    for k, v in doc["data"].items():
        json.loads(v)
        print("OK:", p, k)
'
trivy config --severity HIGH,CRITICAL --exit-code 1 gitops/
```

## Known gaps / Deferred
- Live Grafana/Loki/Tempo trace correlation verification is deferred until the EKS cluster is applied.
