# Curupira Implementation Tasks - Enriched with Dependencies

## Overview

This document provides the enriched task list following a strict bottom-up dependency structure. Each task includes:
- Prerequisites (dependencies)
- Implementation steps
- Testing requirements
- Certification criteria
- Output artifacts

## Phase Structure

```
Foundation (Level 0) → Infrastructure (Level 1) → Integration (Level 2) 
→ MCP Core (Level 3) → Browser (Level 4) → State Mgmt (Level 5) 
→ Advanced (Level 6) → Production (Level 7)
```

---

## Level 0: Foundation Layer (Day 1 Morning)

### Task 0.1: Shared Types & Interfaces
**Duration**: 4 hours  
**Dependencies**: None  
**Location**: `shared/src/types/`

#### Implementation:
```bash
# Create type structure
mkdir -p shared/src/types/{core,messages,branded,state}
```

#### Files to create:
1. `shared/src/types/core.ts` - Core domain types
2. `shared/src/types/messages.ts` - IPC message types  
3. `shared/src/types/branded.ts` - Branded types for type safety
4. `shared/src/types/state.ts` - State management types
5. `shared/src/types/index.ts` - Public API exports

#### Testing:
```typescript
// shared/src/types/__tests__/types.test.ts
import { expectType, expectError } from 'tsd'
import { SessionId, UserId, MessageType } from '../index'

test('branded types prevent mixing', () => {
  const userId = createUserId('123')
  const sessionId = createSessionId('456')
  
  // @ts-expect-error - Cannot assign different branded types
  const wrong: UserId = sessionId
})

test('message types are exhaustive', () => {
  const message: MessageType = { type: 'unknown' } // Should error
})
```

#### Certification:
- [ ] No `any` types used
- [ ] All types exported with JSDoc
- [ ] Compile with `--strict`
- [ ] Type tests pass
- [ ] <500 lines total

#### Output:
- Type definition files
- Type tests
- API documentation

---

### Task 0.2: Configuration System
**Duration**: 3 hours  
**Dependencies**: None  
**Location**: `shared/src/config/`

#### Implementation:
```typescript
// shared/src/config/schema.ts
import { z } from 'zod'

export const ConfigSchema = z.object({
  env: z.enum(['development', 'staging', 'production']),
  server: z.object({
    port: z.number().min(1024).max(65535),
    host: z.string(),
  }),
  auth: z.object({
    enabled: z.boolean(),
    jwtSecret: z.string().optional(),
  }),
  features: z.object({
    timeTravel: z.boolean(),
    profiling: z.boolean(),
  })
})

export type Config = z.infer<typeof ConfigSchema>
```

#### Testing:
```typescript
test('validates configuration', () => {
  const valid = { env: 'development', server: { port: 8080 } }
  expect(() => ConfigSchema.parse(valid)).not.toThrow()
  
  const invalid = { env: 'dev' } // Wrong enum value
  expect(() => ConfigSchema.parse(invalid)).toThrow()
})

test('loads environment-specific config', () => {
  process.env.NODE_ENV = 'production'
  const config = loadConfig()
  expect(config.auth.enabled).toBe(true)
})
```

#### Certification:
- [ ] All configs validated with Zod
- [ ] Environment variable support
- [ ] No hardcoded values
- [ ] Config tests pass
- [ ] Type-safe access

---

### Task 0.3: Logging & Telemetry
**Duration**: 3 hours  
**Dependencies**: Task 0.2 (config)  
**Location**: `shared/src/logging/`

#### Implementation:
```typescript
// shared/src/logging/logger.ts
import pino from 'pino'
import { Config } from '../config'

export function createLogger(config: Config) {
  return pino({
    level: config.logLevel,
    transport: config.env === 'development' ? {
      target: 'pino-pretty'
    } : undefined,
    formatters: {
      level: (label) => ({ level: label }),
    },
    serializers: {
      error: pino.stdSerializers.err,
      req: (req) => ({
        method: req.method,
        url: req.url,
        id: req.id
      })
    }
  })
}
```

#### Testing:
```typescript
test('logger respects log level', () => {
  const logger = createLogger({ logLevel: 'warn' })
  const spy = jest.spyOn(process.stdout, 'write')
  
  logger.info('should not appear')
  logger.warn('should appear')
  
  expect(spy).toHaveBeenCalledWith(expect.stringContaining('should appear'))
  expect(spy).not.toHaveBeenCalledWith(expect.stringContaining('should not appear'))
})

test('performance overhead', () => {
  const start = performance.now()
  for (let i = 0; i < 1000; i++) {
    logger.info('test message', { index: i })
  }
  const duration = performance.now() - start
  expect(duration).toBeLessThan(1000) // <1ms per log
})
```

