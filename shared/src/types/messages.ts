/**
 * @fileoverview IPC message types for communication between Curupira components
 * 
 * This file defines all message types used for Inter-Process Communication
 * between the Chrome extension, content scripts, and MCP server.
 */

import type {
  SessionId,
  TabId,
  RequestId,
  Timestamp,
  JsonRpcId,
  ComponentId,
  ActorId,
  StoreId
} from './branded.js'

// Import helper functions from branded.ts
import { 
  generateId,
  createTimestamp as createTimestampHelper
} from './branded.js'

import type {
  ConsoleMessage,
  NetworkRequest,
  StateSnapshot,
  StateEvent,
  ComponentInfo,
  ActorInfo,
  StoreInfo,
  PerformanceMetrics
} from './core.js'

/**
 * Base message interface - all messages extend this
 */
export interface BaseMessage {
  id: RequestId
  timestamp: Timestamp
  sessionId?: SessionId
  tabId?: TabId
}

/**
 * Message types for different communication channels
 */
export type MessageType = 
  | ContentScriptMessage
  | BackgroundMessage
  | MCPMessage
  | DevToolsMessage
  | InjectedScriptMessage

/**
 * Messages from content scripts to background script
 */
export type ContentScriptMessage = BaseMessage & {
  source: 'content'
  type: 'page_loaded' | 'state_changed' | 'error_occurred' | 'performance_metric'
  payload: ContentScriptPayload
}

export type ContentScriptPayload =
  | { type: 'page_loaded'; url: string; title: string }
  | { type: 'state_changed'; snapshot: StateSnapshot }
  | { type: 'error_occurred'; error: Error }
  | { type: 'performance_metric'; metrics: PerformanceMetrics }

/**
 * Messages from background script to MCP server and vice versa
 */
export type BackgroundMessage = BaseMessage & {
  source: 'background'
  type: 'mcp_request' | 'mcp_response' | 'session_start' | 'session_end'
  payload: BackgroundPayload
}

export type BackgroundPayload =
  | { type: 'mcp_request'; request: MCPRequestMessage }
  | { type: 'mcp_response'; response: MCPResponseMessage }
  | { type: 'session_start'; sessionId: SessionId; tabId: TabId }
  | { type: 'session_end'; sessionId: SessionId }

/**
 * MCP Protocol messages
 */
export type MCPMessage = 
  | MCPRequestMessage
  | MCPResponseMessage
  | MCPNotificationMessage

export interface MCPRequestMessage extends BaseMessage {
  source: 'mcp'
  type: 'request'
  jsonrpc: '2.0'
  jsonRpcId: JsonRpcId  // Changed to avoid conflict with BaseMessage.id
  method: string
  params?: Record<string, unknown>
}

export interface MCPResponseMessage extends BaseMessage {
  source: 'mcp'
  type: 'response'
  jsonrpc: '2.0'
  jsonRpcId: JsonRpcId | null  // Changed to avoid conflict with BaseMessage.id
  result?: unknown
  error?: {
    code: number
    message: string
    data?: unknown
  }
}

export interface MCPNotificationMessage extends BaseMessage {
  source: 'mcp'
  type: 'notification'
  jsonrpc: '2.0'
  method: string
  params?: Record<string, unknown>
}

/**
 * DevTools panel messages
 */
export type DevToolsMessage = BaseMessage & {
  source: 'devtools'
  type: 'inspect_element' | 'get_console_logs' | 'get_network_requests' | 'get_state_snapshot'
  payload: DevToolsPayload
}

export type DevToolsPayload =
  | { type: 'inspect_element'; selector: string }
  | { type: 'get_console_logs'; filter?: ConsoleLogFilter }
  | { type: 'get_network_requests'; filter?: NetworkRequestFilter }
  | { type: 'get_state_snapshot'; source: 'react' | 'xstate' | 'zustand' | 'apollo' }

export interface ConsoleLogFilter {
  level?: 'log' | 'info' | 'warn' | 'error' | 'debug' | 'trace'
  since?: Timestamp
  limit?: number
  search?: string
}

export interface NetworkRequestFilter {
  method?: string
  status?: number
  url?: string
  since?: Timestamp
  limit?: number
}

/**
 * Messages from injected scripts (page context)
 */
