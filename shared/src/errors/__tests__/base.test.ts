/**
 * @fileoverview Tests for base error classes and utilities
 * 
 * These tests ensure error creation, serialization, and
 * utility functions work correctly.
 */

import { describe, test, expect, vi } from 'vitest'
import {
  CurupiraError,
  isCurupiraError,
  isCurupiraErrorInfo,
  getErrorMessage,
  getErrorCode,
  chainErrors,
  createPublicError,
  assert,
  invariant
} from '../base.js'
import { CurupiraErrorCode } from '../types.js'
import type { CurupiraErrorInfo } from '../types.js'

describe('CurupiraError', () => {
  test('creates error with required properties', () => {
    const errorInfo: CurupiraErrorInfo = {
      code: CurupiraErrorCode.CONFIG_VALIDATION_FAILED,
      category: 'configuration',
      severity: 'high',
      message: 'Configuration validation failed',
      recoverable: false,
      retryable: false
    }

    const error = new CurupiraError(errorInfo)

    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(CurupiraError)
    expect(error.code).toBe(CurupiraErrorCode.CONFIG_VALIDATION_FAILED)
    expect(error.category).toBe('configuration')
    expect(error.severity).toBe('high')
    expect(error.message).toBe('Configuration validation failed')
    expect(error.recoverable).toBe(false)
    expect(error.retryable).toBe(false)
    expect(error.metadata?.timestamp).toBeGreaterThan(0)
  })

  test('includes cause in stack trace', () => {
    const cause = new Error('Original error')
    const errorInfo: CurupiraErrorInfo = {
      code: CurupiraErrorCode.INTERNAL_UNEXPECTED_ERROR,
      category: 'internal',
      severity: 'critical',
      message: 'Wrapped error',
      cause,
      recoverable: false,
      retryable: false
    }

    const error = new CurupiraError(errorInfo)

    expect(error.cause).toBe(cause)
    expect(error.stack).toContain('Caused by:')
    expect(error.stack).toContain('Original error')
  })

  test('creates error from another CurupiraError', () => {
    const original = new CurupiraError({
      code: CurupiraErrorCode.NETWORK_CONNECTION_FAILED,
      category: 'network',
      severity: 'medium',
      message: 'Connection failed',
      recoverable: true,
      retryable: true
    })

    const fromError = CurupiraError.from(original)

    expect(fromError).toBe(original) // Should return same instance
  })

  test('creates error from standard Error', () => {
    const standardError = new Error('Standard error message')
    const curupiraError = CurupiraError.from(standardError)

    expect(curupiraError).toBeInstanceOf(CurupiraError)
    expect(curupiraError.code).toBe(CurupiraErrorCode.INTERNAL_UNEXPECTED_ERROR)
    expect(curupiraError.category).toBe('internal')
    expect(curupiraError.severity).toBe('high')
    expect(curupiraError.message).toBe('Standard error message')
    expect(curupiraError.cause).toBe(standardError)
  })

  test('adds context to error', () => {
    const error = new CurupiraError({
      code: CurupiraErrorCode.VALIDATION_REQUIRED_FIELD,
      category: 'validation',
      severity: 'medium',
      message: 'Field required',
      recoverable: false,
      retryable: false
    })

    const withContext = error.withContext({
      sessionId: 'session-123' as any,
      requestId: 'req-456' as any,
      customField: 'custom-value'
    })

    expect(withContext).toBeInstanceOf(CurupiraError)
    expect(withContext.metadata?.sessionId).toBe('session-123')
    expect(withContext.metadata?.requestId).toBe('req-456')
    expect((withContext.metadata as any).customField).toBe('custom-value')
  })

  test('matches error criteria correctly', () => {
    const error = new CurupiraError({
      code: CurupiraErrorCode.NETWORK_TIMEOUT,
      category: 'network',
      severity: 'medium',
      message: 'Timeout occurred',
      recoverable: true,
      retryable: true
    })

    expect(error.matches({ code: CurupiraErrorCode.NETWORK_TIMEOUT })).toBe(true)
    expect(error.matches({ code: CurupiraErrorCode.CONFIG_LOAD_FAILED })).toBe(false)
    expect(error.matches({ category: 'network' })).toBe(true)
    expect(error.matches({ category: 'validation' })).toBe(false)
    expect(error.matches({ severity: 'medium' })).toBe(true)
    expect(error.matches({ severity: 'high' })).toBe(false)
    
    // Multiple criteria
    expect(error.matches({ 
      category: 'network', 
      severity: 'medium' 
    })).toBe(true)
    expect(error.matches({ 
      category: 'network', 
      severity: 'high' 
    })).toBe(false)

    // Array criteria
    expect(error.matches({ 
      code: [CurupiraErrorCode.NETWORK_TIMEOUT, CurupiraErrorCode.NETWORK_CONNECTION_FAILED]
    })).toBe(true)
  })

  test('provides error classification', () => {
    const recoverableError = new CurupiraError({
      code: CurupiraErrorCode.NETWORK_CONNECTION_FAILED,
      category: 'network',
      severity: 'low',
      message: 'Connection failed',
      recoverable: true,
      retryable: true
    })

    const authError = new CurupiraError({
      code: CurupiraErrorCode.AUTH_TOKEN_EXPIRED,
      category: 'authentication',
      severity: 'high',
      message: 'Token expired',
      recoverable: false,
      retryable: false
    })

    const recoverableClassification = recoverableError.getClassification()
    expect(recoverableClassification.isRecoverable).toBe(true)
    expect(recoverableClassification.isRetryable).toBe(true)
    expect(recoverableClassification.canBeSafelyIgnored).toBe(true)
    expect(recoverableClassification.shouldReportToTelemetry).toBe(false)

    const authClassification = authError.getClassification()
    expect(authClassification.requiresUserAction).toBe(true)
    expect(authClassification.shouldReportToTelemetry).toBe(true)
  })

  test('serializes to JSON correctly', () => {
    const error = new CurupiraError({
      code: CurupiraErrorCode.VALIDATION_INVALID_TYPE,
      category: 'validation',
      severity: 'medium',
      message: 'Invalid type provided',
      details: {
        technical: { field: 'username', expected: 'string', actual: 'number' }
      },
      recoverable: false,
      retryable: false
    })

    const json = error.toJSON()

    expect(json.name).toBe('CurupiraError')
    expect(json.code).toBe(CurupiraErrorCode.VALIDATION_INVALID_TYPE)
    expect(json.category).toBe('validation')
    expect(json.severity).toBe('medium')
    expect(json.message).toBe('Invalid type provided')
    expect(json.details).toEqual({
      technical: { field: 'username', expected: 'string', actual: 'number' }
    })
    expect(json.recoverable).toBe(false)
    expect(json.retryable).toBe(false)
    expect(json.stack).toBeDefined()
  })

  test('provides human-readable summary', () => {
    const error = new CurupiraError({
      code: CurupiraErrorCode.BROWSER_TAB_NOT_FOUND,
      category: 'browser',
      severity: 'medium',
      message: 'Tab not found',
      details: {
        context: { tabId: '123', action: 'inject_script' }
      },
      recoverable: true,
      retryable: true
    })

    const summary = error.getSummary()

    expect(summary).toContain('[1601]') // Error code
    expect(summary).toContain('BROWSER') // Category
    expect(summary).toContain('(medium)') // Severity
    expect(summary).toContain('Tab not found') // Message
    expect(summary).toContain('Context: tabId=123, action=inject_script') // Context
  })
})

