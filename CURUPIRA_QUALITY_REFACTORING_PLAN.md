# Curupira Quality Refactoring and Polish Plan

## 🎯 Executive Summary

This document outlines a comprehensive plan to refactor and polish the Curupira MCP server codebase, addressing critical issues in type safety, dependency injection, testability, and code organization. The goal is to achieve 100% test passing, zero TypeScript errors, and a maintainable architecture that follows SOLID principles.

## 📊 Current State Analysis

### Metrics
- **TypeScript Errors**: 13 (down from 201)
- **Test Status**: 130/221 passing (59%)
- **Test Files**: 8/17 passing (47%)
- **Code Duplication**: High (13+ tool providers with identical patterns)
- **Type Safety**: Medium (validateAndCast used in only 8/13 providers)
- **Testability**: Low (singleton dependencies throughout)
- **Dependency Injection**: None (tight coupling to ChromeManager)

### Critical Issues
1. **Singleton Anti-pattern**: ChromeManager, ToolRegistry, ResourceRegistry
2. **Type Safety Violations**: 13 TypeScript errors, unsafe casts, missing type guards
3. **Poor Testability**: Direct singleton access prevents mocking
4. **Code Duplication**: Identical patterns across all tool providers
5. **Inconsistent Error Handling**: Mixed strategies, silent failures
6. **Missing Abstractions**: No interfaces for external dependencies

## 🏗️ Refactoring Architecture

### Phase 1: Dependency Injection Foundation (2-3 days)

#### 1.1 Create DI Container and Interfaces

```typescript
// src/core/di/container.ts
export interface Container {
  register<T>(token: Token<T>, factory: Factory<T>): void
  resolve<T>(token: Token<T>): T
  createScope(): Container
}

// src/core/di/tokens.ts
export const ChromeClientToken = createToken<IChromeClient>('ChromeClient')
export const ToolRegistryToken = createToken<IToolRegistry>('ToolRegistry')
export const LoggerToken = createToken<ILogger>('Logger')

// src/core/interfaces/chrome-client.interface.ts
export interface IChromeClient {
  connect(options: ConnectionOptions): Promise<void>
  disconnect(): Promise<void>
  createSession(targetId?: string): Promise<SessionInfo>
  getTypedClient(): ITypedCDPClient
  // ... rest of interface
}

// src/core/interfaces/tool-registry.interface.ts  
export interface IToolRegistry {
  register(provider: IToolProvider): void
  listAllTools(): Tool[]
  executeTool(name: string, args: unknown): Promise<ToolResult>
}
```

#### 1.2 Refactor ChromeManager to ChromeService

```typescript
// src/chrome/chrome.service.ts
export class ChromeService implements IChromeService {
  constructor(
    private readonly config: ChromeConfig,
    private readonly logger: ILogger
  ) {}
  
  // No more singleton!
  async connect(options: ConnectionOptions): Promise<IChromeClient> {
    const client = new ChromeClient(this.config, this.logger)
    await client.connect(options)
    return client
  }
}

// src/chrome/chrome.provider.ts
export const chromeProvider = {
  provide: ChromeServiceToken,
  useFactory: (config: ChromeConfig, logger: ILogger) => {
    return new ChromeService(config, logger)
  },
  inject: [ChromeConfigToken, LoggerToken]
}
```

#### 1.3 Create Provider Factory Pattern

```typescript
// src/mcp/tools/provider.factory.ts
export interface ProviderDependencies {
  chromeService: IChromeService
  logger: ILogger
  validator: IValidator
}

export interface IToolProviderFactory {
  create(deps: ProviderDependencies): IToolProvider
}

// src/mcp/tools/providers/cdp-tools.factory.ts
export class CDPToolProviderFactory implements IToolProviderFactory {
  create(deps: ProviderDependencies): IToolProvider {
    return new CDPToolProvider(
      deps.chromeService,
      deps.logger,
      deps.validator
    )
  }
}
```

### Phase 2: Type Safety and Validation (1-2 days)

#### 2.1 Fix All TypeScript Errors

