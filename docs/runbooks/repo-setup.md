# Repository Setup Runbook

This runbook documents the GitHub repository settings, secrets, variables, and GitHub App configuration required for KubeShop CI/CD and GitOps automation.

## 1. Branch Protection (`main`)

Under **Settings → Branches → Branch protection rules** for `main`:

- **Require a pull request before merging**
  - Required approvals: `1`
  - Dismiss stale pull request approvals when new commits are pushed: **Enabled**
  - Require review from Code Owners (`CODEOWNERS`): **Enabled** (enforces owner approval on `gitops/apps/envs/prod/**`, `infra/**`, and `.github/workflows/**`)
- **Require status checks to pass before merging**
  - Require branches to be up to date before merging: **Enabled**
  - Required checks (as applicable to changed paths):
    - `Lint api/openapi.yaml`
    - `Secret Scan (Gitleaks)`
    - `IaC & Config Misconfiguration Scan (Trivy)`
    - `Helm Lint, Kubeconform & Kyverno Tests`
    - `Format, Validate, TFLint & Trivy`
- **Require linear history**: **Enabled** (squash or rebase merges only)
- **Allow auto-merge**: **Enabled** (in repository General settings; used for automated `dev` GitOps PRs)
- **Do not allow bypassing the above settings**: **Enabled** (never allow the GitOps bot to bypass branch protection for `staging` or `prod`)

## 2. GitHub App for GitOps Bot PRs (Required Checks Gotcha)

Pull requests opened with the default `GITHUB_TOKEN` do **not** trigger other GitHub Actions workflows, which leaves required status checks pending and blocks auto-merge.

To allow `_publish-image.yml` (dev bumps) and `promote.yml` (staging/prod promotion PRs) to trigger required checks:

1. Create a private GitHub App (e.g., `kubeshop-gitops-bot`) under your GitHub account or org:
   - **Repository permissions:**
     - `Contents`: Read and write
     - `Pull requests`: Read and write
   - **Webhook:** Disabled (not needed)
2. Install the app on `<GH_OWNER>/kubeshop-platform` only.
3. Generate a private key (`.pem`) and record the **App ID**.
4. Configure repository secrets and variables under **Settings → Secrets and variables → Actions**:
   - **Secret** `GITOPS_BOT_APP_ID`: the numeric App ID
   - **Secret** `GITOPS_BOT_PRIVATE_KEY`: the full PEM private key contents
   - **Variable** `GITOPS_BOT_ENABLED`: `true`

> Fallback: if you prefer not to create a GitHub App, you may substitute a fine-grained PAT scoped solely to `Contents: write` and `Pull requests: write` on this repo, though a GitHub App installation token is strongly preferred because it is short-lived and not tied to a personal account.

## 3. AWS OIDC & Protected Environment for Terraform

1. After applying `infra/terraform/bootstrap` (or creating the IAM OIDC provider for `token.actions.githubusercontent.com`), set the following **Repository Variables**:
   - `AWS_REGION`: e.g. `eu-central-1`
   - `AWS_TERRAFORM_PLAN_ROLE_ARN`: ARN of the read-only plan role
   - `AWS_TERRAFORM_APPLY_ROLE_ARN`: ARN of the apply role (restricted to `environment:aws-prod-apply`)
2. Under **Settings → Environments**, create an environment named **`aws-prod-apply`**:
   - **Required reviewers:** add repository maintainer(s)
   - **Deployment branches:** `main` only

## 4. Security & Dependency Automation

Under **Settings → Code security**:

- **Secret scanning:** Enabled
- **Push protection:** Enabled
- **Dependabot alerts:** Enabled
- **Renovate:** Install the Renovate GitHub App on this repository; it reads [`renovate.json`](../../renovate.json) automatically.

## 5. GHCR Package Visibility & Cosign Verification

Published images live at `ghcr.io/<GH_OWNER>/kubeshop-{catalog,cart,orders,web}:sha-<7>`.

To verify a published image signature locally:

```bash
cosign verify \
  --certificate-oidc-issuer "https://token.actions.githubusercontent.com" \
  --certificate-identity-regexp "^https://github\.com/<GH_OWNER>/kubeshop-platform/\.github/workflows/_publish-image\.yml@refs/heads/main$" \
  "ghcr.io/<GH_OWNER>/kubeshop-catalog:sha-<7>"
```
