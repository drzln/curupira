# Curupira MCP Connection Guide

Complete guide for connecting AI assistants to the Curupira MCP server for React debugging.

## 🚀 Quick Start (30 seconds)

### 1. Start Curupira MCP Server
```bash
npx curupira start
```
**Output:**
```
🚀 Curupira MCP server started successfully

📋 Quick Start Guide:
1. Connect your AI assistant to the MCP server
2. Use chrome_discover_instances to find Chrome browsers  
3. Use chrome_connect to connect to a Chrome instance
4. Start debugging with React tools!

📖 For detailed setup instructions: https://docs.curupira.dev
```

### 2. Connect AI Assistant
Add this to your AI assistant's MCP configuration:

**WebSocket (Recommended):**
```json
{
  "mcpServers": {
    "curupira": {
      "command": "curupira",
      "args": ["start"],
      "transport": "websocket",
      "endpoint": "ws://localhost:8080/mcp"
    }
  }
}
```

**Server-Sent Events (Alternative):**
```json
{
  "mcpServers": {
    "curupira": {
      "command": "curupira", 
      "args": ["start"],
      "transport": "sse",
      "endpoint": "http://localhost:8080/mcp/sse"
    }
  }
}
```

### 3. Test Connection
Ask your AI assistant:
```
"What debugging tools are available in Curupira?"
```

## 📚 Claude Code Configuration

### Claude Code Setup

**Primary Configuration:**
Claude Code automatically detects and connects to MCP servers. Simply ensure Curupira is running:

```bash
npx curupira start
```

**Manual Configuration (if needed):**
Add to your project's MCP configuration:

```json
{
  "mcpServers": {
    "curupira": {
      "command": "npx",
      "args": ["curupira", "start", "--port", "8080"],
      "env": {
        "CURUPIRA_LOG_LEVEL": "info"
      }
    }
  }
}
```

### Alternative AI Assistants

**Claude Desktop (macOS/Windows):**

**File location:** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "curupira-debug": {
      "command": "npx",
      "args": ["curupira", "start", "--port", "8080"],
      "env": {
        "CURUPIRA_LOG_LEVEL": "info"
      }
    }
  }
}
```

## 🛠️ Available Tools

### Chrome Connection Tools

#### `chrome_discover_instances`
**Purpose:** Find available Chrome browser instances for debugging
**Usage:** Call this first to see what's available to connect to

**Example AI prompt:**
```
"Find Chrome browser instances I can debug"
```

**Response includes:**
- List of Chrome instances with URLs and titles
- Smart recommendations for React apps
- Instructions for starting Chrome with debugging if none found

#### `chrome_connect`
**Purpose:** Connect to a specific Chrome instance
**Usage:** Use instanceId from chrome_discover_instances

**Example AI prompt:**
```
"Connect to Chrome instance abc123 for debugging"
```

#### `chrome_status`
**Purpose:** Check current Chrome connection status
**Usage:** Verify connection health and active sessions

**Example AI prompt:**
```
"What's the status of my Chrome connection?"
```

#### `chrome_disconnect`
**Purpose:** Cleanly disconnect from Chrome
**Usage:** End debugging session

**Example AI prompt:**
```
"Disconnect from Chrome"
```

### React Debugging Tools

#### `react_get_component_tree`
**Purpose:** Get complete React component hierarchy
**Usage:** Understand component structure and relationships

**Example AI prompt:**
```
"Show me the React component tree for this page"
```

#### `react_inspect_component`
**Purpose:** Inspect specific React component details
**Usage:** Deep dive into component props, state, hooks

**Example AI prompt:**
```
"Inspect the UserProfile component and show its props and state"
```

#### `react_analyze_rerenders`
**Purpose:** Analyze component re-render patterns
**Usage:** Find performance issues and unnecessary renders

**Example AI prompt:**
```
"Analyze why the ProductList component keeps re-rendering"
```

#### `cdp_evaluate`
**Purpose:** Execute JavaScript in the browser
**Usage:** Run code, inspect variables, test fixes

**Example AI prompt:**
```
"Run console.log(window.myGlobalVariable) in the browser"
```

## 📋 Common Debugging Workflows

### 1. Initial Setup Workflow
```
AI: "Start Curupira and find Chrome instances"
1. curupira start (automatic)
2. chrome_discover_instances
3. chrome_connect with recommended instance
4. chrome_status (verify connection)
```

### 2. React Component Investigation
```
AI: "I have a React component that's not updating properly"
1. react_get_component_tree (find the component)
2. react_inspect_component (check props/state)
3. react_analyze_rerenders (check render patterns)
4. cdp_evaluate (test hypotheses)
```

### 3. Performance Debugging
```
AI: "My React app is slow, help me find why"
1. react_analyze_rerenders (find excessive renders)
2. react_inspect_hooks (check hook dependencies)
3. cdp_evaluate performance metrics
4. Provide optimization recommendations
```

### 4. State Management Debugging
```
AI: "My Zustand store isn't updating the UI"
1. cdp_evaluate (inspect store state)
2. react_inspect_component (check component subscriptions)
3. react_analyze_rerenders (verify updates trigger renders)
4. Diagnose and fix connection issues
```

## 🔧 Troubleshooting

### Server Issues

#### "Connection refused to localhost:8080"
```bash
# Check if server is running
curupira status

