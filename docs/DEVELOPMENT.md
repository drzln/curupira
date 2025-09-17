# Curupira Development Guide

## Quick Start

```bash
# 1. Clone the Nexus monorepo
git clone https://github.com/pleme-io/nexus.git
cd nexus/pkgs/services/typescript/curupira

# 2. Install dependencies
npm install

# 3. Start Browserless Chrome service
docker run -d -p 3000:3000 --name browserless browserless/chrome

# 4. Build the project
npm run build

# 5. Start development server
npm run dev
```

## Development Workflow

### 1. Running Services

The project follows Nexus monorepo structure with dependency injection:

- **shared**: Common types, branded types, and utilities
- **mcp-server**: MCP protocol server with DI container
- **cli**: CLI tools for development and debugging
- **integration**: CDP integration utilities

```bash
# Run MCP server in development mode
npm run dev

# Or run with specific configuration
CURUPIRA_CONFIG_PATH=./config/development.yaml npm run dev

# Run tests
npm run test
npm run test:watch
```

### 2. Testing

```bash
# Run all tests
npm run test

# Run specific test suites
npm run test:unit         # Unit tests with DI mocks
npm run test:e2e          # E2E tests with real Chrome
npm run test:watch        # Watch mode
npm run test:coverage     # Generate coverage report
```

### 3. Code Quality

```bash
# Lint code (ESLint)
npm run lint
npm run lint:fix

# Type checking
npm run type-check

# Build all packages
npm run build
```

### 4. Building

```bash
# Build the project
npm run build

# Build and watch for changes
npm run build:watch

# Clean build artifacts
npm run clean
```

## Architecture Overview

### Dependency Injection Architecture

The project follows clean architecture with comprehensive DI:

```
mcp-server/src/
├── main.ts                    # Entry point with DI bootstrap
├── core/                      # Level 0: Foundation
│   ├── di/                    # DI container and tokens
│   ├── interfaces/            # Core interfaces
│   ├── errors/                # Error types
│   └── types/                 # Core types
├── chrome/                    # Level 1: Chrome service layer
│   ├── chrome.service.ts      # Main Chrome service
│   ├── client.ts              # CDP client
│   └── domains/               # CDP domain implementations
├── mcp/                       # Level 2: MCP protocol layer
│   ├── resources/             # Resource providers
│   ├── tools/                 # Tool providers (factory pattern)
│   └── prompts/               # Prompt handlers
├── server/                    # Level 3: Server layer
│   ├── server.ts              # Main server class
│   ├── transport.ts           # Transport manager
│   └── health.ts              # Health checks
└── infrastructure/            # Infrastructure implementations
    ├── container/             # DI container setup
    ├── logger/                # Logger implementation
    └── storage/               # MinIO storage
```

### Configuration System

Following Nexus standards:

```yaml
# config/base.yaml - Base configuration
server:
  port: 8080
  host: localhost

chrome:
  serviceUrl: http://localhost:3000

# config/production.yaml - Environment override
server:
  port: ${SERVER_PORT:8080}

# Environment variables override all
SERVER_PORT=3000 npm run start
```

## Environment Variables

Key environment variables:

```bash
# Server Configuration
SERVER_HOST=0.0.0.0
SERVER_PORT=8080
SERVER_ENVIRONMENT=development

# Chrome Configuration
CHROME_SERVICE_URL=http://localhost:3000
CHROME_DISCOVERY_ENABLED=true

# Logging
LOGGING_LEVEL=debug
LOGGING_PRETTY=true

# Transport
TRANSPORT_WEBSOCKET_ENABLED=true
TRANSPORT_HTTP_ENABLED=true

# Storage (optional)
STORAGE_MINIO_ENABLED=false
```

## Docker Development

```bash
# Build Docker image
docker build -t curupira .

# Run with Docker Compose
docker-compose up -d

# Run standalone with Browserless
docker run -d -p 3000:3000 --name browserless browserless/chrome
docker run -p 8080:8080 \
  -e CHROME_SERVICE_URL=http://host.docker.internal:3000 \
  curupira

# View logs
docker logs curupira
```

## Claude Code Integration

1. **Install Curupira MCP Server**:
   ```bash
   npm install -g curupira
   ```

2. **Configure Claude Desktop**:
   Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:
   ```json
   {
     "mcpServers": {
       "curupira": {
         "command": "node",
         "args": ["/path/to/curupira/mcp-server/dist/main.js"],
         "env": {
           "CHROME_SERVICE_URL": "http://localhost:3000"
         }
       }
     }
   }
   ```

3. **Start Browserless Chrome**:
   ```bash
   docker run -p 3000:3000 browserless/chrome
   ```

## Debugging Tips

### MCP Server

```bash
# Enable debug logging
LOGGING_LEVEL=debug npm run dev

# Use Chrome DevTools for Node.js
node --inspect dist/main.js

# Test MCP connection
npm run test:mcp

# Test Chrome connection
node scripts/test-cdp-connection.ts
```

### Dependency Injection Debugging

```typescript
// Log container registrations
const container = createApplicationContainer();
console.log('Registered services:', container.getRegistrations());

// Test specific service
const chromeService = container.resolve(ChromeServiceToken);
console.log('Chrome connected:', chromeService.isConnected());
```

## Common Issues

### Port Already in Use

```bash
# Find process using port 8080
lsof -i :8080

# Kill process
kill -9 <PID>

# Or use a different port
SERVER_PORT=3001 npm run dev
```

### Chrome Connection Failed

- Ensure Browserless Chrome is running: `docker ps`
- Check Chrome service URL: `CHROME_SERVICE_URL=http://localhost:3000`
- Verify Chrome discovery is enabled
- Check logs: `LOGGING_LEVEL=debug npm run dev`

### Tool Registration Issues

- All tools are registered statically at startup
- Chrome connection is checked when tools execute
- Use `chrome_connect` tool first before other tools

## Deployment

### Staging Deployment

```bash
# Deploy to staging
npm run deploy:staging

# Check deployment status
npm run deploy:check
```

## Contributing

1. Create feature branch
2. Make changes with tests
3. Run quality checks: `npm run quality && npm run test`
4. Submit PR with description

## NPM Scripts Reference

See all available scripts:
```bash
npm run
```

Key script categories:
- **Development**: `dev`, `dev:*`
- **Building**: `build`, `build:*`
- **Testing**: `test`, `test:*`
- **Quality**: `lint`, `format`, `type-check`, `quality`
- **Docker**: `docker:*`
- **Chrome**: `chrome:*`
- **Deployment**: `deploy:*`
- **Utilities**: `clean`, `setup`, `reset`

For detailed script descriptions, check `package.json`.

## Resources

- [MCP Specification](https://modelcontextprotocol.io)
- [Chrome Extension Docs](https://developer.chrome.com/docs/extensions/mv3/)
- [Fastify Documentation](https://www.fastify.io/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Curupira CLAUDE.md](../CLAUDE.md) - Development standards