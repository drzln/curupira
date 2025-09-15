/**
 * Integration Tests for Enhanced Tool Handlers
 * Tests comprehensive tool execution against a real Chrome instance
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { setupComprehensiveToolHandlers } from '../../src/mcp/tools/comprehensive.js'
import { ChromeManager } from '../../src/chrome/manager.js'
import type { SessionId } from '@curupira/shared/types'

// Mock MCP server for testing
class MockMCPServer {
  private toolHandlers: Map<string, Function> = new Map()
  private tools: any[] = []

  setRequestHandler(schema: any, handler: Function) {
    if (schema.method === 'tools/list') {
      this.toolHandlers.set('tools/list', handler)
    } else if (schema.method === 'tools/call') {
      this.toolHandlers.set('tools/call', handler)
    }
  }

  async listTools() {
    const handler = this.toolHandlers.get('tools/list')
    if (handler) {
      const result = await handler({})
      this.tools = result.tools
      return result
    }
    return { tools: [] }
  }

  async callTool(name: string, args: any) {
    const handler = this.toolHandlers.get('tools/call')
    if (handler) {
      return await handler({ params: { name, arguments: args } })
    }
    throw new Error(`No handler for tool: ${name}`)
  }

  getTools() {
    return this.tools
  }
}

// Test Chrome setup utility
class TestChromeSetup {
  private chromeManager: ChromeManager
  private sessionId: SessionId | null = null

  constructor() {
    this.chromeManager = ChromeManager.getInstance()
  }

  async setup(): Promise<SessionId> {
    await this.chromeManager.initialize({
      host: 'localhost',
      port: 9222,
      secure: false
    })

    this.sessionId = await this.chromeManager.createSession()
    return this.sessionId
  }

  async navigate(url: string): Promise<void> {
    if (!this.sessionId) {
      throw new Error('Chrome session not initialized')
    }

    const client = this.chromeManager.getClient()
    await client.send('Page.navigate', { url }, this.sessionId)
    
    // Wait for navigation to complete
    await new Promise(resolve => setTimeout(resolve, 1500))
  }

  async cleanup(): Promise<void> {
    if (this.sessionId) {
      await this.chromeManager.closeSession(this.sessionId)
    }
    await this.chromeManager.disconnect()
  }

  getSessionId(): SessionId {
    if (!this.sessionId) {
      throw new Error('Chrome session not initialized')
    }
    return this.sessionId
  }
}

describe('Enhanced Tool Handlers Integration', () => {
  let chromeSetup: TestChromeSetup
  let sessionId: SessionId
  let mockServer: MockMCPServer

  beforeAll(async () => {
    chromeSetup = new TestChromeSetup()
    sessionId = await chromeSetup.setup()
    
    // Setup mock MCP server with comprehensive tool handlers
    mockServer = new MockMCPServer()
    setupComprehensiveToolHandlers(mockServer as any)
    
    // Initialize tools list
    await mockServer.listTools()
  }, 30000)

  afterAll(async () => {
    await chromeSetup.cleanup()
  })

  beforeEach(async () => {
    // Navigate to a test page for each test
    await chromeSetup.navigate('data:text/html,<html><head><title>Test Page</title></head><body><h1 id="header">Test Content</h1><p class="content">Sample text</p><button onclick="console.log(\'clicked\')">Click me</button></body></html>')
  })

  describe('Tool Discovery', () => {
    test('should list all comprehensive tools', async () => {
      const result = await mockServer.listTools()
      
      expect(result).toBeDefined()
      expect(result).toHaveProperty('tools')
      expect(Array.isArray(result.tools)).toBe(true)
      expect(result.tools.length).toBeGreaterThan(40) // Should have 40+ tools
      
      // Check for specific tool categories
      const toolNames = result.tools.map((tool: any) => tool.name)
      
      // Basic tools
      expect(toolNames).toContain('navigate')
      expect(toolNames).toContain('screenshot')
      expect(toolNames).toContain('eval')
      expect(toolNames).toContain('inspect')
      
      // Enhanced CDP tools
      expect(toolNames).toContain('cdp_evaluate')
      expect(toolNames).toContain('cdp_screenshot')
      expect(toolNames).toContain('cdp_navigate')
      
      // DOM tools
      expect(toolNames).toContain('dom_find_element')
      expect(toolNames).toContain('dom_get_attributes')
      expect(toolNames).toContain('dom_click_element')
      
      // React tools
      expect(toolNames).toContain('react_find_component')
      expect(toolNames).toContain('react_inspect_props')
      
      // State management tools
      expect(toolNames).toContain('zustand_inspect_store')
      expect(toolNames).toContain('xstate_inspect_actor')
      expect(toolNames).toContain('apollo_inspect_cache')
      
      // Performance tools
      expect(toolNames).toContain('performance_start_profiling')
      expect(toolNames).toContain('performance_stop_profiling')
      
      // Network tools
      expect(toolNames).toContain('network_mock_request')
      expect(toolNames).toContain('network_throttle')
      
      // Console tools
      expect(toolNames).toContain('console_clear')
      expect(toolNames).toContain('console_execute')
      
      // Connectivity tools
      expect(toolNames).toContain('connectivity_test')
      expect(toolNames).toContain('connectivity_websocket_test')
      expect(toolNames).toContain('connectivity_cors_test')
    })

    test('should have proper tool schemas', async () => {
      const result = await mockServer.listTools()
      const tools = result.tools
      
      // Check that each tool has required properties
      for (const tool of tools) {
        expect(tool).toHaveProperty('name')
        expect(tool).toHaveProperty('description')
        expect(tool).toHaveProperty('inputSchema')
        expect(typeof tool.name).toBe('string')
        expect(typeof tool.description).toBe('string')
        expect(typeof tool.inputSchema).toBe('object')
        expect(tool.inputSchema).toHaveProperty('type')
        expect(tool.inputSchema.type).toBe('object')
        expect(tool.inputSchema).toHaveProperty('properties')
        expect(tool.inputSchema).toHaveProperty('required')
        expect(Array.isArray(tool.inputSchema.required)).toBe(true)
        
        // All tools should require sessionId
        expect(tool.inputSchema.required).toContain('sessionId')
        expect(tool.inputSchema.properties).toHaveProperty('sessionId')
      }
    })
  })

  describe('Basic Chrome Tools', () => {
    test('should execute navigate tool', async () => {
      const result = await mockServer.callTool('navigate', {
        url: 'data:text/html,<html><body><h1>Navigated Page</h1></body></html>',
        sessionId
      })
      
      expect(result).toBeDefined()
      expect(result).toHaveProperty('content')
      expect(Array.isArray(result.content)).toBe(true)
      expect(result.content[0]).toHaveProperty('type')
      expect(result.content[0].type).toBe('text')
    })

    test('should execute screenshot tool', async () => {
      const result = await mockServer.callTool('screenshot', {
        sessionId,
        fullPage: false
      })
      
      expect(result).toBeDefined()
      expect(result).toHaveProperty('content')
      expect(Array.isArray(result.content)).toBe(true)
    })

    test('should execute eval tool', async () => {
      const result = await mockServer.callTool('eval', {
        expression: '2 + 2',
        sessionId
      })
      
      expect(result).toBeDefined()
      expect(result).toHaveProperty('content')
      expect(Array.isArray(result.content)).toBe(true)
    })

    test('should execute inspect tool', async () => {
      const result = await mockServer.callTool('inspect', {
        selector: '#header',
        sessionId
      })
      
      expect(result).toBeDefined()
      expect(result).toHaveProperty('content')
      expect(Array.isArray(result.content)).toBe(true)
    })
  })

  describe('Enhanced CDP Tools', () => {
    test('should execute cdp_evaluate tool', async () => {
      const result = await mockServer.callTool('cdp_evaluate', {
        expression: 'document.title',
        sessionId,
        returnByValue: true
      })
      
      expect(result).toBeDefined()
      expect(result).toHaveProperty('content')
      expect(Array.isArray(result.content)).toBe(true)
    })

    test('should execute cdp_screenshot tool', async () => {
      const result = await mockServer.callTool('cdp_screenshot', {
        sessionId,
        format: 'png',
        quality: 80
      })
      
      expect(result).toBeDefined()
      expect(result).toHaveProperty('content')
      expect(Array.isArray(result.content)).toBe(true)
    })

    test('should execute cdp_navigate tool', async () => {
      const result = await mockServer.callTool('cdp_navigate', {
        url: 'data:text/html,<html><body><h1>CDP Navigate Test</h1></body></html>',
        sessionId
      })
      
      expect(result).toBeDefined()
      expect(result).toHaveProperty('content')
      expect(Array.isArray(result.content)).toBe(true)
    })

    test('should execute cdp_reload tool', async () => {
      const result = await mockServer.callTool('cdp_reload', {
        sessionId,
        ignoreCache: true
      })
      
      expect(result).toBeDefined()
      expect(result).toHaveProperty('content')
      expect(Array.isArray(result.content)).toBe(true)
    })
  })

  describe('DOM Tools', () => {
    test('should execute dom_find_element tool', async () => {
      const result = await mockServer.callTool('dom_find_element', {
        sessionId,
        selector: 'h1'
      })
      
      expect(result).toBeDefined()
      expect(result).toHaveProperty('content')
      expect(Array.isArray(result.content)).toBe(true)
    })

    test('should execute dom_get_attributes tool', async () => {
      const result = await mockServer.callTool('dom_get_attributes', {
        sessionId,
        nodeId: 1
      })
      
      expect(result).toBeDefined()
      expect(result).toHaveProperty('content')
      expect(Array.isArray(result.content)).toBe(true)
    })

    test('should execute dom_click_element tool', async () => {
      const result = await mockServer.callTool('dom_click_element', {
        sessionId,
        nodeId: 1
      })
      
      expect(result).toBeDefined()
      expect(result).toHaveProperty('content')
      expect(Array.isArray(result.content)).toBe(true)
    })

    test('should execute dom_type_text tool', async () => {
      const result = await mockServer.callTool('dom_type_text', {
        sessionId,
        text: 'Hello World'
      })
      
      expect(result).toBeDefined()
      expect(result).toHaveProperty('content')
      expect(Array.isArray(result.content)).toBe(true)
    })
  })

  describe('React Tools', () => {
    test('should execute react_find_component tool', async () => {
      const result = await mockServer.callTool('react_find_component', {
        sessionId,
        componentName: 'App'
      })
      
      expect(result).toBeDefined()
      expect(result).toHaveProperty('content')
      expect(Array.isArray(result.content)).toBe(true)
      expect(result.content[0]).toHaveProperty('text')
    })

    test('should execute react_inspect_props tool', async () => {
      const result = await mockServer.callTool('react_inspect_props', {
        sessionId,
        componentId: 'component-1'
      })
      
      expect(result).toBeDefined()
      expect(result).toHaveProperty('content')
      expect(Array.isArray(result.content)).toBe(true)
    })

    test('should execute react_inspect_state tool', async () => {
      const result = await mockServer.callTool('react_inspect_state', {
        sessionId,
        componentId: 'component-1'
      })
      
      expect(result).toBeDefined()
      expect(result).toHaveProperty('content')
      expect(Array.isArray(result.content)).toBe(true)
    })

    test('should execute react_inspect_hooks tool', async () => {
      const result = await mockServer.callTool('react_inspect_hooks', {
        sessionId,
        componentId: 'component-1'
      })
      
      expect(result).toBeDefined()
      expect(result).toHaveProperty('content')
      expect(Array.isArray(result.content)).toBe(true)
    })
  })

  describe('State Management Tools', () => {
    test('should execute zustand_inspect_store tool', async () => {
      const result = await mockServer.callTool('zustand_inspect_store', {
        sessionId,
        storeId: 'store-1'
      })
      
      expect(result).toBeDefined()
      expect(result).toHaveProperty('content')
      expect(Array.isArray(result.content)).toBe(true)
      expect(result.content[0]).toHaveProperty('text')
      expect(result.content[0].text).toContain('Zustand')
    })

    test('should execute xstate_inspect_actor tool', async () => {
      const result = await mockServer.callTool('xstate_inspect_actor', {
        sessionId,
        actorId: 'actor-1'
      })
      
      expect(result).toBeDefined()
      expect(result).toHaveProperty('content')
      expect(Array.isArray(result.content)).toBe(true)
      expect(result.content[0]).toHaveProperty('text')
      expect(result.content[0].text).toContain('XState')
    })

    test('should execute apollo_inspect_cache tool', async () => {
      const result = await mockServer.callTool('apollo_inspect_cache', {
        sessionId
      })
      
      expect(result).toBeDefined()
      expect(result).toHaveProperty('content')
      expect(Array.isArray(result.content)).toBe(true)
      expect(result.content[0]).toHaveProperty('text')
      expect(result.content[0].text).toContain('Apollo')
    })
  })

  describe('Performance Tools', () => {
    test('should execute performance_start_profiling tool', async () => {
      const result = await mockServer.callTool('performance_start_profiling', {
        sessionId,
        duration: 5
      })
      
      expect(result).toBeDefined()
      expect(result).toHaveProperty('content')
      expect(Array.isArray(result.content)).toBe(true)
      expect(result.content[0]).toHaveProperty('text')
      expect(result.content[0].text).toContain('Performance')
    })

    test('should execute performance_stop_profiling tool', async () => {
      const result = await mockServer.callTool('performance_stop_profiling', {
        sessionId
      })
      
      expect(result).toBeDefined()
      expect(result).toHaveProperty('content')
      expect(Array.isArray(result.content)).toBe(true)
    })
  })

  describe('Network Tools', () => {
    test('should execute network_mock_request tool', async () => {
      const result = await mockServer.callTool('network_mock_request', {
        sessionId,
        url: 'https://api.example.com/test',
        method: 'GET',
        status: 200,
        body: '{"success": true}'
      })
      
      expect(result).toBeDefined()
      expect(result).toHaveProperty('content')
      expect(Array.isArray(result.content)).toBe(true)
    })

    test('should execute network_throttle tool', async () => {
      const result = await mockServer.callTool('network_throttle', {
        sessionId,
        downloadThroughput: 100000,
        uploadThroughput: 50000,
        latency: 100
      })
      
      expect(result).toBeDefined()
      expect(result).toHaveProperty('content')
      expect(Array.isArray(result.content)).toBe(true)
    })
  })

  describe('Console Tools', () => {
    test('should execute console_clear tool', async () => {
      const result = await mockServer.callTool('console_clear', {
        sessionId
      })
      
      expect(result).toBeDefined()
      expect(result).toHaveProperty('content')
      expect(Array.isArray(result.content)).toBe(true)
    })

    test('should execute console_execute tool', async () => {
      const result = await mockServer.callTool('console_execute', {
        sessionId,
        command: 'console.log("Hello from MCP tool")'
      })
      
      expect(result).toBeDefined()
      expect(result).toHaveProperty('content')
      expect(Array.isArray(result.content)).toBe(true)
    })
  })

  describe('Connectivity Tools', () => {
    test('should execute connectivity_test tool', async () => {
      const result = await mockServer.callTool('connectivity_test', {
        sessionId,
        url: 'https://httpbin.org/get'
      })
      
      expect(result).toBeDefined()
      expect(result).toHaveProperty('content')
      expect(Array.isArray(result.content)).toBe(true)
    })

    test('should execute connectivity_websocket_test tool', async () => {
      const result = await mockServer.callTool('connectivity_websocket_test', {
        sessionId,
        url: 'wss://echo.websocket.org'
      })
      
      expect(result).toBeDefined()
      expect(result).toHaveProperty('content')
      expect(Array.isArray(result.content)).toBe(true)
    })

    test('should execute connectivity_cors_test tool', async () => {
      const result = await mockServer.callTool('connectivity_cors_test', {
        sessionId,
        url: 'https://httpbin.org/get',
        origin: 'https://example.com'
      })
      
      expect(result).toBeDefined()
      expect(result).toHaveProperty('content')
      expect(Array.isArray(result.content)).toBe(true)
    })
  })

  describe('Error Handling', () => {
    test('should handle unknown tool names', async () => {
      await expect(async () => {
        await mockServer.callTool('unknown_tool', { sessionId })
      }).rejects.toThrow()
    })

    test('should handle missing required parameters', async () => {
      // Most tools require sessionId
      const result = await mockServer.callTool('eval', {
        expression: '2 + 2'
        // Missing sessionId
      })
      
      expect(result).toBeDefined()
      expect(result).toHaveProperty('isError')
      expect(result.isError).toBe(true)
    })

    test('should handle invalid session IDs', async () => {
      const result = await mockServer.callTool('eval', {
        expression: '2 + 2',
        sessionId: 'invalid-session-id'
      })
      
      expect(result).toBeDefined()
      expect(result).toHaveProperty('isError')
      expect(result.isError).toBe(true)
    })

    test('should handle malformed expressions', async () => {
      const result = await mockServer.callTool('eval', {
        expression: 'invalid javascript syntax }{',
        sessionId
      })
      
      expect(result).toBeDefined()
      expect(result).toHaveProperty('isError')
      expect(result.isError).toBe(true)
    })
  })

  describe('Tool Categories', () => {
    test('should properly categorize tools by prefix', async () => {
      const tools = mockServer.getTools()
      
      // Check CDP tools
      const cdpTools = tools.filter((tool: any) => tool.name.startsWith('cdp_'))
      expect(cdpTools.length).toBeGreaterThan(5)
      
      // Check DOM tools
      const domTools = tools.filter((tool: any) => tool.name.startsWith('dom_'))
      expect(domTools.length).toBeGreaterThan(3)
      
      // Check React tools
      const reactTools = tools.filter((tool: any) => tool.name.startsWith('react_'))
      expect(reactTools.length).toBeGreaterThan(3)
      
      // Check state management tools
      const stateTools = tools.filter((tool: any) => 
        tool.name.startsWith('zustand_') || 
        tool.name.startsWith('xstate_') || 
        tool.name.startsWith('apollo_')
      )
      expect(stateTools.length).toBeGreaterThan(2)
      
      // Check performance tools
      const perfTools = tools.filter((tool: any) => tool.name.startsWith('performance_'))
      expect(perfTools.length).toBeGreaterThan(1)
      
      // Check network tools
      const networkTools = tools.filter((tool: any) => tool.name.startsWith('network_'))
      expect(networkTools.length).toBeGreaterThan(1)
      
      // Check console tools
      const consoleTools = tools.filter((tool: any) => tool.name.startsWith('console_'))
      expect(consoleTools.length).toBeGreaterThan(1)
      
      // Check connectivity tools
      const connectivityTools = tools.filter((tool: any) => tool.name.startsWith('connectivity_'))
      expect(connectivityTools.length).toBeGreaterThan(2)
    })
  })
})