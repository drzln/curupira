/**
 * @fileoverview Security headers
 * 
 * This file provides security header configurations and middleware.
 */

import crypto from 'crypto'

/**
 * Security headers configuration
 */
export interface SecurityHeadersConfig {
  /** Content Security Policy */
  contentSecurityPolicy?: string | false
  /** X-Content-Type-Options */
  contentTypeOptions?: string | false
  /** X-Frame-Options */
  frameOptions?: string | false
  /** X-XSS-Protection */
  xssProtection?: string | false
  /** Strict-Transport-Security */
  hsts?: {
    maxAge: number
    includeSubDomains?: boolean
    preload?: boolean
  } | false
  /** Referrer-Policy */
  referrerPolicy?: string | false
  /** Permissions-Policy */
  permissionsPolicy?: string | false
}

/**
 * Default security headers
 */
export const DEFAULT_SECURITY_HEADERS: SecurityHeadersConfig = {
  contentSecurityPolicy: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' ws: wss:;",
  contentTypeOptions: 'nosniff',
  frameOptions: 'DENY',
  xssProtection: '1; mode=block',
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  referrerPolicy: 'strict-origin-when-cross-origin',
  permissionsPolicy: 'camera=(), microphone=(), geolocation=()'
}

/**
 * Development security headers (more permissive)
 */
export const DEVELOPMENT_SECURITY_HEADERS: SecurityHeadersConfig = {
  contentSecurityPolicy: false, // Disable CSP in development
  contentTypeOptions: 'nosniff',
  frameOptions: 'SAMEORIGIN',
  xssProtection: '1; mode=block',
  hsts: false, // Disable HSTS for localhost
  referrerPolicy: 'no-referrer-when-downgrade',
  permissionsPolicy: false
}

/**
 * Create security headers
 */
export function createSecurityHeaders(
  config: SecurityHeadersConfig = DEFAULT_SECURITY_HEADERS
): Record<string, string> {
  const headers: Record<string, string> = {}

  // Content-Security-Policy
  if (config.contentSecurityPolicy !== false) {
    headers['Content-Security-Policy'] = config.contentSecurityPolicy!
  }

  // X-Content-Type-Options
  if (config.contentTypeOptions !== false) {
    headers['X-Content-Type-Options'] = config.contentTypeOptions!
  }

  // X-Frame-Options
  if (config.frameOptions !== false) {
    headers['X-Frame-Options'] = config.frameOptions!
  }

  // X-XSS-Protection
  if (config.xssProtection !== false) {
    headers['X-XSS-Protection'] = config.xssProtection!
  }

  // Strict-Transport-Security
  if (config.hsts !== false && config.hsts) {
    let hstsValue = `max-age=${config.hsts.maxAge}`
    if (config.hsts.includeSubDomains) {
      hstsValue += '; includeSubDomains'
    }
    if (config.hsts.preload) {
      hstsValue += '; preload'
    }
    headers['Strict-Transport-Security'] = hstsValue
  }

  // Referrer-Policy
  if (config.referrerPolicy !== false) {
    headers['Referrer-Policy'] = config.referrerPolicy!
  }

  // Permissions-Policy
  if (config.permissionsPolicy !== false) {
    headers['Permissions-Policy'] = config.permissionsPolicy!
  }

  return headers
}

/**
 * Express/Connect-style security headers middleware
 */
export function securityHeadersMiddleware(
  config?: SecurityHeadersConfig
) {
  const headers = createSecurityHeaders(
    config || (process.env.NODE_ENV === 'production' 
      ? DEFAULT_SECURITY_HEADERS 
      : DEVELOPMENT_SECURITY_HEADERS)
  )

  return (req: any, res: any, next: any) => {
    // Set security headers
    for (const [key, value] of Object.entries(headers)) {
      res.setHeader(key, value)
    }

    // Remove potentially dangerous headers
    res.removeHeader('X-Powered-By')
    res.removeHeader('Server')

    next()
  }
}

/**
 * Create nonce for CSP
 */
export function generateNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString('base64')
}

/**
 * Create CSP with nonce
 */
export function createCspWithNonce(nonce: string): string {
  return `default-src 'self'; script-src 'self' 'nonce-${nonce}'; style-src 'self' 'nonce-${nonce}'; img-src 'self' data: https:; connect-src 'self' ws: wss:;`
}