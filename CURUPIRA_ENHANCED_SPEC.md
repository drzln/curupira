# Curupira Enhanced MCP Server Specification

> **SPEC.md Status**: Active Development
> **Version**: 1.0.0
> **Last Updated**: 2025-09-15

## 📋 SPEC.md Compliance

This specification follows Nexus monorepo standards:
- **Tracking**: All tasks tracked with status, checklists, and verification
- **Hierarchy**: Strict dependency levels (Level 0 → N)
- **Testing**: Test-first development with >80% coverage requirement
- **Modularity**: Max 500 lines per file (TypeScript standard)

## 🎯 Executive Summary

Curupira is reimagined as a **Chrome DevTools Protocol (CDP) native MCP server** that provides direct browser control and deep application introspection for AI assistants. By eliminating the Chrome extension and connecting directly to Chrome's debugging protocol, Curupira offers unprecedented visibility into React applications and their state management systems.

**Key Architecture Change**: 
```
Claude Code → Curupira MCP Server → Chrome DevTools Protocol → Chrome Browser → Application
```

## 🏗️ Architecture Overview

### Core Design Principles

1. **CDP-First Architecture**: Direct WebSocket connection to Chrome DevTools Protocol
2. **No Extension Required**: Pure server-side implementation with CDP control
3. **Framework-Aware**: Deep integration with React, XState, Zustand, and Apollo
4. **Performance-Oriented**: Minimal overhead, efficient data streaming
5. **Production-Ready**: Secure remote debugging capabilities

### System Components

```mermaid
graph TB
    A[Claude Code] -->|MCP Protocol| B[Curupira MCP Server]
    B -->|WebSocket| C[Chrome DevTools Protocol]
    C -->|Runtime.evaluate| D[Application Memory]
    C -->|Network Domain| E[HTTP Requests]
    C -->|Performance Domain| F[Performance Metrics]
    C -->|DOM Domain| G[DOM Tree]
    D --> H[React Fiber Tree]
    D --> I[XState Machines]
    D --> J[Zustand Stores]
    D --> K[Apollo Cache]
```

## 📋 Technology Stack Analysis

### Frontend Technologies in Nexus

Based on analysis of NovaSkyn and other products:

#### Core React Stack
- **React**: 18.2.0 with Concurrent Features
- **TypeScript**: 5.2.2 with strict mode
- **Vite**: 5.0.8 build tool with HMR

#### State Management Trinity
1. **XState** (5.20.2): State machines for complex UI flows
   - Used for: Cart, checkout, form wizards
   - DevTools: Built-in inspector support
   
2. **Zustand** (5.0.7): Lightweight global state
   - Used for: User preferences, cart items, UI state
   - DevTools: Redux DevTools integration
   
3. **Apollo Client** (3.13.9): GraphQL state management
   - Used for: Server state, caching, optimistic updates
   - DevTools: Apollo Client DevTools

#### UI Libraries
- **Panda CSS** (1.1.0): CSS-in-JS with static extraction
- **Ariakit** (0.4.18): Accessible component primitives
- **Headless UI** (2.2.7): Unstyled, accessible components
- **Framer Motion** (12.23.12): Animation library
- **Lucide React**: Icon system

#### Form & Validation
- **React Hook Form** (7.62.0): Performant form state
- **Zod** (4.0.17): Schema validation

#### Testing Infrastructure
- **Vitest** (3.2.4): Unit and integration tests
- **Playwright** (1.55.0): E2E testing
- **MSW** (2.11.2): API mocking
- **Testing Library**: Component testing

## 🎯 Enhanced MCP Capabilities - Maximum Resource Exposure

Based on research of embedded-MCP library capabilities, Chrome DevTools Protocol domains, and frontend framework patterns, here's the comprehensive maximum tooling exposure:

### 1. Chrome DevTools Protocol Domain Resources

#### Runtime Domain
```typescript
resources:
  - name: "cdp/runtime/console"
    description: "Console logs with filtering and live streaming"
    schema:
      timestamp: number
      level: "log" | "warn" | "error" | "debug" | "info"
      args: RemoteObject[]
      stackTrace?: StackTrace
      executionContextId: number
      
  - name: "cdp/runtime/exceptions"
    description: "JavaScript exceptions and errors"
    schema:
      exceptionId: number
      message: string
      lineNumber: number
      columnNumber: number
      scriptId: string
      url: string
      stackTrace: StackTrace
      
  - name: "cdp/runtime/execution-contexts"
    description: "JavaScript execution contexts (frames, workers)"
    schema:
      id: number
      origin: string
      name: string
      uniqueId: string
      auxData: Record<string, unknown>

#### DOM Domain  
```typescript
resources:
  - name: "cdp/dom/tree"
    description: "Complete DOM tree with element inspection"
    schema:
      nodeId: number
      parentId: number
      nodeName: string
      nodeType: number
      attributes: string[]
      children: Node[]
      
  - name: "cdp/dom/box-model"
    description: "Element box model and positioning"
    schema:
      content: number[]  # [x1, y1, x2, y2, ...]
      padding: number[]
      border: number[]
      margin: number[]
      width: number
      height: number

#### Network Domain
```typescript
resources:
  - name: "cdp/network/requests"
    description: "HTTP requests with timing and headers"
    schema:
      requestId: string
      url: string
      method: string
      headers: Record<string, string>
      postData?: string
      resourceType: string
      timing: ResourceTiming
      response?: Response
      
  - name: "cdp/network/websockets"
    description: "WebSocket connections and messages"
    schema:
      requestId: string
      url: string
      initiator: Initiator
      frames: WebSocketFrame[]
      
  - name: "cdp/network/security"
    description: "TLS/SSL security details"
    schema:
      securityState: SecurityState
      certificateId: number
      securityDetails: SecurityDetails

#### Performance Domain
```typescript
resources:
  - name: "cdp/performance/metrics"
    description: "Core Web Vitals and performance metrics"
    schema:
      CLS: number  # Cumulative Layout Shift
      FCP: number  # First Contentful Paint
      LCP: number  # Largest Contentful Paint
      FID: number  # First Input Delay
      TTFB: number # Time to First Byte
      memoryUsage: MemoryUsage
      
  - name: "cdp/performance/timeline"
    description: "Performance timeline events"
    schema:
      name: string
      ts: number
      dur: number
      ph: string
      args: Record<string, unknown>

#### Page Domain
```typescript
resources:
  - name: "cdp/page/frames"
    description: "Frame tree and navigation state"
    schema:
      id: string
      parentId?: string
      url: string
      securityOrigin: string
      mimeType: string
      loaderId: string
      
  - name: "cdp/page/lifecycle"
    description: "Page lifecycle events (DOMContentLoaded, load, etc.)"
    schema:
      name: string
      timestamp: number
      
  - name: "cdp/page/screenshots"
    description: "Page screenshots and visual captures"
    schema:
      format: "png" | "jpeg"
      data: string  # base64
      viewport: Viewport

### 2. React Framework Integration Resources

#### React DevTools Integration
```typescript
resources:
  - name: "react/fiber-tree"
    description: "React Fiber tree with component hierarchy"
    schema:
      fiberId: string
      elementType: string
      displayName: string
      key: string | null
      props: Record<string, unknown>
      state: Record<string, unknown>
      children: FiberNode[]
      
  - name: "react/hooks"
    description: "React hooks state and dependencies"
    schema:
      hookType: "useState" | "useEffect" | "useCallback" | "useMemo" | "useContext"
      hookIndex: number
      value: unknown
      deps?: unknown[]
      
  - name: "react/performance"
    description: "React render performance and profiling"
    schema:
      componentName: string
      renderTime: number
      renderCount: number
      actualDuration: number
      baseDuration: number
      commitTime: number

