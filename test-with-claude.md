# Testing Curupira with Claude Code

This guide explains how to test the Curupira MCP server locally with Claude Code.

## Prerequisites

1. **Claude Code** installed on your system
2. **Chrome** installed and accessible
3. **Node.js** 18+ and npm

## Setup Steps

### 1. Build and Start Curupira

```bash
# Build the project
npm run build

# Start Chrome in debug mode (in a separate terminal)
google-chrome \
  --remote-debugging-port=9222 \
  --remote-debugging-address=127.0.0.1 \
  --user-data-dir=/tmp/chrome-debug

# Start Curupira MCP server
npm run dev:server
```

### 2. Configure Claude Code

Add Curupira to your Claude Code MCP settings. Edit `~/AppData/Roaming/Code/User/settings.json` (Windows) or `~/.config/Code/User/settings.json` (Linux/Mac):

```json
{
  "claude.mcpServers": {
    "curupira": {
      "command": "node",
      "args": ["/path/to/curupira/mcp-server/dist/index.js"],
      "env": {
        "CHROME_DEBUG_PORT": "9222",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

Or use the npm global installation:

```bash
# Install globally
npm install -g @pleme/curupira

# Configure Claude Code to use global command
{
  "claude.mcpServers": {
    "curupira": {
      "command": "curupira",
      "env": {
        "CHROME_DEBUG_PORT": "9222"
      }
    }
  }
}
```

### 3. Restart Claude Code

After updating the settings, restart Claude Code to load the MCP server configuration.

## Testing Scenarios

### Basic Chrome Control

Ask Claude to:
- "Navigate to https://example.com"
- "Take a screenshot of the current page"
- "Evaluate `document.title` in the browser"
- "Get all cookies from the current page"

### DOM Manipulation

Ask Claude to:
- "Find all buttons on the page"
- "Click the first button"
- "Get the text content of all h1 elements"
- "Set the value of the search input to 'test'"

### React Debugging

Navigate to a React app and ask:
- "Show me all React components on this page"
- "What props does the UserProfile component have?"
- "Show me the React fiber tree"
- "Profile the render performance of this page"

### State Management Debugging

For apps using state management:
- "List all Zustand stores"
- "Show me the current Redux state"
- "What XState machines are running?"
- "Show me the Apollo GraphQL cache"

### Network Debugging

Ask Claude to:
- "Show me all network requests"
- "Block all requests to analytics"
- "Throttle the network to 3G speed"
- "Mock the /api/users endpoint to return test data"

### Performance Analysis

Ask Claude to:
- "Start CPU profiling"
- "Show me the current memory usage"
- "Measure the cumulative layout shift"
- "Get resource timing for all scripts"

## Verification Checklist

- [ ] Claude Code shows Curupira in the MCP servers list
- [ ] Basic navigation and screenshot commands work
- [ ] DOM queries return correct elements
- [ ] React detection works on React pages
- [ ] Network interception functions properly
- [ ] Performance metrics are collected
- [ ] No errors in Claude Code console
- [ ] No errors in Curupira server logs

## Troubleshooting

### "Chrome not connected" error

1. Ensure Chrome is running with debugging enabled:
   ```bash
   ps aux | grep chrome | grep 9222
   ```

2. Check Chrome is accessible:
   ```bash
   curl http://localhost:9222/json/version
   ```

### "MCP server not found" error

1. Check Claude Code settings for correct path
2. Verify Curupira is built: `npm run build`
3. Test server directly: `node mcp-server/dist/index.js`

### No React resources showing

1. Navigate to a React application
2. Wait for page to fully load
3. Check React DevTools is installed (helps with detection)

### Performance issues

1. Reduce console message buffer size in settings
2. Disable verbose logging: `LOG_LEVEL=warn`
3. Clear Chrome cache and cookies periodically

## Advanced Testing

### Testing with specific Chrome flags

```bash
google-chrome \
  --remote-debugging-port=9222 \
  --disable-web-security \
  --disable-features=IsolateOrigins,site-per-process \
  --user-data-dir=/tmp/chrome-debug
```

### Testing with authentication

1. Manually log in to your application in Chrome
2. Use Curupira to inspect authenticated state
3. Save cookies for reuse in tests

### Testing with extensions

1. Load Chrome with specific extensions
2. Use Curupira to interact with extension content scripts
3. Debug extension background pages

## Example Claude Prompts

### Complete Debugging Session

"I'm debugging a React app at http://localhost:3000. Can you help me:
1. Navigate to the app
2. Check what React version is being used
3. List all components on the page
4. Find any components that are re-rendering too often
5. Check for memory leaks in the console
6. Profile the app for 5 seconds and show me slow functions"

### State Management Investigation

"I need to debug state management in my app:
1. Check what state management libraries are being used
2. Show me the current state of all stores
3. Monitor state changes as I interact with the app
4. Find any state updates that cause unnecessary re-renders"

### Network Performance Analysis

"Help me analyze network performance:
1. Show all API calls being made
2. Find any failed requests
3. Identify slow endpoints (>1s response time)
4. Check for unnecessary API calls
5. Test how the app behaves on slow 3G"

## Success Criteria

A successful test session should demonstrate:

1. **Connectivity**: Claude can control Chrome via Curupira
2. **Discovery**: All resources and tools are listed correctly
3. **Functionality**: Each tool category works as expected
4. **Performance**: Operations complete in reasonable time (<1s for most)
5. **Reliability**: No crashes or disconnections during normal use
6. **Usability**: Claude understands and uses the tools effectively

## Reporting Issues

If you encounter issues during testing:

1. Check the Curupira server logs
2. Check Chrome DevTools console for errors
3. Save the Claude Code conversation
4. Create an issue with:
   - Steps to reproduce
   - Expected vs actual behavior
   - Relevant log snippets
   - Chrome and Node.js versions