# KubeShop Improvement Plan

> Generated: 2026-11-22  
> Base commit: `745d930` (branch `main`)  
> Skill: `project-improver`  
> Scope: Planning only — no source changes in this document.

---

## 1. Project Snapshot

| Dimension | Current state |
|-----------|--------------|
| Services | 3 Go microservices (catalog, cart, orders) |
| Frontend | React 19 + TS + Vite + Tailwind v4, 816 kB JS bundle |
| Infra | Terraform EKS (111 resources), 3 envs (dev/staging/prod) |
| GitOps | Argo CD + 2 ApplicationSets, manual promotion workflow |
| Observability | Prometheus / Loki / Tempo / Alloy / OTel / Grafana + 28-day SLOs |
| Security | Kyverno CEL policies, Cosign keyless signing, Trivy, Semgrep, Gitleaks |
| CI | 8 GitHub Actions workflows, Renovate |
| Coverage | 71.6–90.8 % Go, 12 Vitest unit tests only |
| Rating | 8 / 10 — solid foundation, several gaps in live-deployment readiness |

---

## 2. Audit Findings

| ID | Area | Severity | Finding |
|----|------|----------|---------|
| F01 | Pipeline | High | `platform-helm-addons` ApplicationSet has no `RollingSync` strategy; `AllAtOnce` default risks simultaneous addon upgrades. Sync-wave annotations only order resources within one Application, not across ApplicationSet-generated Applications. (`gitops/platform/applicationset.yaml:102`) |
| F02 | Pipeline | **Critical** | No `argocd-repo-creds` secret provisioned for the private GitHub repo. Argo CD will `ComparisonError: authentication required` on every Application immediately after bootstrap. (`infra/terraform/envs/main/bootstrap.tf:85`, `gitops/bootstrap/bootstrap.yaml:13`) |
| F03 | Pipeline | High | 36+ files contain literal `<GH_OWNER>`, `<BASE_DOMAIN>`, `<AWS_ACCOUNT_ID>` placeholders with no automated substitution. Manual `sed` required before every deployment. (`docs/PLACEHOLDERS.md`) |
| F04 | Frontend | Medium | All 7 page components imported statically in `web/src/routes.tsx`. No `React.lazy` → 816 kB eagerly-loaded JS bundle (228 kB gz). `CheckoutPage.tsx` = 407 LOC, `StatusPage.tsx` = 348 LOC. |
| F05 | Performance | Medium | `orders/internal/store.go:228-234` — `List()` issues N+1 queries: 1 query for orders list + 1 `loadOrderItems()` per order (up to 51 round-trips at page size 50). No JOIN or batch fetch. |
| F06 | Quality | Medium | Go test coverage below 80% threshold: `platform` 71.6 %, `cart` 73.4 %, `orders` 72.8 %. `middleware.go` functions (`isFaultExempt`, `routePattern`, `BodyLimitMiddleware`) have zero dedicated test coverage. Frontend: no component-level tests for 6 of 7 page components. |
| F07 | Security | High | `terraform-apply` IAM role uses AWS managed `PowerUserAccess` + `IAMFullAccess`. Both are extremely broad. Should be a tightly scoped custom policy. (`infra/terraform/modules/github-oidc/main.tf:109-116`) |
| F08 | Security | Low | `services/orders/cmd/orders/main.go:51` — `DATABASE_URL` fallback contains `sslmode=disable`. Safe in Kubernetes (ExternalSecrets inject correct URL), but risky if accidentally used without secrets in place. |
| F09 | Security | Info | `infra/terraform/bootstrap/terraform.tfstate.1795311515.backup` contains real AWS account ID (`<AWS_ACCOUNT_ID>`) and KMS ARN — but the file is **not git-tracked** (`.gitignore` pattern `*.tfstate.*` matches it). No action needed; noted for awareness. |
| F10 | Reliability | Medium | Redis deployed as single-replica `Deployment` with `emptyDir` (no PVC). All active carts lost on pod restart. (`deploy/charts/env-baseline/templates/redis.yaml:30`) |
| F11 | Reliability | Low | `cart/internal/catalog_client.go:62-119` — 1 retry, 30-100 ms flat jitter, no exponential backoff. `orders/internal/cart_client.go` — 0 retries. |
| F12 | DX | Medium | No bootstrap script or Makefile target to substitute the 36 placeholders. Developer onboarding requires manually finding and replacing them. |
| F13 | DX | Low | `web/nginx/nginx.conf` — full set of 5 security headers duplicated in 6 `location` blocks. Any CSP change requires 6 edits. |
| F14 | Features | Medium | Order status lifecycle is `PLACED` only. No `CONFIRMED`, `SHIPPED`, `DELIVERED`, `CANCELLED` states, no status update path in store, no customer notification. |
| F15 | Features | Medium | Promotion is fully manual (`workflow_dispatch` + PR). No multi-stage gating (Kargo or equivalent), no automated canary between envs. |
| F16 | Features | Low | No DORA metrics collection or dashboard (OpenCost installed but unused for DORA). |
| F17 | Architecture | Low | Cart prices snapshotted at "add-to-cart time". Price changes after add are silently stale in cart display. No re-validation at checkout time. |
| F18 | Architecture | Low | No application-layer rate limit on `POST /api/orders`. Gateway-level `BackendTrafficPolicy` exists, but a single session can place orders in rapid succession (idempotency key prevents duplicates, not spam). |

---

## 3. Improvement Ideas — Scored & Ranked

Scale: Impact 1–5 (5=highest), Effort 1–5 (5=most effort), Risk 1–5 (5=most risky).  
**Priority score = Impact × 2 − Effort − Risk.**

