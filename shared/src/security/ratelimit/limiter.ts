/**
 * @fileoverview Rate limiter implementation
 * 
 * This file provides in-memory and distributed rate limiting.
 */

import type {
  RateLimitConfig,
  RateLimitContext,
  RateLimitInfo,
  RateLimitStore,
  RateLimitStoreResult,
  RateLimitHeaders
} from './types.js'
import { DEFAULT_RATE_LIMITS } from './types.js'
import { SecurityErrors } from '../../errors/index.js'

/**
 * In-memory rate limit store
 */
export class MemoryRateLimitStore implements RateLimitStore {
  private counters = new Map<string, { count: number; resetTime: Date }>()
  private cleanupInterval: NodeJS.Timeout

  constructor(cleanupIntervalMs = 60000) {
    // Periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.clean()
    }, cleanupIntervalMs)
  }

  async increment(key: string): Promise<RateLimitStoreResult> {
    const now = new Date()
    const existing = this.counters.get(key)

    if (!existing || existing.resetTime <= now) {
      // New window
      const resetTime = new Date(now.getTime() + 900000) // 15 minutes default
      this.counters.set(key, { count: 1, resetTime })
      return { count: 1, resetTime }
    }

    // Increment existing
    existing.count++
    return { count: existing.count, resetTime: existing.resetTime }
  }

  async decrement(key: string): Promise<void> {
    const existing = this.counters.get(key)
    if (existing && existing.count > 0) {
      existing.count--
    }
  }

  async reset(key: string): Promise<void> {
    this.counters.delete(key)
  }

  async clean(): Promise<void> {
    const now = new Date()
    for (const [key, value] of this.counters.entries()) {
      if (value.resetTime <= now) {
        this.counters.delete(key)
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval)
    this.counters.clear()
  }
}

/**
 * Rate limiter
 */
export class RateLimiter {
  private readonly config: Required<RateLimitConfig>
  private readonly store: RateLimitStore

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = {
      ...DEFAULT_RATE_LIMITS.standard,
      ...config,
      keyGenerator: config.keyGenerator || this.defaultKeyGenerator,
      skip: config.skip || (() => false)
    } as Required<RateLimitConfig>

    this.store = this.config.store || new MemoryRateLimitStore()
  }

  /**
   * Check rate limit
   */
  async check(context: RateLimitContext): Promise<RateLimitInfo> {
    // Check if should skip
    if (await this.config.skip(context)) {
      return {
        limit: this.config.max,
        remaining: this.config.max,
        reset: new Date(Date.now() + this.config.windowMs)
      }
    }

    // Generate key
    const key = this.config.keyGenerator(context)

    // Increment counter
    const result = await this.store.increment(key)

    // Calculate remaining
    const remaining = Math.max(0, this.config.max - result.count)
    const limited = result.count > this.config.max

    const info: RateLimitInfo = {
      limit: this.config.max,
      remaining,
      reset: result.resetTime
    }

    if (limited) {
      info.retryAfter = Math.ceil(
        (result.resetTime.getTime() - Date.now()) / 1000
      )
    }

    return info
  }

  /**
   * Create rate limit headers
   */
  createHeaders(info: RateLimitInfo): RateLimitHeaders {
    const headers: RateLimitHeaders = {}

    if (this.config.headers) {
      headers['X-RateLimit-Limit'] = String(info.limit)
      headers['X-RateLimit-Remaining'] = String(info.remaining)
      headers['X-RateLimit-Reset'] = String(
        Math.floor(info.reset.getTime() / 1000)
      )

      if (info.retryAfter) {
        headers['Retry-After'] = String(info.retryAfter)
      }
    }

    if (this.config.draft) {
      // IETF draft spec headers
      headers['RateLimit'] = `limit=${info.limit}, remaining=${info.remaining}, reset=${Math.floor(
        info.reset.getTime() / 1000
      )}`
      
      headers['RateLimit-Policy'] = `${info.limit};w=${Math.floor(
        this.config.windowMs / 1000
      )}`
    }

    return headers
  }

  /**
   * Default key generator
   */
  private defaultKeyGenerator(context: RateLimitContext): string {
    // Prefer user ID, then session ID, then IP
    if (context.userId) {
      return `user:${context.userId}`
    }
    if (context.sessionId) {
      return `session:${context.sessionId}`
    }
    if (context.ip) {
      return `ip:${context.ip}`
    }
    return 'global'
  }

  /**
   * Reset rate limit for context
   */
  async reset(context: RateLimitContext): Promise<void> {
    const key = this.config.keyGenerator(context)
    await this.store.reset(key)
  }
}

/**
 * Create rate limiter
 */
export function createRateLimiter(
  config?: Partial<RateLimitConfig>
): RateLimiter {
  return new RateLimiter(config)
}

/**
 * Create rate limiters for different tiers
 */
export function createTieredRateLimiters() {
  return {
    standard: createRateLimiter(DEFAULT_RATE_LIMITS.standard),
    strict: createRateLimiter(DEFAULT_RATE_LIMITS.strict),
    websocket: createRateLimiter(DEFAULT_RATE_LIMITS.websocket)
  }
}