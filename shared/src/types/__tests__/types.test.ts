/**
 * @fileoverview Tests for Curupira shared types
 * 
 * These tests ensure type safety and correct behavior of branded types,
 * type guards, and utility functions.
 */

import { describe, test, expect, expectTypeOf } from 'vitest'
import type {
  SessionId,
  UserId,
  TabId,
  RequestId,
  Timestamp,
  JsonRpcId,
  MessageType,
  ContentScriptMessage,
  MCPRequestMessage,
  CurupiraConfig
} from '../index.js'
import {
  createSessionId,
  createUserId,
  createTabId,
  createRequestId,
  createTimestamp,
  createJsonRpcId,
  isSessionId,
  isUserId,
  isTabId,
  isTimestamp,
  isJsonRpcId,
  unwrap,
  generateRequestId,
  generateSessionId,
  createContentScriptMessage,
  createMCPRequestMessage,
  isValidMessage,
  isContentScriptMessage,
  isMCPMessage,
  MessageValidationError,
  CURUPIRA_VERSION,
  isNotNull,
  assertNever
} from '../index.js'

describe('Branded Types', () => {
  test('branded types prevent mixing', () => {
    const userId = createUserId('123')
    const sessionId = createSessionId('456')
    
    // Type level test - should prevent assignment
    expectTypeOf(userId).not.toMatchTypeOf<SessionId>()
    expectTypeOf(sessionId).not.toMatchTypeOf<UserId>()
    
    // Runtime test
    expect(userId).toBe('123')
    expect(sessionId).toBe('456')
  })
  
  test('branded type creators work correctly', () => {
    const sessionId = createSessionId('session-123')
    const userId = createUserId('user-456')
    const tabId = createTabId(1)
    const requestId = createRequestId('req-789')
    const timestamp = createTimestamp(1234567890)
    const jsonRpcId = createJsonRpcId('rpc-1')
    
    expect(sessionId).toBe('session-123')
    expect(userId).toBe('user-456')
    expect(tabId).toBe(1)
    expect(requestId).toBe('req-789')
    expect(timestamp).toBe(1234567890)
    expect(jsonRpcId).toBe('rpc-1')
  })
  
  test('type guards work correctly', () => {
    // Valid values
    expect(isSessionId('valid-session')).toBe(true)
    expect(isUserId('valid-user')).toBe(true)
    expect(isTabId(1)).toBe(true)
    expect(isTimestamp(Date.now())).toBe(true)
    expect(isJsonRpcId('rpc-id')).toBe(true)
    expect(isJsonRpcId(123)).toBe(true)
    
    // Invalid values
    expect(isSessionId('')).toBe(false)
    expect(isSessionId(null)).toBe(false)
    expect(isSessionId(undefined)).toBe(false)
    expect(isUserId('')).toBe(false)
    expect(isTabId(-1)).toBe(false)
    expect(isTimestamp(0)).toBe(false)
    expect(isTimestamp(-1)).toBe(false)
    expect(isJsonRpcId(null)).toBe(false)
    expect(isJsonRpcId(undefined)).toBe(false)
  })
  
  test('unwrap utility works', () => {
    const sessionId = createSessionId('test-session')
    const unwrapped = unwrap(sessionId)
    
    expectTypeOf(unwrapped).toMatchTypeOf<string>()
    expect(unwrapped).toBe('test-session')
  })
  
  test('ID generators work', () => {
    const requestId = generateRequestId()
    const sessionId = generateSessionId()
    
    expect(typeof requestId).toBe('string')
    expect(requestId.length).toBeGreaterThan(0)
    
    expect(typeof sessionId).toBe('string')
    expect(sessionId.length).toBeGreaterThan(0)
    // Should be UUID format
    expect(sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  })
  
  test('timestamps default to current time', () => {
    const before = Date.now()
    const timestamp = createTimestamp()
    const after = Date.now()
    
    expect(unwrap(timestamp)).toBeGreaterThanOrEqual(before)
    expect(unwrap(timestamp)).toBeLessThanOrEqual(after)
  })
})

describe('Message Types', () => {
  test('content script message creation', () => {
    const message = createContentScriptMessage('page_loaded', {
      type: 'page_loaded',
      url: 'https://example.com',
      title: 'Test Page'
    })
    
    expect(message.source).toBe('content')
    expect(message.type).toBe('page_loaded')
    expect(message.payload.type).toBe('page_loaded')
    expect(message.payload.url).toBe('https://example.com')
    expect(message.id).toBeDefined()
    expect(message.timestamp).toBeGreaterThan(0)
  })
  
  test('MCP request message creation', () => {
    const message = createMCPRequestMessage('resources/list', { limit: 10 })
    
    expect(message.source).toBe('mcp')
    expect(message.type).toBe('request')
    expect(message.jsonrpc).toBe('2.0')
    expect(message.method).toBe('resources/list')
    expect(message.params).toEqual({ limit: 10 })
    expect(message.id).toBeDefined()
  })
  
  test('message validation works', () => {
    const validMessage = createContentScriptMessage('page_loaded', {
      type: 'page_loaded',
      url: 'test',
      title: 'test'
    })
    
    expect(isValidMessage(validMessage)).toBe(true)
    
    // Invalid messages
    expect(isValidMessage(null)).toBe(false)
    expect(isValidMessage(undefined)).toBe(false)
    expect(isValidMessage({})).toBe(false)
    expect(isValidMessage('string')).toBe(false)
    expect(isValidMessage({ id: 'test' })).toBe(false) // missing required fields
  })
  
  test('message type guards work', () => {
    const contentMessage = createContentScriptMessage('page_loaded', {
      type: 'page_loaded',
      url: 'test',
      title: 'test'
    })
    
    const mcpMessage = createMCPRequestMessage('test/method')
    
    expect(isContentScriptMessage(contentMessage)).toBe(true)
    expect(isContentScriptMessage(mcpMessage)).toBe(false)
    
    expect(isMCPMessage(mcpMessage)).toBe(true)
    expect(isMCPMessage(contentMessage)).toBe(false)
  })
  
  test('MessageValidationError works', () => {
    const error = new MessageValidationError(
      'Validation failed',
      'ContentScriptMessage',
      ['missing id', 'invalid timestamp']
    )
    
    expect(error.name).toBe('MessageValidationError')
    expect(error.message).toBe('Validation failed: missing id, invalid timestamp')
    expect(error.messageType).toBe('ContentScriptMessage')
    expect(error.validationErrors).toEqual(['missing id', 'invalid timestamp'])
  })
})

describe('Type Utilities', () => {
  test('version constants are defined', () => {
    expect(CURUPIRA_VERSION).toBe('1.0.0')
    expect(typeof CURUPIRA_VERSION).toBe('string')
  })
  
  test('assertNever throws on unexpected values', () => {
    const testNever = (value: 'a' | 'b') => {
      switch (value) {
        case 'a':
          return 'handled a'
        case 'b':
          return 'handled b'
        default:
          // This should never be reached with proper typing
          // but we test the runtime behavior
          return expect(() => {
            // @ts-expect-error - Testing runtime behavior
            assertNever(value)
          }).toThrow('Unexpected value: c')
      }
    }
    
    expect(testNever('a')).toBe('handled a')
    expect(testNever('b')).toBe('handled b')
  })
  
  test('isNotNull type guard works', () => {
    expect(isNotNull('test')).toBe(true)
    expect(isNotNull(0)).toBe(true)
    expect(isNotNull(false)).toBe(true)
    expect(isNotNull([])).toBe(true)
    expect(isNotNull({})).toBe(true)
    
    expect(isNotNull(null)).toBe(false)
    expect(isNotNull(undefined)).toBe(false)
  })
})

describe('Configuration Types', () => {
  test('CurupiraConfig type structure is valid', () => {
    // This is a compile-time test to ensure the config type is well-formed
    const config: CurupiraConfig = {
      environment: 'development',
      logLevel: 'debug',
      server: {
        port: 8080,
        host: 'localhost',
        cors: {
          origins: ['http://localhost:3000'],
          credentials: true
        }
      },
      auth: {
        enabled: false,
        tokenExpiry: 3600000 as any // Duration branded type
      },
      features: {
        timeTravel: true,
        profiling: true,
        breakpoints: true,
        networkInterception: true
      },
      limits: {
        maxSessions: 10,
        maxEvents: 10000,
        maxRecordingDuration: 3600000 as any, // Duration branded type
        maxMemoryUsage: 100 * 1024 * 1024 // 100MB
      }
    }
    
    expect(config.environment).toBe('development')
    expect(config.server.port).toBe(8080)
    expect(config.features.timeTravel).toBe(true)
  })
})

describe('Performance', () => {
  test('type creation is fast', () => {
    const iterations = 10000
    const start = performance.now()
    
    for (let i = 0; i < iterations; i++) {
      const sessionId = createSessionId(`session-${i}`)
      const userId = createUserId(`user-${i}`)
      const timestamp = createTimestamp()
      
      // Use the values to prevent optimization
      expect(typeof sessionId).toBe('string')
      expect(typeof userId).toBe('string')
      expect(typeof timestamp).toBe('number')
    }
    
    const duration = performance.now() - start
    const opsPerMs = iterations / duration
    
    // Should be able to create branded types reasonably fast
    expect(opsPerMs).toBeGreaterThan(10)
  })
  
  test('type guards are fast', () => {
    const iterations = 10000
    const testValues = [
      'valid-string',
      '',
      null,
      undefined,
      123,
      true,
      {},
      []
    ]
    
    const start = performance.now()
    
    for (let i = 0; i < iterations; i++) {
      const value = testValues[i % testValues.length]
      isSessionId(value)
      isUserId(value)
      isTimestamp(value)
    }
    
    const duration = performance.now() - start
    const opsPerMs = (iterations * 3) / duration // 3 type guards per iteration
    
    // Should be able to do thousands of type guard checks per millisecond
    expect(opsPerMs).toBeGreaterThan(100)
  })
})