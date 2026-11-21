# ---------------------------------------------------------------------------
# AWS Load Balancer Controller (NLB for Envoy Gateway)
# ---------------------------------------------------------------------------
data "aws_iam_policy_document" "aws_lbc" {
  statement {
    sid    = "ServiceLinkedRole"
    effect = "Allow"
    actions = [
      "iam:CreateServiceLinkedRole",
    ]
    resources = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/aws-service-role/elasticloadbalancing.amazonaws.com/AWSServiceRoleForElasticLoadBalancing"]
    condition {
      test     = "StringEquals"
      variable = "iam:AWSServiceName"
      values   = ["elasticloadbalancing.amazonaws.com"]
    }
  }

  statement {
    sid    = "EC2AndELBRead"
    effect = "Allow"
    actions = [
      "ec2:DescribeAccountAttributes",
      "ec2:DescribeAddresses",
      "ec2:DescribeAvailabilityZones",
      "ec2:DescribeInternetGateways",
      "ec2:DescribeVpcs",
      "ec2:DescribeVpcPeeringConnections",
      "ec2:DescribeSubnets",
      "ec2:DescribeSecurityGroups",
      "ec2:DescribeInstances",
      "ec2:DescribeNetworkInterfaces",
      "ec2:DescribeTags",
      "ec2:GetCoipPoolUsage",
      "ec2:DescribeCoipPools",
      "elasticloadbalancing:DescribeLoadBalancers",
      "elasticloadbalancing:DescribeLoadBalancerAttributes",
      "elasticloadbalancing:DescribeListeners",
      "elasticloadbalancing:DescribeListenerAttributes",
      "elasticloadbalancing:DescribeListenerCertificates",
      "elasticloadbalancing:DescribeSSLPolicies",
      "elasticloadbalancing:DescribeRules",
      "elasticloadbalancing:DescribeTargetGroups",
      "elasticloadbalancing:DescribeTargetGroupAttributes",
      "elasticloadbalancing:DescribeTargetHealth",
      "elasticloadbalancing:DescribeTags",
    ]
    resources = ["*"]
  }

  statement {
    sid    = "SecurityGroupAndLBCreate"
    effect = "Allow"
    actions = [
      "ec2:CreateSecurityGroup",
      "ec2:CreateTags",
      "elasticloadbalancing:CreateLoadBalancer",
      "elasticloadbalancing:CreateTargetGroup",
      "elasticloadbalancing:CreateListener",
      "elasticloadbalancing:CreateRule",
    ]
    resources = [
      "arn:aws:ec2:${var.aws_region}:${data.aws_caller_identity.current.account_id}:security-group/*",
      "arn:aws:ec2:${var.aws_region}:${data.aws_caller_identity.current.account_id}:vpc/*",
      "arn:aws:elasticloadbalancing:${var.aws_region}:${data.aws_caller_identity.current.account_id}:loadbalancer/*",
      "arn:aws:elasticloadbalancing:${var.aws_region}:${data.aws_caller_identity.current.account_id}:targetgroup/*",
      "arn:aws:elasticloadbalancing:${var.aws_region}:${data.aws_caller_identity.current.account_id}:listener/*",
      "arn:aws:elasticloadbalancing:${var.aws_region}:${data.aws_caller_identity.current.account_id}:listener-rule/*",
    ]
  }

  statement {
    sid    = "ManagedLBAndSGModify"
    effect = "Allow"
    actions = [
      "ec2:AuthorizeSecurityGroupIngress",
      "ec2:RevokeSecurityGroupIngress",
      "ec2:DeleteSecurityGroup",
      "ec2:DeleteTags",
      "elasticloadbalancing:AddTags",
      "elasticloadbalancing:RemoveTags",
      "elasticloadbalancing:ModifyLoadBalancerAttributes",
      "elasticloadbalancing:SetIpAddressType",
      "elasticloadbalancing:SetSecurityGroups",
      "elasticloadbalancing:SetSubnets",
      "elasticloadbalancing:DeleteLoadBalancer",
      "elasticloadbalancing:ModifyTargetGroup",
      "elasticloadbalancing:ModifyTargetGroupAttributes",
      "elasticloadbalancing:DeleteTargetGroup",
      "elasticloadbalancing:RegisterTargets",
      "elasticloadbalancing:DeregisterTargets",
      "elasticloadbalancing:SetWebAcl",
      "elasticloadbalancing:ModifyListener",
      "elasticloadbalancing:AddListenerCertificates",
      "elasticloadbalancing:RemoveListenerCertificates",
      "elasticloadbalancing:DeleteListener",
      "elasticloadbalancing:ModifyRule",
      "elasticloadbalancing:DeleteRule",
    ]
    resources = [
      "arn:aws:ec2:${var.aws_region}:${data.aws_caller_identity.current.account_id}:security-group/*",
      "arn:aws:elasticloadbalancing:${var.aws_region}:${data.aws_caller_identity.current.account_id}:loadbalancer/*",
      "arn:aws:elasticloadbalancing:${var.aws_region}:${data.aws_caller_identity.current.account_id}:targetgroup/*",
      "arn:aws:elasticloadbalancing:${var.aws_region}:${data.aws_caller_identity.current.account_id}:listener/*",
      "arn:aws:elasticloadbalancing:${var.aws_region}:${data.aws_caller_identity.current.account_id}:listener-rule/*",
    ]
  }
}

