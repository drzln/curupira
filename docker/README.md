# Curupira MCP Server

AI-powered debugging tool for React applications using the Model Context Protocol (MCP).

## Quick Start

```bash
docker run -p 8080:8080 drzzln/curupira
```

## Environment Variables

- `CURUPIRA_PORT` - Server port (default: 8080)
- `CURUPIRA_HOST` - Server host (default: 0.0.0.0)
- `NODE_ENV` - Node environment (default: production)
- `LOG_LEVEL` - Log level: debug, info, warn, error (default: info)

## Usage

### Basic Usage

```bash
docker run -p 8080:8080 drzzln/curupira
```

### With Custom Configuration

```bash
docker run -p 8080:8080 \
  -e LOG_LEVEL=debug \
  -e CURUPIRA_PORT=8080 \
  curupira/mcp-server
```

### Docker Compose

```yaml
version: '3.8'
services:
  curupira:
    image: drzzln/curupira:latest
    ports:
      - "8080:8080"
    environment:
      - LOG_LEVEL=info
      - NODE_ENV=production
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

## Features

- **MCP Protocol Support**: Full implementation of Model Context Protocol
- **React Debugging**: Specialized tools for debugging React applications
- **WebSocket Transport**: Real-time communication with AI assistants
- **Health Checks**: Built-in health monitoring
- **Multi-Architecture**: Supports both AMD64 and ARM64

## Endpoints

- `/health` - Health check endpoint
- `/ready` - Readiness check
- `/info` - Server information
- `/mcp` - WebSocket endpoint for MCP protocol

## Resources

- [GitHub Repository](https://github.com/drzln/curupira)
- [NPM Package](https://www.npmjs.com/package/curupira-mcp-server)
- [Documentation](https://github.com/drzln/curupira#readme)

## License

MIT