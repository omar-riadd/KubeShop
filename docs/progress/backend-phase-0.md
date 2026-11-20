# Backend Phase 0 Progress (Milestone M0)

## What was done
- Initialized monorepo structure and baseline files (`README.md`, `CODEOWNERS`, `.editorconfig`, `.gitignore`, `.gitleaks.toml`, `.yamllint.yml`, `.pre-commit-config.yaml`).
- Documented all required environment placeholders in `docs/PLACEHOLDERS.md` (`<GH_OWNER>`, `<BASE_DOMAIN>`, `<AWS_ACCOUNT_ID>`, `<SLACK_WEBHOOK_URL>`).
- Created the Shared Contract v1.0 change log in `docs/CONTRACT-CHANGES.md`.
- Authored `api/openapi.yaml` (OpenAPI 3.1.0) covering all 14 endpoints across Catalog, Cart, Orders, and Version, all required headers (`X-Session-ID`, `X-Request-ID`, `Idempotency-Key`), all schemas (`Product`, `Cart`, `CartItem`, `Order`, `OrderRequest`, `Version`, `Error`, and supporting types), validation constraints, examples, and error codes from §1.6–§1.9.
- Added `api/redocly.yaml` and `.github/workflows/openapi-lint.yml` with pinned action SHAs.

## How to verify
```bash
npx --yes @redocly/cli@1.34.5 lint api/openapi.yaml --config api/redocly.yaml
gitleaks detect --source . --no-git --config .gitleaks.toml --redact
```

## Known gaps / next steps
- Milestone **M0** is reached; ready for Backend Phase 1 (Go services) and UI Phase 1 (React scaffold + OpenAPI typegen).
