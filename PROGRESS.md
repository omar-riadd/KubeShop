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
- [ ] **B-04** — Backend Phase 4: Shared Helm chart `deploy/charts/app` + `values.schema.json` + base/env values + `kubeconform` validation

## Milestone M4 — Terraform & GitOps
- [ ] **B-05** — Backend Phase 5: Terraform (`bootstrap`, `modules/*`, `envs/main`, README) + `fmt`/`validate`/`tflint`/`trivy` (no `apply` without approval)
- [ ] **B-06** — Backend Phase 6: GitOps (`gitops/bootstrap`, `gitops/platform`, `gitops/apps`) & `deploy/charts/env-baseline`

## Milestone M5 — Observability, Security, Reliability & FinOps
- [ ] **B-07** — Backend Phase 7: Observability (Prometheus, Loki, Alloy, Tempo, OTel, Grafana datasources & 5 dashboards, SLO rules, Alertmanager)
- [ ] **B-08** — Backend Phase 8: Security & Policy (Kyverno policies + `kyverno test` suite, NetworkPolicies, RBAC)
- [ ] **B-09** — Backend Phase 9: Reliability, rollouts, k6 load tests (`smoke.js`, `load.js`, `stress.js`), `docs/incident-demo.md`, `docs/cost.md`

## Milestone M6 — Docs & Demo
- [ ] **B-10** — Backend Phase 10: `README.md`, `docs/architecture.md`, ADRs, runbooks, `docs/demo-script.md`, `make cluster-down`
- [ ] **U-06** — UI Phase 6 & 7: `web/README.md`, `docs/ui/design-notes.md`, local screenshots (live cluster verification deferred until cluster apply)
