# Rollback Runbook (`docs/runbooks/rollback.md`)

KubeShop prioritizes **automated progressive rollback** first, followed by **GitOps revert** so Git always remains the single source of truth.

---

## 1. Automated Rollback (Default Behavior)
For backend services (`catalog`, `cart`, `orders`), Argo Rollouts automatically aborts any canary release whose Prometheus `ClusterAnalysisTemplate` (`success-rate` < 99% or `latency-p95` breach) fails:
- Traffic weight immediately snaps back to `100%` stable.
- Rollout enters `Degraded` phase; `RolloutAborted` Prometheus alert fires.
- **Required follow-up**: Revert the offending commit in Git so Argo CD does not re-attempt the broken revision.

---

## 2. Emergency Immediate Abort (During an Active Rollout)
If an incident is observed mid-rollout before automated analysis completes:

```bash
# Inspect rollout state
kubectl argo rollouts get rollout <app> -n kubeshop-<env>

# Immediately abort canary/blueGreen and route 100% traffic to stable/active
kubectl argo rollouts abort <app> -n kubeshop-<env>
```

> **Note**: `abort` stops immediate user impact within seconds, but Argo CD will show the application as `OutOfSync` or `Degraded` until Git is reverted in Step 3.

---

## 3. Permanent GitOps Rollback (Source of Truth)
Always reconcile Git to the last known good `sha-*` tag:

```bash
# Find the bad deployment/promotion commit on main
git log --oneline -n 10 -- gitops/apps/envs/<env>/<app>.yaml

# Create a revert branch and PR
git checkout -b revert/<env>-<app>-rollback
git revert <bad-commit-sha>
git push -u origin revert/<env>-<app>-rollback
```

1. Open and merge the revert PR (expedited `CODEOWNERS` approval for `prod`).
2. Argo CD detects the reverted `image.tag` (or env var) and reconciles the Rollout back to `Healthy`.
3. Verify recovery:
   ```bash
   kubectl argo rollouts status <app> -n kubeshop-<env>
   BASE_URL=https://<env-host> k6 run tests/load/smoke.js
   ```

---

## 4. Database Migration Rollback (`orders`)
`orders` runs schema migrations as an Argo CD `PreSync` Job (`orders migrate`).
- Schema changes follow the **expand-and-contract** pattern (additive columns/tables first, drop old columns in a later release) so rolling back the `orders` binary remains backward-compatible with the migrated schema without destructive `DOWN` migrations.
- If a broken migration Job fails during `PreSync`, Argo CD halts the sync before touching running `orders` pods. Fix or revert the migration PR and re-sync.
