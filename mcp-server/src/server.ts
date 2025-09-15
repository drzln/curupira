import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import helmet from '@fastify/helmet'
import websocket from '@fastify/websocket'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import type { FastifyInstance } from 'fastify'

import { config } from './config/index.js'
import { logger } from './config/logger.js'
import { setupMCPHandlers } from './mcp/index.js'
import { WebSocketTransport } from './transport/websocket.js'
import { HttpSseTransport } from './transport/http-sse.js'

export class CurupiraServer {
  private fastify: FastifyInstance
  private mcpServer: Server
  private httpSseTransport: HttpSseTransport | null = null
  private isRunning = false

  constructor() {
    this.fastify = Fastify({
      logger: logger as any,
      trustProxy: true,
    })

    this.mcpServer = new Server({
      name: 'curupira',
      version: '1.0.0',
      capabilities: {
        resources: true,
        tools: true,
        prompts: true,
      },
    })
  }

  async start() {
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

      // Setup WebSocket handler for MCP
      this.setupWebSocket()

      // Start server
      const address = await this.fastify.listen({
        port: config.port,
        host: config.host,
      })

      this.isRunning = true
      logger.info({ address }, 'Curupira MCP Server started')

    } catch (error) {
      logger.error({ error }, 'Failed to start server')
      throw error
    }
  }

  async stop() {
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

  private async registerPlugins() {
    // CORS
    await this.fastify.register(cors, {
      origin: config.cors.origins,
      credentials: true,
    })

    // Security headers
    await this.fastify.register(helmet, {
      contentSecurityPolicy: false, // WebSocket compatibility
    })

    // Rate limiting
    await this.fastify.register(rateLimit, {
      max: config.rateLimit.max,
      timeWindow: config.rateLimit.window,
    })

    // WebSocket support
    await this.fastify.register(websocket, {
      options: {
        maxPayload: 1048576, // 1MB
      },
    })
  }

  private setupRoutes() {
    // Health check
    this.fastify.get('/health', async () => ({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    }))

    // Readiness check
    this.fastify.get('/ready', async () => ({
      ready: this.isRunning,
      timestamp: new Date().toISOString(),
    }))

    // Server info
    this.fastify.get('/info', async () => ({
      name: 'curupira',
      version: '1.0.0',
      protocol: 'mcp',
      capabilities: {
        resources: true,
        tools: true,
        prompts: true,
      },
      transports: {
        websocket: {
          endpoint: '/mcp',
          description: 'WebSocket transport for Chrome extension'
        },
        http: {
          endpoint: '/mcp',
          method: 'POST',
          description: 'HTTP transport for Claude Code'
        },
        sse: {
          endpoint: '/mcp/sse',
          method: 'GET',
          description: 'Server-Sent Events for Claude Code responses'
        }
      }
    }))

    // HTTP/SSE endpoints for Claude Code
    this.setupHttpEndpoints()
  }

  private setupHttpEndpoints() {
    // Initialize HTTP/SSE transport for Claude Code
    if (!this.httpSseTransport) {
      this.httpSseTransport = new HttpSseTransport()
      
      // Connect the transport to MCP server
      this.mcpServer.connect(this.httpSseTransport).catch((error) => {
        logger.error({ error }, 'Failed to connect HTTP/SSE transport to MCP server')
      })
    }

    // HTTP endpoint for MCP messages (used by Claude Code)
    this.fastify.post('/mcp', async (request, reply) => {
      try {
        const message = request.body as any
        logger.debug({ method: message.method }, 'Received HTTP MCP request')

        // Handle the message through the transport
        if (this.httpSseTransport) {
          this.httpSseTransport.handleHttpRequest(message)
        }
        
        // For HTTP transport, we acknowledge receipt immediately
        return reply
          .code(200)
          .header('Content-Type', 'application/json')
          .send({ status: 'accepted' })
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

    // SSE endpoint for server-sent events (used by Claude Code)
    this.fastify.get('/mcp/sse', async (request, reply) => {
      logger.info('SSE connection established')
      
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'X-Accel-Buffering': 'no' // Disable Nginx buffering
      })

      // Send initial connection event
      reply.raw.write('event: connected\ndata: {"connected": true}\n\n')

      // Set the SSE reply in transport
      if (this.httpSseTransport) {
        this.httpSseTransport.setSseReply(reply)
      }

      // Keep connection alive
      const keepAlive = setInterval(() => {
        reply.raw.write(':ping\n\n')
      }, 30000)

      // Handle client disconnect
      request.raw.on('close', () => {
        clearInterval(keepAlive)
        logger.info('SSE connection closed')
        
        // Clear the SSE reply in transport
        if (this.httpSseTransport) {
          this.httpSseTransport.setSseReply(null as any)
        }
      })
    })
  }

  private setupWebSocket() {
    this.fastify.register(async (fastify) => {
      fastify.get('/mcp', { websocket: true }, (socket, request) => {
        logger.info({ ip: request.ip }, 'WebSocket connection established')

        const transport = new WebSocketTransport(socket as any)
        
        // Connect MCP server to transport
        this.mcpServer.connect(transport).catch((error) => {
          logger.error({ error }, 'Failed to connect MCP server')
          // Close the socket if available
          if ('close' in socket && typeof socket.close === 'function') {
            socket.close()
          } else if ('end' in socket && typeof socket.end === 'function') {
            (socket as any).end()
          }
        })

        socket.on('error', (error) => {
          logger.error({ error }, 'WebSocket error')
        })

        socket.on('close', () => {
          logger.info('WebSocket connection closed')
        })
      })
    })
  }
}