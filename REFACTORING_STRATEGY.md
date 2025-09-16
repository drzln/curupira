# Curupira MCP Server - Comprehensive Refactoring Strategy

## 🔍 **Build Error Analysis Summary**

**Total Errors:** 197 TypeScript compilation errors  
**Critical Pattern:** Tool provider architecture inconsistency

### **Error Breakdown by Type:**
- **TS2339 (97 errors):** Property does not exist on type - Missing methods on ToolHandler interface
- **TS18046 (72 errors):** Type 'unknown' issues - Lack of proper type assertions 
- **TS2352 (23 errors):** Type conversion errors - Unsafe casting from Record<string, unknown>
- **TS7006 (4 errors):** Implicit 'any' types - Missing type annotations
- **TS2345 (1 error):** Argument type mismatch - Transport layer type incompatibility

## 🏗️ **Core Architectural Issues Identified**

### **1. Tool Provider Architecture Incoherence**
**Problem:** Tool providers extend `BaseToolProvider` but implement `ToolHandler` interface that lacks required methods.

**Current Broken Pattern:**
```typescript
// ❌ BROKEN: Handler context doesn't have BaseToolProvider methods
getHandler(toolName: string): ToolHandler | undefined {
  return {
    name: 'tool_name',
    async execute(args): Promise<ToolResult> {
      const sessionId = await this.getSessionId() // ❌ this = ToolHandler, not BaseToolProvider
      const result = await this.executeScript()   // ❌ Missing method
    }
  }
}
```

**Root Cause:** Method binding inconsistency across 10 tool providers (Apollo, CDP, Console, Debugger, DOM, Network, Performance, React, Redux, XState, Zustand).

### **2. Type Safety Erosion** 
**Problem:** Heavy reliance on `unknown` types and unsafe casting patterns.

**Patterns:**
- `args as SpecificType` without validation (23 instances)
- `result` of type 'unknown' without type guards (72 instances)
- Missing input validation schemas

### **3. Code Duplication (Anti-DRY)**
**Problem:** Identical patterns repeated across 10 tool providers:
- Session ID resolution
- Script execution with error handling  
- Library availability checks
- Result type conversion
- Error response formatting

### **4. Test-Code Drift**
**Problem:** Tests passing but build failing indicates test mocking has diverged from implementation.

## 🎯 **Refactoring Strategy: "Architectural Coherence Through Systematic DRY"**

### **Phase 1: Type System Foundation** ⚡ ATOMIC
**Objective:** Establish type safety without changing behavior

**Step 1.1: Create Proper Tool Handler Interface**
```typescript
// mcp-server/src/mcp/tools/types.ts
export interface BoundToolHandler extends ToolHandler {
  // Methods bound from BaseToolProvider
  getSessionId(argSessionId?: string): Promise<SessionId>
  executeScript<T = unknown>(script: string, sessionId: SessionId, options?: ScriptOptions): Promise<ToolResult<T>>
  checkLibraryAvailable(check: string, sessionId: SessionId, name: string): Promise<{ available: boolean; error?: string }>
}

export interface ToolProviderContext {
  provider: BaseToolProvider
  bind<T extends ToolHandler>(handler: T): BoundToolHandler
}
```

**Step 1.2: Type-Safe Argument Validation**
```typescript
// mcp-server/src/mcp/tools/validation.ts
export function validateArgs<T>(args: Record<string, unknown>, schema: JSONSchema): args is T {
  // Runtime validation with proper type guards
  // Return type predicate for type safety
}

export function assertArgs<T>(args: Record<string, unknown>, schema: JSONSchema): T {
  if (!validateArgs<T>(args, schema)) {
    throw new ToolValidationError(`Invalid arguments: ${JSON.stringify(args)}`)
  }
  return args
}
```

**🧪 Test Impact:** MAINTAIN - Tests continue using existing mocks
**⏱️ Duration:** 2 hours  
**✅ Validation:** `npm run test:verify:all` must pass

---

### **Phase 2: Handler Binding Architecture** ⚡ ATOMIC
**Objective:** Fix method binding while preserving existing interfaces

