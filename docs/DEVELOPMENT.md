# Curupira Development Guide

## Quick Start

```bash
# 1. Clone the repository
git clone <repo-url>
cd curupira

# 2. Setup development environment
npm run setup:dev

# 3. Start development servers
npm run dev

# 4. In another terminal, load Chrome extension
npm run chrome:dev
```

## Development Workflow

### 1. Running Services

The project uses a monorepo structure with three main packages:

- **shared**: Common types and utilities
- **mcp-server**: MCP protocol server (Fastify + WebSocket)
- **chrome-extension**: Browser extension (Vite + React)

```bash
# Run everything in development mode
npm run dev

# Or run individually
npm run dev:server      # MCP server only
npm run dev:extension   # Chrome extension only
npm run dev:shared      # Shared types in watch mode
```

### 2. Testing

```bash
# Run all tests
npm run test

# Run specific test types
npm run test:unit         # Unit tests only
npm run test:integration  # Integration tests
npm run test:watch        # Watch mode
npm run test:ui           # Test UI interface
npm run test:coverage     # Generate coverage report
npm run test:mcp          # Test MCP endpoints
```

### 3. Code Quality

```bash
# Check all code quality issues
npm run quality

# Fix all code quality issues
npm run quality:fix

# Individual commands
npm run lint          # Lint and fix
npm run format        # Format code
npm run type-check    # Check TypeScript
```

### 4. Building

```bash
# Build all packages
npm run build

# Build specific packages
npm run build:shared
npm run build:server
npm run build:extension

# Build for different environments
npm run build:staging
npm run build:docker
```

## Architecture Overview

### MCP Server

The server implements the Model Context Protocol specification:

```
mcp-server/src/
├── index.ts           # Entry point
├── server.ts          # Fastify server setup
├── config/            # Configuration and logging
├── mcp/               # MCP protocol implementation
│   ├── resources/     # Data providers (console, network, etc.)
│   ├── tools/         # Debugging tools (eval, inspect, etc.)
│   └── prompts/       # AI prompt templates
├── integrations/      # Library integrations
│   ├── cdp.ts        # Chrome DevTools Protocol
│   ├── react.ts      # React DevTools
│   ├── xstate.ts     # XState machines
│   ├── zustand.ts    # Zustand stores
│   └── apollo.ts     # Apollo GraphQL
└── transport/         # Communication layers
    ├── websocket.ts   # WebSocket transport
    └── sse.ts         # Server-Sent Events
```

### Chrome Extension

The extension bridges the browser and MCP server:

```
chrome-extension/src/
├── manifest.json      # Extension manifest
├── background/        # Service worker
├── content/           # Content scripts
├── devtools/          # DevTools panel
├── popup/             # Extension popup
├── injected/          # Page context scripts
└── shared/            # Shared utilities
```

## Environment Variables

Create a `.env` file from `.env.example`:

```bash
cp .env.example .env
```

Key variables:

- `CURUPIRA_PORT`: Server port (default: 8080)
- `CURUPIRA_LOG_LEVEL`: Logging level (debug/info/warn/error)
- `CURUPIRA_AUTH_ENABLED`: Enable authentication (true/false)
- `CURUPIRA_ALLOWED_ORIGINS`: CORS allowed origins

## Docker Development

```bash
# Start development with Docker
npm run dev:docker

# Other Docker commands
npm run docker:build   # Build image
npm run docker:run     # Start containers
npm run docker:logs    # View logs
npm run docker:stop    # Stop containers
npm run docker:shell   # Shell into container
npm run docker:restart # Restart everything
```

## Chrome Extension Development

1. **Load Extension**:
   - Open Chrome
   - Navigate to `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select `chrome-extension/dist` directory

2. **Auto-reload**:
   - Extension rebuilds automatically with `npm run dev`
   - Click "Reload" in Chrome extensions page after changes

3. **DevTools Panel**:
   - Open Chrome DevTools
   - Look for "Curupira" tab

## Debugging Tips

### MCP Server

```bash
# Enable debug logging
CURUPIRA_LOG_LEVEL=debug npm run dev

# Use Chrome DevTools for Node.js
node --inspect dist/index.js
```

### Chrome Extension

1. **Background Script**:
   - Chrome > Extensions > Curupira > "Inspect views: service worker"

2. **Content Script**:
   - Open DevTools on target page
   - Check Console for logs

3. **DevTools Panel**:
   - Right-click in Curupira panel > Inspect

## Common Issues

### Port Already in Use

```bash
# Find process using port 8080
lsof -i :8080

# Kill process
kill -9 <PID>
```

### WebSocket Connection Failed

- Check if MCP server is running
- Verify CORS origins include your domain
- Check browser console for errors

### Extension Not Loading

- Ensure `chrome-extension/dist` exists
- Run `npm run build:extension`
- Check manifest.json for syntax errors

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