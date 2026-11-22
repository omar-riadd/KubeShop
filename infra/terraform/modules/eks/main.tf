module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "21.30.2"

  name               = var.cluster_name
  kubernetes_version = var.cluster_version

  vpc_id     = var.vpc_id
  subnet_ids = var.subnet_ids

  endpoint_private_access      = true
  endpoint_public_access       = var.endpoint_public_access
  endpoint_public_access_cidrs = var.endpoint_public_access_cidrs

  # Modern EKS Access Entries only (no aws-auth ConfigMap).
  authentication_mode                      = "API"
  enable_cluster_creator_admin_permissions = true
  access_entries                           = var.access_entries

  enable_irsa = true

  # KMS envelope encryption for Kubernetes Secrets.
  create_kms_key                  = true
  kms_key_enable_default_policy   = true
  kms_key_deletion_window_in_days = 14
  encryption_config = {
    resources = ["secrets"]
  }

  # Limit control-plane logs to api and audit to balance visibility and CloudWatch cost.
  enabled_log_types                      = ["api", "audit"]
  cloudwatch_log_group_retention_in_days = 30

  addons = {
    vpc-cni = {
      before_compute = true
      most_recent    = true
      configuration_values = jsonencode({
        enableNetworkPolicy = "true"
      })
    }
    coredns = {
      most_recent = true
    }
    kube-proxy = {
      most_recent = true
    }
    eks-pod-identity-agent = {
      most_recent = true
    }
    metrics-server = {
      most_recent = true
    }
  }

  eks_managed_node_groups = {
    # Spot pool (4 vCPU / 16 GiB class) for platform addons, dev, and staging.
    spot = {
      name           = "spot"
      capacity_type  = "SPOT"
      instance_types = var.spot_instance_types

      min_size     = 2
      max_size     = 4
      desired_size = 2

      metadata_options = {
        http_endpoint               = "enabled"
        http_tokens                 = "required"
        http_put_response_hop_limit = 1
      }

      block_device_mappings = {
        xvda = {
          device_name = "/dev/xvda"
          ebs = {
            volume_size           = 50
            volume_type           = "gp3"
            encrypted             = true
            delete_on_termination = true
          }
        }
      }

      labels = {
        workload = "general"
      }
    }

    # On-Demand pool dedicated to kubeshop-prod workloads.
    ondemand = {
      name           = "ondemand"
      capacity_type  = "ON_DEMAND"
      instance_types = var.ondemand_instance_types

      min_size     = 1
      max_size     = 2
      desired_size = 1

      metadata_options = {
        http_endpoint               = "enabled"
        http_tokens                 = "required"
        http_put_response_hop_limit = 1
      }

      block_device_mappings = {
        xvda = {
          device_name = "/dev/xvda"
          ebs = {
            volume_size           = 50
            volume_type           = "gp3"
            encrypted             = true
            delete_on_termination = true
          }
        }
      }

      labels = {
        workload = "prod"
      }

      taints = {
        prod = {
          key    = "workload"
          value  = "prod"
          effect = "NO_SCHEDULE"
        }
      }
    }
  }

  tags = var.tags
}
