/**
 * @fileoverview MCP handler types
 */

import type { McpProtocol } from '@curupira/shared'

/**
 * MCP handler context
 */
export interface HandlerContext {
  /** Protocol instance */
  protocol: McpProtocol
  /** Session ID */
  sessionId?: string
  /** User ID */
  userId?: string
  /** Request metadata */
  metadata?: Record<string, unknown>
}

/**
 * MCP request handler
 */
export type McpRequestHandler<TParams = unknown, TResult = unknown> = (
  params: TParams,
  context: HandlerContext
) => Promise<TResult>

/**
 * Handler registry
 */
export interface HandlerRegistry {
  /** Register handler */
  register(method: string, handler: McpRequestHandler): void
  /** Unregister handler */
  unregister(method: string): void
  /** Get handler */
  getHandler(method: string): McpRequestHandler | undefined
  /** Setup all handlers */
  setupHandlers(protocol: McpProtocol): void
}