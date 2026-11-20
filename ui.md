# KubeShop: Frontend and UI Plan (`ui.md`)

> Companion file: `plan.md` (backend and platform). Both files share **§1 Shared Contract**, which is identical in each. Read both files fully before writing code.

## 0. How to use this file (instructions for the AI agent)

You are the **UI agent**. You own **only** `web/**`, `.github/workflows/ci-web.yml` and `docs/ui/**` (see §1.2). Everything else belongs to the BACKEND agent.

**Operating rules**
1. Read this whole file and `plan.md` first. §1 (Shared Contract) is the source of truth. Never deviate silently; log needed API changes in `docs/CONTRACT-CHANGES.md` (§1.15) and keep going with a mock.
2. Work **phase by phase** (§12). At the end of each phase run its acceptance checks and write `docs/ui/progress-phase-N.md` (what was done, how to verify, known gaps).
3. **Never invent versions.** Look up the current stable release of each dependency and pin it with the lockfile committed.
4. **UI guardrails (these prevent conflicts with the backend):**
   - Relative URLs only (`/api/...`). No absolute URLs, no CORS assumptions, no new endpoints, no changed paths or field names.
   - Ignore unknown fields in responses. Treat non-JSON error responses as normal (§1.8).
   - No inline `<script>`, no inline styles (`style=` or `style={{}}`), no CDN assets, no `eval`: the CSP in §1.11 will block them.
   - `localStorage` only for `kubeshop.sessionId` and `kubeshop.theme`.
5. Until `api/openapi.yaml` exists (milestone M0), build against MSW mocks derived from §1.7. After M1, switch to the real backend (`make dev-backend`).
6. Small PRs, Conventional Commits, CI green before merge.

**Suggested Antigravity prompt**
> Read `ui.md` and `plan.md` completely. Section 1 is identical in both and is the source of truth. You are the UI agent and may only edit `web/**`, `.github/workflows/ci-web.yml` and `docs/ui/**`. Execute `ui.md` phases in order. Use MSW mocks until the backend reaches milestone M1.
---

## 1. Shared Contract v1.0

> **IDENTICAL in `plan.md` and `ui.md`.** This section is the single source of truth for everything both sides depend on. If anything elsewhere in a file contradicts this section, **this section wins**. To change it, follow §1.15.

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
| `POST /api/orders` | Body `OrderRequest`; header `Idempotency-Key`. Reads the cart, stores the order, clears the cart. → `Order`. Empty cart → `422 CART_EMPTY` |
| `GET /api/orders` | The session's orders, newest first, max 50 → `{"items":[Order]}` |
| `GET /api/orders/{id}` | → `Order`, or `404 ORDER_NOT_FOUND` (also when the order belongs to another session) |
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
 "createdAt":"2026-11-20T10:15:30Z"}
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
| 404 | `PRODUCT_NOT_FOUND` / `ORDER_NOT_FOUND` / `NOT_FOUND` | unknown product, order, or route |
| 405 | `METHOD_NOT_ALLOWED` | |
| 422 | `CART_EMPTY` | placing an order with an empty cart |
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
- All pods: non-root, `readOnlyRootFilesystem: true`, all capabilities dropped, `seccompProfile: RuntimeDefault`, no service-account token mounted. The web container may write **only** to `/tmp` (an `emptyDir`).
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

**Goal:** a small, polished, accessible storefront SPA that exercises the whole backend (catalog → cart → checkout → orders) and doubles as a **live demo surface for the platform**: the `/status` page makes canary rollouts, versions and pods visible.

**In scope:** catalog, product detail, cart, checkout, order confirmation and history, status page, dark/light theme, responsive layout, accessibility, unit + e2e tests, production nginx image.

**Out of scope:** authentication, payments, admin screens, i18n, PWA/offline, browser tracing (stretch), server-side rendering.

## 3. Tech stack (verify current versions, then pin)

