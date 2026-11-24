# KubeShop

> **Gear for engineers** — A production-grade, cloud-native microservices e-commerce platform and platform engineering showcase.

[![CI Services](https://github.com/omar-riadd/KubeShop/actions/workflows/ci-services.yml/badge.svg)](https://github.com/omar-riadd/KubeShop/actions/workflows/ci-services.yml)
[![CI Web](https://github.com/omar-riadd/KubeShop/actions/workflows/ci-web.yml/badge.svg)](https://github.com/omar-riadd/KubeShop/actions/workflows/ci-web.yml)
[![Security Scan](https://github.com/omar-riadd/KubeShop/actions/workflows/security.yml/badge.svg)](https://github.com/omar-riadd/KubeShop/actions/workflows/security.yml)
[![Helm & GitOps](https://github.com/omar-riadd/KubeShop/actions/workflows/helm-gitops.yml/badge.svg)](https://github.com/omar-riadd/KubeShop/actions/workflows/helm-gitops.yml)
[![Terraform](https://github.com/omar-riadd/KubeShop/actions/workflows/terraform.yml/badge.svg)](https://github.com/omar-riadd/KubeShop/actions/workflows/terraform.yml)

GitHub Repository: [`https://github.com/omar-riadd/KubeShop.git`](https://github.com/omar-riadd/KubeShop.git)  
[Architecture](#1-architecture-overview) · [Core Components](#2-core-components) · [Quickstart (Clone to Destroy)](#4-quickstart-from-clone-to-destroy) · [Environments](#5-environments--promotion) · [Documentation](#6-documentation--runbooks)

---

## 1. Architecture Overview

KubeShop is built as a cloud-native monorepo demonstrating end-to-end DevOps and platform engineering practices: IaC (Terraform EKS), GitOps (Argo CD & Argo Rollouts), Progressive Delivery (Canary & Blue/Green), Observability with 28-day SLOs (Prometheus, Loki, Tempo, Alloy, OpenTelemetry, Grafana), Policy-as-Code (Kyverno v1.20 CEL), and hardened container security.

```mermaid
flowchart TD
    Client["Browser / Client"] -- HTTPS --> NLB["AWS Network Load Balancer"]
    NLB --> EG["Envoy Gateway (Kubernetes Gateway API)"]

    subgraph Cluster["Amazon EKS Cluster (kubeshop)"]
        direction TB

        subgraph IngressRouting["Routing & Gateway Layer"]
            EG -- "/api/catalog/*" --> SvcCatalog["Service: catalog:80"]
            EG -- "/api/cart/*"    --> SvcCart["Service: cart:80"]
            EG -- "/api/orders/*"  --> SvcOrders["Service: orders:80"]
            EG -- "/* (SPA fallback)" --> SvcWeb["Service: web:80"]
        end

        subgraph Workloads["Application Workloads (kubeshop-{env})"]
            SvcWeb --> WebPod["Web Pod (Nginx Unprivileged, React 19 SPA)"]
            SvcCatalog --> CatalogPod["Catalog Pod (Go, In-Memory Seed)"]
            SvcCart --> CartPod["Cart Pod (Go)"]
            SvcOrders --> OrdersPod["Orders Pod (Go)"]

            CartPod -- "Validate Product" --> CatalogPod
            CartPod -- "Session Cart (24h TTL)" --> Redis[("Redis 7.4")]
            OrdersPod -- "Read & Clear Cart" --> CartPod
            OrdersPod -- "Transactional Orders" --> Postgres[("CloudNativePG (orders-db)")]
        end

        subgraph Telemetry["Observability Stack (observability / monitoring)"]
            CatalogPod & CartPod & OrdersPod -- "OTLP gRPC :4317" --> OTel["OpenTelemetry Collector"]
            OTel --> Tempo["Grafana Tempo (Traces)"]
            Alloy["Grafana Alloy (DaemonSet)"] -- "Container Logs" --> Loki["Grafana Loki (Logs)"]
            Prometheus["Prometheus"] -- "Scrape :9090/metrics" --> CatalogPod & CartPod & OrdersPod
            Grafana["Grafana Dashboards"] --> Prometheus & Loki & Tempo
        end

        subgraph Policies["Security & Governance"]
            Kyverno["Kyverno v1.20 (CEL Validating Policies)"]
            NetPol["NetworkPolicies (Default Deny + Explicit Ingress/Egress)"]
            PSS["Pod Security Standards: Restricted"]
        end
    end
```

---

## 2. Core Components

### Microservices (`services/`)
- **`catalog`**: High-performance Go service loading 12 engineering gear products into memory at startup. Stateless, filtered search, pagination, category listing.
- **`cart`**: Go service managing anonymous customer sessions via `X-Session-ID` in Redis hashes (24h TTL). Performs snapshotting from `catalog` with exponential backoff retry.
- **`orders`**: Go service executing order placement within an ACID transaction on CloudNativePG (PostgreSQL 17), with idempotency key replay, batch order-item loading (`WHERE order_id = ANY($1)`), empty cart validation, order status lifecycle management (`PATCH /api/orders/{id}/status`), per-session token-bucket rate limiting (`rps=2, burst=5`), and automatic cart clearing.
- **`internal/platform`**: Shared package providing structured JSON logging (`slog`), OpenTelemetry tracing & propagation, Prometheus RED metrics, graceful shutdown with gateway drain delay, request body limits (16 KiB), fault injection (`FAULT_ERROR_RATE`, `FAULT_LATENCY_MS`), exponential backoff retries with jitter (`WithRetry`), and session rate limiting (`SessionRateLimiter`).

### Frontend SPA (`web/`)
- **React 19 + TypeScript + Vite**: Responsive desk gear storefront with Tailwind CSS v4 design tokens, TanStack Query v5, route-level `React.lazy` + `Suspense` code splitting (32.58 kB entry chunk), zero WCAG 2.1 AA violations (verified with Axe), and zero-FOUC theme switching (light/dark/system).
- **Flagship E-Commerce UX**:
  - **Instant `Cmd+K` Command Palette**: Global quick search (`Cmd+K`, `Ctrl+K`, `/`) with category pills, live query filtering, and keyboard navigation (`↑`/`↓`/`Enter`).
  - **Slide-Out Mini-Cart Drawer**: Slide-over drawer with real-time dynamic Free Priority SRE Dispatch progress bar ($75 threshold), in-drawer quantity management, and direct checkout CTA.
  - **Floating Sticky Quick-Buy**: Context-aware floating bar on product pages with instant Cart Drawer integration.
  - **Category-Tailored Unboxing ("What's in the Box")**: Technical packaging and accessory breakdown for each hardware gear category.
  - **Side-by-Side Spec Comparison**: Apple Store-style modal comparison matrix evaluating form-factor, switches, connectivity, latency, and weight.
  - **Frequently Bought Together Bundles**: Recommended gear bundles with automatic 10% bundle savings.
- **Platform Status Dashboard (`/status`)**: Live canary rollout observer measuring service health, response latency, active pod names, and real-time version traffic distributions.
- **Hardened Nginx**: Runs as unprivileged user `101`, `readOnlyRootFilesystem: true`, dynamic runtime configuration via `/tmp/runtime-config.json`, DRY modular security headers (`include /etc/nginx/security_headers.conf`), and strict Content Security Policy (`script-src 'self'`).
- **Comprehensive Test Harness**: 53 Vitest unit & component tests across 15 test suites and 15 Playwright E2E & WCAG 2.1 AA accessibility suites.

### Infrastructure as Code (`infra/terraform/`)
- **`bootstrap/`**: Versioned, KMS-encrypted S3 remote state bucket with native S3 locking (`use_lockfile = true`, Terraform >= 1.11; no DynamoDB table needed).
- **`modules/`**: 6 reusable internal modules:
  - `network`: 3-AZ VPC, public + private subnets, single NAT Gateway, EKS ELB/NLB discovery tags.
  - `eks`: Amazon EKS 1.35, KMS envelope encryption, `API` Access Entries, IRSA OIDC, spot & on-demand node groups.
  - `iam-irsa`: Least-privilege IRSA roles for AWS Load Balancer Controller, ExternalDNS, cert-manager, External Secrets Operator, and EBS CSI.
  - `secrets`: KMS-encrypted AWS Secrets Manager entries (`redis`, `slack-webhook`, `grafana-admin`).
  - `github-oidc`: GitHub Actions OIDC provider + read-only plan role and least-privilege protected apply IAM role.
  - `budget`: Monthly AWS Budgets alerts at 50%, 80%, and 100% thresholds.
- **`envs/main/`**: Wires all modules and bootstraps AWS Load Balancer Controller, Argo CD (with progressive syncs and private repo credentials secret), and root GitOps Application.

### GitOps & Progressive Delivery (`deploy/`, `gitops/`)
- **Shared Helm Chart (`deploy/charts/app`)**: Single chart rendering all 4 workloads (`catalog`, `cart`, `orders`, `web`) with `values.schema.json` enforcement, Argo Rollouts (canary for APIs, blueGreen for web), HTTPRoutes, ServiceMonitors, and NetworkPolicies.
- **Environment Baseline Chart (`deploy/charts/env-baseline`)**: Per-environment namespace quotas, default-deny NetworkPolicies, Redis StatefulSet with conditional PVC persistence (`gp3`, RDB `--save 60 1`) and PodDisruptionBudget, CloudNativePG cluster, and synthetic traffic generator (`k6`).
- **Argo CD GitOps**:
  - `gitops/bootstrap/`: Root bootstrap Application.
  - `gitops/platform/`: `RollingSync` ApplicationSet deploying 14 platform addons in progressive sync waves (cert-manager, external-secrets, kyverno, argo-rollouts, cloudnative-pg, keda, kube-prometheus-stack, envoy-gateway, external-dns, loki, tempo, alloy, otel-collector, opencost) + Wave 2 manifests.
  - `gitops/apps/`: Matrix ApplicationSets for `dev`, `staging`, and `prod`.

### Observability & SLOs
- **28-Day SLOs**:
  - `catalog` & `cart`: 99.5% availability (non-5xx excluding `/version`), catalog latency <300ms (95%).
  - `orders`: 99.5% availability on `POST /api/orders`, orders latency <800ms (95%).
- **Multi-Burn-Rate Alerts**: 14.4x fast burn (critical) and 6x slow burn (warning) routed to Slack via Alertmanager.
- **5 Grafana Dashboards as Code**: Service RED, SLO Overview, Argo Rollouts Canary Comparison, Kubernetes Capacity & Autoscaling, FinOps (OpenCost).

### Security & Governance
- **Kyverno v1.20 CEL Policies**: 7 policies enforcing Cosign keyless signatures, CycloneDX SBOM attestations, resource limits, immutable tags, approved registries, non-root/read-only rootfs/capabilities drop, and standard labels. Verified via `kyverno test` suite (10/10 passing).
- **Supply Chain Security**: Cosign keyless signing via GitHub Actions OIDC, CycloneDX SBOMs, SLSA provenance, Trivy container and IaC misconfiguration scanning.

---

## 3. Repository Structure

```
kubeshop/
├── .github/workflows/                   # CI/CD pipelines (Go services, Web, Security, Helm/GitOps, Terraform, Promotion)
├── api/
│   ├── openapi.yaml                     # OpenAPI 3.1 single source of truth for all HTTP APIs
│   └── redocly.yaml                     # OpenAPI linter configuration
├── deploy/
│   ├── charts/app/                      # Shared workload Helm chart (Rollouts, Routes, NetworkPolicies)
│   ├── charts/env-baseline/             # Namespace baseline (Quotas, Redis, CNPG, k6 traffic)
│   └── compose/gateway.nginx.conf       # Local Nginx reverse proxy standing in for Envoy Gateway
├── docs/
│   ├── adr/                             # 8 Architecture Decision Records (ADRs 0001-0008)
│   ├── runbooks/                        # Operational runbooks (repo-setup, bootstrap, promotion, rollback, incident-response, teardown)
│   ├── ui/                              # UI design system & accessibility notes
│   ├── architecture.md                  # Deep-dive diagrams (runtime, CI/CD, GitOps, telemetry, security)
│   ├── cost.md                          # FinOps BoM, OpenCost attribution & budget alerts
│   ├── demo-script.md                   # 5-minute end-to-end live walkthrough script
│   ├── incident-demo.md                 # Canary abort, incident drill-down & blameless postmortem template
│   ├── CONTRACT-CHANGES.md              # Shared contract change protocol log
│   └── PLACEHOLDERS.md                  # Safe environment placeholder registry
├── gitops/
│   ├── bootstrap/                       # Argo CD root Application
│   ├── platform/                        # Platform addon values and Wave 2 cluster manifests
│   └── apps/                            # AppProjects, matrix ApplicationSets, and per-env values
├── infra/terraform/
│   ├── bootstrap/                       # Remote S3 state bucket + KMS key
│   ├── modules/                         # 6 AWS modules (network, eks, iam-irsa, secrets, github-oidc, budget)
│   └── envs/main/                       # Main cluster stack + Helm bootstrap
├── scripts/
│   └── bootstrap-placeholders.sh        # Automated placeholder substitution (--dry-run, --check)
├── services/                            # Go microservices monorepo (catalog, cart, orders, platform)
├── tests/load/                          # k6 load testing scripts (smoke, load, stress)
├── web/                                 # React 19 storefront SPA (lazy-loaded routes) + Playwright E2E suite
├── .env.bootstrap.example               # Template for automated placeholder bootstrap (`make bootstrap`)
├── docker-compose.yml                   # Local multi-service development stack
├── Makefile                             # Common developer targets (dev, test, bootstrap, cluster-down)
├── renovate.json                        # Renovate automated dependency configuration
└── security.md                          # Penetration testing audit findings & remediation plan
```

---

## 4. Quickstart: From Clone to Destroy

Run the entire KubeShop platform locally in minutes—from cloning the repository, through browsing the live storefront and testing microservices, to cleanly tearing down and destroying all resources.

### Step 1: Clone the Repository

```bash
git clone https://github.com/omar-riadd/KubeShop.git
cd KubeShop
```

---

### Step 2: Prerequisites

To run the complete platform locally with Docker Compose, you only need:
- **Docker** (v24+ with Compose v2+)
- *(Optional)* **GNU Make** (standard on Linux/macOS; commands can also be run directly with `docker compose`)

> [!NOTE]
> You do **not** need Go, Node.js, or PostgreSQL installed on your host machine to run the platform. All microservices, databases, and frontend assets are containerized and orchestrated automatically.

---

### Step 3: Launch the Full Stack

Start all microservices, persistent databases, migrations, and the storefront gateway with a single command:

```bash
make up
```
*(Or without `make`: `docker compose --profile full up -d --build`)*

**What happens automatically:**
1. Starts **PostgreSQL 17** (`postgres`) and **Redis 7** (`redis`) with automated health checks.
2. Runs the database migration job (`orders-migrate`), creating all required schemas and indexes.
3. Builds and boots the three Go microservices: **Catalog** (`:8081`), **Cart** (`:8082`), and **Orders** (`:8083`).
4. Builds and serves the **Web Storefront** (React 19 SPA running in hardened unprivileged Nginx).
5. Launches the **Local Gateway** (reverse proxy mirroring Envoy Gateway rules) routing traffic on port `8080`.

> [!TIP]
> **Port Conflict?** If port `8080` is occupied on your host, simply override the gateway port:
> ```bash
> GATEWAY_PORT=8090 make up
> ```

---

### Step 4: Explore the Platform

Open your browser and explore the platform:

| Application / Service | URL | What to Test |
|---|---|---|
| **KubeShop Storefront** | [`http://localhost:8080`](http://localhost:8080) | Browse engineering desk gear, press `Cmd+K` or `Ctrl+K` to search, use the slide-out Cart Drawer, and complete a test checkout. |
| **Platform Status & Rollout Monitor** | [`http://localhost:8080/status`](http://localhost:8080/status) | Inspect real-time Canary rollout metrics, microservice latency, active pod versions, and run a live synthetic traffic probe. |
| **Catalog API** | [`http://localhost:8081/api/catalog/products`](http://localhost:8081/api/catalog/products) | Direct Go catalog service endpoint returning the 12 seeded developer gear items. |
| **Cart Health & Version** | [`http://localhost:8082/version`](http://localhost:8082/version) | Direct cart microservice health check and build metadata. |
| **Orders Health & Version** | [`http://localhost:8083/version`](http://localhost:8083/version) | Direct orders microservice health check and build metadata. |

To view real-time streaming logs from all services:
```bash
make logs
# Or: docker compose --profile full logs -f
```

---

### Step 5: Verify the System (Optional)

Run automated smoke checks to verify end-to-end communication across the Gateway, Catalog, Redis Cart, and Postgres Orders:

```bash
# 1. Quick API curl check
curl -s http://localhost:8080/api/catalog/products | grep "Keyboard"

# 2. Automated k6 end-to-end integration test (28 checks covering catalog, cart, checkout, idempotency)
make load-test
# (If using custom port: BASE_URL=http://localhost:8090 k6 run tests/load/smoke.js)
```

---

### Step 6: Stop and Destroy the Services

When you are finished testing, cleanly stop all containers and destroy all persistent volumes and networks:

```bash
make down
```
*(Or without `make`: `docker compose --profile full --profile backend down -v --remove-orphans`)*

**What this cleans up:**
- Gracefully stops and terminates all 7 running containers (`gateway`, `web`, `orders`, `cart`, `catalog`, `postgres`, `redis`).
- Deletes the Docker bridge networks.
- Deletes the local PostgreSQL database and Redis persistent data volumes (`-v`).
- Leaves zero orphaned containers or disk artifacts on your machine.

---

### Advanced: Alternative Workflows

<details>
<summary><b>1. Backend-Only Development (Go Services & DBs)</b></summary>

If you only want to develop backend Go services without building the web frontend:
```bash
# Start Postgres, Redis, migrations, Catalog (:8081), Cart (:8082), Orders (:8083)
make dev-backend

# Run backend unit, integration, and contract tests
make test

# Destroy backend services and volumes
make down
```
</details>

<details>
<summary><b>2. Frontend-Only Development (React 19 with Mock Service Worker)</b></summary>

If you want to work on the UI without running Docker or backend services:
```bash
cd web
pnpm install
pnpm dev
# Storefront opens at http://localhost:5173 with full in-browser MSW mock APIs
```
</details>

<details>
<summary><b>3. Running Full Test Suites & Linters</b></summary>

```bash
# Backend unit & race tests (coverage >84%)
make test

# Frontend unit & component tests (53/53 Vitest tests passing)
pnpm --dir web test --run

# Frontend production build & typecheck
pnpm --dir web build

# End-to-end Playwright tests (with local stack running on port 8080 or 8090)
BASE_URL=http://localhost:8080 pnpm --dir web test:e2e

# Kyverno CEL admission policy tests (10/10 passing)
kyverno test gitops/platform/kyverno/tests

# Terraform validation and formatting
terraform fmt -check -recursive infra/terraform
terraform -chdir=infra/terraform/bootstrap validate
terraform -chdir=infra/terraform/envs/main validate
```
</details>

<details>
<summary><b>4. Cloud Deployment & Complete Teardown (AWS EKS & GitOps)</b></summary>

If deploying to real AWS infrastructure:
1. **Bootstrap & Deploy**: Follow the [Repository Setup Runbook](docs/runbooks/repo-setup.md) and [Cluster Bootstrap Runbook](docs/runbooks/bootstrap.md).
2. **Cloud Teardown & Resource Destruction**: To prevent any ongoing AWS cloud spend, follow the ordered teardown process in the [Cluster Teardown Runbook](docs/runbooks/teardown.md):
   ```bash
   # 1. Clean up Argo CD applications and AWS Network Load Balancers
   make cluster-down

   # 2. Destroy the main EKS cluster stack
   cd infra/terraform/envs/main
   terraform destroy

   # 3. Destroy the S3 remote state bootstrap bucket
   cd ../../bootstrap
   terraform destroy
   ```
</details>

---

## 5. Environments & Promotion

| Environment | Namespace | URL | Deployment Method |
|---|---|---|---|
| **Local** | N/A | `http://localhost:8080` | Docker Compose (`make up`) |
| **Dev** | `kubeshop-dev` | `https://dev.<BASE_DOMAIN>` | Auto-deployed from `main` via GitHub App Bot PR |
| **Staging** | `kubeshop-staging` | `https://staging.<BASE_DOMAIN>` | Promoted via `promote.yml` workflow dispatch PR |
| **Prod** | `kubeshop-prod` | `https://app.<BASE_DOMAIN>` | Promoted via `promote.yml` PR requiring `CODEOWNERS` approval |

For promotion details, see the [GitOps Promotion Runbook](docs/runbooks/promotion.md).  
For initial repository and cloud onboarding, see the [Repository Setup Runbook](docs/runbooks/repo-setup.md).

---

## 6. Documentation & Runbooks

- **Architecture & Decisions**: [System Architecture](docs/architecture.md) · [ADRs (0001–0008)](docs/adr/README.md) · [UI Design Notes](docs/ui/design-notes.md) · [Shared Contract Changes](docs/CONTRACT-CHANGES.md) · [Security Audit & Hardening Plan](security.md)
- **Demos & FinOps**: [5-Minute Demo Script](docs/demo-script.md) · [Incident & Canary Demo](docs/incident-demo.md) · [FinOps Cost Analysis](docs/cost.md)
- **Operational Runbooks**:
  - [Repository Setup](docs/runbooks/repo-setup.md) · [Cluster Bootstrap](docs/runbooks/bootstrap.md) · [GitOps Promotion](docs/runbooks/promotion.md)
  - [Rollback](docs/runbooks/rollback.md) · [Incident Response](docs/runbooks/incident-response.md) · [Cluster Teardown](docs/runbooks/teardown.md)

---

## 7. Key Engineering Outcomes

- **Zero-Touch GitOps & Progressive Delivery**: Automated PR-based promotion across `dev`, `staging`, and `prod` using Argo CD `ApplicationSet`s and Argo Rollouts (canary with Prometheus analysis for Go APIs; blue/green for the React 19 SPA).
- **Hardened Software Supply Chain**: Keyless Sigstore Cosign OIDC image signing, CycloneDX SBOM attestations, SLSA provenance, Trivy/Semgrep/Gitleaks CI gates, and 7 Kyverno v1.20 native CEL admission policies (10/10 CI test suite).
- **Full-Signal Observability & SLOs**: End-to-end correlation across Prometheus RED metrics, Loki structured JSON logs, and Tempo OpenTelemetry traces with 28-day multi-burn-rate SLO alerts routed to Slack.
- **FinOps-Driven AWS EKS Design**: Consolidated 3 environments into a single EKS cluster with namespace/NetworkPolicy isolation, Spot non-prod node pools, single NAT Gateway, native S3 state locking, and OpenCost attribution — reducing projected cloud burn by **~59%** (~$265/mo vs ~$646/mo traditional).

---

## 8. Storefront & Platform Status Previews

| Storefront (Light) | Storefront (Dark) | Platform Status & Rollout Monitor |
|---|---|---|
| ![Catalog Light](docs/ui/screenshots/catalog-light-desktop.png) | ![Catalog Dark](docs/ui/screenshots/catalog-dark-desktop.png) | ![Status Monitor](docs/ui/screenshots/status-dark-desktop.png) |

See all 9 views (including mobile, product detail, cart, checkout, and order confirmation) in [docs/ui/design-notes.md](docs/ui/design-notes.md#screenshot-gallery-local-stack).

---

## 9. License & Ownership

Maintained by **Omar Riadd** ([@omar-riadd](https://github.com/omar-riadd)).  
Repository: [`https://github.com/omar-riadd/KubeShop.git`](https://github.com/omar-riadd/KubeShop.git)
