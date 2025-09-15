# Curupira MCP Server API Documentation

## Overview

Curupira MCP Server provides a Model Context Protocol (MCP) interface for debugging React applications through Chrome DevTools Protocol (CDP). This document describes all available resources, tools, and prompts.

## Table of Contents

- [Resources](#resources)
  - [Browser Resources](#browser-resources)
  - [React Resources](#react-resources)
  - [State Management Resources](#state-management-resources)
  - [Network Resources](#network-resources)
- [Tools](#tools)
  - [DOM Tools](#dom-tools)
  - [Runtime Tools](#runtime-tools)
  - [Network Tools](#network-tools)
  - [Performance Tools](#performance-tools)
- [Prompts](#prompts)
- [Authentication](#authentication)
- [Error Handling](#error-handling)

## Resources

Resources provide read-only access to browser and application state.

### Browser Resources

#### `browser://page/info`
Get current page information.

**Response:**
```json
{
  "url": "https://example.com",
  "title": "Example Page",
  "viewport": {
    "width": 1920,
    "height": 1080,
    "deviceScaleFactor": 1
  },
  "userAgent": "Mozilla/5.0...",
  "secure": true,
  "timestamp": "2024-01-15T10:00:00Z"
}
```

#### `browser://console/logs`
Get console logs (last 1000 entries).

**Response:**
```json
{
  "logs": [
    {
      "level": "info",
      "text": "Application started",
      "timestamp": 1234567890,
      "source": "console-api",
      "args": ["Application", "started"]
    }
  ],
  "total": 42,
  "truncated": false
}
```

#### `browser://storage/all`
Get all browser storage data.

**Response:**
```json
{
  "localStorage": {
    "key1": "value1"
  },
  "sessionStorage": {
    "session_id": "abc123"
  },
  "cookies": [
    {
      "name": "session",
      "value": "[REDACTED]",
      "domain": ".example.com",
      "path": "/",
      "secure": true,
      "httpOnly": true
    }
  ]
}
```

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

Tools provide actions that can modify browser state.

### DOM Tools

#### `dom/querySelector`
Find elements using CSS selector.

**Parameters:**
```json
{
  "selector": ".btn-primary",
  "all": false
}
```

**Response:**
```json
{
  "selector": ".btn-primary",
  "found": true,
  "elements": [
    {
      "tagName": "button",
      "id": "submit-btn",
      "className": "btn btn-primary",
      "textContent": "Submit",
      "boundingBox": {
        "x": 100,
        "y": 200,
        "width": 120,
        "height": 40
      }
    }
  ]
}
```

#### `dom/click`
Click an element.

**Parameters:**
```json
{
  "selector": "#submit-btn"
}
```

#### `dom/setAttribute`
Set element attribute.

**Parameters:**
```json
{
  "selector": "#my-input",
  "attribute": "value",
  "value": "new value"
}
```

#### `dom/highlight`
Highlight element temporarily.

**Parameters:**
```json
{
  "selector": ".error-message",
  "color": "#ff0000",
  "duration": 2000
}
```

### Runtime Tools

#### `runtime/evaluate`
Execute JavaScript in page context.

**Parameters:**
```json
{
  "expression": "document.title",
  "awaitPromise": true,
  "returnByValue": true
}
```

**Security Note:** Expressions are sanitized and dangerous patterns are blocked in production.

#### `runtime/consoleLog`
Log message to browser console.

**Parameters:**
```json
{
  "level": "info",
  "message": "Debug message",
  "args": ["additional", "data"]
}
```

#### `runtime/setGlobal`
Set global variable.

**Parameters:**
```json
{
  "name": "DEBUG_MODE",
  "value": true
}
```

### Network Tools

#### `network/setCacheDisabled`
Enable/disable browser cache.

**Parameters:**
```json
{
  "disabled": true
}
```

#### `network/throttleNetwork`
Simulate slow network (requires additional setup).

**Parameters:**
```json
{
  "downloadThroughput": 50000,
  "uploadThroughput": 20000,
  "latency": 200
}
```

### Performance Tools

#### `performance/captureMetrics`
Capture performance metrics.

**Parameters:**
```json
{
  "categories": ["paint", "layout", "script", "network", "memory"]
}
```

**Response:**
```json
{
  "timestamp": 1234567890,
  "metrics": {
    "paint": {
      "firstPaint": 120.5,
      "firstContentfulPaint": 250.3,
      "largestContentfulPaint": 450.7
    },
    "memory": {
      "usedJSHeapSize": 15000000,
      "totalJSHeapSize": 30000000
    }
  }
}
```

#### `performance/analyzeLongTasks`
Analyze long-running tasks.

**Parameters:**
```json
{
  "threshold": 50
}
```

## Prompts

Pre-configured prompts for common debugging scenarios.

### `debug-react-component`
Debug a specific React component.

**Arguments:**
- `componentName`: Name of the component to debug

### `debug-state-issue`
Debug state management issues.

**Arguments:**
- `problem`: Description of the issue
- `stateDescription`: What state to look for

### `analyze-performance`
Analyze application performance.

**Arguments:**
- `targetArea`: Area to analyze (e.g., "checkout flow")

### `debug-network-requests`
Debug network request issues.

**Arguments:**
- `endpoint`: API endpoint or URL pattern

### `debug-cart-state`
Debug shopping cart state (e-commerce specific).

### `debug-application`
General application debugging.

## Authentication

### Development Mode
Authentication is disabled by default in development mode.

### Staging/Production
JWT authentication is required. Include the token in:

**Authorization Header:**
```
Authorization: Bearer <jwt-token>
```

**Query Parameter (for SSE):**
```
/mcp?token=<jwt-token>
```

### JWT Token Structure
```json
{
  "sub": "user-id",
  "iat": 1234567890,
  "exp": 1234571490,
  "aud": "curupira-mcp",
  "iss": "curupira.nexus.io",
  "scope": ["read", "write"]
}
```

## Error Handling

### Error Response Format
```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Resource not found: react://component/invalid",
    "details": {
      "uri": "react://component/invalid"
    }
  }
}
```

### Common Error Codes
- `RESOURCE_NOT_FOUND`: Requested resource doesn't exist
- `TOOL_NOT_FOUND`: Unknown tool name
- `INVALID_PARAMETERS`: Tool parameters validation failed
- `CDP_ERROR`: Chrome DevTools Protocol error
- `AUTHENTICATION_FAILED`: Invalid or missing auth token
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `SECURITY_BLOCKED`: Operation blocked by security policy

## Rate Limiting

### Default Limits
- Global: 100 requests per minute
- MCP endpoint: 1000 requests per minute
- Health/Metrics: 10 requests per minute

### Rate Limit Headers
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1234567890
Retry-After: 60
```

## Health & Monitoring

### Health Check Endpoint
```
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:00:00Z",
  "uptime": 3600000,
  "checks": {
    "chrome": {
      "connected": true,
      "version": "121.0.6167.85"
    },
    "memory": {
      "heapUsed": 50000000,
      "heapTotal": 100000000
    }
  }
}
```

### Metrics Endpoint (Prometheus Format)
```
GET /metrics
```

**Response:**
```
curupira_uptime_seconds 3600
curupira_memory_heap_used_bytes 50000000
curupira_chrome_connected 1
curupira_resources_count 15
curupira_tools_count 20
```