| Area | Choice |
|---|---|
| Runtime / package manager | Node.js LTS (24, or 22), `pnpm` via corepack |
| Framework | React 19 + TypeScript (strict) + Vite |
| Routing | React Router (library mode, `BrowserRouter`) |
| Server state | TanStack Query v5 |
| Styling | Tailwind CSS v4, design tokens as CSS variables, `lucide-react` icons, self-hosted fonts via `@fontsource-variable/inter` and `@fontsource-variable/jetbrains-mono` |
| Forms | `react-hook-form` + `zod` |
| API types | generated from `../api/openapi.yaml` with `openapi-typescript` into `src/api/schema.d.ts` |
| Mocks | MSW (unit tests and `VITE_USE_MOCKS=true` dev mode only) |
| Tests | Vitest + Testing Library, Playwright (+ `@axe-core/playwright`) |
| Quality | ESLint (typescript-eslint, react-hooks, jsx-a11y), Prettier, `size-limit` |
| Serving | `nginxinc/nginx-unprivileged` (port 8080) |

No UI component framework: build small components yourself on Tailwind so the CSP and bundle size stay under control.

## 4. Project structure

```
web/
  Dockerfile  nginx/{nginx.conf,default.conf.template?}  docker-entrypoint.d/40-runtime-config.sh
  package.json  pnpm-lock.yaml  vite.config.ts  tsconfig.json  eslint.config.js  .prettierrc
  index.html  README.md
  public/images/products/{kb-001..ac-003}.svg  public/images/placeholder.svg  public/favicon.svg
  dev-public/mockServiceWorker.js          # served in dev only; must NOT end up in the production build
  scripts/generate-product-images.mjs
  src/
    main.tsx  App.tsx  routes.tsx  styles/{tokens.css,index.css}
    api/{client.ts,errors.ts,session.ts,schema.d.ts,types.manual.ts (delete after M0)}
    api/{catalog.ts,cart.ts,orders.ts,version.ts,runtimeConfig.ts}   # thin typed functions + query hooks
    components/{ui/*,layout/*,product/*,cart/*,checkout/*,status/*}
    pages/{CatalogPage,ProductPage,CartPage,CheckoutPage,OrdersPage,OrderPage,StatusPage,NotFoundPage}.tsx
    lib/{money.ts,format.ts,uuid.ts,theme.ts}
    mocks/{handlers.ts,browser.ts,server.ts,fixtures.ts}   # fixtures = the 12 seed products of §1.9
  e2e/{*.spec.ts,fixtures.ts,playwright.config.ts}
```

## 5. Design system

**Look and feel:** clean, technical, friendly. "Developer desk gear" shop. Lots of whitespace, rounded cards, subtle borders instead of heavy shadows.

**Tokens** (CSS variables in `tokens.css`, mapped into Tailwind; dark values under `.dark` and `prefers-color-scheme`):

| Token | Light | Dark |
|---|---|---|
| `--bg` | `#F8FAFC` | `#0B1120` |
| `--surface` | `#FFFFFF` | `#111827` |
| `--border` | `#E2E8F0` | `#1F2937` |
| `--text` | `#0F172A` | `#E5E7EB` |
| `--text-muted` | `#475569` | `#9CA3AF` |
| `--primary` | `#326CE5` | `#6C9CFF` |
| `--primary-contrast` | `#FFFFFF` | `#0B1120` |
| `--success` / `--warning` / `--danger` | `#15803D` / `#B45309` / `#B91C1C` | `#4ADE80` / `#FBBF24` / `#F87171` |

All text/background pairs must meet WCAG 2.1 AA (4.5:1; 3:1 for large text and UI components). Verify with axe and a manual check of the table above.

**Type:** Inter Variable (UI), JetBrains Mono Variable (ids, SHAs, versions, pod names). Scale: 12/14/16/18/20/24/30/36. Body 16 px, line-height 1.5.
**Spacing:** 4 px base (Tailwind default). **Radius:** 8 px controls, 12 px cards, 999 px chips. **Breakpoints:** `sm 640`, `md 768`, `lg 1024`, `xl 1280`; mobile-first. Container max width 1152 px.
**Motion:** 150 ms ease for hover/focus; respect `prefers-reduced-motion` (disable transitions and skeleton shimmer).
**Focus:** visible 2 px ring (`--primary`) with 2 px offset on every interactive element. Never remove outlines without a replacement.

