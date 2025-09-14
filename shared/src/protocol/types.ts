/**
 * @fileoverview Protocol layer type definitions
 * 
 * This file defines types for JSON-RPC 2.0 and MCP protocol implementations,
 * providing a standardized messaging protocol on top of the transport layer.
 */

import type {
  JsonRpcId,
  JsonRpcMethod,
  RequestId,
  SessionId,
  Timestamp,
  JsonValue
} from '../types/index.js'
import type { CurupiraError } from '../errors/index.js'

/**
 * JSON-RPC 2.0 version constant
 */
export const JSON_RPC_VERSION = '2.0' as const

/**
 * JSON-RPC 2.0 error codes
 */
export enum JsonRpcErrorCode {
  // Standard JSON-RPC 2.0 errors
  PARSE_ERROR = -32700,
  INVALID_REQUEST = -32600,
  METHOD_NOT_FOUND = -32601,
  INVALID_PARAMS = -32602,
  INTERNAL_ERROR = -32603,
  
  // Implementation-defined errors (-32000 to -32099)
  SERVER_ERROR = -32000,
  TIMEOUT = -32001,
  CANCELLED = -32002,
  NOT_IMPLEMENTED = -32003,
  UNAUTHORIZED = -32004,
  RATE_LIMITED = -32005,
  RESOURCE_NOT_FOUND = -32006,
  INVALID_STATE = -32007,
  CONNECTION_ERROR = -32008
}

/**
 * JSON-RPC 2.0 request structure
 */
export interface JsonRpcRequest<TParams = unknown> {
  jsonrpc: typeof JSON_RPC_VERSION
  id: JsonRpcId
  method: JsonRpcMethod
  params?: TParams
}

/**
 * JSON-RPC 2.0 notification structure (no id)
 */
export interface JsonRpcNotification<TParams = unknown> {
  jsonrpc: typeof JSON_RPC_VERSION
  method: JsonRpcMethod
  params?: TParams
}

/**
 * JSON-RPC 2.0 success response
 */
export interface JsonRpcSuccessResponse<TResult = unknown> {
  jsonrpc: typeof JSON_RPC_VERSION
  id: JsonRpcId
  result: TResult
}

/**
 * JSON-RPC 2.0 error object
 */
export interface JsonRpcError {
  code: JsonRpcErrorCode | number
  message: string
  data?: unknown
}

/**
 * JSON-RPC 2.0 error response
 */
export interface JsonRpcErrorResponse {
  jsonrpc: typeof JSON_RPC_VERSION
  id: JsonRpcId | null
  error: JsonRpcError
}

/**
 * JSON-RPC 2.0 response (success or error)
 */
export type JsonRpcResponse<TResult = unknown> = 
  | JsonRpcSuccessResponse<TResult>
  | JsonRpcErrorResponse

/**
 * JSON-RPC 2.0 message (request, notification, or response)
 */
export type JsonRpcMessage<TParams = unknown, TResult = unknown> =
  | JsonRpcRequest<TParams>
  | JsonRpcNotification<TParams>
  | JsonRpcResponse<TResult>

/**
 * Batch request/response support
 */
export type JsonRpcBatch<T = JsonRpcMessage> = T[]

/**
 * Protocol message wrapper with metadata
 */
export interface ProtocolMessage<T = JsonRpcMessage> {
  /** Unique message ID */
  id: RequestId
  /** Session ID */
  sessionId: SessionId
  /** Message timestamp */
  timestamp: Timestamp
  /** Protocol version */
  version: string
  /** Message payload */
  payload: T
  /** Optional metadata */
  metadata?: {
    /** Message priority */
    priority?: 'low' | 'normal' | 'high'
    /** Message TTL in milliseconds */
    ttl?: number
    /** Retry count */
    retryCount?: number
    /** Correlation ID for tracing */
    correlationId?: RequestId
    /** Custom headers */
    headers?: Record<string, string>
  }
}

/**
 * Protocol capabilities
 */
export interface ProtocolCapabilities {
  /** Supports batch requests */
  batch: boolean
  /** Supports notifications */
  notifications: boolean
  /** Supports cancellation */
  cancellation: boolean
  /** Supports progress updates */
  progress: boolean
  /** Maximum batch size */
  maxBatchSize?: number
  /** Supported protocol versions */
  versions: string[]
}

/**
 * Request handler function
 */
export type RequestHandler<TParams = unknown, TResult = unknown> = (
  params: TParams,
  context: RequestContext
) => Promise<TResult> | TResult

/**
 * Notification handler function
 */
export type NotificationHandler<TParams = unknown> = (
  params: TParams,
  context: RequestContext
) => Promise<void> | void

/**
 * Request context provided to handlers
 */
export interface RequestContext {
  /** Request ID */
  requestId: JsonRpcId
  /** Session ID */
  sessionId: SessionId
  /** Request method */
  method: JsonRpcMethod
  /** Request metadata */
  metadata?: Record<string, unknown>
  /** Cancellation signal */
  signal?: AbortSignal
  /** Progress callback */
  progress?: (progress: ProgressUpdate) => void
}

