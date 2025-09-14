/**
 * @fileoverview JWT token management
 * 
 * This file provides JWT token creation, validation, and refresh functionality.
 */

import jwt from 'jsonwebtoken'
import type {
  JwtPayload,
  AuthConfig,
  AuthResult,
  AuthUser,
  TokenValidation,
  AuthErrorCode
} from './types.js'
import {
  createUserId,
  createSessionId,
  type UserId,
  type SessionId
} from '../../types/index.js'
import { SecurityErrors } from '../../errors/index.js'

/**
 * JWT token manager
 */
export class JwtManager {
  constructor(private readonly config: AuthConfig) {}

  /**
   * Create authentication tokens
   */
  async createTokens(
    userId: UserId,
    sessionId: SessionId,
    roles: string[] = [],
    claims?: Record<string, unknown>
  ): Promise<AuthResult> {
    const now = Math.floor(Date.now() / 1000)

    // Create access token
    const accessPayload: JwtPayload = {
      sub: userId,
      sessionId,
      iat: now,
      exp: now + this.config.accessTokenTTL,
      type: 'access',
      roles,
      claims
    }

    const accessToken = jwt.sign(accessPayload, this.config.secret, {
      algorithm: this.config.algorithm,
      issuer: this.config.issuer,
      audience: this.config.audience
    })

    // Create refresh token if enabled
    let refreshToken: string | undefined
    if (this.config.enableRefresh) {
      const refreshPayload: JwtPayload = {
        sub: userId,
        sessionId,
        iat: now,
        exp: now + this.config.refreshTokenTTL,
        type: 'refresh'
      }

      refreshToken = jwt.sign(refreshPayload, this.config.secret, {
        algorithm: this.config.algorithm,
        issuer: this.config.issuer,
        audience: this.config.audience
      })
    }

    // Create user object
    const user: AuthUser = {
      id: userId,
      sessionId,
      roles,
      permissions: this.calculatePermissions(roles),
      metadata: claims
    }

    return {
      accessToken,
      refreshToken,
      expiresIn: this.config.accessTokenTTL,
      tokenType: 'Bearer',
      user
    }
  }

  /**
   * Validate a token
   */
  async validateToken(token: string): Promise<TokenValidation> {
    try {
      const payload = jwt.verify(token, this.config.secret, {
        algorithms: [this.config.algorithm],
        issuer: this.config.issuer,
        audience: this.config.audience
      }) as JwtPayload

      return {
        valid: true,
        payload
      }
    } catch (error: unknown) {
      if (error instanceof jwt.TokenExpiredError) {
        return {
          valid: false,
          error: 'TOKEN_EXPIRED' as AuthErrorCode,
          message: 'Token has expired'
        }
      }

      if (error instanceof jwt.JsonWebTokenError) {
        return {
          valid: false,
          error: 'INVALID_TOKEN' as AuthErrorCode,
          message: error.message
        }
      }

      return {
        valid: false,
        error: 'INVALID_TOKEN' as AuthErrorCode,
        message: 'Token validation failed'
      }
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<AuthResult> {
    if (!this.config.enableRefresh) {
      throw SecurityErrors.unauthorized('Token refresh is not enabled')
    }

    const validation = await this.validateToken(refreshToken)
    if (!validation.valid || !validation.payload) {
      throw SecurityErrors.unauthorized(
        validation.message || 'Invalid refresh token'
      )
    }

    if (validation.payload.type !== 'refresh') {
      throw SecurityErrors.unauthorized('Token is not a refresh token')
    }

    // Create new tokens with same user info
    return this.createTokens(
      validation.payload.sub,
      validation.payload.sessionId,
      validation.payload.roles || [],
      validation.payload.claims
    )
  }

  /**
   * Extract user from validated token
   */
  extractUser(payload: JwtPayload): AuthUser {
    return {
      id: payload.sub,
      sessionId: payload.sessionId,
      roles: payload.roles || [],
      permissions: this.calculatePermissions(payload.roles || []),
      metadata: payload.claims
    }
  }

  /**
   * Calculate permissions from roles
   */
  private calculatePermissions(roles: string[]): string[] {
    // Default role-based permissions
    const rolePermissions: Record<string, string[]> = {
      admin: ['*'],
      developer: [
        'debug:read',
        'debug:write',
        'state:read',
        'state:write',
        'tools:execute'
      ],
      viewer: ['debug:read', 'state:read']
    }

    const permissions = new Set<string>()

    for (const role of roles) {
      const perms = rolePermissions[role] || []
      for (const perm of perms) {
        permissions.add(perm)
      }
    }

    return Array.from(permissions)
  }
}

/**
 * Create JWT manager instance
 */
export function createJwtManager(config: AuthConfig): JwtManager {
  return new JwtManager(config)
}

/**
 * Parse authorization header
 */
export function parseAuthHeader(header: string): string | null {
  const parts = header.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null
  }
  return parts[1]
}

/**
 * Check if user has permission
 */
export function hasPermission(
  user: AuthUser,
  resource: string,
  action: string
): boolean {
  const permission = `${resource}:${action}`
  
  // Check wildcard permission
  if (user.permissions.includes('*')) {
    return true
  }

  // Check specific permission
  if (user.permissions.includes(permission)) {
    return true
  }

  // Check resource wildcard
  if (user.permissions.includes(`${resource}:*`)) {
    return true
  }

  return false
}