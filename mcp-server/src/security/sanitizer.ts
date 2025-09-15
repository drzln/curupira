/**
 * Data sanitization module
 * 
 * Removes sensitive information before sending to MCP clients
 */

import { logger } from '../config/logger.js'

export interface SanitizerConfig {
  enabled: boolean
  redactPatterns?: RegExp[]
  sensitiveKeys?: string[]
  maxDepth?: number
  maxStringLength?: number
  redactedPlaceholder?: string
}

export class DataSanitizer {
  private config: SanitizerConfig
  private defaultPatterns: RegExp[]
  private sensitiveKeysSet: Set<string>

  constructor(config: SanitizerConfig) {
    this.config = config
    
    // Default sensitive patterns
    this.defaultPatterns = [
      // API keys and tokens
      /[a-zA-Z0-9]{32,}/g, // Generic long tokens
      /sk-[a-zA-Z0-9]{48}/g, // OpenAI keys
      /ghp_[a-zA-Z0-9]{36}/g, // GitHub tokens
      /npm_[a-zA-Z0-9]{36}/g, // NPM tokens
      
      // Auth tokens
      /Bearer\s+[a-zA-Z0-9\-._~+/]+/gi,
      /Basic\s+[a-zA-Z0-9+/=]+/gi,
      
      // Passwords
      /password["\s]*[:=]["\s]*[^",}\s]+/gi,
      /pwd["\s]*[:=]["\s]*[^",}\s]+/gi,
      /passwd["\s]*[:=]["\s]*[^",}\s]+/gi,
      
      // Credit cards
      /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
      
      // SSN
      /\b\d{3}-\d{2}-\d{4}\b/g,
      
      // Email addresses (optional)
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      
      // JWT tokens
      /eyJ[a-zA-Z0-9\-_]+\.eyJ[a-zA-Z0-9\-_]+\.[a-zA-Z0-9\-_]+/g,
    ]

    // Default sensitive keys
    this.sensitiveKeysSet = new Set([
      'password',
      'pwd',
      'passwd',
      'secret',
      'token',
      'apiKey',
      'api_key',
      'apiSecret',
      'api_secret',
      'privateKey',
      'private_key',
      'clientSecret',
      'client_secret',
      'authToken',
      'auth_token',
      'accessToken',
      'access_token',
      'refreshToken',
      'refresh_token',
      'sessionId',
      'session_id',
      'cookie',
      'authorization',
      'x-api-key',
      'x-auth-token',
      ...(config.sensitiveKeys || []),
    ])
  }

  /**
   * Sanitize any data
   */
  sanitize(data: any, depth: number = 0): any {
    if (!this.config.enabled) {
      return data
    }

    // Check depth limit
    if (depth > (this.config.maxDepth || 10)) {
      return '[MAX_DEPTH_EXCEEDED]'
    }

    // Handle different types
    if (data === null || data === undefined) {
      return data
    }

    if (typeof data === 'string') {
      return this.sanitizeString(data)
    }

    if (typeof data === 'number' || typeof data === 'boolean') {
      return data
    }

    if (Array.isArray(data)) {
      return data.map(item => this.sanitize(item, depth + 1))
    }

    if (typeof data === 'object') {
      return this.sanitizeObject(data, depth + 1)
    }

    // Unknown type
    return '[UNKNOWN_TYPE]'
  }

  /**
   * Sanitize string values
   */
  private sanitizeString(str: string): string {
    let sanitized = str

    // Check length limit
    const maxLength = this.config.maxStringLength || 10000
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength) + '...[TRUNCATED]'
    }

    // Apply patterns
    const patterns = [
      ...this.defaultPatterns,
      ...(this.config.redactPatterns || []),
    ]

    for (const pattern of patterns) {
      sanitized = sanitized.replace(pattern, this.config.redactedPlaceholder || '[REDACTED]')
    }

    return sanitized
  }

  /**
   * Sanitize object values
   */
  private sanitizeObject(obj: any, depth: number): any {
    const sanitized: any = {}

    for (const [key, value] of Object.entries(obj)) {
      // Check if key is sensitive
      if (this.isSensitiveKey(key)) {
        sanitized[key] = this.config.redactedPlaceholder || '[REDACTED]'
        continue
      }

      // Recursively sanitize value
      sanitized[key] = this.sanitize(value, depth)
    }

    return sanitized
  }

  /**
   * Check if key is sensitive
   */
  private isSensitiveKey(key: string): boolean {
    const lowerKey = key.toLowerCase()
    
    // Check exact match
    if (this.sensitiveKeysSet.has(key) || this.sensitiveKeysSet.has(lowerKey)) {
      return true
    }

    // Check partial matches
    for (const sensitive of this.sensitiveKeysSet) {
      if (lowerKey.includes(sensitive.toLowerCase())) {
        return true
      }
    }

    return false
  }

  /**
   * Sanitize console logs
   */
  sanitizeConsoleLogs(logs: any[]): any[] {
    if (!this.config.enabled) {
      return logs
    }

    return logs.map(log => ({
      ...log,
      args: log.args?.map((arg: any) => this.sanitize(arg)) || [],
      stackTrace: log.stackTrace ? this.sanitizeStackTrace(log.stackTrace) : undefined,
    }))
  }

  /**
   * Sanitize stack traces
   */
  private sanitizeStackTrace(stack: string): string {
    if (!this.config.enabled) {
      return stack
    }

    // Remove file paths that might contain sensitive info
    return stack
      .replace(/\/Users\/[^/]+/g, '/Users/[USER]')
      .replace(/\/home\/[^/]+/g, '/home/[USER]')
      .replace(/C:\\Users\\[^\\]+/g, 'C:\\Users\\[USER]')
  }

  /**
   * Sanitize network requests
   */
  sanitizeNetworkRequests(requests: any[]): any[] {
    if (!this.config.enabled) {
      return requests
    }

    return requests.map(request => ({
      ...request,
      url: this.sanitizeUrl(request.url),
      headers: this.sanitizeHeaders(request.headers),
      postData: request.postData ? this.sanitize(request.postData) : undefined,
      response: request.response ? {
        ...request.response,
        headers: this.sanitizeHeaders(request.response.headers),
        body: request.response.body ? this.sanitize(request.response.body) : undefined,
      } : undefined,
    }))
  }

  /**
   * Sanitize URL
   */
  private sanitizeUrl(url: string): string {
    if (!url) return url

    try {
      const parsed = new URL(url)
      
      // Sanitize query parameters
      const params = new URLSearchParams(parsed.search)
      for (const [key, value] of params.entries()) {
        if (this.isSensitiveKey(key)) {
          params.set(key, '[REDACTED]')
        } else {
          params.set(key, this.sanitizeString(value))
        }
      }
      
      parsed.search = params.toString()
      return parsed.toString()
    } catch {
      // If URL parsing fails, sanitize as string
      return this.sanitizeString(url)
    }
  }

  /**
   * Sanitize headers
   */
  private sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
    if (!headers) return headers

    const sanitized: Record<string, string> = {}
    
    for (const [key, value] of Object.entries(headers)) {
      if (this.isSensitiveKey(key)) {
        sanitized[key] = '[REDACTED]'
      } else {
        sanitized[key] = this.sanitizeString(value)
      }
    }

    return sanitized
  }

  /**
   * Get sanitizer statistics
   */
  getStatistics() {
    return {
      enabled: this.config.enabled,
      patterns: this.defaultPatterns.length + (this.config.redactPatterns?.length || 0),
      sensitiveKeys: this.sensitiveKeysSet.size,
      maxDepth: this.config.maxDepth || 10,
      maxStringLength: this.config.maxStringLength || 10000,
    }
  }
}