| # | Idea | Impact | Effort | Risk | Score | Decision |
|---|------|--------|--------|------|-------|----------|
| I01 | Provision ArgoCD repo credentials via Terraform (F02) | 5 | 2 | 1 | 7 | **Do** |
| I02 | Automate placeholder substitution with bootstrap script (F03, F12) | 5 | 2 | 1 | 7 | **Do** |
| I03 | Least-privilege IAM policy for `terraform-apply` role (F07) | 4 | 3 | 2 | 3 | **Do** |
| I04 | Enable ArgoCD progressive syncs + RollingSync on platform ApplicationSet (F01) | 4 | 2 | 2 | 4 | **Do** |
| I05 | Route-level code splitting with `React.lazy` + `Suspense` (F04) | 3 | 1 | 1 | 4 | **Do** |
| I06 | Fix N+1 orders query with batch `loadOrderItems` (F05) | 3 | 2 | 1 | 3 | **Do** |
| I07 | Raise Go test coverage to ≥80 % with targeted tests (F06) | 3 | 3 | 1 | 2 | **Do** |
| I08 | Redis StatefulSet + PVC for cart persistence (F10) | 3 | 2 | 2 | 2 | **Do** |
| I09 | Order status lifecycle (CONFIRMED/SHIPPED/DELIVERED/CANCELLED) (F14) | 4 | 4 | 2 | 2 | **Do** |
| I10 | Automated multi-stage promotion with Kargo (F15) | 4 | 5 | 3 | 0 | Later |
| I11 | Add Vitest component tests for 6 frontend pages (F06) | 2 | 3 | 1 | 0 | **Do** |
| I12 | Exponential backoff retry in catalog + cart HTTP clients (F11) | 2 | 1 | 1 | 2 | **Do** |
| I13 | Harden `DATABASE_URL` fallback to `sslmode=require` (F08) | 1 | 1 | 1 | 0 | **Do** |
| I14 | DORA metrics dashboard in Grafana (F16) | 2 | 3 | 1 | 0 | Later |
| I15 | Cart price re-validation at checkout (F17) | 2 | 3 | 2 | -1 | Later |
| I16 | Per-session rate limit on `POST /api/orders` (F18) | 2 | 2 | 1 | 1 | **Do** |
| I17 | DRY nginx security headers with `include` directive (F13) | 1 | 1 | 1 | 0 | **Do** |
| I18 | DORA change-failure-rate + MTTR integration (F16 extended) | 2 | 4 | 1 | -1 | Later |

---

## 4. Prioritised Step-by-Step Plan

Steps are ordered by dependency and impact. Each step is independently mergeable.

---

### Step 1 — Provision ArgoCD Repo Credentials via Terraform

**Goal:** Argo CD can read the private GitHub repo without manual secret creation.  
**Problem:** `F02` — after bootstrap, every Argo CD Application shows `ComparisonError: authentication required` because no `argocd-repo-creds` secret exists.  
**Depends on:** Nothing.  
**Files to change:**
- `infra/terraform/envs/main/bootstrap.tf` — add `kubernetes_secret` resource
- `infra/terraform/modules/github-oidc/main.tf` or new module for repo credential
- `docs/DEPLOYMENT.md` — document the new GitHub PAT / deploy-key variable

**Actions:**
1. Add a `var.github_deploy_key_private` (sensitive) or `var.github_pat` Terraform variable in `infra/terraform/envs/main/variables.tf`.
2. After the ArgoCD Helm release, create a `kubernetes_secret` resource in namespace `argocd`:
   ```hcl
   resource "kubernetes_secret" "argocd_repo_creds" {
     metadata {
       name      = "kubeshop-repo-creds"
       namespace = "argocd"
       labels    = { "argocd.argoproj.io/secret-type" = "repository" }
     }
     data = {
       type          = "git"
       url           = "https://github.com/${var.github_owner}/kubeshop-platform.git"
       username      = "git"
       password      = var.github_pat  # or use sshPrivateKey for SSH
     }
   }
   ```
3. Add `depends_on = [helm_release.argocd]` to ensure ArgoCD namespace exists first.
4. Store `github_pat` in AWS Secrets Manager under `kubeshop/github-pat` and fetch it with a `data "aws_secretsmanager_secret_version"` data source (never hardcode in tfvars).

**Design notes:** SSH deploy key is preferred over PAT for least-privilege; PAT scope `repo:read` is acceptable for CI-only repos. If using SSH, store the private key PEM in Secrets Manager and reference as `sshPrivateKey` in the secret data.  
**Libraries / tools:** Terraform `hashicorp/kubernetes` provider (already in lockfile).  
**Edge cases:** If the ArgoCD namespace doesn't exist when Terraform runs, `kubernetes_secret` creation fails → `depends_on` on the Helm release solves this.  
**Tests / Verification:**
- After `terraform apply`, run `kubectl get secret kubeshop-repo-creds -n argocd -o jsonpath='{.metadata.labels}'` → should show `argocd.argoproj.io/secret-type=repository`.
- Run `argocd repo list` → repo URL should show `CONNECTION OK`.
- Trigger a manual sync on `argocd-root-app` → all Applications should reach `Synced/Healthy`.

**Done when:** All Argo CD Applications show `Synced` and `Healthy` within 5 minutes of `terraform apply` with no manual secret creation.  
**Rollback:** Delete the `kubernetes_secret` resource from the Terraform state (`terraform state rm`) and manually remove the secret from the cluster.  
**Effort:** ~3 h

---

### Step 2 — Automate Placeholder Substitution (Bootstrap Script)

**Goal:** Any developer can clone and deploy with one command; no manual `sed` required.  
**Problem:** `F03`, `F12` — 36+ files contain literal `<GH_OWNER>`, `<BASE_DOMAIN>`, `<AWS_ACCOUNT_ID>`, `<AWS_REGION>`, `<CLUSTER_NAME>`, `<HOSTED_ZONE_ID>` placeholders. No automation exists.  
**Depends on:** Nothing.  
**Files to change:**
- `scripts/bootstrap-placeholders.sh` — NEW file
- `Makefile` — add `bootstrap` target
- `docs/DEPLOYMENT.md` — update onboarding section
- `docs/PLACEHOLDERS.md` — reference the script