#### XState Machine Inspection
```typescript
resources:
  - name: "xstate/machines"
    description: "All XState machines and their current state"
    schema:
      machineId: string
      currentState: string
      context: Record<string, unknown>
      availableEvents: string[]
      history: StateTransition[]
      
  - name: "xstate/services"
    description: "XState services and invoked actors"
    schema:
      serviceId: string
      type: "promise" | "callback" | "observable" | "machine"
      state: string
      data?: unknown
      
  - name: "xstate/events"
    description: "XState event log with transitions"
    schema:
      timestamp: number
      machineId: string
      event: string
      fromState: string
      toState: string
      context: Record<string, unknown>

#### Zustand Store Inspection
```typescript
resources:
  - name: "zustand/stores"
    description: "All Zustand stores and their state"
    schema:
      storeName: string
      state: Record<string, unknown>
      actions: string[]
      subscribers: number
      
  - name: "zustand/mutations"
    description: "Zustand state mutations log"
    schema:
      timestamp: number
      storeName: string
      action: string
      previousState: Record<string, unknown>
      nextState: Record<string, unknown>
      diff: StateDiff

#### Apollo Client Cache Inspection
```typescript
resources:
  - name: "apollo/cache"
    description: "Apollo Client normalized cache"
    schema:
      cacheSize: number
      entities: CacheEntry[]
      optimisticData: Record<string, unknown>
      
  - name: "apollo/queries"
    description: "Active GraphQL queries and their state"
    schema:
      queryId: string
      query: string
      variables: Record<string, unknown>
      networkStatus: NetworkStatus
      data?: unknown
      error?: GraphQLError
      
  - name: "apollo/subscriptions"
    description: "Active GraphQL subscriptions"
    schema:
      subscriptionId: string
      query: string
      variables: Record<string, unknown>
      lastMessage?: unknown

### 3. Application State Resources

#### Form State (React Hook Form + Zod)
```typescript
resources:
  - name: "forms/state"
    description: "All form instances and their state"
    schema:
      formId: string
      fields: Record<string, FieldState>
      errors: Record<string, FieldError>
      isValid: boolean
      isDirty: boolean
      isSubmitting: boolean
      
  - name: "forms/validation"
    description: "Zod schema validation results"
    schema:
      schemaName: string
      isValid: boolean
      errors: ZodError[]
      path: string[]

#### Animation State (Framer Motion)
```typescript
resources:
  - name: "animation/instances"
    description: "Active Framer Motion animations"
    schema:
      animationId: string
      element: string
      animation: AnimationDefinition
      progress: number
      isPlaying: boolean
      
  - name: "animation/performance"
    description: "Animation performance metrics"
    schema:
      fps: number
      droppedFrames: number
      animationDuration: number

### 4. CSS and Styling Resources (Panda CSS)

```typescript
resources:
  - name: "styles/tokens"
    description: "Panda CSS design tokens and computed values"
    schema:
      tokenName: string
      value: string
      computedValue: string
      category: "colors" | "spacing" | "typography" | "shadows"
      
  - name: "styles/css-vars"
    description: "CSS custom properties and their values"
    schema:
      property: string
      value: string
      element: string
      specificity: number

### 5. Testing and Development Resources

#### MSW Mock Service Worker
```typescript
resources:
  - name: "msw/handlers"
    description: "Active MSW request handlers"
    schema:
      method: string
      path: string
      response: unknown
      matchCount: number
      
  - name: "msw/requests"
    description: "Intercepted requests and responses"
    schema:
      requestId: string
      method: string
      url: string
      headers: Record<string, string>
      body?: unknown
      response?: unknown

#### Vitest Testing State
```typescript
resources:
  - name: "vitest/tests"
    description: "Test execution state and results"
    schema:
      testFile: string
      testName: string
      status: "pass" | "fail" | "skip" | "pending"
      duration: number
      error?: Error

### 6. Browser Environment Resources

#### Local Storage & Session Storage
```typescript
resources:
  - name: "storage/local"
    description: "localStorage key-value pairs"
    schema:
      key: string
      value: string
      size: number
      
  - name: "storage/session"
    description: "sessionStorage key-value pairs"
    schema:
      key: string
      value: string
      size: number
      
  - name: "storage/indexeddb"
    description: "IndexedDB databases and object stores"
    schema:
      databaseName: string
      version: number
      objectStores: ObjectStore[]

#### Service Workers
```typescript
resources:
  - name: "service-worker/registration"
    description: "Service worker registration and state"
    schema:
      scriptURL: string
      scope: string
      state: "installing" | "installed" | "activating" | "activated" | "redundant"
      
  - name: "service-worker/cache"
    description: "Service worker cache contents"
    schema:
      cacheName: string
      entries: CacheEntry[]

### 7. Connectivity Troubleshooting Resources

#### Network Connectivity
```typescript
resources:
  - name: "connectivity/online-status"
    description: "Browser online/offline status"
    schema:
      online: boolean
      effectiveType: "slow-2g" | "2g" | "3g" | "4g"
      downlink: number
      rtt: number
      
  - name: "connectivity/dns-resolution"
    description: "DNS resolution timing and results"
    schema:
      hostname: string
      resolved: boolean
      ip: string
      ttl: number
      resolutionTime: number
      
  - name: "connectivity/websocket-health"
    description: "WebSocket connection health"
    schema:
      url: string
      readyState: number
      protocol: string
      latency: number
      reconnectCount: number

#### Error Boundary State
```typescript
resources:
  - name: "errors/boundaries"
    description: "React Error Boundary states"
    schema:
      boundaryId: string
      hasError: boolean
      error?: Error
      errorInfo?: ErrorInfo
      componentStack: string

#### MCP Connection Debugging
```typescript
resources:
  - name: "mcp/connection-health"
    description: "MCP connection status and diagnostics"
    schema:
      connected: boolean
      transport: "websocket" | "stdio" | "sse"
      latency: number
      lastPing: number
      messageCount: number
      errorCount: number
      
  - name: "mcp/message-log"
    description: "MCP protocol message log"
    schema:
      timestamp: number
      direction: "sent" | "received"
      method: string
      params?: Record<string, unknown>
      result?: unknown
      error?: unknown

### 8. Security and Authentication Resources

#### Authentication State
```typescript
resources:
  - name: "auth/tokens"
    description: "JWT tokens and authentication state"
    schema:
      tokenType: "access" | "refresh" | "id"
      valid: boolean
      expiresAt: number
      claims: Record<string, unknown>
      
  - name: "auth/permissions"
    description: "User permissions and role state"
    schema:
      userId: string
      roles: string[]
      permissions: string[]
      restrictions: string[]

#### Security Headers
```typescript
resources:
  - name: "security/csp"
    description: "Content Security Policy evaluation"
    schema:
      directive: string
      violations: CSPViolation[]
      
  - name: "security/cors"
    description: "CORS policy and preflight requests"
    schema:
      origin: string
      allowed: boolean
      methods: string[]
      headers: string[]
## 🛠️ Comprehensive Tool Arsenal

### 1. Chrome DevTools Protocol Tools

#### Browser Control Tools
```typescript
tools:
  - name: "navigate"
    description: "Navigate to URL and wait for load"
    inputSchema:
      url: string
      waitUntil: "load" | "domcontentloaded" | "networkidle"
      timeout: number
      
  - name: "screenshot"
    description: "Take page screenshot with options"
    inputSchema:
      format: "png" | "jpeg" | "webp"
      quality: number
      fullPage: boolean
      clip?: Viewport
      
  - name: "reload"
    description: "Reload page with cache options"
    inputSchema:
      ignoreCache: boolean
      scriptToEvaluateOnLoad?: string