```typescript
// src/types/chrome-extensions.ts
import type { Target as BaseTarget } from 'chrome-remote-interface'

export interface ExtendedTarget extends BaseTarget {
  faviconUrl?: string
}

// src/types/evaluation.ts
export interface ExtendedEvaluateOptions extends EvaluateOptions {
  includeCommandLineAPI?: boolean
}

export interface ExtendedEvaluateResult extends EvaluateResult {
  result: {
    type: string
    value?: any
    objectId?: string
    className?: string
    preview?: any
  }
  exceptionDetails?: {
    text: string
    lineNumber?: number
    columnNumber?: number
    scriptId?: string
    stackTrace?: any
  }
}
```

#### 2.2 Create Type-Safe Validation Layer

```typescript
// src/core/validation/validator.ts
export class Validator implements IValidator {
  validateAndTransform<T>(
    input: unknown,
    schema: Schema<T>,
    context: string
  ): Result<T, ValidationError> {
    try {
      const validated = schema.parse(input)
      return Result.ok(validated)
    } catch (error) {
      return Result.err(new ValidationError(context, error))
    }
  }
}

// src/core/validation/schemas/tool-args.ts
export const chromeConnectSchema = z.object({
  host: z.string().default('localhost'),
  port: z.number().default(9222),
  secure: z.boolean().default(false),
  sessionId: z.string().optional()
})

export type ChromeConnectArgs = z.infer<typeof chromeConnectSchema>
```

#### 2.3 Implement Result Type Pattern

```typescript
// src/core/result.ts
export class Result<T, E> {
  private constructor(
    private readonly value: T | null,
    private readonly error: E | null
  ) {}
  
  static ok<T, E>(value: T): Result<T, E> {
    return new Result(value, null)
  }
  
  static err<T, E>(error: E): Result<T, E> {
    return new Result(null, error)
  }
  
  isOk(): boolean {
    return this.value !== null
  }
  
  isErr(): boolean {
    return this.error !== null
  }
  
  unwrap(): T {
    if (this.isErr()) {
      throw new Error('Called unwrap on an Err value')
    }
    return this.value!
  }
  
  map<U>(fn: (value: T) => U): Result<U, E> {
    return this.isOk() 
      ? Result.ok(fn(this.value!))
      : Result.err(this.error!)
  }
}
```

### Phase 3: Eliminate Code Duplication (2-3 days)

#### 3.1 Extract Common Provider Patterns

```typescript
// src/mcp/tools/base-tool-provider.ts
export abstract class BaseToolProvider<TConfig = any> implements IToolProvider {
  protected readonly tools = new Map<string, ToolDefinition>()
  
  constructor(
    protected readonly chromeService: IChromeService,
    protected readonly logger: ILogger,
    protected readonly validator: IValidator,
    protected readonly config?: TConfig
  ) {}
  
  // Common pattern extraction
  protected registerTool(definition: ToolDefinition): void {
    this.tools.set(definition.name, definition)
  }
  
  listTools(): Tool[] {
    return Array.from(this.tools.values()).map(def => ({
      name: def.name,
      description: def.description,
      inputSchema: def.inputSchema
    }))
  }
  
  getHandler(toolName: string): ToolHandler | undefined {
    const definition = this.tools.get(toolName)
    if (!definition) return undefined
    
    return {
      name: definition.name,
      description: definition.description,
      execute: async (args) => {
        // Common validation
        const validationResult = this.validator.validateAndTransform(
          args,
          definition.argsSchema,
          `${this.name}.${toolName}`
        )
        
        if (validationResult.isErr()) {
          return {
            success: false,
            error: validationResult.error.message
          }
        }
        
        // Common chrome session handling
        const sessionResult = await this.getOrCreateSession(args.sessionId)
        if (sessionResult.isErr()) {
          return {
            success: false,
            error: sessionResult.error.message
          }
        }
        
        // Delegate to specific implementation
        return this.executeWithContext(
          definition,
          validationResult.value,
          sessionResult.value
        )
      }
    }
  }
  
  protected abstract executeWithContext(
    definition: ToolDefinition,
    args: any,
    context: ExecutionContext
  ): Promise<ToolResult>
}
```

#### 3.2 Create Higher-Order Tool Functions

