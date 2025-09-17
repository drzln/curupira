/**
 * @fileoverview Structured logging with Pino
 * 
 * This file provides structured logging capabilities with performance
 * monitoring, contextual information, and proper serialization.
 */

import pino, { type Logger, type LoggerOptions } from 'pino'
import type { LogLevel, Environment } from '../config/index.js'
import type { SessionId, RequestId, Timestamp } from '../types/branded.js'

// Re-export pino Logger type
export type { Logger } from 'pino'

/**
 * Log context information
 */
export interface LogContext {
  sessionId?: SessionId
  requestId?: RequestId
  userId?: string
  tabId?: number
  component?: string
  operation?: string
  duration?: number
  timestamp?: Timestamp
  [key: string]: unknown
}

/**
 * Performance timing information
 */
export interface PerformanceTiming {
  operation: string
  startTime: number
  endTime: number
  duration: number
  memory?: {
    used: number
    total: number
  }
  metadata?: Record<string, unknown>
}

/**
 * Curupira logger configuration
 */
export interface CurupiraLoggerConfig {
  level: LogLevel
  environment: Environment
  service: string
  version: string
  enablePerformanceLogging: boolean
  enableRedaction: boolean
  redactedFields: string[]
  maxLogSize: number
  destination?: NodeJS.WritableStream
}

/**
 * Default redacted fields for security
 */
const DEFAULT_REDACTED_FIELDS = [
  'password',
  'token',
  'secret',
  'key',
  'authorization',
  'cookie',
  'session',
  'jwt',
  'apikey',
  'api_key',
  'credit_card',
  'ssn',
  'social_security',
  'phone',
  'email' // Only in certain contexts
]

/**
 * Simplified logger configuration for quick usage
 */
export interface SimpleLoggerConfig {
  level: LogLevel
  name?: string
}

/**
 * Creates a structured logger instance
 */
export function createLogger(config: CurupiraLoggerConfig): Logger;
export function createLogger(config: SimpleLoggerConfig): Logger;
export function createLogger(config: CurupiraLoggerConfig | SimpleLoggerConfig): Logger {
  // Check if it's a simple config
  const isSimpleConfig = !('environment' in config);
  
  // Apply defaults for simple config
  const fullConfig: CurupiraLoggerConfig = isSimpleConfig ? {
    level: config.level,
    environment: 'development',
    service: (config as SimpleLoggerConfig).name || 'curupira',
    version: '1.0.0',
    enablePerformanceLogging: true,
    enableRedaction: true,
    redactedFields: [],
    maxLogSize: 1024 * 1024, // 1MB default
    destination: undefined
  } : config as CurupiraLoggerConfig;

  const baseConfig: LoggerOptions = {
    level: fullConfig.level,
    base: {
      service: fullConfig.service,
      version: fullConfig.version,
      environment: fullConfig.environment,
      pid: process.pid,
      hostname: globalThis.location?.hostname || 'unknown'
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label.toUpperCase() }),
      bindings: (bindings) => ({
        pid: bindings.pid,
        hostname: bindings.hostname,
        service: bindings.service,
        version: bindings.version,
        environment: bindings.environment
      })
    },
    serializers: {
      error: pino.stdSerializers.err,
      req: (req) => ({
        id: req.id,
        method: req.method,
        url: req.url,
        headers: fullConfig.enableRedaction 
          ? redactSensitiveData(req.headers, fullConfig.redactedFields)
          : req.headers,
        remoteAddress: req.ip,
        userAgent: req.headers?.['user-agent']
      }),
      res: (res) => ({
        statusCode: res.statusCode,
        headers: fullConfig.enableRedaction
          ? redactSensitiveData(res.headers, fullConfig.redactedFields)
          : res.headers,
        responseTime: res.responseTime
      }),
      context: (context: LogContext) => ({
        sessionId: context.sessionId,
        requestId: context.requestId,
        userId: context.userId,
        tabId: context.tabId,
        component: context.component,
        operation: context.operation,
        duration: context.duration,
        ...redactSensitiveData(context, fullConfig.redactedFields)
      }),
      performance: (timing: PerformanceTiming) => ({
        operation: timing.operation,
        duration: timing.duration,
        startTime: timing.startTime,
        endTime: timing.endTime,
        memory: timing.memory,
        metadata: fullConfig.enableRedaction
          ? redactSensitiveData(timing.metadata || {}, fullConfig.redactedFields)
          : timing.metadata
      })
    }
  }

  // Environment-specific configuration
  if (process.env.CURUPIRA_STDIO_MODE === 'true' || process.env.CURUPIRA_TRANSPORT === 'stdio') {
    // In stdio mode, write only to stderr to avoid polluting stdout
    baseConfig.transport = {
      target: 'pino/file',
      options: { destination: 2 } // stderr
    }
    baseConfig.level = 'error' // Only log errors in stdio mode
  } else if (fullConfig.environment === 'development' && !fullConfig.destination) {
    // Only try pino-pretty if not in test mode (no custom destination)
    // and check if pino-pretty is available
    let usePretty = false
    try {
      // Check if pino-pretty is available
      require.resolve('pino-pretty')
      usePretty = true
    } catch {
      usePretty = false
    }
    
    if (usePretty) {
      baseConfig.transport = {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'yyyy-mm-dd HH:MM:ss.l',
          ignore: 'pid,hostname',
          singleLine: false
        }
      }
    } else {
      // Fallback to JSON logging
      baseConfig.messageKey = 'message'
      baseConfig.errorKey = 'error'
    }
  } else {
    // Production or test: structured JSON logging
    baseConfig.messageKey = 'message'
    baseConfig.errorKey = 'error'
  }

  // Custom destination
  if (fullConfig.destination) {
    (baseConfig as any).stream = fullConfig.destination
  }

  return pino(baseConfig)
}

