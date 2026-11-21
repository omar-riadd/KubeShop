resource "aws_kms_key" "secrets" {
  description             = "KMS key for KubeShop AWS Secrets Manager entries"
  deletion_window_in_days = 14
  enable_key_rotation     = true
  tags                    = var.tags
}

resource "aws_kms_alias" "secrets" {
  name          = "alias/kubeshop-secrets"
  target_key_id = aws_kms_key.secrets.key_id
}

# ---------------------------------------------------------------------------
# Per-environment Redis passwords: kubeshop/<env>/redis
# ---------------------------------------------------------------------------
resource "random_password" "redis" {
  for_each = var.environments

  length  = 32
  special = false
}

resource "aws_secretsmanager_secret" "redis" {
  for_each = var.environments

  name                    = "kubeshop/${each.key}/redis"
  description             = "Redis password for KubeShop ${each.key} environment."
  kms_key_id              = aws_kms_key.secrets.arn
  recovery_window_in_days = var.recovery_window_in_days
  tags                    = var.tags
}

resource "aws_secretsmanager_secret_version" "redis" {
  for_each = var.environments

  secret_id = aws_secretsmanager_secret.redis[each.key].id
  secret_string = jsonencode({
    password = random_password.redis[each.key].result
  })
}

# ---------------------------------------------------------------------------
# Platform Slack webhook: kubeshop/platform/slack-webhook
# ---------------------------------------------------------------------------
resource "aws_secretsmanager_secret" "slack_webhook" {
  name                    = "kubeshop/platform/slack-webhook"
  description             = "Slack incoming webhook URL for Alertmanager notifications."
  kms_key_id              = aws_kms_key.secrets.arn
  recovery_window_in_days = var.recovery_window_in_days
  tags                    = var.tags
}

resource "aws_secretsmanager_secret_version" "slack_webhook" {
  secret_id = aws_secretsmanager_secret.slack_webhook.id
  secret_string = jsonencode({
    url = var.slack_webhook_url
  })
}

# ---------------------------------------------------------------------------
# Platform Grafana admin credentials: kubeshop/platform/grafana-admin
# ---------------------------------------------------------------------------
resource "random_password" "grafana_admin" {
  length  = 24
  special = false
}

resource "aws_secretsmanager_secret" "grafana_admin" {
  name                    = "kubeshop/platform/grafana-admin"
  description             = "Grafana admin credentials synced via External Secrets Operator."
  kms_key_id              = aws_kms_key.secrets.arn
  recovery_window_in_days = var.recovery_window_in_days
  tags                    = var.tags
}

resource "aws_secretsmanager_secret_version" "grafana_admin" {
  secret_id = aws_secretsmanager_secret.grafana_admin.id
  secret_string = jsonencode({
    admin-user     = "admin"
    admin-password = random_password.grafana_admin.result
  })
}
