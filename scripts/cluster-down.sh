#!/usr/bin/env bash
set -euo pipefail

# Cleanly tear down Argo CD Applications, LoadBalancers, and StatefulSet PVCs
# in dependency order so `terraform destroy` never hangs or orphans AWS resources.
# Note: Run as your normal user (never with `sudo`, which strips PATH/HOME).

if ! command -v kubectl >/dev/null 2>&1; then
  echo "Error: kubectl not found in PATH (PATH=$PATH)." >&2
  echo "If you ran 'sudo make cluster-down', re-run without sudo: 'make cluster-down'." >&2
  exit 1
fi

if ! kubectl cluster-info >/dev/null 2>&1; then
  echo "Cluster is unreachable or already destroyed; skipping Kubernetes cleanup."
  echo "Proceed with: terraform -chdir=infra/terraform/envs/main destroy"
  exit 0
fi

echo "Step 1: Detaching kubeshop-root (orphan) to prevent self-heal races..."
if kubectl -n argocd get application kubeshop-root >/dev/null 2>&1; then
  kubectl -n argocd patch application kubeshop-root --type json \
    -p '[{"op":"remove","path":"/metadata/finalizers"}]' >/dev/null 2>&1 || true
  kubectl -n argocd delete application kubeshop-root --cascade=orphan --ignore-not-found --timeout=30s || true
fi

echo "Step 2: Deleting workload Applications (apps + env baselines)..."
kubectl -n argocd delete application kubeshop-workloads --ignore-not-found --wait=true --timeout=120s || true
workload_apps=$(kubectl -n argocd get applications -o name 2>/dev/null | grep -E 'application\.argoproj\.io/(baseline|cart|catalog|orders|web)-' || true)
if [[ -n "$workload_apps" ]]; then
  echo "$workload_apps" | xargs -r kubectl -n argocd delete --ignore-not-found --wait=true --timeout=120s || true
fi

echo "Step 3: Deleting platform manifest Applications (Gateway, ClusterIssuer, Policies)..."
manifest_apps=$(kubectl -n argocd get applications -o name 2>/dev/null | grep -E -- '-manifests$' || true)
if [[ -n "$manifest_apps" ]]; then
  echo "$manifest_apps" | xargs -r kubectl -n argocd delete --ignore-not-found --wait=true --timeout=120s || true
fi

echo "Step 4: Waiting for LoadBalancer services to be removed..."
for i in $(seq 1 30); do
  lbs=$(kubectl get svc -A -o jsonpath='{range .items[?(@.spec.type=="LoadBalancer")]}{.metadata.namespace}/{.metadata.name}{"\n"}{end}' 2>/dev/null || true)
  if [[ -z "$lbs" ]]; then
    echo "All LoadBalancers removed."
    break
  fi
  echo "Waiting for LoadBalancers ($i/30): $lbs"
  sleep 10
done

echo "Step 5: Deleting StatefulSet PVCs so EBS volumes clean up before CSI driver removal..."
for ns in kubeshop-dev kubeshop-staging kubeshop-prod monitoring observability; do
  if kubectl get namespace "$ns" >/dev/null 2>&1; then
    kubectl -n "$ns" delete pvc --all --ignore-not-found --timeout=120s || true
  fi
done
for i in $(seq 1 18); do
  pvs=$(kubectl get pv --no-headers 2>/dev/null || true)
  if [[ -z "$pvs" ]]; then
    echo "All PersistentVolumes removed."
    break
  fi
  echo "Waiting for PersistentVolumes ($i/18)..."
  sleep 5
done

echo "Step 6: Deleting platform addon Applications and AppProjects..."
kubectl -n argocd delete application kubeshop-platform-addons --ignore-not-found --wait=true --timeout=120s || true
addon_apps=$(kubectl -n argocd get applications -o name 2>/dev/null | grep -v 'kubeshop-projects' || true)
if [[ -n "$addon_apps" ]]; then
  echo "$addon_apps" | xargs -r kubectl -n argocd delete --ignore-not-found --wait=true --timeout=120s || true
fi
kubectl -n argocd delete application kubeshop-projects --ignore-not-found --wait=true --timeout=60s || true

# Unblock any Applications still stuck terminating on finalizers after operators/CRDs are gone.
remaining_apps=$(kubectl -n argocd get applications -o name 2>/dev/null || true)
if [[ -n "$remaining_apps" ]]; then
  echo "Clearing stuck finalizers on remaining Applications..."
  for app in $remaining_apps; do
    kubectl -n argocd patch "$app" --type json \
      -p '[{"op":"remove","path":"/metadata/finalizers"}]' >/dev/null 2>&1 || true
    kubectl -n argocd delete "$app" --ignore-not-found --timeout=30s >/dev/null 2>&1 || true
  done
fi

echo "Step 7: Run 'terraform -chdir=infra/terraform/envs/main destroy' (without sudo) after verifying no orphaned ELBs/EBS remain."
