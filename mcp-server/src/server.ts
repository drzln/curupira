/**
 * Consolidated Curupira MCP Server
 * Single server implementation supporting configurable transports:
 * - WebSocket for Chrome Extension
 * - HTTP/SSE for Claude Code
 * - Health checks and monitoring
 * - YAML configuration support
 */

import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import helmet from '@fastify/helmet'
import websocket from '@fastify/websocket'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import type { FastifyInstance, FastifyReply } from 'fastify'

import { setupMCPHandlers } from './mcp/index.js'
import { WebSocketTransport } from './transport/websocket.js'
import { HttpSseTransport } from './transport/http-sse.js'
import { loadYamlConfig, mergeWithYamlConfig } from './config/yaml-loader.js'
import { logger } from './config/logger.js'

// Extended transport configurations for Curupira
export interface CurupiraWebSocketConfig {
  enabled?: boolean
  path?: string
  pingInterval?: number
  pongTimeout?: number
  enablePing?: boolean
}

export interface CurupiraHttpConfig {
  enabled?: boolean
  httpPath?: string
  ssePath?: string
  sseEnabled?: boolean
  timeout?: number
  keepAliveInterval?: number
}

export interface ServerConfig {
  name?: string
  version?: string
  host?: string
  port?: number
  environment?: 'development' | 'staging' | 'production'
  logLevel?: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'
  healthCheck?: boolean
  healthCheckPath?: string
  healthCheckInterval?: number
  transports?: {
    websocket?: CurupiraWebSocketConfig
    http?: CurupiraHttpConfig
  }
  cors?: {
    origins?: string[]
    credentials?: boolean
  }
  rateLimit?: {
    max?: number
    window?: number
  }
  auth?: {
    enabled?: boolean
    jwtSecret?: string
    tokenExpiry?: string
  }
}

export interface ServerOptions {
  configPath?: string
  envConfig?: Partial<ServerConfig>
}

export class CurupiraServer {
  private fastify: FastifyInstance
  private mcpServer: Server
  private config: ServerConfig
  private httpSseTransport: HttpSseTransport | null = null
  private isRunning = false

  constructor(options: ServerOptions = {}) {
    // Load and merge configuration
    this.config = this.loadConfiguration(options)
    
    // Initialize Fastify with proper logging
    this.fastify = Fastify({
      logger: logger as any,
      trustProxy: true,
    })

    // Initialize MCP server with configuration
    this.mcpServer = new Server(
      {
        name: this.config.name || 'curupira',
        version: this.config.version || '1.0.0',
      },
      {
        capabilities: {
          resources: {},
          tools: {},
          prompts: {},
        },
      }
    )
  }