describe('Type Guards', () => {
  test('isCurupiraError identifies CurupiraError instances', () => {
    const curupiraError = new CurupiraError({
      code: CurupiraErrorCode.CONFIG_LOAD_FAILED,
      category: 'configuration',
      severity: 'high',
      message: 'Config load failed',
      recoverable: false,
      retryable: true
    })
    const standardError = new Error('Standard error')
    const notAnError = 'string error'

    expect(isCurupiraError(curupiraError)).toBe(true)
    expect(isCurupiraError(standardError)).toBe(false)
    expect(isCurupiraError(notAnError)).toBe(false)
    expect(isCurupiraError(null)).toBe(false)
    expect(isCurupiraError(undefined)).toBe(false)
  })

  test('isCurupiraErrorInfo identifies error info objects', () => {
    const validErrorInfo = {
      code: CurupiraErrorCode.PROTOCOL_INVALID_MESSAGE,
      category: 'protocol' as const,
      severity: 'medium' as const,
      message: 'Invalid message',
      recoverable: false,
      retryable: false
    }

    const invalidErrorInfo = {
      code: CurupiraErrorCode.PROTOCOL_INVALID_MESSAGE,
      category: 'protocol',
      // missing other required fields
    }

    expect(isCurupiraErrorInfo(validErrorInfo)).toBe(true)
    expect(isCurupiraErrorInfo(invalidErrorInfo)).toBe(false)
    expect(isCurupiraErrorInfo(new Error())).toBe(false)
    expect(isCurupiraErrorInfo('string')).toBe(false)
    expect(isCurupiraErrorInfo(null)).toBe(false)
  })
})

