# Curupira - MCP Frontend Debugging Tool Specification

## Overview

**Curupira** is a Model Context Protocol (MCP) debugging tool that provides AI assistants with direct access to browser DevTools, React state, and runtime debugging capabilities for the NovaSkyn frontend. Named after the Brazilian forest guardian spirit with backward feet, Curupira helps developers trace backwards through code execution to find and fix issues.

**Project Location**: `/home/luis/code/github/pleme-io/nexus/pkgs/tools/curupira/`

## Current Status: Specification Phase

### Architecture Overview

Curupira consists of three components working together:

1. **Chrome Extension** (TypeScript)
   - Injects scripts into the NovaSkyn frontend
   - Accesses Chrome DevTools Protocol
   - Bridges browser and MCP server

2. **MCP Server** (TypeScript + Fastify)
   - Implements MCP protocol specification
   - WebSocket communication with extension
   - Exposes debugging capabilities as MCP resources/tools

3. **Frontend Integration** (TypeScript)
   - Minimal runtime injected into NovaSkyn
   - Hooks for state management libraries
   - Performance monitoring

The system provides:
- **Browser DevTools API access** for console logs, network monitoring, DOM inspection
- **React DevTools integration** for component state, props, and render tracking
- **State management access** for XState machines, Zustand stores, Apollo cache
- **Runtime debugging** capabilities including breakpoints and expression evaluation
- **WebSocket-based communication** for real-time bidirectional data flow

### Technology Stack

- **Language**: TypeScript (entire project)
- **Runtime**: Node.js 20+ LTS
- **MCP SDK**: @modelcontextprotocol/sdk (official TypeScript SDK)
- **Server Framework**: Fastify (performance-focused)
- **WebSocket**: ws library (lightweight, performant)
- **Chrome DevTools**: chrome-remote-interface + devtools-protocol
- **Build Tools**: Vite (extension) + tsx (server)
- **Testing**: Vitest + Playwright
- **Protocol**: MCP over WebSocket with HTTP/SSE support
- **Integration**: React DevTools API, Chrome DevTools Protocol

### Frontend Technologies in Use

- **Build Tool**: Vite 5.0.8 with React plugin
- **React**: 18.2.0 with React Router 7.8.0
- **State Management**: 
  - Zustand 5.0.7 with devtools, persist, and immer middleware
  - XState 5.20.2 with @xstate/react 6.0.0
- **GraphQL**: Apollo Client 3.13.9 with graphql-ws, apollo3-cache-persist
- **UI Libraries**: 
  - @ariakit/react 0.4.18
  - @headlessui/react 2.2.7
  - Framer Motion 12.23.12
  - Lucide React icons
- **Forms**: React Hook Form 7.62.0 with Zod 4.0.17 validation
- **Testing**: Vitest 3.2.4, Playwright 1.55.0, MSW 2.11.2
- **CSS**: Panda CSS 1.1.0 (CSS-in-JS)
- **PWA**: vite-plugin-pwa with Workbox

## Curupira Implementation Task List

### Phase 0: Project Setup & Dependencies (1 day)

#### Task 0.1: Create Curupira Project Structure

- [ ] Create directory structure:
  ```bash
  mkdir -p pkgs/tools/curupira/{chrome-extension,mcp-server,shared,docs,k8s}
  cd pkgs/tools/curupira
  ```
- [ ] Initialize TypeScript monorepo with workspaces
- [ ] Create base `package.json` with workspace configuration
- [ ] Setup shared TypeScript configurations
- [ ] Create README.md with project overview
- **Output**: Curupira project structure created

#### Task 0.2: Install Core Dependencies

- [ ] Install MCP SDK and TypeScript:
  ```bash
  npm install --save @modelcontextprotocol/sdk@latest
  npm install --save-dev typescript@^5.3.0 @types/node@^20.0.0
  ```
- [ ] Install server dependencies:
  ```bash
  npm install --save fastify@^4.26.0 @fastify/websocket@^8.3.0
  npm install --save ws@^8.16.0 @types/ws@^8.5.0
  ```
- [ ] Install Chrome DevTools Protocol:
  ```bash
  npm install --save devtools-protocol@latest
  npm install --save chrome-remote-interface@^0.33.0
  npm install --save-dev @types/chrome-remote-interface@^0.31.0
  ```
- [ ] Install development tools:
  ```bash
  npm install --save-dev tsx@^4.7.0 nodemon@^3.0.0 concurrently@^8.2.0
  npm install --save-dev vitest@^1.2.0 @vitest/ui@^1.2.0
  npm install --save-dev eslint@^8.56.0 prettier@^3.2.0
  ```
- **Output**: All core dependencies installed

#### Task 0.3: Setup Chrome Extension Dependencies

- [ ] Install Chrome extension dependencies:
  ```bash
  cd chrome-extension
  npm install --save-dev @types/chrome@latest
  npm install --save-dev webextension-polyfill@^0.10.0
  npm install --save-dev vite@^5.0.0 @vitejs/plugin-react@^4.2.0
  npm install --save-dev @crxjs/vite-plugin@^2.0.0
  ```
- [ ] Create Chrome manifest v3 configuration
- [ ] Setup Vite for extension bundling
- [ ] Configure content security policy
- **Output**: Chrome extension build system ready

#### Task 0.4: Configure TypeScript and Build System

- [ ] Create root `tsconfig.json` with strict mode
- [ ] Create workspace-specific TypeScript configs:
  ```
  tsconfig.server.json    # MCP server config
  tsconfig.extension.json # Chrome extension config
  tsconfig.shared.json    # Shared types/utilities
  ```
