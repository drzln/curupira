/**
 * @fileoverview Rate limiting types
 * 
 * This file defines types for rate limiting functionality.
 */

import type { UserId, SessionId } from '../../types/index.js'

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** Window size in milliseconds */
  windowMs: number
  /** Maximum requests per window */
  max: number
  /** Key generator function */
  keyGenerator?: (context: RateLimitContext) => string
  /** Skip function */
  skip?: (context: RateLimitContext) => boolean | Promise<boolean>
  /** Headers to set */
  headers: boolean
  /** Draft spec headers */
  draft: boolean
  /** Error message */
  message: string
  /** Status code */
  statusCode: number
  /** Store interface */
  store?: RateLimitStore
}

/**
 * Rate limit context
 */
export interface RateLimitContext {
  /** User ID if authenticated */
  userId?: UserId
  /** Session ID */
  sessionId?: SessionId
  /** IP address */
  ip?: string
  /** Request method */
  method: string
  /** Request path */
  path?: string
  /** Custom metadata */
  metadata?: Record<string, unknown>
}

/**
 * Rate limit info
 */
export interface RateLimitInfo {
  /** Total requests allowed */
  limit: number
  /** Requests remaining */
  remaining: number
  /** Window reset time */
  reset: Date
  /** Retry after (seconds) if limited */
  retryAfter?: number
}

/**
 * Rate limit store interface
 */
export interface RateLimitStore {
  /** Increment counter for key */
  increment(key: string): Promise<RateLimitStoreResult>
  /** Decrement counter for key */
  decrement(key: string): Promise<void>
  /** Reset counter for key */
  reset(key: string): Promise<void>
  /** Clean expired entries */
  clean(): Promise<void>
}

/**
 * Rate limit store result
 */
export interface RateLimitStoreResult {
  /** Current count */
  count: number
  /** Reset time */
  resetTime: Date
}

/**
 * Default rate limit configurations
 */
export const DEFAULT_RATE_LIMITS = {
  // Standard API rate limit
  standard: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: 'Too many requests, please try again later',
    statusCode: 429,
    headers: true,
    draft: false
  } as RateLimitConfig,

  // Strict rate limit for sensitive operations
  strict: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: 'Rate limit exceeded for sensitive operation',
    statusCode: 429,
    headers: true,
    draft: false
  } as RateLimitConfig,

  // WebSocket connection limit
  websocket: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    message: 'Too many WebSocket connections',
    statusCode: 429,
    headers: true,
    draft: false
  } as RateLimitConfig
}

/**
 * Rate limit headers
 */
export interface RateLimitHeaders {
  'X-RateLimit-Limit'?: string
  'X-RateLimit-Remaining'?: string
  'X-RateLimit-Reset'?: string
  'Retry-After'?: string
  'RateLimit'?: string
  'RateLimit-Policy'?: string
}