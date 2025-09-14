/**
 * @fileoverview Tests for error factory functions
 * 
 * These tests ensure error factories create errors with correct
 * properties, defaults, and context information.
 */

import { describe, test, expect } from 'vitest'
import {
  ConfigurationErrors,
  NetworkErrors,
  ProtocolErrors,
  ValidationErrors,
  BrowserErrors,
  ExtensionErrors,
  StateErrors,
  PerformanceErrors,
  InternalErrors
} from '../factories.js'
import { CurupiraErrorCode } from '../types.js'
import { isCurupiraError } from '../base.js'

describe('Configuration Errors', () => {
  test('validationFailed creates proper error', () => {
    const error = ConfigurationErrors.validationFailed(
      'Schema validation failed',
      { technical: { field: 'port', value: -1 } },
      { sessionId: 'session-123' as any }
    )

    expect(isCurupiraError(error)).toBe(true)
    expect(error.code).toBe(CurupiraErrorCode.CONFIG_VALIDATION_FAILED)
    expect(error.category).toBe('configuration')
    expect(error.severity).toBe('high')
    expect(error.message).toBe('Schema validation failed')
    expect(error.recoverable).toBe(false)
    expect(error.retryable).toBe(false)
    expect(error.details?.technical).toEqual({ field: 'port', value: -1 })
    expect(error.metadata?.sessionId).toBe('session-123')
  })

  test('missingRequired creates descriptive error', () => {
    const error = ConfigurationErrors.missingRequired('apiKey')

    expect(error.code).toBe(CurupiraErrorCode.CONFIG_MISSING_REQUIRED)
    expect(error.message).toBe('Required configuration field missing: apiKey')
    expect(error.details?.technical).toEqual({ fieldName: 'apiKey' })
    expect(error.details?.suggestions).toContain("Add the required field 'apiKey' to your configuration")
  })

  test('invalidFormat creates detailed error', () => {
    const error = ConfigurationErrors.invalidFormat(
      'email',
      'user@domain.com',
      'not-an-email',
      { requestId: 'req-456' as any }
    )

    expect(error.code).toBe(CurupiraErrorCode.CONFIG_INVALID_FORMAT)
    expect(error.message).toBe("Configuration field 'email' has invalid format")
    expect(error.details?.technical).toEqual({
      fieldName: 'email',
      expectedFormat: 'user@domain.com',
      actualValue: 'not-an-email'
    })
    expect(error.metadata?.requestId).toBe('req-456')
  })

  test('loadFailed creates retryable error', () => {
    const error = ConfigurationErrors.loadFailed(
      '/etc/curupira/config.json',
      'Permission denied'
    )

    expect(error.code).toBe(CurupiraErrorCode.CONFIG_LOAD_FAILED)
    expect(error.severity).toBe('critical')
    expect(error.retryable).toBe(true)
    expect(error.retryDelay).toBe(5000)
    expect(error.message).toContain('/etc/curupira/config.json')
    expect(error.message).toContain('Permission denied')
  })
})

describe('Network Errors', () => {
  test('connectionFailed creates retryable error', () => {
    const error = NetworkErrors.connectionFailed(
      'https://api.example.com',
      'Connection refused',
      { tabId: 123 as any }
    )

    expect(error.code).toBe(CurupiraErrorCode.NETWORK_CONNECTION_FAILED)
    expect(error.category).toBe('network')
    expect(error.severity).toBe('medium')
    expect(error.recoverable).toBe(true)
    expect(error.retryable).toBe(true)
    expect(error.retryDelay).toBe(1000)
    expect(error.metadata?.tabId).toBe(123)
    expect(error.details?.suggestions).toContain('Check network connectivity')
  })

  test('timeout creates error with endpoint info', () => {
    const error = NetworkErrors.timeout('wss://websocket.example.com', 30000)

    expect(error.code).toBe(CurupiraErrorCode.NETWORK_TIMEOUT)
    expect(error.message).toBe('Request to wss://websocket.example.com timed out after 30000ms')
    expect(error.retryDelay).toBe(2000)
    expect(error.details?.technical).toEqual({
      endpoint: 'wss://websocket.example.com',
      timeoutMs: 30000
    })
  })

  test('rateLimited respects retry-after header', () => {
    const error = NetworkErrors.rateLimited('https://api.example.com/v1', 120)

    expect(error.code).toBe(CurupiraErrorCode.NETWORK_RATE_LIMITED)
    expect(error.severity).toBe('low')
    expect(error.retryDelay).toBe(120000) // 120 seconds * 1000ms
    expect(error.details?.suggestions).toContain('Reduce request frequency')
  })
})