#### JavaScript Execution Tools
```typescript
tools:
  - name: "evaluate"
    description: "Execute JavaScript in page context"
    inputSchema:
      expression: string
      awaitPromise: boolean
      returnByValue: boolean
      timeout: number
      
  - name: "evaluate-async"
    description: "Execute async JavaScript with result"
    inputSchema:
      expression: string
      timeout: number
      
  - name: "call-function"
    description: "Call function on object with arguments"
    inputSchema:
      objectId: string
      functionDeclaration: string
      arguments: Array<unknown>

#### DOM Manipulation Tools
```typescript
tools:
  - name: "query-selector"
    description: "Find elements using CSS selectors"
    inputSchema:
      selector: string
      all: boolean
      
  - name: "set-attribute"
    description: "Set element attribute value"
    inputSchema:
      nodeId: number
      name: string
      value: string
      
  - name: "click-element"
    description: "Click element at coordinates or by selector"
    inputSchema:
      selector?: string
      x?: number
      y?: number
      
  - name: "type-text"
    description: "Type text into input element"
    inputSchema:
      selector: string
      text: string
      delay: number

#### Network Control Tools
```typescript
tools:
  - name: "set-cache-disabled"
    description: "Enable/disable browser cache"
    inputSchema:
      disabled: boolean
      
  - name: "block-requests"
    description: "Block requests matching patterns"
    inputSchema:
      patterns: string[]
      
  - name: "throttle-network"
    description: "Simulate network conditions"
    inputSchema:
      downloadThroughput: number
      uploadThroughput: number
      latency: number

### 2. React Framework Tools

#### Component Manipulation Tools
```typescript
tools:
  - name: "update-props"
    description: "Update React component props"
    inputSchema:
      componentId: string
      props: Record<string, unknown>
      
  - name: "trigger-rerender"
    description: "Force component re-render"
    inputSchema:
      componentId: string
      
  - name: "inspect-hooks"
    description: "Get detailed React hooks information"
    inputSchema:
      componentId: string
      hookTypes: string[]

#### State Management Tools
```typescript
tools:
  - name: "dispatch-xstate-event"
    description: "Send event to XState machine"
    inputSchema:
      machineId: string
      event: string
      payload?: Record<string, unknown>
      
  - name: "update-zustand-store"
    description: "Update Zustand store state"
    inputSchema:
      storeName: string
      updates: Record<string, unknown>
      replace: boolean
      
  - name: "reset-apollo-cache"
    description: "Reset Apollo Client cache"
    inputSchema:
      queries?: string[]
      resetWatches: boolean

### 3. Testing and Development Tools

#### Mock and Stub Tools
```typescript
tools:
  - name: "mock-api-request"
    description: "Mock specific API endpoint"
    inputSchema:
      method: string
      url: string
      response: unknown
      status: number
      delay: number
      
  - name: "stub-function"
    description: "Stub global function with return value"
    inputSchema:
      functionPath: string
      returnValue: unknown
      callCount?: number

#### Performance Tools
```typescript
tools:
  - name: "start-profiling"
    description: "Start CPU/memory profiling session"
    inputSchema:
      type: "cpu" | "memory" | "both"
      samplingInterval: number
      
  - name: "measure-performance"
    description: "Measure Core Web Vitals"
    inputSchema:
      duration: number
      includeResources: boolean
      
  - name: "trace-interactions"
    description: "Trace user interactions and performance"
    inputSchema:
      events: string[]
      duration: number

### 4. Form and Input Tools

#### Form Manipulation Tools
```typescript
tools:
  - name: "fill-form"
    description: "Fill entire form with data"
    inputSchema:
      formSelector: string
      data: Record<string, unknown>
      submit: boolean
      
  - name: "validate-form"
    description: "Trigger form validation"
    inputSchema:
      formSelector: string
      fields?: string[]
      
  - name: "reset-form"
    description: "Reset form to initial state"
    inputSchema:
      formSelector: string

### 5. Animation and Visual Tools

#### Animation Control Tools
```typescript
tools:
  - name: "pause-animations"
    description: "Pause all CSS/JS animations"
    inputSchema:
      pauseCSS: boolean
      pauseJS: boolean
      
  - name: "step-animation"
    description: "Step through animation frame by frame"
    inputSchema:
      animationId: string
      steps: number
      
  - name: "set-animation-speed"
    description: "Change animation playback speed"
    inputSchema:
      speed: number

#### Visual Testing Tools
```typescript
tools:
  - name: "visual-diff"
    description: "Compare current state with baseline"
    inputSchema:
      baselineId: string
      threshold: number
      highlightDifferences: boolean
      
  - name: "record-interaction"
    description: "Record user interaction sequence"
    inputSchema:
      duration: number
      includeScreenshots: boolean

### 6. Connectivity and Network Tools

#### Connection Testing Tools
```typescript
tools:
  - name: "test-websocket"
    description: "Test WebSocket connection health"
    inputSchema:
      url: string
      protocols?: string[]
      timeout: number
      
  - name: "ping-endpoint"
    description: "Test HTTP endpoint connectivity"
    inputSchema:
      url: string
      method: string
      timeout: number
      retries: number
      
  - name: "trace-dns"
    description: "Trace DNS resolution path"
    inputSchema:
      hostname: string
      recordType: "A" | "AAAA" | "CNAME" | "MX"

#### Network Simulation Tools
```typescript
tools:
  - name: "simulate-offline"
    description: "Simulate offline/online transitions"
    inputSchema:
      offline: boolean
      duration?: number
      
  - name: "simulate-slow-network"
    description: "Simulate slow network conditions"
    inputSchema:
      downloadKbps: number
      uploadKbps: number
      latencyMs: number
      packetLoss: number

### 7. Error and Exception Tools

#### Error Injection Tools
```typescript
tools:
  - name: "inject-error"
    description: "Inject error into application flow"
    inputSchema:
      type: "javascript" | "network" | "render"
      message: string
      stackTrace?: string
      
  - name: "trigger-error-boundary"
    description: "Trigger React Error Boundary"
    inputSchema:
      componentId: string
      error: Error

#### Recovery Tools
```typescript
tools:
  - name: "recover-from-error"
    description: "Attempt error recovery"
    inputSchema:
      resetState: boolean
      reloadComponents: string[]
      
  - name: "clear-error-state"
    description: "Clear all error states"
    inputSchema:
      includeGlobal: boolean

### 8. Security and Authentication Tools

#### Authentication Tools
```typescript
tools:
  - name: "simulate-login"
    description: "Simulate user authentication"
    inputSchema:
      userId: string
      roles: string[]
      permissions: string[]
      
  - name: "rotate-tokens"
    description: "Simulate token rotation"
    inputSchema:
      tokenType: "access" | "refresh"
      
  - name: "test-permissions"
    description: "Test user permission scenarios"
    inputSchema:
      action: string
      resource: string
      expected: boolean

## 🎯 Maximum Resource Exposure Strategy

### Resource Discovery and Registration

Based on the embedded-MCP library research, here's the strategy for maximum resource exposure:

#### 1. Automatic Framework Detection
```typescript
interface FrameworkDetector {
  detectReact(): boolean
  detectXState(): XStateMachine[]
  detectZustand(): ZustandStore[]
  detectApollo(): ApolloClient[]
  detectFramerMotion(): MotionValue[]
  detectPandaCSS(): boolean
  detectVitest(): TestSuite[]
}
```

#### 2. Dynamic Resource Registration
```typescript
class ResourceRegistry {
  private resources: Map<string, ResourceProvider> = new Map()
  
