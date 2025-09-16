/**
 * Enhanced Tool Handler Types - Phase 1: Type System Foundation
 * Level 2: MCP Core types with proper binding interfaces and validation
 */

import type { SessionId } from '@curupira/shared/types'
import type { ToolHandler, ToolResult } from './registry.js'
import type { BaseToolProvider } from './providers/base.js'

/**
 * Enhanced tool handler with properly bound methods from BaseToolProvider
 */
export interface BoundToolHandler extends ToolHandler {
  // Methods bound from BaseToolProvider context
  getSessionId(argSessionId?: string): Promise<SessionId>
  executeScript<T = unknown>(script: string, sessionId: SessionId, options?: ScriptOptions): Promise<ToolResult<T>>
  checkLibraryAvailable(check: string, sessionId: SessionId, name: string): Promise<{ available: boolean; error?: string }>
}

/**
 * Tool provider context for creating bound handlers
 */
export interface ToolProviderContext {
  provider: BaseToolProvider
  bind<T extends ToolHandler>(handler: T): BoundToolHandler
}

/**
 * Script execution options
 */
export interface ScriptOptions {
  timeout?: number
  awaitPromise?: boolean
  returnByValue?: boolean
}

/**
 * JSON Schema interface for runtime validation
 */
export interface JSONSchema {
  type: string
  properties?: Record<string, JSONSchemaProperty>
  required?: string[]
  additionalProperties?: boolean
}

export interface JSONSchemaProperty {
  type: string
  description?: string
  enum?: string[]
  items?: JSONSchemaProperty
  format?: string
  minimum?: number
  maximum?: number
}

/**
 * Tool validation error for invalid arguments
 */
export class ToolValidationError extends Error {
  constructor(message: string, public readonly details?: unknown) {
    super(message)
    this.name = 'ToolValidationError'
  }
}

// Base types for tool arguments
export interface BaseToolArgs {
  sessionId?: string
}

// CDP Tool Types
export interface EvaluateArgs extends BaseToolArgs {
  expression: string
}

export interface NavigateArgs extends BaseToolArgs {
  url: string
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2'
}

export interface ScreenshotArgs extends BaseToolArgs {
  fullPage?: boolean
  selector?: string
}

export interface CookieArgs extends BaseToolArgs {
  urls?: string[]
}

export interface SetCookieArgs extends BaseToolArgs {
  name: string
  value: string
  domain?: string
  path?: string
  secure?: boolean
  httpOnly?: boolean
  sameSite?: 'Strict' | 'Lax' | 'None'
}

// DOM Tool Types
export interface DOMSelectorArgs extends BaseToolArgs {
  selector: string
}

export interface DOMNodeArgs extends BaseToolArgs {
  nodeId: number
}

export interface DOMAttributeArgs extends DOMNodeArgs {
  name: string
  value?: string
}

export interface DOMHtmlArgs extends DOMNodeArgs {
  outerHTML?: string
}

// React Tool Types
export interface ReactComponentArgs extends BaseToolArgs {
  componentName?: string
  componentId?: string
}

export interface ReactProfileArgs extends BaseToolArgs {
  duration?: number
  componentName?: string
}

export interface ReactFiberArgs extends BaseToolArgs {
  rootSelector?: string
}

// State Management Types
export interface ZustandStoreArgs extends BaseToolArgs {
  storeName?: string
}

export interface ZustandActionArgs extends BaseToolArgs {
  storeName: string
  action: string
  payload?: unknown
}

export interface XStateActorArgs extends BaseToolArgs {
  actorId: string
}

export interface XStateEventArgs extends BaseToolArgs {
  actorId: string
  event: Record<string, unknown>
}

export interface ApolloQueryArgs extends BaseToolArgs {
  query: string
  variables?: Record<string, unknown>
}

export interface ReduxPathArgs extends BaseToolArgs {
  path?: string
}

export interface ReduxActionArgs extends BaseToolArgs {
  type: string
  payload?: unknown
}

// Performance Tool Types
export interface PerformanceMeasureArgs extends BaseToolArgs {
  componentName?: string
  duration?: number
}

export interface PerformanceTraceArgs extends BaseToolArgs {
  categories?: string[]
}

// Network Tool Types
export interface NetworkMockArgs extends BaseToolArgs {
  urlPattern: string
  method?: string
  response: {
    status: number
    body: unknown
    headers?: Record<string, string>
  }
}

export interface NetworkBlockArgs extends BaseToolArgs {
  urlPatterns: string[]
}

export interface NetworkThrottleArgs extends BaseToolArgs {
  profile: 'offline' | 'slow-3g' | 'fast-3g' | '4g' | 'wifi' | 'online'
  custom?: {
    downloadThroughput: number
    uploadThroughput: number
    latency: number
  }
}

