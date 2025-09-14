/**
 * @fileoverview Error handling utilities and strategies
 * 
 * This file provides utilities for handling errors, including
 * retry logic, recovery strategies, and error reporting.
 */

import type { Logger } from 'pino'
import { CurupiraError, isCurupiraError } from './base.js'
import type {
  CurupiraErrorCode,
  CurupiraErrorInfo,
  ErrorCategory,
  ErrorSeverity,
  Result,
  AsyncResult
} from './types.js'
import { InternalErrors } from './factories.js'

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxAttempts: number
  /** Base delay between retries in milliseconds */
  baseDelay: number
  /** Maximum delay between retries in milliseconds */
  maxDelay: number
  /** Backoff multiplier for exponential backoff */
  backoffMultiplier: number
  /** Whether to add random jitter to delays */
  jitter: boolean
  /** Function to determine if error should be retried */
  shouldRetry?: (error: CurupiraError, attempt: number) => boolean
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitter: true,
  shouldRetry: (error) => error.retryable
}

/**
 * Error handler configuration
 */
export interface ErrorHandlerConfig {
  /** Logger for error reporting */
  logger?: Logger
  /** Whether to report errors to telemetry */
  reportToTelemetry: boolean
  /** Function to report telemetry */
  telemetryReporter?: (error: CurupiraError) => void
  /** Custom error transformers */
  transformers?: Array<(error: unknown) => CurupiraError | null>
  /** Error filters for reporting */
  filters?: {
    /** Minimum severity to report */
    minSeverity?: ErrorSeverity
    /** Categories to exclude from reporting */
    excludeCategories?: ErrorCategory[]
    /** Error codes to exclude from reporting */
    excludeCodes?: CurupiraErrorCode[]
  }
}

/**
 * Centralized error handler
 */
export class ErrorHandler {
  private config: ErrorHandlerConfig
  private errorCounts = new Map<CurupiraErrorCode, number>()
  private lastErrorTimes = new Map<CurupiraErrorCode, number>()

  constructor(config: ErrorHandlerConfig = { reportToTelemetry: true }) {
    this.config = config
  }

  /**
   * Handle an error with logging and telemetry reporting
   */
  handle(error: unknown, context?: Record<string, unknown>): CurupiraError {
    const curupiraError = this.normalizeError(error)
    
    // Add context if provided
    const errorWithContext = context 
      ? curupiraError.withContext(context)
      : curupiraError

    // Log the error
    this.logError(errorWithContext)

    // Report to telemetry if configured
    if (this.shouldReport(errorWithContext)) {
      this.reportError(errorWithContext)
    }

    // Update error tracking
    this.updateErrorTracking(errorWithContext)

    return errorWithContext
  }

  /**
   * Convert unknown error to CurupiraError
   */
  private normalizeError(error: unknown): CurupiraError {
    // Already a CurupiraError
    if (isCurupiraError(error)) {
      return error
    }

    // Try custom transformers first
    if (this.config.transformers) {
      for (const transformer of this.config.transformers) {
        const transformed = transformer(error)
        if (transformed) return transformed
      }
    }

    // Convert using base error conversion
    return CurupiraError.from(error as Error)
  }

  /**
   * Log error appropriately based on severity
   */
  private logError(error: CurupiraError): void {
    if (!this.config.logger) return

    const logData = {
      error: error.toJSON(),
      errorCode: error.code,
      errorCategory: error.category,
      errorSeverity: error.severity
    }

    switch (error.severity) {
      case 'low':
        this.config.logger.debug(logData, error.message)
        break
      case 'medium':
        this.config.logger.warn(logData, error.message)
        break
      case 'high':
        this.config.logger.error(logData, error.message)
        break
      case 'critical':
        this.config.logger.fatal(logData, error.message)
        break
    }
  }

  /**
   * Check if error should be reported to telemetry
   */
  private shouldReport(error: CurupiraError): boolean {
    if (!this.config.reportToTelemetry) return false

    const filters = this.config.filters
    if (!filters) return true

    // Check minimum severity
    if (filters.minSeverity) {
      const severityOrder = { low: 0, medium: 1, high: 2, critical: 3 }
      if (severityOrder[error.severity] < severityOrder[filters.minSeverity]) {
        return false
      }
    }

    // Check excluded categories
    if (filters.excludeCategories?.includes(error.category)) {
      return false
    }

    // Check excluded codes
    if (filters.excludeCodes?.includes(error.code)) {
      return false
    }

    return true
  }

  /**
   * Report error to telemetry
   */
  private reportError(error: CurupiraError): void {
    if (this.config.telemetryReporter) {
      try {
        this.config.telemetryReporter(error)
      } catch (reportError) {
        // Don't let telemetry reporting errors crash the app
        this.config.logger?.error(
          { error: reportError },
          'Failed to report error to telemetry'
        )
      }
    }
  }

  /**
   * Update error tracking statistics
   */
  private updateErrorTracking(error: CurupiraError): void {
    const count = this.errorCounts.get(error.code) || 0
    this.errorCounts.set(error.code, count + 1)
    this.lastErrorTimes.set(error.code, Date.now())
  }

