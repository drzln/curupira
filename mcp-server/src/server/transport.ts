/**
 * Transport layer abstraction
 * 
 * Supports multiple transport mechanisms for MCP
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import Fastify, { FastifyRequest, FastifyReply } from 'fastify'
import fastifyCors from '@fastify/cors'
import { logger } from '../config/logger.js'
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

  constructor(server: Server, options: TransportOptions) {
    this.server = server
    this.options = options
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
    logger.info('Starting stdio transport')
    const transport = new StdioServerTransport()
    await this.server.connect(transport)
  }

  /**
   * Start HTTP/SSE transport
   */
  private async startHttp() {
    const port = this.options.port || 3000
    logger.info({ port, type: this.options.type }, 'Starting HTTP transport')

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
        logger.info({ ip: request.ip }, 'SSE connection established')
        
        // Set SSE headers
        reply.raw.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        })

        const transport = new SSEServerTransport('/mcp', reply.raw)
        await this.server.connect(transport)
      })

      this.httpServer.post('/mcp', async (request: FastifyRequest, reply: FastifyReply) => {
        // Handle HTTP POST for MCP messages
        try {
          const result = await this.handleHttpMessage(request.body)
          reply.send(result)
        } catch (error) {
          logger.error({ error }, 'Failed to handle HTTP message')
          reply.code(500).send({ error: 'Internal server error' })
        }
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
      logger.info({ port }, 'HTTP server started')
    } catch (error) {
      logger.error({ error }, 'Failed to start HTTP server')
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
    logger.info('Stopping transport')
    
    if (this.httpServer) {
      try {
        await this.httpServer.close()
        logger.info('HTTP server stopped')
      } catch (error) {
        logger.error({ error }, 'Error stopping HTTP server')
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