- [ ] Setup path aliases for clean imports
- [ ] Configure build scripts in package.json:
  ```json
  {
    "scripts": {
      "dev": "concurrently \"npm:dev:*\"",
      "dev:server": "tsx watch mcp-server/src/index.ts",
      "dev:extension": "cd chrome-extension && vite build --watch",
      "build": "npm run build:shared && npm run build:server && npm run build:extension",
      "test": "vitest",
      "lint": "eslint . --fix",
      "type-check": "tsc --noEmit"
    }
  }
  ```
- [ ] Create `.env.example` with required variables
- **Output**: Complete TypeScript build system configured

### Phase 1: Core MCP Server Implementation (2 days)

#### Task 1.1: Create MCP Server with Fastify

- [ ] Create directory structure:
  ```
  mcp-server/src/
  ├── index.ts                 # Server entry point
  ├── server.ts                # Fastify + MCP setup
  ├── config/                  
  │   ├── index.ts            # Configuration management
  │   └── schema.ts           # Config validation with Zod
  ├── mcp/
  │   ├── resources/          # MCP resource providers
  │   │   ├── console.ts      # Console logs access
  │   │   ├── network.ts      # Network requests
  │   │   ├── dom.ts          # DOM inspection
  │   │   └── state.ts        # State management access
  │   ├── tools/              # MCP tool implementations  
  │   │   ├── debugger.ts     # Breakpoint management
  │   │   ├── profiler.ts     # Performance profiling
  │   │   ├── inspector.ts    # Element inspection
  │   │   └── evaluator.ts    # Expression evaluation
  │   └── prompts/            # MCP prompt templates
  │       └── debugging.ts     # Common debugging prompts
  ├── integrations/           # Library integrations
  │   ├── cdp.ts             # Chrome DevTools Protocol
  │   ├── react.ts           # React DevTools
  │   ├── xstate.ts          # XState inspection
  │   ├── zustand.ts         # Zustand stores
  │   └── apollo.ts          # Apollo Client
  ├── transport/              
  │   ├── websocket.ts       # WebSocket transport
  │   └── sse.ts             # Server-Sent Events
  └── types/                  
      ├── index.ts           # Shared types
      └── branded.ts         # Branded types
  ```
- [ ] Implement Fastify server with plugins:
  ```typescript
  import Fastify from 'fastify'
  import websocket from '@fastify/websocket'
  import { McpServer } from '@modelcontextprotocol/sdk/server'
  
  const server = Fastify({ logger: true })
  await server.register(websocket)
  ```
- [ ] Setup MCP server instance with capabilities
- [ ] Configure CORS for extension communication
- **Output**: Fastify-based MCP server ready

#### Task 1.2: Test MCP Server Setup

- [ ] Write unit tests for WebSocket connection handling
- [ ] Test MCP protocol handshake
- [ ] Test JSON-RPC message parsing
- [ ] Test error handling and reconnection
- [ ] Run: `npm test src/mcp-server/server.test.ts`

#### Task 1.3: Implement MCP Protocol with TypeScript SDK

- [ ] Create MCP server using official SDK:
  ```typescript
  import { Server } from '@modelcontextprotocol/sdk/server/index.js'
  import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
  import { WebSocketServerTransport } from './transport/websocket.js'
  
  const mcpServer = new Server({
    name: 'curupira',
    version: '1.0.0',
    capabilities: {
      resources: true,
      tools: true,
      prompts: true
    }
  })
  ```
- [ ] Implement resource providers:
  - Console logs with filtering
  - Network requests with details
  - DOM tree with selectors
  - State snapshots with diffs
- [ ] Implement tool providers:
  - Expression evaluation in page context
  - Element inspection with styles
  - Breakpoint management
  - Performance profiling
- [ ] Add debugging prompt templates:
  - "Debug lazy loading issue"
  - "Trace GraphQL error"
  - "Profile component renders"
- [ ] Setup transport handlers (WebSocket + SSE)
- **Output**: MCP protocol fully implemented

#### Task 1.4: Test MCP Protocol Implementation

- [ ] Test resource listing and retrieval
- [ ] Test tool invocation with parameters
- [ ] Test prompt template rendering
- [ ] Test protocol compliance with MCP spec
- [ ] Run: `npm test src/mcp-server/protocol.test.ts`

### Phase 2: Chrome Extension Development (3 days)

#### Task 2.1: Create Chrome Extension with TypeScript

- [ ] Create extension structure:
  ```
  chrome-extension/
  ├── src/
  │   ├── manifest.json       # Manifest v3
  │   ├── background/
  │   │   └── service-worker.ts
  │   ├── content/
  │   │   ├── index.ts       # Content script entry
  │   │   └── bridge.ts      # Page context bridge
  │   ├── devtools/
  │   │   ├── devtools.html
  │   │   ├── panel.html     # Curupira panel
  │   │   └── devtools.ts
  │   ├── injected/          # Page context scripts
  │   │   ├── hooks.ts       # Library hooks
  │   │   ├── react.ts       # React integration
  │   │   ├── state.ts       # State management
  │   │   └── network.ts     # Network interception
  │   ├── popup/
  │   │   ├── popup.html
  │   │   └── popup.ts       # Extension popup
  │   └── shared/
  │       ├── messages.ts    # Message types
  │       └── storage.ts     # Chrome storage API
  ├── public/                # Static assets
  │   └── icons/
  ├── vite.config.ts         # Vite configuration
  └── package.json
  ```
- [ ] Configure manifest.json:
  ```json
  {
    "manifest_version": 3,
    "name": "Curupira - MCP Debugger",
    "permissions": [
      "debugger",
      "tabs",
      "storage",
      "webNavigation"
    ],
    "host_permissions": [
      "http://localhost:*/*",
      "https://*.novaskyn.com/*"
    ]
  }
  ```
- [ ] Implement TypeScript message passing
- [ ] Setup Vite build with @crxjs/vite-plugin
- **Output**: TypeScript Chrome extension ready

#### Task 2.2: Test Browser Extension