describe('Protocol Errors', () => {
  test('invalidMessage creates non-retryable error', () => {
    const messageData = { invalid: 'structure' }
    const error = ProtocolErrors.invalidMessage(
      'Missing required jsonrpc field',
      messageData,
      { componentId: 'mcp-client' as any }
    )

    expect(error.code).toBe(CurupiraErrorCode.PROTOCOL_INVALID_MESSAGE)
    expect(error.category).toBe('protocol')
    expect(error.retryable).toBe(false)
    expect(error.details?.technical).toEqual({
      reason: 'Missing required jsonrpc field',
      messageData
    })
    expect(error.metadata?.componentId).toBe('mcp-client')
  })

  test('unsupportedVersion lists supported versions', () => {
    const supportedVersions = ['2.0', '2.1']
    const error = ProtocolErrors.unsupportedVersion('1.0', supportedVersions)

    expect(error.code).toBe(CurupiraErrorCode.PROTOCOL_UNSUPPORTED_VERSION)
    expect(error.severity).toBe('high')
    expect(error.message).toBe('Unsupported protocol version: 1.0')
    expect(error.details?.technical).toEqual({
      receivedVersion: '1.0',
      supportedVersions
    })
    expect(error.details?.suggestions?.[0]).toContain('2.0, 2.1')
  })

  test('messageTooLarge includes size information', () => {
    const error = ProtocolErrors.messageTooLarge(2048576, 1048576)

    expect(error.code).toBe(CurupiraErrorCode.PROTOCOL_MESSAGE_TOO_LARGE)
    expect(error.message).toContain('2048576 bytes exceeds maximum 1048576 bytes')
    expect(error.details?.technical).toEqual({
      messageSize: 2048576,
      maxSize: 1048576
    })
  })
})

describe('Validation Errors', () => {
  test('requiredField creates clear error message', () => {
    const error = ValidationErrors.requiredField('username')

    expect(error.code).toBe(CurupiraErrorCode.VALIDATION_REQUIRED_FIELD)
    expect(error.category).toBe('validation')
    expect(error.message).toBe('Required field missing: username')
    expect(error.recoverable).toBe(false)
    expect(error.retryable).toBe(false)
    expect(error.details?.suggestions).toContain("Provide a value for the required field 'username'")
  })

  test('invalidType shows expected vs actual types', () => {
    const error = ValidationErrors.invalidType('age', 'number', 'string')

    expect(error.code).toBe(CurupiraErrorCode.VALIDATION_INVALID_TYPE)
    expect(error.message).toBe("Field 'age' expected number, got string")
    expect(error.details?.technical).toEqual({
      fieldName: 'age',
      expectedType: 'number',
      actualType: 'string'
    })
  })

  test('outOfRange includes range information', () => {
    const error = ValidationErrors.outOfRange('port', 70000, 1024, 65535)

    expect(error.code).toBe(CurupiraErrorCode.VALIDATION_OUT_OF_RANGE)
    expect(error.message).toBe("Field 'port' value 70000 is out of range")
    expect(error.details?.technical).toEqual({
      fieldName: 'port',
      value: 70000,
      min: 1024,
      max: 65535
    })
    expect(error.details?.suggestions?.[0]).toContain('between 1024 and 65535')
  })
})

