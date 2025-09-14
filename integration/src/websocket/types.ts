/**
 * @fileoverview WebSocket manager types
 * 
 * This file defines types for WebSocket connection management,
 * pooling, and event handling.
 */

import type { 
  WebSocketTransport,
  TransportMessage,
  ConnectionInfo,
  TransportEvent
} from '@curupira/shared'
import type { EventEmitter } from 'eventemitter3'

/**
 * WebSocket connection configuration
 */
export interface WebSocketConnectionConfig {
  /** Connection ID */
  id: string
  /** WebSocket URL */
  url: string
  /** Connection protocols */
  protocols?: string[]
  /** Headers */
  headers?: Record<string, string>
  /** Auto reconnect */
  autoReconnect?: boolean
  /** Max reconnect attempts */
  maxReconnectAttempts?: number
  /** Reconnect delay */
  reconnectDelay?: number
  /** Connection timeout */
  connectionTimeout?: number
  /** Keep alive */
  keepAlive?: boolean
  /** Keep alive interval */
  keepAliveInterval?: number
  /** Message queue size */
  messageQueueSize?: number
  /** Connection metadata */
  metadata?: Record<string, unknown>
}

/**
 * WebSocket connection state
 */
export interface WebSocketConnection {
  /** Connection ID */
  id: string
  /** Transport instance */
  transport: WebSocketTransport
  /** Connection config */
  config: WebSocketConnectionConfig
  /** Connection state */
  state: 'connecting' | 'connected' | 'disconnected' | 'error'
  /** Connection info */
  info?: ConnectionInfo
  /** Last activity timestamp */
  lastActivity: number
  /** Message queue */
  messageQueue: TransportMessage[]
  /** Event emitter */
  events: EventEmitter
}

/**
 * WebSocket manager configuration
 */
export interface WebSocketManagerConfig {
  /** Maximum connections */
  maxConnections: number
  /** Connection timeout */
  defaultTimeout: number
  /** Default reconnect settings */
  defaultReconnect: {
    enabled: boolean
    maxAttempts: number
    delay: number
    maxDelay: number
    backoffFactor: number
  }
  /** Message queue settings */
  messageQueue: {
    enabled: boolean
    maxSize: number
    ttl: number
  }
  /** Health check settings */
  healthCheck: {
    enabled: boolean
    interval: number
    timeout: number
  }
  /** Connection pooling */
  pooling: {
    enabled: boolean
    minConnections: number
    maxIdleTime: number
  }
}

/**
 * Connection pool statistics
 */
export interface PoolStatistics {
  /** Total connections */
  total: number
  /** Active connections */
  active: number
  /** Idle connections */
  idle: number
  /** Failed connections */
  failed: number
  /** Messages sent */
  messagesSent: number
  /** Messages received */
  messagesReceived: number
  /** Average latency */
  averageLatency: number
  /** Uptime */
  uptime: number
}

/**
 * Message routing configuration
 */
export interface MessageRoutingConfig {
  /** Route by connection ID */
  connectionId?: string
  /** Route by pattern */
  pattern?: string | RegExp
  /** Route by predicate */
  predicate?: (message: TransportMessage) => boolean
  /** Priority */
  priority?: number
  /** Round-robin routing */
  roundRobin?: boolean
  /** Broadcast to all */
  broadcast?: boolean
}

/**
 * WebSocket manager events
 */
export interface WebSocketManagerEvents {
  /** Connection added */
  'connection:added': (connection: WebSocketConnection) => void
  /** Connection removed */
  'connection:removed': (connectionId: string) => void
  /** Connection state changed */
  'connection:state': (connectionId: string, state: WebSocketConnection['state']) => void
  /** Message received */
  'message:received': (connectionId: string, message: TransportMessage) => void
  /** Message sent */
  'message:sent': (connectionId: string, message: TransportMessage) => void
  /** Error occurred */
  'error': (error: Error, connectionId?: string) => void
  /** Pool statistics updated */
  'pool:stats': (stats: PoolStatistics) => void
}

/**
 * Connection selection strategy
 */
export type ConnectionSelectionStrategy = 
  | 'round-robin'
  | 'least-loaded'
  | 'random'
  | 'first-available'
  | ((connections: WebSocketConnection[]) => WebSocketConnection | null)

/**
 * Message handler
 */
export type MessageHandler = (
  message: TransportMessage,
  connection: WebSocketConnection
) => void | Promise<void>

/**
 * Connection filter
 */
export type ConnectionFilter = (connection: WebSocketConnection) => boolean

/**
 * Health check function
 */
export type HealthCheckFunction = (
  connection: WebSocketConnection
) => Promise<boolean>

/**
 * Connection lifecycle hooks
 */
export interface ConnectionLifecycleHooks {
  /** Before connect */
  beforeConnect?: (config: WebSocketConnectionConfig) => Promise<void> | void
  /** After connect */
  afterConnect?: (connection: WebSocketConnection) => Promise<void> | void
  /** Before disconnect */
  beforeDisconnect?: (connection: WebSocketConnection) => Promise<void> | void
  /** After disconnect */
  afterDisconnect?: (connectionId: string) => Promise<void> | void
  /** On error */
  onError?: (error: Error, connection?: WebSocketConnection) => Promise<void> | void
}