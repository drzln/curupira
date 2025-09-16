/**
 * E2E tests with real Chrome instance
 * These tests require Chrome to be installed and accessible
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { CurupiraServer } from '../../server.js'
import { ChromeManager } from '../../chrome/manager.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import type { CallToolRequest } from '@modelcontextprotocol/sdk/types.js'
import { spawn } from 'child_process'
import { setTimeout } from 'timers/promises'

// Skip these tests in CI environment
const isCI = process.env.CI === 'true'
const describeE2E = isCI ? describe.skip : describe

describeE2E('Chrome E2E Integration', () => {
  let server: CurupiraServer
  let transport: InMemoryTransport
  let client: Client
  let chromeProcess: any
  let chromePort: number = 9222

  beforeAll(async () => {
    // Start Chrome in debug mode
    console.log('Starting Chrome in debug mode...')
    chromeProcess = spawn('google-chrome', [
      '--headless',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      `--remote-debugging-port=${chromePort}`,
      '--remote-debugging-address=127.0.0.1',
      'about:blank',
    ], {
      detached: true,
      stdio: 'ignore',
    })

    // Wait for Chrome to start
    await setTimeout(2000)

    // Initialize Chrome connection
    const chromeManager = ChromeManager.getInstance()
    await chromeManager.connect({
      host: 'localhost',
      port: chromePort,
    })

    // Create server and client
    server = new CurupiraServer()
    transport = new InMemoryTransport()
    await server.connectTransport(transport.serverTransport)

    client = new Client({
      name: 'e2e-test-client',
      version: '1.0.0',
    })
    await client.connect(transport.clientTransport)
  }, 30000)

  afterAll(async () => {
    // Clean up
    await client?.close()
    await server?.close()
    
    const chromeManager = ChromeManager.getInstance()
    await chromeManager.disconnect()
    
    // Kill Chrome process
    if (chromeProcess) {
      try {
        process.kill(-chromeProcess.pid)
      } catch (e) {
        console.error('Failed to kill Chrome process:', e)
      }
    }
  })

  describe('Basic Chrome Operations', () => {
    it('should navigate to a URL', async () => {
      const request: CallToolRequest = {
        method: 'tools/call',
        params: {
          name: 'navigate',
          arguments: {
            url: 'https://example.com',
          },
        },
      }

      const response = await client.request(request)
      const result = JSON.parse(response.content[0].text)
      
      expect(result.success).toBe(true)
      expect(result.data.url).toBe('https://example.com/')
    })

    it('should evaluate JavaScript', async () => {
      const request: CallToolRequest = {
        method: 'tools/call',
        params: {
          name: 'evaluate',
          arguments: {
            expression: 'document.title',
          },
        },
      }

      const response = await client.request(request)
      const result = JSON.parse(response.content[0].text)
      
      expect(result.success).toBe(true)
      expect(result.data).toContain('Example Domain')
    })

    it('should take a screenshot', async () => {
      const request: CallToolRequest = {
        method: 'tools/call',
        params: {
          name: 'screenshot',
          arguments: {},
        },
      }

      const response = await client.request(request)
      const result = JSON.parse(response.content[0].text)
      
      expect(result.success).toBe(true)
      expect(result.data.screenshot).toBeDefined()
      expect(result.data.screenshot).toMatch(/^data:image\/png;base64,/)
    })
  })

  describe('DOM Operations', () => {
    beforeEach(async () => {
      // Navigate to a test page
      await client.request({
        method: 'tools/call',
        params: {
          name: 'navigate',
          arguments: {
            url: 'https://example.com',
          },
        },
      })
    })

    it('should query DOM elements', async () => {
      const request: CallToolRequest = {
        method: 'tools/call',
        params: {
          name: 'dom_query_selector',
          arguments: {
            selector: 'h1',
          },
        },
      }

      const response = await client.request(request)
      const result = JSON.parse(response.content[0].text)
      
      expect(result.success).toBe(true)
      expect(result.data.nodeId).toBeDefined()
    })

    it('should get element outer HTML', async () => {
      // First, find the element
      const queryResponse = await client.request({
        method: 'tools/call',
        params: {
          name: 'dom_query_selector',
          arguments: {
            selector: 'h1',
          },
        },
      })
      const queryResult = JSON.parse(queryResponse.content[0].text)
      const nodeId = queryResult.data.nodeId

      // Get its HTML
      const htmlRequest: CallToolRequest = {
        method: 'tools/call',
        params: {
          name: 'dom_get_outer_html',
          arguments: {
            nodeId,
          },
        },
      }

      const htmlResponse = await client.request(htmlRequest)
      const htmlResult = JSON.parse(htmlResponse.content[0].text)
      
      expect(htmlResult.success).toBe(true)
      expect(htmlResult.data.outerHTML).toContain('<h1>Example Domain</h1>')
    })
  })

  describe('Network Operations', () => {
    it('should enable request interception', async () => {
      const request: CallToolRequest = {
        method: 'tools/call',
        params: {
          name: 'network_enable_request_interception',
          arguments: {},
        },
      }

      const response = await client.request(request)
      const result = JSON.parse(response.content[0].text)
      
      expect(result.success).toBe(true)
      expect(result.data.enabled).toBe(true)
    })

    it('should set network throttling', async () => {
      const request: CallToolRequest = {
        method: 'tools/call',
        params: {
          name: 'network_set_throttling',
          arguments: {
            profile: 'Slow 3G',
          },
        },
      }

      const response = await client.request(request)
      const result = JSON.parse(response.content[0].text)
      
      expect(result.success).toBe(true)
      expect(result.data.profile).toBe('Slow 3G')
    })
  })

  describe('Performance Monitoring', () => {
    it('should get performance metrics', async () => {
      // Navigate first
      await client.request({
        method: 'tools/call',
        params: {
          name: 'navigate',
          arguments: {
            url: 'https://example.com',
          },
        },
      })

      const request: CallToolRequest = {
        method: 'tools/call',
        params: {
          name: 'performance_get_metrics',
          arguments: {},
        },
      }

      const response = await client.request(request)
      const result = JSON.parse(response.content[0].text)
      
      expect(result.success).toBe(true)
      expect(result.data.metrics).toBeDefined()
      expect(result.data.metrics.JSHeapUsedSize).toBeGreaterThan(0)
    })

    it('should profile CPU usage', async () => {
      // Start profiling
      const startRequest: CallToolRequest = {
        method: 'tools/call',
        params: {
          name: 'performance_start_profiling',
          arguments: {},
        },
      }

      const startResponse = await client.request(startRequest)
      const startResult = JSON.parse(startResponse.content[0].text)
      expect(startResult.success).toBe(true)

      // Do some work
      await client.request({
        method: 'tools/call',
        params: {
          name: 'evaluate',
          arguments: {
            expression: 'for(let i=0; i<1000000; i++) { Math.sqrt(i) }',
          },
        },
      })

      // Wait a bit
      await setTimeout(1000)

      // Stop profiling
      const stopRequest: CallToolRequest = {
        method: 'tools/call',
        params: {
          name: 'performance_stop_profiling',
          arguments: {},
        },
      }

      const stopResponse = await client.request(stopRequest)
      const stopResult = JSON.parse(stopResponse.content[0].text)
      
      expect(stopResult.success).toBe(true)
      expect(stopResult.data.profile).toBeDefined()
      expect(stopResult.data.duration).toBeGreaterThan(0)
    })
  })

  describe('React Application Testing', () => {
    it('should detect React on a React page', async () => {
      // Navigate to React's homepage
      await client.request({
        method: 'tools/call',
        params: {
          name: 'navigate',
          arguments: {
            url: 'https://react.dev',
          },
        },
      })

      // Wait for page to load
      await setTimeout(2000)

      // Check React resources
      const resourcesResponse = await client.request({
        method: 'resources/list',
      })

      const reactResources = resourcesResponse.resources.filter(r => r.uri.startsWith('react://'))
      
      // React.dev should have React
      expect(reactResources.length).toBeGreaterThan(0)

      // Try to get React version
      const versionResponse = await client.request({
        method: 'resources/read',
        params: {
          uri: 'react://version',
        },
      })

      const versionData = JSON.parse(versionResponse.contents[0].text)
      expect(versionData.version).toBeDefined()
    })
  })

  describe('Console and Error Tracking', () => {
    it('should capture console messages', async () => {
      // Navigate to a page
      await client.request({
        method: 'tools/call',
        params: {
          name: 'navigate',
          arguments: {
            url: 'https://example.com',
          },
        },
      })

      // Log some messages
      await client.request({
        method: 'tools/call',
        params: {
          name: 'evaluate',
          arguments: {
            expression: 'console.log("Test message"); console.error("Test error");',
          },
        },
      })

      // Wait a bit for messages to be captured
      await setTimeout(500)

      // Read console messages
      const consoleResponse = await client.request({
        method: 'resources/read',
        params: {
          uri: 'cdp://runtime/console',
        },
      })

      const consoleData = JSON.parse(consoleResponse.contents[0].text)
      expect(consoleData.messages).toBeDefined()
      expect(consoleData.messages.length).toBeGreaterThan(0)
      
      const hasLog = consoleData.messages.some(m => m.text === 'Test message' && m.type === 'log')
      const hasError = consoleData.messages.some(m => m.text === 'Test error' && m.type === 'error')
      
      expect(hasLog).toBe(true)
      expect(hasError).toBe(true)
    })
  })

  describe('Cookie Management', () => {
    it('should set and get cookies', async () => {
      // Navigate first
      await client.request({
        method: 'tools/call',
        params: {
          name: 'navigate',
          arguments: {
            url: 'https://example.com',
          },
        },
      })

      // Set a cookie
      const setCookieRequest: CallToolRequest = {
        method: 'tools/call',
        params: {
          name: 'set_cookie',
          arguments: {
            name: 'test_cookie',
            value: 'test_value',
            domain: 'example.com',
          },
        },
      }

      const setCookieResponse = await client.request(setCookieRequest)
      const setCookieResult = JSON.parse(setCookieResponse.content[0].text)
      expect(setCookieResult.success).toBe(true)

      // Get cookies
      const getCookiesRequest: CallToolRequest = {
        method: 'tools/call',
        params: {
          name: 'get_cookies',
          arguments: {},
        },
      }

      const getCookiesResponse = await client.request(getCookiesRequest)
      const getCookiesResult = JSON.parse(getCookiesResponse.content[0].text)
      
      expect(getCookiesResult.success).toBe(true)
      expect(getCookiesResult.data.cookies).toBeDefined()
      
      const testCookie = getCookiesResult.data.cookies.find(c => c.name === 'test_cookie')
      expect(testCookie).toBeDefined()
      expect(testCookie.value).toBe('test_value')
    })
  })

  describe('Memory Management', () => {
    it('should not leak memory over multiple operations', async () => {
      // Get initial memory
      const initialMetrics = await client.request({
        method: 'tools/call',
        params: {
          name: 'performance_get_metrics',
          arguments: {},
        },
      })
      const initialMemory = JSON.parse(initialMetrics.content[0].text).data.metrics.JSHeapUsedSize

      // Perform multiple operations
      for (let i = 0; i < 10; i++) {
        await client.request({
          method: 'tools/call',
          params: {
            name: 'evaluate',
            arguments: {
              expression: `Array(1000000).fill(0).map((_, i) => i * 2)`,
            },
          },
        })
      }

      // Force garbage collection
      await client.request({
        method: 'tools/call',
        params: {
          name: 'evaluate',
          arguments: {
            expression: 'if (global.gc) global.gc()',
          },
        },
      })

      // Wait for GC
      await setTimeout(1000)

      // Get final memory
      const finalMetrics = await client.request({
        method: 'tools/call',
        params: {
          name: 'performance_get_metrics',
          arguments: {},
        },
      })
      const finalMemory = JSON.parse(finalMetrics.content[0].text).data.metrics.JSHeapUsedSize

      // Memory should not grow excessively (allow 50% increase)
      const memoryGrowth = (finalMemory - initialMemory) / initialMemory
      expect(memoryGrowth).toBeLessThan(0.5)
    })
  })
})