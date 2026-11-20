# Backend Phase 2 Progress (Milestone M1)

## What was done
- Created `docker-compose.yml` with `backend` profile (`redis`, `postgres:17-alpine`, `orders-migrate`, `catalog` on `:8081`, `cart` on `:8082`, `orders` on `:8083`, all Go services with `read_only: true`, admin port `:9090` never published) and `full` profile (adds `web` and unprivileged `gateway` nginx on `:8080`).
- Created `deploy/compose/gateway.nginx.conf` implementing exact §1.4 prefix routing (`/api/catalog`, `/api/cart`, `/api/orders`, `/`) with no path rewriting.
- Created `Makefile` with targets: `dev-backend`, `up`, `down`, `logs`, `test`, `lint`, `openapi-lint`, `load-test`, `tf-plan`, `cluster-down`.

## How to verify
```bash
make dev-backend
curl -fsS http://localhost:8081/api/catalog/products
# Add to cart -> place order -> fetch order -> make down
```

## Known gaps / next steps
- Milestone **M1** is reached! The UI can now be built and integrated against `make dev-backend`.