#### Certification:
- [ ] Structured JSON logging
- [ ] <1ms overhead per log
- [ ] Log levels work correctly
- [ ] No sensitive data logged
- [ ] Child logger support

---

### Task 0.4: Error Types & Handling  
**Duration**: 2 hours  
**Dependencies**: None  
**Location**: `shared/src/errors/`

#### Implementation:
```typescript
// shared/src/errors/types.ts
export abstract class CurupiraError extends Error {
  abstract readonly code: string
  abstract readonly statusCode: number
  
  constructor(message: string, public readonly cause?: Error) {
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }
  
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      stack: this.stack,
      cause: this.cause?.message
    }
  }
}

export class TransportError extends CurupiraError {
  readonly code = 'TRANSPORT_ERROR'
  readonly statusCode = 503
}

export class ProtocolError extends CurupiraError {
  readonly code = 'PROTOCOL_ERROR' 
  readonly statusCode = 400
}

export class AuthenticationError extends CurupiraError {
  readonly code = 'AUTH_ERROR'
  readonly statusCode = 401
}
```

#### Testing:
```typescript
test('error serialization preserves stack trace', () => {
  const cause = new Error('root cause')
  const error = new TransportError('connection failed', cause)
  const json = error.toJSON()
  
  expect(json.code).toBe('TRANSPORT_ERROR')
  expect(json.stack).toContain('TransportError')
  expect(json.cause).toBe('root cause')
})

test('error instanceof checks work', () => {
  const error = new ProtocolError('bad request')
  expect(error).toBeInstanceOf(CurupiraError)
  expect(error).toBeInstanceOf(ProtocolError)
  expect(error).not.toBeInstanceOf(TransportError)
})
```

#### Certification:
- [ ] All errors extend base class
- [ ] Stack traces preserved
- [ ] Errors serializable
- [ ] Cause chain support
- [ ] TypeScript discriminated unions work

---

## Level 1: Core Infrastructure (Day 1 Afternoon)

### Task 1.1: Transport Layer
**Duration**: 6 hours  
**Dependencies**: Task 0.1 (types), Task 0.4 (errors)  
**Location**: `mcp-server/src/transport/`

#### Prerequisites Check:
```bash
# Verify dependencies are ready
npm run test:level0
npm run certify:level0
```

#### Implementation:
```typescript
// mcp-server/src/transport/base.ts
import { MessageType, SessionId } from '@curupira/types'
import { TransportError } from '@curupira/errors'

export interface Transport {
  connect(): Promise<void>
  disconnect(): Promise<void>
  send(message: MessageType): Promise<void>
  onMessage(handler: MessageHandler): void
  isConnected(): boolean
}

export abstract class BaseTransport implements Transport {
  protected handlers = new Set<MessageHandler>()
  protected connected = false
  protected session?: SessionId
  
  abstract connect(): Promise<void>
  abstract disconnect(): Promise<void>
  abstract send(message: MessageType): Promise<void>
  
  onMessage(handler: MessageHandler) {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }
  
  isConnected() {
    return this.connected
  }
}
```

#### Testing:
```typescript
// Unit tests
test('transport message delivery', async () => {
  const transport = new MockTransport()
  const received: MessageType[] = []
  
  transport.onMessage((msg) => received.push(msg))
  await transport.connect()
  
  const message = { type: 'test', id: '1' }
  await transport.send(message)
  
  expect(received).toContainEqual(message)
})

// Integration tests with L0
test('transport uses error types correctly', async () => {
  const transport = new MockTransport()
  transport.simulateError()
  
  await expect(transport.connect()).rejects.toThrow(TransportError)
})

// Performance tests
test('transport handles high throughput', async () => {
  const transport = new MockTransport()
  await transport.connect()
  
  const start = Date.now()
  const promises = Array(10000).fill(0).map((_, i) => 
    transport.send({ type: 'test', id: String(i) })
  )
  await Promise.all(promises)
  const duration = Date.now() - start
  
  expect(duration).toBeLessThan(1000) // 10k messages in <1s
})
```

