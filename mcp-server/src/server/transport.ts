/**
 * Transport layer abstraction
 * 
 * Supports multiple transport mechanisms for MCP
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import Fastify, { FastifyRequest, FastifyReply } from 'fastify'
import fastifyCors from '@fastify/cors'
import type { ILogger } from '../core/interfaces/logger.interface.js'
import type { HealthChecker } from './health.js'
import type { SecurityManager } from '../security/index.js'

export type TransportType = 'stdio' | 'http' | 'sse'

export interface TransportOptions {
  type: TransportType
  port?: number
  corsOrigins?: string[]
  enableSSE?: boolean
  enableWS?: boolean
  healthChecker?: HealthChecker
  securityManager?: SecurityManager
}

export class TransportManager {
  private server: Server
  private options: TransportOptions
  private httpServer?: ReturnType<typeof Fastify>
  private logger: ILogger

  constructor(server: Server, options: TransportOptions, logger: ILogger) {
    this.server = server
    this.options = options
    this.logger = logger
  }

  /**
   * Start the appropriate transport
   */
  async start() {
    switch (this.options.type) {
      case 'stdio':
        return this.startStdio()
      
      case 'http':
      case 'sse':
        return this.startHttp()
      
      default:
        throw new Error(`Unknown transport type: ${this.options.type}`)
    }
  }

  /**
   * Start stdio transport
   */
  private async startStdio() {
    this.logger.info('Starting stdio transport')
    const transport = new StdioServerTransport()
    await this.server.connect(transport)
  }

  /**
   * Start HTTP/SSE transport
   */
  private async startHttp() {
    const port = this.options.port || 3000
    this.logger.info({ port, type: this.options.type }, 'Starting HTTP transport')

    this.httpServer = Fastify({
      logger: false, // We use our own logger
    })

    // Register CORS
    await this.httpServer.register(fastifyCors, {
      origin: this.options.corsOrigins || true,
      credentials: true,
    })

    // Apply security if configured
    if (this.options.securityManager) {
      await this.options.securityManager.applyToFastify(this.httpServer)
    }

    // Health check endpoint
    this.httpServer.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
      if (this.options.healthChecker) {
        const health = await this.options.healthChecker.check()
        const statusCode = health.status === 'healthy' ? 200 : 
                          health.status === 'degraded' ? 206 : 503
        reply.code(statusCode).send(health)
      } else {
        reply.send({ status: 'healthy', timestamp: new Date().toISOString() })
      }
    })

    // Metrics endpoint
    this.httpServer.get('/metrics', async (request: FastifyRequest, reply: FastifyReply) => {
      if (this.options.healthChecker) {
        const metrics = this.options.healthChecker.getMetrics()
        
        // Prometheus format
        const output = Object.entries(metrics)
          .map(([key, value]) => `curupira_${key} ${value}`)
          .join('\n')
        
        reply.type('text/plain').send(output)
      } else {
        reply.code(404).send({ error: 'Metrics not available' })
      }
    })

    // MCP endpoint
    if (this.options.type === 'sse') {
      this.httpServer.get('/mcp', async (request: FastifyRequest, reply: FastifyReply) => {
        this.logger.info({ ip: request.ip }, 'SSE connection established')
        
        // Set SSE headers
        reply.raw.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        })

        const transport = new SSEServerTransport('/mcp', reply.raw)
        await this.server.connect(transport)
      })
    } else if (this.options.type === 'http') {
      // HTTP Transport using StreamableHTTPServerTransport
      const transports = new Map<string, StreamableHTTPServerTransport>()
      
      this.httpServer.post('/mcp', async (request: FastifyRequest, reply: FastifyReply) => {
        this.logger.info({ method: 'POST', path: '/mcp' }, 'HTTP request for MCP')
        
        try {
          // Get or create session
          const sessionId = (request.headers['mcp-session-id'] as string) || 'default'
          let transport = transports.get(sessionId)
          
          if (!transport) {
            transport = new StreamableHTTPServerTransport({
              sessionIdGenerator: () => sessionId
            })
            transports.set(sessionId, transport)
            
            // Connect to MCP server
            await this.server.connect(transport)
            
            // Clean up on close
            transport.onclose = () => {
              this.logger.info(`Transport closed for session ${sessionId}`)
              transports.delete(sessionId)
            }
          }
          
          // Handle request with transport
          await transport.handleRequest(request.raw, reply.raw, request.body)
        } catch (error) {
          this.logger.error({ error }, 'Failed to handle HTTP transport')
          reply.code(500).send({ error: 'Internal server error' })
        }
      })
      
      // Also support SSE endpoint for HTTP transport
      this.httpServer.get('/mcp', async (request: FastifyRequest, reply: FastifyReply) => {
        reply.send({
          message: 'HTTP transport active',
          endpoint: 'POST /mcp',
          headers: {
            'Content-Type': 'application/json',
            'MCP-Session-Id': 'optional session identifier'
          }
        })
      })
    }

    // Documentation endpoint
    this.httpServer.get('/docs', async (request: FastifyRequest, reply: FastifyReply) => {
      reply.send({
        name: 'curupira-debug',
        version: '1.0.0',
        transport: this.options.type,
        endpoints: {
          health: '/health',
          metrics: '/metrics',
          mcp: this.options.type === 'sse' ? '/mcp' : undefined,
        },
        capabilities: {
          resources: ['list', 'read'],
          tools: ['list', 'call'],
          prompts: ['list', 'get'],
        },
      })
    })

    // Start server
    try {
      await this.httpServer.listen({ port, host: '0.0.0.0' })
      this.logger.info({ port }, 'HTTP server started')
    } catch (error) {
      this.logger.error({ error }, 'Failed to start HTTP server')
      throw error
    }
  }

  /**
   * Handle HTTP message
   */
  private async handleHttpMessage(message: unknown) {
    // This would integrate with the MCP server to handle HTTP POST messages
    // For now, return a placeholder
    const messageWithId = message as { id?: unknown }
    return {
      jsonrpc: '2.0',
      id: messageWithId.id,
      result: {
        error: 'HTTP POST not fully implemented',
      },
    }
  }

  /**
   * Stop the transport
   */
  async stop() {
    this.logger.info('Stopping transport')
    
    if (this.httpServer) {
      try {
        await this.httpServer.close()
        this.logger.info('HTTP server stopped')
      } catch (error) {
        this.logger.error({ error }, 'Error stopping HTTP server')
      }
    }
  }

  /**
   * Get transport information
   */
  getInfo() {
    return {
      type: this.options.type,
      port: this.options.port,
      corsOrigins: this.options.corsOrigins,
      endpoints: this.options.type === 'http' || this.options.type === 'sse' ? {
        health: '/health',
        metrics: '/metrics',
        docs: '/docs',
        mcp: this.options.type === 'sse' ? '/mcp' : undefined,
      } : undefined,
    }
  }
}