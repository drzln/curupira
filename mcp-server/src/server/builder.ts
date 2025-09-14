/**
 * @fileoverview Server builder for convenient configuration
 * 
 * This file provides a fluent builder API for creating and
 * configuring Curupira MCP servers with common patterns.
 */

import type {
  Server,
  ServerConfig,
  ServerPlugin,
  ServerHooks,
  ServerMiddleware,
  HealthCheckFunction,
  ServerBuilderOptions
} from './types.js'
import { CurupiraServer } from './server.js'
import type {
  WebSocketTransportConfig,
  HttpTransportConfig
} from '@curupira/shared/transport'
import type { McpConfig, MCP } from '@curupira/shared/protocol'
import type { LogLevel } from '@curupira/shared/config'
import { createLogger } from '@curupira/shared/logging'

/**
 * Fluent builder for creating Curupira servers
 */
export class ServerBuilder {
  private config: Partial<ServerConfig> = {}
  private plugins: ServerPlugin[] = []
  private hooks: ServerHooks = {}
  private middlewares: ServerMiddleware[] = []
  private healthChecks: Map<string, HealthCheckFunction> = new Map()

  constructor(name?: string, version?: string) {
    if (name) this.config.name = name
    if (version) this.config.version = version
  }

  /**
   * Set server name
   */
  withName(name: string): this {
    this.config.name = name
    return this
  }

  /**
   * Set server version
   */
  withVersion(version: string): this {
    this.config.version = version
    return this
  }

  /**
   * Set server host and port
   */
  withAddress(host: string, port: number): this {
    this.config.host = host
    this.config.port = port
    return this
  }

  /**
   * Set environment
   */
  withEnvironment(env: 'development' | 'staging' | 'production'): this {
    this.config.environment = env
    return this
  }

  /**
   * Set log level
   */
  withLogLevel(level: LogLevel): this {
    this.config.logLevel = level
    return this
  }

  /**
   * Enable WebSocket transport
   */
  withWebSocket(config?: Partial<WebSocketTransportConfig>): this {
    if (!this.config.transports) {
      this.config.transports = {}
    }
    this.config.transports.websocket = config || {}
    return this
  }

  /**
   * Enable HTTP transport
   */
  withHttp(config?: Partial<HttpTransportConfig>): this {
    if (!this.config.transports) {
      this.config.transports = {}
    }
    this.config.transports.http = config || {}
    return this
  }

  /**
   * Configure MCP protocol
   */
  withMcp(config: Partial<McpConfig>): this {
    this.config.mcp = config
    return this
  }

  /**
   * Enable health checks
   */
  withHealthCheck(
    enabled: boolean = true,
    path?: string,
    interval?: number
  ): this {
    this.config.healthCheck = enabled
    if (path) this.config.healthCheckPath = path
    if (interval) this.config.healthCheckInterval = interval
    return this
  }

  /**
   * Add custom health check
   */
  withCustomHealthCheck(name: string, check: HealthCheckFunction): this {
    this.healthChecks.set(name, check)
    return this
  }

  /**
   * Set shutdown timeout
   */
  withShutdownTimeout(timeout: number): this {
    this.config.shutdownTimeout = timeout
    return this
  }

  /**
   * Add plugin
   */
  withPlugin(plugin: ServerPlugin): this {
    this.plugins.push(plugin)
    return this
  }

  /**
   * Set lifecycle hooks
   */
  withHooks(hooks: ServerHooks): this {
    this.hooks = { ...this.hooks, ...hooks }
    return this
  }

  /**
   * Add middleware
   */
  withMiddleware(middleware: ServerMiddleware): this {
    this.middlewares.push(middleware)
    return this
  }

  /**
   * Enable SSL/TLS
   */
  withSsl(cert: string, key: string, ca?: string): this {
    this.config.ssl = { cert, key, ca }
    return this
  }