**Step 2.1: Universal Handler Binder**
```typescript
// mcp-server/src/mcp/tools/providers/binder.ts
export function createBoundHandler(provider: BaseToolProvider, handler: ToolHandler): BoundToolHandler {
  return {
    ...handler,
    execute: handler.execute.bind(provider),
    getSessionId: provider.getSessionId.bind(provider),
    executeScript: provider.executeScript.bind(provider), 
    checkLibraryAvailable: provider.checkLibraryAvailable.bind(provider)
  }
}
```

**Step 2.2: Update All Provider getHandler Methods**
```typescript
// Apply to ALL 10 providers atomically
getHandler(toolName: string): ToolHandler | undefined {
  const handler = this.handlers[toolName]
  if (!handler) return undefined
  
  return createBoundHandler(this, handler) // ✅ FIXED: Proper binding
}
```

**🧪 Test Impact:** IMPROVE - Fixes binding issues in existing tests
**⏱️ Duration:** 3 hours  
**✅ Validation:** `npm run test:verify:all` must pass with improved coverage

---

### **Phase 3: DRY Tool Implementation** ⚡ ATOMIC
**Objective:** Extract common patterns into reusable utilities

**Step 3.1: Common Handler Patterns**
```typescript
// mcp-server/src/mcp/tools/patterns/index.ts
export const CommonHandlers = {
  /**
   * Standard session-aware handler wrapper
   */
  withSession<T extends Record<string, unknown>>(
    handler: (args: T, sessionId: SessionId) => Promise<ToolResult>
  ): ToolHandler['execute'] {
    return async function(this: BaseToolProvider, args: Record<string, unknown>): Promise<ToolResult> {
      try {
        const validArgs = args as T // TODO: Add runtime validation
        const sessionId = await this.getSessionId(validArgs.sessionId as string)
        return await handler.call(this, validArgs, sessionId)
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Handler execution failed'
        }
      }
    }
  },

  /**
   * Library-dependent handler wrapper  
   */
  withLibraryCheck<T extends Record<string, unknown>>(
    libraryCheck: string,
    libraryName: string,
    handler: (args: T, sessionId: SessionId) => Promise<ToolResult>
  ): ToolHandler['execute'] {
    return async function(this: BaseToolProvider, args: Record<string, unknown>): Promise<ToolResult> {
      const validArgs = args as T
      const sessionId = await this.getSessionId(validArgs.sessionId as string)
      
      const check = await this.checkLibraryAvailable(libraryCheck, sessionId, libraryName)
      if (!check.available) {
        return { success: false, error: check.error || `${libraryName} not available` }
      }
      
      return await handler.call(this, validArgs, sessionId)
    }
  },

  /**
   * Script execution handler wrapper
   */
  withScriptExecution<T extends Record<string, unknown>>(
    scriptGenerator: (args: T) => string,
    resultTransformer?: (result: unknown) => unknown
  ): ToolHandler['execute'] {
    return this.withSession<T>(async function(args, sessionId) {
      const script = scriptGenerator(args)
      const result = await this.executeScript(script, sessionId)
      
      if (!result.success) return result
      
      const transformedData = resultTransformer ? resultTransformer(result.data) : result.data
      return { success: true, data: transformedData }
    })
  }
}
```

**Step 3.2: Refactor One Provider (Apollo) as Template**
```typescript
// mcp-server/src/mcp/tools/providers/apollo-tools.ts - REFACTORED
export class ApolloToolProvider extends BaseToolProvider implements ToolProvider {
  name = 'apollo'
  
  getHandler(toolName: string): ToolHandler | undefined {
    const handlers: Record<string, ToolHandler> = {
      apollo_inspect_cache: {
        name: 'apollo_inspect_cache',
        description: 'Inspect Apollo Client cache',
        execute: CommonHandlers.withLibraryCheck<ApolloQueryArgs>(
          'window.__APOLLO_CLIENT__',
          'Apollo Client',
          async (args, sessionId) => {
            const script = this.generateInspectCacheScript(args)
            const result = await this.executeScript<ApolloCache>(script, sessionId)
            return result
          }
        )
      }
      // ... other handlers follow same pattern
    }
    
    const handler = handlers[toolName]
    return handler ? createBoundHandler(this, handler) : undefined
  }
  
  private generateInspectCacheScript(args: ApolloQueryArgs): string {
    // Extracted script generation logic
    return `/* Apollo cache inspection script */`
  }
}
```

