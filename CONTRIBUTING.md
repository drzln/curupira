# Contributing to Curupira

Thank you for your interest in contributing to Curupira! We're excited to have you join our community.

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md) to ensure a welcoming environment for all contributors.

## Getting Started

### Prerequisites

- Node.js 20+ LTS
- npm 10+
- Chrome/Chromium browser
- Git

### Development Setup

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/curupira.git
   cd curupira
   ```
3. Add the upstream remote:
   ```bash
   git remote add upstream https://github.com/drzln/curupira.git
   ```
4. Install dependencies and set up the project:
   ```bash
   npm run setup:dev
   ```
5. Start development:
   ```bash
   npm run dev
   ```

## Development Workflow

### Code Style

We use TypeScript, ESLint, and Prettier to maintain code quality:

```bash
# Check code quality
npm run quality

# Fix linting and formatting issues
npm run quality:fix

# Run type checking
npm run type-check
```

### Testing

All code must have comprehensive tests:

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage

# Test MCP endpoints specifically
npm run test:mcp
```

### Commit Guidelines

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `style:` Code style changes (formatting, etc.)
- `refactor:` Code refactoring
- `test:` Test additions or modifications
- `chore:` Maintenance tasks
- `perf:` Performance improvements

Examples:
```
feat: add time travel debugging for React state
fix: resolve WebSocket reconnection issue
docs: update MCP resource documentation
```

## Project Structure

```
curupira/
├── shared/              # Shared types and utilities
│   ├── src/
│   │   ├── types/      # TypeScript type definitions
│   │   ├── protocol/   # MCP protocol implementations
│   │   └── utils/      # Utility functions
│   └── package.json
├── mcp-server/         # MCP protocol server
│   ├── src/
│   │   ├── mcp/       # MCP handlers
│   │   │   ├── resources/  # Resource handlers
│   │   │   ├── tools/      # Tool handlers
│   │   │   └── prompts/    # Prompt templates
│   │   └── server/    # Server implementation
│   └── package.json
├── chrome-extension/   # Browser extension
│   ├── src/
│   │   ├── background/  # Service worker
│   │   ├── content/     # Content scripts
│   │   └── injected/    # Page-injected scripts
│   └── manifest.json
└── docs/              # Documentation
```

## Contributing Guidelines

### Adding New Features

#### MCP Resources

1. Create a new resource file in `mcp-server/src/mcp/resources/`
2. Implement the resource handler following the existing pattern
3. Register the resource in the registry
4. Add comprehensive tests
5. Update documentation

Example:
```typescript
// mcp-server/src/mcp/resources/myresource.ts
export class MyResource implements Resource {
  async list(): Promise<ResourceList> {
    // Implementation
  }
  
  async read(uri: string): Promise<ResourceData> {
    // Implementation
  }
}
```

#### MCP Tools

1. Create a new tool file in `mcp-server/src/mcp/tools/`
2. Implement the tool handler
3. Register the tool in the registry
4. Add tests and documentation

#### Chrome Extension Features

1. Update the relevant script (background, content, or injected)
2. Add message handlers if needed
3. Update `manifest.json` permissions if required
4. Test thoroughly in Chrome

### Pull Request Process

1. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes following our guidelines

3. Ensure all tests pass:
   ```bash
   npm run quality && npm run test
   ```

4. Commit your changes using conventional commits

5. Push to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

6. Create a Pull Request on GitHub

7. Wait for review and address any feedback

### PR Requirements

- [ ] All tests pass
- [ ] Code follows style guidelines
- [ ] Documentation is updated
- [ ] Commit messages follow conventions
- [ ] No console.log statements (use proper logging)
- [ ] No hardcoded values or secrets
- [ ] TypeScript types are properly defined

## Debugging Tips

### Server Debugging

```bash
# Enable debug logging
CURUPIRA_LOG_LEVEL=debug npm run dev:server

# Use Node.js inspector
node --inspect dist/index.js
```

### Extension Debugging

1. Open `chrome://extensions`
2. Click "Service Worker" to inspect background script
3. Use Chrome DevTools on target page for content script

### WebSocket Debugging

```bash
# Test with wscat
npm install -g wscat
wscat -c ws://localhost:8080/mcp

# Send test message
{"jsonrpc":"2.0","id":1,"method":"resources/list"}
```

## Documentation

- Update README.md for user-facing changes
- Update technical docs in `docs/` for architectural changes
- Add JSDoc comments to all public APIs
- Include usage examples in documentation

## Release Process

1. Ensure all tests pass on main branch
2. Update version in package.json files
3. Update CHANGELOG.md
4. Create a release PR
5. After merge, tag the release
6. Publish to npm and Docker Hub

## Getting Help

- 📖 Read the [documentation](docs/)
- 💬 Join our [Discord](https://discord.gg/curupira)
- 🐛 Report bugs in [GitHub Issues](https://github.com/drzln/curupira/issues)
- 💡 Discuss ideas in [GitHub Discussions](https://github.com/drzln/curupira/discussions)

## Recognition

Contributors will be recognized in:
- The project README
- Release notes
- Our website

Thank you for contributing to Curupira! 🦶