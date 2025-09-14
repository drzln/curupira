/**
 * @fileoverview CORS middleware
 * 
 * This file provides CORS handling for HTTP transports.
 */

import type { CorsConfig, CorsHeaders, CorsValidation } from './types.js'
import { DEFAULT_CORS_CONFIG } from './types.js'

/**
 * CORS handler for HTTP requests
 */
export class CorsHandler {
  private readonly config: CorsConfig

  constructor(config: Partial<CorsConfig> = {}) {
    this.config = { ...DEFAULT_CORS_CONFIG, ...config }
  }

  /**
   * Validate origin and create headers
   */
  async validate(origin: string | undefined, method: string): Promise<CorsValidation> {
    const headers: CorsHeaders = {}

    // Always vary on origin
    headers['Vary'] = 'Origin'

    // No origin (same-origin request)
    if (!origin) {
      return { allowed: true, headers }
    }

    // Check if origin is allowed
    const allowed = await this.isOriginAllowed(origin)
    if (!allowed) {
      return {
        allowed: false,
        headers,
        reason: `Origin ${origin} is not allowed`
      }
    }

    // Set CORS headers
    headers['Access-Control-Allow-Origin'] = origin
    
    if (this.config.credentials) {
      headers['Access-Control-Allow-Credentials'] = 'true'
    }

    // Preflight request
    if (method === 'OPTIONS') {
      headers['Access-Control-Allow-Methods'] = this.config.methods.join(', ')
      headers['Access-Control-Allow-Headers'] = this.config.allowedHeaders.join(', ')
      headers['Access-Control-Max-Age'] = String(this.config.maxAge)
    }

    // Expose headers for actual requests
    if (this.config.exposedHeaders.length > 0) {
      headers['Access-Control-Expose-Headers'] = this.config.exposedHeaders.join(', ')
    }

    return { allowed: true, headers }
  }

  /**
   * Check if origin is allowed
   */
  private async isOriginAllowed(origin: string): Promise<boolean> {
    // Custom validation function
    if (this.config.validateOrigin) {
      return this.config.validateOrigin(origin)
    }

    // Allow all origins
    if (this.config.origins === '*') {
      return true
    }

    // Check exact match
    if (this.config.origins.includes(origin)) {
      return true
    }

    // Check patterns (e.g., chrome-extension://*)
    for (const pattern of this.config.origins) {
      if (pattern.includes('*')) {
        const regex = new RegExp(
          '^' + pattern.replace(/\*/g, '.*').replace(/\//g, '\\/') + '$'
        )
        if (regex.test(origin)) {
          return true
        }
      }
    }

    return false
  }

  /**
   * Handle preflight request
   */
  async handlePreflight(origin: string | undefined): Promise<CorsValidation> {
    return this.validate(origin, 'OPTIONS')
  }

  /**
   * Get allowed methods
   */
  getAllowedMethods(): string[] {
    return [...this.config.methods]
  }

  /**
   * Get allowed headers
   */
  getAllowedHeaders(): string[] {
    return [...this.config.allowedHeaders]
  }
}

/**
 * Create CORS handler
 */
export function createCorsHandler(config?: Partial<CorsConfig>): CorsHandler {
  return new CorsHandler(config)
}

/**
 * Express/Connect-style CORS middleware
 */
export function corsMiddleware(config?: Partial<CorsConfig>) {
  const handler = createCorsHandler(config)

  return async (req: any, res: any, next: any) => {
    const origin = req.headers.origin || req.headers.referer
    const validation = await handler.validate(origin, req.method)

    // Set CORS headers
    for (const [key, value] of Object.entries(validation.headers)) {
      res.setHeader(key, value)
    }

    // Handle preflight
    if (req.method === 'OPTIONS') {
      res.statusCode = validation.allowed ? 204 : 403
      res.end()
      return
    }

    // Reject if not allowed
    if (!validation.allowed) {
      res.statusCode = 403
      res.end(validation.reason || 'CORS policy violation')
      return
    }

    next()
  }
}