- [ ] Test content script injection
- [ ] Test DevTools API access permissions
- [ ] Test WebSocket connection from extension
- [ ] Test message passing between contexts
- [ ] Run: Manual testing with Chrome DevTools

#### Task 2.3: Chrome DevTools Protocol Integration

- [ ] Implement CDP client with TypeScript:
  ```typescript
  import CDP from 'chrome-remote-interface'
  import type { Client } from 'devtools-protocol'
  
  class DevToolsClient {
    private client: Client
    
    async connect(port: number) {
      this.client = await CDP({ port })
      await this.setupDomains()
    }
    
    private async setupDomains() {
      await this.client.Console.enable()
      await this.client.Network.enable()
      await this.client.DOM.enable()
      await this.client.Performance.enable()
    }
  }
  ```
- [ ] Capture console messages with stack traces
- [ ] Monitor network requests with timing
- [ ] Implement DOM inspection with CSS
- [ ] Add performance metrics collection
- [ ] Track memory usage and leaks
- **Output**: Complete CDP integration

#### Task 2.4: Test DevTools Integration

- [ ] Test console message capture with filtering
- [ ] Test network request interception
- [ ] Test DOM query and manipulation
- [ ] Test performance metric collection
- [ ] Run: `npm test src/mcp-server/devtools.test.ts`

#### Task 2.5: React DevTools Integration

- [ ] Hook into React DevTools global `__REACT_DEVTOOLS_GLOBAL_HOOK__`
- [ ] Access React 18 component tree and props
- [ ] Monitor component renders with React.Profiler API
- [ ] Track React hooks state (useState, useEffect, custom hooks)
- [ ] Capture React error boundaries and Suspense states
- [ ] Integrate with React Router 7 for route debugging
- [ ] Support React.StrictMode double-render detection
- **Output**: React 18-specific debugging capabilities

#### Task 2.6: Test React Integration

- [ ] Test component tree traversal
- [ ] Test prop and state inspection
- [ ] Test render tracking accuracy
- [ ] Test hook state access
- [ ] Run: `npm test src/mcp-server/react-devtools.test.ts`

### Phase 3: State Management Integration (2 days)

#### Task 3.1: XState v5 Integration with TypeScript

- [ ] Create XState inspector with TypeScript:
  ```typescript
  import { type Actor, type AnyStateMachine } from 'xstate'
  
  interface XStateInspector {
    actors: Map<string, Actor<any>>
    inspectionEvents: InspectionEvent[]
    
    setupInspection(): void
    discoverActors(): ActorInfo[]
    sendEvent(actorId: string, event: any): void
    getSnapshot(actorId: string): any
  }
  ```
- [ ] Hook into XState v5 inspection API
- [ ] Track actor lifecycle events
- [ ] Capture state snapshots with diffs
- [ ] Monitor event processing
- [ ] Build actor hierarchy visualization
- [ ] Support spawned actors and invoke
- [ ] Handle input/output system
- **Output**: Complete XState v5 debugging

#### Task 3.2: Test XState Integration

- [ ] Test machine discovery
- [ ] Test state inspection
- [ ] Test event sending
- [ ] Test transition tracking
- [ ] Run: `npm test src/mcp-server/xstate.test.ts`

#### Task 3.3: Zustand Integration with TypeScript

- [ ] Create Zustand inspector:
  ```typescript
  interface ZustandInspector {
    stores: Map<string, StoreApi<any>>
    
    registerStore(name: string, store: StoreApi<any>): void
    getStores(): StoreInfo[]
    getState(storeName: string): any
    setState(storeName: string, updates: any): void
    subscribe(storeName: string, listener: StateListener): Unsubscribe
  }
  ```
- [ ] Auto-discover stores with devtools middleware
- [ ] Monitor state changes with diffs
- [ ] Support immer middleware updates
- [ ] Track action history with timestamps
- [ ] Inspect persist middleware data
- [ ] Handle cross-tab synchronization
- [ ] Redux DevTools Extension bridge
- **Output**: Full Zustand debugging support

#### Task 3.4: Test Zustand Integration

- [ ] Test store discovery
- [ ] Test state reading
- [ ] Test state mutation
- [ ] Test subscription handling
- [ ] Run: `npm test src/mcp-server/zustand.test.ts`

#### Task 3.5: Apollo Client Integration with TypeScript

- [ ] Create Apollo inspector:
  ```typescript
  import type { ApolloClient, NormalizedCacheObject } from '@apollo/client'
  
  interface ApolloInspector {
    client: ApolloClient<NormalizedCacheObject>
    
    getCacheContents(): CacheData
    getActiveQueries(): QueryInfo[]
    getActiveMutations(): MutationInfo[]
    getActiveSubscriptions(): SubscriptionInfo[]
    writeToCache(query: any, data: any): void
    evictFromCache(id: string): void
  }
  ```
- [ ] Access InMemoryCache contents
- [ ] Monitor query/mutation lifecycle
- [ ] Track subscription status
- [ ] Inspect network layer (Link)
- [ ] Monitor WebSocket connections
- [ ] Support cache persistence
- [ ] Track optimistic responses
- [ ] Handle error policies
- **Output**: Complete Apollo debugging

#### Task 3.6: Test Apollo Integration

- [ ] Test cache inspection
- [ ] Test query monitoring
- [ ] Test cache updates
- [ ] Test optimistic response tracking
- [ ] Run: `npm test src/mcp-server/apollo.test.ts`

### Phase 4: Advanced Debugging Features (2 days)

#### Task 4.1: Breakpoint Management

- [ ] Set conditional breakpoints in code
- [ ] Pause on specific events
- [ ] Step through execution
- [ ] Inspect call stack
- [ ] Evaluate expressions in scope
- **Output**: Interactive debugging via MCP

#### Task 4.2: Test Breakpoint Features

