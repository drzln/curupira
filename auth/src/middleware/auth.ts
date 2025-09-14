/**
 * @fileoverview Authentication middleware
 */

import type { Request, Response, NextFunction } from 'express'
import { createLogger } from '@curupira/shared'
import { JwtProvider } from '../providers/jwt.js'
import { UserRepository } from '../repositories/user.js'
import { SessionRepository } from '../repositories/session.js'
import type {
  AuthConfig,
  AuthMiddlewareContext,
  UserRole
} from '../types.js'

const logger = createLogger({ name: 'auth-middleware' })

/**
 * Extended Express Request with auth context
 */
export interface AuthenticatedRequest extends Request {
  auth: AuthMiddlewareContext
}

/**
 * Authentication middleware
 */
export class AuthMiddleware {
  private readonly jwtProvider: JwtProvider
  private readonly userRepo: UserRepository
  private readonly sessionRepo: SessionRepository

  constructor(
    private readonly config: AuthConfig,
    userRepo: UserRepository,
    sessionRepo: SessionRepository
  ) {
    this.jwtProvider = new JwtProvider(config.jwt)
    this.userRepo = userRepo
    this.sessionRepo = sessionRepo
  }

  /**
   * Optional authentication - sets auth context if token present
   */
  optional() {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const authReq = req as AuthenticatedRequest
      authReq.auth = {
        authenticated: false,
        permissions: []
      }

      const token = this.extractToken(req)
      if (!token) {
        return next()
      }

      try {
        const context = await this.authenticateToken(token)
        if (context) {
          authReq.auth = context
        }
      } catch (error) {
        logger.debug({ error }, 'Optional authentication failed')
      }

      next()
    }
  }

  /**
   * Required authentication - rejects requests without valid token
   */
  required() {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const authReq = req as AuthenticatedRequest
      const token = this.extractToken(req)

      if (!token) {
        return this.unauthorized(res, 'No authentication token provided')
      }

      try {
        const context = await this.authenticateToken(token)
        if (!context) {
          return this.unauthorized(res, 'Invalid authentication token')
        }

        authReq.auth = context
        next()
      } catch (error) {
        logger.warn({ error, token: token.substring(0, 10) }, 'Authentication failed')
        return this.unauthorized(res, 'Authentication failed')
      }
    }
  }

  /**
   * Role-based authorization
   */
  requireRole(role: UserRole) {
    return (req: Request, res: Response, next: NextFunction): void => {
      const authReq = req as AuthenticatedRequest
      
      if (!authReq.auth?.authenticated) {
        return this.unauthorized(res, 'Authentication required')
      }

      if (!authReq.auth.user || authReq.auth.user.role !== role) {
        return this.forbidden(res, `Role '${role}' required`)
      }

      next()
    }
  }

  /**
   * Permission-based authorization
   */
  requirePermission(permission: string) {
    return (req: Request, res: Response, next: NextFunction): void => {
      const authReq = req as AuthenticatedRequest
      
      if (!authReq.auth?.authenticated) {
        return this.unauthorized(res, 'Authentication required')
      }

      if (!authReq.auth.permissions.includes(permission)) {
        return this.forbidden(res, `Permission '${permission}' required`)
      }

      next()
    }
  }

  /**
   * Multiple permissions authorization (OR logic)
   */
  requireAnyPermission(permissions: string[]) {
    return (req: Request, res: Response, next: NextFunction): void => {
      const authReq = req as AuthenticatedRequest
      
      if (!authReq.auth?.authenticated) {
        return this.unauthorized(res, 'Authentication required')
      }

      const hasPermission = permissions.some(permission => 
        authReq.auth.permissions.includes(permission)
      )

      if (!hasPermission) {
        return this.forbidden(res, `One of these permissions required: ${permissions.join(', ')}`)
      }

      next()
    }
  }

  /**
   * Multiple permissions authorization (AND logic)
   */
  requireAllPermissions(permissions: string[]) {
    return (req: Request, res: Response, next: NextFunction): void => {
      const authReq = req as AuthenticatedRequest
      
      if (!authReq.auth?.authenticated) {
        return this.unauthorized(res, 'Authentication required')
      }

      const hasAllPermissions = permissions.every(permission => 
        authReq.auth.permissions.includes(permission)
      )

      if (!hasAllPermissions) {
        return this.forbidden(res, `All these permissions required: ${permissions.join(', ')}`)
      }

      next()
    }
  }

  /**
   * Extract token from request
   */
  private extractToken(req: Request): string | null {
    // Check Authorization header
    const authHeader = req.headers.authorization
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7)
    }

    // Check cookie (for web UI)
    if (req.cookies?.['auth-token']) {
      return req.cookies['auth-token']
    }

    // Check query parameter (for WebSocket upgrade)
    if (req.query.token && typeof req.query.token === 'string') {
      return req.query.token
    }

    return null
  }

  /**
   * Authenticate token and build context
   */
  private async authenticateToken(token: string): Promise<AuthMiddlewareContext | null> {
    // Verify JWT
    const payload = this.jwtProvider.verifyAccessToken(token)
    if (!payload) {
      return null
    }

    // Get user
    const user = await this.userRepo.findById(payload.sub)
    if (!user || !user.active) {
      return null
    }

    // Get session
    const session = await this.sessionRepo.findById(payload.sessionId)
    if (!session || !session.active || session.userId !== user.id) {
      return null
    }

    // Update session last access
    await this.sessionRepo.updateLastAccess(session.id)

    return {
      user,
      session,
      authenticated: true,
      permissions: payload.scopes
    }
  }

  /**
   * Send unauthorized response
   */
  private unauthorized(res: Response, message: string): void {
    res.status(401).json({
      error: 'Unauthorized',
      message,
      timestamp: new Date().toISOString()
    })
  }

  /**
   * Send forbidden response
   */
  private forbidden(res: Response, message: string): void {
    res.status(403).json({
      error: 'Forbidden',
      message,
      timestamp: new Date().toISOString()
    })
  }
}