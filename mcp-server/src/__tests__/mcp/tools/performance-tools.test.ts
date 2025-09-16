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
      getClient: () => mockChromeClient,
    })),
  },
}))

// Mock BaseToolProvider
vi.mock('../../../mcp/tools/providers/base.js', () => ({
  BaseToolProvider: class {
    async getSessionId(argSessionId?: string) {
      return argSessionId || testSessionId
    }
  }
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
      
      expect(tools).toHaveLength(9)
      
      const toolNames = tools.map(t => t.name)
      expect(toolNames).toContain('performance_start_profiling')
      expect(toolNames).toContain('performance_stop_profiling')
      expect(toolNames).toContain('performance_get_metrics')
      expect(toolNames).toContain('performance_enable_render_blocking')
      expect(toolNames).toContain('performance_measure_layout_shift')
      expect(toolNames).toContain('performance_get_resource_timing')
      expect(toolNames).toContain('performance_get_coverage')
      expect(toolNames).toContain('performance_analyze_bundle')
      expect(toolNames).toContain('performance_trace_functions')
    })
  })

  describe('performance_start_profiling', () => {
    const handler = new PerformanceToolProvider().getHandler('performance_start_profiling')!

    it('should start CPU profiling', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Profiler.enable
        .mockResolvedValueOnce(undefined) // Profiler.start

      const result = await handler.execute({})

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Profiler.enable',
        {},
        testSessionId
      )
      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Profiler.start',
        {},
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: { profiling: true, startTime: expect.any(Number) },
      })
    })

    it('should start with sampling interval', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Profiler.enable
        .mockResolvedValueOnce(undefined) // Profiler.setSamplingInterval
        .mockResolvedValueOnce(undefined) // Profiler.start

      const result = await handler.execute({
        samplingInterval: 500,
      })

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Profiler.setSamplingInterval',
        { interval: 500 },
        testSessionId
      )
      expect(result.success).toBe(true)
    })
  })

  describe('performance_stop_profiling', () => {
    const handler = new PerformanceToolProvider().getHandler('performance_stop_profiling')!

    it('should stop CPU profiling and return profile', async () => {
      const mockProfile = {
        nodes: [
          {
            id: 1,
            callFrame: {
              functionName: 'render',
              scriptId: '123',
              url: 'app.js',
              lineNumber: 100,
              columnNumber: 10,
            },
            hitCount: 50,
            children: [2, 3],
          },
          {
            id: 2,
            callFrame: {
              functionName: 'setState',
              scriptId: '123',
              url: 'app.js',
              lineNumber: 150,
              columnNumber: 5,
            },
            hitCount: 30,
          },
        ],
        startTime: 1000,
        endTime: 5000,
        samples: [1, 1, 2, 1, 2],
        timeDeltas: [100, 100, 100, 100, 100],
      }
      
      mockChromeClient.send
        .mockResolvedValueOnce(createCDPResponse({ profile: mockProfile })) // Profiler.stop
        .mockResolvedValueOnce(undefined) // Profiler.disable

      const result = await handler.execute({})

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Profiler.stop',
        {},
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: {
          profile: mockProfile,
          duration: 4000,
          topFunctions: expect.arrayContaining([
            expect.objectContaining({
              functionName: 'render',
              hitCount: 50,
            }),
          ]),
        },
      })
    })
  })

  describe('performance_get_metrics', () => {
    const handler = new PerformanceToolProvider().getHandler('performance_get_metrics')!

    it('should get performance metrics', async () => {
      const mockMetrics = {
        metrics: [
          { name: 'Timestamp', value: 123456.789 },
          { name: 'LayoutDuration', value: 0.045 },
          { name: 'RecalcStyleDuration', value: 0.023 },
          { name: 'ScriptDuration', value: 0.156 },
          { name: 'TaskDuration', value: 0.234 },
          { name: 'JSHeapUsedSize', value: 15728640 },
          { name: 'JSHeapTotalSize', value: 33554432 },
        ],
      }
      
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Performance.enable
        .mockResolvedValueOnce(createCDPResponse(mockMetrics)) // Performance.getMetrics

      const result = await handler.execute({})

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Performance.getMetrics',
        {},
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: {
          metrics: expect.objectContaining({
            LayoutDuration: 0.045,
            RecalcStyleDuration: 0.023,
            ScriptDuration: 0.156,
            JSHeapUsedSize: 15728640,
          }),
        },
      })
    })
  })

  describe('performance_enable_render_blocking', () => {
    const handler = new PerformanceToolProvider().getHandler('performance_enable_render_blocking')!

    it('should enable render blocking CSS detection', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // CSS.enable
        .mockResolvedValueOnce(undefined) // CSS.startRuleUsageTracking

      const result = await handler.execute({})

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'CSS.enable',
        {},
        testSessionId
      )
      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'CSS.startRuleUsageTracking',
        {},
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: { tracking: true },
      })
    })
  })

  describe('performance_measure_layout_shift', () => {
    const handler = new PerformanceToolProvider().getHandler('performance_measure_layout_shift')!

    it('should measure cumulative layout shift', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(
          createCDPResponse({
            result: {
              value: {
                cls: 0.125,
                shifts: [
                  {
                    value: 0.08,
                    sources: [{ node: 'div#header' }],
                    hadRecentInput: false,
                  },
                  {
                    value: 0.045,
                    sources: [{ node: 'img.hero' }],
                    hadRecentInput: false,
                  },
                ],
              },
            },
          })
        )

      const result = await handler.execute({
        duration: 1000,
      })

      expect(result).toEqual({
        success: true,
        data: {
          cls: 0.125,
          shifts: expect.arrayContaining([
            expect.objectContaining({
              value: 0.08,
              hadRecentInput: false,
            }),
          ]),
        },
      })
    })
  })

  describe('performance_get_resource_timing', () => {
    const handler = new PerformanceToolProvider().getHandler('performance_get_resource_timing')!

    it('should get resource timing data', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(
          createCDPResponse({
            result: {
              value: {
                resources: [
                  {
                    name: 'https://example.com/app.js',
                    entryType: 'resource',
                    startTime: 100.5,
                    duration: 250.3,
                    transferSize: 15420,
                    encodedBodySize: 15000,
                    decodedBodySize: 45000,
                  },
                  {
                    name: 'https://example.com/style.css',
                    entryType: 'resource',
                    startTime: 50.2,
                    duration: 180.1,
                    transferSize: 8500,
                    encodedBodySize: 8200,
                    decodedBodySize: 25000,
                  },
                ],
              },
            },
          })
        )

      const result = await handler.execute({})

      expect(result).toEqual({
        success: true,
        data: {
          resources: expect.arrayContaining([
            expect.objectContaining({
              name: 'https://example.com/app.js',
              duration: 250.3,
              transferSize: 15420,
            }),
          ]),
        },
      })
    })

    it('should filter by resource type', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(
          createCDPResponse({
            result: {
              value: {
                resources: [
                  {
                    name: 'https://example.com/api/data',
                    entryType: 'resource',
                    initiatorType: 'fetch',
                    duration: 150,
                  },
                ],
              },
            },
          })
        )

      const result = await handler.execute({
        type: 'fetch',
      })

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Runtime.evaluate',
        expect.objectContaining({
          expression: expect.stringContaining('fetch'),
        }),
        testSessionId
      )
      expect(result.success).toBe(true)
    })
  })

  describe('performance_get_coverage', () => {
    const handler = new PerformanceToolProvider().getHandler('performance_get_coverage')!

    it('should get JS and CSS coverage', async () => {
      const mockJSCoverage = [
        {
          scriptId: '1',
          url: 'https://example.com/app.js',
          functions: [
            {
              functionName: 'handleClick',
              ranges: [{ startOffset: 0, endOffset: 500, count: 1 }],
              isBlockCoverage: false,
            },
          ],
        },
      ]
      
      const mockCSSCoverage = [
        {
          styleSheetId: '1',
          url: 'https://example.com/style.css',
          startOffset: 0,
          endOffset: 1000,
          used: true,
        },
      ]
      
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Profiler.enable
        .mockResolvedValueOnce(undefined) // Profiler.startPreciseCoverage
        .mockResolvedValueOnce(undefined) // CSS.enable
        .mockResolvedValueOnce(undefined) // CSS.startRuleUsageTracking
        .mockResolvedValueOnce(createCDPResponse({ result: mockJSCoverage })) // Profiler.takePreciseCoverage
        .mockResolvedValueOnce(createCDPResponse({ ruleUsage: mockCSSCoverage })) // CSS.stopRuleUsageTracking
        .mockResolvedValueOnce(undefined) // Profiler.stopPreciseCoverage
        .mockResolvedValueOnce(undefined) // CSS.disable

      const result = await handler.execute({
        duration: 2000,
      })

      expect(result).toEqual({
        success: true,
        data: {
          js: mockJSCoverage,
          css: mockCSSCoverage,
          summary: expect.objectContaining({
            jsFiles: 1,
            cssFiles: 1,
          }),
        },
      })
    })
  })

  describe('performance_analyze_bundle', () => {
    const handler = new PerformanceToolProvider().getHandler('performance_analyze_bundle')!

    it('should analyze JavaScript bundle', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(
          createCDPResponse({
            result: {
              value: {
                totalSize: 524288, // 512KB
                files: [
                  {
                    url: 'https://example.com/vendor.js',
                    size: 300000,
                    gzipSize: 85000,
                    modules: ['react', 'react-dom', 'lodash'],
                  },
                  {
                    url: 'https://example.com/app.js',
                    size: 224288,
                    gzipSize: 65000,
                    modules: ['App', 'components', 'utils'],
                  },
                ],
              },
            },
          })
        )

      const result = await handler.execute({})

      expect(result).toEqual({
        success: true,
        data: {
          totalSize: 524288,
          files: expect.arrayContaining([
            expect.objectContaining({
              url: 'https://example.com/vendor.js',
              size: 300000,
            }),
          ]),
        },
      })
    })
  })

  describe('performance_trace_functions', () => {
    const handler = new PerformanceToolProvider().getHandler('performance_trace_functions')!

    it('should trace function calls', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(
          createCDPResponse({
            result: {
              value: {
                tracing: true,
                functionName: 'handleUserInput',
                message: 'Tracing handleUserInput. Check console for call logs.',
              },
            },
          })
        )

      const result = await handler.execute({
        functionName: 'handleUserInput',
      })

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Runtime.evaluate',
        expect.objectContaining({
          expression: expect.stringContaining('handleUserInput'),
        }),
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: {
          tracing: true,
          functionName: 'handleUserInput',
          message: 'Tracing handleUserInput. Check console for call logs.',
        },
      })
    })

    it('should trace with stack traces', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(
          createCDPResponse({
            result: {
              value: {
                tracing: true,
                functionName: 'setState',
                includeStack: true,
              },
            },
          })
        )

      const result = await handler.execute({
        functionName: 'setState',
        includeStack: true,
      })

      expect(result.data?.includeStack).toBe(true)
    })
  })

  describe('error handling', () => {
    const handler = new PerformanceToolProvider().getHandler('performance_start_profiling')!

    it('should handle CDP errors', async () => {
      mockChromeClient.send.mockRejectedValueOnce(new Error('Profiler already started'))

      const result = await handler.execute({})

      expect(result).toEqual({
        success: false,
        error: 'Profiler already started',
      })
    })
  })
})