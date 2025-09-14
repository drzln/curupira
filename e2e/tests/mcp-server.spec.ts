/**
 * @fileoverview MCP Server E2E Tests
 */

import { test, expect } from '@playwright/test'
import WebSocket from 'ws'

test.describe('MCP Server', () => {
  let ws: WebSocket
  let messageId = 0

  const sendMcpMessage = async (method: string, params: any = {}) => {
    const id = ++messageId
    const message = {
      jsonrpc: '2.0',
      id,
      method,
      params
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('MCP message timeout'))
      }, 10000)

      const handleMessage = (data: any) => {
        try {
          const response = JSON.parse(data.toString())
          if (response.id === id) {
            clearTimeout(timeout)
            ws.off('message', handleMessage)
            
            if (response.error) {
              reject(new Error(response.error.message))
            } else {
              resolve(response.result)
            }
          }
        } catch (error) {
          // Ignore parsing errors for other messages
        }
      }

      ws.on('message', handleMessage)
      ws.send(JSON.stringify(message))
    })
  }

  test.beforeEach(async () => {
    // Connect to MCP server
    ws = new WebSocket('ws://localhost:8080/mcp')
    await new Promise((resolve, reject) => {
      ws.on('open', resolve)
      ws.on('error', reject)
    })
  })

  test.afterEach(async () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close()
    }
  })

  test('should connect to MCP server', async () => {
    expect(ws.readyState).toBe(WebSocket.OPEN)
  })

  test('should respond to initialize request', async () => {
    const result = await sendMcpMessage('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'curupira-e2e-test',
        version: '1.0.0'
      }
    })

    expect(result).toHaveProperty('protocolVersion')
    expect(result).toHaveProperty('capabilities')
    expect(result).toHaveProperty('serverInfo')
    expect(result.serverInfo.name).toBe('curupira-mcp-server')
  })

  test('should list available resources', async () => {
    // Initialize first
    await sendMcpMessage('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test', version: '1.0.0' }
    })

    const resources = await sendMcpMessage('resources/list')
    
    expect(Array.isArray(resources.resources)).toBe(true)
    expect(resources.resources.length).toBeGreaterThan(0)
    
    // Check for expected resources
    const resourceUris = resources.resources.map((r: any) => r.uri)
    expect(resourceUris).toContain('curupira://browser/console')
    expect(resourceUris).toContain('curupira://browser/network')
    expect(resourceUris).toContain('curupira://browser/dom')
  })

  test('should list available tools', async () => {
    // Initialize first
    await sendMcpMessage('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test', version: '1.0.0' }
    })

    const tools = await sendMcpMessage('tools/list')
    
    expect(Array.isArray(tools.tools)).toBe(true)
    expect(tools.tools.length).toBeGreaterThan(0)
    
    // Check for expected tools
    const toolNames = tools.tools.map((t: any) => t.name)
    expect(toolNames).toContain('navigate')
    expect(toolNames).toContain('evaluate')
    expect(toolNames).toContain('screenshot')
  })

  test('should list available prompts', async () => {
    // Initialize first
    await sendMcpMessage('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test', version: '1.0.0' }
    })

    const prompts = await sendMcpMessage('prompts/list')
    
    expect(Array.isArray(prompts.prompts)).toBe(true)
    expect(prompts.prompts.length).toBeGreaterThan(0)
    
    // Check for expected prompts
    const promptNames = prompts.prompts.map((p: any) => p.name)
    expect(promptNames).toContain('debug-error')
    expect(promptNames).toContain('analyze-performance')
  })

  test('should handle resource read requests', async () => {
    // Initialize first
    await sendMcpMessage('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test', version: '1.0.0' }
    })

    const result = await sendMcpMessage('resources/read', {
      uri: 'curupira://browser/console'
    })

    expect(result).toHaveProperty('contents')
    expect(Array.isArray(result.contents)).toBe(true)
  })

  test('should handle invalid resource URIs', async () => {
    // Initialize first
    await sendMcpMessage('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test', version: '1.0.0' }
    })

    await expect(sendMcpMessage('resources/read', {
      uri: 'invalid://resource'
    })).rejects.toThrow()
  })

  test('should handle tool call requests', async () => {
    // Initialize first
    await sendMcpMessage('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test', version: '1.0.0' }
    })

    const result = await sendMcpMessage('tools/call', {
      name: 'evaluate',
      arguments: {
        expression: '2 + 2'
      }
    })

    expect(result).toHaveProperty('content')
    expect(result.isError).toBe(false)
  })

  test('should handle prompt get requests', async () => {
    // Initialize first
    await sendMcpMessage('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test', version: '1.0.0' }
    })

    const result = await sendMcpMessage('prompts/get', {
      name: 'debug-error',
      arguments: {
        error: 'TypeError: Cannot read property of undefined'
      }
    })

    expect(result).toHaveProperty('messages')
    expect(Array.isArray(result.messages)).toBe(true)
    expect(result.messages.length).toBeGreaterThan(0)
  })

  test('should handle WebSocket connection errors gracefully', async () => {
    // Close the connection
    ws.close()

    // Wait for close
    await new Promise(resolve => {
      ws.on('close', resolve)
    })

    expect(ws.readyState).toBe(WebSocket.CLOSED)
  })

  test('should maintain connection during idle periods', async ({ page }) => {
    // Initialize
    await sendMcpMessage('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test', version: '1.0.0' }
    })

    // Wait for 5 seconds (should be less than heartbeat interval)
    await page.waitForTimeout(5000)

    // Connection should still be alive
    expect(ws.readyState).toBe(WebSocket.OPEN)

    // Should be able to make another request
    const result = await sendMcpMessage('resources/list')
    expect(result).toHaveProperty('resources')
  })
})