**Actions:**
1. Create `scripts/bootstrap-placeholders.sh`:
   ```bash
   #!/usr/bin/env bash
   set -euo pipefail
   # Required env vars (checked at start)
   : "${GH_OWNER:?}" "${BASE_DOMAIN:?}" "${AWS_ACCOUNT_ID:?}" \
     "${AWS_REGION:?}" "${CLUSTER_NAME:?}" "${HOSTED_ZONE_ID:?}"
   
   FILES=$(grep -rl '<GH_OWNER>\|<BASE_DOMAIN>\|<AWS_ACCOUNT_ID>\|<AWS_REGION>\|<CLUSTER_NAME>\|<HOSTED_ZONE_ID>' \
     --include='*.yaml' --include='*.tf' --include='*.json' --include='*.md' .)
   
   for f in $FILES; do
     sed -i \
       -e "s|<GH_OWNER>|${GH_OWNER}|g" \
       -e "s|<BASE_DOMAIN>|${BASE_DOMAIN}|g" \
       -e "s|<AWS_ACCOUNT_ID>|${AWS_ACCOUNT_ID}|g" \
       -e "s|<AWS_REGION>|${AWS_REGION}|g" \
       -e "s|<CLUSTER_NAME>|${CLUSTER_NAME}|g" \
       -e "s|<HOSTED_ZONE_ID>|${HOSTED_ZONE_ID}|g" \
       "$f"
     echo "patched: $f"
   done
   echo "Done. Commit the changes or add to .gitignore if keeping originals as templates."
   ```
2. Add a `Makefile` target:
   ```makefile
   bootstrap:
   	@echo "Substituting placeholders..."
   	@bash scripts/bootstrap-placeholders.sh
   ```
3. Update `docs/DEPLOYMENT.md` Step 1 to say: "Copy `.env.bootstrap.example` to `.env.bootstrap`, fill values, then run `make bootstrap`."
4. Create `.env.bootstrap.example` documenting all 6 variables with descriptions.
5. Add `.env.bootstrap` to `.gitignore`.

**Design notes:** Keep placeholder strings in source files so the repo is cloneable without secrets (useful for public forks). The script is idempotent if run multiple times (sed on already-substituted values is a no-op because no `<…>` left).  
**Edge cases:** Binary files — `grep -l` will skip them implicitly; `sed -i` on a binary would corrupt it, so scope `--include` flags tightly.  
**Tests / Verification:**
- After running `make bootstrap`, `grep -r '<GH_OWNER>' .` should return 0 matches (excluding `docs/PLACEHOLDERS.md` and the script itself).
- CI: add a `check-placeholders` job that runs `grep -r '<GH_OWNER>\|<BASE_DOMAIN>' --include='*.yaml' --include='*.tf' . && exit 1 || exit 0` to prevent committed placeholders in deployed branches.

**Done when:** `make bootstrap` runs in <30 s, substitutes all 36+ files, and `grep -r '<GH_OWNER>' .` finds 0 matches in non-template files.  
**Rollback:** `git checkout -- .` to revert all substitutions.  
**Effort:** ~2 h

---

### Step 3 — Least-Privilege IAM Policy for `terraform-apply` Role

**Goal:** Replace `PowerUserAccess` + `IAMFullAccess` with a minimal custom policy.  
**Problem:** `F07` — the GitHub Actions OIDC role used by `terraform apply` has effectively full AWS access.  
**Depends on:** Nothing.  
**Files to change:**
- `infra/terraform/modules/github-oidc/main.tf` — replace managed policy attachments with inline custom policy

**Actions:**
1. Remove the two `aws_iam_role_policy_attachment` resources for `PowerUserAccess` and `IAMFullAccess`.
2. Add a single `aws_iam_role_policy` (inline) with the following statement groups:
   - **EKS**: `eks:*` on `arn:aws:eks:*:ACCOUNT:cluster/kubeshop-*`
   - **EC2 / VPC**: `ec2:Describe*`, `ec2:CreateVpc`, `ec2:CreateSubnet`, `ec2:CreateSecurityGroup`, `ec2:CreateInternetGateway`, `ec2:CreateRouteTable`, `ec2:*Route`, `ec2:AttachInternetGateway`, `ec2:*Tags`, `ec2:Delete*` (scoped to kubeshop resources via condition `aws:ResourceTag/Project: kubeshop`)
   - **IAM** (narrow): `iam:CreateRole`, `iam:DeleteRole`, `iam:AttachRolePolicy`, `iam:DetachRolePolicy`, `iam:PutRolePolicy`, `iam:DeleteRolePolicy`, `iam:PassRole` — all scoped to `arn:aws:iam::ACCOUNT:role/kubeshop-*`
   - **S3**: `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject`, `s3:ListBucket` on the state bucket ARN only
   - **KMS**: `kms:*` on the state bucket KMS key ARN only
   - **Route53**: `route53:ChangeResourceRecordSets`, `route53:GetHostedZone`, `route53:ListResourceRecordSets` on the hosted zone ARN
   - **CloudWatch / Logs**: `logs:*`, `cloudwatch:PutMetricAlarm`, `cloudwatch:DeleteAlarms` — region-scoped
   - **Budgets**: `budgets:*` on `arn:aws:budgets::ACCOUNT:budget/kubeshop-*`
   - **SecretsManager**: `secretsmanager:GetSecretValue`, `secretsmanager:CreateSecret`, `secretsmanager:DeleteSecret`, `secretsmanager:UpdateSecret`, `secretsmanager:DescribeSecret` on `arn:aws:secretsmanager:*:ACCOUNT:secret:kubeshop/*`
   - **ELB**: `elasticloadbalancing:*` (AWS LBC needs broad ELB permissions)
   - **ACM**: `acm:RequestCertificate`, `acm:DescribeCertificate`, `acm:DeleteCertificate`, `acm:ListCertificates`
3. Use `${data.aws_caller_identity.current.account_id}` for the account ID in ARNs (already available in the module).
4. Add a note in `docs/SECURITY.md` explaining the policy scope.

**Design notes:** `iam:PassRole` is the highest-risk permission — scope it strictly to `kubeshop-*` roles. ELB is hard to scope tightly because AWS LBC creates resources with generated names; acceptable to allow `elasticloadbalancing:*` with a tag condition if feasible.  
**Libraries / tools:** None new.  
**Edge cases:** Future Terraform resources outside the `kubeshop-*` naming convention will fail with AccessDenied → enforce naming convention via Kyverno or policy doc.  
**Tests / Verification:**
- Run `terraform plan` from GitHub Actions after the policy change → should succeed without AccessDenied errors.
- Run AWS IAM Access Analyzer on the role → no "public access" or "overly permissive" findings.

