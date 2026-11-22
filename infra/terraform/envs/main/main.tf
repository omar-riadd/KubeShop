module "network" {
  source = "../../modules/network"

  name         = "${var.cluster_name}-vpc"
  cluster_name = var.cluster_name
  vpc_cidr     = var.vpc_cidr
}

module "secrets" {
  source = "../../modules/secrets"

  slack_webhook_url = var.slack_webhook_url
}

module "eks" {
  source = "../../modules/eks"

  cluster_name                 = var.cluster_name
  cluster_version              = var.cluster_version
  vpc_id                       = module.network.vpc_id
  subnet_ids                   = module.network.private_subnet_ids
  endpoint_public_access       = var.endpoint_public_access
  endpoint_public_access_cidrs = var.endpoint_public_access_cidrs
  spot_instance_types          = var.spot_instance_types
  ondemand_instance_types      = var.ondemand_instance_types
}

module "iam_irsa" {
  source = "../../modules/iam-irsa"

  aws_region          = var.aws_region
  oidc_provider_arn   = module.eks.oidc_provider_arn
  oidc_provider       = module.eks.oidc_provider
  route53_zone_id     = var.route53_zone_id
  secrets_kms_key_arn = module.secrets.kms_key_arn
}

# Managed separately from module.eks to avoid a circular dependency with module.iam_irsa.
resource "aws_eks_addon" "ebs_csi" {
  cluster_name                = module.eks.cluster_name
  addon_name                  = "aws-ebs-csi-driver"
  service_account_role_arn    = module.iam_irsa.ebs_csi_role_arn
  resolve_conflicts_on_create = "OVERWRITE"
  resolve_conflicts_on_update = "OVERWRITE"
}

module "github_oidc" {
  source = "../../modules/github-oidc"

  github_owner               = var.github_owner
  github_repo                = var.github_repo
  state_bucket_arn           = var.state_bucket_arn
  cluster_name               = var.cluster_name
  route53_zone_id            = var.route53_zone_id
  secrets_kms_key_arn        = module.secrets.kms_key_arn
  create_oidc_provider       = var.create_github_oidc_provider
  existing_oidc_provider_arn = var.existing_github_oidc_provider_arn
}

module "budget" {
  source = "../../modules/budget"

  monthly_limit_usd = var.budget_monthly_limit_usd
  alert_emails      = var.budget_alert_emails
}