- [ ] Test breakpoint setting/removal
- [ ] Test conditional breakpoints
- [ ] Test stepping operations
- [ ] Test expression evaluation
- [ ] Run: `npm test src/mcp-server/debugger.test.ts`

#### Task 4.3: Performance Profiling

- [ ] Start/stop performance recordings
- [ ] Capture React Profiler data
- [ ] Monitor memory usage
- [ ] Track component render times
- [ ] Generate flame graphs
- **Output**: Performance analysis through MCP

#### Task 4.4: Test Performance Features

- [ ] Test profiling start/stop
- [ ] Test data collection accuracy
- [ ] Test memory leak detection
- [ ] Test render performance tracking
- [ ] Run: `npm test src/mcp-server/profiler.test.ts`

#### Task 4.5: Time Travel Debugging

- [ ] Record application state changes
- [ ] Replay state transitions
- [ ] Jump to specific timestamps
- [ ] Export/import recordings
- [ ] Compare state snapshots
- **Output**: State time machine via MCP

#### Task 4.6: Test Time Travel Features

- [ ] Test state recording
- [ ] Test replay accuracy
- [ ] Test timestamp navigation
- [ ] Test recording persistence
- [ ] Run: `npm test src/mcp-server/time-travel.test.ts`

### Phase 5: Security & Deployment (1 day)

#### Task 5.1: Security Implementation

- [ ] Implement JWT authentication:
  ```typescript
  interface AuthConfig {
    enabled: boolean
    jwtSecret: string
    allowedOrigins: string[]
    tokenExpiry: string
  }
  ```
- [ ] Add rate limiting with @fastify/rate-limit
- [ ] Sanitize sensitive data (tokens, passwords)
- [ ] Configure CORS with allowed origins
- [ ] Add request validation with Zod
- [ ] Implement audit logging
- [ ] Security headers (helmet)
- **Output**: Secure MCP server

#### Task 5.2: Test Security Features

- [ ] Test authentication flow
- [ ] Test rate limiting behavior
- [ ] Test data sanitization
- [ ] Test CORS handling
- [ ] Run: `npm test src/mcp-server/security.test.ts`

#### Task 5.3: Kubernetes Deployment (NovaSkyn Pattern)

- [ ] Create multi-stage Dockerfile:
  ```dockerfile
  FROM node:20-alpine AS builder
  WORKDIR /app
  COPY . .
  RUN npm ci && npm run build
  
  FROM node:20-alpine
  WORKDIR /app
  COPY --from=builder /app/dist ./dist
  COPY --from=builder /app/node_modules ./node_modules
  EXPOSE 8080
  CMD ["node", "dist/mcp-server/src/index.js"]
  ```
- [ ] Create Kubernetes manifests:
  ```
  k8s/
  ├── base/
  │   ├── deployment.yaml
  │   ├── service.yaml
  │   ├── configmap.yaml
  │   └── kustomization.yaml
  └── overlays/
      └── staging/
          ├── deployment-patch.yaml
          └── kustomization.yaml
  ```
- [ ] Configure for Istio service mesh
- [ ] Add WebSocket support annotations
- [ ] Create FluxCD compatible structure
- **Output**: Kubernetes-ready deployment

#### Task 5.4: Test Deployment

- [ ] Test Docker build process
- [ ] Test container health checks
- [ ] Test environment configuration
- [ ] Test monitoring endpoints
- [ ] Run: `./scripts/test-curupira-deployment.sh`

#### Task 5.5: Developer Experience

- [ ] Create developer CLI:
  ```bash
  npx curupira start         # Start MCP server
  npx curupira connect       # Connect to frontend
  npx curupira debug <url>   # Debug specific page
  ```
- [ ] Add VS Code integration guide
- [ ] Create comprehensive documentation
- [ ] Setup GitHub Actions CI/CD
- [ ] Add telemetry for usage insights
- [ ] Create video tutorials
- **Output**: Excellent developer experience

#### Task 5.6: End-to-End Testing

- [ ] Test complete debugging workflow
- [ ] Test with real NovaSkyn app
- [ ] Verify all MCP capabilities
- [ ] Performance benchmarking
- [ ] Run: `npm test:e2e:mcp`

## Implementation Details

### Curupira MCP Server Architecture

```typescript
// mcp-server/src/server.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import Fastify from 'fastify'
import websocket from '@fastify/websocket'
import CDP from 'chrome-remote-interface'
import type { ApolloClient } from '@apollo/client'

export class CurupiraMCPServer {
  private mcpServer: Server
  private fastify: ReturnType<typeof Fastify>
  
  constructor() {
    this.mcpServer = new Server({
      name: 'curupira',
      version: '1.0.0',
      capabilities: {
        resources: true,
        tools: true,
        prompts: true,
      }
    })
    
    this.setupResourceProviders()
    this.setupToolProviders()
    this.setupPromptTemplates()
  }
  
  private setupResourceProviders() {
    // Console logs
    this.mcpServer.setResourceHandler(async (uri) => {
      if (uri.startsWith('console://')) {
        return {
          contents: await this.getConsoleLogs(),
          mimeType: 'application/json'
        }
      }
    })
    
    // Network requests
    this.mcpServer.setResourceHandler(async (uri) => {
      if (uri.startsWith('network://')) {
        return {
          contents: await this.getNetworkRequests(),
          mimeType: 'application/json'
        }
      }
    })
  }
  
  private setupToolProviders() {
    // Evaluate expression
    this.mcpServer.setToolHandler(async (name, args) => {
      if (name === 'eval') {
        return await this.evaluateExpression(args.expression)
      }
    })
    
    // Inspect element
    this.mcpServer.setToolHandler(async (name, args) => {
      if (name === 'inspect') {
        return await this.inspectElement(args.selector)
      }
    })
  }
}
```

### Chrome Extension Bridge