#### Certification:
- [ ] Message ordering preserved
- [ ] Reconnection logic works
- [ ] Error handling complete
- [ ] Performance targets met
- [ ] No message loss

---

### Task 1.2: MCP Protocol Core
**Duration**: 8 hours  
**Dependencies**: Task 0.1 (types)  
**Location**: `mcp-server/src/protocol/`

#### Implementation:
```typescript
// mcp-server/src/protocol/mcp.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { JsonRpcRequest, JsonRpcResponse } from '@curupira/types'

export class MCPProtocolHandler {
  private server: Server
  private requestHandlers = new Map<string, RequestHandler>()
  
  constructor() {
    this.server = new Server({
      name: 'curupira',
      version: '1.0.0',
      capabilities: {
        resources: true,
        tools: true,
        prompts: true
      }
    })
    
    this.setupHandlers()
  }
  
  async handleRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    try {
      const handler = this.requestHandlers.get(request.method)
      if (!handler) {
        return this.errorResponse(request.id, -32601, 'Method not found')
      }
      
      const result = await handler(request.params)
      return {
        jsonrpc: '2.0',
        id: request.id,
        result
      }
    } catch (error) {
      return this.errorResponse(request.id, -32603, error.message)
    }
  }
}
```

#### Testing:
```typescript
// Protocol compliance tests
test('handles valid JSON-RPC requests', async () => {
  const protocol = new MCPProtocolHandler()
  const response = await protocol.handleRequest({
    jsonrpc: '2.0',
    id: 1,
    method: 'resources/list',
    params: {}
  })
  
  expect(response).toMatchObject({
    jsonrpc: '2.0',
    id: 1,
    result: expect.any(Array)
  })
})

// MCP specification tests
test('implements all required MCP methods', async () => {
  const protocol = new MCPProtocolHandler()
  const methods = [
    'resources/list',
    'resources/read', 
    'tools/list',
    'tools/call',
    'prompts/list',
    'prompts/get'
  ]
  
  for (const method of methods) {
    const response = await protocol.handleRequest({
      jsonrpc: '2.0',
      id: 1,
      method,
      params: {}
    })
    expect(response.error).toBeUndefined()
  }
})
```

#### Certification:
- [ ] JSON-RPC 2.0 compliant
- [ ] All MCP methods implemented
- [ ] Error handling correct
- [ ] Request correlation works
- [ ] Concurrent request handling

---

## Level 2: Integration Layer (Day 2)

### Task 2.1: WebSocket Handler
**Duration**: 6 hours  
**Dependencies**: Task 1.1 (transport), Task 1.3 (server)  
**Location**: `mcp-server/src/transport/websocket.ts`

#### Prerequisites:
```bash
# Ensure Level 1 is certified
npm run certify:level1
```

#### Implementation:
```typescript
// mcp-server/src/transport/websocket.ts
import { WebSocket } from 'ws'
import { BaseTransport } from './base'
import { FastifyInstance } from 'fastify'

export class WebSocketTransport extends BaseTransport {
  private ws?: WebSocket
  private reconnectTimer?: NodeJS.Timeout
  private heartbeatTimer?: NodeJS.Timeout
  
  constructor(
    private server: FastifyInstance,
    private path: string = '/mcp'
  ) {
    super()
    this.setupWebSocketRoute()
  }
  
  private setupWebSocketRoute() {
    this.server.get(this.path, { websocket: true }, (connection) => {
      this.handleConnection(connection.socket)
    })
  }
  
  private handleConnection(socket: WebSocket) {
    this.ws = socket
    this.connected = true
    this.setupHeartbeat()
    
    socket.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString())
        this.handlers.forEach(handler => handler(message))
      } catch (error) {
        this.logger.error({ error }, 'Failed to parse message')
      }
    })
    
    socket.on('close', () => {
      this.connected = false
      this.scheduleReconnect()
    })
  }
}
```

#### Testing:
```typescript
// Connection stability tests
test('WebSocket maintains connection with heartbeat', async () => {
  const server = createTestServer()
  const transport = new WebSocketTransport(server)
  
  const client = new WebSocket('ws://localhost:8080/mcp')
  await waitForConnection(client)
  
  // Wait for heartbeat interval
  await sleep(35000)
  
  expect(client.readyState).toBe(WebSocket.OPEN)
})

// Message ordering tests
test('WebSocket preserves message order', async () => {
  const messages = []
  transport.onMessage(msg => messages.push(msg))
  
  for (let i = 0; i < 100; i++) {
    await transport.send({ id: i })
  }
  
  expect(messages.map(m => m.id)).toEqual([...Array(100).keys()])
})

// Reconnection tests
test('WebSocket reconnects after disconnect', async () => {
  await transport.connect()
  await transport.disconnect()
  await transport.connect()
  
  expect(transport.isConnected()).toBe(true)
})
```

