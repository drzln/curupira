/**
 * Tests for Performance Tool Provider
 * Level 2: MCP Core tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PerformanceToolProvider } from '../../../mcp/tools/providers/performance-tools.js'
import { ChromeManager } from '../../../chrome/manager.js'
import { mockChromeClient, resetAllMocks, createCDPResponse, createCDPError, testSessionId } from '../../setup.js'

// Mock ChromeManager
vi.mock('../../../chrome/manager.js', () => ({
  ChromeManager: {
    getInstance: vi.fn(() => ({
      getClient: () => ({
        ...mockChromeClient,
        getSessions: vi.fn(() => [{ sessionId: testSessionId }]),
        on: vi.fn()
      }),
    })),
  },
}))

describe('PerformanceToolProvider', () => {
  let provider: PerformanceToolProvider

  beforeEach(() => {
    resetAllMocks()
    provider = new PerformanceToolProvider()
  })

  describe('listTools', () => {
    it('should return all performance tools', () => {
      const tools = provider.listTools()
      
      expect(tools).toHaveLength(8) // Actual count from implementation
      
      const toolNames = tools.map(t => t.name)
      expect(toolNames).toContain('performance_start_profiling')
      expect(toolNames).toContain('performance_stop_profiling')
      expect(toolNames).toContain('performance_measure_render')
      expect(toolNames).toContain('performance_analyze_bundle')
      expect(toolNames).toContain('performance_memory_snapshot')
      expect(toolNames).toContain('performance_get_metrics')
      expect(toolNames).toContain('performance_trace_start')
      expect(toolNames).toContain('performance_trace_stop')
    })
  })

  describe('performance_start_profiling', () => {
    it('should start CPU profiling', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Profiler.enable
        .mockResolvedValueOnce(undefined) // Profiler.start

      const handler = provider.getHandler('performance_start_profiling')!

      const result = await handler.execute({})

      expect(mockChromeClient.send).toHaveBeenCalledWith('Profiler.enable', {}, testSessionId)
      expect(mockChromeClient.send).toHaveBeenCalledWith('Profiler.start', {}, testSessionId)

      expect(result).toEqual({
        success: true,
        data: {
          status: 'profiling_started',
          sessionId: testSessionId,
          timestamp: expect.any(String)
        }
      })
    })
  })

  describe('performance_stop_profiling', () => {
    it('should stop profiling and analyze results', async () => {
      const mockProfile = {
        profile: {
          startTime: 1000,
          endTime: 2000,
          nodes: [
            { id: 1, callFrame: { functionName: 'test', url: 'test.js', lineNumber: 1 } },
            { id: 2, callFrame: { functionName: 'main', url: 'main.js', lineNumber: 5 } }
          ],
          samples: [1, 2, 1],
          timeDeltas: [100, 50, 25]
        }
      }

      mockChromeClient.send.mockResolvedValueOnce(mockProfile)

      const handler = provider.getHandler('performance_stop_profiling')!

      const result = await handler.execute({})

      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        status: 'profiling_stopped',
        duration: 1000,
        sampleCount: 3,
        hotFunctions: [
          {
            functionName: 'test',
            url: 'test.js',
            lineNumber: 1,
            selfTime: 125
          },
          {
            functionName: 'main',
            url: 'main.js',
            lineNumber: 5,
            selfTime: 50
          }
        ],
        profile: {
          startTime: 1000,
          endTime: 2000,
          nodes: 2
        }
      })
    })
  })

  describe('performance_trace_start', () => {
    it('should start performance trace', async () => {
      mockChromeClient.send.mockResolvedValueOnce(undefined)

      const handler = provider.getHandler('performance_trace_start')!

      const result = await handler.execute({
        categories: ['devtools.timeline', 'blink.user_timing']
      })

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Tracing.start',
        {
          categories: 'devtools.timeline,blink.user_timing',
          options: 'sampling-frequency=10000'
        },
        testSessionId
      )

      expect(result).toEqual({
        success: true,
        data: {
          status: 'trace_started',
          categories: ['devtools.timeline', 'blink.user_timing'],
          timestamp: expect.any(String)
        }
      })
    })

    it('should start trace with default categories', async () => {
      mockChromeClient.send.mockResolvedValueOnce(undefined)

      const handler = provider.getHandler('performance_trace_start')!

      const result = await handler.execute({})

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Tracing.start',
        {
          categories: 'devtools.timeline,v8.execute,blink.user_timing,latencyInfo,disabled-by-default-devtools.timeline.frame,disabled-by-default-devtools.timeline.stack',
          options: 'sampling-frequency=10000'
        },
        testSessionId
      )

      expect(result.success).toBe(true)
      expect(result.data?.status).toBe('trace_started')
    })
  })

  describe('performance_trace_stop', () => {
    it('should stop trace and collect events', async () => {
      const mockEvents = [
        { name: 'Paint', cat: 'devtools.timeline', ts: 1000, dur: 50 },
        { name: 'Layout', cat: 'devtools.timeline', ts: 2000, dur: 75 }
      ]

      // Mock the client.on method to simulate event collection
      const mockClient = {
        ...mockChromeClient,
        on: vi.fn((event, callback) => {
          if (event === 'Tracing.dataCollected') {
            // Simulate event collection
            setTimeout(() => callback({ value: mockEvents }), 100)
          }
        })
      }

      vi.mocked(ChromeManager.getInstance).mockReturnValue({
        getClient: () => mockClient
      } as any)

      mockClient.send = vi.fn().mockResolvedValueOnce(undefined) // Tracing.end

      const handler = provider.getHandler('performance_trace_stop')!

      const result = await handler.execute({})

      expect(result.success).toBe(true)
      expect(result.data?.status).toBe('trace_stopped')
      expect(result.data?.summary.totalEvents).toBe(2)
    })
  })

  describe('performance_memory_snapshot', () => {
    it('should take memory heap snapshot', async () => {
      const mockMemory = {
        usedJSHeapSize: 1024000,
        totalJSHeapSize: 2048000,
        jsHeapSizeLimit: 4096000
      }
      
      const mockProfile = {
        profile: {
          samples: [1, 2, 3],
          head: { id: 1, callFrame: { functionName: 'test' } }
        }
      }
      
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPResponse(mockMemory)) // performance.memory (before)
        .mockResolvedValueOnce(undefined) // HeapProfiler.enable
        .mockResolvedValueOnce(undefined) // HeapProfiler.startSampling
        .mockResolvedValueOnce(mockProfile) // HeapProfiler.stopSampling
        .mockResolvedValueOnce(createCDPResponse(mockMemory)) // performance.memory (after)

      const handler = provider.getHandler('performance_memory_snapshot')!

      const result = await handler.execute({})

      expect(mockChromeClient.send).toHaveBeenCalledWith('Runtime.enable', {}, testSessionId)
      expect(mockChromeClient.send).toHaveBeenCalledWith('HeapProfiler.enable', {}, testSessionId)
      expect(mockChromeClient.send).toHaveBeenCalledWith('HeapProfiler.startSampling', {}, testSessionId)
      expect(mockChromeClient.send).toHaveBeenCalledWith('HeapProfiler.stopSampling', {}, testSessionId)

      expect(result).toEqual({
        success: true,
        data: {
          memory: {
            before: mockMemory,
            after: mockMemory
          },
          heapProfile: {
            samples: 3,
            head: 'Available'
          },
          timestamp: expect.any(String)
        }
      })
    })
  })

  describe('performance_get_metrics', () => {
    it('should get performance metrics', async () => {
      const mockWebVitals = {
        FCP: 1200,
        LCP: 2500,
        CLS: 0.1,
        FID: 100,
        TTFB: 800
      }
      
      const mockCDPMetrics = {
        metrics: [
          { name: 'Timestamp', value: 1234567890 },
          { name: 'TaskDuration', value: 50 }
        ]
      }
      
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Performance.enable
        .mockResolvedValueOnce(mockCDPMetrics) // Performance.getMetrics
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPResponse(mockWebVitals)) // Web vitals evaluation

      const handler = provider.getHandler('performance_get_metrics')!

      const result = await handler.execute({})

      expect(result).toEqual({
        success: true,
        data: {
          webVitals: mockWebVitals,
          cdpMetrics: {
            Timestamp: 1234567890,
            TaskDuration: 50
          },
          timestamp: expect.any(String)
        }
      })
    })
  })

  describe('performance_analyze_bundle', () => {
    it('should analyze JavaScript bundle sizes', async () => {
      const mockScripts = [
        { src: '/main.js', size: 256000, async: false, defer: false, type: 'text/javascript' },
        { src: '/vendor.js', size: 512000, async: false, defer: false, type: 'text/javascript' }
      ]
      
      const mockResources = [
        { name: '/main.js', size: 256000, duration: 150, startTime: 100, compressed: true },
        { name: '/vendor.js', size: 512000, duration: 300, startTime: 200, compressed: true }
      ]
      
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPResponse(mockScripts)) // scripts evaluation
        .mockResolvedValueOnce(createCDPResponse(mockResources)) // resources evaluation

      const handler = provider.getHandler('performance_analyze_bundle')!

      const result = await handler.execute({})

      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        bundles: [
          {
            url: '/vendor.js',
            size: 512000,
            duration: 300,
            compressed: true,
            async: false,
            defer: false
          },
          {
            url: '/main.js',
            size: 256000,
            duration: 150,
            compressed: true,
            async: false,
            defer: false
          }
        ],
        summary: {
          totalBundles: 2,
          totalSize: 768000,
          totalSizeMB: '0.73',
          totalLoadTime: 450,
          averageBundleSize: 384000
        }
      })
    })
  })

  describe('performance_measure_render', () => {
    it('should measure React render performance', async () => {
      const mockRenderData = {
        stats: {
          totalRenders: 5,
          totalDuration: 5000,
          averageRenderTime: 15,
          maxRenderTime: 25,
          minRenderTime: 8,
          rendersPerSecond: 1
        },
        topComponents: [
          { name: 'App', count: 3 },
          { name: 'Header', count: 2 }
        ],
        sampleRenders: []
      }

      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPResponse('Render tracking installed')) // Install tracking
        .mockResolvedValueOnce(createCDPResponse(mockRenderData)) // Collect results

      const handler = provider.getHandler('performance_measure_render')!

      const result = await handler.execute({
        duration: 1000
      })

      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockRenderData)
    })

    it('should handle React DevTools not available', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPResponse('React DevTools not found')) // Install tracking
        .mockResolvedValueOnce(createCDPResponse({
          error: 'No render data collected'
        }))

      const handler = provider.getHandler('performance_measure_render')!

      const result = await handler.execute({
        duration: 1000
      })

      expect(result).toEqual({
        success: false,
        error: 'No render data collected'
      })
    })
  })

  describe('error handling', () => {
    it('should handle profiling start errors', async () => {
      mockChromeClient.send.mockRejectedValueOnce(new Error('Profiler not available'))

      const handler = provider.getHandler('performance_start_profiling')!

      const result = await handler.execute({})

      expect(result).toEqual({
        success: false,
        error: 'Profiler not available'
      })
    })

    it('should handle memory snapshot errors', async () => {
      mockChromeClient.send.mockRejectedValueOnce(new Error('Heap profiler failed'))

      const handler = provider.getHandler('performance_memory_snapshot')!

      const result = await handler.execute({})

      expect(result).toEqual({
        success: false,
        error: 'Heap profiler failed'
      })
    })

    it('should handle trace start errors', async () => {
      mockChromeClient.send.mockRejectedValueOnce(new Error('Tracing not supported'))

      const handler = provider.getHandler('performance_trace_start')!

      const result = await handler.execute({})

      expect(result).toEqual({
        success: false,
        error: 'Tracing not supported'
      })
    })

    it('should handle evaluation errors in render measurement', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPResponse('Render tracking installed')) // Install tracking
        .mockResolvedValueOnce(createCDPError('Script evaluation failed'))

      const handler = provider.getHandler('performance_measure_render')!

      const result = await handler.execute({
        duration: 1000
      })

      expect(result).toEqual({
        success: false,
        error: 'Error measuring renders: Script evaluation failed'
      })
    })
  })
})