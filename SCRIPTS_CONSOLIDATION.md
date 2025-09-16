# Curupira NPM Scripts Consolidation

## Summary of Changes

### 1. **Removed Redundant Scripts**
- Removed duplicate docker commands that did the same thing
- Removed unnecessary aliases and wrapper scripts
- Consolidated related test scripts

### 2. **Simplified Release Process**
- `docker:release` is now the primary release command (defaults to patch)
- `docker:release:minor` and `docker:release:major` for other version bumps
- All release commands now:
  1. Sync versions across all packages
  2. Bump the version
  3. Build the project
  4. Push to Docker Hub with both latest and version tags

### 3. **Version Synchronization**
- Added `version:sync` command that updates all workspace packages to match root version
- All packages now have version `1.1.11`
- Version sync is automatically run before releases

### 4. **Organized Script Categories**
- **Development**: Basic dev commands
- **Building**: Build commands
- **Release & Deployment**: Docker release and deployment
- **Version Management**: Version bumping and syncing
- **Testing**: Test commands
- **Code Quality**: Linting and formatting
- **Setup & Installation**: Installation and setup
- **Local Docker**: Local Docker development
- **Deployment**: Staging deployment

### 5. **Key Commands**

#### Release a new version:
```bash
# Patch release (1.1.11 -> 1.1.12)
npm run docker:release

# Minor release (1.1.11 -> 1.2.0)
npm run docker:release:minor

# Major release (1.1.11 -> 2.0.0)
npm run docker:release:major
```

#### Development:
```bash
npm run dev          # Run all services in dev mode
npm run build        # Build all packages
npm run test         # Run all tests
npm run quality      # Check code quality
```

#### Version Management:
```bash
npm run version:sync  # Sync all workspace versions to root
```

### 6. **Removed Scripts**
- `release`, `release:patch`, `release:minor`, `release:major` (redundant with docker:release)
- `docker:push:both`, `docker:push:both:bump` (integrated into docker:release)
- `docker:push:latest`, `docker:push:version`, `docker:build:version` (consolidated)
- `version:bump:*:all` commands (replaced with sync then bump)
- Individual build commands for workspaces (use main build)
- Chrome extension specific commands
- Utility commands that weren't essential
- Redundant docker operations
- Test commands for individual tools
- Publishing commands (can be added back if needed)

### 7. **Workspace Versions**
All workspace packages are now at version `1.1.11`:
- curupira (root)
- curupira-mcp-server
- @curupira/shared
- @curupira/cli
- @curupira/auth
- @curupira/integration
- @curupira/e2e-tests
- @curupira/mcp