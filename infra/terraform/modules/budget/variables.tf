variable "name" {
  description = "Name of the AWS Budget."
  type        = string
  default     = "kubeshop-monthly-cost"
}

variable "monthly_limit_usd" {
  description = "Monthly cost budget threshold in USD."
  type        = string
  default     = "150"
}

variable "alert_emails" {
  description = "List of email addresses notified at 50%, 80%, and 100% of monthly spend."
  type        = list(string)
}

variable "tags" {
  description = "Additional tags applied to the AWS Budget."
  type        = map(string)
  default     = {}
}