describe('Utility Functions', () => {
  test('getErrorMessage extracts messages correctly', () => {
    expect(getErrorMessage('string error')).toBe('string error')
    expect(getErrorMessage(new Error('standard error'))).toBe('standard error')
    
    const curupiraError = new CurupiraError({
      code: CurupiraErrorCode.NETWORK_CONNECTION_FAILED,
      category: 'network',
      severity: 'medium',
      message: 'curupira error message',
      recoverable: true,
      retryable: true
    })
    expect(getErrorMessage(curupiraError)).toBe('curupira error message')
    
    expect(getErrorMessage(null)).toBe('Unknown error occurred')
    expect(getErrorMessage(undefined)).toBe('Unknown error occurred')
    expect(getErrorMessage({})).toBe('Unknown error occurred')
  })

  test('getErrorCode extracts codes correctly', () => {
    const curupiraError = new CurupiraError({
      code: CurupiraErrorCode.AUTH_TOKEN_EXPIRED,
      category: 'authentication',
      severity: 'high',
      message: 'Token expired',
      recoverable: false,
      retryable: false
    })

    expect(getErrorCode(curupiraError)).toBe(CurupiraErrorCode.AUTH_TOKEN_EXPIRED)
    expect(getErrorCode(new Error('standard'))).toBeUndefined()
    expect(getErrorCode('string')).toBeUndefined()
    expect(getErrorCode(null)).toBeUndefined()
  })

  test('chainErrors creates proper error chain', () => {
    const cause = new Error('Original cause')
    const parentError: CurupiraErrorInfo = {
      code: CurupiraErrorCode.INTERNAL_DEPENDENCY_FAILED,
      category: 'internal',
      severity: 'high',
      message: 'Dependency failed',
      recoverable: false,
      retryable: true
    }

    const chainedError = chainErrors(parentError, cause)

    expect(chainedError).toBeInstanceOf(CurupiraError)
    expect(chainedError.cause).toBe(cause)
    expect(chainedError.code).toBe(CurupiraErrorCode.INTERNAL_DEPENDENCY_FAILED)
    expect(chainedError.message).toBe('Dependency failed')
  })

  test('createPublicError creates safe public representation', () => {
    const error = new CurupiraError({
      code: CurupiraErrorCode.INTERNAL_UNEXPECTED_ERROR,
      category: 'internal',
      severity: 'critical',
      message: 'Internal error with sensitive data',
      details: {
        technical: { sensitiveKey: 'secret-value' }
      },
      recoverable: false,
      retryable: false
    })

    const publicError = createPublicError(error)

    expect(publicError).toEqual({
      code: CurupiraErrorCode.INTERNAL_UNEXPECTED_ERROR.toString(),
      message: 'Internal error with sensitive data',
      category: 'internal',
      severity: 'critical',
      recoverable: false,
      retryable: false
    })

    // Should not include details or other sensitive data
    expect('details' in publicError).toBe(false)
    expect('metadata' in publicError).toBe(false)
  })
})

