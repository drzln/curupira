/**
 * @fileoverview Rate limiting middleware
 * 
 * This file provides rate limiting middleware for protocol and HTTP layers.
 */

import type { ProtocolMiddleware } from '../../protocol/types.js'
import type { RateLimitConfig, RateLimitContext } from './types.js'
import { RateLimiter } from './limiter.js'
import { SecurityErrors } from '../../errors/index.js'

/**
 * Create rate limit middleware for protocol layer
 */
export function createRateLimitMiddleware(
  config?: Partial<RateLimitConfig>
): ProtocolMiddleware {
  const limiter = new RateLimiter(config)

  return {
    name: 'rateLimit',

    async handleRequest(request, context, next) {
      // Build rate limit context
      const rateLimitContext: RateLimitContext = {
        userId: (context as any).auth?.user?.id,
        sessionId: context.sessionId,
        method: request.method,
        metadata: context.metadata
      }

      // Check rate limit
      const info = await limiter.check(rateLimitContext)

      // Add rate limit info to context
      Object.assign(context, { rateLimit: info })

      // Reject if limited
      if (info.remaining === 0) {
        throw SecurityErrors.tooManyRequests(
          `Rate limit exceeded. Retry after ${info.retryAfter} seconds`,
          {
            limit: info.limit,
            reset: info.reset,
            retryAfter: info.retryAfter
          }
        )
      }

      return next()
    }
  }
}

/**
 * Create method-specific rate limiters
 */
export function createMethodRateLimiters(
  limits: Record<string, Partial<RateLimitConfig>>
): ProtocolMiddleware {
  const limiters = new Map<string, RateLimiter>()

  // Create limiter for each method
  for (const [method, config] of Object.entries(limits)) {
    limiters.set(method, new RateLimiter(config))
  }

  return {
    name: 'methodRateLimit',

    async handleRequest(request, context, next) {
      // Get limiter for method
      const limiter = limiters.get(request.method)
      if (!limiter) {
        // No limit for this method
        return next()
      }

      // Build rate limit context
      const rateLimitContext: RateLimitContext = {
        userId: (context as any).auth?.user?.id,
        sessionId: context.sessionId,
        method: request.method,
        metadata: context.metadata
      }

      // Check rate limit
      const info = await limiter.check(rateLimitContext)

      // Add rate limit info to context
      Object.assign(context, { [`rateLimit:${request.method}`]: info })

      // Reject if limited
      if (info.remaining === 0) {
        throw SecurityErrors.tooManyRequests(
          `Rate limit exceeded for ${request.method}. Retry after ${info.retryAfter} seconds`,
          {
            limit: info.limit,
            reset: info.reset,
            retryAfter: info.retryAfter
          }
        )
      }

      return next()
    }
  }
}

/**
 * Express/Connect-style rate limit middleware
 */
export function rateLimitMiddleware(config?: Partial<RateLimitConfig>) {
  const limiter = new RateLimiter(config)

  return async (req: any, res: any, next: any) => {
    // Build context from request
    const context: RateLimitContext = {
      userId: req.user?.id,
      sessionId: req.sessionId,
      ip: req.ip || req.connection?.remoteAddress,
      method: req.method,
      path: req.path,
      metadata: {
        userAgent: req.headers['user-agent'],
        origin: req.headers.origin
      }
    }

    try {
      // Check rate limit
      const info = await limiter.check(context)

      // Set headers
      const headers = limiter.createHeaders(info)
      for (const [key, value] of Object.entries(headers)) {
        res.setHeader(key, value)
      }

      // Reject if limited
      if (info.remaining === 0) {
        res.statusCode = 429
        res.end(JSON.stringify({
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Retry after ${info.retryAfter} seconds`,
          retryAfter: info.retryAfter
        }))
        return
      }

      // Store info for later use
      req.rateLimit = info

      next()
    } catch (error) {
      next(error)
    }
  }
}

/**
 * Default method rate limits for MCP
 */
export const DEFAULT_METHOD_LIMITS: Record<string, Partial<RateLimitConfig>> = {
  // Resource operations
  'resources/list': { max: 100, windowMs: 60000 }, // 100 per minute
  'resources/read': { max: 200, windowMs: 60000 }, // 200 per minute
  
  // Tool operations (more restrictive)
  'tools/list': { max: 50, windowMs: 60000 }, // 50 per minute
  'tools/call': { max: 20, windowMs: 60000 }, // 20 per minute
  
  // State modifications (very restrictive)
  'state/write': { max: 10, windowMs: 60000 }, // 10 per minute
  'debug/break': { max: 5, windowMs: 60000 }, // 5 per minute
  
  // Logging (moderate)
  'logging/setLevel': { max: 10, windowMs: 300000 } // 10 per 5 minutes
}