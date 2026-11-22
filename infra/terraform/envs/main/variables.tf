variable "aws_region" {
  description = "AWS region where KubeShop infrastructure is provisioned."
  type        = string
  default     = "eu-central-1"
}

variable "cluster_name" {
  description = "Amazon EKS cluster name."
  type        = string
  default     = "kubeshop"
}

variable "cluster_version" {
  description = "Amazon EKS Kubernetes minor version (standard support)."
  type        = string
  default     = "1.35"
}

variable "vpc_cidr" {
  description = "IPv4 CIDR block for the KubeShop VPC."
  type        = string
  default     = "10.0.0.0/16"
}

variable "endpoint_public_access" {
  description = "Expose the EKS Kubernetes API endpoint publicly (keep false or restrict CIDRs in production)."
  type        = bool
  default     = false
}

variable "endpoint_public_access_cidrs" {
  description = "Allowed CIDR blocks for the public EKS API endpoint when enabled."
  type        = list(string)
  default     = []
}

variable "spot_instance_types" {
  description = "EC2 instance types for the general-purpose Spot node group."
  type        = list(string)
  default     = ["t3.xlarge", "t3a.xlarge", "m6i.xlarge", "m5.xlarge"]
}

variable "ondemand_instance_types" {
  description = "EC2 instance types for the prod On-Demand node group."
  type        = list(string)
  default     = ["t3.large"]
}

variable "route53_zone_id" {
  description = "Route 53 hosted zone ID for <BASE_DOMAIN>."
  type        = string
}

variable "github_owner" {
  description = "GitHub organization or username owning the repository (<GH_OWNER>)."
  type        = string
}

variable "github_repo" {
  description = "GitHub repository name hosting the GitOps manifests."
  type        = string
  default     = "kubeshop-platform"
}

variable "gitops_target_revision" {
  description = "Git branch or tag tracked by the Argo CD root application."
  type        = string
  default     = "main"
}

variable "state_bucket_arn" {
  description = "ARN of the bootstrap S3 Terraform state bucket (e.g. arn:aws:s3:::kubeshop-tfstate-<AWS_ACCOUNT_ID>)."
  type        = string
}

variable "create_github_oidc_provider" {
  description = "Create the GitHub Actions OIDC provider (set false if already present in the AWS account)."
  type        = bool
  default     = true
}

variable "existing_github_oidc_provider_arn" {
  description = "Existing GitHub Actions OIDC provider ARN when create_github_oidc_provider is false."
  type        = string
  default     = ""
}

variable "slack_webhook_url" {
  description = "Incoming Slack webhook URL for Alertmanager (stored in AWS Secrets Manager, never committed)."
  type        = string
  sensitive   = true
  default     = "https://hooks.slack.com/services/PLACEHOLDER/PLACEHOLDER/PLACEHOLDER"
}

variable "budget_monthly_limit_usd" {
  description = "Monthly AWS cost budget threshold in USD."
  type        = string
  default     = "150"
}

variable "budget_alert_emails" {
  description = "Email addresses notified at 50%, 80%, and 100% of monthly AWS spend."
  type        = list(string)
}
