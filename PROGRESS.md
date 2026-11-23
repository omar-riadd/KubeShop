# KubeShop Build Progress

Combined build order following Shared Contract Milestones (M0 → M6) across `plan.md` (Backend/Platform) and `ui.md` (Frontend/UI).

## Milestone M0 — Repo Bootstrap & Contract
- [x] **B-00** — Backend Phase 0: Repo skeleton, `api/openapi.yaml`, `docs/PLACEHOLDERS.md`, `docs/CONTRACT-CHANGES.md`, `openapi-lint` CI, pre-commit config (Milestone M0 reached)

## Milestone M1 — Go Services & Local Stack
- [x] **B-01** — Backend Phase 1: Go services (`internal/platform`, `catalog`, `cart`, `orders`, unit/integration/contract/fault tests, Dockerfiles)
- [x] **B-02** — Backend Phase 2: Local stack (`docker-compose.yml`, `deploy/compose/gateway.nginx.conf`, `Makefile`) & end-to-end curl check (Milestone M1 reached)

## UI Core, Backend Integration & Container
- [x] **U-01** — UI Phase 1: Scaffold React 19 + TS + Vite + Tailwind v4, design tokens, base UI components, layout shell, MSW mocks, product SVGs
- [x] **U-02** — UI Phase 2: All pages (§7), data layer (§8), forms, error handling, theme, accessibility, unit tests against MSW
- [x] **U-03** — UI Phase 3: Real backend integration (`pnpm gen:api`, delete `types.manual.ts`, Vite proxy, verify with `make dev-backend`)
- [x] **U-04** — UI Phase 4: Production `web/Dockerfile`, `nginx.conf`, `40-runtime-config.sh`, read-only container check, Playwright e2e + axe suite against `make up`

## Milestone M2 — CI Pipelines
- [x] **B-03** — Backend Phase 3: CI workflows (`ci-services.yml`, `_publish-image.yml`, `security.yml`, `helm-gitops.yml`, `terraform.yml`, `promote.yml`), `renovate.json`, `docs/runbooks/repo-setup.md`
- [x] **U-05** — UI Phase 5: UI CI workflow (`.github/workflows/ci-web.yml`)

## Milestone M3 — Helm Chart
- [x] **B-04** — Backend Phase 4: Shared Helm chart `deploy/charts/app` + `values.schema.json` + base/env values + `kubeconform` validation

## Milestone M4 — Terraform & GitOps
- [x] **B-05** — Backend Phase 5: Terraform (`bootstrap`, `modules/*`, `envs/main`, README) + `fmt`/`validate`/`tflint`/`trivy` + live AWS `apply`, EKS 1.35.9 cluster/Helm verification, clean `destroy`, and account-wide 17-region clean teardown verified
- [x] **B-06** — Backend Phase 6: GitOps (`gitops/bootstrap`, `gitops/platform`, `gitops/apps`) & `deploy/charts/env-baseline` + `helm lint`/`kubeconform`/`trivy` clean

## Milestone M5 — Observability, Security, Reliability & FinOps
- [x] **B-07** — Backend Phase 7: Observability (Prometheus, Loki, Alloy, Tempo, OTel, Grafana datasources & 5 dashboards, SLO rules, Alertmanager)
- [x] **B-08** — Backend Phase 8: Security & Policy (Kyverno policies + `kyverno test` suite, NetworkPolicies, RBAC)
- [x] **B-09** — Backend Phase 9: Reliability, rollouts, k6 load tests (`smoke.js`, `load.js`, `stress.js`), `docs/incident-demo.md`, `docs/cost.md`

## Milestone M6 — Docs & Demo
- [x] **B-10** — Backend Phase 10: `README.md`, `docs/architecture.md`, ADRs, runbooks, `docs/demo-script.md`, `make cluster-down`
- [x] **U-06** — UI Phase 6 & 7: `web/README.md`, `docs/ui/design-notes.md`, local screenshots (9 views captured; live cluster verification deferred until cluster apply)

## Post-M6 — Project Improvement Roadmap
- [x] **IMP-00** — Deep Codebase Audit & Improvement Plan: 18 findings identified across CI/CD, security, performance, reliability, quality, and DX; 14-step prioritized implementation roadmap authored and committed to `improve-plan.md`
- [x] **IMP-01** — Argo CD Repo Credentials via Terraform: provisioned `kubernetes_secret_v1.argocd_repo_creds` (`kubeshop-repo-creds`, AWS Secrets Manager preferred + `TF_VAR_github_pat` fallback) before `argocd-root-app` reconciles (`940d0f7`)
- [x] **IMP-02** — Automated Placeholder Substitution: added `scripts/bootstrap-placeholders.sh` (`--dry-run`, `--check`, idempotent apply), `.env.bootstrap.example`, and `make bootstrap` / `make check-placeholders` (`581f11a`)
- [x] **IMP-03** — Least-Privilege IAM for `terraform-apply`: replaced `PowerUserAccess` + `IAMFullAccess` with scoped inline policy `kubeshop-terraform-apply-least-privilege` in `infra/terraform/modules/github-oidc/` (`e316569`)
- [x] **IMP-04** — Argo CD Progressive Syncs + `RollingSync`: enabled `applicationsetcontroller.enable.progressive.syncs` in `bootstrap.tf` and added 2-wave `RollingSync` strategy + `kubeshop.io/sync-wave` labels to `platform-helm-addons` (`e3c2793`)
- [x] **IMP-05** — Route-Level Code Splitting: converted all 8 routes in `web/src/routes.tsx` to `React.lazy`, added `LoadingSpinner` + `Suspense` in `Layout.tsx`, and added Vite vendor `manualChunks` (entry chunk `816 kB → 32.58 kB`, zero chunk warnings) (`c607992`)
- [x] **CI-FIX** — CI & Security Workflow Stabilization: formatted `routes.tsx`, upgraded `zod` to `4.6.7` + `@hookform/resolvers` to `7.0.8` (fixing `GHSA-mrhx-c7xc-m3w5`), updated `gitleaks-action` (`v3.0.0`), `trivy-action` (`v0.36.0`), `golangci-lint` (`v2.15.0`), `cosign-installer` (`v4.1.3`), and fixed `semgrep scan` (`3633f6b`, `1acde80`, `b32f794`, `e1ce969`)
- [x] **IMP-06** — Fix N+1 Orders Query: replaced per-order `loadOrderItems` loop in `List()` with `loadOrderItemsBatch` using `WHERE order_id = ANY($1)`; added `store_test.go` with `TestListBatchLoad` (3 orders, batch verified) and `TestListEmpty` (empty-slice guard); reduces `GET /api/orders` from 51 to 2 DB round-trips at page-size 50 (`d208087`)
- [x] **IMP-07** — Raise Go Test Coverage to ≥80%: added targeted tests across `internal/platform` (`80.8%`), `cart/internal` (`92.7%`), and `orders/internal` (`88.7%`) plus `≥80%` CI coverage gate in `.github/workflows/ci-services.yml`