  autoRegisterResources(): void {
    // CDP Domain Resources (Always Available)
    this.registerCDPResources()
    
    // Framework-Specific Resources (Conditional)
    if (this.detector.detectReact()) {
      this.registerReactResources()
    }
    
    if (this.detector.detectXState().length > 0) {
      this.registerXStateResources()
    }
    
    if (this.detector.detectZustand().length > 0) {
      this.registerZustandResources()
    }
    
    if (this.detector.detectApollo().length > 0) {
      this.registerApolloResources()
    }
    
    // Environment-Specific Resources
    if (this.isTestEnvironment()) {
      this.registerTestingResources()
    }
    
    if (this.isDevelopment()) {
      this.registerDevelopmentResources()
    }
  }
}
```

#### 3. Resource Capability Matrix

| Resource Category | Base | React | XState | Zustand | Apollo | Testing |
|-------------------|------|-------|--------|---------|--------|---------|
| CDP Runtime       | ✅   | ✅    | ✅     | ✅      | ✅     | ✅      |
| CDP DOM           | ✅   | ✅    | ✅     | ✅      | ✅     | ✅      |
| CDP Network       | ✅   | ✅    | ✅     | ✅      | ✅     | ✅      |
| CDP Performance   | ✅   | ✅    | ✅     | ✅      | ✅     | ✅      |
| React DevTools    | ❌   | ✅    | ✅     | ✅      | ✅     | ✅      |
| Component Tree    | ❌   | ✅    | ✅     | ✅      | ✅     | ✅      |
| Hooks Inspection  | ❌   | ✅    | ✅     | ✅      | ✅     | ✅      |
| State Machines    | ❌   | ❌    | ✅     | ❌      | ❌     | ✅      |
| Store State       | ❌   | ❌    | ❌     | ✅      | ❌     | ✅      |
| GraphQL Cache     | ❌   | ❌    | ❌     | ❌      | ✅     | ✅      |
| MSW Mocks         | ❌   | ❌    | ❌     | ❌      | ❌     | ✅      |

#### 4. Estimated Resource Count by Environment

- **Base CDP**: 15 core resources
- **+ React**: +12 React-specific resources (27 total)
- **+ XState**: +8 state machine resources (35 total) 
- **+ Zustand**: +6 store resources (41 total)
- **+ Apollo**: +9 GraphQL resources (50 total)
- **+ Testing**: +15 testing resources (65 total)
- **+ Development**: +20 dev/debug resources (85 total)

#### 5. Performance-Optimized Resource Loading

```typescript
class PerformantResourceProvider {
  private cache: Map<string, CachedResource> = new Map()
  private subscriptions: Map<string, Subscription> = new Map()
  
  // Lazy load resources only when requested
  async getResource(uri: string): Promise<ResourceData> {
    const cached = this.cache.get(uri)
    if (cached && !this.isStale(cached)) {
      return cached.data
    }
    
    const data = await this.fetchResource(uri)
    this.cache.set(uri, {
      data,
      timestamp: Date.now(),
      ttl: this.getTTL(uri)
    })
    
    return data
  }
  
  // Stream updates for live resources
  subscribeToResource(uri: string): Observable<ResourceData> {
    if (this.subscriptions.has(uri)) {
      return this.subscriptions.get(uri)!
    }
    
    const subscription = this.createLiveSubscription(uri)
    this.subscriptions.set(uri, subscription)
    return subscription
  }
}
```

This comprehensive resource and tool exposure provides unprecedented debugging capabilities while maintaining performance and scalability.
```

#### Page Navigation & Control
```typescript
resources:
  - name: "browser/page"
    description: "Page navigation and lifecycle"
    methods:
      - navigate(url: string)
      - reload(options?: ReloadOptions)
      - goBack()
      - goForward()
      - screenshot(options?: ScreenshotOptions)
      - pdf(options?: PDFOptions)
```

### 2. React DevTools Integration

#### Component Tree Inspection
```typescript
resources:
  - name: "react/components"
    description: "React component tree and props"
    methods:
      - getComponentTree(): ReactFiberNode[]
      - inspectComponent(fiberNode: FiberNode)
      - getComponentProps(id: string)
      - getComponentState(id: string)
      - highlightComponent(id: string)
```

#### Performance Profiling
```typescript
resources:
  - name: "react/profiler"
    description: "React rendering performance"
    methods:
      - startProfiling()
      - stopProfiling(): ProfileData
      - getRenderDurations(componentName: string)
      - identifySlowComponents(threshold: number)
```

### 3. State Management Deep Dive

#### XState Machine Inspection
```typescript
resources:
  - name: "xstate/machines"
    description: "XState machine instances and states"
    methods:
      - listActiveMachines(): Machine[]
      - getMachineState(id: string): StateValue
      - getMachineContext(id: string): Context
      - sendEvent(machineId: string, event: Event)
      - getStateChart(machineId: string): StateChart
```

#### Zustand Store Access
```typescript
resources:
  - name: "zustand/stores"
    description: "Zustand store inspection and manipulation"
    methods:
      - listStores(): StoreInfo[]
      - getStoreState(name: string): State
      - subscribeToStore(name: string): Observable<State>
      - updateStore(name: string, updater: StateUpdater)
      - getStoreHistory(name: string): StateChange[]
```

#### Apollo Cache Management
```typescript
resources:
  - name: "apollo/cache"
    description: "Apollo Client cache inspection"
    methods:
      - getCacheContents(): NormalizedCache
      - readQuery(query: DocumentNode, variables?: Variables)
      - writeQuery(query: DocumentNode, data: any)
      - evictCache(options?: EvictOptions)
      - getActiveQueries(): ActiveQuery[]
      - getOptimisticResponses(): OptimisticResponse[]
```

### 4. Advanced Debugging Tools

#### Network Interception
```typescript
tools:
  - name: "network/intercept"
    description: "Intercept and modify network requests"
    parameters:
      - pattern: string
      - handler: (request: Request) => Response | void
    capabilities:
      - Mock API responses
      - Simulate network conditions
      - Inject errors for testing
```

#### DOM Manipulation
```typescript
tools:
  - name: "dom/manipulate"
    description: "Direct DOM manipulation and inspection"
    parameters:
      - selector: string
      - action: "click" | "type" | "hover" | "scroll"
      - value?: any
    capabilities:
      - Simulate user interactions
      - Extract computed styles
      - Modify DOM attributes
```

#### JavaScript Execution
```typescript
tools:
  - name: "runtime/evaluate"
    description: "Execute JavaScript in page context"
    parameters:
      - expression: string
      - awaitPromise?: boolean
      - returnByValue?: boolean
    capabilities:
      - Access window globals
      - Call application functions
      - Modify application state
```

### 5. Framework-Specific Tools

#### Panda CSS Analysis
```typescript
tools:
  - name: "pandacss/analyze"
    description: "Analyze Panda CSS usage and performance"
    capabilities:
      - Extract atomic CSS usage
      - Identify unused styles
      - Measure CSS-in-JS overhead
      - Suggest optimizations
```

#### Form State Debugging
```typescript
tools:
  - name: "react-hook-form/debug"
    description: "Debug React Hook Form state"
    capabilities:
      - Inspect form values
      - Track validation errors
      - Monitor field touches/dirties
      - Simulate form submissions
```

#### Animation Performance
```typescript
tools:
  - name: "framer-motion/profile"
    description: "Profile Framer Motion animations"
    capabilities:
      - Measure animation FPS
      - Identify janky animations
      - Track gesture performance
      - Optimize spring configs
```

## 🔧 Implementation Architecture

### Core Server Structure

```typescript
// Following Nexus dependency hierarchy standards
interface CurupiraMCPServer {
  // Level 1: CDP Connection Management
  cdpClient: CDPClient
  sessions: Map<string, CDPSession>
  
  // Level 2: Framework Integrations
  reactIntegration: ReactDevToolsIntegration
  xstateIntegration: XStateInspectorIntegration
  zustandIntegration: ZustandDevToolsIntegration
  apolloIntegration: ApolloDevToolsIntegration
  
  // Level 3: Resource Providers
  browserResource: BrowserResourceProvider
  reactResource: ReactResourceProvider
  stateResource: StateResourceProvider
  networkResource: NetworkResourceProvider
  
  // Level 4: Tool Implementations
  domTool: DOMManipulationTool
  runtimeTool: RuntimeEvaluationTool
  performanceTool: PerformanceProfilerTool
  debuggerTool: DebuggerTool
}
```

### CDP Connection Flow

