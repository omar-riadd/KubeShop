# KubeShop: Backend and Platform Plan (`plan.md`)

> Companion file: `ui.md` (frontend and UI). Both files share **§1 Shared Contract**, which is identical in each. Read both files fully before writing code.

## 0. How to use this file (instructions for the AI agent)

You are the **BACKEND agent**. You own everything in the repo except `web/**`, `.github/workflows/ci-web.yml` and `docs/ui/**` (see §1.2).

**Operating rules**
1. Read this whole file and `ui.md` first. §1 (Shared Contract) is the source of truth. Never deviate from it silently; log conflicts in `docs/CONTRACT-CHANGES.md` (§1.15).
2. Work **phase by phase** (§2 onward). At the end of each phase run its acceptance checks and write a short summary in `docs/progress/backend-phase-N.md` (what was done, how to verify, known gaps).
3. **Never invent versions.** Look up the current stable release of every tool, chart, action and image in its official docs, then **pin exact versions** (Helm chart versions, GitHub Action SHAs or tags, container image digests where practical). The version table in §3 gives minimums and intent only.
4. **No real secrets or identifiers in Git.** Use the placeholders from §1.1. Create `docs/PLACEHOLDERS.md` listing every placeholder and where it is used.
5. **Do not run `terraform apply`, create cloud resources, or run anything that costs money without explicit human approval.** Local work (compose, tests, `terraform validate/plan` against mocks, `helm template`, `kyverno test`) needs no approval.
6. Ask the human only for: `<GH_OWNER>`, `<BASE_DOMAIN>` (a Route 53 hosted zone), `<AWS_ACCOUNT_ID>`, `<SLACK_WEBHOOK_URL>`. Do not block local phases on these.
7. Conventional Commits, small PRs, every PR passes CI. Prefer boring, well-documented defaults over clever ones.
8. Parallel work: the UI agent works at the same time. Respect the milestones in §1.14. Hit M0 and M1 first and fast.

**Suggested Antigravity prompt**
> Read `plan.md` and `ui.md` completely. Section 1 is identical in both and is the source of truth. You are the BACKEND agent. Execute `plan.md` phases in order, starting with Phase 0 and Phase 1 so milestones M0 and M1 unblock the UI agent. Stop and ask before any cloud-cost action.
---

## 1. Shared Contract v1.1

> **IDENTICAL in `plan.md` and `ui.md`.** This section is the single source of truth for everything both sides depend on. If anything elsewhere in a file contradicts this section, **this section wins**. To change it, follow §1.15. See `docs/CONTRACT-CHANGES.md`.

### 1.1 Project identity

| Item | Value |
|---|---|
| Project name | **KubeShop** (tagline: "Gear for engineers") |
| Repo | `kubeshop-platform` (public monorepo) |
| Placeholders (never hardcode real values; list in `docs/PLACEHOLDERS.md`) | `<GH_OWNER>`, `<BASE_DOMAIN>`, `<AWS_ACCOUNT_ID>`, `<SLACK_WEBHOOK_URL>` |
| Default AWS region | `eu-central-1` |
| Currency / locale | `USD` / `en-US` (single language in v1) |
| Auth | None in v1. Anonymous browser session only (§1.6) |

### 1.2 Repository layout and ownership

```
kubeshop-platform/
├── api/openapi.yaml                     [BACKEND] single source of truth for the HTTP API
├── services/                            [BACKEND] Go module: catalog/, cart/, orders/, internal/
├── web/                                 [UI]      React SPA, nginx image, Playwright e2e
├── deploy/
│   ├── charts/app/                      [BACKEND] one Helm chart used by all 4 workloads
│   ├── charts/env-baseline/             [BACKEND] per-env namespace policies, redis, postgres, synthetic traffic
│   └── compose/gateway.nginx.conf       [BACKEND] local stand-in for the cluster Gateway
├── gitops/                              [BACKEND] Argo CD apps, platform addons, per-env values
├── infra/terraform/                     [BACKEND]
├── tests/load/                          [BACKEND] k6 scripts
├── docs/                                [BACKEND] (UI adds only docs/ui/*.md)
├── .github/workflows/ci-web.yml         [UI]
├── .github/workflows/*.yml (all others) [BACKEND]
├── docker-compose.yml, Makefile, README.md   [BACKEND]
├── plan.md, ui.md                       [reference only]
```

**Ownership rules**
1. The **UI agent edits only `web/**`, `.github/workflows/ci-web.yml`, `docs/ui/**`**. Everything else belongs to the **BACKEND agent**.
2. The UI agent never edits `api/openapi.yaml`. If the UI needs an API change, it writes a request in `docs/CONTRACT-CHANGES.md` (§1.15) and continues with a mock.
3. The BACKEND agent never edits `web/**`. The web Helm values (`gitops/apps/base/web.yaml`) are BACKEND-owned but must satisfy §1.4, §1.5, §1.10, §1.11, §1.12.

### 1.3 Environments, namespaces, hostnames

| Env | `APP_ENV` | Kubernetes namespace | URL | Purpose |
|---|---|---|---|---|
| local | `local` | n/a | `http://localhost:8080` (compose gateway), `http://localhost:5173` (Vite dev) | development |
| dev | `dev` | `kubeshop-dev` | `https://dev.<BASE_DOMAIN>` | auto-deployed from `main` |
| staging | `staging` | `kubeshop-staging` | `https://staging.<BASE_DOMAIN>` | promoted via PR, load tests |
| prod | `prod` | `kubeshop-prod` | `https://app.<BASE_DOMAIN>` | promoted via PR, approval required |

All three cluster environments live in **one EKS cluster** (`kubeshop`), separated by namespace. Stretch goal (out of scope for v1): a second cluster for prod.

### 1.4 Runtime topology and routing

```
Browser ──HTTPS──► Gateway (Envoy Gateway, Kubernetes Gateway API, AWS NLB)
                     │  PathPrefix /api/catalog ─► Service catalog:80 ─► pod :8080
                     │  PathPrefix /api/cart    ─► Service cart:80    ─► pod :8080
                     │  PathPrefix /api/orders  ─► Service orders:80  ─► pod :8080
                     └  PathPrefix /            ─► Service web:80     ─► pod :8080 (nginx)

cart ──► catalog (validate product, snapshot name/price)
cart ──► Redis
orders ──► cart (read cart, then clear it)
orders ──► PostgreSQL (CloudNativePG)
all Go services ──OTLP gRPC──► otel-collector ──► Tempo
```

- **Same origin only.** The browser talks to one origin. There is **no CORS** anywhere. The UI uses **relative URLs only** (`/api/...`), never absolute URLs.
- Services serve their own prefix (`/api/catalog/...`). **No path rewriting** at the Gateway or in nginx.
- Kubernetes Service names are exactly `web`, `catalog`, `cart`, `orders` (port 80 → container 8080). Service-to-service URLs: `CATALOG_BASE_URL=http://catalog`, `CART_BASE_URL=http://cart`.
- Gateway rules: `/api/<svc>` routes are more specific than `/`. Everything else goes to `web`, which handles SPA fallback itself.
- The Gateway adds `Strict-Transport-Security` only. Other security headers come from the services (§1.11), so there are no duplicate headers.
- Prod only: the Gateway rate-limits `/api/*` to 30 req/s per client IP. The 429 response is **not JSON** (§1.8).
- `web` uses Argo Rollouts **blueGreen** (avoids index.html and hashed-asset mismatch). `catalog`, `cart`, `orders` use **canary** with Prometheus analysis.