#### Certification:
- [ ] Heartbeat keeps connection alive
- [ ] Reconnection works reliably
- [ ] Message ordering preserved
- [ ] Binary and text messages supported
- [ ] Handles backpressure

---

### Task 2.2: Chrome DevTools Protocol
**Duration**: 8 hours  
**Dependencies**: Task 1.2 (protocol)  
**Location**: `mcp-server/src/integrations/cdp.ts`

#### Implementation:
```typescript
// mcp-server/src/integrations/cdp.ts
import CDP from 'chrome-remote-interface'
import { EventEmitter } from 'events'

export class CDPClient extends EventEmitter {
  private client?: CDP.Client
  private domains = new Set<string>()
  
  async connect(options: CDP.Options) {
    this.client = await CDP(options)
    await this.enableDomains()
    this.setupEventForwarding()
  }
  
  private async enableDomains() {
    const domains = ['Console', 'Network', 'DOM', 'Runtime', 'Debugger']
    for (const domain of domains) {
      await this.client[domain].enable()
      this.domains.add(domain)
    }
  }
  
  async executeCommand(domain: string, method: string, params?: any) {
    if (!this.client) throw new Error('Not connected')
    return this.client[domain][method](params)
  }
  
  async evaluateExpression(expression: string) {
    return this.executeCommand('Runtime', 'evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    })
  }
}
```

#### Testing:
```typescript
// CDP command execution tests
test('CDP executes commands', async () => {
  const cdp = new CDPClient()
  await cdp.connect({ port: 9222 })
  
  const result = await cdp.evaluateExpression('1 + 1')
  expect(result.result.value).toBe(2)
})

// Event capture tests
test('CDP captures console logs', async () => {
  const logs = []
  cdp.on('Console.messageAdded', (params) => {
    logs.push(params.message)
  })
  
  await cdp.evaluateExpression('console.log("test")')
  await waitFor(() => logs.length > 0)
  
  expect(logs[0].text).toBe('test')
})

// Domain management tests
test('CDP enables all required domains', async () => {
  await cdp.connect({ port: 9222 })
  
  const domains = ['Console', 'Network', 'DOM', 'Runtime', 'Debugger']
  for (const domain of domains) {
    expect(cdp.isDomainEnabled(domain)).toBe(true)
  }
})
```

#### Certification:
- [ ] All CDP domains accessible
- [ ] Command execution works
- [ ] Event subscription works
- [ ] Error handling complete
- [ ] Memory management correct

---

## Level 3: MCP Implementation (Day 3)

### Task 3.1: MCP Resources
**Duration**: 8 hours  
**Dependencies**: Task 2.3 (messages), Task 1.2 (protocol)  
**Location**: `mcp-server/src/mcp/resources/`

#### Prerequisites:
```bash
npm run certify:level2
```

#### Implementation Structure:
```
mcp-server/src/mcp/resources/
├── base.ts          # Base resource class
├── console.ts       # Console log resources
├── network.ts       # Network request resources  
├── dom.ts          # DOM element resources
├── state.ts        # State snapshot resources
└── index.ts        # Resource registry
```

#### Example Implementation:
```typescript
// mcp-server/src/mcp/resources/console.ts
import { Resource, ResourceHandler } from './base'
import { CDPClient } from '../../integrations/cdp'

export class ConsoleResource implements ResourceHandler {
  private logs: ConsoleLog[] = []
  private maxLogs = 1000
  
  constructor(private cdp: CDPClient) {
    this.cdp.on('Console.messageAdded', this.handleLog.bind(this))
  }
  
  async list(): Promise<Resource[]> {
    return [
      {
        uri: 'console://logs',
        name: 'Console Logs',
        description: 'Browser console output',
        mimeType: 'application/json'
      },
      {
        uri: 'console://errors',
        name: 'Console Errors',
        description: 'JavaScript errors',
        mimeType: 'application/json'
      }
    ]
  }
  
  async read(uri: string): Promise<any> {
    const url = new URL(uri)
    
    switch (url.pathname) {
      case '/logs':
        return this.getLogs(url.searchParams)
      case '/errors':
        return this.getErrors()
      default:
        throw new Error(`Unknown console resource: ${uri}`)
    }
  }
  
  private getLogs(params: URLSearchParams) {
    let logs = [...this.logs]
    
    // Apply filters
    const level = params.get('level')
    if (level) {
      logs = logs.filter(log => log.level === level)
    }
    
    const limit = parseInt(params.get('limit') || '100')
    return logs.slice(-limit)
  }
}
```