```typescript
// chrome-extension/src/content/bridge.ts
export class CurupiraBridge {
  constructor() {
    this.ws = new WebSocket('ws://localhost:8080/mcp')
    this.setupDevToolsHooks()
    this.setupReactDevToolsHooks()
    this.setupZustandHooks()
    this.setupXStateHooks()
    this.setupApolloHooks()
  }
  
  setupDevToolsHooks() {
    // Intercept console methods
    const originalLog = console.log
    console.log = (...args) => {
      this.sendToMCP('console.log', args)
      originalLog.apply(console, args)
    }
    
    // Monitor network requests
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'resource') {
          this.sendToMCP('network.request', entry)
        }
      }
    })
    observer.observe({ entryTypes: ['resource'] })
  }
  
  setupReactDevToolsHooks() {
    // Hook into React DevTools global
    if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
      const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__
      
      // Monitor component updates
      hook.onCommitFiberRoot = (id, root) => {
        this.sendToMCP('react.commit', { id, root })
      }
    }
  }
}
```

### State Management Integration

```typescript
// mcp-server/src/integrations/xstate.ts
import { inspect } from '@xstate/inspect'

export class XStateInspector {
  private actors = new Map()
  private inspectionEvents: any[] = []
  
  setupInspection() {
    // XState v5 inspection API
    window.__xstate_inspect__ = (inspectionEvent) => {
      this.inspectionEvents.push(inspectionEvent)
      
      switch (inspectionEvent.type) {
        case '@xstate.actor':
          this.handleActorEvent(inspectionEvent)
          break
        case '@xstate.snapshot':
          this.handleSnapshotEvent(inspectionEvent)
          break
        case '@xstate.event':
          this.handleEventEvent(inspectionEvent)
          break
      }
    }
  }
  
  discoverActors() {
    // Get all active actors in the system
    return Array.from(this.actors.values()).map(actor => ({
      id: actor.id,
      type: actor.type,
      state: actor.snapshot?.value,
      context: actor.snapshot?.context,
      parent: actor.parent?.id
    }))
  }
  
  sendEvent(machineId: string, event: any) {
    const machine = this.machines.get(machineId)
    if (machine) {
      machine.send(event)
    }
  }
}

// mcp-server/src/integrations/zustand.ts
export class ZustandInspector {
  private stores = new Map()
  private reduxDevTools = window.__REDUX_DEVTOOLS_EXTENSION__
  
  setupStoreTracking() {
    // Hook into Redux DevTools used by Zustand
    if (this.reduxDevTools) {
      const connection = this.reduxDevTools.connect({
        name: 'Zustand MCP Inspector'
      })
      
      // Track all Zustand stores with devtools middleware
      window.__zustand_mcp_register__ = (store, name) => {
        this.stores.set(name, store)
        
        // Subscribe to store changes
        store.subscribe((state, prevState) => {
          connection.send({ type: `${name}/stateChange`, state }, state)
          this.sendToMCP('zustand.update', { store: name, state, prevState })
        })
      }
    }
  }
  
  discoverStores() {
    // Get all registered stores
    const storeData = []
    this.stores.forEach((store, name) => {
      const state = store.getState()
      storeData.push({
        name,
        state,
        persist: store.persist !== undefined,
        actions: Object.keys(state).filter(key => typeof state[key] === 'function')
      })
    })
    return storeData
  }
  
  updateStore(storeName: string, updates: any) {
    const store = this.stores.get(storeName)
    if (store) {
      store.setState(updates)
    }
  }
}
```

### Development Environment Setup

```bash
# .env.development
CURUPIRA_PORT=8080
CURUPIRA_HOST=localhost
CURUPIRA_WS_URL=ws://localhost:8080/mcp
CURUPIRA_AUTH_ENABLED=false
CURUPIRA_LOG_LEVEL=debug
```

### Staging Environment Setup

```bash
# .env.staging
CURUPIRA_WS_URL=wss://curupira.novaskyn.staging.plo.quero.local/mcp
CURUPIRA_AUTH_ENABLED=true
CURUPIRA_AUTH_TOKEN=${CURUPIRA_STAGING_AUTH_TOKEN}
CURUPIRA_ALLOWED_ORIGINS=https://novaskyn.staging.plo.quero.local
```

### Curupira Package.json Scripts

```json
{
  "name": "curupira",
  "version": "1.0.0",
  "private": true,
  "workspaces": [
    "mcp-server",
    "chrome-extension",
    "shared"
  ],
  "scripts": {
    "dev": "concurrently -n server,extension \"npm:dev:*\"",
    "dev:server": "cd mcp-server && npm run dev",
    "dev:extension": "cd chrome-extension && npm run dev",
    "build": "npm run build:shared && npm run build:server && npm run build:extension",
    "build:shared": "cd shared && npm run build",
    "build:server": "cd mcp-server && npm run build",
    "build:extension": "cd chrome-extension && npm run build",
    "test": "vitest",
    "lint": "eslint . --fix",
    "type-check": "tsc --noEmit",
    "chrome:dev": "google-chrome --load-extension=./chrome-extension/dist --user-data-dir=/tmp/curupira-dev",
    "docker:build": "docker build -t curupira:latest .",
    "docker:run": "docker run -p 8080:8080 curupira:latest"
  }
}
```

### Chrome Extension Vite Configuration

```typescript
// chrome-extension/vite.config.ts
import { defineConfig } from 'vite'
import { crx } from '@crxjs/vite-plugin'
import manifest from './src/manifest.json'

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        popup: 'src/popup/popup.html',
        devtools: 'src/devtools/devtools.html'
      }
    }
  }
})
```

### FastAPI MCP Server Configuration

