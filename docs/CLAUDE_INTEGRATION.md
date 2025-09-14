# Claude Desktop Integration

This guide explains how to connect Curupira MCP Server to Claude Desktop for AI-powered React debugging.

## Quick Start

### Option 1: Using Docker (Recommended)

1. Add to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**Linux**: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "curupira": {
      "command": "docker",
      "args": ["run", "--rm", "-i", "drzzln/curupira:latest"],
      "env": {
        "NODE_ENV": "production",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

2. Restart Claude Desktop

3. The Curupira icon should appear in the MCP servers list

### Option 2: Using NPM Package

1. Install globally:
```bash
npm install -g curupira-mcp-server
```

2. Add to Claude configuration:
```json
{
  "mcpServers": {
    "curupira": {
      "command": "curupira-mcp",
      "args": ["start"],
      "env": {
        "NODE_ENV": "production",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

### Option 3: Local Development

1. Clone the repository:
```bash
git clone https://github.com/drzln/curupira.git
cd curupira
npm install
npm run build
```

2. Add to Claude configuration:
```json
{
  "mcpServers": {
    "curupira": {
      "command": "node",
      "args": ["/path/to/curupira/mcp-server/dist/cli.js", "start"],
      "env": {
        "NODE_ENV": "development",
        "LOG_LEVEL": "debug"
      }
    }
  }
}
```

## Configuration Options

### Environment Variables

- `NODE_ENV`: Environment mode (development/staging/production)
- `LOG_LEVEL`: Logging level (trace/debug/info/warn/error/fatal)
- `PORT`: Server port (default: 8080)
- `HOST`: Server host (default: 0.0.0.0)

### Advanced Docker Configuration

For custom configuration, you can mount a config file:

```json
{
  "mcpServers": {
    "curupira": {
      "command": "docker",
      "args": [
        "run", 
        "--rm", 
        "-i",
        "-v", "/path/to/config.yaml:/app/config.yaml",
        "drzzln/curupira:latest",
        "start",
        "--config", "/app/config.yaml"
      ]
    }
  }
}
```

## Verifying Connection

1. Open Claude Desktop
2. Look for the Curupira icon in the MCP servers section
3. Type: "Show me the available MCP tools"
4. Claude should list Curupira's debugging capabilities

## Available Tools

Once connected, you can ask Claude to:

- **Inspect React Components**: "Show me the React component tree"
- **Monitor Console Logs**: "What console errors are appearing?"
- **Track Network Requests**: "Show recent API calls"
- **Debug Redux State**: "What's in the Redux store?"
- **Performance Analysis**: "Analyze React render performance"

## Troubleshooting

### Server Not Appearing

1. Check Claude logs:
   - macOS: `~/Library/Logs/Claude/`
   - Windows: `%LOCALAPPDATA%\Claude\logs\`

2. Verify Docker is running:
```bash
docker ps
```

3. Test the server manually:
```bash
docker run --rm -it drzzln/curupira:latest
```

### Connection Issues

1. Check if port 8080 is available
2. Ensure Chrome DevTools Protocol is enabled in your browser
3. Verify the Chrome extension is installed (if using browser features)

### Debug Mode

Enable debug logging:

```json
{
  "mcpServers": {
    "curupira": {
      "command": "docker",
      "args": ["run", "--rm", "-i", "drzzln/curupira:latest"],
      "env": {
        "NODE_ENV": "development",
        "LOG_LEVEL": "debug"
      }
    }
  }
}
```

## Security Notes

- The MCP server runs in a sandboxed Docker container
- No persistent storage by default
- Network access is limited to debugging protocols
- Sensitive data is automatically sanitized in logs

## Support

- GitHub Issues: https://github.com/drzln/curupira/issues
- Documentation: https://github.com/drzln/curupira#readme
- Docker Hub: https://hub.docker.com/r/drzzln/curupira