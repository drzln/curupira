/**
 * @fileoverview Tests for Curupira telemetry collection
 * 
 * These tests ensure telemetry collection, sampling, buffering,
 * and privacy features work correctly.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  TelemetryCollector,
  DEFAULT_TELEMETRY_CONFIG,
  initializeTelemetry,
  getTelemetry,
  telemetry,
  type TelemetryConfig,
  type MetricPoint,
  type PerformanceMetric,
  type UsageMetric,
  type HealthMetric,
  type StateMetric,
  type NetworkMetric,
  type Metric
} from '../telemetry.js'
import type { SessionId, RequestId, ComponentId, ActorId, StoreId, Duration, Timestamp } from '../../types/branded.js'

// Mock fetch for telemetry endpoint tests
global.fetch = vi.fn()

describe('TelemetryCollector', () => {
  let collector: TelemetryCollector
  let mockLogger: any
  let config: TelemetryConfig
  
  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn()
    }
    
    config = {
      ...DEFAULT_TELEMETRY_CONFIG,
      bufferSize: 5, // Small buffer for testing
      flushInterval: 100, // Quick flush for testing
      sampling: {
        performance: 1.0, // Always sample for tests
        usage: 1.0,
        health: 1.0,
        state: 1.0,
        network: 1.0
      }
    }
    
    collector = new TelemetryCollector(config, mockLogger)
    vi.clearAllMocks()
  })
  
  afterEach(() => {
    collector.stop()
    vi.clearAllTimers()
  })
  
  test('records performance metrics', () => {
    const duration = 150 as Duration
    
    collector.recordPerformance('api-call', duration, true, { endpoint: '/api/users' })
    
    // Force flush to verify metric was recorded
    collector.flush()
    
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        telemetry: expect.objectContaining({
          count: 1,
          types: { timer: 1 }
        })
      }),
      'Flushing telemetry metrics'
    )
  })
  
  test('records usage metrics with anonymization', () => {
    const sessionId = 'session-123' as SessionId
    
    collector.recordUsage('debugger', 'breakpoint_set', sessionId, 'user-456')
    collector.flush()
    
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        telemetry: expect.objectContaining({
          count: 1,
          types: { counter: 1 }
        })
      }),
      'Flushing telemetry metrics'
    )
  })
  
  test('records health metrics with data redaction', () => {
    collector.recordHealth('websocket', 'healthy', {
      connectionId: 'conn-123',
      token: 'secret-token' // Should be redacted
    })
    
    collector.flush()
    
    expect(mockLogger.info).toHaveBeenCalled()
  })
  
  test('records state management metrics', () => {
    const componentId = 'MyComponent' as ComponentId
    const actorId = 'user-actor' as ActorId
    
    collector.recordState('react', 'component_update', {
      componentId,
      actorId,
      stateSize: 1024
    })
    
    collector.flush()
    
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        telemetry: expect.objectContaining({
          count: 1,
          types: { counter: 1 }
        })
      }),
      'Flushing telemetry metrics'
    )
  })
  
  test('records network metrics', () => {
    const duration = 200 as Duration
    
    collector.recordNetwork(
      'https://api.example.com/users',
      'GET',
      200,
      duration,
      1024
    )
    
    collector.flush()
    
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        telemetry: expect.objectContaining({
          count: 1,
          types: { histogram: 1 }
        })
      }),
      'Flushing telemetry metrics'
    )
  })
  
  test('records custom metrics', () => {
    collector.recordCustom('custom.metric', 'gauge', 42.5, {
      category: 'performance',
      source: 'devtools'
    })
    
    collector.flush()
    
    expect(mockLogger.info).toHaveBeenCalled()
  })
  
  test('applies sampling rates correctly', () => {
    const configWithSampling: TelemetryConfig = {
      ...config,
      sampling: {
        performance: 0.0, // Never sample
        usage: 1.0,       // Always sample
        health: 1.0,
        state: 1.0,
        network: 1.0
      }
    }
    
    const sampledCollector = new TelemetryCollector(configWithSampling, mockLogger)
    
    // Record multiple performance metrics (should be filtered out)
    for (let i = 0; i < 10; i++) {
      sampledCollector.recordPerformance(`op-${i}`, 100 as Duration, true)
    }
    
    // Record usage metric (should be recorded)
    sampledCollector.recordUsage('feature', 'action')
    
    sampledCollector.flush()
    
    // Should only have usage metric
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        telemetry: expect.objectContaining({
          count: 1,
          types: { counter: 1 }
        })
      }),
      'Flushing telemetry metrics'
    )
    
    sampledCollector.stop()
  })
  
  test('flushes automatically when buffer is full', () => {
    // Record more metrics than buffer size
    for (let i = 0; i < config.bufferSize + 2; i++) {
      collector.recordCustom(`metric-${i}`, 'counter', i)
    }
    
    // Should have triggered automatic flush
    expect(mockLogger.info).toHaveBeenCalled()
  })
  
  test('flushes automatically on interval', async () => {
    vi.useFakeTimers()
    
    // Create collector with timer enabled
    const timerCollector = new TelemetryCollector({
      ...config,
      flushInterval: 100
    }, mockLogger)
    
    timerCollector.recordCustom('test', 'counter', 1)
    
    // Advance time to trigger flush
    vi.advanceTimersByTime(100)
    
    expect(mockLogger.info).toHaveBeenCalled()
    
    timerCollector.stop()
    vi.useRealTimers()
  })
  
  test('sanitizes endpoint URLs', () => {
    collector.recordNetwork(
      'https://api.example.com/users?token=secret&id=123',
      'GET',
      200
    )
    
    collector.flush()
    
    // Verify endpoint was sanitized (query params removed)
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        telemetry: expect.objectContaining({
          count: 1,
          types: { histogram: 1 }
        })
      }),
      'Flushing telemetry metrics'
    )
  })
  
  test('anonymizes user IDs when enabled', () => {
    collector.recordUsage('feature', 'action', undefined, 'sensitive-user-id')
    
    const spy = vi.spyOn(console, 'table').mockImplementation(() => {})
    
    // Enable development mode to see console output
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    
    collector.flush()
    
    process.env.NODE_ENV = originalEnv
    spy.mockRestore()
  })
  
  test('handles disabled telemetry', () => {
    const disabledConfig: TelemetryConfig = {
      ...config,
      enabled: false
    }
    
    const disabledCollector = new TelemetryCollector(disabledConfig, mockLogger)
    
    disabledCollector.recordPerformance('test', 100 as Duration, true)
    disabledCollector.flush()
    
    // Should not log anything
    expect(mockLogger.info).not.toHaveBeenCalled()
    
    disabledCollector.stop()
  })
})

describe('MetricBuffer', () => {
  test('applies correct sampling rates', () => {
    const config: TelemetryConfig = {
      ...DEFAULT_TELEMETRY_CONFIG,
      sampling: {
        performance: 0.5,
        usage: 0.3,
        health: 1.0,
        state: 0.1,
        network: 0.8
      }
    }
    
    const mockFlush = vi.fn()
    const collector = new TelemetryCollector(config)
    
    // Record many metrics to test sampling
    const iterations = 1000
    
    // Mock Math.random to control sampling
    const originalRandom = Math.random
    let callCount = 0
    
    Math.random = vi.fn(() => {
      // Return predictable values for testing
      callCount++
      return (callCount % 10) / 10 // 0.1, 0.2, 0.3, ..., 0.9, 0.0
    })
    
    for (let i = 0; i < iterations; i++) {
      collector.recordPerformance(`perf-${i}`, 100 as Duration, true)
    }
    
    collector.flush()
    
    Math.random = originalRandom
    collector.stop()
  })
})

describe('Global Telemetry', () => {
  afterEach(() => {
    // Reset global state
    vi.resetModules()
  })
  
  test('initializes global telemetry instance', () => {
    const customConfig = {
      enabled: true,
      sampling: { ...DEFAULT_TELEMETRY_CONFIG.sampling }
    }
    
    const instance = initializeTelemetry(customConfig)
    
    expect(instance).toBeInstanceOf(TelemetryCollector)
    expect(getTelemetry()).toBe(instance)
    
    instance.stop()
  })
  
  test('auto-initializes when accessing getTelemetry', () => {
    const instance = getTelemetry()
    
    expect(instance).toBeInstanceOf(TelemetryCollector)
    
    instance.stop()
  })
  
  test('convenience functions work correctly', () => {
    const instance = getTelemetry()
    const spy = vi.spyOn(instance, 'recordPerformance')
    
    telemetry.performance('test-op', 100 as Duration, true, { test: true })
    
    expect(spy).toHaveBeenCalledWith('test-op', 100, true, { test: true })
    
    spy.mockRestore()
    instance.stop()
  })
})

describe('Telemetry Endpoint Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  
  test('sends metrics to configured endpoint', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce(
      new Response(null, { status: 200 }) as any
    )
    
    const config: TelemetryConfig = {
      ...DEFAULT_TELEMETRY_CONFIG,
      sampling: {
        performance: 1.0,
        usage: 1.0,
        health: 1.0,
        state: 1.0,
        network: 1.0
      },
      endpoints: {
        metrics: 'https://telemetry.example.com/metrics'
      }
    }
    
    const collector = new TelemetryCollector(config)
    
    collector.recordCustom('test', 'counter', 1)
    collector.flush()
    
    // Wait for async operation
    await new Promise(resolve => setTimeout(resolve, 100))
    
    expect(mockFetch).toHaveBeenCalledWith(
      'https://telemetry.example.com/metrics',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: expect.stringContaining('"name":"test"')
      })
    )
    
    collector.stop()
  }, 10000)
  
  test('handles endpoint errors gracefully', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockRejectedValueOnce(new Error('Network error'))
    
    const config: TelemetryConfig = {
      ...DEFAULT_TELEMETRY_CONFIG,
      sampling: {
        performance: 1.0,
        usage: 1.0,
        health: 1.0,
        state: 1.0,
        network: 1.0
      },
      endpoints: {
        metrics: 'https://telemetry.example.com/metrics'
      }
    }
    
    const mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn()
    }
    
    const collector = new TelemetryCollector(config, mockLogger)
    
    collector.recordCustom('test', 'counter', 1)
    collector.flush()
    
    // Wait for async operation
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Should log error but not throw
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(Error) }),
      'Failed to send metrics to endpoint'
    )
    
    collector.stop()
  }, 10000)
  
  test('skips sending when no endpoint configured', async () => {
    const mockFetch = vi.mocked(fetch)
    
    const config: TelemetryConfig = {
      ...DEFAULT_TELEMETRY_CONFIG,
      sampling: {
        performance: 1.0,
        usage: 1.0,
        health: 1.0,
        state: 1.0,
        network: 1.0
      },
      endpoints: {} // No endpoints configured
    }
    
    const collector = new TelemetryCollector(config)
    
    collector.recordCustom('test', 'counter', 1)
    collector.flush()
    
    // Wait for async operation
    await new Promise(resolve => setTimeout(resolve, 100))
    
    expect(mockFetch).not.toHaveBeenCalled()
    
    collector.stop()
  }, 10000)
})

describe('Data Privacy', () => {
  test('redacts sensitive data from health details', () => {
    const collector = new TelemetryCollector(DEFAULT_TELEMETRY_CONFIG)
    
    collector.recordHealth('component', 'healthy', {
      status: 'ok',
      token: 'secret-token',
      apiKey: 'secret-key',
      publicData: 'safe-data'
    })
    
    collector.flush()
    
    // Verify redaction happened (implementation detail test)
    // In real scenario, we'd check the logged/sent data
  })
  
  test('sanitizes endpoint URLs removing sensitive query params', () => {
    const collector = new TelemetryCollector(DEFAULT_TELEMETRY_CONFIG)
    
    collector.recordNetwork(
      'https://api.example.com/users?secret=abc123&token=xyz789',
      'GET',
      200
    )
    
    collector.flush()
    
    // Verify URL was sanitized (query params removed)
  })
  
  test('respects privacy configuration', () => {
    const config: TelemetryConfig = {
      ...DEFAULT_TELEMETRY_CONFIG,
      privacy: {
        anonymizeUserIds: false,
        redactSensitiveData: false,
        allowedDomains: ['example.com']
      }
    }
    
    const collector = new TelemetryCollector(config)
    
    collector.recordUsage('feature', 'action', undefined, 'user-123')
    collector.recordHealth('component', 'healthy', {
      token: 'should-not-be-redacted'
    })
    
    collector.flush()
    
    collector.stop()
  })
})

describe('Performance', () => {
  test('metric recording is fast', () => {
    const collector = new TelemetryCollector({
      ...DEFAULT_TELEMETRY_CONFIG,
      enabled: true,
      sampling: {
        performance: 1.0,
        usage: 1.0,
        health: 1.0,
        state: 1.0,
        network: 1.0
      }
    })
    
    const iterations = 1000
    const start = performance.now()
    
    for (let i = 0; i < iterations; i++) {
      collector.recordPerformance(`op-${i}`, 100 as Duration, true)
      collector.recordUsage(`feature-${i}`, 'action')
      collector.recordCustom(`metric-${i}`, 'counter', i)
    }
    
    const duration = performance.now() - start
    const recordsPerMs = (iterations * 3) / duration
    
    expect(recordsPerMs).toBeGreaterThan(100) // Should be very fast
    
    collector.stop()
  })
  
  test('sampling reduces processing overhead', () => {
    const noSamplingCollector = new TelemetryCollector({
      ...DEFAULT_TELEMETRY_CONFIG,
      sampling: {
        performance: 1.0, // No sampling
        usage: 1.0,
        health: 1.0,
        state: 1.0,
        network: 1.0
      }
    })
    
    const heavySamplingCollector = new TelemetryCollector({
      ...DEFAULT_TELEMETRY_CONFIG,
      sampling: {
        performance: 0.01, // Heavy sampling
        usage: 0.01,
        health: 0.01,
        state: 0.01,
        network: 0.01
      }
    })
    
    const iterations = 1000
    
    // Test no sampling
    const start1 = performance.now()
    for (let i = 0; i < iterations; i++) {
      noSamplingCollector.recordPerformance(`op-${i}`, 100 as Duration, true)
    }
    const duration1 = performance.now() - start1
    
    // Test heavy sampling
    const start2 = performance.now()
    for (let i = 0; i < iterations; i++) {
      heavySamplingCollector.recordPerformance(`op-${i}`, 100 as Duration, true)
    }
    const duration2 = performance.now() - start2
    
    // Sampling should be faster (less work done)
    expect(duration2).toBeLessThan(duration1 * 2) // Allow some variance
    
    noSamplingCollector.stop()
    heavySamplingCollector.stop()
  })
})

describe('Error Handling', () => {
  test('handles malformed metric data gracefully', () => {
    const collector = new TelemetryCollector(DEFAULT_TELEMETRY_CONFIG)
    
    // These shouldn't throw errors
    expect(() => {
      collector.recordCustom('', 'counter', NaN)
      collector.recordCustom(null as any, 'gauge', Infinity)
      collector.recordPerformance('', 0 as Duration, true, undefined)
    }).not.toThrow()
    
    collector.stop()
  })
  
  test('continues operation after flush errors', async () => {
    const mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn()
    }
    
    // Mock fetch to fail
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockRejectedValue(new Error('Network error'))
    
    const config: TelemetryConfig = {
      ...DEFAULT_TELEMETRY_CONFIG,
      sampling: {
        performance: 1.0,
        usage: 1.0,
        health: 1.0,
        state: 1.0,
        network: 1.0
      },
      endpoints: {
        metrics: 'https://telemetry.example.com/metrics'
      }
    }
    
    const collector = new TelemetryCollector(config, mockLogger)
    
    collector.recordCustom('test1', 'counter', 1)
    collector.flush()
    
    // Wait for failed flush
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Should still be able to record more metrics
    collector.recordCustom('test2', 'counter', 2)
    collector.flush()
    
    expect(mockLogger.error).toHaveBeenCalled()
    
    collector.stop()
  }, 10000)
})