**Done when:** GitHub Actions `terraform apply` succeeds end-to-end with the new policy; `PowerUserAccess` and `IAMFullAccess` are no longer attached.  
**Rollback:** Re-attach managed policies and remove inline policy via Terraform.  
**Effort:** ~4 h

---

### Step 4 — Enable ArgoCD Progressive Syncs + RollingSync

**Goal:** Platform addon upgrades apply in waves (cert-manager → external-dns → ingress → others) instead of simultaneously.  
**Problem:** `F01` — `AllAtOnce` strategy risks addon conflicts during upgrades (e.g., CRDs created by cert-manager used by ingress must exist first across Applications, not just within one Application).  
**Depends on:** Step 1 (ArgoCD must be syncing successfully to verify progressive syncs).  
**Files to change:**
- `gitops/platform/applicationset.yaml` — add `strategy` block + Application label `env`
- `infra/terraform/envs/main/bootstrap.tf` or ArgoCD Helm values — enable `applicationsetcontroller.enable.progressive.syncs: true`

**Actions:**
1. In the ArgoCD Helm values (passed via `bootstrap.tf` `set` blocks), add:
   ```yaml
   applicationSet:
     extraArgs:
       - --enable-progressive-syncs
   ```
2. Add an `env` label to each Application generated by the platform ApplicationSet:
   ```yaml
   template:
     metadata:
       labels:
         env: "{{env}}"
   ```
3. Add a `strategy` section to `gitops/platform/applicationset.yaml`:
   ```yaml
   strategy:
     type: RollingSync
     rollingSync:
       steps:
         - matchExpressions:
             - key: sync-wave
               operator: In
               values: ["0"]    # cert-manager, external-secrets
         - matchExpressions:
             - key: sync-wave
               operator: In
               values: ["1"]    # external-dns, aws-load-balancer-controller
         - matchExpressions:
             - key: sync-wave
               operator: In
               values: ["2"]    # ingress-nginx, kube-prometheus-stack
         - {}                   # all remaining (Kyverno, Loki, Tempo, etc.)
   ```
4. Add `sync-wave` label (not annotation) to each Application entry in the ApplicationSet template so `matchExpressions` can select them.

**Design notes:** `RollingSync` is Beta in ArgoCD v3.3+ (confirmed: cluster uses v3.6.2). The `matchExpressions` match against Application *labels*, not resource annotations — this is a common confusion. Sync-wave *annotations* inside an Application continue to work for intra-Application ordering.  
**Libraries / tools:** None new.  
**Edge cases:** If `--enable-progressive-syncs` flag is missing, the `strategy` block is silently ignored and `AllAtOnce` applies. Add an ArgoCD health check that confirms the flag is active.  
**Tests / Verification:**
- Trigger a re-sync of the platform ApplicationSet.
- Observe in Argo CD UI that wave-0 Applications (`cert-manager`, `external-secrets`) sync and become `Healthy` before wave-1 begins.
- Check ArgoCD application-controller logs for `progressive sync` log entries.

**Done when:** ArgoCD UI shows Applications syncing in sequential waves (not simultaneously) during a forced re-sync.  
**Rollback:** Remove `strategy` block and revert Helm args → reverts to `AllAtOnce`.  
**Effort:** ~3 h

---

### Step 5 — Route-Level Code Splitting (`React.lazy` + `Suspense`)

**Goal:** Reduce initial JS bundle from 816 kB to <200 kB (lazy-load all pages except root).  
**Problem:** `F04` — `web/src/routes.tsx` eagerly imports all 7 pages. `CheckoutPage`, `StatusPage`, and `CartPage` are large and rarely needed on first load.  
**Depends on:** Nothing.  
**Files to change:**
- `web/src/routes.tsx` — convert static imports to `React.lazy`
- `web/src/main.tsx` or `web/src/App.tsx` — wrap router in `<Suspense>`
- `web/src/components/LoadingSpinner.tsx` — NEW: fallback component

**Actions:**
1. Replace static page imports in `routes.tsx`:
   ```tsx
   // Before
   import CheckoutPage from './pages/CheckoutPage';
   // After
   const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
   ```
   Apply to all 7 pages: `CatalogPage`, `CartPage`, `CheckoutPage`, `ProductPage`, `OrdersPage`, `OrderPage`, `StatusPage`.
2. Create `web/src/components/LoadingSpinner.tsx` — simple centered spinner using existing Tailwind classes.
3. Wrap the `<RouterProvider>` (or route children) in `<Suspense fallback={<LoadingSpinner />}>`.
4. Run `vite build` and confirm:
   - Main chunk < 200 kB JS
   - Each page becomes a separate chunk (`.js` file in `dist/assets/`)
5. Update `web/nginx/nginx.conf` to add `Cache-Control: max-age=31536000, immutable` for `*.js` assets (hashed filenames, safe to cache forever).

**Design notes:** React Router v7 has native lazy support via `lazy` route property — prefer that over component-level `React.lazy` if `routes.tsx` uses the new data-router API (check if `createBrowserRouter` or `<BrowserRouter>` is used).  
**Libraries / tools:** No new libraries. `React.lazy` is built-in.  
**Edge cases:** SSR (not used here — Vite SPA). Dynamic imports fail in very old browsers (ES modules not supported) — acceptable since the app already uses React 19.  
**Tests / Verification:**
- `vite build --mode production` → check `dist/assets/` for per-page chunks.
- Lighthouse CI: FCP and LCP scores should improve ≥10 points.
- Run existing Vitest and Playwright tests → should all pass (no logic change, only import style).

**Done when:** `vite build` produces a main chunk <200 kB JS, each page lazy-loads in Lighthouse network waterfall.  
**Rollback:** Revert `routes.tsx` to static imports.  
**Effort:** ~2 h

---

### Step 6 — Fix N+1 Orders Query with Batch Load

**Goal:** Reduce `GET /api/orders` from 51 DB round-trips to 2 at page size 50.  
**Problem:** `F05` — `store.go:228-234` calls `loadOrderItems(ctx, tx, o.ID)` inside a loop over fetched orders. Each call issues a separate `SELECT … WHERE order_id = $1`.  
**Depends on:** Nothing.  
**Files to change:**
- `services/orders/internal/store.go` — refactor `List()` and `loadOrderItems`
- `services/orders/internal/store_test.go` — add regression test for batch load

