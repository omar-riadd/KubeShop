output "state_bucket_name" {
  description = "Name of the S3 bucket storing Terraform remote state."
  value       = aws_s3_bucket.tfstate.bucket
}

output "state_bucket_arn" {
  description = "ARN of the S3 bucket storing Terraform remote state."
  value       = aws_s3_bucket.tfstate.arn
}

output "kms_key_arn" {
  description = "ARN of the KMS key encrypting Terraform remote state."
  value       = aws_kms_key.tfstate.arn
}

output "aws_account_id" {
  description = "AWS account ID where the state bucket was created."
  value       = data.aws_caller_identity.current.account_id
}
