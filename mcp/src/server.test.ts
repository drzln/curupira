/**
 * @fileoverview MCP server tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { McpServer, createMcpServer } from './server.js'
import type { McpProtocol, CdpClient, StorageStore } from '@curupira/integration'

describe('McpServer', () => {
  let server: McpServer
  let mockProtocol: McpProtocol
  let mockCdpClient: CdpClient
  let mockStorage: StorageStore

  beforeEach(() => {
    server = createMcpServer({ debug: false })
    
    // Mock protocol
    mockProtocol = {
      registerHandler: vi.fn(),
      unregisterHandler: vi.fn(),
      notify: vi.fn(),
      request: vi.fn(),
      close: vi.fn()
    } as any
    
    // Mock CDP client
    mockCdpClient = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      send: vi.fn(),
      evaluate: vi.fn(),
      on: vi.fn(),
      off: vi.fn()
    } as any
    
    // Mock storage
    mockStorage = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      clear: vi.fn(),
      keys: vi.fn(),
      size: vi.fn()
    } as any
  })

  describe('initialization', () => {
    it('should initialize server with dependencies', async () => {
      await server.initialize(mockProtocol, mockCdpClient, mockStorage)
      
      // Verify protocol handlers were registered
      expect(mockProtocol.registerHandler).toHaveBeenCalledWith(
        'resources/list',
        expect.any(Function)
      )
      expect(mockProtocol.registerHandler).toHaveBeenCalledWith(
        'tools/list',
        expect.any(Function)
      )
      expect(mockProtocol.registerHandler).toHaveBeenCalledWith(
        'prompts/list',
        expect.any(Function)
      )
    })

    it('should register all handler types', async () => {
      await server.initialize(mockProtocol, mockCdpClient, mockStorage)
      
      const calls = (mockProtocol.registerHandler as any).mock.calls
      const methods = calls.map((call: any[]) => call[0])
      
      // Resource handlers
      expect(methods).toContain('resources/list')
      expect(methods).toContain('resources/read')
      expect(methods).toContain('resources/subscribe')
      expect(methods).toContain('resources/unsubscribe')
      
      // Tool handlers
      expect(methods).toContain('tools/list')
      expect(methods).toContain('tools/call')
      
      // Prompt handlers
      expect(methods).toContain('prompts/list')
      expect(methods).toContain('prompts/get')
    })
  })

  describe('server info', () => {
    it('should return server information', () => {
      const info = server.getServerInfo()
      
      expect(info).toEqual({
        name: 'curupira-mcp',
        version: '1.0.0',
        protocolVersion: '1.0',
        capabilities: {
          resources: {
            subscribe: true,
            listChanged: true
          },
          tools: {},
          prompts: {},
          logging: {}
        }
      })
    })

    it('should use custom config values', () => {
      const customServer = createMcpServer({
        name: 'custom-server',
        version: '2.0.0'
      })
      
      const info = customServer.getServerInfo()
      expect(info.name).toBe('custom-server')
      expect(info.version).toBe('2.0.0')
    })
  })

  describe('registries', () => {
    beforeEach(async () => {
      await server.initialize(mockProtocol, mockCdpClient, mockStorage)
    })

    it('should provide access to resource registry', () => {
      const registry = server.getResourceRegistry()
      expect(registry).toBeDefined()
      
      // Verify resources were registered
      const handlers = registry.getAllHandlers()
      const names = handlers.map(h => h.name)
      
      expect(names).toContain('console')
      expect(names).toContain('network')
      expect(names).toContain('dom')
      expect(names).toContain('storage')
      expect(names).toContain('state')
    })

    it('should provide access to tool registry', () => {
      const registry = server.getToolRegistry()
      expect(registry).toBeDefined()
      
      // Verify tools were registered
      const tools = registry.listTools()
      const names = tools.map(t => t.name)
      
      expect(names).toContain('navigate')
      expect(names).toContain('evaluate')
      expect(names).toContain('click')
      expect(names).toContain('type')
      expect(names).toContain('screenshot')
      expect(names).toContain('setBreakpoint')
      expect(names).toContain('clearConsole')
      expect(names).toContain('pause')
      expect(names).toContain('resume')
    })

    it('should provide access to prompt registry', () => {
      const registry = server.getPromptRegistry()
      expect(registry).toBeDefined()
      
      // Verify prompts were registered
      const prompts = registry.listPrompts()
      const names = prompts.map(p => p.name)
      
      expect(names).toContain('debug-error')
      expect(names).toContain('memory-leak')
      expect(names).toContain('react-component')
      expect(names).toContain('react-hooks')
      expect(names).toContain('performance-analysis')
      expect(names).toContain('render-performance')
    })
  })

  describe('handler execution', () => {
    beforeEach(async () => {
      await server.initialize(mockProtocol, mockCdpClient, mockStorage)
    })

    it('should handle resource list requests', async () => {
      // Get the registered handler
      const calls = (mockProtocol.registerHandler as any).mock.calls
      const listHandler = calls.find((call: any[]) => call[0] === 'resources/list')[1]
      
      // Execute handler
      const result = await listHandler({})
      
      expect(result).toHaveProperty('resources')
      expect(Array.isArray(result.resources)).toBe(true)
    })

    it('should handle tool list requests', async () => {
      // Get the registered handler
      const calls = (mockProtocol.registerHandler as any).mock.calls
      const listHandler = calls.find((call: any[]) => call[0] === 'tools/list')[1]
      
      // Execute handler
      const result = await listHandler({})
      
      expect(result).toHaveProperty('tools')
      expect(Array.isArray(result.tools)).toBe(true)
      expect(result.tools.length).toBeGreaterThan(0)
    })

    it('should handle prompt list requests', async () => {
      // Get the registered handler
      const calls = (mockProtocol.registerHandler as any).mock.calls
      const listHandler = calls.find((call: any[]) => call[0] === 'prompts/list')[1]
      
      // Execute handler
      const result = await listHandler({})
      
      expect(result).toHaveProperty('prompts')
      expect(Array.isArray(result.prompts)).toBe(true)
      expect(result.prompts.length).toBeGreaterThan(0)
    })
  })
})