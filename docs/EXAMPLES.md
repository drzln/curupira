# Curupira MCP Server - Usage Examples

## Table of Contents

- [Installation](#installation)
- [Basic Usage](#basic-usage)
- [Common Debugging Scenarios](#common-debugging-scenarios)
- [Advanced Usage](#advanced-usage)
- [Integration Examples](#integration-examples)

## Installation

### Using Claude Desktop

Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "curupira": {
      "command": "npx",
      "args": ["curupira-mcp-server"],
      "env": {
        "CURUPIRA_CDP_HOST": "localhost",
        "CURUPIRA_CDP_PORT": "9222"
      }
    }
  }
}
```

### Docker Compose

```yaml
version: '3.8'
services:
  chrome:
    image: browserless/chrome:latest
    ports:
      - "9222:3000"
    environment:
      - MAX_CONCURRENT_SESSIONS=10
      - PREBOOT_CHROME=true
  
  curupira:
    image: drzzln/curupira:latest
    environment:
      - CURUPIRA_TRANSPORT=sse
      - CURUPIRA_PORT=3000
      - CURUPIRA_CDP_HOST=chrome
      - CURUPIRA_CDP_PORT=3000
      - NODE_ENV=development
    ports:
      - "3000:3000"
    depends_on:
      - chrome
```

## Basic Usage

### 1. Connect to a React Application

```javascript
// First, ensure your React app is running in a Chrome instance with debugging enabled
// chrome --remote-debugging-port=9222 http://localhost:3000

// Then use Claude to connect
"Connect to the React application and show me the component tree"
```

### 2. Inspect Component State

```javascript
// Ask Claude to find and inspect specific components
"Find the UserProfile component and show me its current state and props"

// Claude will use:
// 1. resources/list to see available resources
// 2. resources/read with uri: "react://components"
// 3. resources/read with uri: "react://component/{id}"
```

### 3. Debug Console Errors

```javascript
"Show me any console errors or warnings in the application"

// Claude will:
// 1. Read browser://console/logs
// 2. Filter for error/warning levels
// 3. Provide analysis and suggestions
```

## Common Debugging Scenarios

### Scenario 1: Shopping Cart Not Updating

```javascript
// Problem: Items added to cart don't appear
"Debug why items aren't showing in the shopping cart"

// Claude's approach:
// 1. Check Zustand cart store state
// 2. Monitor network requests to cart API
// 3. Trace component re-renders
// 4. Identify state update issues
```

Example interaction:
```
User: "The cart count shows 0 even after adding items"

Claude: "Let me debug the cart state. I'll check:
1. The Zustand store state
2. Network requests for adding items
3. Component re-rendering

[Reads zustand://stores]
I found the cart store. Current state shows:
- items: []
- total: 0
- lastUpdate: null

[Monitors network://requests]
I see a POST to /api/cart/add returned 200 OK, but...

[Executes runtime/evaluate to check response]
The API response shows the item was added server-side. The issue is the client state isn't updating.

[Checks React component]
The CartButton component is reading from the store correctly.

The problem: The addItem action in your Zustand store isn't updating the state after the API call succeeds. You need to update the store in the success callback."
```

### Scenario 2: Slow Component Performance

```javascript
"Analyze why the ProductList component is rendering slowly"

// Claude's debugging steps:
// 1. Capture performance metrics
// 2. Identify slow components
// 3. Analyze render patterns
// 4. Suggest optimizations
```

Example flow:
```
[Read react://performance]
Found slow components:
- ProductList: 125ms average render time
- ProductCard: 15ms (rendered 50 times)

[Analyze with performance/captureMetrics]
High script execution time detected

[Inspect component implementation]
Issues found:
1. Expensive filter operations in render
2. Missing React.memo on ProductCard
3. All items re-render on any state change

Recommendations:
1. Memoize filtered results
2. Add React.memo to ProductCard
3. Use React.useMemo for expensive computations
```

### Scenario 3: Authentication State Issues

```javascript
"Debug why users are getting logged out randomly"

// Debugging approach:
// 1. Check auth state in XState
// 2. Monitor auth-related network requests
// 3. Inspect browser storage
// 4. Trace state transitions
```

### Scenario 4: Memory Leaks

```javascript
"Check if there are memory leaks in the application"

// Steps:
// 1. Take initial memory snapshot
// 2. Perform user actions
// 3. Take another snapshot
// 4. Analyze growth patterns
```

## Advanced Usage

### Custom Debugging Scripts

```javascript
// Execute complex debugging logic
"Run a script to find all components using deprecated lifecycle methods"

// Claude generates and executes:
const script = `
  const components = [];
  const fiber = document.querySelector('#root')._reactRootContainer._internalRoot.current;
  
  function walkFiber(node) {
    if (node.type && typeof node.type === 'function') {
      const proto = node.type.prototype;
      if (proto && (proto.componentWillMount || proto.componentWillReceiveProps)) {
        components.push({
          name: node.type.name || 'Anonymous',
          methods: Object.getOwnPropertyNames(proto).filter(m => 
            m.startsWith('componentWill') && m !== 'componentWillUnmount'
          )
        });
      }
    }
    if (node.child) walkFiber(node.child);
    if (node.sibling) walkFiber(node.sibling);
  }
  
  walkFiber(fiber);
  return components;
`;
```

### Performance Profiling

```javascript
// Start profiling session
"Profile the checkout flow performance"

// Claude will:
// 1. Start performance profiling
// 2. Guide through checkout steps
// 3. Stop profiling and analyze
// 4. Provide optimization suggestions
```

### State Management Debugging

```javascript
// Complex state debugging
"Trace how the user preference changes propagate through the app"

// Approach:
// 1. Set up state monitoring
// 2. Trigger preference change
// 3. Track state updates across stores
// 4. Identify update chains and side effects
```

## Integration Examples

### With CI/CD Pipeline

```yaml
# .github/workflows/debug-e2e-failures.yml
name: Debug E2E Failures
on:
  workflow_dispatch:
    inputs:
      test_name:
        description: 'Failed test to debug'
        required: true

jobs:
  debug:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Start services
        run: docker-compose up -d
      
      - name: Run test with debugging
        run: |
          npm run test:e2e -- --test=${{ inputs.test_name }} --debug
      
      - name: Connect Curupira
        run: |
          # Start Curupira in analysis mode
          docker run -d \
            -e CURUPIRA_CDP_HOST=localhost \
            -e CURUPIRA_TRANSPORT=http \
            -p 3000:3000 \
            drzzln/curupira:latest
      
      - name: Analyze failure
        run: |
          # Use Curupira API to gather debug info
          curl http://localhost:3000/mcp \
            -X POST \
            -H "Content-Type: application/json" \
            -d '{"method": "resources/read", "params": {"uri": "browser://console/logs"}}'
```

### With VS Code Extension

```javascript
// .vscode/launch.json
{
  "configurations": [
    {
      "type": "chrome",
      "request": "launch",
      "name": "Debug with Curupira",
      "url": "http://localhost:3000",
      "webRoot": "${workspaceFolder}",
      "runtimeArgs": [
        "--remote-debugging-port=9222"
      ],
      "env": {
        "CURUPIRA_AUTO_CONNECT": "true"
      }
    }
  ]
}
```

### Automated Testing Helper

```javascript
// test-helper.js
const { CurupiraClient } = require('curupira-client');

async function debugFailedTest(testName) {
  const client = new CurupiraClient({
    host: 'localhost',
    port: 3000
  });
  
  // Get console logs
  const logs = await client.readResource('browser://console/logs');
  const errors = logs.logs.filter(l => l.level === 'error');
  
  // Get React component state
  const components = await client.readResource('react://components');
  
  // Get network failures
  const requests = await client.readResource('network://requests');
  const failed = requests.requests.filter(r => r.status >= 400);
  
  return {
    testName,
    errors,
    componentCount: components.total,
    failedRequests: failed,
    timestamp: new Date().toISOString()
  };
}
```

## Best Practices

### 1. Use Prompts for Complex Scenarios

Instead of manual steps, use the built-in prompts:

```javascript
// Good
"Use the debug-react-component prompt to analyze the CartSummary component"

// This automatically:
// - Finds the component
// - Checks props and state
// - Looks for errors
// - Analyzes performance
// - Suggests fixes
```

### 2. Combine Resources for Complete Picture

```javascript
// Debugging a feature requires multiple resources
"Debug why the search feature isn't working"

// Claude will combine:
// - react://components (UI state)
// - network://requests (API calls)
// - browser://console/logs (errors)
// - zustand://stores (app state)
```

### 3. Use Security Features in Production

```javascript
// Production setup with auth
{
  "mcpServers": {
    "curupira-prod": {
      "command": "npx",
      "args": ["curupira-mcp-server"],
      "env": {
        "NODE_ENV": "production",
        "CURUPIRA_JWT_SECRET": "${JWT_SECRET}",
        "CURUPIRA_TRANSPORT": "sse"
      }
    }
  }
}
```

### 4. Monitor Performance Impact

```javascript
// Check Curupira's performance impact
"Show me Curupira's performance metrics and impact on the application"

// Monitors:
// - Memory usage
// - CPU usage
// - Network overhead
// - Response times
```