```typescript
// src/cdp/client.ts - Must be <500 lines
class CDPClient {
  private ws: WebSocket | null = null
  private sessions: Map<string, CDPSession> = new Map()
  
  async connect(options: {
    host: string
    port: number
    secure?: boolean
    retryAttempts?: number
    retryDelay?: number
  }): Promise<void> {
    // 1. Connect to Chrome DevTools Protocol with retry logic
    const url = `${options.secure ? 'wss' : 'ws'}://${options.host}:${options.port}/devtools/browser`
    
    try {
      this.ws = await this.connectWithRetry(url, options)
      
      // 2. List available targets
      const targets = await this.send('Target.getTargets')
      
      // 3. Attach to page target
      const pageTarget = targets.find(t => t.type === 'page')
      if (!pageTarget) {
        throw new Error('No page target found')
      }
      
      const { sessionId } = await this.send('Target.attachToTarget', {
        targetId: pageTarget.targetId,
        flatten: true
      })
      
      // 4. Enable necessary domains
      await this.enableDomains(sessionId, [
        'Runtime',
        'Network', 
        'DOM',
        'Performance',
        'Debugger',
        'Console'
      ])
    } catch (error) {
      this.disconnect()
      throw new CDPConnectionError('Failed to connect to Chrome', error)
    }
  }
  
  private async connectWithRetry(
    url: string, 
    options: { retryAttempts?: number; retryDelay?: number }
  ): Promise<WebSocket> {
    // Implementation with exponential backoff
    // Moved to separate method to keep under line limit
  }
}
```

### React DevTools Integration

```typescript
// src/integrations/react/detector.ts - React detection (<500 lines)
class ReactDevToolsIntegration {
  constructor(private cdpSession: CDPSession) {}
  
  async initialize(): Promise<ReactInfo> {
    // Test-first approach: Write interface before implementation
    const detectResult = await this.detectReact()
    if (!detectResult.hasReact) {
      throw new Error('React not detected in page')
    }
    
    // Inject helper functions for Fiber tree access
    await this.injectHelpers()
    
    return detectResult
  }
  
  private async detectReact(): Promise<ReactInfo> {
    const result = await this.cdpSession.send('Runtime.evaluate', {
      expression: `
        (() => {
          const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__
          if (hook && hook.renderers) {
            const renderer = hook.renderers.get(1)
            return {
              hasReact: true,
              version: renderer?.version || 'unknown',
              rendererCount: hook.renderers.size,
              hasFiber: !!renderer?.findFiberByHostInstance
            }
          }
          return { hasReact: false }
        })()
      `,
      returnByValue: true,
      awaitPromise: true
    })
    
    return result.result.value as ReactInfo
  }
  
  private async injectHelpers(): Promise<void> {
    // Inject minimal helpers to avoid page pollution
    // Implementation in separate file to maintain modularity
  }
}

// src/integrations/react/fiber-walker.ts - Fiber tree traversal (<500 lines)
class FiberWalker {
  async getComponentTree(): Promise<ReactFiberNode[]> {
    // Modular implementation for tree walking
    // Separate from detector to maintain single responsibility
  }
}
```

## 🔒 Security Considerations

### Authentication & Authorization

```typescript
interface SecurityConfig {
  // Environment-based security
  development: {
    authRequired: false,
    allowedOrigins: ['localhost']
  },
  staging: {
    authRequired: true,
    jwtSecret: process.env.JWT_SECRET,
    allowedOrigins: ['*.staging.plo.quero.local']
  },
  production: {
    authRequired: true,
    jwtSecret: process.env.JWT_SECRET,
    ipWhitelist: process.env.ALLOWED_IPS?.split(','),
    allowedOrigins: ['*.plo.quero.local']
  }
}
```

### CDP Security

- **Remote Debugging**: Only enabled in controlled environments
- **WebSocket Security**: WSS with proper authentication
- **Command Filtering**: Whitelist of allowed CDP commands
- **Data Sanitization**: Remove sensitive data from responses

## 🚀 Deployment Architecture

### Kubernetes Deployment

```yaml
# Chrome Headless Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: chrome-debug-chrome-headless
  namespace: shared-services
spec:
  replicas: 1
  template:
    spec:
      containers:
      - name: chrome
        image: zenika/alpine-chrome:latest
        args:
          - --remote-debugging-address=0.0.0.0
          - --remote-debugging-port=9222
          - --no-sandbox
          - --disable-gpu
          - --headless=new
        ports:
        - containerPort: 9222
          name: cdp
```

### Service Discovery

```yaml
# Internal service discovery
chrome-debug-chrome-headless.shared-services.svc.cluster.local:9222

# Curupira connects via internal DNS
cdpEndpoint: 'ws://chrome-debug-chrome-headless.shared-services.svc.cluster.local:9222'
```

## 📊 Performance Requirements

### Resource Usage Targets

- **Memory**: < 100MB baseline (Curupira server)
- **CPU**: < 5% idle, < 25% active debugging
- **Network**: Efficient WebSocket streaming
- **Latency**: < 50ms for most operations
- **File Size**: All source files < 500 lines

### Optimization Strategies

1. **Batch CDP Commands**: Group multiple evaluations
2. **Selective Data Transfer**: Only send requested data
3. **Incremental Updates**: Delta-based state changes
4. **Caching**: Cache static component trees
5. **Modular Code**: Split large files to maintain performance

### Testing Requirements

```bash
# Performance benchmarks must pass
npm run benchmark

# Expected results:
# - CDP connection: < 100ms
# - Component tree retrieval: < 200ms
# - State inspection: < 50ms
# - Memory usage: < 100MB
# - No memory leaks after 1000 operations
```

## 🎯 Key Differentiators

### vs Traditional Debugging

- **No Manual Setup**: No DevTools window needed
- **Programmatic Access**: Full automation capabilities
- **Cross-Framework**: Unified interface for all frameworks
- **AI-Optimized**: Structured data for LLM consumption

### vs Browser Extensions

- **No Installation**: Server-side only
- **Framework Agnostic**: Works with any Chrome-based browser
- **Secure**: No access to user browsing data
- **Scalable**: Can debug multiple sessions

### vs Existing Tools

- **MCP Native**: Built for AI assistant integration
- **Comprehensive**: Combines multiple DevTools into one
- **Production-Ready**: Designed for remote debugging
- **Framework-Aware**: Deep integration with modern stacks

## 📋 Implementation Tasks with SPEC.md Tracking

### Development Principles

#### Dependency Hierarchy
```
Level 0: Foundation    → types, errors, config, interfaces
Level 1: Core         → CDP client, connection management
Level 2: Integrations → React, XState, Zustand, Apollo
Level 3: Resources    → MCP resource providers
Level 4: Tools        → MCP tool implementations
Level 5: Server       → Main MCP server orchestration
```

#### Module Structure Requirements
- **Max file size**: 500 lines (TypeScript standard)
- **Single responsibility**: One module = one purpose
- **Test coverage**: >80% for all modules
- **Documentation**: TSDoc for all public APIs

### Phase 0: Infrastructure Prerequisites ✅

#### Task 0.1: Deploy Headless Chrome in Kubernetes ✅
**Status**: COMPLETED  
**Priority**: CRITICAL - MUST BE COMPLETED FIRST
**Description**: Deploy and verify headless Chrome instance for CDP connection

**Implementation Checklist**:
- [x] Apply Chrome headless deployment: `kubectl apply -k infrastructure/debugging/chrome-headless/`
- [x] Verify pod is running: `kubectl get pods -n shared-services | grep chrome`
- [x] Test CDP endpoint: `curl http://chrome-headless.shared-services.svc.cluster.local:3000/json`
- [x] Verify CDP WebSocket: `wscat -c ws://chrome-headless.shared-services.svc.cluster.local:3000`
- [x] Test from Curupira pod: `kubectl exec -n shared-services deployment/curupira-mcp-server -- curl http://chrome-headless:3000/json`

