/**
 * @fileoverview Authentication middleware
 * 
 * This file provides middleware for JWT authentication in the protocol layer.
 */

import type { ProtocolMiddleware, RequestContext } from '../../protocol/types.js'
import type { AuthConfig, AuthContext } from './types.js'
import { JwtManager, parseAuthHeader, hasPermission } from './jwt.js'
import { SecurityErrors } from '../../errors/index.js'
import { createRequestId } from '../../types/index.js'

/**
 * Authentication middleware configuration
 */
export interface AuthMiddlewareConfig extends AuthConfig {
  /** Paths that don't require authentication */
  publicPaths?: string[]
  /** Custom permission checker */
  checkPermission?: (
    context: AuthContext,
    method: string
  ) => boolean | Promise<boolean>
}

/**
 * Create authentication middleware
 */
export function createAuthMiddleware(
  config: AuthMiddlewareConfig
): ProtocolMiddleware {
  const jwtManager = new JwtManager(config)
  const publicPaths = new Set(config.publicPaths || [
    'initialize',
    'initialized',
    'shutdown',
    'exit'
  ])

  return {
    name: 'auth',

    async handleRequest(request, context, next) {
      // Skip auth for public paths
      if (publicPaths.has(request.method)) {
        return next()
      }

      // Extract token from context metadata
      const authHeader = context.metadata?.authorization as string
      if (!authHeader) {
        throw SecurityErrors.unauthorized('Missing authorization header')
      }

      const token = parseAuthHeader(authHeader)
      if (!token) {
        throw SecurityErrors.unauthorized('Invalid authorization header format')
      }

      // Validate token
      const validation = await jwtManager.validateToken(token)
      if (!validation.valid || !validation.payload) {
        throw SecurityErrors.unauthorized(
          validation.message || 'Invalid token'
        )
      }

      // Extract user
      const user = jwtManager.extractUser(validation.payload)

      // Create auth context
      const authContext: AuthContext = {
        user,
        requestId: createRequestId(Date.now().toString()),
        authenticatedAt: Date.now(),
        token
      }

      // Add auth context to request context
      Object.assign(context, { auth: authContext })

      // Check permissions if custom checker provided
      if (config.checkPermission) {
        const hasAccess = await config.checkPermission(authContext, request.method)
        if (!hasAccess) {
          throw SecurityErrors.forbidden(
            `Insufficient permissions for method: ${request.method}`
          )
        }
      }

      // Continue with authenticated request
      return next()
    }
  }
}

/**
 * Create authorization middleware for specific permissions
 */
export function createAuthorizationMiddleware(
  requiredPermissions: Record<string, { resource: string; action: string }>
): ProtocolMiddleware {
  return {
    name: 'authorization',

    async handleRequest(request, context, next) {
      // Get auth context
      const authContext = (context as any).auth as AuthContext | undefined
      if (!authContext) {
        // Let auth middleware handle this
        return next()
      }

      // Check if method requires specific permission
      const permission = requiredPermissions[request.method]
      if (permission) {
        const hasAccess = hasPermission(
          authContext.user,
          permission.resource,
          permission.action
        )

        if (!hasAccess) {
          throw SecurityErrors.forbidden(
            `Insufficient permissions: requires ${permission.resource}:${permission.action}`
          )
        }
      }

      return next()
    }
  }
}

/**
 * Default MCP method permissions
 */
export const DEFAULT_MCP_PERMISSIONS: Record<
  string,
  { resource: string; action: string }
> = {
  // Resources
  'resources/list': { resource: 'debug', action: 'read' },
  'resources/read': { resource: 'debug', action: 'read' },
  
  // Tools
  'tools/list': { resource: 'tools', action: 'read' },
  'tools/call': { resource: 'tools', action: 'execute' },
  
  // Prompts
  'prompts/list': { resource: 'prompts', action: 'read' },
  'prompts/get': { resource: 'prompts', action: 'read' },
  
  // State manipulation
  'state/read': { resource: 'state', action: 'read' },
  'state/write': { resource: 'state', action: 'write' },
  
  // Debugging
  'debug/break': { resource: 'debug', action: 'write' },
  'debug/continue': { resource: 'debug', action: 'write' },
  'debug/step': { resource: 'debug', action: 'write' },
  
  // Logging
  'logging/setLevel': { resource: 'logging', action: 'write' }
}