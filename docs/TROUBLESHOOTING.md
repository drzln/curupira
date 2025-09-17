# Curupira MCP Server - Troubleshooting Guide

## Table of Contents

- [Common Issues](#common-issues)
- [Connection Problems](#connection-problems)
- [Configuration Issues](#configuration-issues)
- [Tool Execution Errors](#tool-execution-errors)
- [Debugging Curupira](#debugging-curupira)
- [FAQ](#faq)

## Common Issues

### 1. Cannot Connect to Chrome

**Symptoms:**
- "Chrome not connected" errors
- Tools fail with "Chrome connection required"

**Solutions:**

1. **Ensure Browserless Chrome is running:**
   ```bash
   # Start Browserless Chrome
   docker run -d -p 3000:3000 browserless/chrome
   
   # Verify it's accessible
   curl http://localhost:3000/json/version
   ```

2. **Check Chrome service configuration:**
   ```bash
   # Verify environment variable
   echo $CHROME_SERVICE_URL  # Should be http://localhost:3000
   
   # Or check config file
   cat config/base.yaml | grep serviceUrl
   ```

3. **Use chrome_connect tool first:**
   ```
   Ask Claude: "Connect to Chrome browser"
   ```

4. **Enable debug logging:**
   ```bash
   LOGGING_LEVEL=debug npm run start
   # Look for Chrome connection attempts in logs
   ```

### 2. No React Components Found

**Symptoms:**
- react_detect_version returns false
- react_get_component_tree returns empty

**Solutions:**

1. **Navigate to React app first:**
   ```
   Ask Claude: "Navigate to my React app at http://localhost:3000"
   ```

2. **Use react_detect_version tool:**
   ```
   Ask Claude: "Check if React is available on this page"
   ```

3. **For production React apps:**
   - React DevTools may not be available
   - Some debugging features are limited
   - Consider running app in development mode

### 3. Tools Not Working

**Symptoms:**
- "Tool not found" errors
- Tools appear but don't execute

**Solutions:**

1. **Ensure Chrome is connected first:**
   - Most tools require Chrome connection
   - Use `chrome_connect` before other tools

2. **Check tool names:**
   - Tool names use underscores: `react_inspect_component`
   - Not camelCase or kebab-case

3. **Verify tool parameters:**
   - Check required parameters in API documentation
   - Use proper types (strings, numbers, booleans)

## Connection Problems

### MCP Connection Failed

**Error:** "Failed to connect to MCP server"

**Solutions:**

1. **Check Claude Desktop configuration:**
   ```json
   // ~/.config/claude/claude_desktop_config.json
   {
     "mcpServers": {
       "curupira": {
         "command": "node",
         "args": ["/path/to/curupira/mcp-server/dist/main.js"]
       }
     }
   }
   ```

2. **Verify server is running:**
   ```bash
   # Check if process is running
   ps aux | grep curupira
   
   # Test with stdio
   echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node dist/main.js
   ```

## Configuration Issues

### Configuration Not Loading

**Symptoms:**
- Default values used instead of config
- Environment variables not working

**Solutions:**

1. **Check config file location:**
   ```bash
   # Default locations checked
   ./config/base.yaml
   ./config/{environment}.yaml
   
   # Or specify explicitly
   CURUPIRA_CONFIG_PATH=./my-config.yaml npm run start
   ```

2. **Verify environment variable format:**
   ```bash
   # Correct format
   SERVER_PORT=3000
   CHROME_SERVICE_URL=http://localhost:3000
   LOGGING_LEVEL=debug
   
   # NOT curupira_server_port or CURUPIRA_SERVER_PORT
   ```

3. **Check YAML syntax:**
   ```bash
   # Validate YAML file
   npx js-yaml config/base.yaml
   ```

## Tool Execution Errors

### "Chrome not connected" Error

**Solution:** Always connect to Chrome first:
```
1. Ask Claude: "Connect to Chrome"
2. Then use other tools
```

### "Invalid parameters" Error

**Common causes:**
- Missing required parameters
- Wrong parameter types
- Typos in parameter names

**Example fix:**
```
Wrong: { "selector": ".button", "All": true }
Right: { "selector": ".button", "all": true }
```

## Debugging Curupira

### Enable Debug Logging

```bash
# Maximum verbosity
LOGGING_LEVEL=trace npm run start

# Debug specific areas
DEBUG=curupira:chrome,curupira:mcp npm run start
```

### Test Individual Components

```bash
# Test Chrome connection
node scripts/test-cdp-connection.ts

# Test MCP protocol
npm run test:mcp

# Run integration tests
npm run test:integration
```

### Check Dependency Injection

```typescript
// In debug mode, log container state
import { createApplicationContainer } from './infrastructure/container/app.container.js'

const container = createApplicationContainer()
console.log('Services:', container.getRegistrations())
```

## FAQ

### Q: Why are all tools visible even when Chrome isn't connected?

A: Due to Claude Code limitations, all tools are registered statically at startup. They check Chrome connection when executed.

### Q: Can I use Curupira with regular Chrome instead of Browserless?

A: Yes, but you need to start Chrome with debugging:
```bash
google-chrome --remote-debugging-port=9222 --no-first-run
CHROME_SERVICE_URL=http://localhost:9222 npm run start
```

### Q: How do I add custom tools?

A: Create a new tool provider following the factory pattern:
1. Create `MyToolProviderFactory` extending `BaseProviderFactory`
2. Register tools using `provider.registerTool()`
3. Add to `registerToolProviders()` in `app.container.ts`

### Q: What's the difference between resources and tools?

A: 
- **Resources**: Read-only data (DOM tree, network requests)
- **Tools**: Actions that modify state (navigate, click, evaluate)

### Q: How do I debug WebSocket connections?

A: Use Chrome DevTools:
1. Open Network tab
2. Filter by WS
3. Check WebSocket frames
4. Look for CDP messages

### Q: Can I use Curupira in production?

A: Yes, but:
- Enable authentication: `AUTH_ENABLED=true`
- Use secure transports: HTTPS/WSS
- Restrict CORS origins
- Enable rate limiting
- Use proper Chrome isolation