### 1.5 Ports, health, metrics, local dev

| Workload | API port | Admin port | Health | Metrics |
|---|---|---|---|---|
| catalog, cart, orders | 8080 | 9090 | `GET :9090/healthz` (liveness), `GET :9090/readyz` (readiness) | `GET :9090/metrics` |
| web (nginx) | 8080 | none | `GET :8080/healthz` → `200 ok` (text/plain) | none |

- The admin port is never routed through the Gateway and never published by compose.
- Local commands (Makefile, BACKEND-owned):
  - `make dev-backend`: redis, postgres, catalog, cart, orders. Host ports **8081** (catalog), **8082** (cart), **8083** (orders). No web, no gateway.
  - `make up`: everything, including `web` (built from `./web`) and `gateway`. Entry point **http://localhost:8080**.
  - Vite dev server (`pnpm dev`, port **5173**) proxies `/api/catalog` → `localhost:8081`, `/api/cart` → `localhost:8082`, `/api/orders` → `localhost:8083`.

### 1.6 API conventions

- JSON only, UTF-8, `camelCase`, `Content-Type: application/json`.
- Money: integer minor units (`priceCents`) plus `currency` (`"USD"`). Never floats. The UI formats with `Intl.NumberFormat("en-US")`.
- Timestamps: RFC 3339 UTC (`2026-11-20T10:15:30Z`).
- **`X-Session-ID`** (required on all `/api/cart/*` and `/api/orders*` routes): a UUID v4 generated by the browser on first visit and stored in `localStorage["kubeshop.sessionId"]`. Missing or malformed → `400 MISSING_SESSION`. Not required for `/api/catalog/*` or `/version`.
- **`X-Request-ID`**: the UI sends a fresh UUID on every request. Services echo it in the response header and in error bodies, put it in logs, and forward it on service-to-service calls. If absent, the service generates one (accepted charset `[A-Za-z0-9-]`, max 64 chars).
- **`traceparent`** (W3C): propagated between services. The browser does not send it in v1.
- **`Idempotency-Key`** (UUID) on `POST /api/orders`: the UI always sends it. Same `(session, key)` returns the originally created order with `200` instead of `201`.
- All API responses carry `Cache-Control: no-store`.
- Servers reject unknown JSON fields in **request** bodies (`400 VALIDATION_ERROR`). Clients must **ignore unknown fields in responses**.
- Request body limit: 16 KiB. Client timeout: 10 s.
- Evolution rule: v1 is additive only (new optional fields, new endpoints). Breaking changes need a new version prefix and a §1.15 entry.

### 1.7 Endpoints and schemas

Success codes: all `GET`, `PUT`, `DELETE`, and `POST /api/cart/items` return `200`; `POST /api/orders` returns `201` (or `200` on idempotent replay).

**Catalog**

| Method and path | Description |
|---|---|
| `GET /api/catalog/products?category=&q=&limit=&offset=` | `limit` default 50, max 100; `offset` default 0. `q` is a case-insensitive substring match on name and description. Sorted by `id` ascending. → `{"items":[Product],"total":12}` (`total` = matches before pagination) |
| `GET /api/catalog/products/{id}` | → `Product` or `404 PRODUCT_NOT_FOUND` |
| `GET /api/catalog/categories` | → `{"items":[{"id":"keyboards","label":"Keyboards"}]}` |
| `GET /api/catalog/version` | → `Version` |

```json
// Product
{"id":"kb-001","name":"Nimbus 75 Mechanical Keyboard","description":"75% hot-swappable board with gasket mount.",
 "category":"keyboards","priceCents":8900,"currency":"USD","imageUrl":"/images/products/kb-001.svg"}
```

**Cart** (all require `X-Session-ID`, all return `Cart`)

| Method and path | Description |
|---|---|
| `GET /api/cart` | Current cart (empty cart if none) |
| `POST /api/cart/items` | Body `{"productId":"kb-001","quantity":1}`. **Adds** to the existing quantity. `404 PRODUCT_NOT_FOUND` if the product is unknown |
| `PUT /api/cart/items/{productId}` | Body `{"quantity":3}`. **Sets** the absolute quantity (creates the line if missing) |
| `DELETE /api/cart/items/{productId}` | Removes the line. Idempotent |
| `DELETE /api/cart` | Empties the cart, returns the empty `Cart` |
| `GET /api/cart/version` | → `Version` (no session required) |

Quantity per line: integer **1–20**. Anything else, or an add that would exceed 20, → `400 VALIDATION_ERROR` with `details[].field = "quantity"`.

```json
// Cart  (items keep insertion order; name/price are snapshotted from catalog at write time)
{"items":[{"productId":"kb-001","name":"Nimbus 75 Mechanical Keyboard","priceCents":8900,"quantity":2,
           "lineTotalCents":17800,"imageUrl":"/images/products/kb-001.svg"}],
 "itemCount":2,"subtotalCents":17800,"currency":"USD"}
```
`itemCount` is the sum of quantities.

**Orders** (all require `X-Session-ID` except `/version`)

| Method and path | Description |
|---|---|
| `POST /api/orders` | Body `OrderRequest`; header `Idempotency-Key`. Reads the cart, stores the order, clears the cart. Rate limited to 2 req/s (burst 5) per session. → `Order`. Empty cart → `422 CART_EMPTY`; rate limited → `429 RATE_LIMIT_EXCEEDED` |
| `GET /api/orders` | The session's orders, newest first, max 50 → `{"items":[Order]}` |
| `GET /api/orders/{id}` | → `Order`, or `404 ORDER_NOT_FOUND` (also when the order belongs to another session) |
| `PATCH /api/orders/{id}/status` | Body `{"status":"CONFIRMED|SHIPPED|DELIVERED|CANCELLED"}`; header `Authorization: Bearer <token>`. Transitions order lifecycle via optimistic locking. Invalid transition → `409 INVALID_TRANSITION`; unauthorized → `401 UNAUTHORIZED` |
| `GET /api/orders/version` | → `Version` |

```json
// OrderRequest
{"customer":{"name":"Ada Lovelace","email":"ada@example.com"},
 "shippingAddress":{"line1":"1 Analytical St","line2":"","city":"London","postalCode":"N1 9GU","country":"GB"}}
```
Validation (identical on server and in the UI form):
`customer.name` 1–100 chars · `customer.email` valid email, max 254 · `line1` 1–200 · `line2` optional, max 200 · `city` 1–100 · `postalCode` 1–20 · `country` ISO 3166-1 alpha-2, two uppercase letters.

```json
// Order
{"id":"0b7c1d0e-6f0a-4f43-9d52-2b7a7a2f9b11","status":"PLACED",
 "items":[{"productId":"kb-001","name":"Nimbus 75 Mechanical Keyboard","priceCents":8900,"quantity":2,"lineTotalCents":17800}],
 "totalCents":17800,"currency":"USD",
 "customer":{"name":"Ada Lovelace","email":"ada@example.com"},
 "shippingAddress":{"line1":"1 Analytical St","line2":"","city":"London","postalCode":"N1 9GU","country":"GB"},
 "createdAt":"2026-11-20T10:15:30Z",
 "updatedAt":"2026-11-20T10:15:30Z"}
```

**Version** (same shape for all three services; exempt from fault injection; used by the UI Status page)
```json
{"service":"catalog","version":"sha-3f2a9c1","gitSha":"3f2a9c1d...(40 chars)","buildTime":"2026-11-20T09:58:00Z",
 "environment":"dev","podName":"catalog-6d5f8b7c9d-x2k4q"}
```
Locally: `environment:"local"`, `version:"dev"`, `gitSha:"local"`, `podName` = hostname.

