/**
 * Server Routes Setup
 * Level 3 - Sets up health checks and basic routes
 */

import type { FastifyInstance } from 'fastify'
import { logger } from '../config/logger.js'
import type { ServerConfig } from './config.js'

export async function setupRoutes(app: FastifyInstance, config: ServerConfig): Promise<void> {
  // Health check endpoint
  if (config.healthCheck !== false) {
    const healthPath = config.healthCheckPath ?? '/health'
    
    app.get(healthPath, async (request, reply) => {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: config.name ?? 'curupira-mcp-server',
        version: config.version ?? '1.0.0',
        environment: config.environment ?? 'development',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        transports: {
          websocket: config.mcp?.websocket?.enabled ?? true,
          http: config.mcp?.http?.enabled ?? true,
          sse: config.mcp?.http?.sseEnabled ?? true
        }
      }
      
      return reply.code(200).send(health)
    })
    
    logger.info(`Health check endpoint registered at ${healthPath}`)
  }

  // Root endpoint
  app.get('/', async (request, reply) => {
    return reply.code(200).send({
      name: config.name ?? 'curupira-mcp-server',
      version: config.version ?? '1.0.0',
      description: 'Curupira MCP Server - AI-powered debugging for React applications',
      endpoints: {
        health: config.healthCheckPath ?? '/health',
        mcp: {
          websocket: config.mcp?.websocket?.enabled ? (config.mcp?.websocket?.path ?? '/mcp') : null,
          http: config.mcp?.http?.enabled ? (config.mcp?.http?.httpPath ?? '/mcp/messages') : null,
          sse: config.mcp?.http?.sseEnabled ? (config.mcp?.http?.ssePath ?? '/mcp/sse') : null
        }
      }
    })
  })

  // Favicon (to prevent 404s)
  app.get('/favicon.ico', async (request, reply) => {
    return reply.code(204).send()
  })

  logger.info('Basic routes registered')
}