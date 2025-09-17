# Curupira MCP Server API Documentation

## Overview

Curupira MCP Server provides a Model Context Protocol (MCP) interface for debugging web applications through Chrome DevTools Protocol (CDP). This document describes all available resources, tools, and prompts.

## Table of Contents

- [Resources](#resources)
  - [Browser Resources](#browser-resources)
  - [DOM Resources](#dom-resources)
  - [Network Resources](#network-resources)
  - [State Resources](#state-resources)
- [Tools](#tools)
  - [Chrome Connection Tools](#chrome-connection-tools)
  - [CDP Tools](#cdp-tools)
  - [React Tools](#react-tools)
  - [Framework Tools](#framework-tools)
  - [State Management Tools](#state-management-tools)
  - [Development Tools](#development-tools)
  - [UI/Animation Tools](#uianimation-tools)
- [Prompts](#prompts)
- [Configuration](#configuration)
- [Error Handling](#error-handling)

## Resources

Resources provide read-only access to browser and application state. Resources are registered dynamically based on Chrome connection status.

### Browser Resources

#### `browser://status`
Get current browser connection status and capabilities.

**Response:**
```json
{
  "connected": true,
  "serviceUrl": "chrome://localhost:9222",
  "activeSessions": 1,
  "sessions": [{
    "sessionId": "default",
    "createdAt": "2024-01-15T10:00:00Z",
    "duration": 0
  }],
  "capabilities": {
    "screenshot": true,
    "evaluate": true,
    "navigate": true,
    "profiling": true,
    "debugging": true
  }
}
```

### DOM Resources

#### `chrome://dom/tree`
Get the current DOM tree structure.

**Response:**
```json
{
  "rootNode": {
    "nodeId": 1,
    "nodeName": "HTML",
    "nodeType": 1,
    "children": [...]
  }
}
```

### Network Resources

#### `chrome://network/requests`
Get recent network requests.

**Response:**
```json
{
  "requests": [{
    "requestId": "123",
    "url": "https://api.example.com/data",
    "method": "GET",
    "status": 200,
    "responseTime": 123
  }]
}
```

#### `chrome://network/websockets`
Get active WebSocket connections.

**Response:**
```json
{
  "connections": [{
    "url": "wss://ws.example.com",
    "state": "open",
    "messages": []
  }]
}
```

### State Resources

#### `chrome://state/react`
Get React component state information.

#### `chrome://state/apollo`
Get Apollo GraphQL cache state.

#### `chrome://state/zustand`
Get Zustand store state.

### React Resources

#### `react://components`
Get React component tree.

**Response:**
```json
{
  "components": [
    {
      "id": "1",
      "name": "App",
      "type": "function",
      "props": {
        "title": "My App"
      },
      "state": null,
      "hooks": ["useState", "useEffect"],
      "children": ["2", "3"],
      "depth": 0
    }
  ],
  "total": 15,
  "reactVersion": "18.2.0"
}
```

#### `react://component/{id}`
Get specific component details.

**Parameters:**
- `id`: Component ID from the component tree

**Response:**
```json
{
  "id": "1",
  "name": "UserProfile",
  "type": "function",
  "props": {
    "userId": 123,
    "showAvatar": true
  },
  "hooks": [
    {
      "type": "useState",
      "value": { "loading": false }
    }
  ],
  "fiber": {
    "effectTag": 0,
    "elementType": "function"
  }
}
```

#### `react://performance`
Get React performance metrics.

**Response:**
```json
{
  "slowComponents": [
    {
      "name": "ExpensiveList",
      "renderTime": 125.5,
      "renderCount": 10
    }
  ],
  "totalRenders": 150,
  "averageRenderTime": 15.2
}
```

### State Management Resources

#### `xstate://machines`
Get all XState machines.

**Response:**
```json
{
  "machines": [
    {
      "id": "auth",
      "state": "authenticated",
      "context": {
        "user": { "id": 123 }
      }
    }
  ]
}
```

#### `zustand://stores`
Get all Zustand stores.

**Response:**
```json
{
  "stores": [
    {
      "name": "useCartStore",
      "state": {
        "items": [],
        "total": 0
      }
    }
  ]
}
```

### Network Resources

#### `network://requests`
Get recent network requests (last 500).

**Response:**
```json
{
  "requests": [
    {
      "id": "req-1",
      "url": "https://api.example.com/users",
      "method": "GET",
      "status": 200,
      "type": "xhr",
      "duration": 125,
      "size": 2048
    }
  ],
  "total": 45,
  "stats": {
    "totalSize": 150000,
    "totalDuration": 5000,
    "failedCount": 2
  }
}
```

## Tools

Tools provide actions to interact with the browser and debug applications. All tools are registered at startup but require Chrome connection to function.

### Chrome Connection Tools

#### `chrome_connect`
Connect to Chrome browser via CDP.

**Parameters:**
```json
{
  "host": "localhost",
  "port": 3000,
  "timeout": 5000
}
```

#### `chrome_disconnect`
Disconnect from Chrome browser.

#### `chrome_list_targets`
List all available Chrome targets/tabs.

### CDP Tools

#### `cdp_evaluate`
Evaluate JavaScript expression in the browser.

**Parameters:**
```json
{
  "expression": "document.title",
  "sessionId": "optional-session-id"
}
```

#### `cdp_navigate`
Navigate to a URL.

**Parameters:**
```json
{
  "url": "https://example.com",
  "sessionId": "optional-session-id"
}
```

#### `cdp_get_cookies`
Get browser cookies.

**Parameters:**
```json
{
  "urls": ["https://example.com"],
  "sessionId": "optional-session-id"
}
```

### React Tools

#### `react_detect_version`
Detect React version and DevTools availability.

#### `react_get_component_tree`
Get the React component tree structure.

**Parameters:**
```json
{
  "rootSelector": "#root",
  "maxDepth": 10,
  "includeProps": true
}
```

#### `react_inspect_component`
Inspect a specific React component.

**Parameters:**
```json
{
  "componentSelector": "App > Header",
  "includeProps": true,
  "includeState": true,
  "includeHooks": true
}
```

#### `react_analyze_rerenders`
Analyze component re-renders for performance.

**Parameters:**
```json
{
  "componentSelector": "MyComponent",
  "duration": 5000
}
```

### DOM Tools

#### `dom_query_selector`
Find DOM elements using CSS selectors.

**Parameters:**
```json
{
  "selector": ".btn-primary",
  "all": false
}
```

#### `dom_click`
Click a DOM element.

**Parameters:**
```json
{
  "selector": "#submit-btn"
}
```

### Network Tools

#### `network_get_requests`
Get recent network requests.

#### `network_get_websockets`
Get active WebSocket connections.

#### `network_intercept_requests`
Intercept and modify network requests.

### Storage Tools

#### `get_local_storage`
Get localStorage items.

#### `get_session_storage`
Get sessionStorage items.

#### `get_cookies`
Get browser cookies.

#### `set_cookie`
Set a browser cookie.

### Console Tools

#### `console_get_messages`
Get console log messages.

#### `console_execute`
Execute code in the browser console.

#### `console_clear`
Clear the console.

### Debugger Tools

#### `debugger_enable`
Enable Chrome debugger.

#### `debugger_pause`
Pause JavaScript execution.

#### `debugger_resume`
Resume JavaScript execution.

#### `debugger_set_breakpoint`
Set a breakpoint.

### State Management Tools

#### `apollo_get_cache`
Get Apollo GraphQL cache state.

#### `zustand_get_stores`
Get Zustand store states.

#### `xstate_get_machines`
Get XState machine states.

#### `tanstack_query_get_cache`
Get TanStack Query cache.

### Development Tools

#### `vite_dev_server_info`
Get Vite dev server information.

#### `react_router_get_routes`
Get React Router routes.

#### `react_hook_form_get_forms`
Get React Hook Form states.

### UI/Animation Tools

#### `framer_motion_get_animations`
Get Framer Motion animations.

#### `panda_css_get_styles`
Get Panda CSS styles and tokens.

## Prompts

Prompts provide pre-configured debugging scenarios for common use cases.

### `debug-lazy-loading`
Debug lazy-loaded component issues.

**Arguments:**
- `componentName` (required): Name of the component having issues

### `trace-graphql-error`
Trace GraphQL query errors.

**Arguments:**
- `operation` (required): GraphQL operation name
- `error` (required): Error message

### `profile-performance`
Profile component render performance.

**Arguments:**
- `component` (optional): Component to profile

## Configuration

Curupira follows the Nexus configuration pattern: Base YAML → Environment YAML → Environment Variables.

### Configuration Files

```yaml
# config/base.yaml
server:
  name: "curupira-mcp-server"
  version: "1.1.3"
  host: "localhost"
  port: 8080

chrome:
  serviceUrl: "http://localhost:3000"
  connectTimeout: 5000

transports:
  websocket:
    enabled: true
  http:
    enabled: true
  sse:
    enabled: true
```

### Environment Variables

All configuration can be overridden via environment variables:

```bash
# Server
SERVER_HOST=0.0.0.0
SERVER_PORT=8080

# Chrome
CHROME_SERVICE_URL=http://browserless:3000
CHROME_DISCOVERY_ENABLED=true

# Logging
LOGGING_LEVEL=debug

# Storage
STORAGE_MINIO_ENABLED=true
```

## Error Handling

All errors follow a consistent format:

```json
{
  "error": "Chrome not connected",
  "code": "CHROME_DISCONNECTED",
  "details": {
    "suggestion": "Use chrome_connect tool first"
  }
}
```

### Common Error Codes

- `CHROME_DISCONNECTED`: Chrome browser not connected
- `SESSION_NOT_FOUND`: Invalid session ID
- `TOOL_EXECUTION_FAILED`: Tool failed to execute
- `RESOURCE_NOT_FOUND`: Requested resource not found
- `INVALID_PARAMETERS`: Invalid tool parameters

