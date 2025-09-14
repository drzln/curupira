/**
 * @fileoverview Transport layer type definitions
 * 
 * This file defines the core types and interfaces for the transport layer,
 * supporting both WebSocket and HTTP communication patterns.
 */

import type {
  SessionId,
  RequestId,
  Timestamp,
  Duration,
  JsonValue
} from '../types/index.js'
import type {
  CurupiraError
} from '../errors/index.js'

/**
 * Transport types
 */
export type TransportType = 'websocket' | 'http' | 'ipc' | 'stdio'

/**
 * Connection states
 */
export type ConnectionState = 
  | 'disconnected'
  | 'connecting' 
  | 'connected'
  | 'reconnecting'
  | 'closing'
  | 'closed'
  | 'error'

/**
 * Transport events
 */
export type TransportEvent =
  | { type: 'connected'; timestamp: Timestamp }
  | { type: 'disconnected'; timestamp: Timestamp; reason?: string }
  | { type: 'error'; timestamp: Timestamp; error: CurupiraError }
  | { type: 'message'; timestamp: Timestamp; data: unknown }
  | { type: 'reconnecting'; timestamp: Timestamp; attempt: number }
  | { type: 'state_changed'; timestamp: Timestamp; from: ConnectionState; to: ConnectionState }

/**
 * Base transport configuration
 */
export interface TransportConfig {
  /** Transport type */
  type: TransportType
  /** Enable automatic reconnection */
  autoReconnect?: boolean
  /** Maximum reconnection attempts */
  maxReconnectAttempts?: number
  /** Initial reconnection delay in milliseconds */
  reconnectDelay?: number
  /** Reconnection backoff multiplier */
  reconnectBackoffMultiplier?: number
  /** Maximum reconnection delay in milliseconds */
  maxReconnectDelay?: number
  /** Connection timeout in milliseconds */
  connectionTimeout?: number
  /** Enable connection keep-alive */
  keepAlive?: boolean
  /** Keep-alive interval in milliseconds */
  keepAliveInterval?: number
  /** Enable message compression */
  compression?: boolean
  /** Maximum message size in bytes */
  maxMessageSize?: number
  /** Custom headers for HTTP transports */
  headers?: Record<string, string>
  /** Enable debug logging */
  debug?: boolean
}

/**
 * WebSocket-specific configuration
 */
export interface WebSocketTransportConfig extends TransportConfig {
  type: 'websocket'
  /** WebSocket URL */
  url: string
  /** WebSocket protocols */
  protocols?: string[]
  /** Binary type for WebSocket */
  binaryType?: 'blob' | 'arraybuffer'
  /** Enable WebSocket ping/pong */
  enablePing?: boolean
  /** Ping interval in milliseconds */
  pingInterval?: number
  /** Pong timeout in milliseconds */
  pongTimeout?: number
}

/**
 * HTTP-specific configuration
 */
export interface HttpTransportConfig extends TransportConfig {
  type: 'http'
  /** Base URL for HTTP requests */
  baseUrl: string
  /** HTTP method */
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  /** Request timeout in milliseconds */
  timeout?: number
  /** Enable credentials */
  credentials?: 'omit' | 'same-origin' | 'include'
  /** Request mode */
  mode?: 'cors' | 'no-cors' | 'same-origin'
  /** Cache mode */
  cache?: 'default' | 'no-store' | 'reload' | 'no-cache' | 'force-cache'
  /** Retry configuration */
  retry?: {
    enabled: boolean
    maxAttempts: number
    delay: number
    backoffMultiplier: number
  }
}

/**
 * IPC-specific configuration
 */
export interface IpcTransportConfig extends TransportConfig {
  type: 'ipc'
  /** IPC channel name */
  channel: string
  /** Process ID for IPC */
  processId?: number
}

/**
 * STDIO-specific configuration
 */
export interface StdioTransportConfig extends TransportConfig {
  type: 'stdio'
  /** Input stream */
  stdin?: NodeJS.ReadableStream
  /** Output stream */
  stdout?: NodeJS.WritableStream
  /** Error stream */
  stderr?: NodeJS.WritableStream
}

/**
 * Transport connection info
 */
export interface ConnectionInfo {
  /** Unique session ID */
  sessionId: SessionId
  /** Transport type */
  transport: TransportType
  /** Connection state */
  state: ConnectionState
  /** Connection timestamp */
  connectedAt?: Timestamp
  /** Disconnection timestamp */
  disconnectedAt?: Timestamp
  /** Remote address (if applicable) */
  remoteAddress?: string
  /** Local address (if applicable) */
  localAddress?: string
  /** Protocol version */
  protocolVersion?: string
  /** Connection metadata */
  metadata?: Record<string, unknown>
}

/**
 * Message envelope for transport
 */
export interface TransportMessage<T = unknown> {
  /** Message ID */
  id: RequestId
  /** Message timestamp */
  timestamp: Timestamp
  /** Message payload */
  payload: T
  /** Message metadata */
  metadata?: {
    /** Session ID */
    sessionId?: SessionId
    /** Correlation ID for request/response */
    correlationId?: RequestId
    /** Message priority */
    priority?: 'low' | 'normal' | 'high'
    /** Message TTL in milliseconds */
    ttl?: number
    /** Compression applied */
    compressed?: boolean
    /** Encoding used */
    encoding?: string
  }
}

/**
 * Transport statistics
 */
export interface TransportStats {
  /** Number of messages sent */
  messagesSent: number
  /** Number of messages received */
  messagesReceived: number
  /** Total bytes sent */
  bytesSent: number
  /** Total bytes received */
  bytesReceived: number
  /** Number of errors */
  errors: number
  /** Number of reconnection attempts */
  reconnectAttempts: number
  /** Current connection duration */
  connectionDuration?: Duration
  /** Average round-trip time */
  averageRtt?: Duration
  /** Last activity timestamp */
  lastActivityAt?: Timestamp
}