  /**
   * Apply common builder options
   */
  withOptions(options: ServerBuilderOptions): this {
    // WebSocket transport
    if (options.websocket !== undefined) {
      if (options.websocket === true) {
        this.withWebSocket()
      } else if (options.websocket) {
        this.withWebSocket(options.websocket)
      }
    }

    // HTTP transport
    if (options.http !== undefined) {
      if (options.http === true) {
        this.withHttp()
      } else if (options.http) {
        this.withHttp(options.http)
      }
    }

    // Health check
    if (options.healthCheck !== undefined) {
      this.withHealthCheck(options.healthCheck)
    }

    // Graceful shutdown
    if (options.gracefulShutdown) {
      this.withShutdownTimeout(30000)
      this.withHooks({
        beforeStop: async () => {
          const logger = createLogger({ name: 'shutdown' })
          logger.info('Starting graceful shutdown')
        }
      })
    }

    // Request logging
    if (options.requestLogging) {
      this.withMiddleware({
        name: 'request-logger',
        preProcess: (context) => {
          const logger = createLogger({ name: 'request' })
          logger.debug({ 
            requestId: context.requestId,
            sessionId: context.sessionId,
            startTime: context.startTime
          }, 'Request started')
        },
        postProcess: (context, duration) => {
          const logger = createLogger({ name: 'request' })
          logger.info({ 
            requestId: context.requestId,
            sessionId: context.sessionId,
            duration
          }, 'Request completed')
        },
        onError: (context, error) => {
          const logger = createLogger({ name: 'request' })
          logger.error({ 
            requestId: context.requestId,
            sessionId: context.sessionId,
            error
          }, 'Request failed')
        }
      })
    }

    // Error recovery
    if (options.errorRecovery) {
      this.withHooks({
        onError: async (error) => {
          const logger = createLogger({ name: 'error-recovery' })
          logger.error({ error }, 'Server error occurred')
          // Add recovery logic here
        }
      })
    }

    return this
  }

  /**
   * Build the server
   */
  build(): Server {
    const server = new CurupiraServer(this.config)

    // Add plugins
    for (const plugin of this.plugins) {
      server.use(plugin)
    }

    // Set hooks
    if (Object.keys(this.hooks).length > 0) {
      server.setHooks(this.hooks)
    }

    // Add middlewares
    for (const middleware of this.middlewares) {
      server.addMiddleware(middleware)
    }

    // Register health checks
    for (const [name, check] of this.healthChecks) {
      server.registerHealthCheck(name, check)
    }

    return server
  }

  /**
   * Build and start the server
   */
  async buildAndStart(): Promise<Server> {
    const server = this.build()
    await server.start()
    return server
  }
}

/**
 * Create a new server builder
 */
export function createServerBuilder(
  name?: string,
  version?: string
): ServerBuilder {
  return new ServerBuilder(name, version)
}

/**
 * Create a development server with sensible defaults
 */
export function createDevServer(
  name: string = 'curupira-dev',
  port: number = 8000
): ServerBuilder {
  return new ServerBuilder(name, '1.0.0')
    .withAddress('localhost', port)
    .withEnvironment('development')
    .withLogLevel('debug')
    .withWebSocket()
    .withHealthCheck(true, '/health', 30000)
    .withOptions({
      requestLogging: true,
      errorRecovery: true,
      gracefulShutdown: true
    })
}

/**
 * Create a production server with security and monitoring
 */
export function createProductionServer(
  name: string,
  version: string,
  port: number = 8080
): ServerBuilder {
  return new ServerBuilder(name, version)
    .withAddress('0.0.0.0', port)
    .withEnvironment('production')
    .withLogLevel('info')
    .withWebSocket({
      pingInterval: 30000,
      reconnect: true,
      reconnectDelay: 1000,
      maxReconnectAttempts: 10
    })
    .withHealthCheck(true, '/health', 60000)
    .withShutdownTimeout(30000)
    .withOptions({
      healthCheck: true,
      gracefulShutdown: true,
      requestLogging: true,
      errorRecovery: true
    })
}