export type InjectedScriptMessage = BaseMessage & {
  source: 'injected'
  type: 'react_update' | 'xstate_event' | 'zustand_change' | 'apollo_update' | 'console_log' | 'network_request'
  payload: InjectedScriptPayload
}

export type InjectedScriptPayload =
  | { type: 'react_update'; components: ComponentInfo[] }
  | { type: 'xstate_event'; event: StateEvent; actors: ActorInfo[] }
  | { type: 'zustand_change'; storeId: StoreId; state: unknown; action?: string }
  | { type: 'apollo_update'; cache: unknown; queries: unknown[]; mutations: unknown[] }
  | { type: 'console_log'; message: ConsoleMessage }
  | { type: 'network_request'; request: NetworkRequest }

/**
 * WebSocket message wrappers
 */
export interface WebSocketMessage {
  type: 'message' | 'ping' | 'pong' | 'close' | 'error'
  data?: MessageType
  error?: Error
  timestamp: Timestamp
}

/**
 * Error types for message validation
 */
export class MessageValidationError extends Error {
  constructor(
    message: string,
    public readonly messageType: string,
    public readonly validationErrors: string[]
  ) {
    super(`${message}: ${validationErrors.join(', ')}`)
    this.name = 'MessageValidationError'
  }
}

/**
 * Message validation utilities
 */
export const isValidMessage = (message: unknown): message is MessageType => {
  if (!message || typeof message !== 'object') return false
  
  const msg = message as Record<string, unknown>
  return (
    typeof msg.id === 'string' &&
    typeof msg.timestamp === 'number' &&
    typeof msg.source === 'string' &&
    typeof msg.type === 'string' &&
    msg.payload !== undefined
  )
}

export const isContentScriptMessage = (message: MessageType): message is ContentScriptMessage =>
  message.source === 'content'

export const isBackgroundMessage = (message: MessageType): message is BackgroundMessage =>
  message.source === 'background'

export const isMCPMessage = (message: MessageType): message is MCPMessage =>
  message.source === 'mcp'

export const isDevToolsMessage = (message: MessageType): message is DevToolsMessage =>
  message.source === 'devtools'

export const isInjectedScriptMessage = (message: MessageType): message is InjectedScriptMessage =>
  message.source === 'injected'

/**
 * Message factory functions for type-safe message creation
 */
export const createContentScriptMessage = (
  type: ContentScriptMessage['type'],
  payload: ContentScriptPayload,
  options: Partial<Pick<ContentScriptMessage, 'sessionId' | 'tabId'>> = {}
): ContentScriptMessage => ({
  id: generateMessageId(),
  timestamp: createTimestamp(),
  source: 'content',
  type,
  payload,
  ...options
})

export const createBackgroundMessage = (
  type: BackgroundMessage['type'],
  payload: BackgroundPayload,
  options: Partial<Pick<BackgroundMessage, 'sessionId' | 'tabId'>> = {}
): BackgroundMessage => ({
  id: generateMessageId(),
  timestamp: createTimestamp(),
  source: 'background',
  type,
  payload,
  ...options
})

export const createMCPRequestMessage = (
  method: string,
  params?: Record<string, unknown>,
  options: Partial<Pick<MCPRequestMessage, 'sessionId' | 'tabId'>> = {}
): MCPRequestMessage => ({
  id: generateMessageId(),
  timestamp: createTimestamp(),
  source: 'mcp',
  type: 'request',
  jsonrpc: '2.0',
  jsonRpcId: generateJsonRpcId(),
  method,
  params,
  ...options
})

export const createMCPResponseMessage = (
  jsonRpcId: JsonRpcId,
  result?: unknown,
  error?: MCPResponseMessage['error'],
  options: Partial<Pick<MCPResponseMessage, 'sessionId' | 'tabId'>> = {}
): MCPResponseMessage => ({
  id: generateMessageId(),
  timestamp: createTimestamp(),
  source: 'mcp',
  type: 'response',
  jsonrpc: '2.0',
  jsonRpcId,
  result,
  error,
  ...options
})

// Helper functions
const generateMessageId = (): RequestId => generateId()

const generateJsonRpcId = (): JsonRpcId => {
  const id = Math.random().toString(36).substring(2, 15)
  return id as JsonRpcId
}

const createTimestamp = (): Timestamp => createTimestampHelper()