**Base components (`components/ui`)**: `Button` (primary, secondary, ghost, danger; sizes; loading state with spinner and `aria-busy`), `IconButton`, `Input`, `Select`, `Field` (label + hint + error, wired with `aria-describedby`), `Badge`/`Chip`, `Card`, `Skeleton`, `Spinner`, `Toast` (live region), `Dialog` (focus trap, Esc closes, returns focus), `QuantityStepper`, `EmptyState`, `ErrorState` (message + request ID + Retry), `Money`.

## 6. Layout and global behavior

```
┌─────────────────────────────────────────────────────────────────────┐
│ ◈ KubeShop      Shop   Status   Orders        [ENV] [◐ theme] [🛒 3] │  ← sticky header
├─────────────────────────────────────────────────────────────────────┤
│                         <page content>                              │
├─────────────────────────────────────────────────────────────────────┤
│ © KubeShop demo · env: dev · version sha-3f2a9c1 (mono, small)      │  ← footer from /runtime-config.json
└─────────────────────────────────────────────────────────────────────┘
```
- **Skip link** ("Skip to content") as first focusable element. Header collapses to a menu button below `md`.
- **Env badge:** hidden for `prod`; visible for `local` (gray), `dev` (amber), `staging` (purple). It never relies on color alone (text inside).
- **Cart badge** (`data-testid="cart-badge"`): `itemCount` from `GET /api/cart`; hidden when 0; announces changes via an `aria-live="polite"` region.
- **Theme toggle:** light / dark / system, stored in `localStorage["kubeshop.theme"]`. Apply the class before first paint **without an inline script** (set it from a small external module loaded synchronously in `<head>`, `src/lib/theme.ts` bundled as a normal script; CSP allows `'self'`). Avoid flash of wrong theme.
- **Global error boundary** (friendly full-page error with Reload) and an **offline banner** using `navigator.onLine`.
- **Document title** per route (`<Page> · KubeShop`) and focus moved to the main heading on route change.

## 7. Routes and pages

| Route | Page | Notes |
|---|---|---|
| `/` | CatalogPage | filters in the URL: `?category=keyboards&q=mouse` |
| `/products/:id` | ProductPage | |
| `/cart` | CartPage | |
| `/checkout` | CheckoutPage | redirects to `/cart` when the cart is empty |
| `/orders` | OrdersPage | |
| `/orders/:id` | OrderPage | |
| `/status` | StatusPage | lazy-loaded chunk |
| `*` | NotFoundPage | |

Route params are validated before use (`id` matches `^[a-z]{2}-\d{3}$` for products, UUID for orders); invalid → NotFoundPage without calling the API.

### 7.1 CatalogPage
```
 Gear for engineers who ship.
 [ 🔍 Search products…           ]   (Keyboards)(Mice)(Audio)(Accessories)  [All]
 12 products
 ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
 │ image  │ │        │ │        │ │        │     grid: 1 col <sm, 2 col sm, 3 col lg, 4 col xl
 │ name   │ │        │ │        │ │        │
 │ chip   │ │        │ │        │ │        │
 │ $89.00 │ │        │ │        │ │        │
 │[Add to cart]      │ │        │ │        │
 └────────┘ └────────┘ └────────┘ └────────┘
```
- Calls: `GET /api/catalog/categories` (cached for the session) and `GET /api/catalog/products?category=&q=&limit=50`. Search is debounced 300 ms and syncs to the URL.
- Card: whole card links to `/products/:id` (image + name are the link, not a nested button inside a link). `Add to cart` calls `POST /api/cart/items {productId, quantity:1}`: button shows loading, success toast "Added Nimbus 75… to cart", cart badge updates. Failure: error toast with request ID.
- States: loading → 8 skeleton cards; empty → `EmptyState` "No products match" with "Clear filters"; error → `ErrorState` with Retry.
- Test ids: `product-card-{id}`, `add-to-cart-{id}`, `category-chip-{id}`, `search-input`.

