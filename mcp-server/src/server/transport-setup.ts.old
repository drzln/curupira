/**
 * MCP Transport Setup
 * Level 3 - Sets up WebSocket, SSE, and HTTP transports for MCP
 */

import type { FastifyInstance } from 'fastify'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import { randomUUID } from 'node:crypto'
import { WebSocketTransport } from '../transport/websocket.js'
import { setupMCPHandlers } from '../mcp/index.js'
import { logger } from '../config/logger.js'
import type { ServerConfig } from './config.js'

export async function setupMCPTransports(app: FastifyInstance, config: ServerConfig): Promise<void> {
  // WebSocket Transport
  if (config.mcp?.websocket?.enabled !== false) {
    const wsPath = config.mcp?.websocket?.path ?? '/mcp'
    
    app.register(async function wsRoute(fastify) {
      fastify.get(wsPath, { websocket: true }, (socket, request) => {
        logger.info('WebSocket connection established for MCP')
        
        const sessionId = randomUUID()
        const server = new Server({
          name: config.name ?? 'curupira-mcp-server',
          version: config.version ?? '1.0.0'
        }, {
          capabilities: {
            resources: { subscribe: false },
            tools: {},
            prompts: {}
          }
        })
        
        setupMCPHandlers(server)
        
        const transport = new WebSocketTransport(socket as unknown as import('ws').WebSocket)
        
        server.connect(transport)
        logger.info(`MCP WebSocket session started: ${sessionId}`)
        
        socket.on('close', () => {
          logger.info(`MCP WebSocket session ended: ${sessionId}`)
        })
      })
    })
    
    logger.info(`MCP WebSocket endpoint registered at ${wsPath}`)
  }

  // SSE Transport
  if (config.mcp?.http?.sseEnabled !== false && !config.mcp?.http?.useModernTransport) {
    const ssePath = config.mcp?.http?.ssePath ?? '/mcp/sse'
    
    app.get(ssePath, async (request, reply) => {
      logger.info('SSE connection established for MCP')
      
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      })
      
      const server = new Server({
        name: config.name ?? 'curupira-mcp-server',
        version: config.version ?? '1.0.0'
      }, {
        capabilities: {
          resources: { subscribe: false },
          tools: {},
          prompts: {}
        }
      })
      
      setupMCPHandlers(server)
      
      const transport = new SSEServerTransport('/', reply.raw)
      await server.connect(transport)
      
      request.raw.on('close', () => {
        logger.info('SSE connection closed')
      })
    })
    
    logger.info(`MCP SSE endpoint registered at ${ssePath}`)
  }

  // HTTP Transport - simplified for now
  if (config.mcp?.http?.enabled !== false) {
    const httpPath = config.mcp?.http?.httpPath ?? '/mcp/messages'
    
    app.post(httpPath, async (request, reply) => {
      logger.info('HTTP request received for MCP')
      
      // For now, just return a message that HTTP transport is not fully implemented
      return reply.code(501).send({
        error: 'HTTP transport not fully implemented',
        message: 'Please use WebSocket or SSE transport'
      })
    })
    
    logger.info(`MCP HTTP endpoint registered at ${httpPath} (placeholder)`)
  }
}