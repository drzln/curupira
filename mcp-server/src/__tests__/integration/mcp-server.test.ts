/**
 * Integration tests for MCP Server
 * Tests the full MCP protocol flow with mocked Chrome client
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { CurupiraServer } from '../../server.js'
import { ChromeManager } from '../../chrome/manager.js'
import { mockChromeClient, resetAllMocks, createCDPResponse, testSessionId } from '../setup.js'
import type { 
  ListResourcesRequest,
  ReadResourceRequest,
  ListToolsRequest,
  CallToolRequest,
  ListPromptsRequest,
  GetPromptRequest,
  ServerCapabilities
} from '@modelcontextprotocol/sdk/types.js'

// Mock ChromeManager
vi.mock('../../chrome/manager.js', () => ({
  ChromeManager: {
    getInstance: vi.fn(() => ({
      getClient: () => mockChromeClient,
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      getAllSessions: vi.fn().mockReturnValue([
        { id: testSessionId, title: 'Test Page', url: 'https://example.com' }
      ]),
      createSession: vi.fn().mockResolvedValue(testSessionId),
    })),
  },
}))

describe('MCP Server Integration', () => {
  let server: CurupiraServer
  let transport: InMemoryTransport
  let client: any

  beforeEach(async () => {
    resetAllMocks()
    
    // Create server with in-memory transport
    server = new CurupiraServer()
    transport = new InMemoryTransport()
    
    // Set up the transport
    await server.connectTransport(transport.serverTransport)
    
    // Create a client to interact with the server
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js')
    client = new Client({
      name: 'test-client',
      version: '1.0.0',
    })
    await client.connect(transport.clientTransport)
  })

  afterEach(async () => {
    await client?.close()
    await server?.close()
  })

  describe('Server Capabilities', () => {
    it('should report correct capabilities', async () => {
      const capabilities = client.getServerCapabilities()
      
      expect(capabilities).toMatchObject({
        resources: { subscribe: false },
        tools: {},
        prompts: {},
      })
    })
  })

  describe('Resources', () => {
    describe('resources/list', () => {
      it('should list all available resources', async () => {
        // Mock Chrome detection for React
        mockChromeClient.send
          .mockResolvedValueOnce(createCDPResponse({ result: { value: true } })) // React detected
          .mockResolvedValueOnce(createCDPResponse({ result: { value: false } })) // No XState
          .mockResolvedValueOnce(createCDPResponse({ result: { value: false } })) // No Zustand
          .mockResolvedValueOnce(createCDPResponse({ result: { value: false } })) // No Apollo
          .mockResolvedValueOnce(createCDPResponse({ result: { value: false } })) // No Redux

        const request: ListResourcesRequest = {
          method: 'resources/list',
        }
        
        const response = await client.request(request)
        
        expect(response.resources).toBeDefined()
        expect(response.resources.length).toBeGreaterThan(0)
        
        // Check for CDP resources
        const cdpResources = response.resources.filter(r => r.uri.startsWith('cdp://'))
        expect(cdpResources.length).toBeGreaterThan(0)
        
        // Check for React resources (since we mocked it as detected)
        const reactResources = response.resources.filter(r => r.uri.startsWith('react://'))
        expect(reactResources.length).toBeGreaterThan(0)
      })
    })

    describe('resources/read', () => {
      it('should read CDP runtime resource', async () => {
        const mockConsoleMessages = [
          { type: 'log', text: 'Hello World', timestamp: Date.now() },
          { type: 'error', text: 'Error occurred', timestamp: Date.now() },
        ]
        
        mockChromeClient.send
          .mockResolvedValueOnce(undefined) // Runtime.enable
          .mockResolvedValueOnce(createCDPResponse({
            result: {
              value: { messages: mockConsoleMessages },
            },
          }))

        const request: ReadResourceRequest = {
          method: 'resources/read',
          params: {
            uri: 'cdp://runtime/console',
          },
        }
        
        const response = await client.request(request)
        
        expect(response.contents).toBeDefined()
        expect(response.contents[0].mimeType).toBe('application/json')
        
        const content = JSON.parse(response.contents[0].text)
        expect(content.messages).toEqual(mockConsoleMessages)
      })

      it('should handle resource not found', async () => {
        const request: ReadResourceRequest = {
          method: 'resources/read',
          params: {
            uri: 'invalid://resource',
          },
        }
        
        await expect(client.request(request)).rejects.toThrow()
      })
    })
  })

  describe('Tools', () => {
    describe('tools/list', () => {
      it('should list all available tools', async () => {
        const request: ListToolsRequest = {
          method: 'tools/list',
        }
        
        const response = await client.request(request)
        
        expect(response.tools).toBeDefined()
        expect(response.tools.length).toBeGreaterThan(0)
        
        // Check for specific tool categories
        const toolNames = response.tools.map(t => t.name)
        expect(toolNames).toContain('navigate')
        expect(toolNames).toContain('screenshot')
        expect(toolNames).toContain('evaluate')
        expect(toolNames).toContain('dom_query_selector')
      })
    })

    describe('tools/call', () => {
      it('should execute evaluate tool', async () => {
        mockChromeClient.send
          .mockResolvedValueOnce(undefined) // Runtime.enable
          .mockResolvedValueOnce(createCDPResponse({
            result: {
              type: 'number',
              value: 42,
            },
          }))

        const request: CallToolRequest = {
          method: 'tools/call',
          params: {
            name: 'evaluate',
            arguments: {
              expression: '21 + 21',
            },
          },
        }
        
        const response = await client.request(request)
        
        expect(response.content).toBeDefined()
        expect(response.content[0].type).toBe('text')
        expect(response.content[0].text).toContain('42')
      })

      it('should execute navigate tool', async () => {
        mockChromeClient.send
          .mockResolvedValueOnce(undefined) // Page.enable
          .mockResolvedValueOnce(undefined) // Page.navigate

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
        
        expect(response.content).toBeDefined()
        expect(response.content[0].type).toBe('text')
        const result = JSON.parse(response.content[0].text)
        expect(result.success).toBe(true)
      })

      it('should handle tool execution errors', async () => {
        mockChromeClient.send.mockRejectedValueOnce(new Error('Navigation failed'))

        const request: CallToolRequest = {
          method: 'tools/call',
          params: {
            name: 'navigate',
            arguments: {
              url: 'invalid-url',
            },
          },
        }
        
        const response = await client.request(request)
        
        expect(response.content[0].text).toContain('Navigation failed')
      })

      it('should handle unknown tool', async () => {
        const request: CallToolRequest = {
          method: 'tools/call',
          params: {
            name: 'unknown_tool',
            arguments: {},
          },
        }
        
        await expect(client.request(request)).rejects.toThrow('Unknown tool')
      })
    })
  })

  describe('Prompts', () => {
    describe('prompts/list', () => {
      it('should list all available prompts', async () => {
        const request: ListPromptsRequest = {
          method: 'prompts/list',
        }
        
        const response = await client.request(request)
        
        expect(response.prompts).toBeDefined()
        expect(response.prompts.length).toBeGreaterThan(0)
        
        const promptNames = response.prompts.map(p => p.name)
        expect(promptNames).toContain('debug_react_component')
        expect(promptNames).toContain('analyze_performance')
        expect(promptNames).toContain('find_memory_leaks')
      })
    })

    describe('prompts/get', () => {
      it('should get prompt template', async () => {
        const request: GetPromptRequest = {
          method: 'prompts/get',
          params: {
            name: 'debug_react_component',
          },
        }
        
        const response = await client.request(request)
        
        expect(response.messages).toBeDefined()
        expect(response.messages.length).toBeGreaterThan(0)
        expect(response.messages[0].role).toBe('user')
        expect(response.messages[0].content.text).toContain('React component')
      })

      it('should handle prompt with arguments', async () => {
        const request: GetPromptRequest = {
          method: 'prompts/get',
          params: {
            name: 'debug_react_component',
            arguments: {
              componentName: 'UserProfile',
            },
          },
        }
        
        const response = await client.request(request)
        
        expect(response.messages[0].content.text).toContain('UserProfile')
      })

      it('should handle unknown prompt', async () => {
        const request: GetPromptRequest = {
          method: 'prompts/get',
          params: {
            name: 'unknown_prompt',
          },
        }
        
        await expect(client.request(request)).rejects.toThrow('Unknown prompt')
      })
    })
  })

  describe('Complex Workflows', () => {
    it('should debug React component flow', async () => {
      // 1. List resources to check React is available
      mockChromeClient.send
        .mockResolvedValueOnce(createCDPResponse({ result: { value: true } })) // React detected

      const listResourcesReq: ListResourcesRequest = {
        method: 'resources/list',
      }
      const resources = await client.request(listResourcesReq)
      
      const reactResources = resources.resources.filter(r => r.uri.startsWith('react://'))
      expect(reactResources.length).toBeGreaterThan(0)

      // 2. Read React components
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPResponse({
          result: {
            value: {
              components: [
                { name: 'App', type: 'function', props: {} },
                { name: 'UserProfile', type: 'function', props: { userId: '123' } },
              ],
            },
          },
        }))

      const readComponentsReq: ReadResourceRequest = {
        method: 'resources/read',
        params: {
          uri: 'react://components',
        },
      }
      const components = await client.request(readComponentsReq)
      const componentData = JSON.parse(components.contents[0].text)
      expect(componentData.components).toHaveLength(2)

      // 3. Find specific component using tool
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPResponse({
          result: {
            value: {
              found: true,
              components: [
                { id: 'comp-1', name: 'UserProfile', props: { userId: '123' } },
              ],
            },
          },
        }))

      const findComponentReq: CallToolRequest = {
        method: 'tools/call',
        params: {
          name: 'react_find_component',
          arguments: {
            componentName: 'UserProfile',
          },
        },
      }
      const findResult = await client.request(findComponentReq)
      expect(findResult.content[0].text).toContain('UserProfile')
    })

    it('should analyze performance flow', async () => {
      // 1. Start profiling
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Profiler.enable
        .mockResolvedValueOnce(undefined) // Profiler.start

      const startProfilingReq: CallToolRequest = {
        method: 'tools/call',
        params: {
          name: 'performance_start_profiling',
          arguments: {},
        },
      }
      const startResult = await client.request(startProfilingReq)
      expect(JSON.parse(startResult.content[0].text).data.profiling).toBe(true)

      // 2. Get performance metrics
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Performance.enable
        .mockResolvedValueOnce(createCDPResponse({
          metrics: [
            { name: 'JSHeapUsedSize', value: 10485760 },
            { name: 'LayoutDuration', value: 0.025 },
          ],
        }))

      const getMetricsReq: CallToolRequest = {
        method: 'tools/call',
        params: {
          name: 'performance_get_metrics',
          arguments: {},
        },
      }
      const metricsResult = await client.request(getMetricsReq)
      expect(metricsResult.content[0].text).toContain('JSHeapUsedSize')

      // 3. Stop profiling
      const mockProfile = {
        nodes: [{ id: 1, callFrame: { functionName: 'test' }, hitCount: 10 }],
        startTime: 1000,
        endTime: 2000,
      }
      mockChromeClient.send
        .mockResolvedValueOnce(createCDPResponse({ profile: mockProfile }))
        .mockResolvedValueOnce(undefined) // Profiler.disable

      const stopProfilingReq: CallToolRequest = {
        method: 'tools/call',
        params: {
          name: 'performance_stop_profiling',
          arguments: {},
        },
      }
      const stopResult = await client.request(stopProfilingReq)
      expect(stopResult.content[0].text).toContain('duration')
    })
  })

  describe('Error Handling', () => {
    it('should handle Chrome connection errors', async () => {
      mockChromeClient.send.mockRejectedValueOnce(new Error('Chrome not connected'))

      const request: ReadResourceRequest = {
        method: 'resources/read',
        params: {
          uri: 'cdp://runtime/console',
        },
      }
      
      await expect(client.request(request)).rejects.toThrow()
    })

    it('should handle malformed requests', async () => {
      const request: any = {
        method: 'invalid/method',
        params: {},
      }
      
      await expect(client.request(request)).rejects.toThrow()
    })
  })
})