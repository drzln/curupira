/**
 * @fileoverview Base error classes and utilities
 * 
 * This file provides the base error class and utility functions
 * for creating, handling, and working with Curupira errors.
 */

import { CurupiraErrorCode } from './types.js'
import type {
  CurupiraErrorInfo,
  CurupiraErrorType,
  ErrorCategory,
  ErrorSeverity,
  ErrorDetails,
  ErrorMetadata,
  ErrorClassification
} from './types.js'
import type {
  SessionId,
  RequestId,
  TabId,
  ComponentId,
  Timestamp
} from '../types/index.js'

/**
 * Base error class for all Curupira errors
 */
export class CurupiraError extends Error implements CurupiraErrorInfo {
  public readonly code: CurupiraErrorCode
  public readonly category: ErrorCategory
  public readonly severity: ErrorSeverity
  public readonly details?: ErrorDetails
  public readonly metadata?: ErrorMetadata
  public readonly cause?: Error | CurupiraErrorInfo
  public readonly recoverable: boolean
  public readonly retryable: boolean
  public readonly retryDelay?: number

  constructor(info: CurupiraErrorInfo) {
    super(info.message)
    
    this.name = 'CurupiraError'
    this.code = info.code
    this.category = info.category
    this.severity = info.severity
    this.details = info.details
    this.metadata = {
      timestamp: Date.now() as Timestamp,
      ...info.metadata
    }
    this.cause = info.cause
    this.recoverable = info.recoverable
    this.retryable = info.retryable
    this.retryDelay = info.retryDelay

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CurupiraError)
    }

    // Include cause in stack trace if available
    if (this.cause instanceof Error) {
      this.stack += '\nCaused by: ' + this.cause.stack
    }
  }

  /**
   * Create error from another error or error info
   */
  static from(error: Error | CurupiraErrorInfo): CurupiraError {
    if (error instanceof CurupiraError) {
      return error
    }
    
    if ('code' in error && 'category' in error) {
      return new CurupiraError(error as CurupiraErrorInfo)
    }

    // Convert standard Error to CurupiraError
    return new CurupiraError({
      code: CurupiraErrorCode.INTERNAL_UNEXPECTED_ERROR,
      category: 'internal',
      severity: 'high',
      message: error.message || 'An unexpected error occurred',
      cause: error,
      recoverable: false,
      retryable: false,
      metadata: {
        timestamp: Date.now() as Timestamp,
        stackTrace: error.stack
      }
    })
  }

  /**
   * Create error with additional context
   */
  withContext(context: {
    sessionId?: SessionId
    requestId?: RequestId
    tabId?: TabId
    componentId?: ComponentId
    userId?: string
    [key: string]: unknown
  }): CurupiraError {
    return new CurupiraError({
      code: this.code,
      category: this.category,
      severity: this.severity,
      message: this.message,
      details: this.details,
      cause: this.cause,
      recoverable: this.recoverable,
      retryable: this.retryable,
      retryDelay: this.retryDelay,
      metadata: {
        ...this.metadata,
        ...context,
        timestamp: this.metadata?.timestamp || Date.now() as Timestamp
      }
    })
  }

  /**
   * Check if error matches specific criteria
   */
  matches(criteria: {
    code?: CurupiraErrorCode | CurupiraErrorCode[]
    category?: ErrorCategory | ErrorCategory[]
    severity?: ErrorSeverity | ErrorSeverity[]
  }): boolean {
    if (criteria.code) {
      const codes = Array.isArray(criteria.code) ? criteria.code : [criteria.code]
      if (!codes.includes(this.code)) return false
    }

    if (criteria.category) {
      const categories = Array.isArray(criteria.category) ? criteria.category : [criteria.category]
      if (!categories.includes(this.category)) return false
    }

    if (criteria.severity) {
      const severities = Array.isArray(criteria.severity) ? criteria.severity : [criteria.severity]
      if (!severities.includes(this.severity)) return false
    }

    return true
  }

  /**
   * Get error classification for handling decisions
   */
  getClassification(): ErrorClassification {
    return {
      isRecoverable: this.recoverable,
      isRetryable: this.retryable,
      requiresUserAction: this.category === 'authentication' || this.category === 'authorization',
      canBeSafelyIgnored: this.severity === 'low' && this.recoverable,
      shouldReportToTelemetry: this.severity !== 'low'
    }
  }

  /**
   * Convert to JSON for serialization
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      category: this.category,
      severity: this.severity,
      details: this.details,
      metadata: this.metadata,
      recoverable: this.recoverable,
      retryable: this.retryable,
      retryDelay: this.retryDelay,
      stack: this.stack,
      cause: this.cause instanceof Error ? {
        name: this.cause.name,
        message: this.cause.message,
        stack: this.cause.stack
      } : this.cause
    }
  }

  /**
   * Get human-readable summary
   */
  getSummary(): string {
    const parts = [
      `[${this.code}]`,
      `${this.category.toUpperCase()}`,
      `(${this.severity})`,
      this.message
    ]

    if (this.details?.context) {
      const contextEntries = Object.entries(this.details.context)
      if (contextEntries.length > 0) {
        parts.push(`- Context: ${contextEntries.map(([k, v]) => `${k}=${v}`).join(', ')}`)
      }
    }

    return parts.join(' ')
  }
}