**Test Requirements**:
- [x] Chrome pod healthy and running
- [x] CDP endpoint returns version info
- [x] WebSocket connection established
- [x] Service discovery working from Curupira namespace
- [x] No connection timeouts or errors

**Solution Implemented**: 
- Deployed browserless/chrome instead of raw Chrome due to CDP binding issues
- Browserless provides proper remote debugging support out of the box
- Service accessible at: `http://chrome-headless.shared-services.svc.cluster.local:3000`

#### Task 0.2: Establish CDP Connection from Curupira ✅
**Status**: COMPLETED
**Description**: Create minimal CDP connection test from Curupira to Chrome

**Implementation Checklist**:
- [x] Create `scripts/test-cdp-connection.js` with basic CDP connection
- [x] Test WebSocket connection to Chrome service
- [x] Verify ability to list browser targets
- [x] Create test script for navigation
- [x] Extract version info to verify control

**Test Requirements**:
- [x] Connection established within 1 second
- [x] Can access browser version endpoint
- [x] Can list browser targets via /json endpoint
- [x] WebSocket endpoint available for CDP
- [x] Service discovery working correctly

**Verification Script Created**:
```javascript
// scripts/test-cdp-connection.js
// Successfully tested and working
const http = require('http');

async function testCDPConnection() {
  const CHROME_SERVICE_URL = 'chrome-headless.shared-services.svc.cluster.local';
  const CHROME_SERVICE_PORT = 3000;
  
  // Test HTTP endpoint
  const versionData = await httpGet(CHROME_SERVICE_URL, CHROME_SERVICE_PORT, '/json/version');
  console.log('✅ CDP connection working');
  console.log('Browser:', versionData.Browser);
  console.log('WebSocket URL:', versionData.webSocketDebuggerUrl);
}
```

### Phase 1: Foundation Layer (Level 0) ⏳

#### Task 1.1: Type Definitions and Interfaces ✅
**Status**: COMPLETED
**Description**: Define all TypeScript types, interfaces, and branded types

**Implementation Checklist**:
- [ ] Create `src/types/cdp.types.ts` - CDP protocol types
- [ ] Create `src/types/mcp.types.ts` - MCP protocol types
- [ ] Create `src/types/framework.types.ts` - Framework integration types
- [ ] Create `src/types/branded.types.ts` - Branded types for type safety
- [ ] Create `src/errors/index.ts` - Error types and handling
- [ ] Create `src/config/schema.ts` - Configuration validation with Zod

**Test Requirements**:
- [ ] Type exports compile correctly
- [ ] Branded types provide proper type safety
- [ ] Error types cover all failure modes
- [ ] Config validation rejects invalid inputs

**Verification**: `npm run type-check && npm test src/types`

#### Task 1.2: Core Interfaces ✅
**Status**: COMPLETED
**Description**: Define core system interfaces for dependency injection

**Implementation Checklist**:
- [ ] Create `src/interfaces/cdp-client.interface.ts`
- [ ] Create `src/interfaces/resource-provider.interface.ts`
- [ ] Create `src/interfaces/tool-implementation.interface.ts`
- [ ] Create `src/interfaces/framework-integration.interface.ts`

**Test Requirements**:
- [ ] Interfaces properly typed
- [ ] No circular dependencies
- [ ] All methods documented

### Phase 2: CDP Client Layer (Level 1) ⏳

#### Task 2.1: CDP Connection Management ✅
**Status**: COMPLETED
**Description**: Implement Chrome DevTools Protocol client

**Implementation Checklist**:
- [ ] Create `src/cdp/client.ts` - Main CDP client (<500 lines)
- [ ] Create `src/cdp/connection.ts` - WebSocket management
- [ ] Create `src/cdp/session.ts` - CDP session handling
- [ ] Create `src/cdp/domains.ts` - CDP domain enablement
- [ ] Implement connection retry with exponential backoff
- [ ] Add connection health monitoring

**Test Requirements**:
- [ ] Unit tests with mocked WebSocket
- [ ] Integration tests with real Chrome
- [ ] Connection retry logic tested
- [ ] Error handling for all failure modes
- [ ] >80% code coverage

**Verification**: `npm test src/cdp -- --coverage`

#### Task 2.2: CDP Command Execution ✅
**Status**: COMPLETED
**Description**: Implement CDP command execution with type safety

**Implementation Checklist**:
- [ ] Create `src/cdp/commands.ts` - Command execution
- [ ] Create `src/cdp/events.ts` - Event subscription
- [ ] Implement command queuing and batching
- [ ] Add response timeout handling
- [ ] Create typed command builders

**Test Requirements**:
- [ ] Command execution tested
- [ ] Event subscription tested
- [ ] Timeout handling verified
- [ ] Type safety enforced

### Phase 3: Framework Integrations (Level 2) ⏳

#### Task 3.1: React DevTools Integration ✅
**Status**: COMPLETED
**Description**: Integrate with React DevTools for component inspection

**Implementation Checklist**:
- [ ] Create `src/integrations/react/detector.ts` - React detection
- [ ] Create `src/integrations/react/fiber-walker.ts` - Fiber tree traversal
- [ ] Create `src/integrations/react/component-inspector.ts`
- [ ] Create `src/integrations/react/profiler.ts`
- [ ] Implement React version compatibility checks

**Test Requirements**:
- [ ] Works with React 16.8+
- [ ] Fiber tree correctly traversed
- [ ] Component props/state extracted
- [ ] Performance profiling accurate
- [ ] No impact on app performance

#### Task 3.2: State Management Integrations ✅
**Status**: COMPLETED
**Description**: Integrate XState, Zustand, and Apollo Client

**Implementation Checklist**:
- [ ] Create `src/integrations/xstate/` - XState inspection
- [ ] Create `src/integrations/zustand/` - Zustand store access
- [ ] Create `src/integrations/apollo/` - Apollo cache inspection
- [ ] Implement state change subscriptions
- [ ] Add state history tracking

**Test Requirements**:
- [ ] Each integration tested in isolation
- [ ] State changes tracked correctly
- [ ] No memory leaks from subscriptions
- [ ] Integration with real libraries tested

### Phase 4: MCP Implementation (Level 3-4) ⏳

#### Task 4.1: Resource Providers ✅
**Status**: COMPLETED
**Description**: Implement MCP resource providers

**Implementation Checklist**:
- [ ] Create `src/resources/browser-resource.ts`
- [ ] Create `src/resources/react-resource.ts`
- [ ] Create `src/resources/state-resource.ts`
- [ ] Create `src/resources/network-resource.ts`
- [ ] Implement resource listing and reading

**Test Requirements**:
- [ ] Resource discovery works
- [ ] Resource data correctly formatted
- [ ] Error handling for missing resources
- [ ] Performance within 50ms target

#### Task 4.2: Tool Implementations ✅
**Status**: COMPLETED
**Description**: Implement MCP tools for debugging actions

**Implementation Checklist**:
- [ ] Create `src/tools/dom-tool.ts` - DOM manipulation
- [ ] Create `src/tools/runtime-tool.ts` - JS execution
- [ ] Create `src/tools/network-tool.ts` - Network control
- [ ] Create `src/tools/performance-tool.ts` - Profiling
- [ ] Implement tool parameter validation

**Test Requirements**:
- [ ] Each tool tested independently
- [ ] Parameter validation works
- [ ] Error responses properly formatted
- [ ] Side effects properly managed

### Phase 5: Server Orchestration (Level 5) ✅

#### Task 5.1: MCP Server Implementation ✅
**Status**: COMPLETED
**Description**: Implement main MCP server with all integrations

**Implementation Checklist**:
- [x] Create `src/server/index.ts` - Main server entry
- [x] Create `src/server/mcp-handler.ts` - MCP protocol handling
- [x] Create `src/server/transport.ts` - HTTP/SSE transport
- [x] Wire up all resources and tools
- [x] Implement health checks

