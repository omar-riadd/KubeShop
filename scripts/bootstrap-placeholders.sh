#!/usr/bin/env bash
set -euo pipefail

# Substitute repository deployment placeholders (<GH_OWNER>, <BASE_DOMAIN>, etc.)
# across Kubernetes, GitOps, Terraform, Docker, and runbook files.
#
# Usage:
#   scripts/bootstrap-placeholders.sh              # Substitute placeholders in-place
#   scripts/bootstrap-placeholders.sh --dry-run    # Show files that would be patched
#   scripts/bootstrap-placeholders.sh --check      # Exit 1 if placeholders remain in deploy files

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-${ROOT_DIR}/.env.bootstrap}"

MODE="apply"
for arg in "$@"; do
  case "$arg" in
    --dry-run) MODE="dry-run" ;;
    --check)   MODE="check" ;;
    -h|--help)
      sed -n '3,10p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 2
      ;;
  esac
done

PATTERN='<GH_OWNER>|<BASE_DOMAIN>|<AWS_ACCOUNT_ID>|<AWS_REGION>|<CLUSTER_NAME>|<HOSTED_ZONE_ID>'

# Collect candidate text files while excluding docs/templates that intentionally keep placeholders.
collect_files() {
  local scope="$1"
  local paths=()
  if [[ "$scope" == "deploy" ]]; then
    paths=("CODEOWNERS" "deploy" "gitops" "infra/terraform" "services")
  else
    paths=("CODEOWNERS" "README.md" "deploy" "docs" "gitops" "infra/terraform" "services")
  fi

  local existing=()
  for p in "${paths[@]}"; do
    [[ -e "${ROOT_DIR}/${p}" ]] && existing+=("${ROOT_DIR}/${p}")
  done

  if [[ ${#existing[@]} -eq 0 ]]; then
    return 0
  fi

  find "${existing[@]}" \
    \( -name '.terraform' -o -name 'node_modules' -o -name '.git' \) -prune -o \
    -type f \
    \( -name '*.yaml' -o -name '*.yml' -o -name '*.tf' -o -name '*.json' -o -name '*.md' -o -name 'Dockerfile' -o -name 'CODEOWNERS' \) \
    ! -path "${ROOT_DIR}/docs/PLACEHOLDERS.md" \
    ! -name '*.example' \
    -print | sort
}

if [[ "$MODE" == "check" ]]; then
  remaining=()
  while IFS= read -r f; do
    if grep -qE "$PATTERN" "$f"; then
      remaining+=("${f#"${ROOT_DIR}"/}")
    fi
  done < <(collect_files "deploy")

  if [[ ${#remaining[@]} -gt 0 ]]; then
    echo "Unresolved placeholders found in ${#remaining[@]} deploy file(s):" >&2
    printf '  %s\n' "${remaining[@]}" >&2
    exit 1
  fi
  echo "OK: no unresolved placeholders in deploy files."
  exit 0
fi

# Load .env.bootstrap if present (exported env vars take precedence).
if [[ -f "$ENV_FILE" ]]; then
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    key="${line%%=*}"
    val="${line#*=}"
    key="${key// /}"
    # Strip optional surrounding quotes
    val="${val#\"}"
    val="${val%\"}"
    val="${val#\'}"
    val="${val%\'}"
    if [[ -z "${!key+x}" ]]; then
      export "${key}=${val}"
    fi
  done < "$ENV_FILE"
fi

# Validate required variables
missing=()
for var in GH_OWNER BASE_DOMAIN AWS_ACCOUNT_ID AWS_REGION CLUSTER_NAME HOSTED_ZONE_ID; do
  if [[ -z "${!var:-}" ]]; then
    missing+=("$var")
  fi
done

if [[ ${#missing[@]} -gt 0 ]]; then
  echo "Error: missing required environment variable(s): ${missing[*]}" >&2
  echo "Copy .env.bootstrap.example to .env.bootstrap and fill in values, or export them." >&2
  exit 1
fi

GH_REPO="${GH_REPO:-kubeshop-platform}"

patched=0
while IFS= read -r f; do
  needs_patch=0
  if grep -qE "$PATTERN" "$f"; then
    needs_patch=1
  elif [[ "$GH_REPO" != "kubeshop-platform" ]] && grep -q 'kubeshop-platform\.git' "$f"; then
    needs_patch=1
  fi

  if [[ $needs_patch -eq 0 ]]; then
    continue
  fi

  rel="${f#"${ROOT_DIR}"/}"
  if [[ "$MODE" == "dry-run" ]]; then
    echo "[dry-run] would patch: ${rel}"
    patched=$((patched + 1))
    continue
  fi

  tmp="$(mktemp)"
  sed \
    -e "s|<GH_OWNER>|${GH_OWNER}|g" \
    -e "s|<BASE_DOMAIN>|${BASE_DOMAIN}|g" \
    -e "s|<AWS_ACCOUNT_ID>|${AWS_ACCOUNT_ID}|g" \
    -e "s|<AWS_REGION>|${AWS_REGION}|g" \
    -e "s|<CLUSTER_NAME>|${CLUSTER_NAME}|g" \
    -e "s|<HOSTED_ZONE_ID>|${HOSTED_ZONE_ID}|g" \
    -e "s|kubeshop-platform\.git|${GH_REPO}.git|g" \
    "$f" > "$tmp"
  mv "$tmp" "$f"
  echo "patched: ${rel}"
  patched=$((patched + 1))
done < <(collect_files "all")

if [[ "$MODE" == "dry-run" ]]; then
  echo "Dry run complete: ${patched} file(s) would be patched."
else
  echo "Done: patched ${patched} file(s)."
  echo "Review with 'git diff' before committing, or revert with 'git checkout -- .'."
fi