### 7.2 ProductPage
Two columns on `md+` (image left, details right). Shows name, category chip, price, description, `QuantityStepper` (1–20), `Add to cart`, and a back link to the catalog (preserving filters). `GET /api/catalog/products/{id}`. `PRODUCT_NOT_FOUND` → NotFoundPage view. Test ids: `product-title`, `qty-input`, `add-to-cart`.

### 7.3 CartPage
```
 Your cart (3 items)
 ┌──────────────────────────────────────────────┐  ┌────────────────────┐
 │ [img] Nimbus 75…   $89.00   [-] 2 [+]  $178.00 ✕ │  │ Order summary      │
 │ [img] Orbit Ergo…  $59.00   [-] 1 [+]   $59.00 ✕ │  │ Subtotal  $237.00  │
 └──────────────────────────────────────────────┘  │ Shipping  Free     │
 [Clear cart]                                       │ [Checkout]         │
                                                    └────────────────────┘
```
- `GET /api/cart`. Quantity changes use `PUT /api/cart/items/{id}` with **optimistic update** and rollback on error, debounced 400 ms. The remove button calls `DELETE /api/cart/items/{id}`. `Clear cart` opens a confirm `Dialog` then calls `DELETE /api/cart`.
- Totals come from the response (`subtotalCents`), never recomputed client-side except for optimistic display.
- Empty cart → `EmptyState` with "Browse products". `Checkout` is disabled when empty.
- Test ids: `cart-line-{id}`, `qty-input-{id}`, `remove-{id}`, `cart-subtotal`, `checkout-button`, `clear-cart`.

### 7.4 CheckoutPage
Left: form. Right: read-only order summary from `GET /api/cart`.
Fields (labels exact): **Full name**, **Email**, **Address line 1**, **Address line 2 (optional)**, **City**, **Postal code**, **Country** (a `Select` of ISO alpha-2 codes with country names; a curated list of at least 30 countries, default `US`).
- Client validation = the exact rules in §1.7 (zod schema `checkoutSchema`), validated on blur and on submit.
- Submit → `POST /api/orders` with header `Idempotency-Key` (a UUID created when the page mounts, kept across retries, regenerated after success) and the §1.6 headers. Disable the button and show a spinner while pending (no double submit).
- Outcomes:
  - `201`/`200` → navigate to `/orders/:id` with `state: { justPlaced: true }`, invalidate the cart and orders queries.
  - `400 VALIDATION_ERROR` → map `details[].field` onto form fields (`customer.name` → Full name, etc.) and focus the first invalid field; unmapped details go in a form-level alert.
  - `422 CART_EMPTY` → toast and redirect to `/cart`.
  - `5xx`, `502/504`, network, or non-JSON errors → form-level `role="alert"` banner with the request ID and a "Try again" button; the form data is kept.
- Test ids: `field-name`, `field-email`, `field-line1`, `field-line2`, `field-city`, `field-postalCode`, `field-country`, `checkout-submit`, `form-error`.

### 7.5 OrderPage and OrdersPage
- `GET /api/orders/{id}`: header "Thank you! Your order is placed" only when `state.justPlaced`, otherwise "Order details". Shows the order ID (mono, copy button), `PLACED` status badge, created time (local format), items table, total, customer, and shipping address. `ORDER_NOT_FOUND` → NotFoundPage view. Test id `order-id`.
- `GET /api/orders`: table (date, order ID short, items count, total, link). Empty state "No orders yet". Newest first as returned.