  private loadConfiguration(options: ServerOptions): ServerConfig {
    // Default configuration
    const defaults: ServerConfig = {
      name: 'curupira-mcp-server',
      version: '1.0.0',
      host: '0.0.0.0',
      port: 8080,
      environment: 'development',
      logLevel: 'info',
      healthCheck: true,
      healthCheckPath: '/health',
      healthCheckInterval: 30000,
      transports: {
        websocket: {
          enabled: true,
          path: '/mcp',
          enablePing: true,
          pingInterval: 30000,
          pongTimeout: 5000,
        },
        http: {
          enabled: false,
          httpPath: '/mcp',
          ssePath: '/mcp/sse',
          sseEnabled: false,
          keepAliveInterval: 30000,
        },
      },
      cors: {
        origins: ['*'],
        credentials: true,
      },
      rateLimit: {
        max: 100,
        window: 60000,
      },
      auth: {
        enabled: false,
      },
    }

    // Environment variable overrides
    const envConfig: Partial<ServerConfig> = {
      name: process.env.CURUPIRA_NAME,
      host: process.env.CURUPIRA_HOST || process.env.HOST,
      port: process.env.CURUPIRA_PORT ? parseInt(process.env.CURUPIRA_PORT) : 
            process.env.PORT ? parseInt(process.env.PORT) : undefined,
      environment: (process.env.NODE_ENV || process.env.CURUPIRA_ENV) as any,
      logLevel: process.env.CURUPIRA_LOG_LEVEL as any,
    }

    // Parse CORS origins from environment
    if (process.env.CURUPIRA_CORS_ORIGINS) {
      envConfig.cors = {
        origins: process.env.CURUPIRA_CORS_ORIGINS.split(',').map(s => s.trim()),
      }
    }

    // Parse transport settings from environment
    const transports: any = {}
    
    if (process.env.CURUPIRA_TRANSPORT_WEBSOCKET !== undefined) {
      transports.websocket = {
        enabled: process.env.CURUPIRA_TRANSPORT_WEBSOCKET === 'true',
      }
    }

    if (process.env.CURUPIRA_TRANSPORT_HTTP === 'true' || 
        process.env.CURUPIRA_TRANSPORT_SSE === 'true') {
      transports.http = {
        enabled: true,
        httpPath: process.env.CURUPIRA_HTTP_PATH || '/mcp',
        ssePath: process.env.CURUPIRA_SSE_PATH || '/mcp/sse',
        sseEnabled: process.env.CURUPIRA_TRANSPORT_SSE === 'true',
      }
    }

    if (Object.keys(transports).length > 0) {
      envConfig.transports = transports
    }

    // Auth settings
    if (process.env.CURUPIRA_AUTH_ENABLED !== undefined) {
      envConfig.auth = {
        enabled: process.env.CURUPIRA_AUTH_ENABLED === 'true',
        jwtSecret: process.env.CURUPIRA_JWT_SECRET,
        tokenExpiry: process.env.CURUPIRA_TOKEN_EXPIRY,
      }
    }

    // Start with defaults
    let config = { ...defaults }

    // Merge with YAML config if provided
    if (options.configPath) {
      try {
        const yamlConfig = loadYamlConfig(options.configPath)
        config = this.deepMerge(config, yamlConfig)
      } catch (error) {
        logger.warn({ error, configPath: options.configPath }, 'Failed to load YAML config, using defaults')
      }
    }

    // Apply environment variables
    config = this.deepMerge(config, envConfig)

    // Apply passed-in config
    if (options.envConfig) {
      config = this.deepMerge(config, options.envConfig)
    }

    return config
  }

  private deepMerge(target: any, source: any): any {
    const result = { ...target }
    
    for (const key in source) {
      if (source[key] !== undefined && source[key] !== null) {
        if (typeof source[key] === 'object' && !Array.isArray(source[key])) {
          result[key] = this.deepMerge(result[key] || {}, source[key])
        } else {
          result[key] = source[key]
        }
      }
    }
    
    return result
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Server is already running')
    }

    try {
      // Register plugins
      await this.registerPlugins()

      // Setup routes
      this.setupRoutes()

      // Setup MCP handlers
      setupMCPHandlers(this.mcpServer)

      // Setup transports based on configuration
      await this.setupTransports()

      // Start server
      const address = await this.fastify.listen({
        port: this.config.port!,
        host: this.config.host!,
      })

      this.isRunning = true
      
      logger.info({ 
        address,
        transports: this.getEnabledTransports(),
        config: {
          name: this.config.name,
          version: this.config.version,
          environment: this.config.environment,
          logLevel: this.config.logLevel,
        }
      }, 'Curupira MCP Server started')

    } catch (error) {
      logger.error({ error }, 'Failed to start server')
      throw error
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return
    }

