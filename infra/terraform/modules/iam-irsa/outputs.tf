output "aws_load_balancer_controller_role_arn" {
  description = "IRSA role ARN for AWS Load Balancer Controller."
  value       = aws_iam_role.irsa["aws-load-balancer-controller"].arn
}

output "external_dns_role_arn" {
  description = "IRSA role ARN for ExternalDNS."
  value       = aws_iam_role.irsa["external-dns"].arn
}

output "cert_manager_role_arn" {
  description = "IRSA role ARN for cert-manager."
  value       = aws_iam_role.irsa["cert-manager"].arn
}

output "external_secrets_role_arn" {
  description = "IRSA role ARN for External Secrets Operator."
  value       = aws_iam_role.irsa["external-secrets"].arn
}

output "ebs_csi_role_arn" {
  description = "IRSA role ARN for AWS EBS CSI Driver."
  value       = aws_iam_role.irsa["ebs-csi"].arn
}