  /**
   * Get error statistics
   */
  getErrorStats(): {
    totalErrors: number
    errorsByCode: Array<{ code: CurupiraErrorCode; count: number; lastSeen: number }>
    mostFrequentErrors: Array<{ code: CurupiraErrorCode; count: number }>
  } {
    const totalErrors = Array.from(this.errorCounts.values())
      .reduce((sum, count) => sum + count, 0)

    const errorsByCode = Array.from(this.errorCounts.entries())
      .map(([code, count]) => ({
        code,
        count,
        lastSeen: this.lastErrorTimes.get(code) || 0
      }))

    const mostFrequentErrors = errorsByCode
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    return {
      totalErrors,
      errorsByCode,
      mostFrequentErrors
    }
  }

  /**
   * Clear error tracking statistics
   */
  clearStats(): void {
    this.errorCounts.clear()
    this.lastErrorTimes.clear()
  }
}

/**
 * Retry an operation with exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config }
  let lastError: CurupiraError | undefined

  for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
    try {
      return await operation()
    } catch (error) {
      const curupiraError = isCurupiraError(error) 
        ? error 
        : CurupiraError.from(error as Error)

      lastError = curupiraError

      // Don't retry if this is the last attempt
      if (attempt === retryConfig.maxAttempts) break

      // Check if error should be retried
      const shouldRetry = retryConfig.shouldRetry
        ? retryConfig.shouldRetry(curupiraError, attempt)
        : curupiraError.retryable

      if (!shouldRetry) break

      // Calculate delay with exponential backoff
      const baseDelay = curupiraError.retryDelay || retryConfig.baseDelay
      const exponentialDelay = baseDelay * Math.pow(retryConfig.backoffMultiplier, attempt - 1)
      const delay = Math.min(exponentialDelay, retryConfig.maxDelay)
      
      // Add jitter if configured
      const finalDelay = retryConfig.jitter
        ? delay + Math.random() * delay * 0.1
        : delay

      await sleep(finalDelay)
    }
  }

  throw lastError || InternalErrors.unexpected('Retry loop completed without error')
}

/**
 * Safe wrapper for operations that might throw
 */
export async function safely<T>(
  operation: () => Promise<T>,
  errorHandler?: ErrorHandler
): AsyncResult<T> {
  try {
    const data = await operation()
    return { success: true, data }
  } catch (error) {
    const curupiraError = errorHandler
      ? errorHandler.handle(error)
      : CurupiraError.from(error as Error)
    
    return { success: false, error: curupiraError }
  }
}

/**
 * Safe synchronous wrapper
 */
export function safelySync<T>(
  operation: () => T,
  errorHandler?: ErrorHandler
): Result<T> {
  try {
    const data = operation()
    return { success: true, data }
  } catch (error) {
    const curupiraError = errorHandler
      ? errorHandler.handle(error)
      : CurupiraError.from(error as Error)
    
    return { success: false, error: curupiraError }
  }
}

/**
 * Circuit breaker pattern implementation
 */
export class CircuitBreaker<T> {
  private failureCount = 0
  private lastFailureTime = 0
  private state: 'closed' | 'open' | 'half-open' = 'closed'

  constructor(
    private operation: () => Promise<T>,
    private config: {
      failureThreshold: number
      timeoutMs: number
      resetTimeoutMs: number
    } = {
      failureThreshold: 5,
      timeoutMs: 10000,
      resetTimeoutMs: 60000
    }
  ) {}

  async execute(): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime >= this.config.resetTimeoutMs) {
        this.state = 'half-open'
      } else {
        throw InternalErrors.resourceExhausted('Circuit breaker is open')
      }
    }

    try {
      const result = await Promise.race([
        this.operation(),
        new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(InternalErrors.unexpected('Operation timed out'))
          }, this.config.timeoutMs)
        })
      ])

      // Success - reset failure count and close circuit
      this.failureCount = 0
      this.state = 'closed'
      return result

    } catch (error) {
      this.failureCount++
      this.lastFailureTime = Date.now()

      if (this.failureCount >= this.config.failureThreshold) {
        this.state = 'open'
      }

      throw error
    }
  }

  getState(): 'closed' | 'open' | 'half-open' {
    return this.state
  }

  getFailureCount(): number {
    return this.failureCount
  }

  reset(): void {
    this.failureCount = 0
    this.lastFailureTime = 0
    this.state = 'closed'
  }
}

/**
 * Utility to sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Global error handler instance
 */
let globalErrorHandler: ErrorHandler | null = null

/**
 * Initialize global error handler
 */
export function initializeErrorHandler(config: ErrorHandlerConfig): ErrorHandler {
  globalErrorHandler = new ErrorHandler(config)
  return globalErrorHandler
}

/**
 * Get global error handler
 */
export function getErrorHandler(): ErrorHandler {
  if (!globalErrorHandler) {
    globalErrorHandler = new ErrorHandler()
  }
  return globalErrorHandler
}

/**
 * Handle error using global handler
 */
export function handleError(error: unknown, context?: Record<string, unknown>): CurupiraError {
  return getErrorHandler().handle(error, context)
}