terraform {
  required_version = ">= 1.11.0"

  backend "s3" {
    # Configure bucket/region via -backend-config or backend.hcl (never commit real account IDs).
    bucket       = "kubeshop-tfstate-<AWS_ACCOUNT_ID>"
    key          = "envs/main/terraform.tfstate"
    region       = "eu-central-1"
    encrypt      = true
    use_lockfile = true
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.73.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 3.3.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 3.5.0"
    }
  }
}
