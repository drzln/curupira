/**
 * Authentication module
 * 
 * Handles JWT authentication for staging/production environments
 */

import * as jwt from 'jsonwebtoken'
import type { FastifyRequest, FastifyReply } from 'fastify'
import { logger } from '../config/logger.js'
import { z } from 'zod'

// JWT payload schema
const jwtPayloadSchema = z.object({
  sub: z.string(), // Subject (user ID)
  iat: z.number(), // Issued at
  exp: z.number(), // Expiration
  aud: z.string().optional(), // Audience
  iss: z.string().optional(), // Issuer
  scope: z.array(z.string()).optional(), // Permissions
})

export type JWTPayload = z.infer<typeof jwtPayloadSchema>

export interface AuthConfig {
  enabled: boolean
  jwtSecret?: string
  jwtPublicKey?: string
  issuer?: string
  audience?: string
  expiresIn?: string
  algorithms?: jwt.Algorithm[]
}

export class AuthManager {
  private config: AuthConfig
  private verifyOptions: jwt.VerifyOptions

  constructor(config: AuthConfig) {
    this.config = config
    this.verifyOptions = {
      algorithms: config.algorithms || ['HS256', 'RS256'],
      issuer: config.issuer,
      audience: config.audience,
    }
  }

  /**
   * Verify JWT token
   */
  async verifyToken(token: string): Promise<JWTPayload> {
    if (!this.config.enabled) {
      throw new Error('Authentication is not enabled')
    }

    const secret = this.config.jwtPublicKey || this.config.jwtSecret
    if (!secret) {
      throw new Error('No JWT secret or public key configured')
    }

    try {
      const decoded = jwt.verify(token, secret, this.verifyOptions)
      const payload = jwtPayloadSchema.parse(decoded)
      
      // Check expiration
      if (payload.exp && payload.exp < Date.now() / 1000) {
        throw new Error('Token expired')
      }

      return payload
    } catch (error) {
      logger.error({ error }, 'JWT verification failed')
      throw new Error('Invalid token')
    }
  }

  /**
   * Extract token from request
   */
  extractToken(request: FastifyRequest): string | null {
    // Check Authorization header
    const authHeader = request.headers.authorization
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7)
    }

    // Check query parameter (for SSE connections)
    const query = request.query as Record<string, string>
    if (query.token) {
      return query.token
    }

    // Check cookie
    const cookies = (request as any).cookies
    if (cookies?.token) {
      return cookies.token
    }

    return null
  }

  /**
   * Fastify authentication hook
   */
  async authenticate(request: FastifyRequest, reply: FastifyReply) {
    if (!this.config.enabled) {
      // Authentication disabled, allow all requests
      return
    }

    try {
      const token = this.extractToken(request)
      if (!token) {
        reply.code(401).send({ error: 'No authentication token provided' })
        return
      }

      const payload = await this.verifyToken(token)
      
      // Attach user info to request
      const req = request as any
      req.user = {
        id: payload.sub,
        scope: payload.scope || [],
      }

      logger.debug({ userId: payload.sub }, 'Request authenticated')
    } catch (error) {
      logger.warn({ error }, 'Authentication failed')
      reply.code(401).send({ error: 'Authentication failed' })
    }
  }

  /**
   * Check if user has required scope
   */
  hasScope(request: FastifyRequest, requiredScope: string): boolean {
    const req = request as any
    const user = req.user
    if (!user || !user.scope) {
      return false
    }

    return user.scope.includes(requiredScope) || user.scope.includes('*')
  }

  /**
   * Generate a token (for testing)
   */
  generateToken(payload: Partial<JWTPayload>): string {
    if (!this.config.jwtSecret) {
      throw new Error('No JWT secret configured')
    }

    const fullPayload: JWTPayload = {
      sub: payload.sub || 'test-user',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
      iss: this.config.issuer,
      aud: this.config.audience,
      scope: payload.scope || ['read', 'write'],
    }

    return jwt.sign(fullPayload, this.config.jwtSecret, {
      algorithm: 'HS256',
    })
  }

  /**
   * Middleware for optional authentication
   */
  async optionalAuth(request: FastifyRequest, reply: FastifyReply) {
    if (!this.config.enabled) {
      return
    }

    try {
      const token = this.extractToken(request)
      if (token) {
        const payload = await this.verifyToken(token)
        const req = request as any
        req.user = {
          id: payload.sub,
          scope: payload.scope || [],
        }
      }
    } catch (error) {
      // Ignore errors for optional auth
      logger.debug({ error }, 'Optional authentication failed')
    }
  }
}