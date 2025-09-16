# Curupira MCP Debug Server

> **Context**: Apply general [Nexus Design Principles](../../../../CLAUDE.md) and [TypeScript Standards](../../../libraries/typescript/CLAUDE.md) to Curupira's Chrome DevTools Protocol + MCP bridge architecture.

## 🎯 **Curupira-Specific Implementation**

Curupira is an MCP debugging server that bridges Chrome DevTools Protocol with Model Context Protocol for React application debugging.

### Architecture Overview

```
Chrome DevTools ↔ CDP WebSocket ↔ Curupira Server ↔ MCP Protocol ↔ Claude
```

### Curupira-Specific Hierarchy

```
Level 0: CDP/MCP Types     → SessionId, TargetId, CDP events, MCP schemas
Level 1: Chrome Core       → CDP client, connection management, session handling  
Level 2: MCP Bridge        → resource providers, tool handlers, protocol translation
Level 3: React Detection   → component tree analysis, state inspection
Level 4: MCP Server        → transport, routing, Claude integration
```

## 🔧 **Chrome DevTools Protocol Integration**

### CDP Connection Management

```typescript
// CDP-specific branded types
type SessionId = string & { readonly _brand: 'SessionId' }
type TargetId = string & { readonly _brand: 'TargetId' }

// CDP Connection state machine
const cdpConnectionMachine = createMachine({
  id: 'cdpConnection',
  initial: 'disconnected',
  states: {
    disconnected: {
      on: { CONNECT: 'connecting' }
    },
    connecting: {
      invoke: {
        src: 'establishCDPConnection',
        onDone: { target: 'connected', actions: 'storeSession' },
        onError: { target: 'failed', actions: 'logError' }
      }
    },
    connected: {
      on: { 
        DISCONNECT: 'disconnected',
        SESSION_LOST: 'reconnecting'
      }
    },
    reconnecting: {
      invoke: {
        src: 'reconnectCDP',
        onDone: 'connected',
        onError: 'failed'
      }
    },
    failed: {
      on: { RETRY: 'connecting' }
    }
  }
})
```

### React Application Detection

```typescript
// React-specific detection strategies
interface ReactDetectionStrategy {
  detect(session: SessionId): Promise<ReactInfo | null>
}

class ReactDevToolsStrategy implements ReactDetectionStrategy {
  constructor(private cdpClient: CDPClient) {}
  
  async detect(session: SessionId): Promise<ReactInfo | null> {
    // Check for React DevTools global
    const result = await this.cdpClient.evaluateExpression(
      session,
      'window.__REACT_DEVTOOLS_GLOBAL_HOOK__'
    )
    
    if (result.type === 'object') {
      return this.extractReactInfo(session)
    }
    
    return null
  }
}
```

## 🌉 **MCP Protocol Bridge**

### Resource Providers (Curupira-Specific)

```typescript
// MCP resource for React component tree
class ReactComponentTreeProvider implements ResourceProvider {
  constructor(
    private cdpClient: CDPClient,
    private reactDetector: ReactDetectionStrategy
  ) {}
  
  async listResources(): Promise<Resource[]> {
    const sessions = await this.cdpClient.getActiveSessions()
    const resources: Resource[] = []
    
    for (const session of sessions) {
      const reactInfo = await this.reactDetector.detect(session.id)
      if (reactInfo) {
        resources.push({
          uri: `chrome://session/${session.id}/react/components`,
          name: `React Components (${session.title})`,
          mimeType: 'application/json'
        })
      }
    }
    
    return resources
  }
  
  async readResource(uri: string): Promise<string> {
    const { sessionId } = this.parseResourceUri(uri)
    const componentTree = await this.extractComponentTree(sessionId)
    return JSON.stringify(componentTree, null, 2)
  }
}
```

### Tool Handlers (Curupira-Specific)

```typescript
// MCP tool for inspecting React components
class ReactInspectorTool implements ToolHandler {
  name = 'inspect_react_component'
  description = 'Inspect React component props, state, and hooks'
  
  inputSchema = {
    type: 'object',
    properties: {
      sessionId: { type: 'string' },
      componentId: { type: 'string' },
      includeHooks: { type: 'boolean', default: true }
    },
    required: ['sessionId', 'componentId']
  }
  
  async execute(args: any): Promise<ToolResult> {
    const { sessionId, componentId, includeHooks } = args
    
    const component = await this.cdpClient.evaluateExpression(
      SessionId.from(sessionId),
      `window.__REACT_DEVTOOLS_GLOBAL_HOOK__.getComponentById("${componentId}")`
    )
    
    const result = {
      props: component.props,
      state: component.state,
      ...(includeHooks && { hooks: component.hooks })
    }
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    }
  }
}
```

## 🧪 **Testing Strategy (Curupira-Specific)**

### CDP Mock Infrastructure

```typescript
// Mock CDP WebSocket for testing
class MockCDPWebSocket {
  private eventHandlers = new Map<string, Function[]>()
  
  send(message: string): void {
    const parsed = JSON.parse(message)
    // Simulate CDP responses based on method
    this.simulateResponse(parsed)
  }
  
  private simulateResponse(request: any): void {
    switch (request.method) {
      case 'Runtime.evaluate':
        this.emit('message', {
          id: request.id,
          result: { type: 'string', value: 'mock result' }
        })
        break
      case 'Target.getTargets':
        this.emit('message', {
          id: request.id,
          result: { targetInfos: [mockTargetInfo] }
        })
        break
    }
  }
}
```

### React App Testing Environment

```typescript
// Test React app setup for Curupira testing
function createTestReactApp(): string {
  return `
    <!DOCTYPE html>
    <html>
    <body>
      <div id="root"></div>
      <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
      <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
      <script>
        const { useState } = React;
        
        function TestComponent() {
          const [count, setCount] = useState(0);
          return React.createElement('div', null, 
            'Count: ', count,
            React.createElement('button', { 
              onClick: () => setCount(c => c + 1) 
            }, 'Increment')
          );
        }
        
        ReactDOM.render(React.createElement(TestComponent), document.getElementById('root'));
      </script>
    </body>
    </html>
  `
}
```

## 📊 **Configuration (Curupira-Specific)**

### Chrome Connection Config

```yaml
# config/curupira.yaml
chrome:
  debugging_port: 9222
  connection_timeout: 5000
  reconnect_attempts: 3
  session_keep_alive: true

mcp:
  server_name: "curupira"
  version: "1.0.0"
  capabilities:
    resources: true
    tools: true
    prompts: false

react_detection:
  strategies:
    - "react_devtools"
    - "react_global_check" 
    - "fiber_root_detection"
  timeout: 2000
```

### Environment Variable Overrides

```bash
# Chrome configuration
CHROME_DEBUGGING_PORT=9222
CHROME_CONNECTION_TIMEOUT=10000

# MCP server configuration  
MCP_SERVER_NAME=curupira-debug
MCP_LOG_LEVEL=debug

# React detection
REACT_DETECTION_TIMEOUT=5000
REACT_DEVTOOLS_REQUIRED=false
```

## 🚀 **Development Workflow**

1. **Start Chrome with debugging**: `chrome --remote-debugging-port=9222`
2. **Run Curupira server**: `npm run start:dev`
3. **Connect Claude**: Use MCP client to connect to Curupira
4. **Open React app**: Navigate to React application in Chrome
5. **Debug via Claude**: Ask Claude to inspect React components

This implementation applies Nexus principles specifically to the unique requirements of Chrome DevTools Protocol bridging and React application debugging.
