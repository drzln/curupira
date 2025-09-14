/**
 * @fileoverview Telemetry and metrics collection
 * 
 * This file provides telemetry collection for performance metrics,
 * usage analytics, and system health monitoring.
 */

import type { Logger } from 'pino'
import type { 
  SessionId, 
  RequestId, 
  Timestamp, 
  Duration,
  ComponentId,
  ActorId,
  StoreId 
} from '../types/branded.js'

/**
 * Metric types
 */
export type MetricType = 'counter' | 'gauge' | 'histogram' | 'timer'

/**
 * Metric data point
 */
export interface MetricPoint {
  name: string
  type: MetricType
  value: number
  timestamp: Timestamp
  tags?: Record<string, string>
  unit?: string
}

/**
 * Performance metric specifically for operations
 */
export interface PerformanceMetric extends MetricPoint {
  type: 'timer'
  operation: string
  duration: Duration
  success: boolean
  errorType?: string
  metadata?: Record<string, unknown>
}

/**
 * Usage metric for feature tracking
 */
export interface UsageMetric extends MetricPoint {
  type: 'counter'
  feature: string
  action: string
  sessionId?: SessionId
  userId?: string
  userAgent?: string
}

/**
 * System health metric
 */
export interface HealthMetric extends MetricPoint {
  type: 'gauge'
  component: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  details?: Record<string, unknown>
}

/**
 * State management metric
 */
export interface StateMetric extends MetricPoint {
  type: 'counter' | 'gauge'
  stateManager: 'react' | 'xstate' | 'zustand' | 'apollo'
  componentId?: ComponentId
  actorId?: ActorId
  storeId?: StoreId
  event: string
  stateSize?: number
}

/**
 * Network metric
 */
export interface NetworkMetric extends MetricPoint {
  type: 'histogram' | 'counter'
  endpoint: string
  method: string
  statusCode: number
  duration?: Duration
  size?: number
}

/**
 * All metric types
 */
export type Metric = 
  | MetricPoint 
  | PerformanceMetric 
  | UsageMetric 
  | HealthMetric 
  | StateMetric 
  | NetworkMetric

/**
 * Telemetry configuration
 */
export interface TelemetryConfig {
  enabled: boolean
  sampling: {
    performance: number // 0-1, percentage of events to sample
    usage: number
    health: number
    state: number
    network: number
  }
  bufferSize: number
  flushInterval: Duration // milliseconds
  endpoints?: {
    metrics?: string
    traces?: string
    logs?: string
  }
  privacy: {
    anonymizeUserIds: boolean
    redactSensitiveData: boolean
    allowedDomains: string[]
  }
}

/**
 * Default telemetry configuration
 */
export const DEFAULT_TELEMETRY_CONFIG: TelemetryConfig = {
  enabled: true,
  sampling: {
    performance: 1.0, // 100% in development
    usage: 1.0,
    health: 1.0,
    state: 0.1, // 10% for state events (high volume)
    network: 0.5 // 50% for network requests
  },
  bufferSize: 1000,
  flushInterval: 30000 as Duration, // 30 seconds
  privacy: {
    anonymizeUserIds: true,
    redactSensitiveData: true,
    allowedDomains: ['localhost', '*.novaskyn.com', '*.plo.quero.local']
  }
}

/**
 * Metric buffer for batching
 */
class MetricBuffer {
  private buffer: Metric[] = []
  private flushTimer?: NodeJS.Timeout
  
  constructor(
    private config: TelemetryConfig,
    private flushCallback: (metrics: Metric[]) => void
  ) {
    if (config.enabled && config.flushInterval > 0) {
      this.startFlushTimer()
    }
  }
  
  /**
   * Add metric to buffer
   */
  add(metric: Metric): void {
    if (!this.config.enabled) return
    
    // Apply sampling
    const samplingRate = this.getSamplingRate(metric)
    if (Math.random() > samplingRate) return
    
    this.buffer.push(metric)
    
    // Flush if buffer is full
    if (this.buffer.length >= this.config.bufferSize) {
      this.flush()
    }
  }
  
  /**
   * Force flush buffer
   */
  flush(): void {
    if (this.buffer.length === 0) return
    
    const metricsToFlush = [...this.buffer]
    this.buffer = []
    
    this.flushCallback(metricsToFlush)
  }
  