#### Testing Each Resource Type:
```typescript
// Console resource tests
test('console resource captures logs', async () => {
  const resource = new ConsoleResource(cdp)
  
  // Trigger console log
  await cdp.evaluateExpression('console.log("test message")')
  
  const logs = await resource.read('console://logs')
  expect(logs).toContainEqual(
    expect.objectContaining({
      level: 'log',
      text: 'test message'
    })
  )
})

// Network resource tests  
test('network resource tracks requests', async () => {
  const resource = new NetworkResource(cdp)
  
  // Trigger network request
  await cdp.evaluateExpression('fetch("/api/test")')
  
  const requests = await resource.read('network://requests')
  expect(requests).toContainEqual(
    expect.objectContaining({
      method: 'GET',
      url: expect.stringContaining('/api/test')
    })
  )
})

// State resource tests
test('state resource captures snapshots', async () => {
  const resource = new StateResource(bridge)
  
  const state = await resource.read('state://zustand/cart')
  expect(state).toMatchObject({
    items: expect.any(Array),
    total: expect.any(Number)
  })
})
```

#### Certification:
- [ ] All resource types implemented
- [ ] Filtering/querying works
- [ ] Memory limits enforced
- [ ] Resource URIs follow spec
- [ ] Concurrent access safe

---

## Level 4: Browser Integration (Day 4)

### Task 4.1: Extension Core
**Duration**: 6 hours  
**Dependencies**: Task 0.1 (types)  
**Location**: `chrome-extension/src/`

#### Implementation:
```typescript
// chrome-extension/src/manifest.json
{
  "manifest_version": 3,
  "name": "Curupira MCP Debugger",
  "version": "1.0.0",
  "permissions": [
    "debugger",
    "tabs",
    "storage",
    "scripting"
  ],
  "host_permissions": [
    "http://localhost:*/*",
    "https://*.novaskyn.com/*"
  ],
  "background": {
    "service_worker": "background/service-worker.js",
    "type": "module"
  },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content/index.js"],
    "run_at": "document_start"
  }]
}
```

#### Service Worker:
```typescript
// chrome-extension/src/background/service-worker.ts
import { MessageType } from '@curupira/types'

class CurupiraBackground {
  private ws?: WebSocket
  private tabs = new Map<number, chrome.tabs.Tab>()
  
  constructor() {
    this.setupListeners()
    this.connectToMCP()
  }
  
  private setupListeners() {
    // Extension install/update
    chrome.runtime.onInstalled.addListener(this.handleInstall.bind(this))
    
    // Message from content scripts
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this))
    
    // Tab lifecycle
    chrome.tabs.onCreated.addListener(this.handleTabCreated.bind(this))
    chrome.tabs.onRemoved.addListener(this.handleTabRemoved.bind(this))
  }
  
  private async connectToMCP() {
    const config = await this.getConfig()
    this.ws = new WebSocket(config.mcpUrl)
    
    this.ws.onmessage = (event) => {
      const message: MessageType = JSON.parse(event.data)
      this.routeMessage(message)
    }
  }
}

new CurupiraBackground()
```

#### Testing:
```typescript
// Extension installation tests
test('extension installs without errors', async () => {
  const extension = await loadExtension()
  expect(extension.errors).toHaveLength(0)
})

// Permission tests
test('extension has required permissions', async () => {
  const manifest = await getManifest()
  expect(manifest.permissions).toContain('debugger')
  expect(manifest.permissions).toContain('tabs')
})

// Message passing tests
test('background script receives content script messages', async () => {
  const background = await getBackgroundPage()
  const received = []
  
  background.onMessage((msg) => received.push(msg))
  
  await sendFromContentScript({ type: 'test' })
  expect(received).toContainEqual({ type: 'test' })
})
```

#### Certification:
- [ ] Extension loads without errors
- [ ] All permissions granted
- [ ] Service worker stays alive
- [ ] Message passing works
- [ ] Storage API works

---

