output "oidc_provider_arn" {
  description = "ARN of the GitHub Actions IAM OIDC provider."
  value       = local.oidc_provider_arn
}

output "terraform_plan_role_arn" {
  description = "IAM role ARN for read-only Terraform plan runs in GitHub Actions."
  value       = aws_iam_role.terraform_plan.arn
}

output "terraform_apply_role_arn" {
  description = "IAM role ARN for protected Terraform apply runs in GitHub Actions."
  value       = aws_iam_role.terraform_apply.arn
}
