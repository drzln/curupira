#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Publishing Curupira packages...${NC}"

# Check if we're logged in to npm
if ! npm whoami &> /dev/null; then
    echo -e "${RED}❌ Error: Not logged in to npm${NC}"
    echo "Please run 'npm login' first"
    exit 1
fi

# Check if we're logged in to Docker
if ! docker info &> /dev/null; then
    echo -e "${RED}❌ Error: Docker daemon not running${NC}"
    exit 1
fi

# Get current version
VERSION=$(node -p "require('./package.json').version")
echo -e "${YELLOW}📦 Version: $VERSION${NC}"

# Build everything
echo -e "\n${GREEN}🔨 Building packages...${NC}"
npm run build:clean

# Run tests
echo -e "\n${GREEN}🧪 Running tests...${NC}"
npm test

# Publish to npm
echo -e "\n${GREEN}📤 Publishing to npm...${NC}"
npm publish --workspaces --access public

# Build and push Docker image
echo -e "\n${GREEN}🐳 Building and pushing Docker image...${NC}"
docker buildx create --use --name curupira-builder || true
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t drzln/curupira:latest \
  -t drzln/curupira:$VERSION \
  --push .

echo -e "\n${GREEN}✅ Successfully published:${NC}"
echo -e "  - npm packages: curupira, @curupira/mcp-server, @curupira/shared"
echo -e "  - Docker image: drzln/curupira:latest, drzln/curupira:$VERSION"
echo -e "\n${GREEN}🎉 Done!${NC}"