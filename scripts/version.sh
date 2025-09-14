#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the version bump type from argument
BUMP_TYPE=${1:-patch} # default to patch

echo -e "${GREEN}📦 Bumping version (${BUMP_TYPE})...${NC}"

# Bump version in all packages
npm version $BUMP_TYPE --workspaces --no-git-tag-version

# Also bump root package.json
npm version $BUMP_TYPE --no-git-tag-version

# Get new version
VERSION=$(node -p "require('./package.json').version")
echo -e "${YELLOW}✨ New version: $VERSION${NC}"

# Create git commit and tag
git add -A
git commit -m "chore: bump version to $VERSION"
git tag -a "v$VERSION" -m "Release version $VERSION"

echo -e "${GREEN}✅ Version bumped to $VERSION${NC}"
echo -e "${GREEN}📌 Created tag: v$VERSION${NC}"
echo -e "\nNext steps:"
echo -e "  1. git push origin main"
echo -e "  2. git push origin v$VERSION"
echo -e "  3. ./scripts/publish.sh"