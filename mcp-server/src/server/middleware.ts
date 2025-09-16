/**
 * Server Middleware Setup
 * Level 2 - Depends on config types and Fastify
 */

import type { FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import helmet from '@fastify/helmet'
import websocket from '@fastify/websocket'
import { logger } from '../config/logger.js'
import type { ServerConfig } from './config.js'

export async function setupMiddleware(app: FastifyInstance, config: ServerConfig): Promise<void> {
  // CORS
  if (config.cors?.enabled !== false) {
    await app.register(cors, {
      origin: config.cors?.origin ?? true,
      credentials: config.cors?.credentials ?? true,
      methods: config.cors?.methods,
      allowedHeaders: config.cors?.allowedHeaders,
      exposedHeaders: config.cors?.exposedHeaders,
      maxAge: config.cors?.maxAge
    })
    logger.info('CORS middleware registered')
  }

  // Rate Limiting
  if (config.rateLimit?.enabled !== false) {
    await app.register(rateLimit, {
      max: config.rateLimit?.max ?? 100,
      timeWindow: config.rateLimit?.timeWindow ?? '1 minute',
      cache: config.rateLimit?.cache
    })
    logger.info('Rate limiting middleware registered')
  }

  // Helmet (Security Headers)
  if (config.helmet?.enabled !== false) {
    await app.register(helmet, {
      contentSecurityPolicy: config.helmet?.contentSecurityPolicy,
      crossOriginEmbedderPolicy: config.helmet?.crossOriginEmbedderPolicy,
      crossOriginOpenerPolicy: config.helmet?.crossOriginOpenerPolicy,
      crossOriginResourcePolicy: config.helmet?.crossOriginResourcePolicy,
      dnsPrefetchControl: config.helmet?.dnsPrefetchControl,
      frameguard: config.helmet?.frameguard,
      hidePoweredBy: config.helmet?.hidePoweredBy,
      hsts: config.helmet?.hsts,
      ieNoOpen: config.helmet?.ieNoOpen,
      noSniff: config.helmet?.noSniff,
      originAgentCluster: config.helmet?.originAgentCluster,
      permittedCrossDomainPolicies: config.helmet?.permittedCrossDomainPolicies,
      referrerPolicy: config.helmet?.referrerPolicy,
      xssFilter: config.helmet?.xssFilter
    })
    logger.info('Helmet security headers registered')
  }

  // WebSocket Support (always register for MCP)
  await app.register(websocket, {
    options: {
      maxPayload: 1048576, // 1MB
      perMessageDeflate: true
    }
  })
  logger.info('WebSocket support registered')
}