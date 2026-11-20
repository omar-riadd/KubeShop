# Backend Phase 1 Progress (Milestone M1, Part 1)

## What was done
- Implemented shared Go platform package (`services/internal/platform`): env-only config with fail-fast validation, JSON `slog` logger, exact §6.1 middleware chain (recover, `X-Request-ID`, `otelhttp`, access log, Prometheus metrics with chi route patterns, security headers, fault injection exempting `/version`, 16 KiB body limit), `X-Session-ID` UUID v4 validation, strict JSON decoding (`DisallowUnknownFields`), OTLP gRPC tracing, admin server (`/healthz`, `/readyz`, `/metrics`), version endpoint, and graceful shutdown (`SHUTDOWN_DELAY` + 20s timeout).
- Implemented `catalog` service (`services/catalog`): embedded 12-product seed (`seed/products.json`), category/search/pagination/sort, `/version`, and distroless multi-stage Dockerfile.
- Implemented `cart` service (`services/cart`): Redis hash store (`cart:{sessionId}`) with 24h TTL, insertion-order sorting, 1–20 quantity validation, catalog HTTP client (2s timeout, 1 retry with jitter, header/trace forwarding), `cart_items_added_total` metric, and distroless Dockerfile.
- Implemented `orders` service (`services/orders`): embedded SQL migrations (`golang-migrate` via `orders migrate` subcommand), `pgxpool` transactional order creation, `(session_id, idempotency_key)` replay returning `200`, §1.7 field validation, cart HTTP client with best-effort clear, `orders_created_total` and `order_value_cents` metrics, and distroless Dockerfile.
- Added unit tests, `testcontainers-go` Redis & PostgreSQL integration tests, fault injection tests, and OpenAPI 3.1 contract response validation (`services/internal/platform/contracttest`).

## How to verify
```bash
cd services
go vet ./...
golangci-lint run ./...
go build ./...
go test -race -cover ./internal/platform ./catalog/internal ./cart/internal ./orders/internal
```

## Known gaps / next steps
- Proceed to Backend Phase 2 (`docker-compose.yml`, `deploy/compose/gateway.nginx.conf`, `Makefile`) to reach Milestone M1.