### 7.6 StatusPage (`/status`): the platform demo page
Purpose: show what is running, where, and make rollouts visible.
```
 Platform status                                   [● All systems operational]
 Environment: dev    Web version: sha-3f2a9c1 (mono)    Built: 2026-11-20 09:58 UTC
 ┌ catalog ────────┐ ┌ cart ───────────┐ ┌ orders ─────────┐
 │ ● healthy 42 ms │ │ ● healthy 38 ms │ │ ● healthy 51 ms │
 │ version sha-…   │ │ version sha-…   │ │ version sha-…   │
 │ git 3f2a9c1     │ │ …               │ │ …               │
 │ pod catalog-6d… │ │ …               │ │ …               │
 └─────────────────┘ └─────────────────┘ └─────────────────┘
 Traffic sampler  [ Start sampling ]  (GET /api/catalog/version once per second, last 50 responses)
 Versions seen:  sha-3f2a9c1 ██████████░░░░░░ 78%     sha-b81e402 ░░░░░░██████ 22%
 Pods seen: table of podName · version · count
 Tip text: "During a canary rollout you will see two versions here."
```
- Polls `GET /api/{catalog,cart,orders}/version` every 5 s (TanStack Query `refetchInterval`, paused while the tab is hidden) and reads `/runtime-config.json` for the web card. Measure latency client-side with `performance.now()`.
- Health dot: green = 200 and < 1 s, amber = 200 but ≥ 1 s, red = error or timeout (10 s). Text label always accompanies the dot. Overall banner: all green → "All systems operational"; any amber → "Degraded performance"; any red → "Service disruption".
- Sampler: opt-in toggle (off by default, stops on unmount), ring buffer of 50 results, grouped by `version` and `podName`. Render the bar chart as **SVG** (no inline style attributes; widths via SVG `width` attributes). Provide a text table alternative for accessibility.
- Test ids: `status-card-{service}`, `status-overall`, `sampler-toggle`, `versions-seen`.

### 7.7 NotFoundPage
Friendly 404 with links to Shop and Status.

## 8. Data layer

**`api/client.ts`:** a `fetch` wrapper used by every call.
- Base path is relative. Adds `X-Request-ID: <uuid>` and `X-Session-ID` (from `session.ts`) to every request, `Content-Type: application/json` when a body exists. 10 s timeout with `AbortController`.
- Parses JSON when `Content-Type` is JSON. On a non-2xx response throws `ApiError { status, code, message, requestId, details }`. If the body is not JSON or lacks the §1.8 shape: `code = "UNKNOWN"`, `message` generic ("Something went wrong. Please try again."), `requestId` from the response header `X-Request-ID` or the one we sent.
- Network failure / timeout → `ApiError` with `code = "NETWORK"` / `"TIMEOUT"`.

**`api/session.ts`:** reads `localStorage["kubeshop.sessionId"]`; if absent or not a UUID v4, creates one with `crypto.randomUUID()` and stores it. Guard every storage access with try/catch and fall back to an in-memory id.

**Query keys:** `['categories']`, `['products', {category,q}]`, `['product', id]`, `['cart']`, `['orders']`, `['order', id]`, `['version', service]`, `['runtimeConfig']`.

**Retry policy (matches §1.13):** queries (GET) retry up to 2 times with exponential backoff **only** for `NETWORK`, `TIMEOUT`, and HTTP 502/503/504; never for 4xx. Mutations never auto-retry. Stale times: categories 5 min, products 30 s, cart 0.

**Error message map (code → user text):**

| Code | Message |
|---|---|
| `VALIDATION_ERROR` | "Please check the highlighted fields." |
| `MISSING_SESSION` | auto-recover once (regenerate session id, retry the request one time), else generic |
| `PRODUCT_NOT_FOUND` | "That product doesn't exist." |
| `ORDER_NOT_FOUND` | "We couldn't find that order." |
| `CART_EMPTY` | "Your cart is empty." |
| `UPSTREAM_UNAVAILABLE`, `UPSTREAM_TIMEOUT`, `INTERNAL_ERROR`, `FAULT_INJECTED`, `UNKNOWN`, `NETWORK`, `TIMEOUT` | "Something went wrong. Please try again." + "Reference: <requestId>" |

Never show raw server messages for 5xx. Always show the request ID so it can be searched in Loki/Tempo.

**Types:** use generated `schema.d.ts` types. Until M0, hand-write `types.manual.ts` strictly from §1.7, then delete it and fix compile errors. Add the script `pnpm gen:api` and a CI check that regenerating produces no diff.

## 9. Accessibility (target WCAG 2.1 AA)

