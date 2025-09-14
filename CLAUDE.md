# Curupira Development Guide for Claude

This guide outlines the systematic approach to developing Curupira - the MCP debugging tool for React applications.

## Core Development Principles

### 1. TypeScript-First Development
- **Type Safety**: All code must be strongly typed with TypeScript
- **No `any`**: Use `unknown` and proper type guards instead
- **Branded Types**: Use branded types for IDs and domain concepts
- **Strict Mode**: TypeScript strict mode is always enabled

### 2. Modular Architecture
- **Maximum file size**: 500 lines per file (300 for components)
- **Single responsibility**: Each module has one clear purpose
- **Feature folders**: Organize by feature, not file type
- **Clean dependencies**: No circular dependencies allowed

### 3. Test-Driven Development
- **Test first**: Write tests before implementation
- **Coverage target**: >80% for all code
- **Test types**: Unit, integration, and E2E tests
- **Mock strategically**: Use MSW for network mocking

### 4. NPM Scripts Standard
- **IMPORTANT**: All tasks must use `npm run` commands
- **No Makefiles**: Package.json scripts are the single source of truth
- **Descriptive names**: Scripts should be self-documenting
- **Grouped by purpose**: Use comment separators in scripts

## Development Workflow

### Initial Setup
```bash
# Clone and setup
git clone <repo>
cd curupira
npm run setup:dev  # Installs everything and sets up dev environment
```

### Daily Development
```bash
# Start development servers
npm run dev

# Run tests in watch mode
npm run test:watch

# Check code quality
npm run quality

# Fix code issues
npm run quality:fix
```

### Before Committing
```bash
# Run all checks
npm run lint:check
npm run format:check
npm run type-check
npm run test

# Or use the combined command
npm run quality && npm run test
```

## Architecture Patterns

### 1. Three-Component Architecture
```
curupira/
├── shared/           # Shared types and utilities
├── mcp-server/       # MCP protocol server
└── chrome-extension/ # Browser extension
```

### 2. Message Flow
```
Page Context → Content Script → Background Script → MCP Server
                                                   ↓
AI Assistant ← MCP Protocol ← WebSocket ← Response
```

### 3. State Management
- **Server State**: Managed by MCP server
- **Extension State**: Chrome storage API
- **Page State**: Read-only access via injected scripts

## MCP Implementation Guidelines

### Resources
Resources are data providers that expose browser state:
```typescript
// Pattern for resource handlers
server.setRequestHandler('resources/list', async (request) => {
  // List available resources
})

server.setRequestHandler('resources/read', async (request) => {
  // Return resource data
})
```

### Tools
Tools are actions that can modify browser state:
```typescript
// Pattern for tool handlers
server.setRequestHandler('tools/list', async (request) => {
  // List available tools
})

server.setRequestHandler('tools/call', async (request) => {
  // Execute tool action
})
```

### Prompts
Prompts are templates for common debugging scenarios:
```typescript
// Pattern for prompt handlers
server.setRequestHandler('prompts/list', async (request) => {
  // List available prompts
})

server.setRequestHandler('prompts/get', async (request) => {
  // Return prompt template
})
```

## Chrome Extension Guidelines

### Content Script Rules
1. **Minimal footprint**: Don't pollute the page
2. **Message passing**: Use structured messages
3. **Error boundaries**: Wrap all operations in try-catch
4. **Performance**: Debounce/throttle expensive operations

### Background Script Rules
1. **Single connection**: One WebSocket to MCP server
2. **Message routing**: Route messages to correct tabs
3. **State persistence**: Use Chrome storage API
4. **Reconnection**: Automatic reconnect with backoff

## Security Requirements

### Data Sanitization
- **ALWAYS** sanitize sensitive data before logging
- **NEVER** send passwords, tokens, or PII to MCP
- **USE** the sanitization utilities in shared/utils

### Connection Security
- **Development**: localhost only, no auth
- **Staging**: HTTPS/WSS with JWT auth
- **Production**: Full auth + rate limiting

## Testing Strategy

### Unit Tests
```bash
npm run test:unit  # Fast, isolated tests
```

### Integration Tests
```bash
npm run test:integration  # Test component interactions
```

### E2E Tests
```bash
# Manual testing with Chrome
npm run chrome:dev
```

## Deployment

### Local Development
```bash
npm run dev              # Start all services
npm run dev:docker       # Use Docker instead
```

### Staging Deployment
```bash
npm run deploy:staging   # Build and deploy to k8s
npm run deploy:check     # Verify deployment
```

## Common NPM Scripts

### Development
- `npm run dev` - Start all development servers
- `npm run dev:server` - Start only MCP server
- `npm run dev:extension` - Build extension in watch mode

### Building
- `npm run build` - Build all packages
- `npm run build:docker` - Build Docker image
- `npm run build:staging` - Build for staging environment

### Testing
- `npm run test` - Run all tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate coverage report
- `npm run test:mcp` - Test MCP endpoints

### Code Quality
- `npm run lint` - Lint and fix issues
- `npm run format` - Format with Prettier
- `npm run type-check` - Check TypeScript types
- `npm run quality` - Run all checks
- `npm run quality:fix` - Fix all issues

### Docker
- `npm run docker:run` - Start with Docker Compose
- `npm run docker:logs` - View container logs
- `npm run docker:shell` - Shell into container

## Performance Guidelines

### Resource Limits
- **Console logs**: Circular buffer of 1000 entries
- **Network requests**: Circular buffer of 500 entries
- **Message size**: Max 1MB per WebSocket message
- **Memory usage**: Target <100MB baseline

### Optimization Strategies
1. **Debounce**: User input and state changes
2. **Throttle**: Network request logging
3. **Batch**: Multiple operations into single message
4. **Lazy load**: Extension features on demand

## Error Handling

### Graceful Degradation
```typescript
try {
  // Primary operation
} catch (error) {
  logger.error({ error }, 'Operation failed')
  // Fallback behavior
}
```

### User Feedback
- Log errors to console with context
- Show badge status in extension icon
- Provide clear error messages in MCP responses

## Documentation

### Code Documentation
- **TSDoc**: All public APIs must be documented
- **Examples**: Include usage examples in comments
- **Types**: Let TypeScript be the documentation

### User Documentation
- Keep README.md updated
- Document new MCP resources/tools
- Add integration examples

## Debugging Curupira Itself

### Server Debugging
```bash
# Enable debug logging
CURUPIRA_LOG_LEVEL=debug npm run dev:server

# Use Node.js inspector
node --inspect dist/index.js
```

### Extension Debugging
1. Open `chrome://extensions`
2. Click "Service Worker" to inspect background
3. Use Chrome DevTools on target page for content script

### MCP Protocol Debugging
```bash
# Test with wscat
npm install -g wscat
wscat -c ws://localhost:8080/mcp

# Send test message
{"jsonrpc":"2.0","id":1,"method":"resources/list"}
```

## Best Practices Summary

1. **Always use npm scripts** - No make, no custom scripts
2. **Type everything** - No implicit any
3. **Test everything** - TDD is the way
4. **Small files** - Max 500 lines
5. **Clean commits** - Conventional commits
6. **Document as you go** - Don't leave it for later
7. **Security first** - Sanitize all data
8. **Performance matters** - Profile and optimize

Remember: Curupira helps developers trace backwards through problems, just like its mythological namesake. Make the debugging experience magical! 🦶