```typescript
// src/mcp/tools/decorators/tool.decorator.ts
export function Tool(metadata: ToolMetadata) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value
    
    descriptor.value = async function (
      this: BaseToolProvider,
      args: unknown
    ): Promise<ToolResult> {
      // Automatic validation
      const validated = await this.validator.validateAndTransform(
        args,
        metadata.argsSchema,
        `${this.name}.${metadata.name}`
      )
      
      if (validated.isErr()) {
        return {
          success: false,
          error: validated.error.message
        }
      }
      
      // Automatic session handling
      const context = await this.createExecutionContext(validated.value)
      
      // Call original method with validated args and context
      return originalMethod.call(this, validated.value, context)
    }
    
    // Register tool metadata
    if (!target._tools) {
      target._tools = new Map()
    }
    target._tools.set(metadata.name, {
      handler: descriptor.value,
      metadata
    })
  }
}

// Usage example
export class CDPToolProvider extends BaseToolProvider {
  @Tool({
    name: 'cdp_evaluate',
    description: 'Evaluate JavaScript in browser',
    argsSchema: cdpEvaluateSchema
  })
  async evaluate(
    args: CDPEvaluateArgs,
    context: ExecutionContext
  ): Promise<ToolResult> {
    const result = await context.typedClient.evaluate(
      args.expression,
      { awaitPromise: true },
      context.sessionId
    )
    
    return {
      success: true,
      data: result.value
    }
  }
}
```

### Phase 4: Test Infrastructure Overhaul (2-3 days)

#### 4.1 Create Test Container and Mocks

```typescript
// src/__tests__/test-container.ts
export function createTestContainer(): Container {
  const container = new Container()
  
  // Register test doubles
  container.register(ChromeServiceToken, () => new MockChromeService())
  container.register(LoggerToken, () => new MockLogger())
  container.register(ValidatorToken, () => new MockValidator())
  
  return container
}

// src/__tests__/mocks/chrome-service.mock.ts
export class MockChromeService implements IChromeService {
  private mockClient = createMockChromeClient()
  
  async connect(): Promise<IChromeClient> {
    return this.mockClient
  }
  
  // Helper methods for test setup
  simulateConnection(): void {
    this.mockClient.isConnected = true
  }
  
  simulateEvaluateResult(result: any): void {
    this.mockClient.evaluate.mockResolvedValueOnce(result)
  }
}
```

#### 4.2 Refactor Test Patterns

```typescript
// src/__tests__/providers/cdp-tools.test.ts
describe('CDPToolProvider', () => {
  let container: Container
  let provider: CDPToolProvider
  let chromeService: MockChromeService
  
  beforeEach(() => {
    container = createTestContainer()
    chromeService = container.resolve(ChromeServiceToken) as MockChromeService
    
    const factory = new CDPToolProviderFactory()
    provider = factory.create({
      chromeService,
      logger: container.resolve(LoggerToken),
      validator: container.resolve(ValidatorToken)
    })
  })
  
  describe('cdp_evaluate', () => {
    it('should evaluate JavaScript expression', async () => {
      // Given
      chromeService.simulateConnection()
      chromeService.simulateEvaluateResult({ value: 'test result' })
      
      // When
      const handler = provider.getHandler('cdp_evaluate')!
      const result = await handler.execute({
        expression: 'document.title'
      })
      
      // Then
      expect(result).toEqual({
        success: true,
        data: 'test result'
      })
    })
  })
})
```

### Phase 5: Error Handling Standardization (1 day)

#### 5.1 Create Domain-Specific Errors

```typescript
// src/core/errors/base.error.ts
export abstract class BaseError extends Error {
  abstract readonly code: string
  abstract readonly statusCode: number
  
  constructor(
    message: string,
    public readonly context?: Record<string, any>
  ) {
    super(message)
    this.name = this.constructor.name
  }
  
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context
    }
  }
}

// src/core/errors/chrome.errors.ts
export class ChromeConnectionError extends BaseError {
  readonly code = 'CHROME_CONNECTION_ERROR'
  readonly statusCode = 503
}

export class ChromeSessionError extends BaseError {
  readonly code = 'CHROME_SESSION_ERROR'
  readonly statusCode = 500
}

// src/core/errors/validation.errors.ts
export class ValidationError extends BaseError {
  readonly code = 'VALIDATION_ERROR'
  readonly statusCode = 400
  
  constructor(field: string, details: any) {
    super(`Validation failed for ${field}`, { field, details })
  }
}
```

