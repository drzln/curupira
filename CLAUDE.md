# Curupira MCP Debug Server

> **Context**: Apply general [Nexus Design Principles](../../../../CLAUDE.md) and [TypeScript Standards](../../../libraries/typescript/CLAUDE.md) to Curupira's Chrome DevTools Protocol + MCP bridge architecture.

## 🎯 **Curupira-Specific Implementation**

Curupira is an MCP debugging server that bridges Chrome DevTools Protocol with Model Context Protocol for React application debugging.

### Architecture Overview

```
Chrome Browser ↔ CDP WebSocket ↔ Curupira Server ↔ MCP Protocol ↔ Claude
```

### Curupira-Specific Hierarchy (Following Nexus Standards)

```
Level 0: Foundation        → Branded types, interfaces, configuration, errors
Level 1: Core Services     → Chrome service, repositories, buffer services  
Level 2: API Layer         → MCP handlers, resource/tool providers, transport
Level 3: Application       → Server bootstrap, dependency injection container
```

## 🔧 **Chrome DevTools Protocol Integration**

### CDP Connection Management

```typescript
// Branded types are defined in shared/src/types/branded.ts
import type { SessionId } from '@curupira/shared';

// Chrome service follows dependency injection pattern
export class ChromeService extends EventEmitter implements IChromeService {
  constructor(
    private readonly config: ChromeConfig,
    private readonly logger: ILogger,
    private readonly consoleBufferService?: IConsoleBufferService,
    networkBufferService?: INetworkBufferService
  ) {
    super();
  }

  async connect(options: ConnectionOptions): Promise<IChromeClient> {
    const client = new ChromeClient(this.logger, this.browserlessDetector, options);
    await client.connect();
    this.client = client;
    
    // Emit events for dynamic tool registration
    this.emit('connected', { client, options });
    
    return client;
  }
}
```

### React Application Detection

```typescript
// React detection implemented in integrations/react/detector.ts
export class ReactDetector {
  constructor(private logger: ILogger) {}
  
  async detect(client: IChromeClient, sessionId?: string): Promise<ReactInfo | null> {
    try {
      // Simplified detection using Runtime.evaluate
      const result = await client.send('Runtime.evaluate', {
        expression: 'typeof window.__REACT_DEVTOOLS_GLOBAL_HOOK__ !== "undefined"',
        returnByValue: true
      }, sessionId);
      
      if (result.result?.value === true) {
        return this.extractReactInfo(client, sessionId);
      }
      
      return null;
    } catch (error) {
      this.logger.debug({ error }, 'React detection failed');
      return null;
    }
  }
}
```

## 🌉 **MCP Protocol Bridge**

### Resource Providers (Actual Implementation)

```typescript
// Resource providers are created as factory functions
// See mcp/resources/browser.ts, dom.ts, network.ts, state.ts
export function createBrowserResourceProvider(
  chromeService: IChromeService,
  logger: ILogger
): IResourceProvider {
  return {
    namespace: 'browser',
    
    async listResources(): Promise<Resource[]> {
      if (!chromeService.isConnected()) {
        return [];
      }
      
      try {
        const client = chromeService.getCurrentClient()!;
        const targets = await client.send('Target.getTargets', {});
        
        return targets.targetInfos.map(target => ({
          uri: `chrome://browser/target/${target.targetId}`,
          name: target.title || target.url || 'Untitled',
          mimeType: 'application/json',
          description: `Target: ${target.type}`
        }));
      } catch (error) {
        logger.error({ error }, 'Failed to list browser resources');
        return [];
      }
    },
    
    async readResource(uri: string): Promise<unknown> {
      // Implementation details...
    }
  };
}
```

### Tool Providers (Factory Pattern Implementation)

```typescript
// Tool providers use factory pattern with dependency injection
// See mcp/tools/providers/*.factory.ts files
export class ReactToolProviderFactory extends BaseProviderFactory implements IToolProviderFactory {
  create(deps: ProviderDependencies): IToolProvider {
    const provider = new BaseToolProvider(deps, {
      namespace: 'react',
      requiresChrome: true,
      chromeRequiredMessage: 'Chrome browser connection required for React tools'
    });

    // Register React-specific tools
    provider.registerTool({
      name: 'react_component_tree',
      description: 'Get React component tree',
      inputSchema: componentTreeSchema,
      handler: withRetry(
        withScriptExecution(deps, async (args, result, deps) => {
          // Tool implementation using Chrome client
          return { success: true, data: result };
        })
      )
    });

    provider.registerTool({
      name: 'react_inspect_component',
      description: 'Inspect specific React component',
      inputSchema: inspectComponentSchema,
      handler: withRetry(
        withScriptExecution(deps, async (args, result, deps) => {
          // Tool implementation
          return { success: true, data: result };
        })
      )
    });
    
    return provider;
  }
}
```

## 🧪 **Testing Strategy (Actual Implementation)**

### Test Container with Dependency Injection

```typescript
// Test container setup - see __tests__/test-container.ts
export function createTestContainer(): Container {
  const container = new DIContainer();
  
  // Register mock services
  container.register(ChromeServiceToken, () => new MockChromeService());
  container.register(LoggerToken, () => new MockLogger());
  container.register(ValidatorToken, () => new MockValidator());
  container.register(ResourceRegistryToken, () => new MockResourceRegistry());
  container.register(ToolRegistryToken, () => new MockToolRegistry());
  
  // Register test configurations
  container.register(ChromeConfigToken, () => ({
    host: 'localhost',
    port: 9222,
    secure: false,
    defaultTimeout: 5000
  }));
  
  return container;
}
```

### Mock Chrome Service Implementation

```typescript
// See __tests__/mocks/chrome-service.mock.ts
export class MockChromeService extends EventEmitter implements IChromeService {
  private connected = false;
  private mockClient: MockChromeClient | null = null;