**🧪 Test Impact:** MAINTAIN - Behavior unchanged, tests pass
**⏱️ Duration:** 4 hours (1 provider + pattern validation)  
**✅ Validation:** Apollo tests must pass, no other tests affected

---

### **Phase 4: Systematic Provider Migration** ⚡ ATOMIC (per provider)
**Objective:** Apply DRY patterns to all remaining providers

**Step 4.1: Provider Migration Order (by complexity)**
1. **CDP Tools** - Direct Chrome API calls (simplest)
2. **Console Tools** - Runtime evaluation patterns  
3. **DOM Tools** - Node manipulation patterns
4. **Debugger Tools** - Debugging protocol patterns
5. **Network Tools** - Network monitoring patterns
6. **Performance Tools** - Profiling patterns (kept simplified)
7. **React Tools** - React DevTools integration
8. **Redux Tools** - State management patterns
9. **XState Tools** - State machine patterns  
10. **Zustand Tools** - Store management patterns

**Per-Provider Migration Pattern:**
```bash
# For each provider:
1. Extract script generation methods
2. Apply CommonHandlers patterns  
3. Update getHandler with createBoundHandler
4. Run tests: npm run test:${provider}-tools
5. Verify no regression in other tests
6. Commit atomically
```

**🧪 Test Impact:** MAINTAIN - All existing tests continue passing
**⏱️ Duration:** 1-2 hours per provider (10-20 hours total)  
**✅ Validation:** After each provider: `npm run test:verify:all`

---

### **Phase 5: Type Safety Hardening** ⚡ ATOMIC
**Objective:** Eliminate 'unknown' types and unsafe casting

**Step 5.1: Runtime Validation Integration**
```typescript
// mcp-server/src/mcp/tools/patterns/validation.ts
export function createValidatedHandler<TArgs, TResult = unknown>(
  schema: JSONSchema,
  handler: (args: TArgs, sessionId: SessionId) => Promise<ToolResult<TResult>>
): ToolHandler['execute'] {
  return async function(this: BaseToolProvider, args: Record<string, unknown>): Promise<ToolResult<TResult>> {
    try {
      const validArgs = assertArgs<TArgs>(args, schema)
      const sessionId = await this.getSessionId(validArgs.sessionId as string)
      return await handler.call(this, validArgs, sessionId)
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Validation failed'
      }
    }
  }
}
```

**Step 5.2: Type-Safe Script Results**
```typescript
// mcp-server/src/mcp/tools/patterns/script-execution.ts
export function createTypedScriptResult<T>(
  result: unknown,
  validator: (value: unknown) => value is T
): ToolResult<T> {
  if (!validator(result)) {
    return {
      success: false,
      error: 'Script result validation failed',
      data: result as T // Fallback for debugging
    }
  }
  
  return {
    success: true,
    data: result
  }
}
```

**🧪 Test Impact:** IMPROVE - Better error messages, type safety
**⏱️ Duration:** 6 hours  
**✅ Validation:** Zero TS18046 errors, tests pass with better coverage

---

### **Phase 6: Transport Layer Fix** ⚡ ATOMIC
**Objective:** Fix WebSocket transport type mismatches

**Step 6.1: Transport Type Alignment**
```typescript
// mcp-server/src/server/transport-setup.ts
import type { WebSocket } from 'ws'
import type { SocketStream } from '@fastify/websocket'

// Fix: Proper WebSocket adaptation
const transport = new WebSocketTransport(socket.socket as WebSocket) // ✅ Access underlying WebSocket
```

**Step 6.2: SSE Transport Type Fix**
```typescript
// mcp-server/src/server/transport.ts  
import type { ServerResponse } from 'http'

// Fix: Proper ServerResponse typing
const transport = new SSEServerTransport('/', reply.raw as ServerResponse)
```

**🧪 Test Impact:** MAINTAIN - Transport tests continue passing
**⏱️ Duration:** 2 hours  
**✅ Validation:** Transport tests pass, no build errors

---

### **Phase 7: Test Enhancement & Validation** ⚡ ATOMIC
**Objective:** Strengthen tests to prevent regression

