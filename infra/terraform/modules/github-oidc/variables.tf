variable "github_owner" {
  description = "GitHub organization or username owning the repository."
  type        = string
}

variable "github_repo" {
  description = "GitHub repository name."
  type        = string
  default     = "kubeshop-platform"
}

variable "apply_environment" {
  description = "Protected GitHub Actions environment allowed to assume the terraform-apply role."
  type        = string
  default     = "aws-prod-apply"
}

variable "state_bucket_arn" {
  description = "ARN of the S3 bucket holding Terraform remote state (for lockfile permissions)."
  type        = string
}

variable "create_oidc_provider" {
  description = "Create the GitHub Actions IAM OIDC provider (set false if one already exists in the account)."
  type        = bool
  default     = true
}

variable "existing_oidc_provider_arn" {
  description = "Existing GitHub Actions OIDC provider ARN when create_oidc_provider is false."
  type        = string
  default     = ""
}

variable "tags" {
  description = "Additional tags applied to GitHub OIDC IAM resources."
  type        = map(string)
  default     = {}
}