    try {
      await this.fastify.close()
      this.isRunning = false
      logger.info('Server stopped')
    } catch (error) {
      logger.error({ error }, 'Error stopping server')
      throw error
    }
  }

  private async registerPlugins(): Promise<void> {
    // CORS
    await this.fastify.register(cors, {
      origin: this.config.cors?.origins || ['*'],
      credentials: this.config.cors?.credentials !== false,
    })

    // Security headers
    await this.fastify.register(helmet, {
      contentSecurityPolicy: false, // WebSocket compatibility
    })

    // Rate limiting
    await this.fastify.register(rateLimit, {
      max: this.config.rateLimit?.max || 100,
      timeWindow: this.config.rateLimit?.window || 60000,
    })

    // WebSocket support if enabled
    if (this.config.transports?.websocket?.enabled !== false) {
      await this.fastify.register(websocket, {
        options: {
          maxPayload: 1048576, // 1MB
        },
      })
    }
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.fastify.get(this.config.healthCheckPath || '/health', async () => ({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: this.config.version,
      name: this.config.name,
      environment: this.config.environment,
      transports: this.getEnabledTransports(),
      uptime: process.uptime(),
    }))

    // Readiness check
    this.fastify.get('/ready', async () => ({
      ready: this.isRunning,
      timestamp: new Date().toISOString(),
    }))

    // Server info and capabilities
    this.fastify.get('/info', async () => ({
      name: this.config.name,
      version: this.config.version,
      protocol: 'mcp',
      capabilities: {
        resources: true,
        tools: true,
        prompts: true,
      },
      transports: this.getTransportInfo(),
      endpoints: this.getEndpointInfo(),
    }))
  }

  private async setupTransports(): Promise<void> {
    const transports = this.config.transports || {}

    // Setup WebSocket transport
    if (transports.websocket?.enabled !== false) {
      this.setupWebSocketTransport()
      logger.info({ 
        path: transports.websocket?.path || '/mcp',
        enablePing: transports.websocket?.enablePing,
        pingInterval: transports.websocket?.pingInterval,
      }, 'WebSocket transport enabled')
    }

    // Setup HTTP/SSE transport
    if (transports.http?.enabled) {
      this.setupHttpSseTransport()
      logger.info({
        httpPath: transports.http?.httpPath || '/mcp',
        ssePath: transports.http?.ssePath || '/mcp/sse',
        sseEnabled: transports.http?.sseEnabled,
      }, 'HTTP/SSE transport enabled')
    }

    // Ensure at least one transport is enabled
    const enabledTransports = this.getEnabledTransports()
    if (enabledTransports.length === 0) {
      logger.warn('No transports enabled, enabling WebSocket by default')
      this.setupWebSocketTransport()
    }
  }

  private setupWebSocketTransport(): void {
    const wsConfig = this.config.transports?.websocket || {}
    const path = wsConfig.path || '/mcp'
    
    this.fastify.register(async (fastify) => {
      fastify.get(path, { websocket: true }, (socket: any, request) => {
        logger.info({ 
          ip: request.ip,
          userAgent: request.headers['user-agent'],
        }, 'WebSocket connection established')

        const transport = new WebSocketTransport(socket)
        
        // Connect MCP server to transport
        this.mcpServer.connect(transport).catch((error) => {
          logger.error({ error }, 'Failed to connect MCP server to WebSocket')
          if ('close' in socket && typeof socket.close === 'function') {
            socket.close()
          }
        })

        socket.on('error', (error: Error) => {
          logger.error({ error }, 'WebSocket error')
        })

        socket.on('close', () => {
          logger.info('WebSocket connection closed')
        })
      })
    })
  }

  private setupHttpSseTransport(): void {
    const httpConfig = this.config.transports?.http || {}
    const httpPath = httpConfig.httpPath || '/mcp'
    const ssePath = httpConfig.ssePath || '/mcp/sse' 
    const sseEnabled = httpConfig.sseEnabled !== false

    // Debug logging
    logger.debug({ 
      httpConfig, 
      httpPath, 
      ssePath, 
      sseEnabled,
      fullConfig: this.config.transports 
    }, 'HTTP/SSE transport configuration')

    // Initialize HTTP/SSE transport
    this.httpSseTransport = new HttpSseTransport()
    
    // Connect to MCP server
    this.mcpServer.connect(this.httpSseTransport).catch((error) => {
      logger.error({ error }, 'Failed to connect HTTP/SSE transport to MCP server')
    })

    // HTTP endpoint for MCP messages (used by Claude Code)
    this.fastify.post(httpPath, async (request, reply) => {
      try {
        const message = request.body as any
        logger.debug({ 
          method: message.method,
          id: message.id,
        }, 'Received HTTP MCP request')

        if (this.httpSseTransport) {
          this.httpSseTransport.handleHttpRequest(message)
        }
        
        return reply
          .code(200)
          .header('Content-Type', 'application/json')
          .send({ status: 'accepted', timestamp: new Date().toISOString() })
      } catch (error) {
        logger.error({ error }, 'Failed to process HTTP MCP request')
        return reply
          .code(500)
          .send({
            jsonrpc: '2.0',
            id: (request.body as any)?.id || null,
            error: {
              code: -32603,
              message: 'Internal error',
              data: error instanceof Error ? error.message : 'Unknown error'
            }
          })
      }
    })

    // SSE endpoint for server-sent events (used by Claude Code responses)
    if (sseEnabled) {
      this.fastify.get(ssePath, async (request, reply) => {
        logger.info({ 
          ip: request.ip,
          userAgent: request.headers['user-agent'],
        }, 'SSE connection established')
        
        reply.raw.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'X-Accel-Buffering': 'no', // Disable Nginx buffering
        })

        // Send initial connection event
        reply.raw.write('event: connected\\ndata: {"connected": true, "timestamp": "' + new Date().toISOString() + '"}\\n\\n')

        // Set the SSE reply in transport
        if (this.httpSseTransport) {
          this.httpSseTransport.setSseReply(reply)
        }

        // Keep connection alive with configurable interval
        const keepAliveInterval = httpConfig.keepAliveInterval || 30000
        const keepAlive = setInterval(() => {
          if (!reply.raw.destroyed) {
            reply.raw.write(':ping\\n\\n')
          }
        }, keepAliveInterval)

        // Handle client disconnect
        request.raw.on('close', () => {
          clearInterval(keepAlive)
          logger.info('SSE connection closed')
          
          // Clear the SSE reply in transport
          if (this.httpSseTransport) {
            this.httpSseTransport.setSseReply(null as any)
          }
        })

        request.raw.on('error', (error) => {
          clearInterval(keepAlive)
          logger.error({ error }, 'SSE connection error')
        })
      })
    }
  }

  private getEnabledTransports(): string[] {
    const enabled: string[] = []
    const transports = this.config.transports || {}

    if (transports.websocket?.enabled !== false) {
      enabled.push('websocket')
    }

    if (transports.http?.enabled) {
      enabled.push('http')
      if (transports.http.sseEnabled) {
        enabled.push('sse')
      }
    }

    return enabled
  }

  private getTransportInfo(): Record<string, any> {
    const info: Record<string, any> = {}
    const transports = this.config.transports || {}

    if (transports.websocket?.enabled !== false) {
      info.websocket = {
        endpoint: transports.websocket?.path || '/mcp',
        description: 'WebSocket transport for Chrome extension',
        pingEnabled: transports.websocket?.enablePing,
        pingInterval: transports.websocket?.pingInterval,
      }
    }

    if (transports.http?.enabled) {
      info.http = {
        endpoint: transports.http?.httpPath || '/mcp',
        method: 'POST',
        description: 'HTTP transport for Claude Code requests',
        timeout: transports.http?.timeout,
      }

      if (transports.http.sseEnabled) {
        info.sse = {
          endpoint: transports.http?.ssePath || '/mcp/sse',
          method: 'GET',
          description: 'Server-Sent Events for Claude Code responses',
          keepAliveInterval: transports.http?.keepAliveInterval,
        }
      }
    }

    return info
  }

  private getEndpointInfo(): Record<string, any> {
    const endpoints: Record<string, any> = {
      health: {
        path: this.config.healthCheckPath || '/health',
        method: 'GET',
        description: 'Health check endpoint',
      },
      info: {
        path: '/info',
        method: 'GET', 
        description: 'Server information and capabilities',
      },
      ready: {
        path: '/ready',
        method: 'GET',
        description: 'Readiness check endpoint',
      },
    }

    // Add transport endpoints
    const transportInfo = this.getTransportInfo()
    Object.entries(transportInfo).forEach(([name, info]) => {
      endpoints[name] = info
    })

    return endpoints
  }

  // Expose configuration for external access
  get serverConfig(): ServerConfig {
    return { ...this.config }
  }

  // Check if server is running
  get running(): boolean {
    return this.isRunning
  }
}