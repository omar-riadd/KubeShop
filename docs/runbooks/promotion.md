# GitOps Promotion Runbook

KubeShop follows a strict **GitOps-only** delivery model: no engineer edits Kubernetes clusters directly with `kubectl apply` or `kubectl edit`.

## Environments & Promotion Flow

| Environment | Namespace | URL | How image tags update |
|---|---|---|---|
| `dev` | `kubeshop-dev` | `https://dev.<BASE_DOMAIN>` (e.g. `https://dev.lab.internal.`) | Automatic bot PR opened by `_publish-image.yml` on merge to `main`, auto-merged after CI passes |
| `staging` | `kubeshop-staging` | `https://staging.<BASE_DOMAIN>` (e.g. `https://staging.lab.internal.`) | Manual `workflow_dispatch` of `.github/workflows/promote.yml` (`from: dev`, `to: staging`) → opens PR |
| `prod` | `kubeshop-prod` | `https://app.<BASE_DOMAIN>` (e.g. `https://app.lab.internal.`) | Manual `workflow_dispatch` of `.github/workflows/promote.yml` (`from: staging`, `to: prod`) → opens PR requiring `CODEOWNERS` review |

## Promoting `dev` → `staging`

1. Verify `dev` is healthy in Argo CD (`kubeshop-dev`) and `/status` shows the expected `sha-*` tags.
2. In GitHub Actions, run **Promote Environment** (`promote.yml`):
   - `from`: `dev`
   - `to`: `staging`
   - `apps`: `all` (or comma-separated subset, e.g. `catalog,web`)
3. Review and merge the generated Pull Request updating `gitops/apps/envs/staging/<app>.yaml`.
4. Watch Argo CD sync and Argo Rollouts progress (`10% -> 50% -> 100%` for backends; `blueGreen` for `web`).
5. Run smoke/load verification (`tests/load/smoke.js`) against `https://staging.<BASE_DOMAIN>`.

## Promoting `staging` → `prod`

1. Run **Promote Environment** (`promote.yml`) with `from: staging`, `to: prod`.
2. Obtain required `CODEOWNERS` approval on the PR and merge to `main`.
3. For backend services (`catalog`, `cart`, `orders`), Argo Rollouts executes automated canary analysis (`success-rate` + `latency-p95`) and aborts automatically if thresholds fail.
4. For `web`, `autoPromotionEnabled: false` in `prod` holds the preview stack after `web-healthz` passes; promote via Argo Rollouts CLI or UI once verified:
   ```bash
   kubectl argo rollouts promote web -n kubeshop-prod
   ```

## Rollback

Revert the GitOps promotion commit on `main` via a PR (`git revert <sha>`). Argo CD will automatically reconcile the previous signed `sha-*` image tag.
