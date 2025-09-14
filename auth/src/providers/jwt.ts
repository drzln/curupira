/**
 * @fileoverview JWT authentication provider
 */

import jwt from 'jsonwebtoken'
import { nanoid } from 'nanoid'
import { createLogger } from '@curupira/shared'
import type {
  User,
  AuthSession,
  JwtPayload,
  AuthConfig
} from '../types.js'

const logger = createLogger({ name: 'jwt-provider' })

/**
 * JWT provider for token management
 */
export class JwtProvider {
  constructor(private readonly config: AuthConfig['jwt']) {}

  /**
   * Generate access token
   */
  generateAccessToken(user: User, session: AuthSession): string {
    const payload: JwtPayload = {
      sub: user.id,
      sessionId: session.id,
      email: user.email,
      name: user.name,
      role: user.role,
      scopes: this.getUserScopes(user),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor((Date.now() + this.getExpiresInMs()) / 1000),
      iss: this.config.issuer,
      aud: this.config.audience
    }

    return jwt.sign(payload, this.config.secret, {
      algorithm: 'HS256'
    })
  }

  /**
   * Generate refresh token
   */
  generateRefreshToken(): string {
    return nanoid(64)
  }

  /**
   * Verify access token
   */
  verifyAccessToken(token: string): JwtPayload | null {
    try {
      const payload = jwt.verify(token, this.config.secret, {
        issuer: this.config.issuer,
        audience: this.config.audience,
        algorithms: ['HS256']
      }) as JwtPayload

      return payload
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        logger.debug('Token expired')
      } else if (error instanceof jwt.JsonWebTokenError) {
        logger.warn({ error: error.message }, 'Invalid token')
      } else {
        logger.error({ error }, 'Token verification failed')
      }
      return null
    }
  }

  /**
   * Decode token without verification (for debugging)
   */
  decodeToken(token: string): JwtPayload | null {
    try {
      return jwt.decode(token) as JwtPayload
    } catch {
      return null
    }
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(token: string): boolean {
    const payload = this.decodeToken(token)
    if (!payload) return true

    return payload.exp * 1000 < Date.now()
  }

  /**
   * Get token expiration time in milliseconds
   */
  private getExpiresInMs(): number {
    const expiresIn = this.config.expiresIn
    
    // Parse duration string (e.g., "15m", "1h", "7d")
    const match = expiresIn.match(/^(\d+)([smhd])$/)
    if (!match) {
      throw new Error(`Invalid expiresIn format: ${expiresIn}`)
    }

    const [, value, unit] = match
    const num = parseInt(value, 10)

    switch (unit) {
      case 's': return num * 1000
      case 'm': return num * 60 * 1000
      case 'h': return num * 60 * 60 * 1000
      case 'd': return num * 24 * 60 * 60 * 1000
      default: throw new Error(`Unknown time unit: ${unit}`)
    }
  }

  /**
   * Get user scopes based on role
   */
  private getUserScopes(user: User): string[] {
    const baseScopes = ['read:profile']

    switch (user.role) {
      case 'admin':
        return [
          ...baseScopes,
          'read:users',
          'write:users',
          'read:sessions',
          'write:sessions',
          'read:debug',
          'write:debug',
          'admin:system'
        ]
      case 'developer':
        return [
          ...baseScopes,
          'read:debug',
          'write:debug'
        ]
      case 'readonly':
        return [
          ...baseScopes,
          'read:debug'
        ]
      default:
        return baseScopes
    }
  }
}