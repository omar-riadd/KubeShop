variable "aws_region" {
  description = "AWS region for the Terraform remote state bucket."
  type        = string
  default     = "eu-central-1"
}

variable "state_bucket_name" {
  description = "Globally unique S3 bucket name for Terraform state (e.g. kubeshop-tfstate-<AWS_ACCOUNT_ID>)."
  type        = string
}

variable "kms_deletion_window_in_days" {
  description = "Waiting period, specified in number of days, before KMS deletes the state bucket key."
  type        = number
  default     = 14
}