  /**
   * Start automatic flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush()
    }, this.config.flushInterval)
  }
  
  /**
   * Stop flush timer
   */
  stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = undefined
    }
    this.flush() // Final flush
  }
  
  /**
   * Get sampling rate for metric type
   */
  private getSamplingRate(metric: Metric): number {
    if ('operation' in metric) return this.config.sampling.performance
    if ('feature' in metric) return this.config.sampling.usage
    if ('status' in metric) return this.config.sampling.health
    if ('stateManager' in metric) return this.config.sampling.state
    if ('endpoint' in metric) return this.config.sampling.network
    return 1.0 // Default to 100%
  }
}

/**
 * Main telemetry collector
 */
export class TelemetryCollector {
  private buffer: MetricBuffer
  private logger?: Logger
  
  constructor(
    private config: TelemetryConfig = DEFAULT_TELEMETRY_CONFIG,
    logger?: Logger
  ) {
    this.logger = logger
    this.buffer = new MetricBuffer(config, this.handleFlush.bind(this))
  }
  
  /**
   * Record performance metric
   */
  recordPerformance(
    operation: string,
    duration: Duration,
    success: boolean,
    metadata?: Record<string, unknown>
  ): void {
    const metric: PerformanceMetric = {
      name: `performance.${operation}`,
      type: 'timer',
      value: duration,
      timestamp: Date.now() as Timestamp,
      operation,
      duration,
      success,
      metadata,
      tags: {
        operation,
        success: String(success)
      }
    }
    
    this.buffer.add(metric)
  }
  
  /**
   * Record usage metric
   */
  recordUsage(
    feature: string,
    action: string,
    sessionId?: SessionId,
    userId?: string
  ): void {
    const metric: UsageMetric = {
      name: `usage.${feature}.${action}`,
      type: 'counter',
      value: 1,
      timestamp: Date.now() as Timestamp,
      feature,
      action,
      sessionId,
      userId: this.config.privacy.anonymizeUserIds 
        ? this.anonymizeUserId(userId)
        : userId,
      tags: {
        feature,
        action
      }
    }
    
    this.buffer.add(metric)
  }
  
  /**
   * Record health metric
   */
  recordHealth(
    component: string,
    status: 'healthy' | 'degraded' | 'unhealthy',
    details?: Record<string, unknown>
  ): void {
    const metric: HealthMetric = {
      name: `health.${component}`,
      type: 'gauge',
      value: status === 'healthy' ? 1 : status === 'degraded' ? 0.5 : 0,
      timestamp: Date.now() as Timestamp,
      component,
      status,
      details: this.config.privacy.redactSensitiveData
        ? this.redactSensitiveData(details)
        : details,
      tags: {
        component,
        status
      }
    }
    
    this.buffer.add(metric)
  }
  
  /**
   * Record state management metric
   */
  recordState(
    stateManager: 'react' | 'xstate' | 'zustand' | 'apollo',
    event: string,
    options: {
      componentId?: ComponentId
      actorId?: ActorId
      storeId?: StoreId
      stateSize?: number
    } = {}
  ): void {
    const metric: StateMetric = {
      name: `state.${stateManager}.${event}`,
      type: 'counter',
      value: 1,
      timestamp: Date.now() as Timestamp,
      stateManager,
      event,
      ...options,
      tags: {
        stateManager,
        event,
        ...(options.componentId && { componentId: options.componentId }),
        ...(options.actorId && { actorId: options.actorId }),
        ...(options.storeId && { storeId: options.storeId })
      }
    }
    
    this.buffer.add(metric)
  }
  
  /**
   * Record network metric
   */
  recordNetwork(
    endpoint: string,
    method: string,
    statusCode: number,
    duration?: Duration,
    size?: number
  ): void {
    const metric: NetworkMetric = {
      name: `network.${method.toLowerCase()}`,
      type: 'histogram',
      value: duration || 0,
      timestamp: Date.now() as Timestamp,
      endpoint: this.sanitizeEndpoint(endpoint),
      method: method.toUpperCase(),
      statusCode,
      duration,
      size,
      tags: {
        endpoint: this.sanitizeEndpoint(endpoint),
        method: method.toUpperCase(),
        status: String(statusCode),
        success: String(statusCode >= 200 && statusCode < 400)
      }
    }
    
    this.buffer.add(metric)
  }
  
  /**
   * Record custom metric
   */
  recordCustom(
    name: string,
    type: MetricType,
    value: number,
    tags?: Record<string, string>
  ): void {
    const metric: MetricPoint = {
      name,
      type,
      value,
      timestamp: Date.now() as Timestamp,
      tags
    }
    
    this.buffer.add(metric)
  }
  
  /**
   * Flush all metrics immediately
   */
  flush(): void {
    this.buffer.flush()
  }
  
