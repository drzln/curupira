/**
 * @fileoverview CORS types
 * 
 * This file defines types for Cross-Origin Resource Sharing configuration.
 */

/**
 * CORS configuration
 */
export interface CorsConfig {
  /** Allowed origins */
  origins: string[] | '*'
  /** Allowed methods */
  methods: string[]
  /** Allowed headers */
  allowedHeaders: string[]
  /** Exposed headers */
  exposedHeaders: string[]
  /** Allow credentials */
  credentials: boolean
  /** Max age for preflight cache (seconds) */
  maxAge: number
  /** Origin validation function */
  validateOrigin?: (origin: string) => boolean | Promise<boolean>
}

/**
 * CORS headers
 */
export interface CorsHeaders {
  'Access-Control-Allow-Origin'?: string
  'Access-Control-Allow-Methods'?: string
  'Access-Control-Allow-Headers'?: string
  'Access-Control-Expose-Headers'?: string
  'Access-Control-Allow-Credentials'?: string
  'Access-Control-Max-Age'?: string
  'Vary'?: string
}

/**
 * Default CORS configuration
 */
export const DEFAULT_CORS_CONFIG: CorsConfig = {
  origins: ['http://localhost:3000', 'chrome-extension://*'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-Session-ID',
    'X-Request-ID'
  ],
  exposedHeaders: [
    'X-Request-ID',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset'
  ],
  credentials: true,
  maxAge: 86400 // 24 hours
}

/**
 * CORS validation result
 */
export interface CorsValidation {
  /** Is origin allowed */
  allowed: boolean
  /** Headers to set */
  headers: CorsHeaders
  /** Reason if not allowed */
  reason?: string
}