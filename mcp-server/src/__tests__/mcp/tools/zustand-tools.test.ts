/**
 * Tests for Zustand Tool Provider
 * Level 2: MCP Core tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ZustandToolProvider } from '../../../mcp/tools/providers/zustand-tools.js'
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
    
    async checkLibraryAvailable(check: string, sessionId: string) {
      // Mock implementation - return success by default
      return { available: true, error: undefined }
    }

    async executeScript(script: string, sessionId: string) {
      // Mock executeScript to return CDP response format  
      const { mockChromeClient } = await import('../../setup.js')
      const manager = { getClient: () => mockChromeClient }
      const client = manager.getClient()
      
      await client.send('Runtime.enable', {}, sessionId)
      const result = await client.send('Runtime.evaluate', {
        expression: script,
        returnByValue: true,
        awaitPromise: true
      }, sessionId)
      
      if (result.exceptionDetails) {
        return {
          success: false,
          error: `Script execution error: ${result.exceptionDetails.text}`,
          data: result.exceptionDetails
        }
      }
      
      return {
        success: true,
        data: result.result.value
      }
    }
  }
}))

describe('ZustandToolProvider', () => {
  let provider: ZustandToolProvider

  beforeEach(() => {
    resetAllMocks()
    provider = new ZustandToolProvider()
  })

  describe('listTools', () => {
    it('should return all Zustand tools', () => {
      const tools = provider.listTools()
      
      expect(tools).toHaveLength(4)
      
      const toolNames = tools.map(t => t.name)
      expect(toolNames).toContain('zustand_inspect_store')
      expect(toolNames).toContain('zustand_dispatch_action')
      expect(toolNames).toContain('zustand_list_stores')
      expect(toolNames).toContain('zustand_subscribe_to_store')
    })
  })

  describe('zustand_inspect_store', () => {

    it('should inspect store state', async () => {
      const mockStoreState = {
        user: {
          id: '123',
          name: 'John Doe',
          email: 'john@example.com',
        },
        isAuthenticated: true,
        preferences: {
          theme: 'dark',
          language: 'en',
        },
      }
      
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce({
          result: {
            value: {
              stores: [{
                name: 'userStore',
                state: mockStoreState,
              }]
            }
          }
        })

      const handler = provider.getHandler('zustand_inspect_store')!

      const result = await handler.execute({
        storeName: 'userStore',
      })

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Runtime.evaluate',
        expect.objectContaining({
          expression: expect.stringContaining('userStore'),
        }),
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: {
          stores: [{
            name: 'userStore',
            state: mockStoreState,
          }]
        }
      })
    })

    it('should inspect all stores when no store name provided', async () => {
      const mockStores = [
        { 
          name: 'userStore',
          state: { user: null, isAuthenticated: false },
        },
        { 
          name: 'cartStore',
          state: { items: [], total: 0 },
        },
      ]
      
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce({
          result: {
            value: { stores: mockStores }
          }
        })

      const handler = provider.getHandler('zustand_inspect_store')!

      const result = await handler.execute({})

      expect(result).toEqual({
        success: true,
        data: { stores: mockStores }
      })
    })
  })

  describe('zustand_dispatch_action', () => {

    it('should dispatch action to store', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce({
          result: {
            value: {
              success: true,
              oldState: { count: 0 },
              newState: { count: 1 }
            }
          }
        })

      const handler = provider.getHandler('zustand_dispatch_action')!

      const result = await handler.execute({
        storeName: 'counterStore',
        action: 'increment',
      })

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Runtime.evaluate',
        expect.objectContaining({
          expression: expect.stringContaining('increment'),
        }),
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: {
          success: true,
          oldState: { count: 0 },
          newState: { count: 1 }
        }
      })
    })

    it('should dispatch action with payload', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce({
          result: {
            value: {
              success: true,
              oldState: { user: null },
              newState: { user: { id: '123', name: 'John' } }
            }
          }
        })

      const handler = provider.getHandler('zustand_dispatch_action')!

      const payload = { id: '123', name: 'John' }
      const result = await handler.execute({
        storeName: 'userStore',
        action: 'setUser',
        payload,
      })

      expect(result.success).toBe(true)
      expect(result.data?.newState).toEqual({ user: { id: '123', name: 'John' } })
    })
  })

  describe('zustand_list_stores', () => {

    it('should list all Zustand stores', async () => {
      const mockStores = [
        { 
          name: 'userStore',
          state: { user: null, isAuthenticated: false },
          subscriberCount: 5,
        },
        { 
          name: 'cartStore',
          state: { items: [], total: 0 },
          subscriberCount: 3,
        },
      ]
      
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce({
          result: {
            value: { stores: mockStores }
          }
        })

      const handler = provider.getHandler('zustand_list_stores')!

      const result = await handler.execute({})

      expect(result).toEqual({
        success: true,
        data: { stores: mockStores },
      })
    })

    it('should handle no stores available', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce({
          result: {
            value: { stores: [] }
          }
        })

      const handler = provider.getHandler('zustand_list_stores')!

      const result = await handler.execute({})

      expect(result).toEqual({
        success: true,
        data: { stores: [] }
      })
    })
  })

  describe('zustand_subscribe_to_store', () => {

    it('should subscribe to store changes', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(undefined) // Console.enable
        .mockResolvedValueOnce({
          result: {
            value: {
              success: true,
              message: 'Subscribed to store changes. Check console for updates.'
            }
          }
        })

      const handler = provider.getHandler('zustand_subscribe_to_store')!

      const result = await handler.execute({
        storeName: 'userStore',
      })

      expect(result).toEqual({
        success: true,
        data: {
          success: true,
          message: 'Subscribed to store changes. Check console for updates.'
        }
      })
    })

    it('should handle store not found', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(undefined) // Console.enable
        .mockResolvedValueOnce({
          result: {
            value: {
              error: 'Store not found'
            }
          }
        })

      const handler = provider.getHandler('zustand_subscribe_to_store')!

      const result = await handler.execute({
        storeName: 'unknownStore',
      })

      expect(result).toEqual({
        success: true,
        data: { error: 'Store not found' }
      })
    })
  })

  describe('error handling', () => {

    it('should handle evaluation errors', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce({ exceptionDetails: { text: 'Cannot read property of undefined' } })

      const handler = provider.getHandler('zustand_list_stores')!

      const result = await handler.execute({})

      expect(result).toEqual({
        success: false,
        error: 'Error listing stores: Cannot read property of undefined',
      })
    })

    it('should handle CDP errors', async () => {
      mockChromeClient.send.mockRejectedValueOnce(new Error('WebSocket closed'))

      const handler = provider.getHandler('zustand_list_stores')!

      const result = await handler.execute({})

      expect(result).toEqual({
        success: false,
        error: 'WebSocket closed',
      })
    })
  })
})