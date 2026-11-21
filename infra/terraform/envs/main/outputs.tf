output "cluster_name" {
  description = "Amazon EKS cluster name."
  value       = module.eks.cluster_name
}

output "aws_region" {
  description = "AWS region where the cluster is deployed."
  value       = var.aws_region
}

output "cluster_endpoint" {
  description = "Amazon EKS API server endpoint."
  value       = module.eks.cluster_endpoint
}

output "vpc_id" {
  description = "VPC ID created for KubeShop."
  value       = module.network.vpc_id
}

output "irsa_role_arns" {
  description = "Map of IRSA role ARNs for cluster addons."
  value = {
    aws_load_balancer_controller = module.iam_irsa.aws_load_balancer_controller_role_arn
    external_dns                 = module.iam_irsa.external_dns_role_arn
    cert_manager                 = module.iam_irsa.cert_manager_role_arn
    external_secrets             = module.iam_irsa.external_secrets_role_arn
    ebs_csi                      = module.iam_irsa.ebs_csi_role_arn
  }
}

output "github_oidc_role_arns" {
  description = "IAM role ARNs for GitHub Actions Terraform workflows."
  value = {
    terraform_plan  = module.github_oidc.terraform_plan_role_arn
    terraform_apply = module.github_oidc.terraform_apply_role_arn
  }
}

output "secrets_manager_arns" {
  description = "ARNs of AWS Secrets Manager secrets provisioned for KubeShop."
  value = {
    redis         = module.secrets.redis_secret_arns
    slack_webhook = module.secrets.slack_webhook_secret_arn
    grafana_admin = module.secrets.grafana_admin_secret_arn
  }
}