## Level 5: State Management Integration (Day 5)

### Task 5.1: React Integration
**Duration**: 8 hours  
**Dependencies**: Task 4.4 (bridge), Task 3.1 (resources)  
**Location**: `chrome-extension/src/injected/react.ts`

#### Implementation:
```typescript
// chrome-extension/src/injected/react.ts
export class ReactIntegration {
  private fiberRoot?: any
  private components = new Map<string, ComponentInfo>()
  
  initialize() {
    this.hookReactDevTools()
    this.instrumentReactDOM()
  }
  
  private hookReactDevTools() {
    // Wait for React DevTools global
    const checkDevTools = () => {
      const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__
      if (hook) {
        this.setupDevToolsIntegration(hook)
      } else {
        setTimeout(checkDevTools, 100)
      }
    }
    checkDevTools()
  }
  
  private setupDevToolsIntegration(hook: any) {
    // Hook into React DevTools events
    const originalCommit = hook.onCommitFiberRoot
    hook.onCommitFiberRoot = (id: number, root: any) => {
      this.fiberRoot = root
      this.extractComponents(root)
      originalCommit?.call(hook, id, root)
    }
    
    // Monitor component updates
    hook.onCommitFiberUnmount = (id: number, fiber: any) => {
      this.components.delete(fiber.type?.name || fiber.type)
    }
  }
  
  private extractComponents(root: any) {
    const components = []
    
    function traverse(fiber: any) {
      if (fiber.type && typeof fiber.type !== 'string') {
        components.push({
          name: fiber.type.name || 'Anonymous',
          props: fiber.memoizedProps,
          state: fiber.memoizedState,
          hooks: extractHooks(fiber)
        })
      }
      
      if (fiber.child) traverse(fiber.child)
      if (fiber.sibling) traverse(fiber.sibling)
    }
    
    traverse(root.current)
    this.sendUpdate('react.components', components)
  }
}
```

#### Testing:
```typescript
// React discovery tests
test('discovers React components', async () => {
  const integration = new ReactIntegration()
  integration.initialize()
  
  // Mount test component
  const TestComponent = () => {
    const [count, setCount] = useState(0)
    return <div>{count}</div>
  }
  
  render(<TestComponent />)
  await waitFor(() => integration.getComponents().length > 0)
  
  const components = integration.getComponents()
  expect(components).toContainEqual(
    expect.objectContaining({
      name: 'TestComponent',
      hooks: expect.arrayContaining([
        expect.objectContaining({ type: 'useState' })
      ])
    })
  )
})

// State extraction tests
test('extracts component state and props', async () => {
  const integration = new ReactIntegration()
  integration.initialize()
  
  render(<MyComponent prop1="test" prop2={42} />)
  
  const component = integration.findComponent('MyComponent')
  expect(component.props).toEqual({
    prop1: 'test',
    prop2: 42
  })
})
```

#### Certification:
- [ ] Discovers all React components
- [ ] Extracts props correctly
- [ ] Captures hooks state
- [ ] Tracks component updates
- [ ] No performance impact

---

## Level 6: Advanced Features (Week 2)

### Task 6.3: Time Travel
**Duration**: 8 hours  
**Dependencies**: Task 2.4 (storage), Task 5.2, Task 5.3  
**Location**: `mcp-server/src/features/time-travel.ts`

#### Implementation:
```typescript
// mcp-server/src/features/time-travel.ts
export class TimeTravelRecorder {
  private recording = false
  private events: StateEvent[] = []
  private snapshots: StateSnapshot[] = []
  private maxDuration = 3600000 // 1 hour
  
  startRecording() {
    this.recording = true
    this.events = []
    this.snapshots = []
    this.captureInitialState()
    
    // Subscribe to all state sources
    this.subscribeToXState()
    this.subscribeToZustand()
    this.subscribeToApollo()
  }
  
  private captureEvent(event: StateEvent) {
    if (!this.recording) return
    
    // Add timestamp and stack trace
    event.timestamp = Date.now()
    event.stackTrace = new Error().stack
    
    this.events.push(event)
    
    // Periodic snapshots for faster seeking
    if (this.events.length % 100 === 0) {
      this.captureSnapshot()
    }
    
    // Circular buffer - remove old events
    this.trimOldEvents()
  }
  
  async replay(fromTime: number, toTime?: number) {
    const snapshot = this.findNearestSnapshot(fromTime)
    await this.restoreSnapshot(snapshot)
    
    // Replay events from snapshot to target time
    const events = this.events.filter(e => 
      e.timestamp >= snapshot.timestamp && 
      e.timestamp <= (toTime || Date.now())
    )
    
    for (const event of events) {
      await this.replayEvent(event)
      await this.delay(10) // Configurable replay speed
    }
  }
}
```

