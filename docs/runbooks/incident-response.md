# Incident Response Runbook (`docs/runbooks/incident-response.md`)

Standard on-call triage, diagnosis, mitigation, and postmortem workflow for KubeShop alerts. For a full end-to-end walkthrough and postmortem template, see [docs/incident-demo.md](../incident-demo.md).

---

## 1. Severity Classification

| Severity | Criteria | Response Target | Examples |
|---|---|---|---|
| **Sev-1 (Critical)** | Complete storefront or checkout outage in `prod`; fast-burn SLO alert firing (`14.4x`) | Immediate (< 5 min) | `KubeShopSLOHighBurnRateCritical`, `orders-db` down, NLB unreachable |
| **Sev-2 (High)** | Partial degradation in `prod` or full outage in `staging`; slow-burn SLO alert (`6x`) | < 15 min | `KubeShopSLOSlowBurnRateWarning`, `RolloutAborted` in prod, `PodCrashLooping` |
| **Sev-3 (Medium)** | Non-urgent platform warning with no immediate user impact | Next business day | `ArgoAppOutOfSync` > 15m, `PVCFillingUp`, `CertificateExpiringSoon` |
| **Sev-4 (Low)** | Dev environment issue or cosmetic bug | Standard backlog | Failed dev canary, flaky synthetic probe |

---

## 2. Triage Checklist (First 5 Minutes)

1. **Acknowledge Alert**: Claim ownership in `#alerts-kubeshop` so responders avoid duplicate actions.
2. **Check Scope & Recent Changes**:
   - Open Grafana **KubeShop / Service RED** and **KubeShop / SLO Overview** to confirm affected service and namespace.
   - Check recent merges on `main` (`git log --oneline -n 10`) and Argo CD sync history.
   - Check `/status` page to see active versions and pod health.
3. **Correlate Logs → Traces**:
   - Query Loki in Grafana Explore:
     ```logql
     {namespace="kubeshop-<env>", app="<service>"} | json | status >= 500
     ```
   - Inspect `code` (e.g., `FAULT_INJECTED`, `UPSTREAM_UNAVAILABLE`, `UPSTREAM_TIMEOUT`) and `requestId`.
   - Click the derived **Tempo** `traceId` link to isolate the exact failing span (`cart -> catalog`, `orders -> cart`, or `orders -> postgres`).

---

## 3. Common Alert Playbooks

| Alert Name | Immediate Diagnostic Command | Mitigation |
|---|---|---|
| `KubeShopSLOHighBurnRateCritical` | Check Grafana RED + Loki 5xx logs | Abort active rollout (`kubectl argo rollouts abort`) and revert offending PR ([rollback.md](rollback.md)) |
| `RolloutAborted` | `kubectl argo rollouts get rollout <app> -n kubeshop-<env>` | Inspect failed `AnalysisRun`, fix root cause, and revert GitOps PR |
| `PodCrashLooping` | `kubectl describe pod <pod> -n kubeshop-<env>` & `kubectl logs --previous` | Check OOMKill, bad env/secret, or DB/Redis connectivity |
| `ArgoAppOutOfSync` | `kubectl get application <name> -n argocd -o yaml` | Check Kyverno admission denials or invalid manifest diffs |
| `PVCFillingUp` | `kubectl get pvc -A` | Expand `gp3` PVC size or inspect Loki/Prometheus 7d retention config |
| `CertificateExpiringSoon` | `kubectl describe certificate -n gateway-system` | Check `cert-manager` logs and Route 53 DNS-01 IRSA permissions |
| `NodeNotReady` | `kubectl describe node <node>` | Check EC2 Spot interruption events; verify PDBs and pod rescheduling |

---

## 4. Mitigation & Closure
1. **Mitigate First**: Prioritize restoring user-facing SLOs via [docs/runbooks/rollback.md](rollback.md) before deep debugging.
2. **Verify Recovery**: Confirm 0% 5xx in Service RED, all Rollouts `Healthy`, and Slack alert `[RESOLVED]`.
3. **Postmortem**: Within 48 hours of any Sev-1 or Sev-2 incident, complete a blameless postmortem using the template in [docs/incident-demo.md](../incident-demo.md#5-blameless-postmortem-template).