- Semantic landmarks (`header`, `nav`, `main`, `footer`), one `h1` per page, logical heading order.
- All controls keyboard operable; visible focus; dialogs trap and restore focus; Esc closes.
- Forms: every input has a visible label, errors linked with `aria-describedby`, `aria-invalid`, error summary receives focus on failed submit.
- Live regions for toasts, cart count changes and status banner. Loading states use `aria-busy`.
- Images have meaningful `alt` (product name); decorative icons `aria-hidden`. Touch targets ≥ 44×44 px on mobile.
- Color is never the only signal (status dots have text).
- `@axe-core/playwright` runs on every page in e2e with **zero violations** allowed.

## 10. Performance and quality budgets

- Initial JS ≤ **200 KB gzip** (enforced by `size-limit`); `/status` and the country list code-split.
- Lighthouse (desktop, production build, via `lighthouse-ci` optional): Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95.
- Images: SVG, explicit `width`/`height` to avoid layout shift, `loading="lazy"` below the fold.
- `product images`: generate the 12 SVGs with `scripts/generate-product-images.mjs` (400×300 viewBox, category color + simple geometric glyph + product code), plus `placeholder.svg` as the `<img onError>` fallback. Files are named `/images/products/{id}.svg` exactly as required by §1.9.
- TypeScript strict, ESLint with `jsx-a11y`, zero warnings in CI. Unit test coverage ≥ 80 % on `src/api`, `src/lib`, and form schemas.
- No `dangerouslySetInnerHTML`; user-provided text is always rendered as text.

## 11. Production image and nginx

**`web/Dockerfile`** (multi-stage)
1. Build stage on Node LTS alpine: `corepack enable`, `pnpm install --frozen-lockfile`, `ARG GIT_SHA`, `ARG BUILD_TIME`, `pnpm build`.
2. Runtime stage `nginxinc/nginx-unprivileged` (pin by digest): copy `dist/` to `/usr/share/nginx/html`, copy `nginx.conf`, copy `40-runtime-config.sh` into `/docker-entrypoint.d/` (executable), `ENV APP_GIT_SHA=$GIT_SHA APP_BUILD_TIME=$BUILD_TIME`, `USER 101`, `EXPOSE 8080`. OCI labels. The dev-only `mockServiceWorker.js` must not be present in `dist/` (add a build check).

**`40-runtime-config.sh`:** writes `/tmp/runtime-config.json` = `{"environment":"$APP_ENV","version":"$APP_VERSION","gitSha":"$APP_GIT_SHA","buildTime":"$APP_BUILD_TIME"}` with JSON-safe escaping; defaults `APP_ENV=local`, `APP_VERSION=dev`. Exits non-zero on failure.

**`nginx.conf` requirements**
- Listen on **8080**; `server_tokens off`; gzip for text/JS/CSS/SVG/JSON; all temp paths under `/tmp`; pid under `/tmp`. The container must run with `readOnlyRootFilesystem: true` and only `/tmp` writable (plan.md Helm chart mounts an emptyDir there).
- `location = /healthz` → `200 ok` (`text/plain`), no access log.
- `location = /runtime-config.json` → `alias /tmp/runtime-config.json`, `Cache-Control: no-store`, `application/json`.
- `location /assets/` (hashed files) → `Cache-Control: public, max-age=31536000, immutable`; **missing files return 404, never `index.html`** (prevents blueGreen/rollout mismatches turning into HTML-instead-of-JS errors).
- `location /images/` → `Cache-Control: public, max-age=86400`.
- Any path with a file extension that does not exist → 404. Everything else → `try_files $uri /index.html` with `Cache-Control: no-cache` on `index.html`.
- `location /api/` → `404` (these requests belong to the Gateway; nginx never proxies).
- Security headers **exactly** as in §1.11 (CSP string must match character for character). Use `add_header ... always` and repeat headers inside any `location` that sets its own `add_header` (nginx does not inherit them).
- Deny dotfiles. No directory listing.

Acceptance (**M3 check**): `docker run --read-only --tmpfs /tmp -p 8080:8080 -e APP_ENV=dev -e APP_VERSION=sha-test kubeshop-web` serves the app, `/healthz`, `/runtime-config.json`; `curl -I` shows every header from §1.11; a missing `/assets/x.js` returns 404.

