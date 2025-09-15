# Curupira Development Guide for Claude

This guide outlines the systematic approach to developing Curupira - the CDP-native MCP debugging platform for React applications.

## 🚨 CRITICAL RULES (STRICTLY HIERARCHICAL & DETERMINISTIC)

### RULE 0: **Strict Dependency Hierarchy** 🏗️
- **Level N → Level 0 to N-1 ONLY** (no upward/circular/sideways)
- **Dependency graph = DAG** (Directed Acyclic Graph)
- **Violations = build failure**

### RULE 1: **One Canonical Implementation** 🗡️
- **ONE of everything**: CDP client, resource provider, tool handler
- **Find duplicates → Delete → Update imports**
- **PR with duplicates = auto-reject**

### RULE 2: **Pure Functional Core** 🧪
- **Business logic = pure functions**
- **Components = pure** (props → same output)
- **Side effects in boundaries only** (Chrome API, MCP transport)
- **Test everything** (behavior, not implementation)

### RULE 3: **Explicit State Machines** 🎯
- **ALL state = XState machines** (useState BANNED)
- **Every state explicitly defined**
- **Illegal transitions impossible**
- **Chrome connection states managed deterministically**

### RULE 4: **Type-Driven Architecture** 📐
- **Types first, code second**
- **Branded types** (SessionId, TargetId, not string)
- **Named exports only** (testability)
- **Exhaustive matching** (no defaults)

### RULE 5: **Technology Stack Compliance** 🛠️
- **State**: XState + TypeScript strict mode
- **Testing**: Vitest + MSW + Chrome DevTools Protocol mocks
- **Chrome API**: Native Chrome DevTools Protocol over WebSocket
- **MCP**: Official @modelcontextprotocol/sdk
- **Build**: TypeScript 5.2+ with strict mode

### RULE 6: **Modular Boundaries** 📦
- **Max 500 lines/file** (200 for React components)
- **Feature folders** with index.ts exports
- **Private internals** (not exported)
- **Clear public APIs**

## 📊 Strict Hierarchy (Dependencies Flow DOWN Only)

```
Level 0: Foundation    → types, errors, constants, pure utils
Level 1: Chrome Core   → CDP client, connection management
Level 2: MCP Core      → resource providers, tool handlers
Level 3: Integration   → React detection, state management bridges
Level 4: Server        → transport, routing, main server
```

**RULE**: Level N imports ONLY from Level 0 to N-1

## 🔄 Implementation Process

1. **Type-First**: Define CDP/MCP types and interfaces
2. **Bottom-Up**: Build Level 0 → 4
3. **Test Each Level**: Before proceeding up
4. **Enforce Hierarchy**: No upward imports

## 🚨 Critical Violations

- **Circular dependencies** → Restructure immediately
- **Upward imports** → Move to lower level
- **Duplicates** → Delete, use canonical
- **useState** → Convert to XState
- **Files >500 lines** → Modularize

## 📋 Component Pattern

```typescript
FeatureName/
├── types.ts          # Branded types, interfaces
├── machine.ts        # XState ONLY (no useState)
├── FeatureName.tsx   # < 200 lines, pure
├── index.ts          # Public API exports
└── tests/            # Comprehensive tests
```

## 🎯 Code Examples

```typescript
// ✅ CORRECT: Branded types
type SessionId = string & { readonly _brand: 'SessionId' }
type TargetId = string & { readonly _brand: 'TargetId' }

// ✅ CORRECT: XState only
const [state, send] = useMachine(chromeConnectionMachine)

// ✅ CORRECT: Pure functions
export const parseChromeCDPEvent = (event: CDPEvent): ParsedEvent => {
  // Pure transformation
}

// ❌ WRONG: All banned
useState() // Use XState
export default // Named exports only
any // Use unknown + type guards
```

## 🎯 Success Metrics

1. ✅ **Strict hierarchy** (no circular/upward dependencies)
2. ✅ **Zero duplicates** (one canonical everything)
3. ✅ **Pure functional** (deterministic, testable)
4. ✅ **All XState** (no useState)
5. ✅ **<500 lines/file**
6. ✅ **>80% test coverage**

## Development Workflow

### Initial Setup
```bash
# Clone and setup
cd curupira
npm install
npm run setup:dev  # Configures Chrome debugging, MCP transport
```

