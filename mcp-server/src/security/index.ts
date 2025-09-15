/**
 * Security module index
 * 
 * Aggregates all security components
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { AuthManager, type AuthConfig } from './auth.js'
import { CommandWhitelist, type WhitelistConfig } from './whitelist.js'
import { DataSanitizer, type SanitizerConfig } from './sanitizer.js'
import { AuditLogger, type AuditConfig } from './audit.js'
import { RateLimiter, type RateLimitConfig } from './rate-limit.js'
import { logger } from '../config/logger.js'

export interface SecurityConfig {
  enabled: boolean
  environment: 'development' | 'staging' | 'production'
  auth?: AuthConfig
  whitelist?: WhitelistConfig
  sanitizer?: SanitizerConfig
  audit?: AuditConfig
  rateLimit?: RateLimitConfig
}

export class SecurityManager {
  private config: SecurityConfig
  private auth: AuthManager
  private whitelist: CommandWhitelist
  private sanitizer: DataSanitizer
  private audit: AuditLogger
  private rateLimiter: RateLimiter

  constructor(config: SecurityConfig) {
    this.config = config

    // Initialize components with defaults based on environment
    this.auth = new AuthManager(this.getAuthConfig())
    this.whitelist = new CommandWhitelist(this.getWhitelistConfig())
    this.sanitizer = new DataSanitizer(this.getSanitizerConfig())
    this.audit = new AuditLogger(this.getAuditConfig())
    this.rateLimiter = new RateLimiter(this.getRateLimitConfig())
  }

  /**
   * Apply security to Fastify instance
   */
  async applyToFastify(fastify: FastifyInstance) {
    if (!this.config.enabled) {
      logger.warn('Security is disabled')
      return
    }

    // Apply rate limiting
    await this.rateLimiter.apply(fastify)

    // Add authentication hook for protected routes
    fastify.addHook('onRequest', async (request, reply) => {
      // Skip auth for health/metrics endpoints
      if (request.url === '/health' || request.url === '/metrics' || request.url === '/docs') {
        return
      }

      // Apply authentication
      if (this.auth && this.config.auth?.enabled) {
        await this.auth.authenticate(request, reply)
      }
    })

    // Add security headers
    fastify.addHook('onSend', async (request, reply) => {
      reply.header('X-Content-Type-Options', 'nosniff')
      reply.header('X-Frame-Options', 'DENY')
      reply.header('X-XSS-Protection', '1; mode=block')
      reply.header('Referrer-Policy', 'no-referrer')
      
      if (this.config.environment === 'production') {
        reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
      }
    })

    logger.info({ environment: this.config.environment }, 'Security applied to Fastify')
  }

  /**
   * Check if CDP method is allowed
   */
  isCDPMethodAllowed(method: string, params?: any): boolean {
    if (!this.config.enabled || !this.config.whitelist?.enabled) {
      return true
    }

    const allowed = this.whitelist.isCDPMethodAllowed(method)
    
    if (!allowed) {
      this.audit.logSecurityBlock(
        {} as FastifyRequest,
        'CDP method not allowed',
        { method }
      )
    }

    return allowed
  }

  /**
   * Check if tool is allowed
   */
  isToolAllowed(toolName: string, request?: FastifyRequest): boolean {
    if (!this.config.enabled || !this.config.whitelist?.enabled) {
      return true
    }

    const allowed = this.whitelist.isToolAllowed(toolName)
    
    if (!allowed && request) {
      this.audit.logSecurityBlock(
        request,
        'Tool not allowed',
        { toolName }
      )
    }

    return allowed
  }

  /**
   * Check if resource is allowed
   */
  isResourceAllowed(uri: string, request?: FastifyRequest): boolean {
    if (!this.config.enabled || !this.config.whitelist?.enabled) {
      return true
    }

    const allowed = this.whitelist.isResourceAllowed(uri)
    
    if (!allowed && request) {
      this.audit.logSecurityBlock(
        request,
        'Resource not allowed',
        { uri }
      )
    }

    return allowed
  }

  /**
   * Sanitize data before sending
   */
  sanitizeData(data: any): any {
    if (!this.config.enabled || !this.config.sanitizer?.enabled) {
      return data
    }

    return this.sanitizer.sanitize(data)
  }

  /**
   * Sanitize CDP parameters
   */
  sanitizeCDPParams(method: string, params: any): any {
    if (!this.config.enabled || !this.config.whitelist?.enabled) {
      return params
    }

    return this.whitelist.sanitizeCDPParams(method, params)
  }

  /**
   * Get security components
   */
  getComponents() {
    return {
      auth: this.auth,
      whitelist: this.whitelist,
      sanitizer: this.sanitizer,
      audit: this.audit,
      rateLimiter: this.rateLimiter,
    }
  }

  /**
   * Get auth config with defaults
   */
  private getAuthConfig(): AuthConfig {
    const defaults: AuthConfig = {
      enabled: this.config.environment !== 'development',
      algorithms: ['HS256', 'RS256'],
    }

    return { ...defaults, ...this.config.auth }
  }

  /**
   * Get whitelist config with defaults
   */
  private getWhitelistConfig(): WhitelistConfig {
    const defaults = this.config.environment === 'production'
      ? CommandWhitelist.getProductionDefaults()
      : { enabled: false }

    return { ...defaults, ...this.config.whitelist }
  }

  /**
   * Get sanitizer config with defaults
   */
  private getSanitizerConfig(): SanitizerConfig {
    const defaults: SanitizerConfig = {
      enabled: this.config.environment !== 'development',
      maxDepth: 10,
      maxStringLength: 10000,
      redactedPlaceholder: '[REDACTED]',
    }

    return { ...defaults, ...this.config.sanitizer }
  }

  /**
   * Get audit config with defaults
   */
  private getAuditConfig(): AuditConfig {
    const defaults: AuditConfig = {
      enabled: true,
      includeRequestBody: this.config.environment === 'development',
      includeResponseBody: false,
    }

    return { ...defaults, ...this.config.audit }
  }

  /**
   * Get rate limit config with defaults
   */
  private getRateLimitConfig(): RateLimitConfig {
    const defaults = this.config.environment === 'production'
      ? RateLimiter.getProductionDefaults()
      : RateLimiter.getDevelopmentDefaults()

    return { ...defaults, ...this.config.rateLimit }
  }

  /**
   * Get security statistics
   */
  getStatistics() {
    return {
      enabled: this.config.enabled,
      environment: this.config.environment,
      auth: {
        enabled: this.config.auth?.enabled || false,
      },
      whitelist: this.whitelist.getStatistics(),
      sanitizer: this.sanitizer.getStatistics(),
      audit: this.audit.getStatistics(),
    }
  }
}

// Re-export all security components
export { AuthManager, type AuthConfig } from './auth.js'
export { CommandWhitelist, type WhitelistConfig } from './whitelist.js'
export { DataSanitizer, type SanitizerConfig } from './sanitizer.js'
export { AuditLogger, type AuditConfig, type AuditEvent, type AuditEventType } from './audit.js'
export { RateLimiter, type RateLimitConfig } from './rate-limit.js'