# If not running, start it
curupira start

# Check for port conflicts
curupira start --port 8001
```

#### "MCP server not responding"
```bash
# Run diagnostics
curupira doctor

# Check logs
curupira start --log-level debug
```

### Chrome Connection Issues

#### "No Chrome instances found"
**AI can help with this automatically, but manual steps:**
```bash
# Start Chrome with debugging enabled
google-chrome --remote-debugging-port=9222

# Or headless mode
google-chrome --headless --remote-debugging-port=9222

# Then ask AI: "Discover Chrome instances again"
```

#### "Chrome connection failed"
**AI troubleshooting prompts:**
```
"Why can't I connect to Chrome instance abc123?"
"Help me troubleshoot Chrome connection issues"
"Start Chrome with debugging enabled"
```

### AI Assistant Issues

#### "Tools not available"
**Check MCP configuration:**
1. Verify server is running: `curupira status`
2. Check MCP endpoint in AI config
3. Restart AI assistant
4. Test with: "What tools are available?"

#### "Permission denied"
**For file-based configs:**
```bash
# Check file permissions
ls -la ~/Library/Application\ Support/Claude/claude_desktop_config.json

# Fix if needed
chmod 644 ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

## 💡 AI Assistant Best Practices

### Effective Prompts

**✅ Good prompts:**
```
"Find and connect to a Chrome instance with a React app"
"Show me why the UserCard component keeps re-rendering"
"Debug the shopping cart state management issue"
"Analyze the performance of the ProductList component"
```

**❌ Avoid:**
```
"Debug this" (too vague)
"Fix my React app" (too broad) 
"Connect to Chrome" (without context)
```

### Workflow Optimization

1. **Start with discovery:** Always begin with chrome_discover_instances
2. **Context matters:** Provide component names and specific issues
3. **Follow recommendations:** AI will suggest next steps based on findings
4. **Test hypotheses:** Use cdp_evaluate to verify theories

### Error Handling

AI assistants will automatically:
- Retry failed connections
- Suggest alternative approaches
- Provide troubleshooting steps
- Recommend configuration fixes

## 🚀 Advanced Configuration

### Custom Port and Host
```bash
# Start on different port
curupira start --port 9000

# Bind to specific host
curupira start --host 127.0.0.1

# Environment-specific configs
curupira start --env production
```

### Multiple AI Assistants
```bash
# Start additional instance for different AI
curupira start --port 8081 --name curupira-secondary
```

### Docker Deployment
```bash
# Use Docker for isolated environment
docker run -p 8080:8080 drzzln/curupira:latest

# With custom configuration
docker run -p 8080:8080 -e CURUPIRA_LOG_LEVEL=debug drzzln/curupira:latest
```

### Development Mode
```bash
# Enhanced logging and debugging
curupira dev

# Auto-restart on changes
curupira dev --watch
```

## 📞 Support and Resources

- **Quick Help:** `curupira doctor`
- **Server Status:** `curupira status --tools --resources`
- **Debug Logs:** `curupira start --log-level debug`
- **GitHub Issues:** [Report problems](https://github.com/pleme-io/nexus/issues)
- **Documentation:** [Full docs](https://docs.curupira.dev)

## 🎯 Success Indicators

You'll know everything is working when:

1. ✅ AI assistant can list Curupira tools
2. ✅ Chrome instances are discovered automatically
3. ✅ Connection to Chrome succeeds
4. ✅ React component tree is accessible
5. ✅ Debugging commands execute successfully

**Test with this AI prompt:**
```
"Show me the status of Curupira, discover Chrome instances, connect to one, and show me the React component tree"
```

If this works end-to-end, you're ready for advanced React debugging! 🎉