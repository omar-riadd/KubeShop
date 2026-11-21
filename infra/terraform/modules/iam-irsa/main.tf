data "aws_caller_identity" "current" {}

locals {
  irsa_roles = {
    aws-load-balancer-controller = {
      namespace       = "kube-system"
      service_account = "aws-load-balancer-controller"
    }
    external-dns = {
      namespace       = "external-dns"
      service_account = "external-dns"
    }
    cert-manager = {
      namespace       = "cert-manager"
      service_account = "cert-manager"
    }
    external-secrets = {
      namespace       = "external-secrets"
      service_account = "external-secrets"
    }
    ebs-csi = {
      namespace       = "kube-system"
      service_account = "ebs-csi-controller-sa"
    }
  }
}

data "aws_iam_policy_document" "irsa_assume_role" {
  for_each = local.irsa_roles

  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [var.oidc_provider_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "${var.oidc_provider}:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "${var.oidc_provider}:sub"
      values   = ["system:serviceaccount:${each.value.namespace}:${each.value.service_account}"]
    }
  }
}

resource "aws_iam_role" "irsa" {
  for_each = local.irsa_roles

  name               = "kubeshop-${each.key}"
  assume_role_policy = data.aws_iam_policy_document.irsa_assume_role[each.key].json
  tags               = var.tags
}

resource "aws_iam_role_policy_attachment" "ebs_csi" {
  role       = aws_iam_role.irsa["ebs-csi"].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEBSCSIDriverPolicy"
}
