# Curupira MCP Architecture - Tooling & Language Evaluation

## Executive Summary

After comprehensive research, **TypeScript** emerges as the optimal language choice for all Curupira components due to:
1. Chrome Extension requirement (must be JavaScript/TypeScript)
2. Unified codebase and shared types across all components
3. Strong MCP SDK support with official TypeScript SDK
4. Excellent debugging and DevTools integration
5. Active community and enterprise adoption in 2025

## Language Options Analysis

### TypeScript (Recommended) ✅
**Pros:**
- Official MCP TypeScript SDK (@modelcontextprotocol/sdk)
- Required for Chrome Extension development
- Excellent Chrome DevTools Protocol support
- Strong typing for complex state debugging
- Can share types/interfaces across all components
- Active ecosystem with enterprise support (Microsoft, OpenAI, GitHub)

**Cons:**
- Single language constraint (though this can be a pro for consistency)

### Python
**Pros:**
- Official MCP Python SDK
- FastMCP framework for rapid development
- Popular for AI/ML integrations

**Cons:**
- Cannot be used for Chrome Extension
- Would require maintaining two codebases
- Additional complexity in type sharing

### Rust
**Pros:**
- Official Rust SDK available
- Excellent performance for real-time debugging
- Memory safety guarantees

**Cons:**
- Cannot be used for Chrome Extension
- Steeper learning curve
- Smaller MCP community

### Go
**Pros:**
- Official Go SDK (maintained with Google)
- Good for high-performance servers
- Follows NovaSkyn's "no shell scripts" philosophy

**Cons:**
- Cannot be used for Chrome Extension
- Less mature MCP tooling

## Core Dependencies & Tools

### 1. MCP Protocol Layer
```json
{
  "@modelcontextprotocol/sdk": "latest",
  "@modelcontextprotocol/sdk-server": "latest",
  "@modelcontextprotocol/sdk-client": "latest"
}
```

**Features:**
- Full MCP specification implementation
- Stdio and HTTP/SSE transports
- Resource, Tool, and Prompt abstractions
- TypeScript-first design

### 2. Chrome DevTools Protocol
```json
{
  "devtools-protocol": "latest",
  "chrome-remote-interface": "latest",
  "puppeteer-core": "latest"  // Optional, for advanced automation
}
```

**Features:**
- TypeScript definitions for all CDP domains
- Performance profiling capabilities
- Network inspection and manipulation
- JavaScript execution context access

### 3. WebSocket Communication
```json
{
  "ws": "^8.x",              // Lightweight, performant
  "socket.io": "^4.x",       // Feature-rich alternative
  "@types/ws": "latest"
}
```

**Trade-offs:**
- `ws`: Minimal, fast, perfect for simple bidirectional communication
- `socket.io`: Auto-reconnection, room support, but heavier

### 4. State Management Integration

#### For Zustand Debugging:
```typescript
// Direct access to Zustand stores
const stores = window.__ZUSTAND_STORES__;
// Custom devtools integration with proper TypeScript types
```

#### For Apollo Client:
```typescript
// Apollo Client exposes __APOLLO_CLIENT__ globally
const client = window.__APOLLO_CLIENT__;
// Full cache introspection and query re-execution
```

### 5. React DevTools Integration
```json
{
  "react-devtools-core": "latest"
}
```

**Capabilities:**
- Component tree inspection
- Props/state monitoring
- Performance profiling
- Hooks inspection

## Architecture-Specific Tools

### Chrome Extension Development
```json
{
  "@types/chrome": "latest",
  "webextension-polyfill": "latest",
  "webpack": "^5.x",
  "webpack-extension-reloader": "latest"
}
```

### MCP Server Framework Options

#### Option 1: Vanilla TypeScript + Express
```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server";
import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
```

#### Option 2: NestJS (Enterprise-grade)
```json
{
  "@nestjs/core": "latest",
  "@nestjs/websockets": "latest",
  "@nestjs/platform-ws": "latest"
}
```

**Benefits:**
- Dependency injection
- Modular architecture
- Built-in WebSocket support
- Decorators for clean code

#### Option 3: Fastify (Performance-focused)
```json
{
  "fastify": "latest",
  "@fastify/websocket": "latest",
  "fastify-plugin": "latest"
}
```

**Benefits:**
- Fastest Node.js framework
- Schema-based validation
- Plugin ecosystem

## Testing & Development Tools

### Testing Framework
```json
{
  "vitest": "latest",          // Fast, Vite-native
  "playwright": "latest",      // E2E testing with CDP
  "@testing-library/react": "latest",
  "msw": "latest"             // API mocking
}
```

### Development Tools
```json
{
  "tsx": "latest",            // TypeScript execution
  "nodemon": "latest",        // Auto-restart
  "concurrently": "latest",   // Run multiple processes
  "dotenv": "latest"          // Environment management
}
```

## Deployment Considerations

### Container Strategy
- Use multi-stage Dockerfile for optimal image size
- Node.js Alpine base image for production
- Separate development and production configurations

### Kubernetes Integration
```yaml
# WebSocket support in Istio
annotations:
  sidecar.istio.io/inject: "true"
spec:
  ports:
    - name: websocket
      port: 8080
      protocol: TCP
```

## Community Resources & Examples

### Official MCP Examples (2025)
1. **Filesystem Server** - Node.js/TypeScript reference
2. **Database Servers** - PostgreSQL, CockroachDB integrations
3. **Google Drive Server** - OAuth and file access patterns
4. **Slack Server** - Real-time messaging integration

### Integration Patterns
- Zed Editor - Native MCP support
- Replit - Embedded development environment
- Sourcegraph - Code intelligence integration

## Recommended Stack

Based on analysis, here's the optimal stack for Curupira:

```typescript
// Primary Stack
- Language: TypeScript 5.x
- Runtime: Node.js 20+ LTS
- Framework: Fastify (MCP Server)
- WebSocket: ws library
- Build: Vite (Extension) + tsx (Server)
- Testing: Vitest + Playwright
- Linting: ESLint + Prettier

// Chrome Extension
- Manifest V3
- Content Scripts + Background Service Worker
- WebExtension Polyfill for cross-browser support

// MCP Server
- Official TypeScript SDK
- HTTP/SSE Transport for remote connections
- Stdio Transport for local development
```

## Migration Path from Prototype to Production

1. **Phase 1**: Basic TypeScript implementation with core features
2. **Phase 2**: Add comprehensive error handling and logging
3. **Phase 3**: Implement authentication and security
4. **Phase 4**: Scale with connection pooling and clustering
5. **Phase 5**: Add monitoring and observability

## Conclusion

TypeScript provides the most cohesive solution for Curupira, offering:
- Single language across all components
- Strong typing for complex debugging scenarios
- Excellent tooling and IDE support
- Active community with enterprise backing
- Proven scalability for similar tools

The ecosystem is mature in 2025 with official support from major players (Microsoft, OpenAI, Google) ensuring long-term viability.