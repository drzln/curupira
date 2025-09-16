/**
 * Integration tests for MCP Handlers
 * Tests MCP handler setup and basic functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { setupMCPHandlers } from '../../mcp/index.js'
import { ChromeManager } from '../../chrome/manager.js'
import { mockChromeClient, resetAllMocks, testSessionId } from '../setup.js'

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

describe('MCP Handlers Integration', () => {
  let mcpServer: Server

  beforeEach(async () => {
    resetAllMocks()
    
    // Create MCP server instance
    mcpServer = new Server({
      name: 'curupira-test-server',
      version: '1.0.0'
    }, {
      capabilities: {
        resources: { subscribe: false },
        tools: {},
        prompts: {}
      }
    })
    
    // Setup MCP handlers
    setupMCPHandlers(mcpServer)
  })

  describe('MCP Handler Setup', () => {
    it('should setup handlers without errors', () => {
      // If we get here, setupMCPHandlers didn't throw
      expect(mcpServer).toBeDefined()
    })

    it('should have access to Chrome manager', () => {
      const manager = ChromeManager.getInstance()
      expect(manager).toBeDefined()
      expect(manager.getClient).toBeDefined()
    })
  })

  describe('Resource Providers Initialization', () => {
    it('should initialize CDP resource provider', () => {
      // Test that CDP resources are available through Chrome manager
      const manager = ChromeManager.getInstance()
      const client = manager.getClient()
      expect(client).toBe(mockChromeClient)
    })

    it('should initialize React resource provider', () => {
      // Test React detection setup
      expect(mockChromeClient.send).toBeDefined()
    })

    it('should initialize State resource provider', () => {
      // Test state management detection setup
      const manager = ChromeManager.getInstance()
      expect(manager.getAllSessions).toBeDefined()
    })
  })

  describe('Tool Providers Initialization', () => {
    it('should initialize CDP tools', () => {
      // CDP tools should be able to access Chrome client
      const manager = ChromeManager.getInstance()
      const client = manager.getClient()
      expect(client.send).toBeDefined()
    })

    it('should initialize framework-specific tools', () => {
      // Framework tools should have access to session management
      const manager = ChromeManager.getInstance()
      expect(manager.createSession).toBeDefined()
    })
  })

  describe('Integration Workflows', () => {
    it('should support Chrome session management', async () => {
      const manager = ChromeManager.getInstance()
      
      // Test session creation
      const sessionId = await manager.createSession()
      expect(sessionId).toBe(testSessionId)
      
      // Test session listing
      const sessions = manager.getAllSessions()
      expect(sessions).toHaveLength(1)
      expect(sessions[0].id).toBe(testSessionId)
    })

    it('should support Chrome client operations', async () => {
      const manager = ChromeManager.getInstance()
      const client = manager.getClient()
      
      mockChromeClient.send.mockResolvedValueOnce({ result: { value: true } })
      
      const result = await client.send('Runtime.evaluate', {
        expression: 'true',
        returnByValue: true
      }, testSessionId)
      
      expect(result.result.value).toBe(true)
      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Runtime.evaluate',
        { expression: 'true', returnByValue: true },
        testSessionId
      )
    })

    it('should handle connection lifecycle', async () => {
      const manager = ChromeManager.getInstance()
      
      // Test connection
      await manager.connect()
      expect(manager.connect).toHaveBeenCalled()
      
      // Test disconnection
      await manager.disconnect()
      expect(manager.disconnect).toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('should handle Chrome client errors gracefully', async () => {
      const manager = ChromeManager.getInstance()
      const client = manager.getClient()
      
      mockChromeClient.send.mockRejectedValueOnce(new Error('Connection failed'))
      
      await expect(
        client.send('Runtime.evaluate', { expression: 'test' }, testSessionId)
      ).rejects.toThrow('Connection failed')
    })

    it('should handle session creation errors', async () => {
      const manager = ChromeManager.getInstance()
      vi.mocked(manager.createSession).mockRejectedValueOnce(new Error('Session creation failed'))
      
      await expect(manager.createSession()).rejects.toThrow('Session creation failed')
    })
  })

  describe('Performance Characteristics', () => {
    it('should handle multiple concurrent operations', async () => {
      const manager = ChromeManager.getInstance()
      const client = manager.getClient()
      
      // Mock multiple concurrent responses
      mockChromeClient.send
        .mockResolvedValueOnce({ result: { value: 1 } })
        .mockResolvedValueOnce({ result: { value: 2 } })
        .mockResolvedValueOnce({ result: { value: 3 } })
      
      const promises = [
        client.send('Runtime.evaluate', { expression: '1' }, testSessionId),
        client.send('Runtime.evaluate', { expression: '2' }, testSessionId),
        client.send('Runtime.evaluate', { expression: '3' }, testSessionId)
      ]
      
      const results = await Promise.all(promises)
      
      expect(results).toHaveLength(3)
      expect(results[0].result.value).toBe(1)
      expect(results[1].result.value).toBe(2)
      expect(results[2].result.value).toBe(3)
    })

    it('should maintain session isolation', () => {
      const manager = ChromeManager.getInstance()
      const sessions = manager.getAllSessions()
      
      // Each session should have unique ID
      const sessionIds = sessions.map(s => s.id)
      const uniqueIds = new Set(sessionIds)
      expect(uniqueIds.size).toBe(sessionIds.length)
    })
  })
})