### Daily Development
```bash
# Start development servers (Level 4 → 0 dependency order)
npm run dev

# Run tests in watch mode (test hierarchy compliance)
npm run test:watch

# Check code quality (enforce rules)
npm run quality

# Fix code issues (auto-fix violations)
npm run quality:fix
```

### Before Committing
```bash
# Run all hierarchy checks
npm run hierarchy:check   # Verify dependency graph
npm run duplicates:check  # Find duplicate implementations
npm run types:check      # TypeScript strict mode
npm run test            # All tests must pass

# Or use the combined command
npm run ci:check
```

## 🏛️ Curupira Architecture (Level-Based)

### Level 0: Foundation Types
```typescript
// Pure types and constants (no dependencies)
export type SessionId = string & { readonly _brand: 'SessionId' }
export type TargetId = string & { readonly _brand: 'TargetId' }

export interface CDPEvent {
  method: string;
  params: unknown;
  sessionId: SessionId;
}

export interface MCPResource {
  uri: string;
  name: string;
  mimeType?: string;
}
```

### Level 1: Chrome Core
```typescript
// CDP client and connection management (depends on Level 0)
export class ChromeClient {
  async createSession(targetId: TargetId): Promise<SessionId>
  async send<T>(method: string, params: unknown, sessionId: SessionId): Promise<T>
  async enableDomain(domain: string, sessionId: SessionId): Promise<void>
}

export class ConnectionManager {
  async connect(options: CDPConnectionOptions): Promise<void>
  async disconnect(): Promise<void>
  getState(): ConnectionState
}
```

### Level 2: MCP Core
```typescript
// Resource providers and tool handlers (depends on Level 0-1)
export class ResourceProvider {
  async listResources(): Promise<MCPResource[]>
  async readResource(uri: string): Promise<ResourceContent>
}

export class ToolHandler {
  async listTools(): Promise<MCPTool[]>
  async callTool(name: string, args: unknown): Promise<ToolResult>
}
```

### Level 3: Integration Layer
```typescript
// Framework detection and bridges (depends on Level 0-2)
export class ReactDetector {
  async detectReactVersion(sessionId: SessionId): Promise<ReactInfo>
  async getFiberTree(sessionId: SessionId): Promise<FiberNode[]>
}

export class StateManagerBridge {
  async detectStateManagers(sessionId: SessionId): Promise<StateManagerInfo[]>
  async getZustandStores(sessionId: SessionId): Promise<ZustandStore[]>
}
```

### Level 4: Server Layer
```typescript
// Transport and main server (depends on Level 0-3)
export class CurupiraServer {
  async start(): Promise<void>
  async setupTransports(): Promise<void>
  async setupMCPHandlers(): Promise<void>
}
```

### Component Architecture
```
curupira/
├── shared/                    # Level 0: Foundation types and utilities
│   ├── types/                 # CDP, MCP, React type definitions
│   ├── constants/             # Static configuration values
│   └── utils/                 # Pure utility functions
├── mcp-server/                # Level 1-4: Server implementation
│   ├── src/
│   │   ├── chrome/            # Level 1: CDP client and connection
│   │   ├── mcp/               # Level 2: Resource providers, tools
│   │   ├── integrations/      # Level 3: React, state management bridges
│   │   └── server/            # Level 4: Transport and main server
└── chrome-extension/          # Separate component (Browser extension)
    ├── content/               # Page context integration
    ├── background/            # Service worker
    └── popup/                 # Extension UI
```

### Message Flow (Hierarchical)
```
Level 4: Server Transport ← MCP Protocol ← AI Assistant
    ↓
Level 3: React Integration ← State Management Bridge
    ↓
Level 2: MCP Handlers ← Resource Providers ← Tool Handlers
    ↓
Level 1: Chrome Client ← CDP Connection ← WebSocket
    ↓
Level 0: Types & Utils ← Pure Functions ← Constants
```

## MCP Implementation Guidelines

### Resources
Resources are data providers that expose browser state:
```typescript
// Pattern for resource handlers
server.setRequestHandler('resources/list', async (request) => {
  // List available resources
})

server.setRequestHandler('resources/read', async (request) => {
  // Return resource data
})
```

### Tools
Tools are actions that can modify browser state:
```typescript
// Pattern for tool handlers
server.setRequestHandler('tools/list', async (request) => {
  // List available tools
})

server.setRequestHandler('tools/call', async (request) => {
  // Execute tool action
})
```

### Prompts
Prompts are templates for common debugging scenarios:
```typescript
// Pattern for prompt handlers
server.setRequestHandler('prompts/list', async (request) => {
  // List available prompts
})

server.setRequestHandler('prompts/get', async (request) => {
  // Return prompt template
})
```

