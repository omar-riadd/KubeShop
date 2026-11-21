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

resource "aws_iam_role" "terraform_apply" {
  name               = "kubeshop-terraform-apply"
  assume_role_policy = data.aws_iam_policy_document.apply_assume.json
  tags               = var.tags
}

resource "aws_iam_role_policy_attachment" "terraform_apply_poweruser" {
  role       = aws_iam_role.terraform_apply.name
  policy_arn = "arn:aws:iam::aws:policy/PowerUserAccess"
}

resource "aws_iam_role_policy_attachment" "terraform_apply_iam" {
  role       = aws_iam_role.terraform_apply.name
  policy_arn = "arn:aws:iam::aws:policy/IAMFullAccess"
}