export interface NetworkRequestsArgs extends BaseToolArgs {
  filter?: string
  limit?: number
}

export interface NetworkHeadersArgs extends BaseToolArgs {
  urlPattern: string
  requestHeaders?: Record<string, string>
  responseHeaders?: Record<string, string>
}

export interface NetworkReplayArgs extends BaseToolArgs {
  requestId: string
  modifyBody?: unknown
  modifyHeaders?: Record<string, string>
}

// Debugger Tool Types
export interface DebuggerBreakpointArgs extends BaseToolArgs {
  url: string
  lineNumber: number
  columnNumber?: number
  condition?: string
}

export interface DebuggerRemoveBreakpointArgs extends BaseToolArgs {
  breakpointId: string
}

export interface DebuggerStepArgs extends BaseToolArgs {
  type?: 'into' | 'over' | 'out'
}

export interface DebuggerEvaluateArgs extends BaseToolArgs {
  callFrameId: string
  expression: string
}

export interface DebuggerScopeArgs extends BaseToolArgs {
  callFrameId: string
}

// Console Tool Types
export interface ConsoleExecuteArgs extends BaseToolArgs {
  expression: string
}

export interface ConsoleMessagesArgs extends BaseToolArgs {
  level?: 'verbose' | 'info' | 'warning' | 'error' | 'all'
  limit?: number
}

// Type guards
export function isEvaluateArgs(args: unknown): args is EvaluateArgs {
  return typeof args === 'object' && args !== null && 'expression' in args
}

export function isNavigateArgs(args: unknown): args is NavigateArgs {
  return typeof args === 'object' && args !== null && 'url' in args
}

export function isDOMSelectorArgs(args: unknown): args is DOMSelectorArgs {
  return typeof args === 'object' && args !== null && 'selector' in args
}

export function isDOMNodeArgs(args: unknown): args is DOMNodeArgs {
  return typeof args === 'object' && args !== null && 'nodeId' in args &&
    typeof (args as any).nodeId === 'number'
}

// React result types
export interface ReactComponentSearchResult {
  found: boolean;
  error?: string;
  components?: Array<{
    id: string;
    name: string;
    props?: Record<string, unknown>;
    state?: unknown;
    type?: string;
  }>;
}

export interface ReactComponentInspectResult {
  componentId: string;
  name?: string;
  props?: Record<string, unknown>;
  state?: unknown;
  hooks?: Array<{
    name: string;
    value: unknown;
  }>;
  error?: string;
}

export interface ReactProfileResult {
  profile?: {
    duration: number;
    interactions: Array<{
      name: string;
      timestamp: number;
    }>;
    commits: Array<{
      duration: number;
      timestamp: number;
      phases: string[];
    }>;
  };
  error?: string;
}

// Type-Safe Argument Validation (Step 1.2)

/**
 * Validates arguments against a JSON schema with type predicates
 */
export function validateArgs<T>(args: Record<string, unknown>, schema: JSONSchema): args is T {
  if (typeof args !== 'object' || args === null) {
    return false
  }

  // Check required properties
  if (schema.required) {
    for (const prop of schema.required) {
      if (!(prop in args)) {
        return false
      }
    }
  }

  // Basic type validation for properties
  if (schema.properties) {
    for (const [prop, propSchema] of Object.entries(schema.properties)) {
      if (prop in args) {
        const value = args[prop]
        if (!validateProperty(value, propSchema)) {
          return false
        }
      }
    }
  }

  return true
}

/**
 * Asserts arguments are valid, throws ToolValidationError if not
 */
export function assertArgs<T>(args: Record<string, unknown>, schema: JSONSchema): T {
  if (!validateArgs<T>(args, schema)) {
    throw new ToolValidationError(`Invalid arguments: ${JSON.stringify(args)}`, { args, schema })
  }
  return args
}

/**
 * Validates a single property against its schema
 */
function validateProperty(value: unknown, schema: JSONSchemaProperty): boolean {
  switch (schema.type) {
    case 'string':
      return typeof value === 'string'
    case 'number':
      return typeof value === 'number'
    case 'boolean':
      return typeof value === 'boolean'
    case 'object':
      return typeof value === 'object' && value !== null
    case 'array':
      return Array.isArray(value)
    default:
      return true // Allow unknown types for now
  }
}

/**
 * Type predicate functions for common argument types
 */
export type ValidationFunction<T> = (args: Record<string, unknown>) => args is T

/**
 * Creates a validation function for a specific argument type
 */
export function createValidator<T>(schema: JSONSchema): ValidationFunction<T> {
  return (args: Record<string, unknown>): args is T => validateArgs<T>(args, schema)
}
