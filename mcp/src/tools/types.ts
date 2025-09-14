/**
 * @fileoverview MCP tool types
 * 
 * This file defines types for MCP tools, which perform
 * actions and modifications in the browser.
 */

import type { JsonValue } from '@curupira/shared'

/**
 * Tool metadata
 */
export interface ToolMetadata {
  /** Tool name */
  name: string
  /** Tool description */
  description: string
  /** Tool category */
  category: 'navigation' | 'evaluation' | 'interaction' | 'debugging' | 'other'
  /** Input schema */
  inputSchema?: {
    type: 'object'
    properties: Record<string, any>
    required?: string[]
  }
  /** Output schema */
  outputSchema?: {
    type: string
    properties?: Record<string, any>
  }
  /** Examples */
  examples?: Array<{
    input: JsonValue
    output: JsonValue
    description?: string
  }>
}

/**
 * Tool execution context
 */
export interface ToolContext {
  /** Session ID */
  sessionId?: string
  /** Tab ID */
  tabId?: string
  /** User ID */
  userId?: string
  /** Timeout */
  timeout?: number
  /** Additional context */
  metadata?: Record<string, JsonValue>
}

/**
 * Tool execution result
 */
export interface ToolResult<T = JsonValue> {
  /** Success flag */
  success: boolean
  /** Result data */
  data?: T
  /** Error message */
  error?: string
  /** Execution time */
  duration?: number
  /** Additional metadata */
  metadata?: Record<string, JsonValue>
}

/**
 * Tool handler
 */
export interface ToolHandler<TInput = JsonValue, TOutput = JsonValue> {
  /** Tool metadata */
  metadata: ToolMetadata
  /** Execute tool */
  execute(input: TInput, context: ToolContext): Promise<ToolResult<TOutput>>
  /** Validate input */
  validate?(input: unknown): input is TInput
}

/**
 * Tool registry
 */
export interface ToolRegistry {
  /** Register tool */
  register(tool: ToolHandler): void
  /** Unregister tool */
  unregister(name: string): void
  /** Get tool by name */
  getTool(name: string): ToolHandler | undefined
  /** List all tools */
  listTools(): ToolMetadata[]
  /** Execute tool */
  execute(name: string, input: JsonValue, context: ToolContext): Promise<ToolResult>
}

/**
 * Navigation tool input
 */
export interface NavigationInput {
  /** URL to navigate to */
  url: string
  /** Wait for navigation */
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2'
  /** Referrer */
  referrer?: string
}

/**
 * Evaluation tool input
 */
export interface EvaluationInput {
  /** Expression to evaluate */
  expression: string
  /** Await promise */
  awaitPromise?: boolean
  /** Return by value */
  returnByValue?: boolean
  /** Include command line API */
  includeCommandLineAPI?: boolean
}

/**
 * Click tool input
 */
export interface ClickInput {
  /** Selector */
  selector: string
  /** Button */
  button?: 'left' | 'right' | 'middle'
  /** Click count */
  clickCount?: number
  /** Modifiers */
  modifiers?: Array<'Alt' | 'Control' | 'Meta' | 'Shift'>
}

/**
 * Type tool input
 */
export interface TypeInput {
  /** Selector */
  selector: string
  /** Text to type */
  text: string
  /** Delay between keystrokes */
  delay?: number
  /** Clear before typing */
  clear?: boolean
}

/**
 * Screenshot tool input
 */
export interface ScreenshotInput {
  /** Format */
  format?: 'jpeg' | 'png' | 'webp'
  /** Quality (for jpeg) */
  quality?: number
  /** Full page */
  fullPage?: boolean
  /** Clip region */
  clip?: {
    x: number
    y: number
    width: number
    height: number
  }
  /** Omit background */
  omitBackground?: boolean
}

/**
 * Breakpoint tool input
 */
export interface BreakpointInput {
  /** URL pattern */
  urlPattern?: string
  /** Line number */
  lineNumber: number
  /** Column number */
  columnNumber?: number
  /** Condition */
  condition?: string
}