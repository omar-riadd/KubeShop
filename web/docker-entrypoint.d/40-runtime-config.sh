#!/bin/sh
set -eu

# Extract runtime environment values
ENV="${APP_ENV:-${ENVIRONMENT:-local}}"
VER="${APP_VERSION:-${VERSION:-dev}}"
SHA="${APP_GIT_SHA:-${GIT_SHA:-local}}"
TIME="${APP_BUILD_TIME:-${BUILD_TIME:-$(date -u +"%Y-%m-%dT%H:%M:%SZ")}}"

cat <<EOF > /tmp/runtime-config.json
{
  "environment": "$ENV",
  "version": "$VER",
  "gitSha": "$SHA",
  "buildTime": "$TIME"
}
EOF

chmod 644 /tmp/runtime-config.json 2>/dev/null || true
echo "[entrypoint] runtime-config.json generated in /tmp"