#### Testing:
```typescript
// Recording accuracy tests
test('records all state changes', async () => {
  const recorder = new TimeTravelRecorder()
  recorder.startRecording()
  
  // Perform state changes
  store.setState({ count: 1 })
  machine.send('INCREMENT')
  await apolloClient.writeQuery({ query, data })
  
  const recording = recorder.stopRecording()
  expect(recording.events).toHaveLength(3)
  expect(recording.events[0].source).toBe('zustand')
  expect(recording.events[1].source).toBe('xstate')
  expect(recording.events[2].source).toBe('apollo')
})

// Replay fidelity tests
test('replay reproduces exact state', async () => {
  // Record a session
  recorder.startRecording()
  
  const stateChanges = []
  for (let i = 0; i < 10; i++) {
    store.setState({ count: i })
    stateChanges.push(store.getState())
    await delay(100)
  }
  
  const recording = recorder.stopRecording()
  
  // Reset state
  store.setState({ count: 0 })
  
  // Replay and verify
  await recorder.loadRecording(recording)
  await recorder.replay(0)
  
  expect(store.getState()).toEqual(stateChanges[9])
})

// Performance tests
test('recording has minimal overhead', async () => {
  const withoutRecording = await benchmark(() => {
    for (let i = 0; i < 1000; i++) {
      store.setState({ count: i })
    }
  })
  
  recorder.startRecording()
  const withRecording = await benchmark(() => {
    for (let i = 0; i < 1000; i++) {
      store.setState({ count: i })
    }
  })
  
  const overhead = (withRecording - withoutRecording) / withoutRecording
  expect(overhead).toBeLessThan(0.05) // <5% overhead
})
```

#### Certification:
- [ ] Records all state sources
- [ ] Replay is 100% accurate
- [ ] <5% performance overhead
- [ ] Handles large recordings
- [ ] Export/import works

---

## Level 7: Production Ready (Week 2 End)

### Task 7.4: E2E Testing
**Duration**: 8 hours  
**Dependencies**: All L6 features  
**Location**: `e2e/`

#### Implementation:
```typescript
// e2e/curupira.test.ts
import { test, expect } from '@playwright/test'
import { CurupiraClient } from './helpers/client'

test.describe('Curupira E2E Tests', () => {
  let client: CurupiraClient
  
  test.beforeEach(async ({ page, context }) => {
    // Install extension
    await context.addInitScript({
      path: 'chrome-extension/dist/content.js'
    })
    
    // Connect to MCP server
    client = new CurupiraClient()
    await client.connect()
    
    // Navigate to test app
    await page.goto('http://localhost:3000')
  })
  
  test('complete debugging workflow', async ({ page }) => {
    // 1. Verify extension loaded
    const bridgeReady = await page.evaluate(() => 
      window.__CURUPIRA_BRIDGE__ !== undefined
    )
    expect(bridgeReady).toBe(true)
    
    // 2. Trigger an error
    await page.click('[data-testid="trigger-error"]')
    
    // 3. Query MCP for console errors
    const errors = await client.query('console://errors')
    expect(errors).toContainEqual(
      expect.objectContaining({
        text: 'Test error triggered'
      })
    )
    
    // 4. Inspect component state
    const state = await client.query('state://react/ErrorBoundary')
    expect(state.hasError).toBe(true)
    
    // 5. Time travel to before error
    await client.call('timeTravel.jumpTo', {
      timestamp: Date.now() - 5000
    })
    
    // 6. Verify state restored
    const restoredState = await client.query('state://react/ErrorBoundary')
    expect(restoredState.hasError).toBe(false)
  })
  
  test('performance profiling workflow', async ({ page }) => {
    // Start profiling
    await client.call('profiler.start', {
      categories: ['react', 'network']
    })
    
    // Perform actions
    await page.click('[data-testid="load-products"]')
    await page.waitForSelector('[data-testid="product-card"]')
    
    // Stop profiling
    const profile = await client.call('profiler.stop')
    
    // Verify profile data
    expect(profile.react.renders).toBeGreaterThan(0)
    expect(profile.network.requests).toBeGreaterThan(0)
    expect(profile.duration).toBeGreaterThan(0)
  })
})
```

