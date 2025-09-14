/**
 * @fileoverview Message routing types
 * 
 * This file defines types for message routing, handling,
 * and transformation between MCP and CDP protocols.
 */

import type { 
  TransportMessage,
  JsonRpcRequest,
  JsonRpcResponse,
  RequestId,
  SessionId,
  Timestamp
} from '@curupira/shared'
import type { CdpEvent, CdpCommand, CdpResult } from '../cdp/types.js'

/**
 * Message types
 */
export type MessageType = 
  | 'mcp-request'
  | 'mcp-response'
  | 'mcp-notification'
  | 'cdp-command'
  | 'cdp-result'
  | 'cdp-event'
  | 'internal'

/**
 * Message source
 */
export type MessageSource = 
  | 'client'
  | 'server'
  | 'browser'
  | 'extension'
  | 'internal'

/**
 * Message priority
 */
export type MessagePriority = 
  | 'immediate'
  | 'high'
  | 'normal'
  | 'low'

/**
 * Base message interface
 */
export interface Message {
  /** Message ID */
  id: string
  /** Message type */
  type: MessageType
  /** Message source */
  source: MessageSource
  /** Target destination */
  target?: MessageSource
  /** Session ID */
  sessionId?: SessionId
  /** Priority */
  priority: MessagePriority
  /** Timestamp */
  timestamp: Timestamp
  /** Payload */
  payload: unknown
  /** Metadata */
  metadata?: Record<string, unknown>
}

/**
 * MCP request message
 */
export interface McpRequestMessage extends Message {
  type: 'mcp-request'
  payload: JsonRpcRequest
}

/**
 * MCP response message
 */
export interface McpResponseMessage extends Message {
  type: 'mcp-response'
  payload: JsonRpcResponse
}

/**
 * CDP command message
 */
export interface CdpCommandMessage extends Message {
  type: 'cdp-command'
  payload: CdpCommand
}

/**
 * CDP result message
 */
export interface CdpResultMessage extends Message {
  type: 'cdp-result'
  payload: CdpResult
}

/**
 * CDP event message
 */
export interface CdpEventMessage extends Message {
  type: 'cdp-event'
  payload: CdpEvent
}

/**
 * Message handler
 */
export type MessageHandler<T extends Message = Message> = (
  message: T
) => void | Promise<void> | Message | Promise<Message>

/**
 * Message transformer
 */
export type MessageTransformer<TIn extends Message = Message, TOut extends Message = Message> = (
  message: TIn
) => TOut | Promise<TOut> | null | Promise<null>

/**
 * Message filter
 */
export type MessageFilter<T extends Message = Message> = (
  message: T
) => boolean

/**
 * Message route
 */
export interface MessageRoute {
  /** Route ID */
  id: string
  /** Route name */
  name: string
  /** Source filter */
  source?: MessageSource | MessageSource[]
  /** Type filter */
  type?: MessageType | MessageType[]
  /** Custom filter */
  filter?: MessageFilter
  /** Handler */
  handler: MessageHandler
  /** Priority */
  priority?: number
  /** Enabled state */
  enabled?: boolean
}

/**
 * Message routing configuration
 */
export interface MessageRoutingConfig {
  /** Routes */
  routes: MessageRoute[]
  /** Default handler */
  defaultHandler?: MessageHandler
  /** Error handler */
  errorHandler?: (error: Error, message: Message) => void
  /** Transform pipeline */
  transforms?: MessageTransformer[]
  /** Message queue config */
  queue?: {
    enabled: boolean
    maxSize: number
    processInterval: number
  }
}

/**
 * Message router events
 */
export interface MessageRouterEvents {
  /** Message received */
  'message:received': (message: Message) => void
  /** Message routed */
  'message:routed': (message: Message, route: MessageRoute) => void
  /** Message transformed */
  'message:transformed': (original: Message, transformed: Message) => void
  /** Message queued */
  'message:queued': (message: Message) => void
  /** Message dropped */
  'message:dropped': (message: Message, reason: string) => void
  /** Routing error */
  'error': (error: Error, message?: Message) => void
}

/**
 * Message queue item
 */
export interface MessageQueueItem {
  /** Message */
  message: Message
  /** Retry count */
  retries: number
  /** Added timestamp */
  added: Timestamp
  /** Last attempt */
  lastAttempt?: Timestamp
}

/**
 * Message statistics
 */
export interface MessageStatistics {
  /** Total received */
  received: number
  /** Total routed */
  routed: number
  /** Total transformed */
  transformed: number
  /** Total queued */
  queued: number
  /** Total dropped */
  dropped: number
  /** Total errors */
  errors: number
  /** By type */
  byType: Record<MessageType, number>
  /** By source */
  bySource: Record<MessageSource, number>
  /** Average processing time */
  avgProcessingTime: number
}

/**
 * Route matcher
 */
export interface RouteMatcher {
  /** Match route */
  match(message: Message, route: MessageRoute): boolean
  /** Find matching routes */
  findMatches(message: Message, routes: MessageRoute[]): MessageRoute[]
  /** Sort by priority */
  sortByPriority(routes: MessageRoute[]): MessageRoute[]
}