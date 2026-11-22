# ---------------------------------------------------------------------------
# Bootstrap workloads installed by Terraform. Everything else is managed
# declaratively by Argo CD from gitops/.
# ---------------------------------------------------------------------------

resource "helm_release" "aws_load_balancer_controller" {
  name       = "aws-load-balancer-controller"
  repository = "https://aws.github.io/eks-charts"
  chart      = "aws-load-balancer-controller"
  version    = "3.6.3"
  namespace  = "kube-system"

  wait          = true
  atomic        = true
  timeout       = 300
  recreate_pods = false

  values = [
    yamlencode({
      clusterName = module.eks.cluster_name
      region      = var.aws_region
      vpcId       = module.network.vpc_id
      serviceAccount = {
        create = true
        name   = "aws-load-balancer-controller"
        annotations = {
          "eks.amazonaws.com/role-arn" = module.iam_irsa.aws_load_balancer_controller_role_arn
        }
      }
      resources = {
        requests = {
          cpu    = "50m"
          memory = "64Mi"
        }
        limits = {
          cpu    = "200m"
          memory = "256Mi"
        }
      }
    })
  ]

  depends_on = [module.eks, module.iam_irsa]
}

resource "helm_release" "argocd" {
  name             = "argocd"
  repository       = "https://argoproj.github.io/argo-helm"
  chart            = "argo-cd"
  version          = "10.18.2"
  namespace        = "argocd"
  create_namespace = true

  wait    = true
  atomic  = true
  timeout = 600

  values = [
    yamlencode({
      configs = {
        cm = {
          "exec.enabled" = "false"
        }
        rbac = {
          "policy.default" = "role:readonly"
        }
        params = {
          # UI is never exposed publicly; access via kubectl port-forward.
          "server.insecure" = true
          # Required for ApplicationSet RollingSync progressive sync waves.
          "applicationsetcontroller.enable.progressive.syncs" = true
        }
      }
      server = {
        service = {
          type = "ClusterIP"
        }
      }
    })
  ]

  depends_on = [module.eks, aws_eks_addon.ebs_csi]
}

data "aws_secretsmanager_secret_version" "github_pat" {
  count     = var.argocd_repo_creds_secret_name != "" ? 1 : 0
  secret_id = var.argocd_repo_creds_secret_name
}

locals {
  argocd_github_pat = (
    var.argocd_repo_creds_secret_name != ""
    ? data.aws_secretsmanager_secret_version.github_pat[0].secret_string
    : var.github_pat
  )
  create_argocd_repo_creds = var.argocd_repo_creds_secret_name != "" || var.github_pat != ""
}

resource "kubernetes_secret_v1" "argocd_repo_creds" {
  count = local.create_argocd_repo_creds ? 1 : 0

  metadata {
    name      = "kubeshop-repo-creds"
    namespace = "argocd"
    labels = {
      "argocd.argoproj.io/secret-type" = "repository"
    }
  }

  data = {
    type     = "git"
    url      = "https://github.com/${var.github_owner}/${var.github_repo}.git"
    username = "git"
    password = local.argocd_github_pat
  }

  depends_on = [helm_release.argocd]
}

resource "helm_release" "argocd_root_app" {
  name       = "argocd-root-app"
  repository = "https://argoproj.github.io/argo-helm"
  chart      = "argocd-apps"
  version    = "2.0.8"
  namespace  = "argocd"

  wait    = true
  atomic  = true
  timeout = 300

  values = [
    yamlencode({
      applications = {
        kubeshop-root = {
          namespace = "argocd"
          project   = "default"
          source = {
            repoURL        = "https://github.com/${var.github_owner}/${var.github_repo}.git"
            targetRevision = var.gitops_target_revision
            path           = "gitops/bootstrap"
          }
          destination = {
            server    = "https://kubernetes.default.svc"
            namespace = "argocd"
          }
          syncPolicy = {
            automated = {
              prune    = true
              selfHeal = true
            }
            syncOptions = [
              "CreateNamespace=true",
              "ServerSideApply=true",
            ]
          }
        }
      }
    })
  ]

  depends_on = [
    helm_release.argocd,
    helm_release.aws_load_balancer_controller,
    kubernetes_secret_v1.argocd_repo_creds,
  ]
}