```typescript
// mcp-server/src/index.ts
import Fastify from 'fastify'
import websocket from '@fastify/websocket'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import { CurupiraMCPServer } from './server'

const fastify = Fastify({ 
  logger: {
    level: process.env.CURUPIRA_LOG_LEVEL || 'info'
  }
})

// Register plugins
await fastify.register(cors, {
  origin: process.env.CURUPIRA_ALLOWED_ORIGINS?.split(',') || true
})

await fastify.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute'
})

await fastify.register(websocket)

// Initialize MCP server
const mcpServer = new CurupiraMCPServer(fastify)
await mcpServer.start()

const port = parseInt(process.env.CURUPIRA_PORT || '8080')
await fastify.listen({ port, host: '0.0.0.0' })
```

### Docker Compose Development

```yaml
# docker-compose.yml
version: '3.8'

services:
  curupira:
    build: 
      context: .
      dockerfile: Dockerfile
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=development
      - CURUPIRA_PORT=8080
      - CURUPIRA_AUTH_ENABLED=false
      - CURUPIRA_LOG_LEVEL=debug
    volumes:
      - ./mcp-server/src:/app/mcp-server/src
      - ./shared/src:/app/shared/src
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - curupira-net

networks:
  curupira-net:
    driver: bridge
```

### Production Dockerfile

```dockerfile
# Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./

# Install dependencies
RUN npm ci

# Copy all workspaces
COPY . .

# Build all packages
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy built files and dependencies
COPY --from=builder /app/mcp-server/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
USER nodejs

EXPOSE 8080

CMD ["node", "dist/index.js"]
```

## Security Architecture

### Authentication & Authorization
1. **JWT-based auth** for production environments
2. **Origin validation** with strict CORS policies
3. **Rate limiting** per IP and per session
4. **Request signing** for sensitive operations

### Data Protection
1. **Automatic sanitization** of sensitive fields:
   - Passwords, tokens, API keys
   - Credit card numbers, SSNs
   - Personal identification data
2. **Configurable redaction rules**
3. **Audit logging** for all access

### Network Security
1. **TLS/WSS only** in production
2. **Certificate pinning** for extension
3. **IP allowlisting** for staging/prod
4. **DDoS protection** via rate limiting

### Production Safeguards
1. **Explicit opt-in** required
2. **Time-boxed sessions** (default 1 hour)
3. **Read-only mode** option
4. **Granular permissions** per resource/tool

## Performance Requirements

### Latency Targets
- **WebSocket RTT**: < 10ms (local), < 50ms (staging)
- **Resource queries**: < 50ms p95
- **State snapshots**: < 100ms for full capture
- **CDP commands**: < 20ms execution

### Resource Usage
- **Memory**: < 100MB baseline, < 200MB active
- **CPU**: < 5% idle, < 25% active debugging
- **Network**: < 1MB/s during active session
- **Storage**: < 50MB for recordings

### Scalability
- **Concurrent connections**: 10+ per server
- **Message throughput**: 1000+ msg/sec
- **State history**: 1 hour rolling window
- **Recording size**: 100MB max per session

## Success Metrics

### Core Functionality
- [ ] **MCP Protocol Compliance**: 100% spec coverage
- [ ] **Chrome Extension**: Works on Chrome/Edge/Brave
- [ ] **State Access**: XState, Zustand, Apollo fully integrated
- [ ] **Performance**: Meets all latency/resource targets
- [ ] **Security**: Passes security audit

### Developer Experience
- [ ] **Setup Time**: < 5 minutes from install to first debug
- [ ] **Learning Curve**: Productive within 30 minutes
- [ ] **Documentation**: 100% API coverage
- [ ] **Error Messages**: Clear, actionable guidance

### AI Assistant Capabilities
- [ ] **Autonomous Debugging**: Resolve issues without human help
- [ ] **Root Cause Analysis**: Identify bug sources accurately
- [ ] **Performance Optimization**: Suggest improvements
- [ ] **State Reconstruction**: Replay exact error conditions

### NovaSkyn-Specific Scenarios
- [ ] Debug lazy-loaded pigeon icon state machines
- [ ] Trace GraphQL "products on Product" errors
- [ ] Monitor cart persistence with Zustand
- [ ] Profile Framer Motion animations
- [ ] Debug parcelamento calculations
- [ ] Track authentication with JWT
- [ ] Analyze bundle size impact
- [ ] Monitor WebSocket subscriptions

## Roadmap & Future Enhancements

### Phase 1: MVP (Current)
- Core MCP implementation
- Chrome extension for NovaSkyn
- Basic state management access
- Local development focus

### Phase 2: Production Ready (Q2 2025)
- **Multi-browser support**: Firefox, Safari, Edge native
- **Cloud deployment**: Curupira as a service
- **Team collaboration**: Shared debugging sessions
- **AI improvements**: Claude direct integration

### Phase 3: Platform Expansion (Q3 2025)
- **Framework support**: Vue, Angular, Svelte
- **Mobile debugging**: React Native, Flutter
- **Backend integration**: Node.js, Deno debugging
- **IDE plugins**: VS Code, WebStorm, Vim

### Phase 4: Advanced Features (Q4 2025)
- **AI-powered fixes**: Auto-generate code fixes
- **Performance advisor**: ML-based optimization
- **Security scanner**: Vulnerability detection
- **Test generation**: From debug sessions
- **Documentation generation**: From runtime behavior

### NovaSkyn-Specific Features
- **Panda CSS analyzer**: Runtime style debugging
- **Vite HMR inspector**: State preservation debugging
- **MSW interceptor**: Mock management UI
- **Framer Motion profiler**: Animation performance
- **Bundle analyzer**: Real-time size impact
- **A/B test debugger**: Variant tracking

## Complete Technology Stack

### Core Dependencies

