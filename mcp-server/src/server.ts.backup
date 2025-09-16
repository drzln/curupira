/**
 * Consolidated Curupira MCP Server with Official SDK Transports
 * Uses built-in SSEServerTransport and StreamableHTTPServerTransport
 */

import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import helmet from '@fastify/helmet'
import websocket from '@fastify/websocket'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import type { FastifyInstance } from 'fastify'
import { randomUUID } from 'node:crypto'

import { setupMCPHandlers } from './mcp/index.js'
import { WebSocketTransport } from './transport/websocket.js'
import { loadYamlConfig } from './config/yaml-loader.js'
import { logger } from './config/logger.js'

// Configuration interfaces remain the same
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
  useModernTransport?: boolean // Use StreamableHTTP vs SSE
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
  chrome?: {
    enabled?: boolean
    serviceUrl?: string
    connectTimeout?: number
    pageTimeout?: number
    defaultViewport?: {
      width?: number
      height?: number
    }
  }
}

export interface ServerOptions {
  configPath?: string
  envConfig?: Partial<ServerConfig>
}

export class CurupiraServer {
  private fastify: FastifyInstance
  private config: ServerConfig
  private transports = new Map<string, SSEServerTransport | StreamableHTTPServerTransport>()
  private isRunning = false

  constructor(options: ServerOptions = {}) {
    // Load and merge configuration
    this.config = this.loadConfiguration(options)
    
    // Initialize Fastify with proper logging
    this.fastify = Fastify({
      logger: logger as any,
      trustProxy: true,
    })
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
          path: '/mcp/ws',
          enablePing: true,
          pingInterval: 30000,
          pongTimeout: 5000,
        },
        http: {
          enabled: false,
          httpPath: '/mcp/http',
          ssePath: '/mcp/sse',
          sseEnabled: false,
          keepAliveInterval: 30000,
          useModernTransport: true, // Default to modern transport
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
        httpPath: process.env.CURUPIRA_HTTP_PATH || '/mcp/http',
        ssePath: process.env.CURUPIRA_SSE_PATH || '/mcp/sse',
        sseEnabled: process.env.CURUPIRA_TRANSPORT_SSE === 'true',
        useModernTransport: process.env.CURUPIRA_USE_MODERN_TRANSPORT !== 'false',
      }
    }

    if (Object.keys(transports).length > 0) {
      envConfig.transports = transports
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

      // Initialize Chrome if configured
      if (this.config.chrome?.enabled && this.config.chrome?.serviceUrl) {
        try {
          const { ChromeManager } = await import('./chrome/manager.js')
          const manager = ChromeManager.getInstance()
          // Parse serviceUrl to get host and port
          const url = new URL(this.config.chrome.serviceUrl)
          await manager.initialize({
            host: url.hostname,
            port: parseInt(url.port) || (url.protocol === 'https:' ? 443 : 80),
            secure: url.protocol === 'https:',
            timeout: this.config.chrome.connectTimeout
          })
          logger.info('Chrome integration initialized')
        } catch (error) {
          logger.error({ error }, 'Failed to initialize Chrome integration')
          // Continue without Chrome - not critical for server startup
        }
      }

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
      // Close all transports
      for (const [sessionId, transport] of this.transports) {
        try {
          await transport.close()
          this.transports.delete(sessionId)
        } catch (error) {
          logger.error({ error, sessionId }, 'Error closing transport')
        }
      }

      // Disconnect Chrome if initialized
      if (this.config.chrome?.enabled) {
        try {
          const { ChromeManager } = await import('./chrome/manager.js')
          const manager = ChromeManager.getInstance()
          await manager.disconnect()
          logger.info('Chrome disconnected')
        } catch (error) {
          logger.error({ error }, 'Error disconnecting Chrome')
        }
      }

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
      exposedHeaders: ['Mcp-Session-Id'], // Important for Streamable HTTP
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

    // Simple tools endpoint for testing (bypasses MCP transport complexity)
    this.fastify.get('/tools', async () => {
      try {
        // Import and call the tools handler directly
        const { setupUnifiedToolHandlers } = await import('./mcp/tools/index.js')
        
        // Collect tools by mocking the server
        const tools: any[] = []
        const mockServer = {
          setRequestHandler: (schema: any, handler: Function) => {
            if (schema.method === 'tools/list') {
              // Execute the handler to get tools list
              handler({ params: {} }).then((result: any) => {
                if (result?.tools) {
                  tools.push(...result.tools)
                }
              })
            }
          }
        }
        
        setupUnifiedToolHandlers(mockServer as any)
        
        // Wait a bit for the async handler to complete
        await new Promise(resolve => setTimeout(resolve, 100))
        
        return {
          available: tools.length,
          tools: tools.map(tool => ({
            name: tool.name,
            description: tool.description
          }))
        }
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : 'Unknown error',
          available: 0,
          tools: []
        }
      }
    })
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
      // TEMPORARY: Force modern transport for debugging
      logger.info({ 
        transportConfig: transports.http,
        useModernTransport: transports.http.useModernTransport 
      }, 'Transport configuration debug')
      
      if (true) { // Force modern transport
        await this.setupStreamableHttpTransport()
        logger.info({
          httpPath: transports.http?.httpPath || '/mcp',
        }, 'Streamable HTTP transport enabled (FORCED)')
      } else {
        await this.setupSseTransport()
        logger.info({
          ssePath: transports.http?.ssePath || '/mcp/sse',
        }, 'SSE transport enabled (deprecated)')
      }
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
        
        // Create a new MCP server instance for this connection
        const server = new Server(
          {
            name: this.config.name || 'curupira-mcp-server',
            version: this.config.version || '1.0.0'
          },
          {
            capabilities: {
              resources: { list: true, read: true },
              tools: { list: true, call: true },
              prompts: { list: true, get: true }
            }
          }
        )

        // Setup MCP handlers
        setupMCPHandlers(server)

        // Connect MCP server to transport
        server.connect(transport).catch((error) => {
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

  private async setupStreamableHttpTransport(): Promise<void> {
    const httpConfig = this.config.transports?.http || {}
    const httpPath = httpConfig.httpPath || '/mcp'

    // Handle GET requests for server capabilities
    this.fastify.get(httpPath, async (request, reply) => {
      logger.debug('Received GET request for server capabilities')
      
      return reply
        .code(200)
        .header('Content-Type', 'application/json')
        .send({
          name: this.config.name || 'curupira-mcp-server',
          version: this.config.version || '1.0.0',
          protocol: 'mcp',
          protocolVersion: '2025-03-26',
          capabilities: {
            resources: { list: true, read: true },
            tools: { list: true, call: true },
            prompts: { list: true, get: true },
            logging: {}
          },
          endpoints: {
            http: httpPath,
            websocket: this.config.transports?.websocket?.path || '/mcp'
          }
        })
    })

    // Handle POST requests for MCP JSON-RPC messages
    this.fastify.post(httpPath, async (request, reply) => {
      logger.debug({ 
        body: request.body,
        headers: request.headers
      }, 'Received MCP JSON-RPC request')

      try {
        const body = request.body as any
        
        // Validate JSON-RPC request
        if (!body || !body.jsonrpc || body.jsonrpc !== '2.0' || !body.method) {
          return reply.code(400).send({
            jsonrpc: '2.0',
            error: {
              code: -32600,
              message: 'Invalid Request',
              data: 'Missing required JSON-RPC fields'
            },
            id: body?.id || null
          })
        }

        // Get or create session
        const sessionId = (request.headers['mcp-session-id'] as string) || randomUUID()
        let transport = this.transports.get(sessionId)
        
        if (!transport) {
          logger.info(`Creating new MCP session: ${sessionId}`)
          
          // Create new Streamable HTTP transport
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => sessionId
          })

          // Store transport
          this.transports.set(sessionId, transport)

          // Set up cleanup
          transport.onclose = () => {
            logger.info(`Transport closed for session ${sessionId}`)
            this.transports.delete(sessionId)
          }

          // Create new MCP server for this connection
          const server = new Server(
            {
              name: this.config.name || 'curupira-mcp-server',
              version: this.config.version || '1.0.0'
            },
            {
              capabilities: {
                resources: { list: true, read: true },
                tools: { list: true, call: true },
                prompts: { list: true, get: true },
                logging: {}
              }
            }
          )

          // Setup handlers and connect
          setupMCPHandlers(server)
          await server.connect(transport)
          
          logger.info(`MCP server connected for session: ${sessionId}`)
        }

        // Set session ID header in response
        reply.header('Mcp-Session-Id', sessionId)
        reply.header('Content-Type', 'application/json')

        // Handle the request with the transport
        if (transport instanceof StreamableHTTPServerTransport) {
          // For Streamable HTTP, we need to handle the request directly
          // since it expects Node.js raw request/response objects
          await transport.handleRequest(request.raw, reply.raw, body)
        } else {
          logger.error('Invalid transport type')
          return reply.code(500).send({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: 'Internal server error',
              data: 'Invalid transport type'
            },
            id: body.id || null
          })
        }

      } catch (error) {
        logger.error({ error }, 'Error handling MCP request')
        
        const body = request.body as any
        if (!reply.sent) {
          return reply.code(500).send({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: 'Internal server error',
              data: error instanceof Error ? error.message : 'Unknown error'
            },
            id: body?.id || null
          })
        }
      }
    })
  }

  private async setupSseTransport(): Promise<void> {
    const httpConfig = this.config.transports?.http || {}
    const ssePath = httpConfig.ssePath || '/mcp/sse'

    // SSE endpoint for establishing the stream
    this.fastify.get(ssePath, async (request, reply) => {
      logger.info({ 
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      }, 'SSE connection request')

      try {
        // Create a new SSE transport
        const transport = new SSEServerTransport('/mcp/messages', reply.raw, {
          enableDnsRebindingProtection: false // Allow all origins for development
        })

        // Store transport by session ID
        const sessionId = transport.sessionId
        this.transports.set(sessionId, transport)

        // Set up cleanup on close
        transport.onclose = () => {
          logger.info(`SSE transport closed for session ${sessionId}`)
          this.transports.delete(sessionId)
        }

        // Create a new MCP server instance for this connection
        const server = new Server(
          {
            name: this.config.name || 'curupira-mcp-server',
            version: this.config.version || '1.0.0'
          },
          {
            capabilities: {
              resources: { list: true, read: true },
              tools: { list: true, call: true },
              prompts: { list: true, get: true }
            }
          }
        )

        // Setup MCP handlers
        setupMCPHandlers(server)

        // Connect the transport
        await server.connect(transport)
        logger.info(`Established SSE stream with session ID: ${sessionId}`)

      } catch (error) {
        logger.error({ error }, 'Error establishing SSE stream')
        if (!reply.sent) {
          reply.code(500).send('Error establishing SSE stream')
        }
      }
    })

    // Messages endpoint for receiving client JSON-RPC requests  
    this.fastify.post('/mcp/messages', async (request, reply) => {
      logger.debug('Received POST to /mcp/messages')

      // Extract session ID from query parameter
      const sessionId = (request.query as any)?.sessionId
      if (!sessionId) {
        logger.error('No session ID provided')
        return reply.code(400).send({ error: 'Missing sessionId parameter' })
      }

      const transport = this.transports.get(sessionId)
      if (!transport || !(transport instanceof SSEServerTransport)) {
        logger.error(`No SSE transport found for session ${sessionId}`)
        return reply.code(404).send({ error: 'Session not found' })
      }

      try {
        // Handle the POST message
        await transport.handlePostMessage(request.raw, reply.raw, request.body)
      } catch (error) {
        logger.error({ error }, 'Error handling POST message')
        if (!reply.sent) {
          reply.code(500).send({ error: 'Error handling request' })
        }
      }
    })
  }

  private getEnabledTransports(): string[] {
    const enabled: string[] = []
    const transports = this.config.transports || {}

    if (transports.websocket?.enabled !== false) {
      enabled.push('websocket')
    }

    if (transports.http?.enabled) {
      if (transports.http.useModernTransport) {
        enabled.push('streamableHttp')
      } else {
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
      if (transports.http.useModernTransport) {
        info.streamableHttp = {
          endpoint: transports.http?.httpPath || '/mcp',
          description: 'Streamable HTTP transport (modern)',
          protocolVersion: '2025-03-26'
        }
      } else {
        info.sse = {
          endpoint: transports.http?.ssePath || '/mcp/sse',
          messagesEndpoint: '/mcp/messages',
          description: 'SSE transport (deprecated)',
          protocolVersion: '2024-11-05'
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