## 12. Phases

### Phase 1: Scaffold (starts immediately)
Vite + React + TS, Tailwind v4, ESLint/Prettier, Vitest, directory layout (§4), tokens and base components (§5), layout shell (§6), MSW mocks and fixtures from §1.7/§1.9, product image generator.
Acceptance: `pnpm dev` shows the shell with mocked catalog data; lint, typecheck, unit tests pass.

### Phase 2: Features against mocks
All pages of §7, data layer of §8, forms, error handling, theme, accessibility basics.
Acceptance: complete browse → cart → checkout → order flow works against MSW; unit tests for client, session, money, error mapping, schemas.

### Phase 3: Real backend (needs M0 + M1)
Run `pnpm gen:api`, delete `types.manual.ts`, set the Vite dev proxy exactly as in §1.5, switch off mocks by default. Fix any mismatch **by logging it in `docs/CONTRACT-CHANGES.md`**, not by working around it.
Acceptance: the same flow works with `make dev-backend` and `pnpm dev` on `http://localhost:5173`.

### Phase 4: Container and e2e (needs `make up` from the backend)
Dockerfile, nginx, runtime-config script (§11). Playwright suite (below) against `http://localhost:8080` (`BASE_URL` env overrides, e.g. dev URL).
- Scenarios: browse + category filter + search; add to cart and badge update; change quantity and remove; clear cart dialog; checkout success → order page shows an order ID → appears in `/orders`; checkout validation errors (client and server `400` via `page.route`); empty-cart checkout redirect; non-JSON `503` and `429` handling (via `page.route`); status page shows the 3 services and the web version; theme toggle persists; 404 route; axe scan on every route; keyboard-only checkout.
- Projects: desktop Chromium and mobile (Pixel 5). Traces and screenshots on failure; HTML report uploaded as a CI artifact.
Acceptance: e2e green locally and in CI; the production image passes the §11 checks.

### Phase 5: CI (`.github/workflows/ci-web.yml`, needs M2)
Jobs: `lint` (eslint, prettier check, tsc, `gen:api` drift check) → `unit` (vitest with coverage gate) → `build` (size-limit check, assert no `mockServiceWorker.js` in `dist/`) → `e2e` (checkout repo, `make up`, install Playwright browsers, run, upload report) → `image` (calls `_publish-image.yml` with `image-name: kubeshop-web`, `context: web`, `dockerfile: web/Dockerfile`; `push: true` only on `main`) → `audit` (`pnpm audit --prod`, Trivy fs). Path filter: `web/**`, `api/openapi.yaml`.
Acceptance: all jobs green; a merge to `main` publishes a signed `kubeshop-web` image.

### Phase 6: Cluster verification (needs M4/M5)
Run e2e against `https://dev.<BASE_DOMAIN>`. Verify: CSP produces no console violations; `/status` shows the dev environment and real pod names; during a backend canary rollout the versions bar shows two versions; during a web blueGreen promotion no `/assets/*` 404s occur in the browser console. Capture screenshots and a short screen recording into `docs/ui/` for the README and CV portfolio.

### Phase 7: Docs
`web/README.md` (setup, scripts, structure, env vars, how mocks work, how to regenerate types), `docs/ui/design-notes.md` (tokens, components, decisions), screenshots of every page (light and dark, desktop and mobile).

## 13. Definition of Done (UI)

- [ ] Every page in §7 implemented and matching the contract with **zero** deviations from §1.
- [ ] Complete e2e suite green on desktop and mobile, axe reports zero violations.
- [ ] Production image runs read-only as non-root, serves exact headers from §1.11, missing assets return 404.
- [ ] `/status` demonstrates versions and pods and visibly shows a canary rollout.
- [ ] Budgets of §10 met; no console errors or CSP violations in dev environment.
- [ ] Generated API types are in sync with `api/openapi.yaml` (CI check).
- [ ] No secrets, no absolute API URLs, no `localStorage` keys beyond §1.11.
- [ ] Docs and screenshots complete (§12 Phase 7). Zero unresolved UI-related entries in `docs/CONTRACT-CHANGES.md`.