### 1.8 Error model and codes

```json
{"error":{"code":"VALIDATION_ERROR","message":"Request validation failed","requestId":"c1f0...",
          "details":[{"field":"customer.email","message":"must be a valid email address"}]}}
```
`details` is optional and only used with `VALIDATION_ERROR`. `field` uses dot paths from the request body (e.g. `shippingAddress.country`) or `quantity`.

| HTTP | `code` | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | malformed or invalid body/query, unknown fields, quantity out of range |
| 400 | `MISSING_SESSION` | `X-Session-ID` missing or not a UUID |
| 401 | `UNAUTHORIZED` | `Authorization` header missing or invalid on status update |
| 404 | `PRODUCT_NOT_FOUND` / `ORDER_NOT_FOUND` / `NOT_FOUND` | unknown product, order, or route |
| 405 | `METHOD_NOT_ALLOWED` | |
| 409 | `INVALID_TRANSITION` | order status transition not permitted from current state |
| 422 | `CART_EMPTY` | placing an order with an empty cart |
| 429 | `RATE_LIMIT_EXCEEDED` | per-session rate limit exceeded on order placement |
| 500 | `INTERNAL_ERROR` | unexpected failure |
| 500 | `FAULT_INJECTED` | fault injection active (§1.13) |
| 502 | `UPSTREAM_UNAVAILABLE` | cart→catalog or orders→cart failed |
| 504 | `UPSTREAM_TIMEOUT` | upstream call exceeded 2 s |

**Non-JSON errors:** the Gateway or ingress path can return `429/502/503/504` with an empty or plain-text body. The UI **must** handle non-JSON error responses and fall back to a generic message (it will have no `requestId` body, but can read the `X-Request-ID` it sent).

### 1.9 Seed data (catalog, in-memory, identical everywhere; used by e2e and k6)

Categories: `keyboards` "Keyboards", `mice` "Mice", `audio` "Audio", `accessories` "Accessories".

| id | name | category | priceCents |
|---|---|---|---|
| kb-001 | Nimbus 75 Mechanical Keyboard | keyboards | 8900 |
| kb-002 | Helm 60 Wireless Keyboard | keyboards | 7400 |
| kb-003 | Pod TKL Low-Profile Keyboard | keyboards | 9900 |
| ms-001 | Orbit Ergonomic Mouse | mice | 5900 |
| ms-002 | Ingress Vertical Mouse | mice | 6900 |
| ms-003 | Sidecar Compact Mouse | mice | 3900 |
| au-001 | Tracer Studio Headphones | audio | 14900 |
| au-002 | Span Noise-Cancelling Earbuds | audio | 11900 |
| au-003 | Mesh USB Microphone | audio | 8400 |
| ac-001 | Rollout Desk Mat XL | accessories | 2900 |
| ac-002 | Cluster USB-C Hub | accessories | 6400 |
| ac-003 | Namespace Monitor Light Bar | accessories | 4900 |

`imageUrl` is always `/images/products/{id}.svg`. **The web image serves these files** (UI owns the assets); the catalog service only returns the path. Descriptions: one sentence each, written by the BACKEND agent in `services/catalog/seed/products.json`.

### 1.10 Web runtime configuration

`GET /runtime-config.json` (served by the web nginx, `Cache-Control: no-store`):
```json
{"environment":"dev","version":"sha-3f2a9c1","gitSha":"3f2a9c1d...","buildTime":"2026-11-20T09:58:00Z"}
```
- Generated at container start by an entrypoint script into `/tmp/runtime-config.json` from env vars `APP_ENV`, `APP_VERSION`, `APP_GIT_SHA`, `APP_BUILD_TIME`.
- `environment` ∈ `local | dev | staging | prod`.
- If the file is missing (Vite dev server), the UI falls back to `{environment:"local",version:"dev",gitSha:"local",buildTime:""}`.

### 1.11 Security constraints both sides obey

