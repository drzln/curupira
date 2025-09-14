/**
 * @fileoverview Server foundation type definitions
 * 
 * This file defines the core types for the Curupira MCP server,
 * including server configuration, lifecycle events, and health checks.
 */

import type {
  Transport,
  TransportConfig,
  WebSocketTransportConfig,
  HttpTransportConfig
} from '@curupira/shared/transport'
import type {
  McpConfig,
  MCP
} from '@curupira/shared/protocol'
import type {
  CurupiraConfig,
  LogLevel
} from '@curupira/shared/config'
import type {
  SessionId,
  RequestId,
  Timestamp
} from '@curupira/shared/types'

/**
 * Server state
 */
export type ServerState = 
  | 'stopped'
  | 'starting' 
  | 'running'
  | 'stopping'
  | 'error'

/**
 * Server configuration
 */
export interface ServerConfig extends CurupiraConfig {
  /** Server name */
  name: string
  /** Server version */
  version: string
  /** Server host */
  host?: string
  /** Server port */
  port?: number
  /** Enable health check endpoint */
  healthCheck?: boolean
  /** Health check path */
  healthCheckPath?: string
  /** Health check interval */
  healthCheckInterval?: number
  /** Shutdown timeout in milliseconds */
  shutdownTimeout?: number
  /** Transport configurations */
  transports?: {
    websocket?: Partial<WebSocketTransportConfig>
    http?: Partial<HttpTransportConfig>
  }
  /** MCP protocol configuration */
  mcp?: Partial<McpConfig>
  /** Server metadata */
  metadata?: Record<string, unknown>
}

/**
 * Health check status
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy'

/**
 * Health check result
 */
export interface HealthCheckResult {
  /** Overall status */
  status: HealthStatus
  /** Timestamp of check */
  timestamp: Timestamp
  /** Server version */
  version: string
  /** Server uptime in milliseconds */
  uptime: number
  /** Individual component checks */
  checks: HealthCheck[]
  /** Additional metadata */
  metadata?: Record<string, unknown>
}

/**
 * Individual health check
 */
export interface HealthCheck {
  /** Check name */
  name: string
  /** Check status */
  status: HealthStatus
  /** Check message */
  message?: string
  /** Check duration in milliseconds */
  duration?: number
  /** Additional details */
  details?: Record<string, unknown>
}

/**
 * Server statistics
 */
export interface ServerStats {
  /** Server start time */
  startTime: Timestamp
  /** Total connections */
  totalConnections: number
  /** Active connections */
  activeConnections: number
  /** Total requests */
  totalRequests: number
  /** Total errors */
  totalErrors: number
  /** Average request duration */
  averageRequestDuration?: number
  /** Memory usage */
  memoryUsage: {
    rss: number
    heapTotal: number
    heapUsed: number
    external: number
  }
  /** CPU usage percentage */
  cpuUsage?: number
}

/**
 * Server events
 */
export type ServerEvent =
  | { type: 'started'; timestamp: Timestamp }
  | { type: 'stopped'; timestamp: Timestamp; reason?: string }
  | { type: 'error'; timestamp: Timestamp; error: Error }
  | { type: 'connection'; timestamp: Timestamp; sessionId: SessionId }
  | { type: 'disconnection'; timestamp: Timestamp; sessionId: SessionId; reason?: string }
  | { type: 'health_check'; timestamp: Timestamp; result: HealthCheckResult }
  | { type: 'state_changed'; timestamp: Timestamp; from: ServerState; to: ServerState }

/**
 * Connection info
 */
export interface ConnectionInfo {
  /** Session ID */
  sessionId: SessionId
  /** Transport type */
  transport: 'websocket' | 'http'
  /** Connection time */
  connectedAt: Timestamp
  /** Remote address */
  remoteAddress?: string
  /** User agent */
  userAgent?: string
  /** Connection metadata */
  metadata?: Record<string, unknown>
}

