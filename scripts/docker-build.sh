#!/bin/bash
# Build and push Docker image to Docker Hub

set -e

# Configuration
DOCKER_REPO="${DOCKER_REPO:-luisatpleme/curupira}"
VERSION="${VERSION:-$(node -p "require('./mcp-server/package.json').version")}"

echo "Building Docker image: ${DOCKER_REPO}:${VERSION}"

# Build for multiple platforms
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --tag "${DOCKER_REPO}:${VERSION}" \
  --tag "${DOCKER_REPO}:latest" \
  --push \
  .

echo "Docker image pushed successfully!"
echo ""
echo "To run the image:"
echo "  docker run -p 8080:8080 ${DOCKER_REPO}:${VERSION}"