/**
 * Transport event handler
 */
export type TransportEventHandler = (event: TransportEvent) => void | Promise<void>

/**
 * Transport message handler
 */
export type TransportMessageHandler<T = unknown> = (message: TransportMessage<T>) => void | Promise<void>

/**
 * Transport error handler
 */
export type TransportErrorHandler = (error: CurupiraError) => void | Promise<void>

/**
 * Base transport interface
 */
export interface Transport<TConfig extends TransportConfig = TransportConfig> {
  /** Transport configuration */
  readonly config: TConfig
  /** Current connection state */
  readonly state: ConnectionState
  /** Connection information */
  readonly connectionInfo: ConnectionInfo | null
  /** Transport statistics */
  readonly stats: TransportStats

  /**
   * Connect to the transport
   */
  connect(): Promise<void>

  /**
   * Disconnect from the transport
   */
  disconnect(reason?: string): Promise<void>

  /**
   * Send a message
   */
  send<T = unknown>(message: TransportMessage<T>): Promise<void>

  /**
   * Check if transport is connected
   */
  isConnected(): boolean

  /**
   * Add event handler
   */
  on(event: 'connected' | 'disconnected' | 'error' | 'message' | 'reconnecting' | 'state_changed', handler: TransportEventHandler): void

  /**
   * Remove event handler
   */
  off(event: 'connected' | 'disconnected' | 'error' | 'message' | 'reconnecting' | 'state_changed', handler: TransportEventHandler): void

  /**
   * Add message handler
   */
  onMessage<T = unknown>(handler: TransportMessageHandler<T>): void

  /**
   * Remove message handler
   */
  offMessage<T = unknown>(handler: TransportMessageHandler<T>): void

  /**
   * Add error handler
   */
  onError(handler: TransportErrorHandler): void

  /**
   * Remove error handler
   */
  offError(handler: TransportErrorHandler): void

  /**
   * Reset transport statistics
   */
  resetStats(): void

  /**
   * Destroy the transport and clean up resources
   */
  destroy(): Promise<void>
}

/**
 * Transport factory function
 */
export type TransportFactory<T extends Transport = Transport> = (
  config: TransportConfig
) => T

/**
 * Transport registry
 */
export interface TransportRegistry {
  /**
   * Register a transport factory
   */
  register(type: TransportType, factory: TransportFactory): void

  /**
   * Unregister a transport factory
   */
  unregister(type: TransportType): void

  /**
   * Create a transport instance
   */
  create(config: TransportConfig): Transport

  /**
   * Check if transport type is registered
   */
  has(type: TransportType): boolean

  /**
   * Get all registered transport types
   */
  types(): TransportType[]
}

/**
 * Connection options for specific operations
 */
export interface ConnectionOptions {
  /** Request timeout override */
  timeout?: number
  /** Retry configuration override */
  retry?: {
    enabled: boolean
    maxAttempts: number
  }
  /** Priority for this operation */
  priority?: 'low' | 'normal' | 'high'
  /** Additional headers */
  headers?: Record<string, string>
  /** Signal for cancellation */
  signal?: AbortSignal
}

/**
 * Response from transport operations
 */
export interface TransportResponse<T = unknown> {
  /** Response data */
  data: T
  /** Response metadata */
  metadata?: {
    /** Request ID */
    requestId: RequestId
    /** Response timestamp */
    timestamp: Timestamp
    /** Round-trip time */
    rtt?: Duration
    /** Response headers */
    headers?: Record<string, string>
    /** Response status */
    status?: number
  }
}

/**
 * Batch message support
 */
export interface BatchMessage<T = unknown> {
  /** Batch ID */
  batchId: RequestId
  /** Messages in the batch */
  messages: TransportMessage<T>[]
  /** Batch metadata */
  metadata?: {
    /** Total message count */
    totalCount: number
    /** Batch sequence number */
    sequenceNumber: number
    /** Is this the last batch */
    isLast: boolean
  }
}

/**
 * Stream support for large payloads
 */
export interface StreamMetadata {
  /** Stream ID */
  streamId: RequestId
  /** Chunk sequence number */
  chunkNumber: number
  /** Total chunks */
  totalChunks: number
  /** Is this the last chunk */
  isLast: boolean
  /** Chunk size */
  chunkSize: number
  /** Total stream size */
  totalSize: number
}

/**
 * Quality of Service levels
 */
export type QoSLevel = 
  | 'at_most_once'   // Fire and forget
  | 'at_least_once'  // Acknowledged delivery
  | 'exactly_once'   // Guaranteed single delivery

/**
 * Transport capabilities
 */
export interface TransportCapabilities {
  /** Supports bidirectional communication */
  bidirectional: boolean
  /** Supports message streaming */
  streaming: boolean
  /** Supports message batching */
  batching: boolean
  /** Supports compression */
  compression: boolean
  /** Supports encryption */
  encryption: boolean
  /** Supports authentication */
  authentication: boolean
  /** Supports quality of service */
  qos: boolean
  /** Maximum message size */
  maxMessageSize?: number
  /** Supported QoS levels */
  qosLevels?: QoSLevel[]
}

/**
 * Transport middleware
 */
export interface TransportMiddleware {
  /** Middleware name */
  name: string
  
  /**
   * Process outgoing messages
   */
  outgoing?<T>(message: TransportMessage<T>, next: () => Promise<void>): Promise<void>
  
  /**
   * Process incoming messages
   */
  incoming?<T>(message: TransportMessage<T>, next: () => Promise<void>): Promise<void>
  
  /**
   * Handle errors
   */
  error?(error: CurupiraError, next: () => Promise<void>): Promise<void>
}