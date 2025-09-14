/**
 * @fileoverview Tests for MCP protocol implementation
 */

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { McpProtocol, createMcpProtocol, McpServerBuilder } from '../mcp.js'
import type { MCP } from '../types.js'
import type { Resource, Tool, Prompt } from '../../types/index.js'

describe('McpProtocol', () => {
  let protocol: McpProtocol

  beforeEach(() => {
    protocol = createMcpProtocol({
      name: 'test-server',
      version: '1.0.0'
    })
  })

  describe('Initialization', () => {
    test('starts in uninitialized state', () => {
      expect(protocol.currentState).toBe('uninitialized')
    })

    test('handles initialize request', async () => {
      let response: any
      protocol.on('send', (msg) => {
        response = msg
      })

      const initRequest: MCP.InitializeRequest = {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'test-client',
          version: '1.0.0'
        }
      }

      await protocol.handleMessage({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: initRequest
      })

      expect(protocol.currentState).toBe('initialized')
      expect(response).toEqual({
        jsonrpc: '2.0',
        id: 1,
        result: expect.objectContaining({
          protocolVersion: '2024-11-05',
          serverInfo: {
            name: 'test-server',
            version: '1.0.0'
          }
        })
      })
    })

    test('rejects duplicate initialization', async () => {
      // First initialization
      await protocol.handleMessage({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'client', version: '1.0' }
        }
      })

      let errorResponse: any
      protocol.on('send', (msg) => {
        errorResponse = msg
      })

      // Second initialization attempt
      await protocol.handleMessage({
        jsonrpc: '2.0',
        id: 2,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'client', version: '1.0' }
        }
      })

      expect(errorResponse.error).toBeDefined()
      expect(errorResponse.error.code).toBe(-32003) // MCP.ErrorCode.ALREADY_INITIALIZED
    })

    test('waits for initialization', async () => {
      const waitPromise = protocol.waitForInitialization(1000)

      // Initialize after a delay
      setTimeout(async () => {
        await protocol.handleMessage({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'client', version: '1.0' }
          }
        })
      }, 50)

      await expect(waitPromise).resolves.not.toThrow()
      expect(protocol.currentState).toBe('initialized')
    })

    test('timeout on waitForInitialization', async () => {
      await expect(
        protocol.waitForInitialization(50)
      ).rejects.toThrow('Initialization timeout')
    })
  })

  describe('Resources', () => {
    beforeEach(async () => {
      // Initialize protocol
      await protocol.handleMessage({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'client', version: '1.0' }
        }
      })
    })

    test('registers and lists resources', async () => {
      const resource: Resource = {
        uri: 'test://resource',
        name: 'Test Resource',
        description: 'A test resource',
        mimeType: 'text/plain'
      }

      protocol.registerResource(resource)

      let response: any
      protocol.on('send', (msg) => {
        response = msg
      })

      await protocol.handleMessage({
        jsonrpc: '2.0',
        id: 2,
        method: 'resources/list'
      })

      expect(response.result).toEqual([resource])
    })

    test('handles dynamic resource list', async () => {
      const dynamicResources: Resource[] = [
        { uri: 'dynamic://1', name: 'Dynamic 1' },
        { uri: 'dynamic://2', name: 'Dynamic 2' }
      ]

      protocol.setResourceListHandler(async () => dynamicResources)

      let response: any
      protocol.on('send', (msg) => {
        response = msg
      })

      await protocol.handleMessage({
        jsonrpc: '2.0',
        id: 2,
        method: 'resources/list'
      })

      expect(response.result).toEqual(dynamicResources)
    })

    test('reads resource with handler', async () => {
      protocol.setResourceReadHandler(async ({ uri }) => ({
        uri,
        contents: [{ text: `Content of ${uri}` }]
      }))

      let response: any
      protocol.on('send', (msg) => {
        response = msg
      })

      await protocol.handleMessage({
        jsonrpc: '2.0',
        id: 2,
        method: 'resources/read',
        params: { uri: 'test://resource' }
      })

      expect(response.result).toEqual({
        uri: 'test://resource',
        contents: [{ text: 'Content of test://resource' }]
      })
    })

    test('returns error for unknown resource', async () => {
      let response: any
      protocol.on('send', (msg) => {
        response = msg
      })

      await protocol.handleMessage({
        jsonrpc: '2.0',
        id: 2,
        method: 'resources/read',
        params: { uri: 'unknown://resource' }
      })

      expect(response.error).toBeDefined()
      expect(response.error.code).toBe(-32010) // MCP.ErrorCode.RESOURCE_NOT_FOUND
    })
  })

  describe('Tools', () => {
    beforeEach(async () => {
      // Initialize protocol
      await protocol.handleMessage({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'client', version: '1.0' }
        }
      })
    })

    test('registers and lists tools', async () => {
      const tool: Tool = {
        name: 'test-tool',
        description: 'A test tool',
        inputSchema: {
          type: 'object',
          properties: {
            input: { type: 'string' }
          }
        }
      }

      protocol.registerTool(tool)

      let response: any
      protocol.on('send', (msg) => {
        response = msg
      })

      await protocol.handleMessage({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list'
      })

      expect(response.result).toEqual([tool])
    })

    test('calls tool with handler', async () => {
      protocol.registerTool({
        name: 'echo',
        description: 'Echoes input'
      })

      protocol.setToolCallHandler(async ({ name, arguments: args }) => ({
        content: [{ text: `Echoed: ${args?.input}` }]
      }))

      let response: any
      protocol.on('send', (msg) => {
        response = msg
      })

      await protocol.handleMessage({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'echo',
          arguments: { input: 'Hello' }
        }
      })

      expect(response.result).toEqual({
        content: [{ text: 'Echoed: Hello' }]
      })
    })
  })

  describe('Prompts', () => {
    beforeEach(async () => {
      // Initialize protocol
      await protocol.handleMessage({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'client', version: '1.0' }
        }
      })
    })

    test('registers and lists prompts', async () => {
      const prompt: Prompt = {
        name: 'greeting',
        description: 'Generates a greeting',
        arguments: [
          { name: 'name', description: 'Name to greet', required: true }
        ]
      }

      protocol.registerPrompt(prompt)

      let response: any
      protocol.on('send', (msg) => {
        response = msg
      })

      await protocol.handleMessage({
        jsonrpc: '2.0',
        id: 2,
        method: 'prompts/list'
      })

      expect(response.result).toEqual([prompt])
    })

    test('validates required prompt arguments', async () => {
      protocol.registerPrompt({
        name: 'greeting',
        description: 'Greeting prompt',
        arguments: [
          { name: 'name', required: true }
        ]
      })

      let response: any
      protocol.on('send', (msg) => {
        response = msg
      })

      await protocol.handleMessage({
        jsonrpc: '2.0',
        id: 2,
        method: 'prompts/get',
        params: { name: 'greeting' } // Missing required argument
      })

      expect(response.error).toBeDefined()
      expect(response.error.code).toBe(-32031) // MCP.ErrorCode.INVALID_PROMPT_ARGUMENTS
    })
  })

  describe('McpServerBuilder', () => {
    test('builds server with resources, tools, and prompts', () => {
      const server = new McpServerBuilder('builder-test', '1.0.0')
        .withCapabilities({ experimental: { feature: true } })
        .withResources([
          { uri: 'res://1', name: 'Resource 1' }
        ])
        .withTools([
          { name: 'tool1', description: 'Tool 1' }
        ])
        .withPrompts([
          { name: 'prompt1', description: 'Prompt 1' }
        ])
        .build()

      expect(server.serverCapabilities).toEqual({
        experimental: { feature: true },
        resources: true,
        tools: true,
        prompts: true,
        logging: true
      })
    })

    test('builds server with handlers', () => {
      const resourceListHandler = vi.fn().mockResolvedValue([])
      const toolCallHandler = vi.fn().mockResolvedValue({ content: [] })

      const server = new McpServerBuilder('handler-test', '1.0.0')
        .withResourceHandlers(resourceListHandler, vi.fn())
        .withToolHandlers(vi.fn(), toolCallHandler)
        .build()

      expect(server.serverCapabilities.resources).toBe(true)
      expect(server.serverCapabilities.tools).toBe(true)
    })
  })

  describe('Shutdown', () => {
    test('handles shutdown request', async () => {
      // Initialize first
      await protocol.handleMessage({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'client', version: '1.0' }
        }
      })

      let response: any
      protocol.on('send', (msg) => {
        response = msg
      })

      await protocol.handleMessage({
        jsonrpc: '2.0',
        id: 2,
        method: 'shutdown'
      })

      expect(protocol.currentState).toBe('shutdown')
      expect(response.result).toBeNull()
    })

    test('rejects operations after shutdown', async () => {
      // Initialize and shutdown
      await protocol.handleMessage({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'client', version: '1.0' }
        }
      })

      await protocol.handleMessage({
        jsonrpc: '2.0',
        id: 2,
        method: 'shutdown'
      })

      let response: any
      protocol.on('send', (msg) => {
        response = msg
      })

      await protocol.handleMessage({
        jsonrpc: '2.0',
        id: 3,
        method: 'resources/list'
      })

      expect(response.error).toBeDefined()
      expect(response.error.code).toBe(-32002) // MCP.ErrorCode.NOT_INITIALIZED
    })
  })
})