## Chrome Extension Guidelines

### Content Script Rules
1. **Minimal footprint**: Don't pollute the page
2. **Message passing**: Use structured messages
3. **Error boundaries**: Wrap all operations in try-catch
4. **Performance**: Debounce/throttle expensive operations

### Background Script Rules
1. **Single connection**: One WebSocket to MCP server
2. **Message routing**: Route messages to correct tabs
3. **State persistence**: Use Chrome storage API
4. **Reconnection**: Automatic reconnect with backoff

## Security Requirements

### Data Sanitization
- **ALWAYS** sanitize sensitive data before logging
- **NEVER** send passwords, tokens, or PII to MCP
- **USE** the sanitization utilities in shared/utils

### Connection Security
- **Development**: localhost only, no auth
- **Staging**: HTTPS/WSS with JWT auth
- **Production**: Full auth + rate limiting

## Testing Strategy

### Unit Tests
```bash
npm run test:unit  # Fast, isolated tests
```

### Integration Tests
```bash
npm run test:integration  # Test component interactions
```

### E2E Tests
```bash
# Manual testing with Chrome
npm run chrome:dev
```

## Deployment

### Local Development
```bash
npm run dev              # Start all services
npm run dev:docker       # Use Docker instead
```

### Staging Deployment
```bash
npm run deploy:staging   # Build and deploy to k8s
npm run deploy:check     # Verify deployment
```

## Common NPM Scripts

### Development
- `npm run dev` - Start all development servers
- `npm run dev:server` - Start only MCP server
- `npm run dev:extension` - Build extension in watch mode

### Building
- `npm run build` - Build all packages
- `npm run build:docker` - Build Docker image
- `npm run build:staging` - Build for staging environment

### Testing
- `npm run test` - Run all tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate coverage report
- `npm run test:mcp` - Test MCP endpoints

### Code Quality
- `npm run lint` - Lint and fix issues
- `npm run format` - Format with Prettier
- `npm run type-check` - Check TypeScript types
- `npm run quality` - Run all checks
- `npm run quality:fix` - Fix all issues

### Docker
- `npm run docker:run` - Start with Docker Compose
- `npm run docker:logs` - View container logs
- `npm run docker:shell` - Shell into container

## Performance Guidelines

### Resource Limits
- **Console logs**: Circular buffer of 1000 entries
- **Network requests**: Circular buffer of 500 entries
- **Message size**: Max 1MB per WebSocket message
- **Memory usage**: Target <100MB baseline

### Optimization Strategies
1. **Debounce**: User input and state changes
2. **Throttle**: Network request logging
3. **Batch**: Multiple operations into single message
4. **Lazy load**: Extension features on demand

## Error Handling

### Graceful Degradation
```typescript
try {
  // Primary operation
} catch (error) {
  logger.error({ error }, 'Operation failed')
  // Fallback behavior
}
```

### User Feedback
- Log errors to console with context
- Show badge status in extension icon
- Provide clear error messages in MCP responses

## Documentation

### Code Documentation
- **TSDoc**: All public APIs must be documented
- **Examples**: Include usage examples in comments
- **Types**: Let TypeScript be the documentation

### User Documentation
- Keep README.md updated
- Document new MCP resources/tools
- Add integration examples

## Debugging Curupira Itself

### Server Debugging
```bash
# Enable debug logging
CURUPIRA_LOG_LEVEL=debug npm run dev:server

# Use Node.js inspector
node --inspect dist/index.js
```

### Extension Debugging
1. Open `chrome://extensions`
2. Click "Service Worker" to inspect background
3. Use Chrome DevTools on target page for content script

### MCP Protocol Debugging
```bash
# Test with wscat
npm install -g wscat
wscat -c ws://localhost:8080/mcp

# Send test message
{"jsonrpc":"2.0","id":1,"method":"resources/list"}
```

## Best Practices Summary

1. **Always use npm scripts** - No make, no custom scripts
2. **Type everything** - No implicit any
3. **Test everything** - TDD is the way
4. **Small files** - Max 500 lines
5. **Clean commits** - Conventional commits
6. **Document as you go** - Don't leave it for later
7. **Security first** - Sanitize all data
8. **Performance matters** - Profile and optimize

Remember: Curupira helps developers trace backwards through problems, just like its mythological namesake. Make the debugging experience magical! 🦶