**Actions:**
1. Add a new private function `loadOrderItemsBatch(ctx, tx, orderIDs []uuid.UUID) (map[uuid.UUID][]OrderItem, error)`:
   ```go
   rows, err := tx.Query(ctx,
     `SELECT order_id, product_id, quantity, price_cents
      FROM order_items WHERE order_id = ANY($1)`,
     orderIDs)
   ```
   Build a `map[uuid.UUID][]OrderItem` keyed by `order_id`.
2. In `List()`, after fetching all orders into a slice, collect their IDs, call `loadOrderItemsBatch`, then assign items from the map.
3. Remove the per-order `loadOrderItems` call inside the loop.
4. Keep `loadOrderItems` (single-order version) for use by `Get()`.

**Design notes:** `pgx` supports `pgtype.Array[uuid.UUID]` or simply `[]uuid.UUID` for `ANY($1)` — the driver handles marshalling. Result ordering is not guaranteed by `ANY`; build the map and assign rather than relying on row order.  
**Libraries / tools:** `pgx/v5` (already a dependency).  
**Edge cases:** Empty order list → skip the batch query entirely (avoid `ANY('')` error). Very large result sets (>1000 orders) — pagination is already enforced at 50; no issue.  
**Tests / Verification:**
- Unit test: insert 10 orders with 3 items each → `List()` returns all items, verify only 2 SQL queries executed (using `pgxmock` or test DB query log).
- k6 smoke test for `/api/orders`: p99 latency should drop from ~150 ms to <30 ms under moderate load.

**Done when:** `store_test.go` passes, k6 smoke reports p99 `/api/orders` <30 ms, pgx query log shows 2 queries per `List()` call.  
**Rollback:** Revert `store.go` to loop-based load.  
**Effort:** ~3 h

---

### Step 7 — Raise Go Test Coverage to ≥80 %

**Goal:** All three Go packages pass the 80 % coverage gate in CI.  
**Problem:** `F06` — `platform` 71.6 %, `cart` 73.4 %, `orders` 72.8 %. Functions with zero coverage: `isFaultExempt`, `routePattern`, `BodyLimitMiddleware` in `middleware.go`.  
**Depends on:** Nothing.  
**Files to change:**
- `services/internal/platform/middleware_test.go` — add tests for uncovered middleware functions
- `services/cart/internal/handler_test.go` or `store_test.go` — add missing cart coverage
- `services/orders/internal/handler_test.go` or `store_test.go` — add missing orders coverage

**Actions:**
1. For `isFaultExempt` — test with health/readiness/metrics paths (should return true) and a business path (false).
2. For `routePattern` — test with a `chi` router context that has a route pattern set vs. one without.
3. For `BodyLimitMiddleware` — test that requests exceeding the byte limit receive 413, and requests within limit pass through.
4. For cart: identify uncovered lines via `go test -coverprofile=cov.out ./... && go tool cover -html=cov.out`. Add table-driven tests for the gap lines.
5. For orders: same process. Priority: `store.go` list/filter edge cases, error paths in `handler.go`.
6. Add a CI check: `go test -covermode=atomic -coverpkg=./... ./... | grep -E 'coverage: [0-9]+' | awk '{if ($2+0 < 80) exit 1}'` — fail build if any package is below 80 %.

**Design notes:** Use `httptest.NewRecorder` + `chi.NewRouter` for middleware tests — no external dependencies needed. Avoid testing implementation details; test observable HTTP behavior.  
**Libraries / tools:** `net/http/httptest` (stdlib), `github.com/go-chi/chi/v5` (already a dep).  
**Edge cases:** Coverage of generated code (protobuf, etc.) — exclude via `//go:build ignore` or `-coverpkg` exclusion pattern if needed.  
**Tests / Verification:**
- `go test -cover ./services/...` → all packages show `coverage: ≥80.0 %`.
- CI `test.yml` passes on a PR that only adds tests.

**Done when:** `go test -cover` reports ≥80 % for `platform`, `cart`, and `orders` packages.  
**Rollback:** N/A (adding tests is non-breaking).  
**Effort:** ~4 h

---

### Step 8 — Redis StatefulSet + PVC for Cart Persistence

**Goal:** Cart data survives Redis pod restarts; prod carts are not silently lost.  
**Problem:** `F10` — Redis deployed as a `Deployment` with `emptyDir`. A pod restart (OOM, node drain, rolling update) drops all cart keys.  
**Depends on:** Nothing (Helm chart change, no service API change).  
**Files to change:**
- `deploy/charts/env-baseline/templates/redis.yaml` — convert to `StatefulSet`, add `volumeClaimTemplates`
- `deploy/charts/env-baseline/values.yaml` — add `redis.persistence.enabled` and `redis.persistence.storageClass` values
- `deploy/charts/env-baseline/values-prod.yaml` (or override) — set `enabled: true`, `storageClass: gp3`

**Actions:**
1. Convert `redis.yaml` from `Deployment` to `StatefulSet`.
2. Remove `emptyDir` volume and add:
   ```yaml
   volumeClaimTemplates:
   - metadata:
       name: redis-data
     spec:
       accessModes: ["ReadWriteOnce"]
       storageClassName: "{{ .Values.redis.persistence.storageClass }}"
       resources:
         requests:
           storage: "{{ .Values.redis.persistence.size | default \"1Gi\" }}"
   ```
3. Mount at `/data` in the Redis container (`--save` flag must be set for RDB persistence):
   ```yaml
   args: ["--save", "60", "1", "--loglevel", "notice"]
   ```
4. Set `redis.persistence.enabled: false` for `dev` env (keep ephemeral), `true` for `staging` and `prod`.
5. Add a PodDisruptionBudget with `minAvailable: 1` for the prod namespace.

