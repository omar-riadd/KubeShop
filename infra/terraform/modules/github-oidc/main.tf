resource "aws_iam_openid_connect_provider" "github" {
  count = var.create_oidc_provider ? 1 : 0

  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1", "1c58a3a8518e8759bf075b76b750d4f2df264fcd"]
  tags            = var.tags
}

locals {
  oidc_provider_arn = var.create_oidc_provider ? aws_iam_openid_connect_provider.github[0].arn : var.existing_oidc_provider_arn
}

# ---------------------------------------------------------------------------
# Read-only Terraform Plan role (PRs and manual plan runs)
# ---------------------------------------------------------------------------
data "aws_iam_policy_document" "plan_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [local.oidc_provider_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_owner}/${var.github_repo}:*"]
    }
  }
}

resource "aws_iam_role" "terraform_plan" {
  name               = "kubeshop-terraform-plan"
  assume_role_policy = data.aws_iam_policy_document.plan_assume.json
  tags               = var.tags
}

resource "aws_iam_role_policy_attachment" "terraform_plan_readonly" {
  role       = aws_iam_role.terraform_plan.name
  policy_arn = "arn:aws:iam::aws:policy/ReadOnlyAccess"
}

data "aws_iam_policy_document" "state_lockfile" {
  statement {
    sid    = "TerraformS3Lockfile"
    effect = "Allow"
    actions = [
      "s3:PutObject",
      "s3:DeleteObject",
    ]
    resources = ["${var.state_bucket_arn}/*.tflock"]
  }
}

resource "aws_iam_policy" "state_lockfile" {
  name        = "kubeshop-terraform-plan-lockfile"
  description = "Allows Terraform plan role to acquire/release S3 native lockfiles only."
  policy      = data.aws_iam_policy_document.state_lockfile.json
  tags        = var.tags
}

resource "aws_iam_role_policy_attachment" "terraform_plan_lockfile" {
  role       = aws_iam_role.terraform_plan.name
  policy_arn = aws_iam_policy.state_lockfile.arn
}

# ---------------------------------------------------------------------------
# Terraform Apply role (restricted strictly to the protected GitHub Environment)
# ---------------------------------------------------------------------------
data "aws_iam_policy_document" "apply_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [local.oidc_provider_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_owner}/${var.github_repo}:environment:${var.apply_environment}"]
    }
  }
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

resource "aws_iam_role" "terraform_apply" {
  name               = "kubeshop-terraform-apply"
  assume_role_policy = data.aws_iam_policy_document.apply_assume.json
  tags               = var.tags
}

