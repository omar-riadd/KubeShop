# Backend Phase 8 Progress (Task B-08: Security & Kyverno Policies)

## What was done
- Implemented 7 Kyverno v1.20 native CEL policies (`policies.kyverno.io/v1` `ValidatingPolicy` & `ImageValidatingPolicy`, starting in `Audit` mode and scoped to namespaces labeled `kubeshop.io/env`):
  - `verify-image-signature.yaml` — Cosign keyless signature verification via GitHub Actions OIDC (`refs/heads/main`) + Rekor
  - `require-sbom-attestation.yaml` — CycloneDX SBOM attestation audit (`https://cyclonedx.org/bom`)
  - `require-resources.yaml` — CPU/memory requests & limits required on all containers
  - `disallow-latest-tag.yaml` — Disallows untagged or `:latest` images
  - `restrict-registries.yaml` — Restricts images to `ghcr.io/<GH_OWNER>/kubeshop-*`, `ghcr.io/cloudnative-pg/postgresql`, `docker.io/library/redis`, `docker.io/grafana/k6`
  - `pod-security-hardening.yaml` — Enforces `runAsNonRoot: true`, `readOnlyRootFilesystem: true`, `allowPrivilegeEscalation: false`, `capabilities.drop: ["ALL"]`, `seccompProfile.type: RuntimeDefault|Localhost`
  - `require-labels.yaml` — Requires `app.kubernetes.io/name` and `kubeshop.io/env`
- Wired `kyverno` manifests into `gitops/platform/applicationset.yaml` (`platform-manifests`).
- Built `kyverno test` suite under `gitops/platform/kyverno/tests/` (`kyverno-test.yaml`, `values.yaml`, `resources.yaml`) verifying compliant and non-compliant pods across all 5 deterministic policies.
- Updated `.github/workflows/helm-gitops.yml` to install Kyverno CLI `v1.20.0` (matching cluster chart `3.10.0` / Kyverno `v1.20.0`) and updated `trivy.yaml` to skip `**/kyverno/tests` negative test fixtures.
- Verified NetworkPolicies (default-deny + explicit allow rules in `deploy/charts/app` & `deploy/charts/env-baseline`) and RBAC (dedicated ServiceAccounts with `automountServiceAccountToken: false`).

## How to verify
```bash
kyverno test gitops/platform/kyverno/tests
kubeconform -strict -ignore-missing-schemas -summary gitops/platform/kyverno/manifests/*.yaml
trivy config --severity HIGH,CRITICAL --exit-code 1 gitops/
```

## Known gaps / Deferred
- Live admission enforcement check (switching `Audit` → `Enforce` and testing unsigned image rejection on EKS) is deferred until cluster provisioning.