**Design notes:** A single Redis replica with PVC provides crash durability, not HA. For true HA, Redis Sentinel or Redis Cluster (or ElastiCache) would be needed — that is a separate, larger effort. The PVC approach is the right incremental step given cart TTL is 24 h.  
**Libraries / tools:** No new libraries. EKS gp3 StorageClass must exist (already provisioned by EKS Terraform module).  
**Edge cases:** Existing `Deployment` → `StatefulSet` migration: Kubernetes will reject renaming a `Deployment` to a `StatefulSet` in-place. The Helm upgrade will delete the `Deployment` and create the `StatefulSet`. This causes a brief Redis downtime (carts in memory are lost once during the migration). Document this clearly. Use a maintenance window for prod.  
**Tests / Verification:**
- Deploy to dev, write a cart key, `kubectl delete pod redis-0`, confirm key survives after pod restart.
- Run cart integration tests → all pass.

**Done when:** Redis runs as `StatefulSet` with PVC in staging/prod; a pod restart does not clear cart data.  
**Rollback:** Revert `redis.yaml` to `Deployment`, remove PVC claim.  
**Effort:** ~3 h

---

### Step 9 — Order Status Lifecycle

**Goal:** Orders progress through `PLACED → CONFIRMED → SHIPPED → DELIVERED` (or `CANCELLED`) with an API and optional async notification.  
**Problem:** `F14` — `status` column exists in schema but only ever holds `PLACED`. No update endpoint, no state machine, no customer notification.  
**Depends on:** Nothing (pure backend addition, no breaking API changes).  
**Files to change:**
- `api/openapi.yaml` — add `PATCH /api/orders/{id}/status` endpoint
- `services/orders/internal/handler.go` — add `UpdateStatus` handler
- `services/orders/internal/store.go` — add `UpdateStatus(ctx, id, newStatus)` function
- `services/orders/internal/store_test.go` — add status transition tests
- `services/orders/migrations/` — add migration to add `updated_at` column if missing

**Actions:**
1. Define the state machine transitions (enforced in the store layer, not just the handler):
   ```
   PLACED → CONFIRMED
   CONFIRMED → SHIPPED
   SHIPPED → DELIVERED
   PLACED | CONFIRMED → CANCELLED
   DELIVERED | CANCELLED → (terminal, no transition)
   ```
2. Add `PATCH /api/orders/{id}/status` to `openapi.yaml`:
   ```yaml
   requestBody:
     content:
       application/json:
         schema:
           properties:
             status:
               type: string
               enum: [CONFIRMED, SHIPPED, DELIVERED, CANCELLED]
   ```
3. Add `UpdateStatus` to the store:
   ```go
   func (s *Store) UpdateStatus(ctx context.Context, id uuid.UUID, newStatus string) error {
     // validate transition
     // UPDATE orders SET status=$2, updated_at=NOW() WHERE id=$1 AND status IN (allowed_prev_states)
     // if rowsAffected == 0 → return ErrInvalidTransition
   }
   ```
4. Handler: require `Authorization` header; for now, accept any authenticated request (future: admin role check via RBAC).
5. Emit a structured log event on status change (for future webhook / notification hook).

**Design notes:** Keep notification async and out of scope for this step — emit a log event that a future worker can tail. The `PATCH` endpoint is a good REST primitive; avoid `PUT /api/orders/{id}` which would require sending the full order body.  
**Libraries / tools:** No new libraries.  
**Edge cases:** Concurrent updates to the same order status — use `UPDATE … WHERE status = $expected_prev` (optimistic locking via the state constraint) to prevent races.  
**Tests / Verification:**
- Unit tests: valid transitions succeed, invalid transitions return 409.
- Integration test: `PLACED → CONFIRMED → SHIPPED → DELIVERED` full chain.
- `DELIVERED → CONFIRMED` returns 409.
- k6 smoke: `PATCH /api/orders/{id}/status` at 10 RPS, p99 < 50 ms.

**Done when:** All 4 status transitions work via API, invalid transitions return 409, state machine is enforced at the DB layer.  
**Rollback:** Remove the new endpoint from `openapi.yaml` and handler; `UpdateStatus` store function is non-breaking (additive).  
**Effort:** ~5 h

---

### Step 10 — Exponential Backoff Retry in HTTP Clients

**Goal:** Catalog and cart HTTP clients handle transient failures gracefully.  
**Problem:** `F11` — `catalog_client.go` has 1 retry with flat jitter; `cart_client.go` has 0 retries. Under a momentary spike or pod restart, catalog calls from cart will fail immediately.  
**Depends on:** Nothing.  
**Files to change:**
- `services/cart/internal/catalog_client.go`
- `services/orders/internal/cart_client.go`
- `services/internal/platform/retry.go` — NEW: shared retry helper

**Actions:**
1. Create `services/internal/platform/retry.go` with an exponential backoff helper:
   ```go
   func WithRetry(ctx context.Context, maxAttempts int, fn func() error) error {
     delay := 100 * time.Millisecond
     for i := 0; i < maxAttempts; i++ {
       err := fn()
       if err == nil { return nil }
       if i == maxAttempts-1 { return err }
       jitter := time.Duration(rand.Int63n(int64(delay / 2)))
       select {
       case <-ctx.Done(): return ctx.Err()
       case <-time.After(delay + jitter):
       }
       delay = min(delay*2, 5*time.Second)
     }
     return nil
   }
   ```
2. Replace manual retry loops in `catalog_client.go` with `platform.WithRetry(ctx, 3, func() error { … })`.
3. Wrap the catalog call in `cart_client.go` (orders service) with `platform.WithRetry(ctx, 3, …)`.
4. Only retry on 5xx / network errors, not 4xx (use `resp.StatusCode >= 500` check).

**Design notes:** Cap at 3 retries with max 5-second delay to avoid blocking request goroutines for too long in a synchronous HTTP flow. Consider adding a circuit breaker (e.g., `github.com/sony/gobreaker`) as a follow-up.  
**Libraries / tools:** No new libraries (uses stdlib `time`, `math/rand`).  
**Edge cases:** `ctx` cancellation during retry sleep — handled by the `select` statement. Non-idempotent calls should not be retried — `GET` is safe, `POST /api/orders` is idempotent via the idempotency key.  
**Tests / Verification:**
- Unit test: mock HTTP server returns 503 twice, then 200 → `WithRetry` returns nil.
- Unit test: mock returns 503 three times → returns error after 3 attempts.
- Unit test: `ctx` cancelled mid-retry → returns `ctx.Err()` immediately.