/**
 * Redacts sensitive data from objects
 */
export const redactSensitiveData = (
  obj: Record<string, unknown>, 
  redactedFields: string[]
): Record<string, unknown> => {
  if (!obj || typeof obj !== 'object') return obj

  const result = { ...obj }
  const fieldsToRedact = [...DEFAULT_REDACTED_FIELDS, ...redactedFields]
  
  for (const key of Object.keys(result)) {
    const lowerKey = key.toLowerCase()
    
    if (fieldsToRedact.some(field => lowerKey.includes(field))) {
      result[key] = '[REDACTED]'
    } else if (result[key] && typeof result[key] === 'object') {
      result[key] = redactSensitiveData(
        result[key] as Record<string, unknown>, 
        redactedFields
      )
    }
  }
  
  return result
}

/**
 * Performance monitoring utilities
 */
export class PerformanceMonitor {
  private timings = new Map<string, { startTime: number; metadata?: Record<string, unknown> }>()
  
  constructor(private logger: Logger) {}
  
  /**
   * Start timing an operation
   */
  start(operation: string, metadata?: Record<string, unknown>): void {
    this.timings.set(operation, {
      startTime: performance.now(),
      metadata
    })
  }
  
  /**
   * End timing an operation and log the result
   */
  end(operation: string, additionalMetadata?: Record<string, unknown>): PerformanceTiming | null {
    const timing = this.timings.get(operation)
    if (!timing) {
      this.logger.warn({ operation }, 'Performance timing not found for operation')
      return null
    }
    
    const endTime = performance.now()
    const duration = endTime - timing.startTime
    const memory = this.getMemoryUsage()
    
    const performanceTiming: PerformanceTiming = {
      operation,
      startTime: timing.startTime,
      endTime,
      duration,
      memory,
      metadata: { ...timing.metadata, ...additionalMetadata }
    }
    
    this.logger.info({ performance: performanceTiming }, `Operation ${operation} completed`)
    this.timings.delete(operation)
    
    return performanceTiming
  }
  
  /**
   * Clear all timings
   */
  clear(): void {
    this.timings.clear()
  }
  
  /**
   * Get current memory usage
   */
  private getMemoryUsage() {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage()
      return {
        used: usage.heapUsed,
        total: usage.heapTotal
      }
    }
    
    // Browser environment
    if ('memory' in performance) {
      const memory = (performance as any).memory
      return {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize
      }
    }
    