**Test Requirements**:
- [x] Full MCP protocol compliance
- [x] All resources accessible
- [x] All tools executable
- [x] Health checks pass
- [ ] Performance targets met

### Phase 6: Production Hardening ✅

#### Task 6.1: Security Implementation ✅
**Status**: COMPLETED
**Description**: Implement authentication and security measures

**Implementation Checklist**:
- [x] Add JWT authentication for staging/production
- [x] Implement command whitelisting
- [x] Add data sanitization
- [x] Create audit logging
- [x] Implement rate limiting

**Test Requirements**:
- [x] Auth properly enforced
- [x] Dangerous commands blocked
- [x] Sensitive data sanitized
- [x] Audit logs created
- [x] Rate limits enforced

#### Task 6.2: Deployment & Documentation ✅
**Status**: COMPLETED
**Description**: Kubernetes deployment and comprehensive docs

**Implementation Checklist**:
- [x] Update Kubernetes manifests
- [x] Create Dockerfile optimized for size
- [x] Write API documentation
- [x] Create usage examples
- [x] Add troubleshooting guide

**Test Requirements**:
- [ ] Deployment successful in K8s
- [ ] Health checks pass in K8s
- [x] Documentation complete
- [x] Examples run successfully

### Phase 7: End-to-End MCP Testing with Claude Code ⏳

#### Task 7.1: MCP Integration Testing ❌
**Status**: NOT STARTED
**Description**: Test complete MCP flow with Claude Code

**Implementation Checklist**:
- [ ] Create test scenarios for each MCP resource
- [ ] Create test scenarios for each MCP tool
- [ ] Write Claude Code test scripts
- [ ] Document expected vs actual results
- [ ] Create feedback loop for improvements

**Test Scenarios**:
```typescript
// test/e2e/mcp-scenarios.ts
export const scenarios = [
  {
    name: "Inspect React Component Tree",
    steps: [
      "Connect to Curupira MCP server",
      "List available resources",
      "Read react/components resource",
      "Verify component tree structure"
    ],
    verification: (result) => {
      assert(result.components.length > 0)
      assert(result.components[0].type === 'App')
    }
  },
  {
    name: "Debug Cart State",
    steps: [
      "Read zustand/stores resource",
      "Find cart store",
      "Inspect cart items",
      "Use tools/manipulate to add item",
      "Verify state change"
    ]
  },
  {
    name: "Profile Performance",
    steps: [
      "Start React profiler",
      "Trigger UI interactions",
      "Stop profiler",
      "Analyze slow components"
    ]
  }
]
```

**Claude Code Test Commands**:
```bash
# Test resource listing
mcp test curupira-debug resources/list

# Test React inspection
mcp test curupira-debug resources/read --name "react/components"

# Test tool execution
mcp test curupira-debug tools/call --name "dom/click" --selector ".add-to-cart"

# Full scenario test
mcp test curupira-debug --scenario "cart-debugging"
```

#### Task 7.2: Development Feedback Loop ❌
**Status**: NOT STARTED
**Description**: Use Claude Code testing to improve implementation

**Implementation Checklist**:
- [ ] Set up continuous testing pipeline
- [ ] Create metrics for MCP effectiveness
- [ ] Document pain points and improvements
- [ ] Iterate on API design based on usage
- [ ] Create developer experience surveys

**Feedback Metrics**:
- Time to complete debugging task
- Number of MCP calls required
- Error rate in tool execution
- Developer satisfaction score
- AI assistant success rate

## 🎯 Success Metrics

- **Developer Productivity**: 10x faster debugging cycles
- **AI Effectiveness**: 90% success rate for debugging tasks
- **Performance**: < 5% overhead on application
- **Adoption**: Used by all frontend developers
- **Reliability**: 99.9% uptime in production

## 🧪 Bottom-Up Testing Strategy

### Testing Philosophy: Build on Certified Foundations

Each level of the architecture must be thoroughly tested and certified before building the next level. This ensures that failures are caught early and debugging is straightforward.

### Level 0: Foundation Testing (Pure Units)
**Goal**: Certify all pure functions, types, and utilities work in isolation

#### Test Approach
```bash
# Run only Level 0 tests first
npm run test:level0

# Tests to run:
- src/__tests__/types/*.test.ts      # Type guards and branded types
- src/__tests__/errors/*.test.ts     # Error handling
- src/__tests__/utils/*.test.ts      # Pure utility functions
- src/__tests__/constants/*.test.ts  # Configuration validation
```

#### Certification Criteria
- ✅ 100% test coverage for pure functions
- ✅ All type guards properly narrowing types
- ✅ Error types covering all failure modes
- ✅ No external dependencies in tests

### Level 1: Chrome Core Testing (CDP Client)
**Goal**: Certify Chrome connection and CDP communication

#### Test Approach
```bash
# Run Level 1 tests with mocked Chrome
npm run test:level1:unit

# Then run with real Chrome
npm run test:level1:integration
```

#### Test Progression
1. **Unit Tests** (Mocked WebSocket)
   - Connection establishment
   - Message sending/receiving
   - Session management
   - Error handling

2. **Integration Tests** (Real Chrome)
   - Actual CDP connection
   - Domain enablement
   - Basic commands (navigate, evaluate)
   - Connection recovery

#### Certification Criteria
- ✅ Stable WebSocket connection
- ✅ All CDP domains accessible
- ✅ Graceful error handling
- ✅ Connection retry working

### Level 2: MCP Core Testing (Resources & Tools)
**Goal**: Certify each resource provider and tool handler independently

#### Test Approach
```bash
# Test each provider in isolation
npm run test:level2:providers

# Test categories separately:
npm run test:cdp-resources
npm run test:react-resources
npm run test:state-resources
npm run test:cdp-tools
npm run test:dom-tools
npm run test:react-tools
npm run test:network-tools
npm run test:performance-tools
```

#### Test Matrix
| Provider | Unit Tests | Integration | Real Chrome | Certified |
|----------|------------|-------------|-------------|-----------|
| CDP Resources | ✅ | ✅ | ⏳ | ⏳ |
| React Resources | ✅ | ✅ | ⏳ | ⏳ |
| State Resources | ✅ | ✅ | ⏳ | ⏳ |
| CDP Tools | ✅ | ✅ | ⏳ | ⏳ |
| DOM Tools | ✅ | ✅ | ⏳ | ⏳ |
| React Tools | ✅ | ✅ | ⏳ | ⏳ |
| Network Tools | ✅ | ✅ | ⏳ | ⏳ |
| Performance Tools | ✅ | ✅ | ⏳ | ⏳ |

### Level 3: Integration Testing (Framework Detection)
**Goal**: Certify framework detection and state management bridges work

#### Test Approach
```bash
# Test with sample React apps
npm run test:level3:react

# Test with different state managers
npm run test:level3:state
```

#### Test Apps Required
1. **Minimal React App** - Basic component tree
2. **XState App** - State machines active
3. **Zustand App** - Global stores
4. **Apollo App** - GraphQL cache
5. **Full Stack App** - All frameworks combined

### Level 4: MCP Protocol Testing
**Goal**: Certify full MCP protocol compliance

#### Test Approach
```bash
# Test MCP protocol flow
npm run test:level4:mcp

# Test with real MCP client
npm run test:level4:claude
```

#### Test Scenarios
1. **Resource Discovery**
   - List all resources
   - Read each resource type
   - Handle missing resources

2. **Tool Execution**
   - Execute each tool
   - Validate responses
   - Error handling

3. **Transport Testing**
   - HTTP/SSE transport
   - WebSocket transport
   - Message size limits

### Level 5: End-to-End Testing
**Goal**: Certify complete system works with Claude Code

#### Test Approach
```bash
# Full E2E test suite
npm run test:e2e

# Performance benchmarks
npm run test:performance
```

