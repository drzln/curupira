# Curupira CLI Reference

The Curupira CLI provides commands for managing and running the MCP debugging server.

## Installation

```bash
# Install globally
npm install -g curupira

# Or use locally
npx curupira
```

## Commands

### `curupira init`

Initialize a new Curupira project configuration.

```bash
curupira init [options]

Options:
  --name <name>      Project name
  --port <port>      Server port (default: 8080)
  --chrome <url>     Chrome service URL (default: http://localhost:3000)
```

Creates a `curupira.yml` configuration file in the current directory.

### `curupira start`

Start the Curupira MCP server.

```bash
curupira start [options]

Options:
  --port <port>          Server port (overrides config)
  --host <host>          Server host (overrides config)
  --transport <type>     Transport type: stdio, http, sse (default: stdio)
  --chrome-host <host>   Chrome service host
  --chrome-port <port>   Chrome service port
  --config <path>        Path to configuration file
```

Example:
```bash
# Start with default settings
curupira start

# Start with custom port
curupira start --port 3001

# Start with HTTP transport
curupira start --transport http

# Use custom config file
curupira start --config ./config/production.yaml
```

### `curupira dev`

Start the server in development mode with hot reloading.

```bash
curupira dev [options]

Options:
  --port <port>      Development server port
  --debug            Enable debug logging
```

### `curupira validate`

Validate configuration and Chrome connection.

```bash
curupira validate [options]

Options:
  --config <path>    Path to config file to validate
  --fix              Attempt to fix configuration issues
```

### `curupira debug`

Run debugging diagnostics and connectivity tests.

```bash
curupira debug [options]

Options:
  --chrome           Test Chrome connection
  --mcp              Test MCP protocol
  --tools            List available tools
  --resources        List available resources
```

## Configuration File

Curupira uses YAML configuration following Nexus standards:

```yaml
# curupira.yml
name: my-app
version: 1.0.0

server:
  port: 8080
  host: localhost

chrome:
  serviceUrl: http://localhost:3000
  discovery:
    enabled: true
    hosts:
      - localhost
      - 127.0.0.1

transport:
  type: stdio  # or http, sse
```

## Environment Variables

Configuration can be overridden with environment variables:

```bash
# Server configuration
SERVER_HOST=0.0.0.0
SERVER_PORT=8080

# Chrome configuration
CHROME_SERVICE_URL=http://browserless:3000
CHROME_DISCOVERY_ENABLED=true

# Logging
LOGGING_LEVEL=debug
LOGGING_PRETTY=true

# Transport
CURUPIRA_TRANSPORT=http
```

## Common Usage Patterns

### Local Development

```bash
# Initialize project
curupira init --name my-debug-project

# Start Browserless Chrome
docker run -p 3000:3000 browserless/chrome

# Start Curupira server
curupira start
```

### Production Deployment

```bash
# Use environment-specific config
curupira start --config ./config/production.yaml

# Or use environment variables
CHROME_SERVICE_URL=https://chrome.prod.example.com \
SERVER_PORT=8080 \
curupira start --transport http
```

### Debugging Issues

```bash
# Validate setup
curupira validate

# Debug connectivity
curupira debug --chrome --mcp

# Enable verbose logging
LOGGING_LEVEL=debug curupira start
```

## Integration with Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "curupira": {
      "command": "curupira",
      "args": ["start"],
      "env": {
        "CHROME_SERVICE_URL": "http://localhost:3000"
      }
    }
  }
}
```

## Exit Codes

- `0`: Success
- `1`: General error
- `2`: Configuration error
- `3`: Connection error
- `4`: Validation error