/**
 * Progress update for long-running operations
 */
export interface ProgressUpdate {
  /** Progress percentage (0-100) */
  percentage?: number
  /** Progress message */
  message?: string
  /** Current step */
  current?: number
  /** Total steps */
  total?: number
  /** Additional data */
  data?: unknown
}

/**
 * Protocol events
 */
export type ProtocolEvent =
  | { type: 'request'; request: JsonRpcRequest; context: RequestContext }
  | { type: 'notification'; notification: JsonRpcNotification; context: RequestContext }
  | { type: 'response'; response: JsonRpcResponse; requestId: JsonRpcId }
  | { type: 'error'; error: JsonRpcError; requestId?: JsonRpcId }
  | { type: 'batch'; messages: JsonRpcMessage[] }
  | { type: 'progress'; progress: ProgressUpdate; requestId: JsonRpcId }
  | { type: 'cancelled'; requestId: JsonRpcId }

/**
 * Protocol statistics
 */
export interface ProtocolStats {
  /** Total requests sent */
  requestsSent: number
  /** Total requests received */
  requestsReceived: number
  /** Total responses sent */
  responsesSent: number
  /** Total responses received */
  responsesReceived: number
  /** Total notifications sent */
  notificationsSent: number
  /** Total notifications received */
  notificationsReceived: number
  /** Total errors */
  errors: number
  /** Average response time */
  averageResponseTime?: number
  /** Pending requests */
  pendingRequests: number
}

/**
 * Protocol middleware
 */
export interface ProtocolMiddleware {
  /** Middleware name */
  name: string
  
  /**
   * Process outgoing requests
   */
  request?: (
    request: JsonRpcRequest,
    next: () => Promise<JsonRpcResponse>
  ) => Promise<JsonRpcResponse>
  
  /**
   * Process incoming requests
   */
  handleRequest?: (
    request: JsonRpcRequest,
    context: RequestContext,
    next: () => Promise<unknown>
  ) => Promise<unknown>
  
  /**
   * Process notifications
   */
  notification?: (
    notification: JsonRpcNotification,
    next: () => Promise<void>
  ) => Promise<void>
  
  /**
   * Process errors
   */
  error?: (
    error: JsonRpcError,
    next: () => Promise<void>
  ) => Promise<void>
}

/**
 * Protocol configuration
 */
export interface ProtocolConfig {
  /** Protocol version */
  version?: string
  /** Request timeout in milliseconds */
  requestTimeout?: number
  /** Enable request batching */
  batching?: boolean
  /** Maximum batch size */
  maxBatchSize?: number
  /** Enable request cancellation */
  cancellation?: boolean
  /** Enable progress updates */
  progress?: boolean
  /** Enable strict mode (reject unknown methods) */
  strictMode?: boolean
  /** Custom error transformer */
  errorTransformer?: (error: unknown) => JsonRpcError
  /** Enable debug logging */
  debug?: boolean
}

/**
 * MCP-specific protocol extensions
 */
export namespace MCP {
  /**
   * MCP protocol version
   */
  export const VERSION = '2024-11-05' as const
  
  /**
   * MCP capability negotiation
   */
  export interface Capabilities {
    /** Experimental features */
    experimental?: Record<string, unknown>
    /** Supported resource types */
    resources?: boolean
    /** Supported tool types */
    tools?: boolean
    /** Supported prompt types */
    prompts?: boolean
    /** Logging support */
    logging?: boolean
  }
  
  /**
   * MCP initialization request
   */
  export interface InitializeRequest {
    protocolVersion: string
    capabilities: Capabilities
    clientInfo: {
      name: string
      version: string
    }
  }
  
  /**
   * MCP initialization response
   */
  export interface InitializeResponse {
    protocolVersion: string
    capabilities: Capabilities
    serverInfo: {
      name: string
      version: string
    }
  }
  
  /**
   * MCP method names
   */
  export type Method =
    | 'initialize'
    | 'initialized'
    | 'shutdown'
    | 'exit'
    | 'resources/list'
    | 'resources/read'
    | 'tools/list'
    | 'tools/call'
    | 'prompts/list'
    | 'prompts/get'
    | 'logging/setLevel'
    | `$/progress`
    | `$/cancelRequest`
  
  /**
   * MCP error codes
   */
  export enum ErrorCode {
    // Standard errors
    NOT_INITIALIZED = -32002,
    ALREADY_INITIALIZED = -32003,
    
    // Resource errors
    RESOURCE_NOT_FOUND = -32010,
    RESOURCE_ACCESS_DENIED = -32011,
    
    // Tool errors
    TOOL_NOT_FOUND = -32020,
    TOOL_EXECUTION_FAILED = -32021,
    
    // Prompt errors
    PROMPT_NOT_FOUND = -32030,
    INVALID_PROMPT_ARGUMENTS = -32031
  }
}