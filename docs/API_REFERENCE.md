# Curupira MCP API Reference

This document provides a comprehensive reference for all resources and tools available in the Curupira MCP server.

## Table of Contents

- [Resources](#resources)
  - [CDP Resources](#cdp-resources)
  - [React Resources](#react-resources)
  - [State Management Resources](#state-management-resources)
  - [Connectivity Resources](#connectivity-resources)
- [Tools](#tools)
  - [CDP Tools](#cdp-tools)
  - [DOM Tools](#dom-tools)
  - [React Tools](#react-tools)
  - [State Management Tools](#state-management-tools)
  - [Network Tools](#network-tools)
  - [Performance Tools](#performance-tools)
  - [Debugger Tools](#debugger-tools)
  - [Console Tools](#console-tools)
- [Prompts](#prompts)

## Resources

Resources provide read-only access to browser and application state.

### CDP Resources

#### `cdp://runtime/console`

Returns console messages from the browser.

**Response:**
```json
{
  "messages": [
    {
      "type": "log|error|warning|info",
      "text": "Message text",
      "timestamp": 1234567890,
      "stackTrace": { /* optional */ }
    }
  ]
}
```

#### `cdp://runtime/exceptions`

Returns uncaught exceptions.

**Response:**
```json
{
  "exceptions": [
    {
      "timestamp": 1234567890,
      "exceptionDetails": {
        "text": "Error message",
        "lineNumber": 123,
        "columnNumber": 45,
        "url": "https://example.com/script.js"
      }
    }
  ]
}
```

#### `cdp://runtime/properties`

Returns global object properties. Optional query parameter: `?objectId=xxx`

**Response:**
```json
{
  "properties": [
    {
      "name": "propertyName",
      "value": { /* property value */ },
      "configurable": true,
      "enumerable": true
    }
  ]
}
```

#### `cdp://dom/document`

Returns the DOM document structure.

**Response:**
```json
{
  "root": {
    "nodeId": 1,
    "nodeType": 9,
    "nodeName": "#document",
    "children": [ /* child nodes */ ]
  }
}
```

#### `cdp://dom/node?nodeId=123`

Returns details for a specific DOM node.

**Response:**
```json
{
  "node": {
    "nodeId": 123,
    "nodeName": "DIV",
    "attributes": ["class", "container", "id", "main"],
    "children": [ /* child nodes */ ]
  }
}
```

#### `cdp://network/requests`

Returns network request log.

**Response:**
```json
{
  "requests": [
    {
      "requestId": "req-1",
      "url": "https://api.example.com/data",
      "method": "GET",
      "timestamp": 1234567890,
      "response": {
        "status": 200,
        "statusText": "OK",
        "headers": {},
        "mimeType": "application/json"
      }
    }
  ]
}
```

#### `cdp://performance/metrics`

Returns performance metrics.

**Response:**
```json
{
  "metrics": {
    "Timestamp": 123456.789,
    "JSHeapUsedSize": 15728640,
    "JSHeapTotalSize": 33554432,
    "LayoutDuration": 0.045,
    "RecalcStyleDuration": 0.023,
    "ScriptDuration": 0.156
  }
}
```

#### `cdp://page/info`

Returns page information.

**Response:**
```json
{
  "url": "https://example.com",
  "title": "Page Title",
  "viewport": {
    "width": 1920,
    "height": 1080
  },
  "securityState": "secure"
}
```

### React Resources

These resources are only available when React is detected on the page.

#### `react://version`

Returns React version information.

**Response:**
```json
{
  "version": "18.2.0",
  "renderer": "ReactDOM",
  "devToolsPresent": true
}
```

#### `react://fiber-tree`

Returns the React Fiber tree structure.

**Response:**
```json
{
  "root": {
    "type": "HostRoot",
    "children": [
      {
        "type": "App",
        "props": {},
        "state": {},
        "children": []
      }
    ]
  }
}
```

#### `react://components`

Returns list of React components. Optional query: `?name=ComponentName`

**Response:**
```json
{
  "components": [
    {
      "name": "App",
      "type": "function|class",
      "props": {},
      "state": {},
      "hooks": ["useState", "useEffect"]
    }
  ]
}
```

#### `react://hooks`

Returns hooks information for components.

**Response:**
```json
{
  "components": [
    {
      "name": "Counter",
      "hooks": [
        {
          "type": "useState",
          "value": 0,
          "index": 0
        },
        {
          "type": "useEffect",
          "deps": [],
          "index": 1
        }
      ]
    }
  ]
}
```

#### `react://profiler`

Returns React Profiler data.

**Response:**
```json
{
  "enabled": true,
  "interactions": [],
  "measurements": [
    {
      "componentName": "App",
      "phase": "mount|update",
      "actualDuration": 16.5,
      "baseDuration": 15.2
    }
  ]
}
```

### State Management Resources

#### XState Resources (when XState is detected)

##### `xstate://actors`

Returns active XState actors.

**Response:**
```json
{
  "actors": [
    {
      "id": "auth-machine",
      "machineId": "authMachine",
      "state": {
        "value": "authenticated",
        "context": {}
      },
      "sessionId": "session-1"
    }
  ]
}
```

##### `xstate://machines`

Returns XState machine definitions.

**Response:**
```json
{
  "machines": [
    {
      "id": "authMachine",
      "initial": "idle",
      "states": {
        "idle": {},
        "loading": {},
        "authenticated": {}
      }
    }
  ]
}
```

#### Zustand Resources (when Zustand is detected)

##### `zustand://stores`

Returns all Zustand stores.

**Response:**
```json
{
  "stores": [
    {
      "name": "userStore",
      "state": {
        "user": null,
        "isAuthenticated": false
      },
      "subscriberCount": 5
    }
  ]
}
```

#### Apollo Resources (when Apollo Client is detected)

##### `apollo://cache`

Returns Apollo cache contents.

**Response:**
```json
{
  "cache": {
    "ROOT_QUERY": {},
    "User:123": {
      "__typename": "User",
      "id": "123",
      "name": "John Doe"
    }
  }
}
```

##### `apollo://queries`

Returns active queries.

**Response:**
```json
{
  "active": [
    {
      "query": "GetUser",
      "variables": { "id": "123" },
      "loading": false,
      "data": {}
    }
  ]
}
```

## Tools

Tools provide actions to manipulate browser state and debug applications.

### CDP Tools

#### `evaluate`

Evaluates JavaScript expression in the page context.

**Arguments:**
```json
{
  "expression": "document.title",
  "awaitPromise": true,  // optional, default: false
  "returnByValue": true  // optional, default: true
}
```

**Response:**
```json
{
  "success": true,
  "data": "Page Title"
}
```

#### `navigate`

Navigates to a URL.

**Arguments:**
```json
{
  "url": "https://example.com"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "url": "https://example.com/",
    "loaderId": "loader-123"
  }
}
```

#### `screenshot`

Takes a screenshot.

**Arguments:**
```json
{
  "format": "png",  // optional: "png" or "jpeg"
  "quality": 80,    // optional: 0-100 for jpeg
  "fullPage": false // optional: capture full page
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "screenshot": "data:image/png;base64,..."
  }
}
```

#### `get_cookies`

Gets browser cookies.

**Arguments:**
```json
{
  "urls": ["https://example.com"]  // optional
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "cookies": [
      {
        "name": "session",
        "value": "abc123",
        "domain": ".example.com",
        "path": "/",
        "expires": -1,
        "httpOnly": true,
        "secure": true
      }
    ]
  }
}
```

### DOM Tools

#### `dom_query_selector`

Finds DOM element by CSS selector.

**Arguments:**
```json
{
  "selector": ".container"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "nodeId": 123,
    "node": {
      "nodeName": "DIV",
      "attributes": ["class", "container"]
    }
  }
}
```

#### `dom_query_selector_all`

Finds all matching DOM elements.

**Arguments:**
```json
{
  "selector": "button"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "count": 3,
    "nodes": [
      {
        "nodeId": 123,
        "node": { /* node details */ }
      }
    ]
  }
}
```

#### `dom_click_element`

Clicks a DOM element.

**Arguments:**
```json
{
  "nodeId": 123,
  "button": "left"  // optional: "left", "right", "middle"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "nodeId": 123,
    "x": 150,
    "y": 200
  }
}
```

### React Tools

#### `react_find_component`

Finds React components by name.

**Arguments:**
```json
{
  "componentName": "UserProfile"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "found": true,
    "components": [
      {
        "id": "comp-1",
        "name": "UserProfile",
        "props": {},
        "type": "function"
      }
    ]
  }
}
```

#### `react_inspect_props`

Inspects component props.

**Arguments:**
```json
{
  "componentId": "comp-1"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "componentId": "comp-1",
    "name": "UserProfile",
    "props": {
      "userId": "123",
      "showEmail": true
    }
  }
}
```

#### `react_profile_render`

Profiles component render performance.

**Arguments:**
```json
{
  "duration": 5000,  // milliseconds
  "componentName": "App"  // optional
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "componentName": "App",
    "measurements": [
      {
        "phase": "mount",
        "actualDuration": 45.5,
        "baseDuration": 40.2
      }
    ],
    "renderCount": 5,
    "averageRenderTime": 20.4
  }
}
```

### Network Tools

#### `network_enable_request_interception`

Enables network request interception.

**Arguments:**
```json
{
  "patterns": ["*api/*", "*.json"]  // optional
}
```

#### `network_mock_response`

Mocks network responses.

**Arguments:**
```json
{
  "url": "https://api.example.com/users",
  "response": {
    "status": 200,
    "headers": { "Content-Type": "application/json" },
    "body": "[{\"id\":1,\"name\":\"Test User\"}]"
  },
  "regex": false  // optional: treat URL as regex
}
```

#### `network_set_throttling`

Sets network throttling.

**Arguments:**
```json
{
  "profile": "Slow 3G"  // or custom settings
}
```

Or custom:
```json
{
  "downloadThroughput": 1572864,  // bytes/second
  "uploadThroughput": 786432,
  "latency": 40  // milliseconds
}
```

### Performance Tools

#### `performance_start_profiling`

Starts CPU profiling.

**Arguments:**
```json
{
  "samplingInterval": 100  // optional, microseconds
}
```

#### `performance_stop_profiling`

Stops CPU profiling and returns results.

**Response:**
```json
{
  "success": true,
  "data": {
    "profile": { /* CPU profile data */ },
    "duration": 5000,
    "topFunctions": [
      {
        "functionName": "render",
        "url": "app.js",
        "hitCount": 150
      }
    ]
  }
}
```

#### `performance_get_metrics`

Gets performance metrics.

**Response:**
```json
{
  "success": true,
  "data": {
    "metrics": {
      "JSHeapUsedSize": 15728640,
      "LayoutDuration": 0.045,
      "RecalcStyleDuration": 0.023,
      "ScriptDuration": 0.156
    }
  }
}
```

### Debugger Tools

#### `debugger_set_breakpoint`

Sets a breakpoint.

**Arguments:**
```json
{
  "location": {
    "scriptId": "123",
    "lineNumber": 42,
    "columnNumber": 10  // optional
  },
  "condition": "x > 10"  // optional
}
```

#### `debugger_set_breakpoint_by_url`

Sets breakpoint by URL.

**Arguments:**
```json
{
  "url": "https://example.com/app.js",
  "lineNumber": 42,
  "condition": "x > 10"  // optional
}
```

Or with regex:
```json
{
  "urlRegex": ".*\\.js$",
  "lineNumber": 42
}
```

## Prompts

### `debug_react_component`

Template for debugging React components.

**Arguments:**
```json
{
  "componentName": "UserProfile"  // optional
}
```

### `analyze_performance`

Template for performance analysis.

**Arguments:**
```json
{
  "duration": 5000,  // optional
  "focusArea": "rendering"  // optional: "rendering", "network", "scripting"
}
```

### `find_memory_leaks`

Template for finding memory leaks.

### `debug_state_management`

Template for debugging state management.

**Arguments:**
```json
{
  "library": "redux"  // optional: "redux", "zustand", "xstate", "apollo"
}
```

### `trace_user_flow`

Template for tracing user interactions.

**Arguments:**
```json
{
  "flowName": "checkout"  // optional
}
```

## Error Responses

All tools and resources may return error responses:

```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

Common error types:
- Chrome not connected
- Target not found
- Invalid selector
- Script execution failed
- Network error
- Timeout exceeded

## Rate Limits and Performance

- Console messages: Limited to 1000 most recent
- Network requests: Limited to 500 most recent
- WebSocket message size: Max 1MB
- Screenshot size: May be large, use quality parameter
- CPU profiling: May impact page performance

## Best Practices

1. **Check Framework Detection**: Before using React/state tools, verify the framework is detected
2. **Use Specific Selectors**: More specific CSS selectors perform better
3. **Limit Profiling Duration**: Long profiling sessions impact performance
4. **Clean Up Interceptions**: Disable request interception when done
5. **Handle Async Operations**: Use `awaitPromise: true` for async evaluations
6. **Validate Node IDs**: Node IDs can become stale after DOM changes