  async connect(options: ConnectionOptions): Promise<IChromeClient> {
    this.connected = true;
    this.mockClient = new MockChromeClient();
    this.emit('connected', { client: this.mockClient, options });
    return this.mockClient;
  }

  getCurrentClient(): IChromeClient | null {
    return this.mockClient;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.mockClient = null;
    this.emit('disconnected');
  }
  
  // Test helpers
  simulateConnection(): void {
    this.connected = true;
    this.mockClient = new MockChromeClient();
  }
  
  getMockClient(): MockChromeClient {
    if (!this.mockClient) {
      throw new Error('No mock client - call simulateConnection first');
    }
    return this.mockClient;
  }
}
```

### Integration Test Pattern

```typescript
// Example from __tests__/providers/example-provider-di.test.ts
describe('CDPToolProvider with Dependency Injection', () => {
  let container: Container;
  let chromeService: MockChromeService;
  let provider: IToolProvider;

  beforeEach(() => {
    container = createTestContainer();
    chromeService = container.resolve(ChromeServiceToken) as MockChromeService;
    
    const factory = new CDPToolProviderFactory();
    provider = factory.create({
      chromeService: container.resolve(ChromeServiceToken),
      logger: container.resolve(LoggerToken),
      validator: container.resolve(ValidatorToken)
    });
  });

  it('should evaluate JavaScript expression', async () => {
    chromeService.simulateConnection();
    
    const mockClient = chromeService.getMockClient();
    mockClient.simulateSendResult({
      result: { type: 'string', value: 'Hello from Chrome!' }
    });

    const handler = provider.getHandler('cdp_evaluate');
    const result = await handler!.execute({
      expression: 'document.title'
    });

    expect(result.success).toBe(true);
    expect(result.data).toBe('Hello from Chrome!');
  });
});
```

## 📊 **Configuration (Actual Implementation)**

### Nexus-Compliant Configuration

```yaml
# config/base.yaml - Following Nexus configuration hierarchy
version: "1.0.0"

server:
  name: "curupira-mcp-server"
  version: "1.1.3"
  host: "localhost"
  port: 8080
  environment: "development"

logging:
  level: "info"
  pretty: true
  format: "json"

chrome:
  enabled: true
  serviceUrl: "http://localhost:3000"  # Browserless Chrome service
  connectTimeout: 5000
  pageTimeout: 30000
  defaultViewport:
    width: 1920
    height: 1080
  discovery:
    enabled: true
    hosts: ["localhost", "127.0.0.1"]
    ports: [3000]
    timeout: 5000
    autoConnect: false

transports:
  websocket:
    enabled: true
    path: "/mcp"
    pingInterval: 30000
  http:
    enabled: true
    path: "/mcp"
    timeout: 30000
  sse:
    enabled: true
    path: "/mcp/sse"
    keepAliveInterval: 30000

storage:
  minio:
    enabled: false
    endPoint: "localhost"
    port: 9000
    bucket: "curupira-screenshots"
```

### Environment Variable Overrides (Nexus Pattern)

```bash
# Server configuration
SERVER_HOST=0.0.0.0
SERVER_PORT=8080
SERVER_ENVIRONMENT=production

# Chrome configuration
CHROME_ENABLED=true
CHROME_SERVICE_URL=http://browserless:3000
CHROME_DISCOVERY_ENABLED=true
CHROME_DISCOVERY_HOSTS=localhost,chrome-service
CHROME_DISCOVERY_PORTS=3000,9222

# Transport configuration
TRANSPORT_WEBSOCKET_ENABLED=true
TRANSPORT_HTTP_ENABLED=true
TRANSPORT_SSE_ENABLED=true

# Logging
LOGGING_LEVEL=info
LOGGING_PRETTY=false

# Storage (MinIO for large responses)
STORAGE_MINIO_ENABLED=true
STORAGE_MINIO_ENDPOINT=minio.example.com
STORAGE_MINIO_ACCESS_KEY=your_access_key
STORAGE_MINIO_SECRET_KEY=your_secret_key
```

## 🚀 **Development Workflow**

### Local Development Setup

1. **Start Browserless Chrome service** (recommended):
   ```bash
   docker run -p 3000:3000 browserless/chrome
   ```

2. **Configure and run Curupira**:
   ```bash
   # Set config path (optional - defaults to ./config)
   export CURUPIRA_CONFIG_PATH=./config/base.yaml
   
   # Run in development mode
   npm run dev
   
   # Or run directly with stdio transport
   npm run start
   ```

3. **Connect Claude Code**:
   ```bash
   # Add to claude_desktop_config.json
   {
     "mcpServers": {
       "curupira": {
         "command": "node",
         "args": ["/path/to/curupira/mcp-server/dist/main.js"],
         "env": {
           "CHROME_SERVICE_URL": "http://localhost:3000"
         }
       }
     }
   }
   ```

### Testing Workflow

```bash
# Run unit tests with dependency injection
npm run test

# Run integration tests
npm run test:integration

# Run E2E tests with real Chrome
npm run test:e2e
```

## 🏗️ **Key Architectural Differences from Documentation**

1. **No State Machines**: The implementation doesn't use XState or state machines for connection management
2. **Factory Pattern**: Tool and resource providers use factory pattern instead of direct class instantiation
3. **Branded Types**: Defined in shared module, not inline
4. **Static Tool Registration**: Due to Claude Code limitations, all tools are registered at startup
5. **Configuration System**: Full Nexus-compliant YAML + env var hierarchy
6. **Dependency Injection**: Comprehensive DI container for all services

This implementation follows Nexus design principles while adapting to the practical constraints of MCP protocol and Chrome DevTools integration.