/**
 * Server lifecycle hooks
 */
export interface ServerHooks {
  /** Called before server starts */
  beforeStart?: () => Promise<void> | void
  /** Called after server starts */
  afterStart?: () => Promise<void> | void
  /** Called before server stops */
  beforeStop?: () => Promise<void> | void
  /** Called after server stops */
  afterStop?: () => Promise<void> | void
  /** Called on connection */
  onConnection?: (connection: ConnectionInfo) => Promise<void> | void
  /** Called on disconnection */
  onDisconnection?: (connection: ConnectionInfo, reason?: string) => Promise<void> | void
  /** Called on error */
  onError?: (error: Error) => Promise<void> | void
}

/**
 * Server plugin interface
 */
export interface ServerPlugin {
  /** Plugin name */
  name: string
  /** Plugin version */
  version?: string
  /** Initialize plugin */
  initialize?: (server: Server) => Promise<void> | void
  /** Start plugin */
  start?: () => Promise<void> | void
  /** Stop plugin */
  stop?: () => Promise<void> | void
  /** Health check */
  healthCheck?: () => Promise<HealthCheck> | HealthCheck
}

/**
 * Server interface
 */
export interface Server {
  /** Server configuration */
  readonly config: ServerConfig
  /** Current server state */
  readonly state: ServerState
  /** Server statistics */
  readonly stats: ServerStats
  /** Active connections */
  readonly connections: Map<SessionId, ConnectionInfo>

  /**
   * Start the server
   */
  start(): Promise<void>

  /**
   * Stop the server
   */
  stop(reason?: string): Promise<void>

  /**
   * Restart the server
   */
  restart(): Promise<void>

  /**
   * Get health check result
   */
  getHealth(): Promise<HealthCheckResult>

  /**
   * Register a plugin
   */
  use(plugin: ServerPlugin): void

  /**
   * Set lifecycle hooks
   */
  setHooks(hooks: ServerHooks): void

  /**
   * Emit server event
   */
  emit(event: ServerEvent): void

  /**
   * Listen for server events
   */
  on(
    event: ServerEvent['type'],
    handler: (event: ServerEvent) => void
  ): void

  /**
   * Remove event listener
   */
  off(
    event: ServerEvent['type'],
    handler: (event: ServerEvent) => void
  ): void
}

/**
 * Request context for handlers
 */
export interface RequestContext {
  /** Request ID */
  requestId: RequestId
  /** Session ID */
  sessionId: SessionId
  /** Connection info */
  connection: ConnectionInfo
  /** Request start time */
  startTime: number
  /** Request metadata */
  metadata?: Record<string, unknown>
}

/**
 * Graceful shutdown options
 */
export interface ShutdownOptions {
  /** Timeout in milliseconds */
  timeout?: number
  /** Force shutdown after timeout */
  force?: boolean
  /** Shutdown reason */
  reason?: string
}

/**
 * Server builder options
 */
export interface ServerBuilderOptions {
  /** Enable WebSocket transport */
  websocket?: boolean | Partial<WebSocketTransportConfig>
  /** Enable HTTP transport */
  http?: boolean | Partial<HttpTransportConfig>
  /** Enable health checks */
  healthCheck?: boolean
  /** Enable graceful shutdown */
  gracefulShutdown?: boolean
  /** Enable request logging */
  requestLogging?: boolean
  /** Enable error recovery */
  errorRecovery?: boolean
}

/**
 * Health check function
 */
export type HealthCheckFunction = () => Promise<HealthCheck> | HealthCheck

/**
 * Server middleware
 */
export interface ServerMiddleware {
  /** Middleware name */
  name: string
  /** Process request before handling */
  preProcess?: (context: RequestContext) => Promise<void> | void
  /** Process request after handling */
  postProcess?: (context: RequestContext, duration: number) => Promise<void> | void
  /** Handle errors */
  onError?: (context: RequestContext, error: Error) => Promise<void> | void
}