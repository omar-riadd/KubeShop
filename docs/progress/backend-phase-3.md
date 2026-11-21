# Backend Phase 3 Progress (Task B-03: CI Pipelines & Automated Supply Chain)

## What was done
- Implemented reusable workflow `.github/workflows/_publish-image.yml` with:
  - Docker Buildx multi-arch build (`linux/amd64`) with `GIT_SHA` and `BUILD_TIME` build-args
  - Trivy container security vulnerability scanner (`HIGH,CRITICAL` threshold)
  - CycloneDX SBOM generation via Syft
  - GitHub Container Registry (`ghcr.io`) image publishing
  - Cosign keyless image signing via GitHub Actions OIDC against Sigstore Rekor
  - Cosign SBOM attestation
  - SLSA provenance attestation via `actions/attest-build-provenance`
  - Automated GitOps dev promotion PR using GitHub App bot installation token (`actions/create-github-app-token`)
- Implemented core CI workflows:
  - `.github/workflows/ci-services.yml` — Go vet, golangci-lint, go test with race detector, integration tests, contract tests
  - `.github/workflows/security.yml` — Gitleaks secret scanner, Semgrep static analysis, Trivy config misconfiguration scanner
  - `.github/workflows/helm-gitops.yml` — Helm lint, kubeconform schema validation, and Kyverno policy tests
  - `.github/workflows/terraform.yml` — Terraform fmt, validate, TFLint, Trivy config scan, read-only OIDC plan, and protected environment apply
  - `.github/workflows/promote.yml` — Manual workflow dispatch promoting image tags between `dev` -> `staging` -> `prod` via automated PRs
  - `.github/workflows/openapi-lint.yml` — OpenAPI 3.1 linting via Redocly CLI
- Configured automated dependency updates via `renovate.json` with commit SHA pinning.
- Documented complete setup procedures in `docs/runbooks/repo-setup.md`.

## How to verify
- Run local lint and contract checks:
  ```bash
  make lint
  make test
  make openapi-lint
  ```
- Workflow syntax and structure validated via GitHub Actions schema.
