/**
 * @fileoverview Tests for error handlers and utilities
 * 
 * These tests ensure error handling strategies, retry logic,
 * and circuit breakers work correctly.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  ErrorHandler,
  withRetry,
  safely,
  safelySync,
  CircuitBreaker,
  initializeErrorHandler,
  getErrorHandler,
  handleError,
  DEFAULT_RETRY_CONFIG
} from '../handlers.js'
import { CurupiraError } from '../base.js'
import { CurupiraErrorCode } from '../types.js'
import { NetworkErrors, InternalErrors } from '../factories.js'

describe('ErrorHandler', () => {
  let mockLogger: any
  let mockTelemetryReporter: any
  let errorHandler: ErrorHandler

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      fatal: vi.fn()
    }
    mockTelemetryReporter = vi.fn()

    errorHandler = new ErrorHandler({
      logger: mockLogger,
      reportToTelemetry: true,
      telemetryReporter: mockTelemetryReporter
    })
  })

  test('handles CurupiraError correctly', () => {
    const error = NetworkErrors.connectionFailed('https://api.example.com')
    const context = { sessionId: 'session-123', operation: 'fetch-data' }

    const handledError = errorHandler.handle(error, context)

    expect(handledError).toBeInstanceOf(CurupiraError)
    expect(handledError.metadata?.sessionId).toBe('session-123')
    expect(handledError.metadata?.operation).toBe('fetch-data')
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: CurupiraErrorCode.NETWORK_CONNECTION_FAILED,
        errorCategory: 'network',
        errorSeverity: 'medium'
      }),
      error.message
    )
    expect(mockTelemetryReporter).toHaveBeenCalledWith(handledError)
  })

  test('converts standard Error to CurupiraError', () => {
    const standardError = new Error('Standard error message')
    const handledError = errorHandler.handle(standardError)

    expect(handledError).toBeInstanceOf(CurupiraError)
    expect(handledError.code).toBe(CurupiraErrorCode.INTERNAL_UNEXPECTED_ERROR)
    expect(handledError.message).toBe('Standard error message')
    expect(handledError.cause).toBe(standardError)
  })

  test('uses custom transformers', () => {
    const customTransformer = vi.fn((error: unknown) => {
      if (error instanceof TypeError) {
        return NetworkErrors.connectionFailed('type-error-endpoint')
      }
      return null
    })

    const handlerWithTransformer = new ErrorHandler({
      transformers: [customTransformer],
      reportToTelemetry: false
    })

    const typeError = new TypeError('Type error')
    const handledError = handlerWithTransformer.handle(typeError)

    expect(customTransformer).toHaveBeenCalledWith(typeError)
    expect(handledError.code).toBe(CurupiraErrorCode.NETWORK_CONNECTION_FAILED)
    expect(handledError.details?.technical?.endpoint).toBe('type-error-endpoint')
  })

  test('logs errors based on severity', () => {
    const lowError = new CurupiraError({
      code: CurupiraErrorCode.NETWORK_RATE_LIMITED,
      category: 'network',
      severity: 'low',
      message: 'Rate limited',
      recoverable: true,
      retryable: true
    })

    const criticalError = new CurupiraError({
      code: CurupiraErrorCode.INTERNAL_ASSERTION_FAILED,
      category: 'internal',
      severity: 'critical',
      message: 'Assertion failed',
      recoverable: false,
      retryable: false
    })

    errorHandler.handle(lowError)
    errorHandler.handle(criticalError)

    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.objectContaining({ errorSeverity: 'low' }),
      'Rate limited'
    )
    expect(mockLogger.fatal).toHaveBeenCalledWith(
      expect.objectContaining({ errorSeverity: 'critical' }),
      'Assertion failed'
    )
  })

  test('respects reporting filters', () => {
    const filteredHandler = new ErrorHandler({
      reportToTelemetry: true,
      telemetryReporter: mockTelemetryReporter,
      filters: {
        minSeverity: 'high',
        excludeCategories: ['network'],
        excludeCodes: [CurupiraErrorCode.VALIDATION_REQUIRED_FIELD]
      }
    })

    // Should not report - severity too low
    const lowError = new CurupiraError({
      code: CurupiraErrorCode.CONFIG_INVALID_FORMAT,
      category: 'configuration',
      severity: 'medium',
      message: 'Invalid format',
      recoverable: false,
      retryable: false
    })

    // Should not report - excluded category
    const networkError = NetworkErrors.connectionFailed('test')

    // Should not report - excluded code
    const validationError = new CurupiraError({
      code: CurupiraErrorCode.VALIDATION_REQUIRED_FIELD,
      category: 'validation',
      severity: 'high',
      message: 'Required field',
      recoverable: false,
      retryable: false
    })

    // Should report - meets criteria
    const criticalError = InternalErrors.unexpected('Critical error')

    filteredHandler.handle(lowError)
    filteredHandler.handle(networkError)
    filteredHandler.handle(validationError)
    filteredHandler.handle(criticalError)

    expect(mockTelemetryReporter).toHaveBeenCalledTimes(1)
    expect(mockTelemetryReporter).toHaveBeenCalledWith(
      expect.objectContaining({ code: CurupiraErrorCode.INTERNAL_UNEXPECTED_ERROR })
    )
  })

  test('handles telemetry reporting errors gracefully', () => {
    const failingReporter = vi.fn(() => {
      throw new Error('Telemetry service down')
    })

    const handlerWithFailingReporter = new ErrorHandler({
      logger: mockLogger,
      reportToTelemetry: true,
      telemetryReporter: failingReporter
    })

    const error = InternalErrors.unexpected('Test error')

    // Should not throw even if telemetry fails
    expect(() => handlerWithFailingReporter.handle(error)).not.toThrow()
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(Error) }),
      'Failed to report error to telemetry'
    )
  })

  test('tracks error statistics', () => {
    const error1 = NetworkErrors.connectionFailed('endpoint1')
    const error2 = NetworkErrors.connectionFailed('endpoint2')
    const error3 = InternalErrors.unexpected('unexpected')

    errorHandler.handle(error1)
    errorHandler.handle(error2)
    errorHandler.handle(error3)

    const stats = errorHandler.getErrorStats()

    expect(stats.totalErrors).toBe(3)
    expect(stats.errorsByCode).toHaveLength(2)
    
    const networkErrorStat = stats.errorsByCode.find(
      stat => stat.code === CurupiraErrorCode.NETWORK_CONNECTION_FAILED
    )
    expect(networkErrorStat?.count).toBe(2)

    const internalErrorStat = stats.errorsByCode.find(
      stat => stat.code === CurupiraErrorCode.INTERNAL_UNEXPECTED_ERROR
    )
    expect(internalErrorStat?.count).toBe(1)

    expect(stats.mostFrequentErrors[0].code).toBe(CurupiraErrorCode.NETWORK_CONNECTION_FAILED)
  })

  test('clears statistics', () => {
    errorHandler.handle(NetworkErrors.connectionFailed('test'))
    
    let stats = errorHandler.getErrorStats()
    expect(stats.totalErrors).toBe(1)

    errorHandler.clearStats()
    
    stats = errorHandler.getErrorStats()
    expect(stats.totalErrors).toBe(0)
    expect(stats.errorsByCode).toHaveLength(0)
  })
})

describe('Retry Logic', () => {
  test('retries retryable operations with exponential backoff', async () => {
    let attempts = 0
    const operation = vi.fn(async () => {
      attempts++
      if (attempts < 3) {
        throw NetworkErrors.connectionFailed('test-endpoint')
      }
      return 'success'
    })

    vi.useFakeTimers()

    const resultPromise = withRetry(operation, {
      maxAttempts: 3,
      baseDelay: 1000,
      backoffMultiplier: 2,
      jitter: false
    })

    // First attempt fails immediately
    await vi.advanceTimersByTimeAsync(0)
    expect(attempts).toBe(1)

    // Wait for first retry (1000ms)
    await vi.advanceTimersByTimeAsync(1000)
    expect(attempts).toBe(2)

    // Wait for second retry (2000ms with backoff)
    await vi.advanceTimersByTimeAsync(2000)
    expect(attempts).toBe(3)

    const result = await resultPromise
    expect(result).toBe('success')
    expect(operation).toHaveBeenCalledTimes(3)

    vi.useRealTimers()
  })

  test('stops retrying for non-retryable errors', async () => {
    const operation = vi.fn(async () => {
      throw new CurupiraError({
        code: CurupiraErrorCode.VALIDATION_REQUIRED_FIELD,
        category: 'validation',
        severity: 'medium',
        message: 'Required field missing',
        recoverable: false,
        retryable: false
      })
    })

    await expect(withRetry(operation, { maxAttempts: 3 })).rejects.toThrow()
    expect(operation).toHaveBeenCalledTimes(1)
  })

  test('respects custom shouldRetry function', async () => {
    let attempts = 0
    const operation = vi.fn(async () => {
      attempts++
      throw NetworkErrors.connectionFailed('test')
    })

    const shouldRetry = vi.fn((error, attempt) => attempt < 2) // Only retry once

    vi.useFakeTimers()

    const resultPromise = withRetry(operation, {
      maxAttempts: 5,
      shouldRetry
    }).catch(e => e)

    await vi.advanceTimersByTimeAsync(10000) // Fast forward
    
    expect(operation).toHaveBeenCalledTimes(2) // Original + 1 retry
    expect(shouldRetry).toHaveBeenCalledTimes(2) // Called after each failed attempt

    vi.useRealTimers()
  })

  test('uses error-specific retry delay', async () => {
    const customDelayError = new CurupiraError({
      code: CurupiraErrorCode.NETWORK_RATE_LIMITED,
      category: 'network',
      severity: 'low',
      message: 'Rate limited',
      recoverable: true,
      retryable: true,
      retryDelay: 100 // Smaller delay for faster test
    })

    let attempts = 0
    const operation = vi.fn(async () => {
      attempts++
      if (attempts < 2) {
        throw customDelayError
      }
      return 'success'
    })

    const result = await withRetry(operation, {
      maxAttempts: 2,
      baseDelay: 50 // Should be overridden by error's retryDelay
    })
    
    expect(result).toBe('success')
    expect(attempts).toBe(2)
    expect(operation).toHaveBeenCalledTimes(2)
  })

  test('applies jitter to retry delays', async () => {
    let attempts = 0
    const operation = vi.fn(async () => {
      attempts++
      if (attempts < 2) {
        throw NetworkErrors.connectionFailed('test')
      }
      return 'success'
    })

    const result = await withRetry(operation, {
      maxAttempts: 2,
      baseDelay: 10, // Small delay for faster test
      jitter: true
    })

    expect(result).toBe('success')
    expect(operation).toHaveBeenCalledTimes(2)
    expect(attempts).toBe(2)
  })
})

describe('Safe Wrappers', () => {
  test('safely wraps async operations', async () => {
    const successOperation = async () => 'success'
    const failingOperation = async () => {
      throw new Error('Operation failed')
    }

    const successResult = await safely(successOperation)
    expect(successResult.success).toBe(true)
    expect((successResult as any).data).toBe('success')

    const failResult = await safely(failingOperation)
    expect(failResult.success).toBe(false)
    expect((failResult as any).error).toBeInstanceOf(CurupiraError)
  })

  test('safelySync wraps sync operations', () => {
    const successOperation = () => 42
    const failingOperation = () => {
      throw new Error('Sync operation failed')
    }

    const successResult = safelySync(successOperation)
    expect(successResult.success).toBe(true)
    expect((successResult as any).data).toBe(42)

    const failResult = safelySync(failingOperation)
    expect(failResult.success).toBe(false)
    expect((failResult as any).error).toBeInstanceOf(CurupiraError)
  })

  test('safe wrappers use provided error handler', async () => {
    const mockHandler = {
      handle: vi.fn((error) => CurupiraError.from(error as Error))
    }

    const operation = async () => {
      throw new Error('Test error')
    }

    await safely(operation, mockHandler as any)
    expect(mockHandler.handle).toHaveBeenCalledWith(expect.any(Error))
  })
})

describe('CircuitBreaker', () => {
  test('allows operations when circuit is closed', async () => {
    const operation = vi.fn(async () => 'success')
    const breaker = new CircuitBreaker(operation)

    const result = await breaker.execute()

    expect(result).toBe('success')
    expect(breaker.getState()).toBe('closed')
    expect(breaker.getFailureCount()).toBe(0)
  })

  test('opens circuit after failure threshold', async () => {
    let callCount = 0
    const operation = vi.fn(async () => {
      callCount++
      throw new Error(`Failure ${callCount}`)
    })

    const breaker = new CircuitBreaker(operation, {
      failureThreshold: 3,
      timeoutMs: 1000,
      resetTimeoutMs: 5000
    })

    // First 3 failures should be allowed
    await expect(breaker.execute()).rejects.toThrow('Failure 1')
    expect(breaker.getState()).toBe('closed')

    await expect(breaker.execute()).rejects.toThrow('Failure 2')
    expect(breaker.getState()).toBe('closed')

    await expect(breaker.execute()).rejects.toThrow('Failure 3')
    expect(breaker.getState()).toBe('open') // Circuit opens after 3rd failure

    // 4th attempt should be rejected immediately
    await expect(breaker.execute()).rejects.toThrow('Circuit breaker is open')
    expect(callCount).toBe(3) // Operation not called again

    expect(breaker.getFailureCount()).toBe(3)
  })

  test('transitions to half-open after reset timeout', async () => {
    const operation = vi.fn(async () => {
      throw new Error('Always fails')
    })

    const breaker = new CircuitBreaker(operation, {
      failureThreshold: 1,
      timeoutMs: 1000,
      resetTimeoutMs: 1000
    })

    // Fail once to open circuit
    await expect(breaker.execute()).rejects.toThrow('Always fails')
    expect(breaker.getState()).toBe('open')

    vi.useFakeTimers()

    // Should still be open before reset timeout
    await expect(breaker.execute()).rejects.toThrow('Circuit breaker is open')
    expect(breaker.getState()).toBe('open')

    // Advance time past reset timeout
    vi.advanceTimersByTime(1001)

    // Next call should transition to half-open and attempt operation
    await expect(breaker.execute()).rejects.toThrow('Always fails')
    expect(breaker.getState()).toBe('open') // Back to open after failure

    vi.useRealTimers()
  })

  test('closes circuit after successful call in half-open state', async () => {
    let shouldFail = true
    const operation = vi.fn(async () => {
      if (shouldFail) throw new Error('Failure')
      return 'success'
    })

    const breaker = new CircuitBreaker(operation, {
      failureThreshold: 1,
      timeoutMs: 1000,
      resetTimeoutMs: 1000
    })

    // Open the circuit
    await expect(breaker.execute()).rejects.toThrow('Failure')
    expect(breaker.getState()).toBe('open')

    vi.useFakeTimers()
    vi.advanceTimersByTime(1001)

    // Now allow success
    shouldFail = false

    // Should succeed and close circuit
    const result = await breaker.execute()
    expect(result).toBe('success')
    expect(breaker.getState()).toBe('closed')
    expect(breaker.getFailureCount()).toBe(0)

    vi.useRealTimers()
  })

  test('enforces operation timeout', async () => {
    const operation = vi.fn(async () => {
      await new Promise(resolve => setTimeout(resolve, 2000))
      return 'success'
    })

    const breaker = new CircuitBreaker(operation, {
      failureThreshold: 5,
      timeoutMs: 1000,
      resetTimeoutMs: 5000
    })

    await expect(breaker.execute()).rejects.toThrow('Operation timed out')
    expect(breaker.getFailureCount()).toBe(1)
  })

  test('can be manually reset', async () => {
    const operation = vi.fn(async () => {
      throw new Error('Always fails')
    })

    const breaker = new CircuitBreaker(operation, { failureThreshold: 1 })

    // Open circuit
    await expect(breaker.execute()).rejects.toThrow('Always fails')
    expect(breaker.getState()).toBe('open')
    expect(breaker.getFailureCount()).toBe(1)

    // Reset manually
    breaker.reset()
    expect(breaker.getState()).toBe('closed')
    expect(breaker.getFailureCount()).toBe(0)

    // Should allow operation again
    await expect(breaker.execute()).rejects.toThrow('Always fails')
    expect(breaker.getFailureCount()).toBe(1)
  })
})

describe('Global Error Handler', () => {
  afterEach(() => {
    // Reset global state
    const handler = getErrorHandler()
    handler.clearStats()
  })

  test('initializes global error handler', () => {
    const config = {
      reportToTelemetry: true,
      telemetryReporter: vi.fn()
    }

    const handler = initializeErrorHandler(config)
    expect(handler).toBeInstanceOf(ErrorHandler)
    expect(getErrorHandler()).toBe(handler)
  })

  test('getErrorHandler creates default handler if none exists', () => {
    const handler1 = getErrorHandler()
    const handler2 = getErrorHandler()

    expect(handler1).toBeInstanceOf(ErrorHandler)
    expect(handler1).toBe(handler2) // Should return same instance
  })

  test('handleError uses global handler', () => {
    const error = new Error('Test error')
    const context = { operation: 'test' }

    const handledError = handleError(error, context)

    expect(handledError).toBeInstanceOf(CurupiraError)
    expect(handledError.metadata?.operation).toBe('test')
  })
})