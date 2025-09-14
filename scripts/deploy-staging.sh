#!/bin/bash
# Deploy Curupira to staging environment

set -e

echo "🚀 Deploying Curupira to staging..."

# Ensure we're in the right directory
cd "$(dirname "$0")/.."

# Build and tag image
echo "📦 Building Docker image..."
IMAGE_TAG="staging-$(git rev-parse --short HEAD)-$(date +%Y%m%d-%H%M%S)"
docker build -t curupira:$IMAGE_TAG .

# Tag for registry
echo "🏷️  Tagging for registry..."
REGISTRY="registry.plo.quero.local/tools/curupira"
docker tag curupira:$IMAGE_TAG $REGISTRY:$IMAGE_TAG
docker tag curupira:$IMAGE_TAG $REGISTRY:staging

# Push to registry
echo "⬆️  Pushing to registry..."
docker push $REGISTRY:$IMAGE_TAG
docker push $REGISTRY:staging

# Update Kubernetes
echo "☸️  Updating Kubernetes deployment..."
cd k8s/overlays/staging

# Update image tag
cat > kustomization.yaml << EOF
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: novaskyn-staging

resources:
  - ../../base

images:
  - name: curupira
    newName: $REGISTRY
    newTag: $IMAGE_TAG

configMapGenerator:
  - name: curupira-config
    literals:
      - CURUPIRA_ENV=staging
      - CURUPIRA_LOG_LEVEL=info
EOF

# Apply to cluster
echo "🚀 Applying to cluster..."
kubectl apply -k .

# Wait for rollout
echo "⏳ Waiting for rollout..."
kubectl -n novaskyn-staging rollout status deployment/curupira

# Show status
echo "✅ Deployment complete!"
kubectl -n novaskyn-staging get pods -l app=curupira

echo "🔗 WebSocket URL: wss://curupira.novaskyn.staging.plo.quero.local/mcp"