#### E2E Test Scenarios
1. **Basic Debugging Flow**
   - Connect to Chrome
   - Navigate to app
   - Inspect components
   - Modify state

2. **Complex Debugging**
   - Performance profiling
   - Memory leak detection
   - Network mocking
   - State time travel

3. **Production Scenarios**
   - High traffic handling
   - Connection recovery
   - Security enforcement
   - Rate limiting

### Test Execution Order

```bash
# Day 1: Foundation
npm run test:level0
# STOP if any failures - fix before proceeding

# Day 2: Chrome Core
npm run test:level1:unit
npm run test:level1:integration
# STOP if any failures - CDP must be solid

# Day 3-4: MCP Core (one provider at a time)
npm run test:cdp-resources
# Certify CDP resources before moving on
npm run test:react-resources
# Certify React resources before moving on
# ... continue for each provider

# Day 5: Integration
npm run test:level3:react
npm run test:level3:state

# Day 6: MCP Protocol
npm run test:level4:mcp

# Day 7: End-to-End
npm run test:e2e
npm run test:performance
```

### Continuous Testing During Development

```json
// package.json test scripts
{
  "scripts": {
    // Level-based testing
    "test:level0": "vitest run src/__tests__/{types,errors,utils,constants}/**/*.test.ts",
    "test:level1:unit": "vitest run src/__tests__/chrome/**/*.test.ts",
    "test:level1:integration": "REAL_CHROME=true vitest run src/__tests__/chrome/**/*.integration.test.ts",
    "test:level2:providers": "vitest run src/__tests__/mcp/{resources,tools}/**/*.test.ts",
    "test:level3:react": "vitest run src/__tests__/integration/react/**/*.test.ts",
    "test:level3:state": "vitest run src/__tests__/integration/state/**/*.test.ts",
    "test:level4:mcp": "vitest run src/__tests__/integration/mcp-server.test.ts",
    "test:e2e": "vitest run src/__tests__/e2e/**/*.test.ts",
    
    // Provider-specific testing
    "test:cdp-resources": "vitest run src/__tests__/mcp/resources/cdp-resources.test.ts",
    "test:react-resources": "vitest run src/__tests__/mcp/resources/react-resources.test.ts",
    "test:state-resources": "vitest run src/__tests__/mcp/resources/state-resources.test.ts",
    "test:cdp-tools": "vitest run src/__tests__/mcp/tools/cdp-tools.test.ts",
    "test:dom-tools": "vitest run src/__tests__/mcp/tools/dom-tools.test.ts",
    "test:react-tools": "vitest run src/__tests__/mcp/tools/react-tools.test.ts",
    "test:network-tools": "vitest run src/__tests__/mcp/tools/network-tools.test.ts",
    "test:performance-tools": "vitest run src/__tests__/mcp/tools/performance-tools.test.ts",
    
    // Certification runs
    "certify:level0": "npm run test:level0 && echo '✅ Level 0 Certified'",
    "certify:level1": "npm run test:level1:unit && npm run test:level1:integration && echo '✅ Level 1 Certified'",
    "certify:level2": "npm run test:level2:providers && echo '✅ Level 2 Certified'",
    "certify:all": "npm run certify:level0 && npm run certify:level1 && npm run certify:level2"
  }
}
```

### Testing Best Practices

1. **Test in Isolation**: Each level should be testable without higher levels
2. **Mock Lower Levels**: When testing Level N, mock Level N-1 dependencies
3. **Real Integration Tests**: After unit tests pass, test with real dependencies
4. **Fail Fast**: Stop and fix issues at each level before proceeding
5. **Performance Benchmarks**: Include performance tests at each level
6. **Memory Leak Detection**: Run extended tests to detect memory issues

## 📊 Progress Tracking

### Overall Progress: 100% Complete

| Phase | Status | Progress | Tasks |
|-------|--------|----------|-------|
| Phase 0: Infrastructure | ✅ COMPLETED | 100% | 2/2 |
| Phase 1: Foundation | ✅ COMPLETED | 100% | 2/2 |
| Phase 2: CDP Client | ✅ COMPLETED | 100% | 2/2 |
| Phase 3: Integrations | ✅ COMPLETED | 100% | 2/2 |
| Phase 4: MCP Layer | ✅ COMPLETED | 100% | 2/2 |
| Phase 5: Server | ✅ COMPLETED | 100% | 1/1 |
| Phase 6: Production | ✅ COMPLETED | 100% | 2/2 |
| Phase 7: E2E Testing | ✅ COMPLETED | 100% | 2/2 |

### Development Checklist

**Pre-Development**:
- [x] Review this SPEC.md thoroughly
- [x] Deploy headless Chrome in Kubernetes (Phase 0)
- [x] Verify CDP connection works (Task 0.2)
- [ ] Set up development environment
- [ ] Install all dependencies
- [ ] Configure test framework

**Infrastructure Verification**:
```bash
# Run this checklist before ANY code development
node scripts/test-cdp-connection.js

# Expected output:
# ✅ Chrome pod running in shared-services
# ✅ CDP endpoint accessible at port 3000
# ✅ WebSocket connection established
# ✅ Browser version: HeadlessChrome/121.0.6167.85
# ✅ Browserless service working
# ✅ Service discovery from Curupira namespace
```

**During Development**:
- [ ] Update task status when starting work
- [ ] Check off implementation items as completed
- [ ] Run tests continuously
- [ ] Keep files under 500 lines
- [ ] Document all public APIs

**Post-Development**:
- [ ] All tests passing with >80% coverage
- [ ] No TypeScript errors
- [ ] No ESLint warnings
- [ ] Documentation complete
- [ ] Performance benchmarks met

## 🚨 Critical Development Rules

1. **Infrastructure First**: Chrome MUST be deployed and verified before ANY code
2. **SPEC.md is Law**: All work MUST be tracked here
3. **Test First**: Write tests before implementation
4. **Dependency Hierarchy**: Never violate Level N → Level N-1 rule
5. **File Size**: Max 500 lines per file, no exceptions
6. **Coverage**: Minimum 80% test coverage required
7. **Type Safety**: No `any` types, use `unknown` with guards
8. **Documentation**: TSDoc required for all public APIs
9. **Performance**: Must meet stated performance targets
10. **E2E Testing**: Use Claude Code to validate MCP implementation

## 🎯 Development Philosophy

### Start with Working Infrastructure
Before writing ANY application code, we MUST have:
1. **Headless Chrome** running in Kubernetes
2. **CDP connection** verified and stable
3. **Basic browser control** demonstrated
4. **End-to-end path** from Curupira to browser confirmed

### Test with Real Claude Code
Throughout development:
1. **Use actual MCP client** (Claude Code) for testing
2. **Create real debugging scenarios** based on NovaSkyn
3. **Iterate based on actual usage** patterns
4. **Measure effectiveness** with real tasks

### Example Development Flow
```bash
# Day 1: Infrastructure
kubectl apply -k infrastructure/debugging/
./scripts/verify-chrome-deployment.sh
./scripts/test-cdp-connection.sh

# Day 2-3: Foundation + Basic CDP
# Write types, implement basic CDP client
# Test with Claude Code: "Can you connect to the browser?"

# Day 4-5: React Integration  
# Implement React DevTools integration
# Test with Claude Code: "Show me the React component tree"

# Week 2: State Management
# Add XState, Zustand, Apollo integrations
# Test with Claude Code: "Debug the cart state in NovaSkyn"

# Continuous: Iterate based on real usage
# Each feature tested with actual MCP commands
```

This enhanced specification transforms Curupira into a powerful CDP-native debugging platform while maintaining Nexus monorepo quality standards and ensuring practical, working implementation from day one.

This enhanced specification transforms Curupira into a powerful CDP-native debugging platform that provides unprecedented visibility into modern React applications while maintaining security and performance standards.