/**
 * Universal Handler Binder - Phase 2: Handler Binding Architecture
 * Level 2: MCP Core binding utilities
 * 
 * Fixes the core architectural issue where tool handlers extend BaseToolProvider
 * but return ToolHandler objects that lack required methods due to improper 
 * method binding.
 */

import type { ToolHandler } from '../registry.js'
import type { BaseToolProvider } from './base.js'
import type { BoundToolHandler } from '../types.js'

/**
 * Creates a bound handler that properly binds BaseToolProvider methods
 * to the tool handler execution context.
 * 
 * This solves the core issue where handlers use `this.getSessionId()` but
 * `this` refers to ToolHandler, not BaseToolProvider.
 * 
 * @param provider - The BaseToolProvider instance with the methods to bind
 * @param handler - The ToolHandler that needs method binding
 * @returns BoundToolHandler with properly bound methods
 */
export function createBoundHandler(provider: BaseToolProvider, handler: ToolHandler): BoundToolHandler {
  return {
    ...handler,
    execute: handler.execute.bind(provider),
    // Properly bind protected methods with correct signatures
    getSessionId: (provider as any).getSessionId.bind(provider),
    executeScript: (provider as any).executeScript.bind(provider),
    checkLibraryAvailable: (provider as any).checkLibraryAvailable.bind(provider)
  }
}

/**
 * Helper to check if a handler is already bound (has BaseToolProvider methods)
 */
export function isBoundHandler(handler: ToolHandler): handler is BoundToolHandler {
  return 'getSessionId' in handler && 
         'executeScript' in handler && 
         'checkLibraryAvailable' in handler
}

/**
 * Creates a binding utility for a specific provider
 * Useful for providers that need to bind multiple handlers
 */
export function createProviderBinder(provider: BaseToolProvider) {
  return (handler: ToolHandler): BoundToolHandler => createBoundHandler(provider, handler)
}