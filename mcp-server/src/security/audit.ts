/**
 * Audit logging module
 * 
 * Tracks all security-relevant actions
 */

import { logger } from '../config/logger.js'
import type { FastifyRequest } from 'fastify'

export interface AuditEvent {
  timestamp: string
  eventType: AuditEventType
  userId?: string
  ip?: string
  userAgent?: string
  action: string
  resource?: string
  result: 'success' | 'failure' | 'blocked'
  details?: Record<string, any>
  error?: string
}

export type AuditEventType = 
  | 'auth.login'
  | 'auth.logout'
  | 'auth.failed'
  | 'resource.read'
  | 'tool.execute'
  | 'cdp.command'
  | 'security.blocked'
  | 'rate.limited'
  | 'error.internal'

export interface AuditConfig {
  enabled: boolean
  logToFile?: boolean
  filePath?: string
  maxFileSize?: number
  maxFiles?: number
  includeRequestBody?: boolean
  includeResponseBody?: boolean
  sensitiveFields?: string[]
}

export class AuditLogger {
  private config: AuditConfig
  private buffer: AuditEvent[] = []
  private bufferSize = 1000

  constructor(config: AuditConfig) {
    this.config = config
  }

  /**
   * Log an audit event
   */
  log(event: Omit<AuditEvent, 'timestamp'>) {
    if (!this.config.enabled) {
      return
    }

    const auditEvent: AuditEvent = {
      ...event,
      timestamp: new Date().toISOString(),
    }

    // Add to buffer
    this.buffer.push(auditEvent)
    if (this.buffer.length > this.bufferSize) {
      this.buffer.shift()
    }

    // Log to system logger
    logger.info({ audit: auditEvent }, 'Audit event')

    // TODO: If file logging is enabled, write to file
    if (this.config.logToFile && this.config.filePath) {
      this.writeToFile(auditEvent)
    }
  }

  /**
   * Log authentication event
   */
  logAuth(
    request: FastifyRequest,
    action: 'login' | 'logout' | 'failed',
    userId?: string,
    error?: string
  ) {
    this.log({
      eventType: `auth.${action}`,
      userId,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      action: `Authentication ${action}`,
      result: action === 'failed' ? 'failure' : 'success',
      error,
    })
  }

  /**
   * Log resource access
   */
  logResourceAccess(
    request: FastifyRequest,
    resourceUri: string,
    success: boolean,
    error?: string
  ) {
    const user = (request as any).user
    
    this.log({
      eventType: 'resource.read',
      userId: user?.id,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      action: 'Read resource',
      resource: resourceUri,
      result: success ? 'success' : 'failure',
      error,
    })
  }

  /**
   * Log tool execution
   */
  logToolExecution(
    request: FastifyRequest,
    toolName: string,
    args: any,
    success: boolean,
    error?: string
  ) {
    const user = (request as any).user
    
    this.log({
      eventType: 'tool.execute',
      userId: user?.id,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      action: `Execute tool: ${toolName}`,
      resource: toolName,
      result: success ? 'success' : 'failure',
      details: this.config.includeRequestBody ? { args } : undefined,
      error,
    })
  }

  /**
   * Log CDP command
   */
  logCDPCommand(
    method: string,
    params: any,
    success: boolean,
    userId?: string,
    error?: string
  ) {
    this.log({
      eventType: 'cdp.command',
      userId,
      action: `CDP command: ${method}`,
      resource: method,
      result: success ? 'success' : 'failure',
      details: this.config.includeRequestBody ? { params } : undefined,
      error,
    })
  }

  /**
   * Log security block
   */
  logSecurityBlock(
    request: FastifyRequest,
    reason: string,
    details?: Record<string, any>
  ) {
    const user = (request as any).user
    
    this.log({
      eventType: 'security.blocked',
      userId: user?.id,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      action: 'Security block',
      result: 'blocked',
      details: { reason, ...details },
    })
  }

  /**
   * Log rate limit
   */
  logRateLimit(request: FastifyRequest, endpoint: string) {
    const user = (request as any).user
    
    this.log({
      eventType: 'rate.limited',
      userId: user?.id,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      action: 'Rate limit exceeded',
      resource: endpoint,
      result: 'blocked',
    })
  }

  /**
   * Get recent audit events
   */
  getRecentEvents(count: number = 100): AuditEvent[] {
    return this.buffer.slice(-count)
  }

  /**
   * Get events by type
   */
  getEventsByType(eventType: AuditEventType, count: number = 100): AuditEvent[] {
    return this.buffer
      .filter(event => event.eventType === eventType)
      .slice(-count)
  }

  /**
   * Get events by user
   */
  getEventsByUser(userId: string, count: number = 100): AuditEvent[] {
    return this.buffer
      .filter(event => event.userId === userId)
      .slice(-count)
  }

  /**
   * Get failed events
   */
  getFailedEvents(count: number = 100): AuditEvent[] {
    return this.buffer
      .filter(event => event.result === 'failure' || event.result === 'blocked')
      .slice(-count)
  }

  /**
   * Write to file (placeholder)
   */
  private writeToFile(event: AuditEvent) {
    // TODO: Implement file writing with rotation
    // For now, just log that we would write to file
    logger.debug({ file: this.config.filePath, event }, 'Would write audit event to file')
  }

  /**
   * Get statistics
   */
  getStatistics() {
    const stats = {
      totalEvents: this.buffer.length,
      byType: {} as Record<AuditEventType, number>,
      byResult: {
        success: 0,
        failure: 0,
        blocked: 0,
      },
      recentFailures: 0,
    }

    for (const event of this.buffer) {
      // Count by type
      stats.byType[event.eventType] = (stats.byType[event.eventType] || 0) + 1
      
      // Count by result
      stats.byResult[event.result]++
      
      // Count recent failures (last 5 minutes)
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
      if (
        event.result !== 'success' &&
        new Date(event.timestamp).getTime() > fiveMinutesAgo
      ) {
        stats.recentFailures++
      }
    }

    return stats
  }
}