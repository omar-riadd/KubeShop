# Placeholders

Never commit real identifiers, domains, account IDs, or webhook URLs to Git. Replace these placeholders locally or via Terraform variables / GitHub Actions secrets when deploying to a real AWS account.

## Automated Substitution
1. Copy `.env.bootstrap.example` to `.env.bootstrap` (git-ignored) and fill in your values.
2. Preview changes: `scripts/bootstrap-placeholders.sh --dry-run`
3. Apply substitutions: `make bootstrap`
4. Verify no deployment placeholders remain: `make check-placeholders`

| Placeholder | Meaning | Concrete Value in Live Setup | Where Used |
|---|---|---|---|
| `<GH_OWNER>` | GitHub organization or username owning the repository | `omar-riadd` | `CODEOWNERS`, `services/go.mod`, `gitops/apps/base/*.yaml`, `gitops/platform/kyverno/manifests/*.yaml`, `gitops/bootstrap/`, `gitops/apps/applicationset.yaml`, `gitops/platform/applicationset.yaml`, `.github/workflows/*.yml`, `infra/terraform/` |
| `kubeshop-platform` | Repository name placeholder | `KubeShop` (repository: `https://github.com/omar-riadd/KubeShop.git`) | `gitops/bootstrap/`, `gitops/platform/applicationset.yaml`, `gitops/apps/project.yaml`, `gitops/apps/applicationset.yaml`, `infra/terraform/` |
| `<BASE_DOMAIN>` | Route 53 hosted zone base domain (e.g. `example.com` or `lab.internal.`) used for `dev.<BASE_DOMAIN>`, `staging.<BASE_DOMAIN>`, `app.<BASE_DOMAIN>` | `lab.internal.` (Route 53 Hosted Zone `Z00000000000000000000`) | `gitops/apps/envs/*/*.yaml`, `gitops/platform/envoy-gateway/manifests/*.yaml`, `gitops/platform/cert-manager/manifests/*.yaml`, `gitops/platform/external-dns/values.yaml`, `infra/terraform/`, `docs/architecture.md`, `docs/runbooks/bootstrap.md` |
| `<AWS_ACCOUNT_ID>` | 12-digit AWS account ID | `123456789012` | `infra/terraform/`, `gitops/platform/*/values.yaml` (IRSA role ARNs), `docs/runbooks/bootstrap.md`, `docs/runbooks/teardown.md` |
| `<SLACK_WEBHOOK_URL>` | Incoming Slack webhook URL for Alertmanager notifications | Sensitive variable passed into AWS Secrets Manager `kubeshop/platform/slack-webhook` | `infra/terraform/envs/main/`, `docs/runbooks/bootstrap.md` (passed via sensitive variable `slack_webhook_url`, never committed) |

> **Note:** Go module paths forbid `<` and `>` characters, so `services/go.mod` uses `github.com/kubeshop/kubeshop-platform/services` in place of `github.com/<GH_OWNER>/kubeshop-platform/services`.