describe('Assertions', () => {
  test('assert passes for truthy conditions', () => {
    expect(() => assert(true, 'Should pass')).not.toThrow()
    expect(() => assert(1, 'Should pass')).not.toThrow()
    expect(() => assert('string', 'Should pass')).not.toThrow()
    expect(() => assert([], 'Should pass')).not.toThrow()
    expect(() => assert({}, 'Should pass')).not.toThrow()
  })

  test('assert throws for falsy conditions', () => {
    expect(() => assert(false, 'Should fail')).toThrow(CurupiraError)
    expect(() => assert(0, 'Should fail')).toThrow(CurupiraError)
    expect(() => assert('', 'Should fail')).toThrow(CurupiraError)
    expect(() => assert(null, 'Should fail')).toThrow(CurupiraError)
    expect(() => assert(undefined, 'Should fail')).toThrow(CurupiraError)

    try {
      assert(false, 'Test assertion')
    } catch (error) {
      expect(error).toBeInstanceOf(CurupiraError)
      const curupiraError = error as CurupiraError
      expect(curupiraError.code).toBe(CurupiraErrorCode.INTERNAL_ASSERTION_FAILED)
      expect(curupiraError.category).toBe('internal')
      expect(curupiraError.severity).toBe('critical')
      expect(curupiraError.message).toContain('Assertion failed: Test assertion')
    }
  })

  test('assert allows custom error codes', () => {
    try {
      assert(false, 'Custom assertion', CurupiraErrorCode.VALIDATION_REQUIRED_FIELD)
    } catch (error) {
      const curupiraError = error as CurupiraError
      expect(curupiraError.code).toBe(CurupiraErrorCode.VALIDATION_REQUIRED_FIELD)
    }
  })

  test('invariant throws with invariant violation code', () => {
    expect(() => invariant(true, 'Should pass')).not.toThrow()
    
    try {
      invariant(false, 'Test invariant')
    } catch (error) {
      expect(error).toBeInstanceOf(CurupiraError)
      const curupiraError = error as CurupiraError
      expect(curupiraError.code).toBe(CurupiraErrorCode.INTERNAL_INVARIANT_VIOLATION)
      expect(curupiraError.message).toContain('Assertion failed: Test invariant')
    }
  })
})

describe('Error Stack Traces', () => {
  test('maintains proper stack trace', () => {
    function throwCurupiraError() {
      throw new CurupiraError({
        code: CurupiraErrorCode.VALIDATION_REQUIRED_FIELD,
        category: 'validation',
        severity: 'medium',
        message: 'Required field missing',
        recoverable: false,
        retryable: false
      })
    }

    try {
      throwCurupiraError()
    } catch (error) {
      expect(error).toBeInstanceOf(CurupiraError)
      expect(error.stack).toContain('throwCurupiraError')
      expect(error.stack).toContain('Required field missing')
    }
  })

  test('includes cause stack trace', () => {
    function throwCauseError() {
      throw new Error('Original cause error')
    }

    function throwWrappedError() {
      try {
        throwCauseError()
      } catch (cause) {
        throw new CurupiraError({
          code: CurupiraErrorCode.INTERNAL_UNEXPECTED_ERROR,
          category: 'internal',
          severity: 'high',
          message: 'Wrapped error',
          cause: cause as Error,
          recoverable: false,
          retryable: false
        })
      }
    }

    try {
      throwWrappedError()
    } catch (error) {
      expect(error).toBeInstanceOf(CurupiraError)
      expect(error.stack).toContain('throwWrappedError')
      expect(error.stack).toContain('Caused by:')
      expect(error.stack).toContain('throwCauseError')
      expect(error.stack).toContain('Original cause error')
    }
  })
})