    return undefined
  }
}

/**
 * Contextual logger wrapper
 */
export class ContextualLogger {
  private baseContext: LogContext = {}
  
  constructor(private logger: Logger) {}
  
  /**
   * Set base context that will be included in all logs
   */
  setContext(context: LogContext): void {
    this.baseContext = { ...this.baseContext, ...context }
  }
  
  /**
   * Create a child logger with additional context
   */
  child(context: LogContext): ContextualLogger {
    const childLogger = new ContextualLogger(this.logger.child({ context }))
    childLogger.setContext({ ...this.baseContext, ...context })
    return childLogger
  }
  
  /**
   * Log with context
   */
  trace(context: LogContext | string, message?: string): void {
    this.log('trace', context, message)
  }
  
  debug(context: LogContext | string, message?: string): void {
    this.log('debug', context, message)
  }
  
  info(context: LogContext | string, message?: string): void {
    this.log('info', context, message)
  }
  
  warn(context: LogContext | string, message?: string): void {
    this.log('warn', context, message)
  }
  
  error(context: LogContext | string | Error, message?: string): void {
    if (context instanceof Error) {
      this.logger.error({ error: context, context: this.baseContext }, message || context.message)
    } else {
      this.log('error', context, message)
    }
  }
  
  fatal(context: LogContext | string | Error, message?: string): void {
    if (context instanceof Error) {
      this.logger.fatal({ error: context, context: this.baseContext }, message || context.message)
    } else {
      this.log('fatal', context, message)
    }
  }
  
  private log(level: LogLevel, context: LogContext | string, message?: string): void {
    if (typeof context === 'string') {
      this.logger[level]({ context: this.baseContext }, context)
    } else {
      const fullContext = { ...this.baseContext, ...context }
      this.logger[level]({ context: fullContext }, message || 'Log entry')
    }
  }
}

/**
 * Global logger configuration
 */
let globalLoggerInstance: ContextualLogger | null = null

// Store on global object to prevent module caching issues in tests
if (typeof globalThis !== 'undefined') {
  ;(globalThis as any).globalLoggerInstance = globalLoggerInstance
}

/**
 * Initialize global logger
 */
export const initializeLogger = (config: CurupiraLoggerConfig): ContextualLogger => {
  const logger = createLogger(config)
  globalLoggerInstance = new ContextualLogger(logger)
  
  // Update global reference for tests
  if (typeof globalThis !== 'undefined') {
    ;(globalThis as any).globalLoggerInstance = globalLoggerInstance
  }
  
  return globalLoggerInstance
}

/**
 * Get global logger instance
 */
export const getLogger = (): ContextualLogger => {
  // Check both local and global references
  let instance = globalLoggerInstance
  
  if (typeof globalThis !== 'undefined' && (globalThis as any).globalLoggerInstance !== undefined) {
    instance = (globalThis as any).globalLoggerInstance
  }
  
  if (!instance) {
    throw new Error('Logger not initialized. Call initializeLogger() first.')
  }
  return instance
}

/**
 * Create performance monitor
 */
export const createPerformanceMonitor = (logger?: Logger): PerformanceMonitor => {
  const loggerInstance = logger || (globalLoggerInstance as any)?.logger
  if (!loggerInstance) {
    throw new Error('Logger instance required for performance monitoring')
  }
  return new PerformanceMonitor(loggerInstance)
}

/**
 * Utility for timing operations
 */
export const withTiming = async <T>(
  operation: string,
  fn: () => Promise<T> | T,
  monitor?: PerformanceMonitor
): Promise<T> => {
  const perfMonitor = monitor || createPerformanceMonitor()
  
  perfMonitor.start(operation)
  
  try {
    const result = await fn()
    perfMonitor.end(operation, { success: true })
    return result
  } catch (error) {
    perfMonitor.end(operation, { 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    })
    throw error
  }
}

/**
 * Log levels for validation
 */
export const LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const

/**
 * Check if log level is valid
 */
export const isValidLogLevel = (level: string): level is LogLevel => {
  return LOG_LEVELS.includes(level as LogLevel)
}