/**
 * Rate limiting module
 * 
 * Prevents abuse through request throttling
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import fastifyRateLimit from '@fastify/rate-limit'
import { logger } from '../config/logger.js'

export interface RateLimitConfig {
  enabled: boolean
  global?: {
    max: number
    timeWindow: string | number
  }
  endpoints?: {
    [path: string]: {
      max: number
      timeWindow: string | number
    }
  }
  skipAuth?: boolean
  skipIPs?: string[]
  errorMessage?: string
  keyGenerator?: (req: FastifyRequest) => string
}

export class RateLimiter {
  private config: RateLimitConfig

  constructor(config: RateLimitConfig) {
    this.config = config
  }

  /**
   * Apply rate limiting to Fastify instance
   */
  async apply(fastify: FastifyInstance) {
    if (!this.config.enabled) {
      return
    }

    // Global rate limit
    if (this.config.global) {
      await fastify.register(fastifyRateLimit, {
        max: this.config.global.max,
        timeWindow: this.config.global.timeWindow,
        keyGenerator: this.getKeyGenerator(),
        addHeaders: {
          'x-ratelimit-limit': true,
          'x-ratelimit-remaining': true,
          'x-ratelimit-reset': true,
          'retry-after': true,
        },
        errorResponseBuilder: (req, context) => {
          logger.warn({
            ip: req.ip,
            path: req.url,
            limit: context.max,
            current: (context as any).current,
          }, 'Rate limit exceeded')

          return {
            error: this.config.errorMessage || 'Too many requests',
            message: `Rate limit exceeded. Try again in ${context.ttl}ms`,
            retryAfter: context.ttl,
          }
        },
      })
    }

    // Endpoint-specific rate limits
    if (this.config.endpoints) {
      for (const [path, limits] of Object.entries(this.config.endpoints)) {
        await fastify.register(
          async (instance) => {
            await instance.register(fastifyRateLimit, {
              max: limits.max,
              timeWindow: limits.timeWindow,
              keyGenerator: this.getKeyGenerator()
            })
          },
          { prefix: path }
        )
      }
    }
  }

  /**
   * Get key generator function
   */
  private getKeyGenerator() {
    if (this.config.keyGenerator) {
      return this.config.keyGenerator
    }

    return (req: FastifyRequest) => {
      // Skip rate limiting for certain IPs
      if (this.config.skipIPs?.includes(req.ip)) {
        return `skip-${req.ip}`
      }

      // Skip for authenticated users if configured
      if (this.config.skipAuth && (req as any).user) {
        return `auth-${(req as any).user.id}`
      }

      // Default to IP-based rate limiting
      return req.ip
    }
  }

  /**
   * Create a manual rate limiter for non-HTTP contexts
   */
  createManualLimiter(max: number, windowMs: number) {
    const requests = new Map<string, number[]>()

    return {
      check: (key: string): boolean => {
        const now = Date.now()
        const timestamps = requests.get(key) || []
        
        // Remove old timestamps
        const valid = timestamps.filter(t => now - t < windowMs)
        
        if (valid.length >= max) {
          requests.set(key, valid)
          return false
        }

        valid.push(now)
        requests.set(key, valid)
        return true
      },

      reset: (key: string) => {
        requests.delete(key)
      },

      resetAll: () => {
        requests.clear()
      },

      getStatus: (key: string) => {
        const now = Date.now()
        const timestamps = requests.get(key) || []
        const valid = timestamps.filter(t => now - t < windowMs)
        
        return {
          current: valid.length,
          limit: max,
          remaining: Math.max(0, max - valid.length),
          resetTime: valid.length > 0 ? valid[0] + windowMs : now + windowMs,
        }
      },
    }
  }

  /**
   * Get default production configuration
   */
  static getProductionDefaults(): RateLimitConfig {
    return {
      enabled: true,
      global: {
        max: 100, // 100 requests
        timeWindow: '1 minute', // per minute
      },
      endpoints: {
        '/mcp': {
          max: 1000, // Higher limit for MCP connections
          timeWindow: '1 minute',
        },
        '/health': {
          max: 10,
          timeWindow: '1 minute',
        },
        '/metrics': {
          max: 10,
          timeWindow: '1 minute',
        },
      },
      skipAuth: true, // Authenticated users get higher limits
      errorMessage: 'Rate limit exceeded. Please try again later.',
    }
  }

  /**
   * Get development configuration (more lenient)
   */
  static getDevelopmentDefaults(): RateLimitConfig {
    return {
      enabled: true,
      global: {
        max: 1000,
        timeWindow: '1 minute',
      },
      skipIPs: ['127.0.0.1', '::1'], // Skip localhost
    }
  }
}