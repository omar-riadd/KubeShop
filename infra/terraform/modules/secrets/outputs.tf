output "kms_key_arn" {
  description = "ARN of the KMS key encrypting KubeShop secrets."
  value       = aws_kms_key.secrets.arn
}

output "redis_secret_arns" {
  description = "Map of environment name to Redis Secrets Manager ARN."
  value       = { for env, secret in aws_secretsmanager_secret.redis : env => secret.arn }
}

output "slack_webhook_secret_arn" {
  description = "ARN of the Slack webhook secret."
  value       = aws_secretsmanager_secret.slack_webhook.arn
}

output "grafana_admin_secret_arn" {
  description = "ARN of the Grafana admin credentials secret."
  value       = aws_secretsmanager_secret.grafana_admin.arn
}
