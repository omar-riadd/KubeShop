variable "aws_region" {
  description = "AWS region for scoping Secrets Manager ARNs."
  type        = string
}

variable "oidc_provider_arn" {
  description = "ARN of the EKS IAM OIDC provider."
  type        = string
}

variable "oidc_provider" {
  description = "EKS OIDC provider URL without the https:// prefix."
  type        = string
}

variable "route53_zone_id" {
  description = "Route 53 hosted zone ID for <BASE_DOMAIN> used by external-dns and cert-manager."
  type        = string
}

variable "secrets_kms_key_arn" {
  description = "ARN of the KMS key encrypting KubeShop secrets in AWS Secrets Manager."
  type        = string
}

variable "tags" {
  description = "Additional tags applied to IAM resources."
  type        = map(string)
  default     = {}
}
