/**
 * Curupira MCP Server - Main Server Class
 * Modularized version with clean separation of concerns
 */

import Fastify from 'fastify'
import type { FastifyInstance } from 'fastify'
import { loadYamlConfig } from './config/yaml-loader.js'
import { logger } from './config/logger.js'
import { setupMiddleware } from './server/middleware.js'
import { setupRoutes } from './server/routes.js'
import { setupMCPTransports } from './server/transport-setup.js'
import { DEFAULT_CONFIG, type ServerConfig, type ServerOptions } from './server/config.js'

export type { ServerConfig, ServerOptions, CurupiraWebSocketConfig, CurupiraHttpConfig } from './server/config.js'

export class CurupiraServer {
  private app: FastifyInstance
  private config: ServerConfig
  private isShuttingDown = false

  constructor(options: ServerOptions = {}) {
    // Load configuration
    this.config = this.loadConfiguration(options)
    
    // Create Fastify instance
    this.app = Fastify({
      logger: {
        level: this.config.logLevel ?? 'info',
        transport: {
          target: 'pino-pretty',
          options: {
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
            colorize: true
          }
        }
      },
      trustProxy: true,
      requestIdHeader: 'x-request-id',
      requestIdLogLabel: 'requestId',
      disableRequestLogging: false,
      bodyLimit: 1048576 // 1MB
    })

    // Setup graceful shutdown
    this.setupGracefulShutdown()
  }

  private loadConfiguration(options: ServerOptions): ServerConfig {
    let config: ServerConfig = { ...DEFAULT_CONFIG }

    // Load from YAML if path provided
    if (options.configPath) {
      try {
        const yamlConfig = loadYamlConfig(options.configPath)
        config = { ...config, ...yamlConfig }
        logger.info(`Configuration loaded from ${options.configPath}`)
      } catch (error) {
        logger.error(`Failed to load config from ${options.configPath}:`, error)
      }
    }

    // Override with provided options
    if (options.config) {
      config = { ...config, ...options.config }
    }

    // Override with environment variables
    config = this.applyEnvironmentOverrides(config)

    return config
  }

  private applyEnvironmentOverrides(config: ServerConfig): ServerConfig {
    // Host and Port
    if (process.env.HOST) config.host = process.env.HOST
    if (process.env.PORT) config.port = parseInt(process.env.PORT, 10)
    
    // Environment and Logging
    if (process.env.NODE_ENV) {
      config.environment = process.env.NODE_ENV as ServerConfig['environment']
    }
    if (process.env.LOG_LEVEL) {
      config.logLevel = process.env.LOG_LEVEL as ServerConfig['logLevel']
    }

    // MCP specific
    if (process.env.MCP_WEBSOCKET_ENABLED !== undefined) {
      config.mcp = config.mcp ?? {}
      config.mcp.websocket = config.mcp.websocket ?? {}
      config.mcp.websocket.enabled = process.env.MCP_WEBSOCKET_ENABLED === 'true'
    }
    if (process.env.MCP_HTTP_ENABLED !== undefined) {
      config.mcp = config.mcp ?? {}
      config.mcp.http = config.mcp.http ?? {}
      config.mcp.http.enabled = process.env.MCP_HTTP_ENABLED === 'true'
    }

    return config
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      if (this.isShuttingDown) return
      this.isShuttingDown = true

      logger.info(`Received ${signal}, starting graceful shutdown...`)

      try {
        await this.app.close()
        logger.info('Server closed successfully')
        process.exit(0)
      } catch (error) {
        logger.error('Error during shutdown:', error)
        process.exit(1)
      }
    }

    process.on('SIGTERM', () => shutdown('SIGTERM'))
    process.on('SIGINT', () => shutdown('SIGINT'))
    process.on('SIGHUP', () => shutdown('SIGHUP'))

    process.on('uncaughtException', (error) => {
      logger.fatal('Uncaught exception:', error)
      process.exit(1)
    })

    process.on('unhandledRejection', (reason, promise) => {
      logger.fatal('Unhandled rejection at:', promise, 'reason:', reason)
      process.exit(1)
    })
  }

  async start(): Promise<void> {
    try {
      // Setup middleware
      await setupMiddleware(this.app, this.config)
      
      // Setup basic routes
      await setupRoutes(this.app, this.config)
      
      // Setup MCP transports
      await setupMCPTransports(this.app, this.config)

      // Start the server
      const host = this.config.host ?? '127.0.0.1'
      const port = this.config.port ?? 8080

      await this.app.listen({ port, host })
      
      logger.info(`${this.config.name ?? 'curupira-mcp-server'} v${this.config.version ?? '1.0.0'} started`)
      logger.info(`Environment: ${this.config.environment ?? 'development'}`)
      logger.info(`Server listening at http://${host}:${port}`)
      
      if (this.config.mcp?.websocket?.enabled !== false) {
        logger.info(`MCP WebSocket available at ws://${host}:${port}${this.config.mcp?.websocket?.path ?? '/mcp'}`)
      }
      if (this.config.mcp?.http?.enabled !== false) {
        logger.info(`MCP HTTP available at http://${host}:${port}${this.config.mcp?.http?.httpPath ?? '/mcp/messages'}`)
      }
      if (this.config.mcp?.http?.sseEnabled !== false) {
        logger.info(`MCP SSE available at http://${host}:${port}${this.config.mcp?.http?.ssePath ?? '/mcp/sse'}`)
      }
    } catch (error) {
      logger.fatal('Failed to start server:', error)
      throw error
    }
  }

  async stop(): Promise<void> {
    await this.app.close()
  }

  getApp(): FastifyInstance {
    return this.app
  }

  getConfig(): ServerConfig {
    return this.config
  }
}