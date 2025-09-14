#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔍 Checking publishing readiness...${NC}\n"

READY=true

# Check npm login
echo -n "Checking npm login... "
if npm whoami &> /dev/null; then
    echo -e "${GREEN}✓${NC} Logged in as $(npm whoami)"
else
    echo -e "${RED}✗${NC} Not logged in"
    READY=false
fi

# Check Docker login
echo -n "Checking Docker... "
if docker info &> /dev/null; then
    echo -e "${GREEN}✓${NC} Docker daemon running"
else
    echo -e "${RED}✗${NC} Docker daemon not running"
    READY=false
fi

# Check if docker buildx is available
echo -n "Checking Docker buildx... "
if docker buildx version &> /dev/null; then
    echo -e "${GREEN}✓${NC} Docker buildx available"
else
    echo -e "${RED}✗${NC} Docker buildx not available"
    echo "  Run: docker buildx create --use"
    READY=false
fi

# Check versions match
echo -n "Checking package versions... "
ROOT_VERSION=$(node -p "require('./package.json').version")
SHARED_VERSION=$(node -p "require('./shared/package.json').version")
MCP_VERSION=$(node -p "require('./mcp-server/package.json').version")
CLI_VERSION=$(node -p "require('./cli/package.json').version")

if [ "$ROOT_VERSION" = "$SHARED_VERSION" ] && [ "$ROOT_VERSION" = "$MCP_VERSION" ] && [ "$ROOT_VERSION" = "$CLI_VERSION" ]; then
    echo -e "${GREEN}✓${NC} All versions match: $ROOT_VERSION"
else
    echo -e "${RED}✗${NC} Version mismatch"
    echo "  Root:       $ROOT_VERSION"
    echo "  Shared:     $SHARED_VERSION"
    echo "  MCP Server: $MCP_VERSION"
    echo "  CLI:        $CLI_VERSION"
    READY=false
fi

# Check if working directory is clean
echo -n "Checking git status... "
if [ -z "$(git status --porcelain)" ]; then
    echo -e "${GREEN}✓${NC} Working directory clean"
else
    echo -e "${YELLOW}⚠${NC} Uncommitted changes"
    git status --short
fi

# Check if builds work
echo -n "Checking build... "
if npm run build &> /dev/null; then
    echo -e "${GREEN}✓${NC} Build successful"
else
    echo -e "${RED}✗${NC} Build failed"
    READY=false
fi

# Summary
echo ""
if [ "$READY" = true ]; then
    echo -e "${GREEN}✅ Ready to publish!${NC}"
    echo -e "\nNext steps:"
    echo -e "  1. ./scripts/version.sh [patch|minor|major]"
    echo -e "  2. git push origin main && git push origin --tags"
    echo -e "  3. ./scripts/publish.sh"
else
    echo -e "${RED}❌ Not ready to publish${NC}"
    echo -e "\nPlease fix the issues above before publishing."
    exit 1
fi