describe('Browser Errors', () => {
  test('tabNotFound creates recoverable error', () => {
    const tabId = 456 as any
    const error = BrowserErrors.tabNotFound(tabId)

    expect(error.code).toBe(CurupiraErrorCode.BROWSER_TAB_NOT_FOUND)
    expect(error.category).toBe('browser')
    expect(error.recoverable).toBe(true)
    expect(error.retryable).toBe(true)
    expect(error.retryDelay).toBe(1000)
    expect(error.details?.technical).toEqual({ tabId })
  })

  test('permissionDenied creates non-recoverable error', () => {
    const error = BrowserErrors.permissionDenied('activeTab')

    expect(error.code).toBe(CurupiraErrorCode.BROWSER_PERMISSION_DENIED)
    expect(error.severity).toBe('high')
    expect(error.recoverable).toBe(false)
    expect(error.retryable).toBe(false)
    expect(error.message).toBe('Browser permission denied: activeTab')
  })

  test('scriptInjectionFailed includes context', () => {
    const tabId = 789 as any
    const error = BrowserErrors.scriptInjectionFailed(
      tabId,
      'content-script.js',
      'CSP violation'
    )

    expect(error.code).toBe(CurupiraErrorCode.BROWSER_SCRIPT_INJECTION_FAILED)
    expect(error.retryable).toBe(true)
    expect(error.details?.technical).toEqual({
      tabId,
      scriptName: 'content-script.js',
      reason: 'CSP violation'
    })
  })
})

describe('Extension Errors', () => {
  test('notInstalled creates critical non-recoverable error', () => {
    const error = ExtensionErrors.notInstalled()

    expect(error.code).toBe(CurupiraErrorCode.EXTENSION_NOT_INSTALLED)
    expect(error.category).toBe('extension')
    expect(error.severity).toBe('critical')
    expect(error.recoverable).toBe(false)
    expect(error.retryable).toBe(false)
    expect(error.details?.documentation).toContain('https://docs.curupira.dev/installation')
  })

  test('connectionLost creates recoverable error', () => {
    const error = ExtensionErrors.connectionLost()

    expect(error.code).toBe(CurupiraErrorCode.EXTENSION_CONNECTION_LOST)
    expect(error.severity).toBe('high')
    expect(error.recoverable).toBe(true)
    expect(error.retryable).toBe(true)
    expect(error.retryDelay).toBe(3000)
  })
})

describe('State Errors', () => {
  test('storeNotFound creates retryable error', () => {
    const error = StateErrors.storeNotFound('user-store')

    expect(error.code).toBe(CurupiraErrorCode.STATE_STORE_NOT_FOUND)
    expect(error.category).toBe('state')
    expect(error.retryable).toBe(true)
    expect(error.retryDelay).toBe(1000)
    expect(error.details?.technical).toEqual({ storeId: 'user-store' })
  })

  test('snapshotFailed includes reason', () => {
    const error = StateErrors.snapshotFailed('auth-store', 'Circular reference detected')

    expect(error.code).toBe(CurupiraErrorCode.STATE_SNAPSHOT_FAILED)
    expect(error.recoverable).toBe(true)
    expect(error.details?.technical).toEqual({
      storeId: 'auth-store',
      reason: 'Circular reference detected'
    })
    expect(error.details?.suggestions).toContain('Ensure no circular references in state')
  })
})

describe('Performance Errors', () => {
  test('timeout creates retryable error with adaptive delay', () => {
    const error = PerformanceErrors.timeout('database-query', 5000)

    expect(error.code).toBe(CurupiraErrorCode.PERFORMANCE_TIMEOUT)
    expect(error.category).toBe('performance')
    expect(error.retryable).toBe(true)
    expect(error.retryDelay).toBe(2500) // 50% of timeout, capped at 10000
    expect(error.details?.technical).toEqual({
      operation: 'database-query',
      timeoutMs: 5000
    })
  })

  test('memoryLimit caps retry delay', () => {
    const error = PerformanceErrors.timeout('large-operation', 30000)
    
    expect(error.retryDelay).toBe(10000) // Capped at max delay
  })

  test('memoryLimit creates non-retryable error', () => {
    const error = PerformanceErrors.memoryLimit(150, 100)

    expect(error.code).toBe(CurupiraErrorCode.PERFORMANCE_MEMORY_LIMIT)
    expect(error.severity).toBe('high')
    expect(error.recoverable).toBe(true)
    expect(error.retryable).toBe(false)
    expect(error.details?.technical).toEqual({
      currentUsage: 150,
      limit: 100
    })
  })
})