**Step 7.1: Enhanced Provider Tests**
```typescript
// Enhanced test patterns for each provider
describe('${Provider}ToolProvider - Enhanced', () => {
  it('should have proper method binding', async () => {
    const provider = new ${Provider}ToolProvider()
    const handler = provider.getHandler('tool_name')
    
    expect(handler).toBeDefined()
    expect(handler.getSessionId).toBeDefined()
    expect(handler.executeScript).toBeDefined()
    expect(handler.checkLibraryAvailable).toBeDefined()
  })
  
  it('should validate input arguments', async () => {
    const provider = new ${Provider}ToolProvider()
    const handler = provider.getHandler('tool_name')
    
    const result = await handler.execute({}) // Invalid args
    expect(result.success).toBe(false)
    expect(result.error).toContain('validation')
  })
  
  it('should handle type-safe script execution', async () => {
    // Test type safety improvements
  })
})
```

**Step 7.2: Integration Test Expansion**
```typescript
// mcp-server/src/__tests__/integration/tool-providers.test.ts
describe('Tool Providers Integration', () => {
  it('should maintain 100% tool availability', () => {
    // Verify all providers expose expected tools
  })
  
  it('should have consistent error handling', () => {
    // Verify unified error response format
  })
  
  it('should pass type safety validation', () => {
    // Verify no 'unknown' type leakage
  })
})
```

**🧪 Test Impact:** IMPROVE - Expanded coverage, regression prevention
**⏱️ Duration:** 4 hours  
**✅ Validation:** Coverage increase from 181 to 200+ tests

---

## 📊 **Success Metrics & Validation**

### **Build Success Criteria:**
- **Zero TypeScript compilation errors** 
- **All 181+ existing tests pass**
- **No behavioral changes** (API compatibility maintained)
- **Improved type safety** (elimination of 'unknown' types)

### **Code Quality Improvements:**
- **50%+ reduction in code duplication** across tool providers
- **100% method binding correctness** 
- **Type-safe argument validation** for all tools
- **Consistent error handling** patterns

### **Test Coverage Targets:**
- **Maintain 100% existing test pass rate**
- **Add 20+ new tests** for binding and validation
- **Increase integration test coverage** by 15%

### **Validation Commands:**
```bash
# After each atomic step:
npm run test:verify:all              # Core functionality
npm run test:level2                  # MCP provider level  
npm run build                        # TypeScript compilation
npm run quality                      # Code quality checks

# Final validation:
npm run test:coverage                # Coverage report
npm run type-check                   # Strict TypeScript
```

## ⚡ **Implementation Timeline**

| Phase | Duration | Key Deliverable | Validation |
|-------|----------|----------------|------------|
| 1 | 2h | Type foundations | Tests pass |
| 2 | 3h | Handler binding | Tests + binding fix |
| 3 | 4h | DRY patterns + Apollo example | Apollo tests pass |
| 4 | 15h | All provider migrations | Provider tests pass |
| 5 | 6h | Type safety hardening | Zero TS errors |
| 6 | 2h | Transport fixes | Build success |
| 7 | 4h | Test enhancements | Coverage increase |
| **Total** | **36h** | **Zero build errors** | **200+ tests pass** |

## 🚨 **Critical Success Factors**

1. **Atomic Changes:** Each phase must be independently validated
2. **Test-First Validation:** No change proceeds without test verification  
3. **Behavior Preservation:** API compatibility is non-negotiable
4. **Incremental Verification:** Build must pass after each atomic step
5. **Rollback Strategy:** Each commit must be independently revertible

## 🎯 **Expected Outcomes**

### **Immediate Benefits:**
- ✅ **Project builds successfully**
- ✅ **Type safety restored** 
- ✅ **Code duplication eliminated**
- ✅ **Architecture coherence established**

### **Long-term Benefits:**
- 🚀 **Faster development** (DRY patterns)
- 🛡️ **Reduced bugs** (type safety)
- 🔧 **Easier maintenance** (consistent patterns)
- 📈 **Better testability** (cleaner architecture)

---

**Next Step:** Begin Phase 1 - Type System Foundation
**Command:** `npm run test:verify:all` (establish baseline)