```json
// package.json dependencies
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "fastify": "^4.26.0",
    "@fastify/websocket": "^8.3.0",
    "@fastify/cors": "^9.0.0",
    "@fastify/rate-limit": "^9.1.0",
    "ws": "^8.16.0",
    "chrome-remote-interface": "^0.33.0",
    "devtools-protocol": "^0.0.1260888",
    "zod": "^3.22.0",
    "pino": "^8.17.0"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "@types/ws": "^8.5.0",
    "@types/chrome": "^0.0.260",
    "typescript": "^5.3.0",
    "tsx": "^4.7.0",
    "vitest": "^1.2.0",
    "@vitest/ui": "^1.2.0",
    "playwright": "^1.41.0",
    "eslint": "^8.56.0",
    "prettier": "^3.2.0",
    "concurrently": "^8.2.0",
    "@crxjs/vite-plugin": "^2.0.0-beta.23",
    "vite": "^5.0.0"
  }
}
```

### TypeScript Configuration

```json
// tsconfig.json (root)
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022", "DOM"],
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "paths": {
      "@curupira/shared/*": ["./shared/src/*"],
      "@curupira/types": ["./shared/src/types/index.ts"]
    }
  },
  "references": [
    { "path": "./shared" },
    { "path": "./mcp-server" },
    { "path": "./chrome-extension" }
  ]
}
```

### Chrome Extension Manifest V3

```json
{
  "manifest_version": 3,
  "name": "Curupira - MCP Debugger",
  "version": "1.0.0",
  "description": "AI-powered debugging for React applications using Model Context Protocol",
  "permissions": [
    "debugger",
    "tabs",
    "storage",
    "webNavigation",
    "scripting"
  ],
  "host_permissions": [
    "http://localhost:*/*",
    "https://localhost:*/*",
    "http://127.0.0.1:*/*",
    "https://*.novaskyn.com/*",
    "https://*.staging.plo.quero.local/*"
  ],
  "content_scripts": [{
    "matches": [
      "http://localhost:*/*",
      "https://*.novaskyn.com/*",
      "https://*.staging.plo.quero.local/*"
    ],
    "js": ["content-script.js"],
    "run_at": "document_start",
    "world": "ISOLATED"
  }],
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "devtools_page": "devtools/devtools.html",
  "icons": {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  },
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon-16.png",
      "48": "icons/icon-48.png"
    }
  }
}
```

## Curupira Project Structure

```
pkgs/tools/curupira/
├── package.json              # Workspace root
├── tsconfig.json            # Root TypeScript config
├── README.md                # Project documentation
├── Dockerfile               # Production container
├── docker-compose.yml       # Development environment
├── .env.example             # Environment template
├── shared/                  # Shared code
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── types/          # Shared TypeScript types
│       ├── messages/       # IPC message definitions
│       └── utils/          # Common utilities
├── mcp-server/             # MCP server
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts       # Entry point
│       ├── server.ts      # Fastify server
│       ├── mcp/           # MCP implementation
│       ├── integrations/  # Library integrations
│       └── transport/     # WebSocket/SSE
├── chrome-extension/       # Browser extension
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── src/
│       ├── manifest.json
│       ├── background/    # Service worker
│       ├── content/       # Content scripts
│       ├── devtools/      # DevTools panel
│       └── popup/         # Extension popup
├── docs/                   # Documentation
│   ├── architecture.md
│   ├── api.md
│   └── deployment.md
└── k8s/                    # Kubernetes manifests
    ├── base/
    └── overlays/
        └── staging/
```

## Getting Started

```bash
# 1. Clone and setup Curupira
cd pkgs/tools
git clone <curupira-repo> curupira
cd curupira

# 2. Install dependencies
npm install

# 3. Setup environment
cp .env.example .env.development

# 4. Build shared types
npm run build:shared

# 5. Start development servers
npm run dev

# 6. Load Chrome extension
# Open Chrome > Extensions > Load unpacked
# Select: pkgs/tools/curupira/chrome-extension/dist

# 7. Test connection
curl http://localhost:8080/health
```

## Deployment

### Local Development
```bash
# Using Docker Compose
docker-compose up -d

# Or native Node.js
npm run dev
```

### Staging Deployment (GitOps)
```bash
# 1. Build and push image
npm run docker:build
docker tag curupira:latest registry.plo.quero.local/tools/curupira:staging
docker push registry.plo.quero.local/tools/curupira:staging

# 2. Update Kubernetes manifests
cd k8s/overlays/staging
kustomize edit set image curupira=registry.plo.quero.local/tools/curupira:staging

# 3. Commit and push (FluxCD will deploy)
git add -A
git commit -m "deploy(curupira): update staging image"
git push

# 4. Monitor deployment
flux get kustomization curupira-staging
kubectl -n novaskyn-staging get pods -l app=curupira

# 5. Test connection
wscat -c wss://curupira.novaskyn.staging.plo.quero.local/mcp
```

## Integration with NovaSkyn Frontend

```typescript
// In NovaSkyn frontend: src/lib/curupira.ts
export const initCurupira = async () => {
  // Only in development/staging
  if (!import.meta.env.DEV && !window.location.hostname.includes('staging')) {
    return
  }

  // Check if Curupira extension is installed
  if (!window.__CURUPIRA_BRIDGE__) {
    console.log('Curupira extension not detected')
    return
  }

  // Initialize bridge
  window.__CURUPIRA_BRIDGE__.init({
    appName: 'novaskyn',
    version: '1.0.0',
    environment: import.meta.env.MODE
  })

  // Register state managers
  if (window.__ZUSTAND_STORES__) {
    window.__CURUPIRA_BRIDGE__.registerZustandStores(window.__ZUSTAND_STORES__)
  }

  if (window.__APOLLO_CLIENT__) {
    window.__CURUPIRA_BRIDGE__.registerApolloClient(window.__APOLLO_CLIENT__)
  }
}

// Initialize on app start
initCurupira().catch(console.error)
```

## MCP Usage Examples

