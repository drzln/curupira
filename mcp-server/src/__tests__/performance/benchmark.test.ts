/**
 * Performance benchmarks for Curupira MCP Server
 * Measures response times, memory usage, and throughput
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { CurupiraServer } from '../../server.js'
import { ChromeManager } from '../../chrome/manager.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { performance } from 'perf_hooks'
import { mockChromeClient, resetAllMocks, createCDPResponse } from '../setup.js'

// Mock ChromeManager for consistent benchmarks
vi.mock('../../chrome/manager.js', () => ({
  ChromeManager: {
    getInstance: vi.fn(() => ({
      getClient: () => mockChromeClient,
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      getAllSessions: vi.fn().mockReturnValue([
        { id: 'test-session', title: 'Test Page', url: 'https://example.com' }
      ]),
    })),
  },
}))

interface BenchmarkResult {
  operation: string
  averageTime: number
  minTime: number
  maxTime: number
  throughput: number
  memoryUsed: number
}

describe('Performance Benchmarks', () => {
  let server: CurupiraServer
  let transport: InMemoryTransport
  let client: Client
  const results: BenchmarkResult[] = []

  beforeAll(async () => {
    resetAllMocks()
    
    // Create server and client
    server = new CurupiraServer()
    transport = new InMemoryTransport()
    await server.connectTransport(transport.serverTransport)

    client = new Client({
      name: 'benchmark-client',
      version: '1.0.0',
    })
    await client.connect(transport.clientTransport)
  })

  afterAll(async () => {
    await client?.close()
    await server?.close()

    // Print benchmark results
    console.log('\n=== Curupira Performance Benchmark Results ===\n')
    console.table(results.map(r => ({
      Operation: r.operation,
      'Avg Time (ms)': r.averageTime.toFixed(2),
      'Min Time (ms)': r.minTime.toFixed(2),
      'Max Time (ms)': r.maxTime.toFixed(2),
      'Throughput (ops/sec)': r.throughput.toFixed(0),
      'Memory (MB)': (r.memoryUsed / 1024 / 1024).toFixed(2),
    })))
  })

  beforeEach(() => {
    resetAllMocks()
  })

  async function benchmark(
    name: string,
    operation: () => Promise<any>,
    iterations: number = 100
  ): Promise<void> {
    const times: number[] = []
    const memStart = process.memoryUsage().heapUsed

    // Warm up
    for (let i = 0; i < 10; i++) {
      await operation()
    }

    // Actual benchmark
    for (let i = 0; i < iterations; i++) {
      const start = performance.now()
      await operation()
      const end = performance.now()
      times.push(end - start)
    }

    const memEnd = process.memoryUsage().heapUsed
    const memoryUsed = memEnd - memStart

    const averageTime = times.reduce((a, b) => a + b, 0) / times.length
    const minTime = Math.min(...times)
    const maxTime = Math.max(...times)
    const throughput = 1000 / averageTime // operations per second

    results.push({
      operation: name,
      averageTime,
      minTime,
      maxTime,
      throughput,
      memoryUsed,
    })

    // Basic assertions to ensure reasonable performance
    expect(averageTime).toBeLessThan(100) // Should complete in less than 100ms
    expect(throughput).toBeGreaterThan(10) // At least 10 ops/sec
  }

  describe('Resource Operations', () => {
    it('should benchmark resources/list', async () => {
      // Mock responses for framework detection
      mockChromeClient.send
        .mockResolvedValue(createCDPResponse({ result: { value: true } }))

      await benchmark('resources/list', async () => {
        const response = await client.request({
          method: 'resources/list',
        })
        return response
      })
    })

    it('should benchmark resources/read for CDP resources', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(
          createCDPResponse({
            result: {
              value: {
                messages: Array(50).fill({
                  type: 'log',
                  text: 'Test message',
                  timestamp: Date.now(),
                }),
              },
            },
          })
        )

      await benchmark('resources/read (CDP)', async () => {
        const response = await client.request({
          method: 'resources/read',
          params: {
            uri: 'cdp://runtime/console',
          },
        })
        return response
      })
    })

    it('should benchmark resources/read for React resources', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(
          createCDPResponse({
            result: {
              value: {
                components: Array(20).fill({
                  name: 'TestComponent',
                  type: 'function',
                  props: { id: 'test', value: 123 },
                }),
              },
            },
          })
        )

      await benchmark('resources/read (React)', async () => {
        const response = await client.request({
          method: 'resources/read',
          params: {
            uri: 'react://components',
          },
        })
        return response
      })
    })
  })

  describe('Tool Operations', () => {
    it('should benchmark tools/list', async () => {
      await benchmark('tools/list', async () => {
        const response = await client.request({
          method: 'tools/list',
        })
        return response
      })
    })

    it('should benchmark evaluate tool', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(
          createCDPResponse({
            result: {
              type: 'string',
              value: 'Test Result',
            },
          })
        )

      await benchmark('tools/call (evaluate)', async () => {
        const response = await client.request({
          method: 'tools/call',
          params: {
            name: 'evaluate',
            arguments: {
              expression: 'document.title',
            },
          },
        })
        return response
      })
    })

    it('should benchmark DOM query operations', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // DOM.enable
        .mockResolvedValueOnce(undefined) // DOM.getDocument
        .mockResolvedValueOnce(
          createCDPResponse({
            nodeId: 123,
          })
        )

      await benchmark('tools/call (dom_query)', async () => {
        const response = await client.request({
          method: 'tools/call',
          params: {
            name: 'dom_query_selector',
            arguments: {
              selector: '.test-class',
            },
          },
        })
        return response
      })
    })

    it('should benchmark React component finding', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(
          createCDPResponse({
            result: {
              value: {
                found: true,
                components: [
                  { id: 'comp-1', name: 'TestComponent', props: {} },
                ],
              },
            },
          })
        )

      await benchmark('tools/call (react_find)', async () => {
        const response = await client.request({
          method: 'tools/call',
          params: {
            name: 'react_find_component',
            arguments: {
              componentName: 'TestComponent',
            },
          },
        })
        return response
      })
    })

    it('should benchmark network interception setup', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Network.enable
        .mockResolvedValueOnce(undefined) // Fetch.enable
        .mockResolvedValueOnce(undefined) // Network.setRequestInterception

      await benchmark('tools/call (network)', async () => {
        const response = await client.request({
          method: 'tools/call',
          params: {
            name: 'network_enable_request_interception',
            arguments: {},
          },
        })
        return response
      })
    })
  })

  describe('Complex Operations', () => {
    it('should benchmark multiple resource reads', async () => {
      // Setup mocks for multiple resource types
      const setupMocks = () => {
        mockChromeClient.send
          // First resource
          .mockResolvedValueOnce(undefined)
          .mockResolvedValueOnce(
            createCDPResponse({
              result: { value: { data: 'test1' } },
            })
          )
          // Second resource
          .mockResolvedValueOnce(undefined)
          .mockResolvedValueOnce(
            createCDPResponse({
              result: { value: { data: 'test2' } },
            })
          )
          // Third resource
          .mockResolvedValueOnce(undefined)
          .mockResolvedValueOnce(
            createCDPResponse({
              result: { value: { data: 'test3' } },
            })
          )
      }

      await benchmark('multiple resources', async () => {
        setupMocks()
        
        const promises = [
          client.request({
            method: 'resources/read',
            params: { uri: 'cdp://runtime/console' },
          }),
          client.request({
            method: 'resources/read',
            params: { uri: 'cdp://performance/metrics' },
          }),
          client.request({
            method: 'resources/read',
            params: { uri: 'cdp://network/requests' },
          }),
        ]
        
        await Promise.all(promises)
      }, 50) // Fewer iterations for complex operations
    })

    it('should benchmark tool execution sequence', async () => {
      const setupMocks = () => {
        mockChromeClient.send
          // Navigate
          .mockResolvedValueOnce(undefined)
          .mockResolvedValueOnce(undefined)
          // Evaluate
          .mockResolvedValueOnce(undefined)
          .mockResolvedValueOnce(
            createCDPResponse({
              result: { value: 'Page Title' },
            })
          )
          // DOM query
          .mockResolvedValueOnce(undefined)
          .mockResolvedValueOnce(undefined)
          .mockResolvedValueOnce(
            createCDPResponse({ nodeId: 123 })
          )
      }

      await benchmark('tool sequence', async () => {
        setupMocks()
        
        // Navigate
        await client.request({
          method: 'tools/call',
          params: {
            name: 'navigate',
            arguments: { url: 'https://example.com' },
          },
        })
        
        // Evaluate
        await client.request({
          method: 'tools/call',
          params: {
            name: 'evaluate',
            arguments: { expression: 'document.title' },
          },
        })
        
        // DOM query
        await client.request({
          method: 'tools/call',
          params: {
            name: 'dom_query_selector',
            arguments: { selector: 'body' },
          },
        })
      }, 50)
    })
  })

  describe('Memory and Throughput Tests', () => {
    it('should handle high-frequency requests', async () => {
      mockChromeClient.send
        .mockResolvedValue(
          createCDPResponse({
            result: { value: 'test' },
          })
        )

      const iterations = 1000
      const start = performance.now()
      
      const promises = []
      for (let i = 0; i < iterations; i++) {
        promises.push(
          client.request({
            method: 'tools/call',
            params: {
              name: 'evaluate',
              arguments: { expression: '1+1' },
            },
          })
        )
        
        // Batch requests to avoid overwhelming
        if (promises.length >= 50) {
          await Promise.all(promises)
          promises.length = 0
        }
      }
      
      await Promise.all(promises)
      const end = performance.now()
      
      const totalTime = end - start
      const throughput = (iterations / totalTime) * 1000
      
      console.log(`High-frequency test: ${throughput.toFixed(0)} ops/sec`)
      expect(throughput).toBeGreaterThan(100) // At least 100 ops/sec
    })

    it('should not leak memory over extended operations', async () => {
      const memStart = process.memoryUsage().heapUsed
      
      // Perform many operations
      for (let i = 0; i < 100; i++) {
        mockChromeClient.send
          .mockResolvedValueOnce(undefined)
          .mockResolvedValueOnce(
            createCDPResponse({
              result: {
                value: {
                  // Large response
                  data: Array(100).fill({ id: i, value: 'x'.repeat(1000) }),
                },
              },
            })
          )
        
        await client.request({
          method: 'resources/read',
          params: { uri: 'cdp://runtime/console' },
        })
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc()
        }
      }
      
      const memEnd = process.memoryUsage().heapUsed
      const memoryGrowth = (memEnd - memStart) / 1024 / 1024 // MB
      
      console.log(`Memory growth over 100 operations: ${memoryGrowth.toFixed(2)} MB`)
      expect(memoryGrowth).toBeLessThan(50) // Less than 50MB growth
    })
  })

  describe('Large Data Handling', () => {
    it('should handle large console message arrays', async () => {
      const largeMessages = Array(1000).fill({
        type: 'log',
        text: 'x'.repeat(100),
        timestamp: Date.now(),
      })
      
      mockChromeClient.send
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(
          createCDPResponse({
            result: {
              value: { messages: largeMessages },
            },
          })
        )

      const start = performance.now()
      const response = await client.request({
        method: 'resources/read',
        params: { uri: 'cdp://runtime/console' },
      })
      const end = performance.now()
      
      const responseTime = end - start
      console.log(`Large data handling (1000 messages): ${responseTime.toFixed(2)}ms`)
      
      expect(responseTime).toBeLessThan(500) // Should handle in under 500ms
      expect(JSON.parse(response.contents[0].text).messages).toHaveLength(1000)
    })

    it('should handle large DOM trees efficiently', async () => {
      const createLargeDOM = (depth: number, breadth: number): any => {
        if (depth === 0) return null
        return {
          nodeId: Math.random(),
          nodeName: 'DIV',
          children: Array(breadth).fill(null).map(() => 
            createLargeDOM(depth - 1, breadth)
          ).filter(Boolean),
        }
      }
      
      mockChromeClient.send
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(
          createCDPResponse({
            root: createLargeDOM(5, 5), // 5^5 = 3125 nodes
          })
        )

      const start = performance.now()
      await client.request({
        method: 'resources/read',
        params: { uri: 'cdp://dom/document' },
      })
      const end = performance.now()
      
      const responseTime = end - start
      console.log(`Large DOM tree handling (3125 nodes): ${responseTime.toFixed(2)}ms`)
      
      expect(responseTime).toBeLessThan(1000) // Should handle in under 1 second
    })
  })
})