- **Web security headers** (set by web nginx only):
  - `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'`
  - `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- **API services** set `X-Content-Type-Options: nosniff` and `Cache-Control: no-store`.
- Consequences for the UI: no inline `<script>`, no inline `style` attributes or `style={{}}` props, no CDN scripts, fonts or images (self-host everything), no `eval`.
- All KubeShop application pods (`web`, `catalog`, `cart`, `orders`, `synthetic-traffic`): non-root, `readOnlyRootFilesystem: true`, all capabilities dropped, `seccompProfile: RuntimeDefault`, no service-account token mounted. The web container may write **only** to `/tmp` (an `emptyDir`). (Third-party data pods such as Redis and the CloudNativePG database follow the same Pod Security level but may need their own service account or token; see plan.md §11 and §13.)
- Allowed `localStorage` keys: `kubeshop.sessionId` and `kubeshop.theme` (`"light"|"dark"|"system"`). Nothing else. No PII in logs, no secrets in the browser.

### 1.12 Build, images, CI interface

| Item | Value |
|---|---|
| Registry | GHCR, public images |
| Image names | `ghcr.io/<GH_OWNER>/kubeshop-web`, `-catalog`, `-cart`, `-orders` |
| Tags | `sha-<7-char git sha>` on `main`; `vX.Y.Z` on releases. Environments always deploy `sha-*` tags |
| Signing | Cosign keyless (GitHub OIDC) by digest; CycloneDX SBOM attested; SLSA provenance |
| Build args (all Dockerfiles) | `GIT_SHA`, `BUILD_TIME` → baked into the image as `ENV APP_GIT_SHA`, `APP_BUILD_TIME` |
| Env injected by the Helm chart into **every** workload | `APP_ENV`, `APP_VERSION` (= image tag). Backends also get `POD_NAME` (downward API) |
| Reusable workflow | `.github/workflows/_publish-image.yml` (BACKEND). Inputs: `image-name`, `context`, `dockerfile`, `push` (bool). Outputs: `image`, `digest`, `tag`. It builds, scans (Trivy), generates the SBOM, signs, attests, and (on `main`) opens the GitOps PR that bumps `image.tag` in `gitops/apps/envs/dev/<app>.yaml` |
| UI usage | `ci-web.yml` calls `_publish-image.yml` with `image-name: kubeshop-web`, `context: web`, `dockerfile: web/Dockerfile` |

### 1.13 Fault injection and synthetic traffic

- Backends read `FAULT_ERROR_RATE` (0–1, default `0`) and `FAULT_LATENCY_MS` (default `0`). When set, they randomly fail or delay **all `/api/*` routes except `/version`** (failure → `500 FAULT_INJECTED`). There are **no public admin or chaos endpoints**. The incident demo is done by changing these env values through a GitOps PR.
- Each env runs a small `synthetic-traffic` k6 Deployment (from `env-baseline`) that browses, adds to cart, and occasionally orders, so metrics and canary analysis always have traffic.
- UI behavior under faults: GET requests retry up to 2 times (network errors and 502/503/504 only), then show an inline error with the `requestId`. Mutations never auto-retry.

### 1.14 Milestones (sync points)

| # | Milestone | Delivered by | Unblocks |
|---|---|---|---|
| M0 | Repo skeleton + `api/openapi.yaml` frozen to this contract + `docs/PLACEHOLDERS.md` | BACKEND Phase 0 | UI can generate types; until then UI uses MSW mocks built from §1.7 |
| M1 | `make dev-backend` works; all three services pass contract tests | BACKEND Phase 1–2 | UI switches from mocks to real APIs |
| M2 | `_publish-image.yml` exists and publishes signed images | BACKEND Phase 3 | UI wires `ci-web.yml` image job |
| M3 | Helm chart `deploy/charts/app` renders `web` (blueGreen, `/tmp` emptyDir, probes, env) | BACKEND Phase 4 | UI verifies its image runs under `readOnlyRootFilesystem` |
| M4 | Dev env live (Terraform, Argo CD, Gateway, TLS) | BACKEND Phase 5–6 | UI runs e2e against `https://dev.<BASE_DOMAIN>` |
| M5 | Observability, canary and blueGreen rollouts working | BACKEND Phase 7–9 | UI `/status` canary demo validated end to end |
| M6 | Docs, diagrams, demo recorded | both | done |

### 1.15 Change protocol

1. Never silently deviate from this section.
2. To propose a change: append an entry to `docs/CONTRACT-CHANGES.md` (date, requester, what, why, impact on the other side).
3. The change only takes effect when **both** `plan.md` and `ui.md` shared sections are updated identically, `api/openapi.yaml` is updated, and the version at the top of §1 is bumped.
4. If a contradiction is found between the shared section and any other text, **stop, log it, and follow this section.**

---

## 2. Goals and scope

**Goal:** a production-style, cloud-native delivery platform that demonstrates the skills in current DevOps / platform engineering job posts: IaC, secure CI, GitOps, progressive delivery, observability with SLOs, policy-as-code, autoscaling and FinOps.

**In scope (v1):** 3 Go microservices, Postgres + Redis, one EKS cluster with 3 environments (namespaces), Terraform, GitHub Actions, Argo CD, Argo Rollouts, Gateway API, Prometheus/Grafana/Loki/Tempo/OpenTelemetry, Kyverno, External Secrets, KEDA/HPA, k6, OpenCost.

**Out of scope (v1):** auth, payments, multi-cluster, service mesh, GPU/LLM workloads, Backstage. Stretch ideas live in §17.

**Why these choices (write each as an ADR in `docs/adr/`):** Argo CD vs Flux · Gateway API (Envoy Gateway) instead of ingress-nginx, because the ingress-nginx project was announced as retired in 2026 and Gateway API is the current direction · Kyverno vs OPA Gatekeeper · GHCR + Cosign keyless vs ECR · one cluster, three namespaces (cost) · External Secrets + AWS Secrets Manager vs Vault · blueGreen for the SPA, canary for APIs · single shared Helm chart.

## 3. Tech stack (verify current versions, then pin)

| Area | Choice | Minimum / note |
|---|---|---|
| Language | Go | latest stable, ≥ 1.24. Router `chi`, logging `log/slog`, DB `pgx/v5`, Redis `go-redis/v9`, migrations `golang-migrate`, metrics `prometheus/client_golang`, tracing OpenTelemetry Go SDK + `otelhttp` |
| API spec | OpenAPI 3.1 | `api/openapi.yaml`, validated in CI |
| Containers | multi-stage Dockerfile, `gcr.io/distroless/static:nonroot` (or Chainguard static) | uid 65532 |
| IaC | Terraform ≥ 1.11 (OpenTofu compatible) | S3 backend with native locking (`use_lockfile`); community modules `terraform-aws-modules/vpc` and `eks` |
| Cluster | Amazon EKS | latest standard-support Kubernetes version; EBS CSI, VPC CNI with network policy enabled, metrics-server |
| CI | GitHub Actions | OIDC to AWS, no static cloud keys |
| GitOps | Argo CD + ApplicationSets, Argo Rollouts (+ Gateway API traffic-router plugin) | |
| Gateway | Envoy Gateway (Kubernetes Gateway API), AWS Load Balancer Controller (NLB) | cert-manager (DNS-01, Route 53 wildcard), external-dns |
| Data | CloudNativePG (Postgres), Redis (`redis:7-alpine`, password required, no persistence) | |
| Secrets | External Secrets Operator + AWS Secrets Manager | |
| Observability | kube-prometheus-stack, Loki (single binary), Grafana Alloy (log collection), Tempo, OpenTelemetry Collector | |
| Policy | Kyverno | |
| Autoscaling | HPA + KEDA (Prometheus scaler) | |
| Cost | OpenCost | |
| Load test | k6 | |
| Dependency updates | Renovate | |

## 4. Repository detail

```
services/
  go.mod                         # module github.com/<GH_OWNER>/kubeshop-platform/services
  internal/platform/             # shared: config, logging, otel, metrics, middleware, errors, admin server
  catalog/{cmd/catalog,internal,seed/products.json,Dockerfile}
  cart/{cmd/cart,internal,Dockerfile}
  orders/{cmd/orders,internal,migrations/*.sql,Dockerfile}
api/openapi.yaml
deploy/
  charts/app/                    # Rollout, Services, HTTPRoute, HPA/KEDA, PDB, ServiceMonitor, NetworkPolicy, migration Job
  charts/env-baseline/           # namespace guardrails, redis, CNPG Cluster, ExternalSecrets, synthetic-traffic
  compose/gateway.nginx.conf
gitops/
  bootstrap/                     # root Application (installed by Terraform)
  platform/
    applicationset.yaml          # one Application per addon (multi-source: upstream chart + values from this repo)
    <addon>/values.yaml
    <addon>/manifests/           # extra CRs: ClusterIssuer, Gateway, ClusterSecretStore, Kyverno policies,
                                 #   PrometheusRules, ClusterAnalysisTemplates, dashboards
  apps/
    project.yaml                 # AppProjects: platform, kubeshop
    applicationset.yaml          # matrix: envs (dev, staging, prod) x apps (web, catalog, cart, orders) + baseline-<env>
    base/<app>.yaml              # per-app Helm values shared by all envs
    envs/<env>/<app>.yaml        # per-env overrides, including image.tag (the only file CI and promotion edit)
    envs/<env>/baseline.yaml
infra/terraform/
  bootstrap/                     # state bucket (S3, versioned, encrypted)
  modules/{network,eks,iam-irsa,secrets,github-oidc,budget}/
  envs/main/                     # the single cluster stack + Argo CD bootstrap
tests/load/{smoke.js,load.js,stress.js}
docs/{architecture.md,adr/,runbooks/,incident-demo.md,cost.md,demo-script.md,screenshots/,progress/}
.github/workflows/...
docker-compose.yml  Makefile  renovate.json  .gitleaks.toml  CODEOWNERS
```

## 5. Phase 0: Repo bootstrap and contract (→ milestone M0)

Tasks
1. Initialize repo structure (§4), `README.md` skeleton, `CODEOWNERS` (`/web/ @ui-owner`, everything else `@backend-owner`; use `<GH_OWNER>`), `.editorconfig`, `.gitignore`, `docs/PLACEHOLDERS.md`, `docs/CONTRACT-CHANGES.md` (empty log).
2. Write `api/openapi.yaml` covering **every** endpoint, schema, header and error code in §1.6–§1.9. Use `components/schemas` for `Product, Cart, CartItem, Order, OrderRequest, Version, Error`. Add examples from §1.7.
3. CI job `openapi-lint` (Spectral or Redocly) on `api/**`.
4. Pre-commit config: gitleaks, yamllint, golangci-lint, terraform fmt.

Acceptance: the OpenAPI file lints clean; a reviewer can match every row of §1.7 and §1.8 to an operation or schema. Tell the human M0 is reached (`docs/progress/backend-phase-0.md`).

## 6. Phase 1: Go services (→ milestone M1, part 1)

### 6.1 Shared package `internal/platform`
- **Config:** env-only (see table below), validated at startup, fail fast.
- **Logging:** JSON via `slog` to stdout. Fields: `ts, level, msg, service, env, version, requestId, traceId, spanId, method, route, status, durationMs`. Never log request bodies or emails.
- **Middleware order:** recover → request-id (§1.6) → otelhttp → access log → metrics → security headers (`nosniff`, `no-store`) → fault injection (§1.13) → body limit (16 KiB) → handlers.
- **Session middleware:** validate `X-Session-ID` UUID v4 on routes that require it (§1.6).
- **Error writer:** one function producing the §1.8 body, always including `requestId`. Unknown routes and methods use `NOT_FOUND` and `METHOD_NOT_ALLOWED` in the same format.
- **JSON decoding:** `DisallowUnknownFields`, map failures to `VALIDATION_ERROR` with `details`.
- **Metrics** (on the admin port): `http_requests_total{service,method,route,status}`, `http_request_duration_seconds` histogram with buckets `0.005,0.01,0.025,0.05,0.1,0.2,0.3,0.5,0.8,1,2.5,5`, `http_requests_in_flight`, plus Go and process collectors. `route` is the chi **route pattern**, never the raw path (cardinality).
- **Tracing:** OTLP gRPC exporter enabled only if `OTEL_EXPORTER_OTLP_ENDPOINT` is set; W3C tracecontext propagation; outgoing HTTP clients wrapped with `otelhttp.NewTransport`.
- **Admin server** (`ADMIN_PORT`): `/healthz` (always 200 while running), `/readyz` (503 during shutdown or when a dependency check fails), `/metrics`.
- **Graceful shutdown:** on SIGTERM set not-ready, sleep `SHUTDOWN_DELAY` (5 s) so the Gateway stops sending traffic, then `Shutdown` with a 20 s timeout.
- **Version endpoint:** `GET /api/<svc>/version` per §1.7, exempt from fault injection.

### 6.2 Environment variables

| Variable | Default | Services |
|---|---|---|
| `APP_ENV`, `APP_VERSION`, `APP_GIT_SHA`, `APP_BUILD_TIME`, `POD_NAME` | `local`, `dev`, `local`, empty, hostname | all |
| `HTTP_PORT`, `ADMIN_PORT` | `8080`, `9090` | all |
| `LOG_LEVEL` | `info` | all |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | empty (tracing off); cluster: `http://otel-collector.observability.svc:4317` | all |
| `OTEL_SERVICE_NAME` | service name | all |
| `OTEL_TRACES_SAMPLER` / `_ARG` | `parentbased_traceidratio` / `1.0` (dev, staging), `0.2` (prod) | all |
| `FAULT_ERROR_RATE`, `FAULT_LATENCY_MS` | `0`, `0` | all |
| `SHUTDOWN_DELAY` | `5s` | all |
| `REDIS_ADDR`, `REDIS_PASSWORD`, `CATALOG_BASE_URL` | `localhost:6379`, empty, `http://localhost:8081` | cart |
| `DATABASE_URL`, `CART_BASE_URL` | local postgres DSN, `http://localhost:8082` | orders |

### 6.3 catalog
- Loads `seed/products.json` (the 12 products of §1.9) via `go:embed` into memory at startup. Stateless, no external dependencies.
- Implements the four endpoints in §1.7 including filtering, pagination, sort and `total`.
- Readiness: seed loaded.

### 6.4 cart
- Redis key `cart:{sessionId}` is a hash: field = `productId`, value = JSON `{name, priceCents, quantity, addedAt}`. TTL 24 h, refreshed on every write. Item order = `addedAt` ascending.
- On add and set: call `GET {CATALOG_BASE_URL}/api/catalog/products/{id}` (timeout 2 s, one retry with jitter on timeout or 5xx, forward `X-Request-ID` and trace context). Map failures to `502 UPSTREAM_UNAVAILABLE` or `504 UPSTREAM_TIMEOUT`; `404` → `PRODUCT_NOT_FOUND`. `GET /api/cart` reads Redis only.
- Enforce quantity 1–20 per line (§1.7).
- Readiness: Redis `PING`.
- Metrics: `cart_items_added_total`.

### 6.5 orders
- PostgreSQL via `pgx` pool. Migrations in `migrations/` (embedded, `golang-migrate`). The binary has a `migrate` subcommand used by the Helm pre-sync Job; the server does **not** migrate on startup.
- Schema:
```sql
CREATE TABLE orders (
  id uuid PRIMARY KEY, session_id uuid NOT NULL, idempotency_key uuid,
  status text NOT NULL DEFAULT 'PLACED',
  customer_name text NOT NULL, customer_email text NOT NULL,
  ship_line1 text NOT NULL, ship_line2 text NOT NULL DEFAULT '', ship_city text NOT NULL,
  ship_postal_code text NOT NULL, ship_country char(2) NOT NULL,
  currency char(3) NOT NULL, total_cents bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, idempotency_key)
);
CREATE TABLE order_items (
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id text NOT NULL, name text NOT NULL, price_cents integer NOT NULL, quantity integer NOT NULL,
  PRIMARY KEY (order_id, product_id)
);
CREATE INDEX orders_session_created_idx ON orders (session_id, created_at DESC);
```
- `POST /api/orders` flow: validate body (§1.7 rules) → if `(session, Idempotency-Key)` exists return that order with `200` → `GET {CART_BASE_URL}/api/cart` (forward `X-Session-ID`, `X-Request-ID`) → empty ⇒ `422 CART_EMPTY` → insert order and items in **one transaction** → best-effort `DELETE {CART_BASE_URL}/api/cart` (a failure is logged as a warning; the order stays placed) → `201`.
- `GET /api/orders/{id}` and the list filter by `session_id`.
- Readiness: pool ping.
- Metrics: `orders_created_total`, `order_value_cents` histogram.

### 6.6 Tests (all must run in CI)
- Unit tests, coverage ≥ 70 % per service.
- Integration tests with **testcontainers-go** (Redis, Postgres, a stub catalog/cart).
- **Contract tests:** every response of every endpoint is validated against `api/openapi.yaml` (e.g. `kin-openapi` response validation inside handler tests). Optionally run Schemathesis against the compose stack in CI.
- Fault injection test: with `FAULT_ERROR_RATE=1`, `/api/*` returns `500 FAULT_INJECTED` but `/version` and admin endpoints do not.

### 6.7 Dockerfiles
Multi-stage, `CGO_ENABLED=0`, `-trimpath`, static binary, distroless nonroot, `ARG GIT_SHA BUILD_TIME` → `ENV APP_GIT_SHA APP_BUILD_TIME`, `EXPOSE 8080 9090`, OCI labels, no shell.

Acceptance: `go vet`, `golangci-lint`, `go test -race ./...` pass; `docker run` of each image works with `readOnlyRootFilesystem`.

## 7. Phase 2: Local stack (→ milestone M1, part 2)

1. `docker-compose.yml` with profiles:
   - **backend profile** (`make dev-backend`): `redis`, `postgres:17`, a one-shot `orders-migrate`, `catalog` (8081), `cart` (8082), `orders` (8083). Healthchecks and `depends_on: condition: service_healthy`.
   - **full profile** (`make up`): adds `web` (build `./web`, expects Dockerfile from the UI agent; until it exists, skip with a clear message) and `gateway` (nginx, `deploy/compose/gateway.nginx.conf`) on **8080**, routing exactly the table in §1.4 with no rewriting.
2. `Makefile` targets: `dev-backend`, `up`, `down`, `logs`, `test`, `lint`, `openapi-lint`, `load-test`, `tf-plan`, `cluster-down`.
3. Seed script for k6/e2e is unnecessary because the catalog is static.

Acceptance (**M1**): `make dev-backend` brings up the stack; `curl localhost:8081/api/catalog/products` returns 12 items; a full flow (add to cart → place order → fetch order) works with `curl` using the example payloads of §1.7. Notify the UI agent via `docs/progress/backend-phase-2.md`.

## 8. Phase 3: CI pipelines (→ milestone M2)

All third-party actions pinned to full commit SHAs (Renovate keeps them current). Least-privilege `permissions:` per job. Path filters so only affected services build.

| Workflow | Triggers | Steps |
|---|---|---|
| `ci-services.yml` | PR and push touching `services/**`, `api/**` | matrix `[catalog, cart, orders]`: `go vet`, `golangci-lint`, `go test -race -cover`, integration tests, OpenAPI contract tests, then call `_publish-image.yml` (`push: false` on PR, `true` on `main`) |
| `_publish-image.yml` (reusable) | `workflow_call` | buildx build with `GIT_SHA`/`BUILD_TIME`, Trivy image scan (fail on fixable HIGH/CRITICAL), Syft SBOM (CycloneDX), push to GHCR, **Cosign keyless sign by digest**, `cosign attest` SBOM, SLSA provenance via `actions/attest-build-provenance`, then on `main` open an auto-merge PR editing `gitops/apps/envs/dev/<app>.yaml` → `image.tag: sha-<7>` (**using a GitHub App token**, see gotcha below) |
| `security.yml` | PR, weekly | Gitleaks (full history), Semgrep (`p/golang`, `p/typescript`, `p/dockerfile`, `p/secrets`), Trivy `config` over `infra/`, `deploy/`, `gitops/` |
| `helm-gitops.yml` | PR touching `deploy/**`, `gitops/**` | `helm lint`, `helm template` for each app × env, `kubeconform` against Gateway API/Argo/Kyverno CRD schemas, `kyverno test gitops/platform/kyverno/tests` |
| `terraform.yml` | PR touching `infra/**` | `fmt -check`, `validate`, `tflint`, Trivy config; `plan` via OIDC read-only role with plan commented on the PR; `apply` only via `workflow_dispatch` behind a protected GitHub Environment |
| `promote.yml` | `workflow_dispatch` (inputs: `from`, `to`, `apps`) | reads `image.tag` of each app from `envs/<from>/`, opens a PR editing `envs/<to>/` (no direct pushes). `prod` target requires CODEOWNER approval |
| `openapi-lint.yml` | PR touching `api/**` | Spectral/Redocly |

**Gotcha: bot PRs and required checks.** Pull requests opened with the default `GITHUB_TOKEN` do **not** trigger other workflows, so required status checks never run and auto-merge stays blocked. Create the dev bump PR and the `promote.yml` PRs with a **GitHub App installation token** (`actions/create-github-app-token`; fine-grained PAT as a fallback), store its credentials as repo secrets, and document the setup in `docs/runbooks/repo-setup.md`. Never give the bot permission to bypass branch protection for `staging` or `prod` paths.

Repo settings (document in `docs/runbooks/repo-setup.md`): protected `main`, required checks, required review, linear history, Dependabot/Renovate enabled, secret scanning and push protection on.

Acceptance (**M2**): merging a services change publishes signed images; `cosign verify` with the repo's workflow identity succeeds; a GitOps PR for dev is opened automatically.

## 9. Phase 4: Helm chart `deploy/charts/app` (→ milestone M3)

One chart renders all four workloads. Values schema (`values.schema.json` required):

`name, image{repository,tag,pullPolicy}, replicaCount, strategy (canary|blueGreen), canary{steps,analysis{enabled,templates,args}}, service{port:80,targetPort:8080}, admin{enabled,port:9090}, env{}, secretEnv{NAME:{secretName,key}}, probes{liveness{path,port},readiness{path,port}}, resources, autoscaling{type:none|hpa|keda, min, max, cpu, keda{query,threshold}}, pdb{minAvailable}, topologySpread, nodeSelector, tolerations, serviceMonitor{enabled}, route{enabled,hostnames,pathPrefix,gatewayRef,rateLimit}, networkPolicy{ingressFrom[],egress[]}, serviceAccount, volumes{tmpEmptyDir}, migrations{enabled,args}`.

Rendered objects:
- `Rollout` (not Deployment). `strategy: canary` → steps `setWeight 10 → pause 1m + analysis → 50 → pause 2m + analysis → 100`; stable and canary Services; Gateway API traffic routing via the Argo Rollouts plugin editing the `HTTPRoute`. `strategy: blueGreen` → active and preview Services, `autoPromotionEnabled: false` in prod, pre-promotion analysis hitting `/healthz`.
- `HTTPRoute` attached to Gateway `kubeshop-gw`, host `<env host from §1.3>`, `PathPrefix` per §1.4. Response header filter adds nothing except what §1.4 allows. Prod: `BackendTrafficPolicy` local rate limit 30 req/s per client IP on `/api`.
- Pod spec: security context per §1.11, `automountServiceAccountToken: false`, `terminationGracePeriodSeconds: 30`, `preStop: sleep 5`, probes per §1.5, env per §1.12 (`APP_ENV`, `APP_VERSION` from `image.tag`, `POD_NAME`), `/tmp` emptyDir when `volumes.tmpEmptyDir` (always on for `web`), topology spread across zones/nodes, labels `app.kubernetes.io/*`.
- `Service` objects expose two ports: `http` (80 → 8080) and, for backends, `admin` (9090, **named `admin`**). The Rollout's `metadata.name` **equals the app name** (`catalog`, `cart`, `orders`, `web`) so pod names are `<app>-<hash>-<rand>`, which the canary analysis queries rely on.
- `ServiceMonitor` scraping port `admin` `/metrics` (backends only). Adds the `pod` label.
- `HPA` or KEDA `ScaledObject` (target kind `Rollout`, `apiVersion: argoproj.io/v1alpha1`), `PodDisruptionBudget`, `NetworkPolicy` per §13.
- Migration `Job` as an Argo CD **PreSync** hook (orders only), runs `orders migrate`.

Resources and scaling per environment (set in `gitops/apps/base/` and `envs/`):

| App | Requests / limits | dev | staging | prod |
|---|---|---|---|---|
| backends | `50m/64Mi` → `250m/128Mi` | 1 replica, no autoscale | HPA 1–5 (CPU 70 %); orders uses KEDA | min 2, HPA 2–6; orders KEDA 2–6 |
| web | `25m/32Mi` → `100m/64Mi` | 1 | 1 | 2 |

Prod pods get `nodeSelector: workload=prod` and a matching toleration (node groups: §10). Dev and staging run on the spot node group.

Acceptance (**M3**): `helm template` for every app × env passes `kubeconform`; the `web` render has an `/tmp` emptyDir, port 8080, `/healthz` probes, blueGreen strategy, route `/`.

## 10. Phase 5: Terraform (→ milestone M4, part 1)

`infra/terraform/bootstrap`: S3 state bucket (versioned, SSE-KMS, public access blocked). `envs/main` uses it with `use_lockfile = true`.

`envs/main` provisions:
1. **Network:** VPC, 3 AZs, public + private subnets, **single NAT gateway** (cost), subnet tags for load balancers.
2. **EKS:** cluster with envelope encryption (KMS), access entries (no aws-auth ConfigMap), OIDC provider (IRSA), logging limited to `api`/`audit`. Add-ons: `vpc-cni` with `enableNetworkPolicy=true`, `coredns`, `kube-proxy`, `aws-ebs-csi-driver`, `eks-pod-identity-agent` (optional), `metrics-server`.
3. **Node groups:** `spot` (4 vCPU / 16 GiB class, several instance types, min 2, max 4) for platform, dev, staging; `ondemand` (`t3.large`, min 1, max 2, label `workload=prod`, taint `workload=prod:NoSchedule`) for prod.
4. **IRSA roles** (names `kubeshop-<addon>`): `aws-load-balancer-controller`, `external-dns` (Route 53 zone scoped), `cert-manager` (Route 53 DNS-01, zone scoped), `external-secrets` (read `kubeshop/*` secrets only), `ebs-csi`.
5. **Secrets Manager** (placeholders created by Terraform): `kubeshop/<env>/redis` (random password), `kubeshop/platform/slack-webhook` (value from sensitive var `slack_webhook_url`), `kubeshop/platform/grafana-admin`.
6. **GitHub OIDC** provider + roles: `terraform-plan` (read-only, any PR in the repo), `terraform-apply` (only from the protected environment).
7. **Bootstrap workloads via `helm_release`:** AWS Load Balancer Controller, Argo CD (`argo-cd`), and the root Application (`argocd-apps` or `kubernetes_manifest`) pointing at `gitops/`. **Everything else is installed by Argo CD.**
8. **Budget:** `aws_budgets_budget` with email alerts at 50 / 80 / 100 %. Default tags `Project=kubeshop`, `ManagedBy=terraform`.

Quality: `terraform fmt`, `validate`, `tflint`, Trivy config clean; variables documented; outputs for cluster name, region, role ARNs.

Acceptance: `terraform validate` and `plan` succeed (against a sandbox account if the human approves); README in `infra/terraform` explains apply and the **teardown order** (§15).

## 11. Phase 6: GitOps and platform addons (→ milestone M4, part 2)

**Argo CD:** two `AppProject`s: `platform` (any addon namespace) and `kubeshop` (destinations restricted to `kubeshop-*`, source repo restricted to this repo). Argo CD UI is **not** exposed publicly; use `kubectl port-forward`. Local admin user disabled after SSO or kept with a strong secret; RBAC `readonly` default role.

**`gitops/platform/applicationset.yaml`:** one Application per addon with multi-source (upstream chart pinned + `$values` from this repo), sync waves, `CreateNamespace=true`, `ServerSideApply=true`, automated sync with prune and selfHeal, retry with backoff.

| Wave | Addons (namespace) |
|---|---|
| 0 | `gateway-api` CRDs, `cert-manager`, `external-secrets`, `kyverno`, `argo-rollouts` (with Gateway API plugin config), `cloudnative-pg`, `keda`, `kube-prometheus-stack` (`monitoring`) |
| 1 | `envoy-gateway`, `external-dns`, `loki`, `tempo`, `alloy`, `otel-collector` (`observability`), `opencost` |
| 2 (manifests) | `ClusterIssuer` (Let's Encrypt, Route 53 DNS-01), `GatewayClass eg` with `parametersRef` → an `EnvoyProxy` resource whose Service annotations make the AWS Load Balancer Controller provision an internet-facing **NLB** (`service.beta.kubernetes.io/aws-load-balancer-type: external`, `...-nlb-target-type: ip`, `...-scheme: internet-facing`), `Gateway kubeshop-gw` in namespace `gateway-system` (listeners 80 → redirect, 443 with wildcard `*.<BASE_DOMAIN>` cert issued via the `cert-manager.io/cluster-issuer` annotation; cert-manager must have Gateway API support enabled; `allowedRoutes` from namespaces labelled `kubeshop.io/gateway-access=true`), `ClusterSecretStore aws-secrets-manager`, Kyverno policies, PrometheusRules, dashboards, `ClusterAnalysisTemplate`s (`success-rate`, `latency-p95`; args `service-name`, `namespace`, `canary-hash`, PromQL filters `pod=~"<service>-<canary-hash>-.*"`) |

Install the **Gateway API CRDs exactly once** (either via the Envoy Gateway chart or a separate app, never both) and pin the Gateway API version supported by both Envoy Gateway and the Argo Rollouts Gateway API plugin.

**`gitops/apps/applicationset.yaml`:** matrix of envs × apps. Each Application uses chart `deploy/charts/app` with `valueFiles: [base/<app>.yaml, envs/<env>/<app>.yaml]`, destination namespace `kubeshop-<env>`, managed namespace labels:
`pod-security.kubernetes.io/enforce=restricted`, `kubeshop.io/gateway-access=true`, `kubeshop.io/env=<env>`. A `baseline-<env>` Application installs `deploy/charts/env-baseline`.

**`deploy/charts/env-baseline`:** default-deny NetworkPolicies, `ResourceQuota`, `LimitRange`, Redis (Deployment + Service `redis`, password from the `cart-redis` secret, started with `--save "" --appendonly no`, `/data` as an `emptyDir`), CNPG `Cluster` named `orders-db` (1 instance dev/staging, 2 prod; creates secret `orders-db-app` whose `uri` key feeds `DATABASE_URL`), `ExternalSecret`s (`cart-redis`), and `synthetic-traffic` (k6 Deployment, ConfigMap script browsing → cart → occasional order, rate configurable, ~1 req/s). **Every manifest in this chart** (Redis, CNPG `Cluster`, k6) must set explicit resource requests and limits, a restricted-compliant `securityContext`, and use an image from an allowed registry, otherwise the Pod Security and Kyverno rules of §13 will reject it. Set `resources` and `securityContext` in the CNPG `Cluster` spec.

**Promotion model:** dev changes via the bot PR (auto-merge after checks). staging and prod changes only through PRs created by `promote.yml`. No one edits clusters by hand. Document in `docs/runbooks/promotion.md`.

Acceptance (**M4**): after `terraform apply` (human approved) Argo CD shows all apps **Synced/Healthy**; `https://dev.<BASE_DOMAIN>` serves the app over a valid certificate; a code change flows commit → image → dev PR → live without manual steps.

## 12. Phase 7: Observability (→ milestone M5, part 1)

- **Metrics:** `kube-prometheus-stack` (7-day retention, `serviceMonitorSelectorNilUsesHelmValues=false`). Services are scraped via `ServiceMonitor` on the admin port.
- **Logs:** Loki single binary (filesystem on a gp3 PVC, 7-day retention). Alloy DaemonSet ships container logs with labels `namespace, pod, app, container`; parse the JSON `level`; keep `traceId` as structured metadata.
- **Traces:** OpenTelemetry Collector (Deployment) receives OTLP gRPC `:4317`, processors `memory_limiter`, `k8sattributes`, `batch`, exports to Tempo. Enable Tempo's service-graph metrics generator remote-writing to Prometheus (enable the remote-write receiver) if time permits.
- **Grafana:** datasources provisioned (Prometheus, Loki, Tempo) with derived fields so a log line's `traceId` opens the trace and a trace links back to logs. Admin password from the ExternalSecret. Dashboards as code (ConfigMaps with the `grafana_dashboard` label):
  1. Service RED (variables: namespace, service)
  2. SLO overview (error budget remaining, burn rate)
  3. Argo Rollouts canary comparison (stable vs canary success rate and latency)
  4. Kubernetes capacity and autoscaling
  5. Cost (OpenCost)
- **SLOs** (28-day window), implemented as recording rules + multi-window multi-burn-rate alerts (or Sloth):

| Service | SLI | Target |
|---|---|---|
| catalog, cart | availability = non-5xx / all, excluding `/version` | 99.5 % |
| orders | availability = non-5xx / all `POST /api/orders` | 99.5 % |
| catalog `GET /api/catalog/products` | latency < 300 ms | 95 % |
| orders `POST /api/orders` | latency < 800 ms | 95 % |

- **Alerts** (PrometheusRule): SLO fast burn (14.4× over 1 h/5 m) = critical; slow burn (6× over 6 h/30 m) = warning; `PodCrashLooping`; `RolloutAborted`; `ArgoAppOutOfSync` > 15 m; `PVCFillingUp`; `CertificateExpiringSoon`; `NodeNotReady`. Alertmanager routes critical + warning to Slack via the webhook from the ExternalSecret (mounted as a file, never inline). Include `Watchdog` routed to null.

Acceptance (**M5a**): the Service RED dashboard shows live data for all three services; clicking a trace in Grafana shows spans across web → cart → catalog; a log line links to its trace.

## 13. Phase 8: Security and policy (→ milestone M5, part 2)

- **Kyverno** (policies in `gitops/platform/kyverno/manifests`, tests in `.../tests` run by `kyverno test` in CI). Start in `Audit`, switch to `Enforce` once clean. Scope to namespaces labelled `kubeshop.io/env`:
  1. `verify-image-signature`: images from `ghcr.io/<GH_OWNER>/kubeshop-*` must carry a Cosign **keyless** signature; issuer `https://token.actions.githubusercontent.com`, subject regex `https://github.com/<GH_OWNER>/kubeshop-platform/\.github/workflows/.+@refs/heads/main`.
  2. `require-sbom-attestation` (Audit only).
  3. `require-resources`: CPU/memory requests and limits on every container.
  4. `disallow-latest-tag`, `restrict-registries` (GHCR repo, plus pinned redis/postgres/k6 sources).
  5. `require-non-root`, `require-readonly-rootfs`, `drop-all-capabilities`, `require-seccomp`.
  6. `require-labels` (`app.kubernetes.io/name`, `kubeshop.io/env`).
- **Network policies** (chart + baseline): default deny ingress and egress; allow only:
  - `envoy-gateway-system` → `web|catalog|cart|orders` on 8080
  - `monitoring` → backends on 9090
  - `cart` → `catalog:8080`, `redis:6379`; `orders` → `cart:8080`, `orders-db:5432` (the migration Job pod carries the labels of `orders`, so the same rule applies)
  - **CloudNativePG:** `cnpg-system` → `orders-db` pods (8000, 5432); `orders-db` pods ↔ each other (5432, 8000); `orders-db` pods → the Kubernetes API (TCP 443, restrict to the VPC CIDR); `monitoring` → `orders-db` metrics port if enabled. Without these the database never becomes healthy under default-deny.
  - Redis accepts ingress only from `cart`.
  - all pods → kube-dns (UDP/TCP 53); backends → `otel-collector:4317`
  - `synthetic-traffic` → the four services
- **RBAC:** one ServiceAccount per workload, no token mounted, no ClusterRole bindings for apps; Argo CD projects as above; Terraform roles least-privilege.
- **Secrets:** only via External Secrets; nothing sensitive in Git; Gitleaks in pre-commit and CI.
- **Supply chain:** pinned actions and base images (digest), Renovate, SBOM, provenance, signed images, Trivy gates.

Acceptance (**M5b**): deploying an unsigned image to `kubeshop-dev` is rejected (or reported in Audit mode, then enforced); `kyverno test` passes; `kubectl exec` into a pod shows read-only filesystem; a throwaway pod in `kubeshop-dev` cannot reach `redis:6379` or `orders-db:5432`; in prod the two-instance `orders-db` still replicates and the app works end to end.

## 14. Phase 9: Reliability, rollouts, FinOps (→ milestone M5, part 3)

- **Canary demo (APIs):** change the catalog code in dev, watch Rollouts step 10 → 50 → 100 with analysis passing. The UI `/status` page shows two versions during the rollout.
- **Failed canary demo:** open a PR that sets `FAULT_ERROR_RATE=0.4` for catalog in dev; the canary analysis fails and Rollouts aborts automatically. Capture screenshots.
- **blueGreen demo (web):** preview pods verified, then promoted; no asset 404s.
- **Load test:** `tests/load/load.js` (k6, thresholds `http_req_failed<1%`, `p(95)<500`) against **staging**. Show HPA and KEDA scale-out in Grafana. `smoke.js` runs after each staging promotion.
- **Resilience:** PDBs, zone topology spread, kill-a-pod and drain-a-node exercise documented.
- **Incident write-up** (`docs/incident-demo.md`): inject fault → alert fires in Slack → Grafana RED + SLO dashboard → Loki logs → Tempo trace → mitigation via `git revert` PR → recovery and error-budget impact → blameless postmortem template.
- **FinOps:** OpenCost dashboard, spot for non-prod, one NAT, budget alerts, `docs/cost.md` with a measured monthly estimate and per-hour burn.

## 15. Phase 10: Docs and demo (→ milestone M6)

- `README.md`: what it is, architecture diagram (Mermaid, rendered in GitHub), tech badges, quickstart (`make up`), link to the demo video, screenshots, repo map, CV-style summary of outcomes.
- `docs/architecture.md`: diagrams for runtime topology, CI/CD flow, GitOps promotion, observability pipeline, supply-chain flow.
- `docs/adr/*.md` for each decision listed in §2.
- `docs/runbooks/`: repo setup, bootstrap, promotion, rollback, incident response, teardown.
- `docs/demo-script.md`: a 5-minute walkthrough (commit → pipeline → signed image → GitOps PR → canary → dashboards → incident).
- **Teardown order** (document and script as `make cluster-down`): delete Argo CD Applications (so the NLB, external-dns records and EBS volumes are removed) → wait for load balancers to disappear → `terraform destroy` → verify no orphaned ELBs, ENIs, volumes or NAT gateways.

## 16. Definition of Done (backend/platform)

- [ ] `make up` runs the full local stack and the e2e suite from `ui.md` passes against it.
- [ ] All CI workflows green; images signed and verifiable; SBOMs attached.
- [ ] Dev, staging, prod all Synced/Healthy in Argo CD; promotion only through PRs.
- [ ] Canary abort demo and blueGreen demo captured.
- [ ] SLO dashboards and alerts live; Slack alert received during the incident demo.
- [ ] Kyverno policies enforced; unsigned image rejected.
- [ ] k6 load test shows autoscaling; cost documented.
- [ ] `terraform destroy` leaves nothing behind.
- [ ] Docs complete (§15). No secrets or real identifiers in Git.
- [ ] Zero unresolved entries in `docs/CONTRACT-CHANGES.md`.

## 17. Stretch (only after §16)

Pick **one**: Backstage or Crossplane self-service template · a small LLM inference workload with KEDA/GPU or CPU autoscaling and Grafana metrics · Cilium + Hubble instead of VPC CNI network policy · second cluster for prod with Argo CD multi-cluster.