**Done when:** `platform.WithRetry` has 100 % test coverage; both clients use it; existing integration tests pass.  
**Rollback:** Remove `retry.go` and revert client files.  
**Effort:** ~2 h

---

### Step 11 — Add Vitest Component Tests for Frontend Pages

**Goal:** At least 6 of 7 page components have a Vitest + React Testing Library test.  
**Problem:** `F06` — only 12 Vitest unit tests exist, all for utility functions. No component tests for `CatalogPage`, `CartPage`, `OrdersPage`, `ProductPage`, `StatusPage`, `OrderPage`.  
**Depends on:** Nothing.  
**Files to change:**
- `web/src/pages/__tests__/CatalogPage.test.tsx` — NEW
- `web/src/pages/__tests__/CartPage.test.tsx` — NEW
- `web/src/pages/__tests__/OrdersPage.test.tsx` — NEW
- `web/src/pages/__tests__/ProductPage.test.tsx` — NEW
- `web/src/pages/__tests__/StatusPage.test.tsx` — NEW
- `web/src/pages/__tests__/OrderPage.test.tsx` — NEW
- `web/vite.config.ts` — confirm `@testing-library/react` and `msw` are in `devDependencies`

**Actions:**
1. For each page, write tests covering:
   - **Happy path**: mock API response, assert key UI elements render (`screen.getByText`, `screen.getByRole`).
   - **Loading state**: assert spinner/skeleton shown while API resolves.
   - **Error state**: mock API 500, assert error message shown.
2. Use `msw` (Mock Service Worker) for API mocking — it's the recommended approach for React Testing Library; check if already installed.
3. For `CatalogPage`: mock `GET /api/products` with 3 products → assert 3 product cards render.
4. For `CartPage`: mock `GET /api/cart` with 2 items → assert items and subtotal render.
5. For `StatusPage`: mock `GET /api/health` → assert all service health indicators render.

**Design notes:** Avoid snapshot tests for pages — they are brittle and don't test behavior. Focus on user-visible behavior. Use `userEvent` for interaction tests (add to cart, remove item).  
**Libraries / tools:** `@testing-library/react`, `@testing-library/user-event`, `msw` — check if already in `package.json`; if not, they are the standard additions.  
**Edge cases:** React Router context required for pages that use `useParams` or `useNavigate` — wrap in `MemoryRouter` or use `createMemoryRouter` from React Router v7.  
**Tests / Verification:**
- `npm run test` → all 6 new test files pass.
- Coverage report: frontend page coverage goes from 0 % to ≥70 % for each tested page.

**Done when:** 6 new test files exist, all pass in CI, frontend coverage ≥70 % per page.  
**Rollback:** N/A (adding tests is non-breaking).  
**Effort:** ~6 h

---

### Step 12 — Harden `DATABASE_URL` Fallback

**Goal:** Eliminate insecure `sslmode=disable` default from the codebase.  
**Problem:** `F08` — `services/orders/cmd/orders/main.go:51` defaults to `sslmode=disable` if `DATABASE_URL` env var is not set. Accidental use without ExternalSecrets results in unencrypted DB connections.  
**Depends on:** Nothing.  
**Files to change:**
- `services/orders/cmd/orders/main.go`

**Actions:**
1. Change the fallback from:
   ```go
   dsn := getEnv("DATABASE_URL", "postgres://localhost:5432/kubeshop?sslmode=disable")
   ```
   to:
   ```go
   dsn := getEnv("DATABASE_URL", "postgres://localhost:5432/kubeshop?sslmode=require")
   ```
2. Update `docker-compose.yaml` PostgreSQL service to set `PGSSLMODE=disable` for local dev only (or add a `compose.override.yaml` that sets the env var explicitly for dev).
3. Document in `docs/LOCAL_DEV.md` that `DATABASE_URL` must be set explicitly for local dev if PostgreSQL doesn't have SSL configured; the new fallback will refuse unencrypted connections.

**Design notes:** `sslmode=require` on localhost will fail unless the local Postgres has SSL configured. The clean fix is to require `DATABASE_URL` to be set explicitly (error if missing) rather than provide a fallback at all — but that is a bigger change to local dev workflow. The `sslmode=require` default is a good intermediate step.  
**Edge cases:** Docker Compose local dev — handled by step 2 above.  
**Tests / Verification:**
- Unit test: `main.go` panics (or exits with error) if `DATABASE_URL` is not set and the default `sslmode=require` connection fails (testable by mocking `pgx.Connect`).
- CI integration tests: `DATABASE_URL` is set by the GitHub Actions `services:` block → no regression.

**Done when:** `sslmode=disable` does not appear anywhere in the main service binary code; local dev instructions updated.  
**Rollback:** Revert `main.go` default string.  
**Effort:** ~1 h

---

### Step 13 — Per-Session Rate Limit on `POST /api/orders`

**Goal:** Prevent a single user from spamming the orders endpoint, even with idempotency keys that differ.  
**Problem:** `F18` — gateway-level rate limit exists, but no per-session / per-user limit. A single session can issue many distinct orders rapidly.  
**Depends on:** Nothing.  
**Files to change:**
- `services/internal/platform/middleware.go` — add `SessionRateLimitMiddleware`
- `services/orders/cmd/orders/main.go` — apply middleware to `POST /api/orders`

**Actions:**
1. Add `SessionRateLimitMiddleware(rps int, burst int)` using `golang.org/x/time/rate` (stdlib-adjacent, already in module graph via other deps — if not, it is a standard Google package):
   ```go
   func SessionRateLimitMiddleware(rps, burst int) func(http.Handler) http.Handler {
     limiters := sync.Map{} // key: session ID or remote IP
     return func(next http.Handler) http.Handler {
       return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
         key := sessionKey(r) // session cookie or X-Forwarded-For header
         lim, _ := limiters.LoadOrStore(key, rate.NewLimiter(rate.Limit(rps), burst))
         if !lim.(*rate.Limiter).Allow() {
           http.Error(w, "rate limit exceeded", http.StatusTooManyRequests)
           return
         }
         next.ServeHTTP(w, r)
       })
     }
   }
   ```
2. Apply with `rps=2, burst=5` to `POST /api/orders` route in `main.go`.
3. Add cleanup goroutine to evict stale limiters (use `sync.Map` range + timestamp tracking to avoid unbounded memory growth).