describe('Internal Errors', () => {
  test('unexpected creates critical error', () => {
    const cause = new Error('Original error')
    const error = InternalErrors.unexpected('Something went wrong', cause)

    expect(error.code).toBe(CurupiraErrorCode.INTERNAL_UNEXPECTED_ERROR)
    expect(error.category).toBe('internal')
    expect(error.severity).toBe('critical')
    expect(error.cause).toBe(cause)
    expect(error.recoverable).toBe(false)
    expect(error.retryable).toBe(false)
  })

  test('assertionFailed creates critical non-retryable error', () => {
    const error = InternalErrors.assertionFailed('user should be authenticated')

    expect(error.code).toBe(CurupiraErrorCode.INTERNAL_ASSERTION_FAILED)
    expect(error.severity).toBe('critical')
    expect(error.message).toBe('Assertion failed: user should be authenticated')
  })

  test('resourceExhausted creates retryable error', () => {
    const error = InternalErrors.resourceExhausted('file descriptors')

    expect(error.code).toBe(CurupiraErrorCode.INTERNAL_RESOURCE_EXHAUSTED)
    expect(error.recoverable).toBe(true)
    expect(error.retryable).toBe(true)
    expect(error.retryDelay).toBe(5000)
    expect(error.details?.technical).toEqual({ resource: 'file descriptors' })
  })
})

describe('Error Context', () => {
  test('all factories accept context parameters', () => {
    const context = {
      sessionId: 'session-abc' as any,
      requestId: 'req-def' as any,
      tabId: 123 as any,
      componentId: 'test-component' as any,
      userId: 'user-789'
    }

    const configError = ConfigurationErrors.validationFailed('test', undefined, context)
    const networkError = NetworkErrors.connectionFailed('test', undefined, context)
    const protocolError = ProtocolErrors.invalidMessage('test', undefined, context)
    const validationError = ValidationErrors.requiredField('test', context)
    const browserError = BrowserErrors.tabNotFound(123 as any, context)
    const extensionError = ExtensionErrors.connectionLost(context)
    const stateError = StateErrors.storeNotFound('test', context)
    const performanceError = PerformanceErrors.timeout('test', 1000, context)
    const internalError = InternalErrors.unexpected('test', undefined, context)

    const errors = [
      configError, networkError, protocolError, validationError, browserError,
      extensionError, stateError, performanceError, internalError
    ]

    errors.forEach(error => {
      expect(error.metadata?.sessionId).toBe('session-abc')
      expect(error.metadata?.requestId).toBe('req-def')
      expect(error.metadata?.tabId).toBe(123)
      expect(error.metadata?.componentId).toBe('test-component')
      expect(error.metadata?.userId).toBe('user-789')
    })
  })

  test('metadata includes timestamp', () => {
    const before = Date.now()
    const error = ConfigurationErrors.validationFailed('test')
    const after = Date.now()

    expect(error.metadata?.timestamp).toBeGreaterThanOrEqual(before)
    expect(error.metadata?.timestamp).toBeLessThanOrEqual(after)
  })
})

describe('Error Suggestions and Documentation', () => {
  test('errors include helpful suggestions', () => {
    const configError = ConfigurationErrors.missingRequired('apiKey')
    const networkError = NetworkErrors.connectionFailed('https://api.example.com')
    const browserError = BrowserErrors.permissionDenied('tabs')

    expect(configError.details?.suggestions).toBeDefined()
    expect(configError.details?.suggestions?.length).toBeGreaterThan(0)
    
    expect(networkError.details?.suggestions).toBeDefined()
    expect(networkError.details?.suggestions?.length).toBeGreaterThan(0)
    
    expect(browserError.details?.suggestions).toBeDefined()
    expect(browserError.details?.suggestions?.length).toBeGreaterThan(0)
  })

  test('some errors include documentation links', () => {
    const extensionError = ExtensionErrors.notInstalled()

    expect(extensionError.details?.documentation).toBeDefined()
    expect(extensionError.details?.documentation?.length).toBeGreaterThan(0)
    expect(extensionError.details?.documentation?.[0]).toContain('https://')
  })
})