#### 5.2 Implement Error Boundary Pattern

```typescript
// src/core/error-handler.ts
export class ErrorHandler {
  constructor(private readonly logger: ILogger) {}
  
  async handle<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<Result<T, BaseError>> {
    try {
      const result = await operation()
      return Result.ok(result)
    } catch (error) {
      this.logger.error({ error, context }, 'Operation failed')
      
      if (error instanceof BaseError) {
        return Result.err(error)
      }
      
      return Result.err(
        new InternalError('Unexpected error occurred', {
          originalError: error instanceof Error ? error.message : String(error),
          context
        })
      )
    }
  }
}
```

### Phase 6: Code Organization and Architecture (1-2 days)

#### 6.1 Implement Clean Architecture Layers

```
src/
├── core/                      # Enterprise Business Rules
│   ├── entities/              # Domain models
│   ├── errors/                # Domain errors
│   ├── interfaces/            # Port interfaces
│   └── types/                 # Shared types
├── application/               # Application Business Rules
│   ├── use-cases/             # Use case implementations
│   ├── dtos/                  # Data transfer objects
│   └── mappers/               # Entity-DTO mappers
├── infrastructure/            # Frameworks & Drivers
│   ├── chrome/                # Chrome CDP implementation
│   ├── mcp/                   # MCP protocol implementation
│   ├── persistence/           # Storage implementations
│   └── logging/               # Logger implementation
├── presentation/              # Interface Adapters
│   ├── cli/                   # CLI interface
│   ├── server/                # MCP server
│   └── api/                   # REST/GraphQL API
└── main.ts                    # Composition root
```

#### 6.2 Create Use Case Pattern

```typescript
// src/application/use-cases/evaluate-javascript.use-case.ts
export interface EvaluateJavaScriptUseCase {
  execute(input: EvaluateJavaScriptInput): Promise<Result<EvaluateJavaScriptOutput, BaseError>>
}

export class EvaluateJavaScriptUseCaseImpl implements EvaluateJavaScriptUseCase {
  constructor(
    private readonly chromeService: IChromeService,
    private readonly logger: ILogger,
    private readonly errorHandler: ErrorHandler
  ) {}
  
  async execute(input: EvaluateJavaScriptInput): Promise<Result<EvaluateJavaScriptOutput, BaseError>> {
    return this.errorHandler.handle(async () => {
      // Business logic here
      const client = await this.chromeService.getClient(input.sessionId)
      const result = await client.evaluate(input.expression, input.options)
      
      return {
        value: result.value,
        type: result.type,
        executionTime: Date.now() - startTime
      }
    }, 'EvaluateJavaScript')
  }
}
```

### Phase 7: Performance and Optimization (1 day)

#### 7.1 Implement Caching Layer

```typescript
// src/infrastructure/cache/cache.service.ts
export interface CacheService {
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T, ttl?: number): Promise<void>
  delete(key: string): Promise<void>
  clear(): Promise<void>
}

// src/infrastructure/cache/memory-cache.service.ts
export class MemoryCacheService implements CacheService {
  private cache = new Map<string, CacheEntry>()
  
  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key)
    
    if (!entry) return null
    
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.cache.delete(key)
      return null
    }
    
    return entry.value as T
  }
  
  // ... rest of implementation
}
```

#### 7.2 Add Performance Monitoring

```typescript
// src/infrastructure/monitoring/performance.monitor.ts
export class PerformanceMonitor {
  private metrics = new Map<string, PerformanceMetric>()
  
  startOperation(name: string): OperationTimer {
    const startTime = performance.now()
    
    return {
      end: (metadata?: Record<string, any>) => {
        const duration = performance.now() - startTime
        this.recordMetric(name, duration, metadata)
      }
    }
  }
  
  @Scheduled('0 */5 * * * *') // Every 5 minutes
  reportMetrics(): void {
    const report = this.generateReport()
    this.logger.info({ report }, 'Performance metrics')
    this.metrics.clear()
  }
}
```