/**
 * Type guard to check if error is a CurupiraError
 */
export function isCurupiraError(error: unknown): error is CurupiraError {
  return error instanceof CurupiraError
}

/**
 * Type guard to check if error has CurupiraErrorInfo structure
 */
export function isCurupiraErrorInfo(error: unknown): error is CurupiraErrorInfo {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'category' in error &&
    'severity' in error &&
    'message' in error &&
    'recoverable' in error &&
    'retryable' in error
  )
}

/**
 * Utility to safely extract error message
 */
export function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  if (isCurupiraErrorInfo(error)) return error.message
  return 'Unknown error occurred'
}

/**
 * Utility to safely extract error code
 */
export function getErrorCode(error: unknown): CurupiraErrorCode | undefined {
  if (isCurupiraError(error) || isCurupiraErrorInfo(error)) {
    return error.code
  }
  return undefined
}

/**
 * Chain errors by wrapping one error as the cause of another
 */
export function chainErrors(
  parentError: CurupiraErrorInfo,
  cause: Error | CurupiraErrorInfo
): CurupiraError {
  return new CurupiraError({
    ...parentError,
    cause,
    metadata: {
      timestamp: Date.now() as Timestamp,
      ...parentError.metadata
    }
  })
}

/**
 * Create a simplified error for external APIs
 */
export function createPublicError(error: CurupiraError): {
  code: string
  message: string
  category: string
  severity: string
  recoverable: boolean
  retryable: boolean
} {
  return {
    code: error.code.toString(),
    message: error.message,
    category: error.category,
    severity: error.severity,
    recoverable: error.recoverable,
    retryable: error.retryable
  }
}

/**
 * Assert that a condition is true, throw CurupiraError if not
 */
export function assert(
  condition: unknown,
  message: string,
  code = CurupiraErrorCode.INTERNAL_ASSERTION_FAILED
): asserts condition {
  if (!condition) {
    throw new CurupiraError({
      code,
      category: 'internal',
      severity: 'critical',
      message: `Assertion failed: ${message}`,
      recoverable: false,
      retryable: false,
      metadata: {
        timestamp: Date.now() as Timestamp,
        stackTrace: new Error().stack
      }
    })
  }
}

/**
 * Check invariant condition, throw error if violated
 */
export function invariant(
  condition: unknown,
  message: string
): asserts condition {
  assert(condition, message, CurupiraErrorCode.INTERNAL_INVARIANT_VIOLATION)
}