### Debugging Lazy-Loaded Icons
```typescript
// MCP prompt: "Debug why pigeon icons show loading circles"
const result = await mcp.runTool('inspect', {
  component: 'Icon',
  props: { name: 'pigeon', lazy: true }
})

// MCP will trace through:
// 1. StaticIcons lookup
// 2. LazyIcons registration
// 3. XState machine transitions
// 4. Dynamic import resolution
```

### Analyzing GraphQL Errors
```typescript
// MCP prompt: "Why is 'products' field error happening?"
const analysis = await mcp.runTool('analyzeGraphQL', {
  operation: 'GetProducts',
  error: "cannot query field 'products' on type 'Product'"
})

// Returns schema mismatch analysis and fix suggestions
```

### State Time Travel
```typescript
// MCP prompt: "Replay last 30 seconds of cart interactions"
const recording = await mcp.runTool('timeTravel', {
  store: 'cart',
  duration: 30000
})

// Replay specific moments
await mcp.runTool('jumpTo', { 
  timestamp: recording.events[5].timestamp 
})
```

## Kubernetes Configuration (GitOps Pattern)

### Base Configuration

```yaml
# k8s/base/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: curupira
  namespace: novaskyn-staging
  labels:
    app: curupira
    component: debugging
    product: novaskyn
spec:
  replicas: 1  # Single instance for staging
  selector:
    matchLabels:
      app: curupira
  template:
    metadata:
      labels:
        app: curupira
        component: debugging
        product: novaskyn
        environment: staging
    spec:
      containers:
      - name: curupira
        image: registry.plo.quero.local/tools/curupira:staging
        ports:
        - containerPort: 8080
          name: http-ws
        env:
        - name: NODE_ENV
          value: "staging"
        - name: CURUPIRA_PORT
          value: "8080"
        - name: CURUPIRA_ALLOWED_ORIGINS
          value: "https://novaskyn.staging.plo.quero.local"
        - name: CURUPIRA_AUTH_TOKEN
          valueFrom:
            secretKeyRef:
              name: curupira-secrets
              key: auth-token
        - name: CURUPIRA_AUTH_ENABLED
          value: "true"
        resources:
          limits:
            memory: "512Mi"
            cpu: "500m"
          requests:
            memory: "256Mi"
            cpu: "200m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 5
```

### Service Configuration

```yaml
# k8s/base/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: curupira
  namespace: novaskyn-staging
  labels:
    app: curupira
spec:
  type: ClusterIP
  ports:
  - port: 80
    targetPort: 8080
    protocol: TCP
    name: http
  selector:
    app: curupira
```

### Istio VirtualService (NovaSkyn Pattern)

```yaml
# k8s/base/virtualservice.yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: curupira
  namespace: novaskyn-staging
spec:
  hosts:
  - curupira.novaskyn.staging.plo.quero.local
  gateways:
  - istio-system/novaskyn-gateway
  http:
  - match:
    - uri:
        prefix: /
    route:
    - destination:
        host: curupira
        port:
          number: 80
    timeout: 0s  # No timeout for WebSocket
    websocketUpgrade: true
```

### Staging Overlay

```yaml
# k8s/overlays/staging/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: novaskyn-staging

resources:
  - ../../base

patchesStrategicMerge:
  - deployment-patch.yaml

images:
  - name: curupira
    newName: registry.plo.quero.local/tools/curupira
    newTag: staging

configMapGenerator:
  - name: curupira-config
    literals:
      - CURUPIRA_ENV=staging
      - CURUPIRA_LOG_LEVEL=info

secretGenerator:
  - name: curupira-secrets
    literals:
      - auth-token=${CURUPIRA_STAGING_AUTH_TOKEN}
```

### FluxCD Integration

```yaml
# In novaskyn-staging kustomization.yaml
resources:
  # Existing resources...
  - tools/curupira/  # Add Curupira to staging
```

## API Reference

### MCP Resources

```typescript
// Console logs
await mcp.getResource('console://logs?level=error&limit=100')

// Network requests  
await mcp.getResource('network://requests?method=POST&status=500')

// DOM elements
await mcp.getResource('dom://querySelector?selector=.cart-item')

// State snapshots
await mcp.getResource('state://zustand/cart')
await mcp.getResource('state://xstate/iconLoader')
await mcp.getResource('state://apollo/cache')
```

### MCP Tools

```typescript
// Evaluate expression
await mcp.runTool('eval', { 
  expression: 'window.__ZUSTAND_STORES__.cart.getState()' 
})

// Set breakpoint
await mcp.runTool('breakpoint', {
  file: 'Icon.tsx',
  line: 45,
  condition: 'props.name === "pigeon"'
})

// Profile performance
await mcp.runTool('profile', {
  duration: 5000,
  categories: ['rendering', 'scripting']
})

// Inspect element
await mcp.runTool('inspect', {
  selector: '[data-testid="product-card"]'
})
```

## Contributing

Curupira follows the Nexus monorepo standards:

1. **Code Style**: TypeScript with strict mode
2. **Testing**: Vitest with >80% coverage
3. **Documentation**: TSDoc for all public APIs
4. **Commits**: Conventional commits
5. **PRs**: Must pass all CI checks

### Development Workflow

1. Create feature branch
2. Implement with tests
3. Update documentation
4. Submit PR with description
5. Address review feedback
6. Merge via squash commit

## License

Curupira is part of the Nexus platform and follows the same licensing terms.

---

**Remember**: Curupira, like its mythological namesake, helps you trace backwards through execution to find the root cause of issues. Its "backward feet" create a perfect metaphor for debugging - following the trail back to where problems began.

## Resources

- **MCP Specification**: https://modelcontextprotocol.io
- **Chrome DevTools Protocol**: https://chromedevtools.github.io/devtools-protocol/
- **TypeScript MCP SDK**: https://github.com/modelcontextprotocol/typescript-sdk
- **NovaSkyn Frontend**: [../novaskyn/frontend-react/](../novaskyn/frontend-react/)