data "aws_iam_policy_document" "terraform_apply" {
  statement {
    sid    = "TerraformStateS3Bucket"
    effect = "Allow"
    actions = [
      "s3:ListBucket",
      "s3:GetBucketLocation",
    ]
    resources = [var.state_bucket_arn]
  }

  statement {
    sid    = "TerraformStateS3Objects"
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
    ]
    resources = ["${var.state_bucket_arn}/*"]
  }

  statement {
    sid    = "EKSClusterManagement"
    effect = "Allow"
    actions = [
      "eks:*",
    ]
    resources = [
      "arn:aws:eks:${data.aws_region.current.region}:${data.aws_caller_identity.current.account_id}:cluster/${var.cluster_name}*",
      "arn:aws:eks:${data.aws_region.current.region}:${data.aws_caller_identity.current.account_id}:nodegroup/${var.cluster_name}*/*",
      "arn:aws:eks:${data.aws_region.current.region}:${data.aws_caller_identity.current.account_id}:addon/${var.cluster_name}*/*",
      "arn:aws:eks:${data.aws_region.current.region}:${data.aws_caller_identity.current.account_id}:access-entry/${var.cluster_name}*/*",
    ]
  }

  statement {
    sid    = "EKSReadMetadata"
    effect = "Allow"
    actions = [
      "eks:DescribeAddonVersions",
      "eks:DescribeClusterVersions",
      "eks:ListClusters",
    ]
    resources = ["*"]
  }

  statement {
    sid    = "EC2AndAutoScalingDescribe"
    effect = "Allow"
    actions = [
      "ec2:Describe*",
      "autoscaling:Describe*",
    ]
    resources = ["*"]
  }

  statement {
    sid    = "EC2NetworkAndComputeWrite"
    effect = "Allow"
    actions = [
      "ec2:AllocateAddress",
      "ec2:AssociateRouteTable",
      "ec2:AttachInternetGateway",
      "ec2:AuthorizeSecurityGroupEgress",
      "ec2:AuthorizeSecurityGroupIngress",
      "ec2:CreateInternetGateway",
      "ec2:CreateLaunchTemplate",
      "ec2:CreateLaunchTemplateVersion",
      "ec2:CreateNatGateway",
      "ec2:CreateRoute",
      "ec2:CreateRouteTable",
      "ec2:CreateSecurityGroup",
      "ec2:CreateSubnet",
      "ec2:CreateTags",
      "ec2:CreateVpc",
      "ec2:DeleteInternetGateway",
      "ec2:DeleteLaunchTemplate",
      "ec2:DeleteNatGateway",
      "ec2:DeleteRoute",
      "ec2:DeleteRouteTable",
      "ec2:DeleteSecurityGroup",
      "ec2:DeleteSubnet",
      "ec2:DeleteTags",
      "ec2:DeleteVpc",
      "ec2:DetachInternetGateway",
      "ec2:DisassociateRouteTable",
      "ec2:ModifySubnetAttribute",
      "ec2:ModifyVpcAttribute",
      "ec2:ReleaseAddress",
      "ec2:RevokeSecurityGroupEgress",
      "ec2:RevokeSecurityGroupIngress",
      "ec2:RunInstances",
      "autoscaling:CreateOrUpdateTags",
      "autoscaling:UpdateAutoScalingGroup",
    ]
    resources = ["*"]
  }

  statement {
    sid    = "IAMScopedToKubeShop"
    effect = "Allow"
    actions = [
      "iam:AttachRolePolicy",
      "iam:CreatePolicy",
      "iam:CreatePolicyVersion",
      "iam:CreateRole",
      "iam:DeletePolicy",
      "iam:DeletePolicyVersion",
      "iam:DeleteRole",
      "iam:DeleteRolePolicy",
      "iam:DetachRolePolicy",
      "iam:GetPolicy",
      "iam:GetPolicyVersion",
      "iam:GetRole",
      "iam:GetRolePolicy",
      "iam:ListAttachedRolePolicies",
      "iam:ListInstanceProfilesForRole",
      "iam:ListPolicyVersions",
      "iam:ListRolePolicies",
      "iam:PutRolePolicy",
      "iam:TagPolicy",
      "iam:TagRole",
      "iam:UntagPolicy",
      "iam:UntagRole",
      "iam:UpdateAssumeRolePolicy",
    ]
    resources = [
      "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/${var.cluster_name}-*",
      "arn:aws:iam::${data.aws_caller_identity.current.account_id}:policy/${var.cluster_name}-*",
    ]
  }

  statement {
    sid    = "IAMPassRoleScoped"
    effect = "Allow"
    actions = [
      "iam:PassRole",
    ]
    resources = [
      "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/${var.cluster_name}-*",
    ]
    condition {
      test     = "StringEquals"
      variable = "iam:PassedToService"
      values   = ["eks.amazonaws.com", "ec2.amazonaws.com"]
    }
  }

  statement {
    sid    = "IAMOIDCAndServiceLinkedRoles"
    effect = "Allow"
    actions = [
      "iam:CreateOpenIDConnectProvider",
      "iam:DeleteOpenIDConnectProvider",
      "iam:GetOpenIDConnectProvider",
      "iam:TagOpenIDConnectProvider",
      "iam:UpdateOpenIDConnectProviderThumbprint",
      "iam:CreateServiceLinkedRole",
    ]
    resources = [
      "arn:aws:iam::${data.aws_caller_identity.current.account_id}:oidc-provider/*",
      "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/aws-service-role/eks*.amazonaws.com/*",
      "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/aws-service-role/autoscaling.amazonaws.com/*",
    ]
  }

  statement {
    sid    = "SecretsManagerScoped"
    effect = "Allow"
    actions = [
      "secretsmanager:CreateSecret",
      "secretsmanager:DeleteResourcePolicy",
      "secretsmanager:DeleteSecret",
      "secretsmanager:DescribeSecret",
      "secretsmanager:GetResourcePolicy",
      "secretsmanager:GetSecretValue",
      "secretsmanager:PutResourcePolicy",
      "secretsmanager:PutSecretValue",
      "secretsmanager:RestoreSecret",
      "secretsmanager:TagResource",
      "secretsmanager:UntagResource",
      "secretsmanager:UpdateSecret",
    ]
    resources = [
      "arn:aws:secretsmanager:${data.aws_region.current.region}:${data.aws_caller_identity.current.account_id}:secret:${var.cluster_name}/*",
    ]
  }

  statement {
    sid    = "KMSScoped"
    effect = "Allow"
    actions = [
      "kms:CreateAlias",
      "kms:CreateKey",
      "kms:Decrypt",
      "kms:DeleteAlias",
      "kms:DescribeKey",
      "kms:EnableKeyRotation",
      "kms:Encrypt",
      "kms:GenerateDataKey",
      "kms:GenerateDataKeyWithoutPlaintext",
      "kms:GetKeyPolicy",
      "kms:GetKeyRotationStatus",
      "kms:ListAliases",
      "kms:ListResourceTags",
      "kms:PutKeyPolicy",
      "kms:ScheduleKeyDeletion",
      "kms:TagResource",
      "kms:UntagResource",
    ]
    resources = concat(
      var.secrets_kms_key_arn != "" ? [var.secrets_kms_key_arn] : [],
      ["arn:aws:kms:${data.aws_region.current.region}:${data.aws_caller_identity.current.account_id}:key/*"],
      ["arn:aws:kms:${data.aws_region.current.region}:${data.aws_caller_identity.current.account_id}:alias/${var.cluster_name}-*"],
    )
  }

  statement {
    sid    = "CloudWatchLogsScoped"
    effect = "Allow"
    actions = [
      "logs:*",
    ]
    resources = [
      "arn:aws:logs:${data.aws_region.current.region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/eks/${var.cluster_name}*",
    ]
  }

  statement {
    sid    = "CloudWatchAlarms"
    effect = "Allow"
    actions = [
      "cloudwatch:DeleteAlarms",
      "cloudwatch:DescribeAlarms",
      "cloudwatch:PutMetricAlarm",
    ]
    resources = ["*"]
  }

  statement {
    sid    = "BudgetsScoped"
    effect = "Allow"
    actions = [
      "budgets:*",
    ]
    resources = [
      "arn:aws:budgets::${data.aws_caller_identity.current.account_id}:budget/${var.cluster_name}-*",
    ]
  }

  statement {
    sid    = "Route53Scoped"
    effect = "Allow"
    actions = [
      "route53:ChangeResourceRecordSets",
      "route53:GetChange",
      "route53:GetHostedZone",
      "route53:ListResourceRecordSets",
    ]
    resources = [
      var.route53_zone_id != "" ? "arn:aws:route53:::hostedzone/${var.route53_zone_id}" : "arn:aws:route53:::hostedzone/*",
      "arn:aws:route53:::change/*",
    ]
  }

  statement {
    sid    = "ELBAndACM"
    effect = "Allow"
    actions = [
      "elasticloadbalancing:Describe*",
      "acm:DeleteCertificate",
      "acm:DescribeCertificate",
      "acm:ListCertificates",
      "acm:RequestCertificate",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "terraform_apply" {
  name   = "kubeshop-terraform-apply-least-privilege"
  role   = aws_iam_role.terraform_apply.id
  policy = data.aws_iam_policy_document.terraform_apply.json
}