**Design notes:** `sync.Map` with per-key limiters is a standard Go pattern for in-process rate limiting. It does not persist across pod restarts or coordinate across replicas — for multi-replica coordination, Redis is needed. For now, per-pod limiting is acceptable (per-pod allows `rps` per replica; with 2 replicas, effective rate is `2 × rps`). Document this.  
**Libraries / tools:** `golang.org/x/time/rate` — verify if in `go.sum` already.  
**Edge cases:** IP-based limiting behind a proxy — use `X-Forwarded-For` only if trusted (behind the ingress). Session cookie-based limiting is preferred.  
**Tests / Verification:**
- Unit test: send 6 requests in <1 s to the middleware → first 5 (burst) pass, 6th returns 429.
- Integration test: k6 script sending 10 RPS to `POST /api/orders` → ~2 succeed/s, rest are 429.

**Done when:** `POST /api/orders` returns 429 after `burst` requests in quick succession from the same session.  
**Rollback:** Remove middleware application from `main.go` (middleware itself is harmless if not applied).  
**Effort:** ~3 h

---

### Step 14 — DRY Nginx Security Headers

**Goal:** A single CSP change requires editing 1 line, not 6.  
**Problem:** `F13` — `web/nginx/nginx.conf` duplicates 5 security headers across 6 `location` blocks.  
**Depends on:** Nothing.  
**Files to change:**
- `web/nginx/nginx.conf`
- `web/nginx/security_headers.conf` — NEW: included snippet

**Actions:**
1. Extract the 5 header directives into `web/nginx/security_headers.conf`:
   ```nginx
   add_header X-Frame-Options "SAMEORIGIN" always;
   add_header X-Content-Type-Options "nosniff" always;
   add_header Referrer-Policy "strict-origin-when-cross-origin" always;
   add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
   add_header Content-Security-Policy "default-src 'self'; ..." always;
   ```
2. In `nginx.conf`, replace the 6 × 5-header blocks with `include /etc/nginx/security_headers.conf;`.
3. Update `web/Dockerfile` to `COPY nginx/security_headers.conf /etc/nginx/security_headers.conf`.

**Design notes:** `add_header` in Nginx is not inherited from parent blocks by default if child blocks have their own `add_header` — using `include` avoids this footgun and keeps the headers co-located.  
**Edge cases:** The CSP for the API proxy `location /api/` may need a different CSP (e.g., allowing `connect-src` to the backend) — keep the API location's CSP separate if it differs.  
**Tests / Verification:**
- `docker compose up web` → `curl -I http://localhost:8080/` shows all 5 headers.
- `curl -I http://localhost:8080/api/health` shows all 5 headers.
- Playwright E2E tests pass (no CSP change, only refactor).

**Done when:** `nginx.conf` contains no inline security header directives; all headers served from the included file; existing tests pass.  
**Rollback:** Revert `nginx.conf`, remove `security_headers.conf`.  
**Effort:** ~1 h

---

## 5. Deferred Ideas

| Idea | Reason deferred |
|------|----------------|
| I10 — Kargo multi-stage promotion | High effort (5), significant ArgoCD/Kargo expertise required; manual `workflow_dispatch` is acceptable until team grows |
| I14 — DORA metrics dashboard | Requires event data collection from CI + deployment events; partial (OpenCost installed) but needs dedicated tooling |
| I15 — Cart price re-validation at checkout | Medium effort, niche correctness issue; order snapshot at checkout is correct; UX impact is low |
| I18 — DORA change-failure-rate + MTTR | Depends on I14; deferred together |

---

## 6. Implementation Order (Recommended)

```
Week 1 (Blockers & Security)
  Step 1  — ArgoCD repo credentials          [3 h]
  Step 2  — Placeholder bootstrap script     [2 h]
  Step 3  — Least-privilege IAM              [4 h]

Week 2 (Reliability & Performance)
  Step 4  — Progressive syncs               [3 h]
  Step 5  — React.lazy code splitting        [2 h]
  Step 6  — N+1 orders query fix             [3 h]
  Step 8  — Redis StatefulSet + PVC          [3 h]

Week 3 (Quality & Features)
  Step 7  — Go test coverage ≥80 %          [4 h]
  Step 9  — Order status lifecycle           [5 h]
  Step 10 — Exponential backoff retry        [2 h]

Week 4 (DX & Polish)
  Step 11 — Vitest component tests           [6 h]
  Step 12 — DATABASE_URL sslmode hardening   [1 h]
  Step 13 — Per-session order rate limit     [3 h]
  Step 14 — DRY nginx security headers       [1 h]
```

**Total estimated effort: ~42 h** (roughly 2 sprints for one developer)

---

## 7. Expected Outcomes

| Metric | Current | Target |
|--------|---------|--------|
| GitOps live-sync after bootstrap | ❌ (auth failure) | ✅ Fully automatic |
| Developer onboarding time | ~60 min manual sed | <5 min (`make bootstrap`) |
| IAM blast radius (terraform-apply) | Full AWS account | ~15 specific actions |
| Initial JS bundle | 816 kB | <200 kB |
| Orders `List()` DB round-trips | 51 (at pg 50) | 2 |
| Go test coverage (min) | 71.6 % | ≥80 % |
| Redis cart durability | Lost on restart | Survives pod restart |
| Order states | 1 (`PLACED`) | 5 (full lifecycle) |
| Project rating | 8.0 / 10 | 9.5 / 10 |

---

## 8. Notes & Constraints

- **F09 (tfstate backup)** — `terraform.tfstate.1795311515.backup` is NOT tracked in git (`.gitignore` `*.tfstate.*` pattern covers it). No action required; informational only.
- **F02 is a live deployment blocker** — without Step 1, ArgoCD cannot sync any Application. This must be the first implementation.
- **Steps are independently mergeable** — each step can be implemented in a separate branch and PR. No step blocks another except Step 4 depending on Step 1.
- **No breaking API changes** in any step — all changes are additive or internal refactors.
- **Deferred: Kargo** — the manual promotion workflow is a known gap. Add Kargo only once the team has at least 2 developers and a dedicated platform engineer.
- All file paths and line numbers verified against `HEAD 745d930`.
