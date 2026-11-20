# KubeShop

> Gear for engineers — a cloud-native storefront and platform engineering showcase.

## Overview

KubeShop is a monorepo containing:
- **Backend microservices** (`services/`): Go services for `catalog`, `cart` (Redis), and `orders` (PostgreSQL).
- **Frontend SPA** (`web/`): React 19 + TypeScript storefront with a live `/status` rollout demo page.
- **API contract** (`api/openapi.yaml`): OpenAPI 3.1 single source of truth.
- **Deployment & GitOps** (`deploy/`, `gitops/`): Shared Helm chart, environment baseline chart, Argo CD ApplicationSets, Argo Rollouts, Envoy Gateway, observability, and Kyverno policies.
- **Infrastructure** (`infra/terraform/`): Amazon EKS, VPC, IRSA, Secrets Manager, GitHub OIDC, and AWS Budgets.
- **Load testing** (`tests/load/`): k6 smoke, load, and stress scripts.

## Quickstart (Local)

```bash
make dev-backend   # Start Redis, Postgres, catalog (:8081), cart (:8082), orders (:8083)
make up            # Start full stack including web and gateway on http://localhost:8080
```

See [docs/PLACEHOLDERS.md](docs/PLACEHOLDERS.md) for environment placeholders and [docs/CONTRACT-CHANGES.md](docs/CONTRACT-CHANGES.md) for the shared API contract change log.