resource "aws_iam_policy" "aws_lbc" {
  name        = "kubeshop-aws-load-balancer-controller"
  description = "Least-privilege policy for AWS Load Balancer Controller on KubeShop EKS."
  policy      = data.aws_iam_policy_document.aws_lbc.json
  tags        = var.tags
}

resource "aws_iam_role_policy_attachment" "aws_lbc" {
  role       = aws_iam_role.irsa["aws-load-balancer-controller"].name
  policy_arn = aws_iam_policy.aws_lbc.arn
}

# ---------------------------------------------------------------------------
# ExternalDNS (scoped to the configured Route 53 hosted zone)
# ---------------------------------------------------------------------------
data "aws_iam_policy_document" "external_dns" {
  statement {
    sid    = "Route53ZoneWrite"
    effect = "Allow"
    actions = [
      "route53:ChangeResourceRecordSets",
      "route53:ListResourceRecordSets",
      "route53:ListTagsForResource",
    ]
    resources = ["arn:aws:route53:::hostedzone/${var.route53_zone_id}"]
  }

  statement {
    sid       = "Route53ListZones"
    effect    = "Allow"
    actions   = ["route53:ListHostedZones"]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "external_dns" {
  name        = "kubeshop-external-dns"
  description = "Scoped Route 53 permissions for ExternalDNS."
  policy      = data.aws_iam_policy_document.external_dns.json
  tags        = var.tags
}

resource "aws_iam_role_policy_attachment" "external_dns" {
  role       = aws_iam_role.irsa["external-dns"].name
  policy_arn = aws_iam_policy.external_dns.arn
}

# ---------------------------------------------------------------------------
# cert-manager (Route 53 DNS-01 solver, scoped to the hosted zone)
# ---------------------------------------------------------------------------
data "aws_iam_policy_document" "cert_manager" {
  statement {
    sid       = "Route53GetChange"
    effect    = "Allow"
    actions   = ["route53:GetChange"]
    resources = ["arn:aws:route53:::change/*"]
  }

  statement {
    sid    = "Route53DNS01Challenge"
    effect = "Allow"
    actions = [
      "route53:ChangeResourceRecordSets",
      "route53:ListResourceRecordSets",
    ]
    resources = ["arn:aws:route53:::hostedzone/${var.route53_zone_id}"]
  }

  statement {
    sid       = "Route53ListHostedZonesByName"
    effect    = "Allow"
    actions   = ["route53:ListHostedZonesByName"]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "cert_manager" {
  name        = "kubeshop-cert-manager"
  description = "Scoped Route 53 DNS-01 permissions for cert-manager."
  policy      = data.aws_iam_policy_document.cert_manager.json
  tags        = var.tags
}

resource "aws_iam_role_policy_attachment" "cert_manager" {
  role       = aws_iam_role.irsa["cert-manager"].name
  policy_arn = aws_iam_policy.cert_manager.arn
}

# ---------------------------------------------------------------------------
# External Secrets Operator (read kubeshop/* secrets only)
# ---------------------------------------------------------------------------
data "aws_iam_policy_document" "external_secrets" {
  statement {
    sid    = "SecretsManagerReadKubeshop"
    effect = "Allow"
    actions = [
      "secretsmanager:GetResourcePolicy",
      "secretsmanager:GetSecretValue",
      "secretsmanager:DescribeSecret",
      "secretsmanager:ListSecretVersionIds",
    ]
    resources = [
      "arn:aws:secretsmanager:${var.aws_region}:${data.aws_caller_identity.current.account_id}:secret:kubeshop/*",
    ]
  }

  statement {
    sid       = "KMSDecryptSecrets"
    effect    = "Allow"
    actions   = ["kms:Decrypt"]
    resources = [var.secrets_kms_key_arn]
  }
}

resource "aws_iam_policy" "external_secrets" {
  name        = "kubeshop-external-secrets"
  description = "Read-only access to kubeshop/* secrets in AWS Secrets Manager."
  policy      = data.aws_iam_policy_document.external_secrets.json
  tags        = var.tags
}

resource "aws_iam_role_policy_attachment" "external_secrets" {
  role       = aws_iam_role.irsa["external-secrets"].name
  policy_arn = aws_iam_policy.external_secrets.arn
}