## 📋 Implementation Plan

### Week 1: Foundation (Days 1-5)
- **Day 1-2**: Implement DI container and core interfaces
- **Day 3-4**: Refactor ChromeManager and create service layer
- **Day 5**: Fix all TypeScript errors and type safety issues

### Week 2: Core Refactoring (Days 6-10)
- **Day 6-7**: Extract common patterns and eliminate duplication
- **Day 8-9**: Implement test infrastructure with DI
- **Day 10**: Standardize error handling across codebase

### Week 3: Polish and Optimization (Days 11-15)
- **Day 11-12**: Reorganize code into clean architecture
- **Day 13**: Add caching and performance monitoring
- **Day 14**: Update all tests to use new infrastructure
- **Day 15**: Final review and documentation

## 🎯 Success Metrics

### Must Have (Week 1-2)
- ✅ Zero TypeScript errors
- ✅ 100% test passing
- ✅ Full dependency injection
- ✅ No singleton anti-patterns
- ✅ Type-safe validation everywhere

### Should Have (Week 2-3)
- ✅ <5% code duplication
- ✅ Clean architecture layers
- ✅ Comprehensive error handling
- ✅ Performance monitoring
- ✅ 90%+ test coverage

### Nice to Have (Future)
- ✅ E2E test automation
- ✅ API documentation generation
- ✅ Performance benchmarks
- ✅ Integration test suite
- ✅ Automated quality gates

## 🚀 Migration Strategy

### Step 1: Create New Structure Alongside Old
- Keep existing code working
- Build new structure in parallel
- Gradually migrate providers

### Step 2: Provider-by-Provider Migration
1. Start with simplest provider (CDP tools)
2. Migrate one provider at a time
3. Ensure tests pass after each migration
4. Update integration points

### Step 3: Remove Legacy Code
- Delete old singleton implementations
- Remove duplicate code
- Clean up unused files
- Update documentation

## 🔍 Quality Assurance Checklist

### Code Quality
- [ ] All TypeScript errors resolved
- [ ] No ESLint warnings
- [ ] No unsafe type casts
- [ ] All promises properly handled
- [ ] Consistent naming conventions

### Architecture
- [ ] Clean dependency graph
- [ ] No circular dependencies
- [ ] Clear separation of concerns
- [ ] SOLID principles followed
- [ ] DRY principle enforced

### Testing
- [ ] 100% of tests passing
- [ ] >90% code coverage
- [ ] All edge cases tested
- [ ] Integration tests added
- [ ] E2E tests automated

### Documentation
- [ ] All public APIs documented
- [ ] Architecture diagrams updated
- [ ] Migration guide created
- [ ] Examples provided
- [ ] README comprehensive

## 📝 Notes and Considerations

### Risk Mitigation
- **Risk**: Breaking existing functionality
  - **Mitigation**: Keep old code, migrate gradually
  
- **Risk**: Test suite failures during migration
  - **Mitigation**: Update tests alongside code changes

- **Risk**: Performance regression
  - **Mitigation**: Add benchmarks before changes

### Technical Debt to Address
1. Remove all singleton patterns
2. Eliminate manual type casting
3. Fix all silent error handling
4. Remove code duplication
5. Add proper abstractions

### Future Enhancements
1. Add OpenTelemetry support
2. Implement rate limiting
3. Add request/response validation
4. Create plugin system
5. Add GraphQL API option

## 🎉 Expected Outcomes

Upon completion of this refactoring plan:

1. **Maintainability**: Clean, modular code that's easy to understand and modify
2. **Testability**: Full test coverage with easy mocking and isolation
3. **Type Safety**: Zero runtime type errors, full TypeScript benefits
4. **Performance**: Optimized operations with caching and monitoring
5. **Developer Experience**: Clear patterns, good documentation, fast feedback

This refactoring will transform Curupira from a prototype into a production-ready, enterprise-grade debugging platform.