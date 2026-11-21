variable "environments" {
  description = "Application environments requiring Redis credentials in Secrets Manager."
  type        = set(string)
  default     = ["dev", "staging", "prod"]
}

variable "slack_webhook_url" {
  description = "Incoming Slack webhook URL for Alertmanager notifications (never commit real values)."
  type        = string
  sensitive   = true
  default     = "https://hooks.slack.com/services/PLACEHOLDER/PLACEHOLDER/PLACEHOLDER"
}

variable "recovery_window_in_days" {
  description = "Number of days Secrets Manager waits before permanently deleting a secret."
  type        = number
  default     = 7
}

variable "tags" {
  description = "Additional tags applied to Secrets Manager resources."
  type        = map(string)
  default     = {}
}
