# Placeholders

Never commit real identifiers, domains, account IDs, or webhook URLs to Git. Replace these placeholders locally or via Terraform variables / GitHub Actions secrets when deploying to a real AWS account.

| Placeholder | Meaning | Where Used |
|---|---|---|
| `<GH_OWNER>` | GitHub organization or username owning the `kubeshop-platform` repository | `CODEOWNERS`, `services/go.mod`, `gitops/apps/base/*.yaml`, `gitops/platform/kyverno/manifests/*.yaml`, `gitops/bootstrap/`, `gitops/apps/applicationset.yaml`, `gitops/platform/applicationset.yaml`, `.github/workflows/*.yml`, `infra/terraform/` |
| `<BASE_DOMAIN>` | Route 53 hosted zone base domain (e.g. `example.com`) used for `dev.<BASE_DOMAIN>`, `staging.<BASE_DOMAIN>`, `app.<BASE_DOMAIN>` | `gitops/apps/envs/*/*.yaml`, `gitops/platform/envoy-gateway/manifests/*.yaml`, `gitops/platform/cert-manager/manifests/*.yaml`, `gitops/platform/external-dns/values.yaml`, `infra/terraform/` |
| `<AWS_ACCOUNT_ID>` | 12-digit AWS account ID | `infra/terraform/`, `gitops/platform/*/values.yaml` (IRSA role ARNs) |
| `<SLACK_WEBHOOK_URL>` | Incoming Slack webhook URL for Alertmanager notifications | `infra/terraform/envs/main/` (passed via sensitive variable `slack_webhook_url` into AWS Secrets Manager `kubeshop/platform/slack-webhook`, never committed) |

> **Note:** Go module paths forbid `<` and `>` characters, so `services/go.mod` uses `github.com/kubeshop/kubeshop-platform/services` in place of `github.com/<GH_OWNER>/kubeshop-platform/services`.

