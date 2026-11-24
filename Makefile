.PHONY: dev-backend up down logs test lint openapi-lint load-test tf-plan cluster-down bootstrap check-placeholders

COMPOSE := docker compose

dev-backend:
	$(COMPOSE) --profile backend up -d --build
	@echo "Backend ready:"
	@echo "  catalog -> http://localhost:8081"
	@echo "  cart    -> http://localhost:8082"
	@echo "  orders  -> http://localhost:8083"

up:
	@if [ ! -f web/Dockerfile ]; then \
		echo "web/Dockerfile does not exist yet (UI Phase 4). Run 'make dev-backend' for backend-only stack."; \
		exit 1; \
	fi
	$(COMPOSE) --profile full up -d --build
	@echo "Full KubeShop stack ready at http://localhost:8080"

down:
	$(COMPOSE) --profile full --profile backend down -v --remove-orphans

logs:
	$(COMPOSE) --profile full --profile backend logs -f

test:
	cd services && go test -race -cover ./internal/platform ./catalog/internal ./cart/internal ./orders/internal

lint:
	cd services && go vet ./... && golangci-lint run ./...

openapi-lint:
	npx --yes @redocly/cli@1.34.5 lint api/openapi.yaml --config api/redocly.yaml

load-test:
	k6 run tests/load/smoke.js

tf-plan:
	cd infra/terraform/envs/main && terraform fmt -check -recursive && terraform validate && terraform plan

cluster-down:
	@bash scripts/cluster-down.sh

bootstrap:
	@echo "Substituting repository placeholders..."
	@bash scripts/bootstrap-placeholders.sh

check-placeholders:
	@bash scripts/bootstrap-placeholders.sh --check