#### Cross-Browser Testing:
```typescript
// e2e/cross-browser.test.ts
const browsers = ['chromium', 'firefox', 'webkit']

for (const browserName of browsers) {
  test.describe(`${browserName} compatibility`, () => {
    test('extension works in browser', async ({ browser }) => {
      const context = await browser.newContext()
      
      if (browserName === 'chromium') {
        // Load extension for Chromium
        await loadExtension(context)
      }
      
      const page = await context.newPage()
      await page.goto('http://localhost:3000')
      
      // Test basic functionality
      const client = new CurupiraClient()
      await client.connect()
      
      const resources = await client.call('resources.list')
      expect(resources.length).toBeGreaterThan(0)
    })
  })
}
```

#### Performance Benchmarks:
```typescript
// e2e/benchmarks.test.ts
test.describe('Performance Benchmarks', () => {
  test('handles high-frequency state updates', async () => {
    const updateCount = 10000
    const start = Date.now()
    
    for (let i = 0; i < updateCount; i++) {
      await page.evaluate((i) => {
        window.store.setState({ count: i })
      }, i)
    }
    
    const duration = Date.now() - start
    const updatesPerSecond = updateCount / (duration / 1000)
    
    expect(updatesPerSecond).toBeGreaterThan(1000)
  })
  
  test('memory usage stays bounded', async () => {
    // Record for 5 minutes
    await client.call('recording.start')
    
    // Generate lots of events
    for (let i = 0; i < 5 * 60; i++) {
      await page.evaluate(() => {
        console.log('test message')
        fetch('/api/test')
        window.store.setState({ timestamp: Date.now() })
      })
      await page.waitForTimeout(1000)
    }
    
    const metrics = await client.call('metrics.get')
    expect(metrics.memoryUsage).toBeLessThan(200 * 1024 * 1024) // <200MB
  })
})
```

#### Certification:
- [ ] All user workflows tested
- [ ] Cross-browser compatibility
- [ ] Performance targets met
- [ ] Memory usage bounded
- [ ] No flaky tests

---

## Build Automation

### Level Build Script
```bash
#!/bin/bash
# scripts/build-level.sh

LEVEL=$1

case $LEVEL in
  0)
    echo "Building Level 0: Foundation"
    npm run build:types
    npm run build:config
    npm run build:logging
    npm run build:errors
    ;;
  1)
    echo "Building Level 1: Infrastructure"
    ./scripts/certify-level.sh 0 || exit 1
    npm run build:transport
    npm run build:protocol
    npm run build:server-core
    npm run build:security
    ;;
  2)
    echo "Building Level 2: Integration"
    ./scripts/certify-level.sh 1 || exit 1
    npm run build:websocket
    npm run build:cdp
    npm run build:messages
    npm run build:storage
    ;;
  # ... continue for all levels
esac
```

### Certification Script
```bash
#!/bin/bash
# scripts/certify-level.sh

LEVEL=$1

echo "Certifying Level $LEVEL"

# Run tests
npm run test:level$LEVEL || exit 1

# Check coverage
COVERAGE=$(npm run coverage:level$LEVEL --silent | grep "All files" | awk '{print $3}' | sed 's/%//')
if (( $(echo "$COVERAGE < 90" | bc -l) )); then
  echo "Coverage too low: $COVERAGE%"
  exit 1
fi

# Run performance benchmarks
npm run bench:level$LEVEL || exit 1

# Security scan
npm run security:level$LEVEL || exit 1

# Generate certification
cat > "certs/level$LEVEL.json" <<EOF
{
  "level": $LEVEL,
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "coverage": $COVERAGE,
  "status": "certified"
}
EOF

echo "Level $LEVEL certified!"
```

## Summary

This enriched task structure ensures:

1. **Bottom-up Dependencies**: Each level depends only on lower levels
2. **Complete Testing**: Every component has unit, integration, and performance tests
3. **Certification Gates**: Can't proceed without passing all tests
4. **Modular Building**: Each piece is a complete, tested "lego"
5. **Clear Progress**: Easy to see what's done and what depends on what
6. **Parallel Work**: Multiple people can work on same level
7. **Quality Assurance**: Every level meets strict quality criteria

The approach mirrors the Rust CLAUDE.md philosophy but adapted for TypeScript/JavaScript ecosystem.