  /**
   * Stop telemetry collection
   */
  stop(): void {
    this.buffer.stop()
  }
  
  /**
   * Handle buffer flush
   */
  private handleFlush(metrics: Metric[]): void {
    if (this.logger) {
      this.logger.info(
        { 
          telemetry: {
            count: metrics.length,
            types: this.getMetricTypeCounts(metrics)
          }
        },
        'Flushing telemetry metrics'
      )
    }
    
    // In a real implementation, you would send these to your telemetry backend
    // For now, just log them in development
    if (process.env.NODE_ENV === 'development') {
      console.table(metrics.slice(0, 10)) // Show first 10 for debugging
    }
    
    // TODO: Send to telemetry endpoint
    this.sendMetrics(metrics).catch(error => {
      this.logger?.error({ error }, 'Failed to send telemetry metrics')
    })
  }
  
  /**
   * Send metrics to telemetry endpoint
   */
  private async sendMetrics(metrics: Metric[]): Promise<void> {
    if (!this.config.endpoints?.metrics) return
    
    try {
      const response = await fetch(this.config.endpoints.metrics, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ metrics })
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
    } catch (error) {
      // Don't throw - telemetry failures shouldn't break the app
      this.logger?.error({ error }, 'Failed to send metrics to endpoint')
    }
  }
  
  /**
   * Get metric type counts for logging
   */
  private getMetricTypeCounts(metrics: Metric[]): Record<string, number> {
    const counts: Record<string, number> = {}
    
    metrics.forEach(metric => {
      const key = metric.type
      counts[key] = (counts[key] || 0) + 1
    })
    
    return counts
  }
  
  /**
   * Anonymize user ID
   */
  private anonymizeUserId(userId?: string): string | undefined {
    if (!userId) return undefined
    
    // Simple hash-based anonymization
    let hash = 0
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    
    return `anon_${Math.abs(hash).toString(36)}`
  }
  
  /**
   * Sanitize endpoint URL
   */
  private sanitizeEndpoint(endpoint: string): string {
    try {
      const url = new URL(endpoint)
      // Remove query parameters and fragments for privacy
      return `${url.protocol}//${url.host}${url.pathname}`
    } catch {
      // If not a valid URL, just return the path part
      return endpoint.split('?')[0].split('#')[0]
    }
  }
  
  /**
   * Redact sensitive data from objects
   */
  private redactSensitiveData(obj?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!obj) return obj
    
    const sensitiveKeys = ['token', 'password', 'secret', 'key', 'authorization']
    const result = { ...obj }
    
    Object.keys(result).forEach(key => {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        result[key] = '[REDACTED]'
      }
    })
    
    return result
  }
}

/**
 * Global telemetry instance
 */
let globalTelemetry: TelemetryCollector | null = null

/**
 * Initialize global telemetry
 */
export const initializeTelemetry = (
  config: Partial<TelemetryConfig> = {},
  logger?: Logger
): TelemetryCollector => {
  const mergedConfig = { ...DEFAULT_TELEMETRY_CONFIG, ...config }
  globalTelemetry = new TelemetryCollector(mergedConfig, logger)
  return globalTelemetry
}

/**
 * Get global telemetry instance
 */
export const getTelemetry = (): TelemetryCollector => {
  if (!globalTelemetry) {
    // Auto-initialize with defaults if not initialized
    globalTelemetry = new TelemetryCollector()
  }
  return globalTelemetry
}

/**
 * Convenience functions for common metrics
 */
export const telemetry = {
  performance: (operation: string, duration: Duration, success: boolean, metadata?: Record<string, unknown>) =>
    getTelemetry().recordPerformance(operation, duration, success, metadata),
    
  usage: (feature: string, action: string, sessionId?: SessionId, userId?: string) =>
    getTelemetry().recordUsage(feature, action, sessionId, userId),
    
  health: (component: string, status: 'healthy' | 'degraded' | 'unhealthy', details?: Record<string, unknown>) =>
    getTelemetry().recordHealth(component, status, details),
    
  state: (stateManager: 'react' | 'xstate' | 'zustand' | 'apollo', event: string, options?: {
    componentId?: ComponentId
    actorId?: ActorId
    storeId?: StoreId
    stateSize?: number
  }) => getTelemetry().recordState(stateManager, event, options),
    
  network: (endpoint: string, method: string, statusCode: number, duration?: Duration, size?: number) =>
    getTelemetry().recordNetwork(endpoint, method, statusCode, duration, size),
    
  custom: (name: string, type: MetricType, value: number, tags?: Record<string, string>) =>
    getTelemetry().recordCustom(name, type, value, tags)
}