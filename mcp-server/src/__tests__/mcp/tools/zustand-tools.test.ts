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
      
      expect(tools).toHaveLength(5)
      
      const toolNames = tools.map(t => t.name)
      expect(toolNames).toContain('zustand_list_stores')
      expect(toolNames).toContain('zustand_get_store_state')
      expect(toolNames).toContain('zustand_set_store_state')
      expect(toolNames).toContain('zustand_subscribe_to_store')
      expect(toolNames).toContain('zustand_get_devtools_state')
    })
  })

  describe('zustand_list_stores', () => {
    const handler = new ZustandToolProvider().getHandler('zustand_list_stores')!

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
        .mockResolvedValueOnce(createCDPResponse({ result: { value: { available: true } } })) // Check available
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(
          createCDPResponse({
            result: {
              value: { stores: mockStores },
            },
          })
        )

      const result = await handler.execute({})

      expect(result).toEqual({
        success: true,
        data: { stores: mockStores },
      })
    })

    it('should handle Zustand not available', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPResponse({ result: { value: { available: false } } }))

      const result = await handler.execute({})

      expect(result).toEqual({
        success: false,
        error: 'Zustand not available in the page',
      })
    })
  })

  describe('zustand_get_store_state', () => {
    const handler = new ZustandToolProvider().getHandler('zustand_get_store_state')!

    it('should get specific store state', async () => {
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
        .mockResolvedValueOnce(createCDPResponse({ result: { value: { available: true } } }))
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(
          createCDPResponse({
            result: {
              value: { state: mockStoreState },
            },
          })
        )

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
        data: { state: mockStoreState },
      })
    })

    it('should handle store not found', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPResponse({ result: { value: { available: true } } }))
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(
          createCDPResponse({
            result: {
              value: { error: 'Store not found: unknownStore' },
            },
          })
        )

      const result = await handler.execute({
        storeName: 'unknownStore',
      })

      expect(result).toEqual({
        success: false,
        error: 'Store not found: unknownStore',
        data: { error: 'Store not found: unknownStore' },
      })
    })
  })

  describe('zustand_set_store_state', () => {
    const handler = new ZustandToolProvider().getHandler('zustand_set_store_state')!

    it('should set store state', async () => {
      const updates = {
        isAuthenticated: false,
        user: null,
      }
      
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPResponse({ result: { value: { available: true } } }))
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(
          createCDPResponse({
            result: {
              value: {
                success: true,
                oldState: { isAuthenticated: true, user: { id: '123' } },
                newState: { isAuthenticated: false, user: null },
              },
            },
          })
        )

      const result = await handler.execute({
        storeName: 'userStore',
        updates,
      })

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Runtime.evaluate',
        expect.objectContaining({
          expression: expect.stringContaining(JSON.stringify(updates)),
        }),
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: {
          success: true,
          oldState: { isAuthenticated: true, user: { id: '123' } },
          newState: { isAuthenticated: false, user: null },
        },
      })
    })

    it('should merge partial updates', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPResponse({ result: { value: { available: true } } }))
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(
          createCDPResponse({
            result: {
              value: {
                success: true,
                oldState: { count: 5, items: ['a', 'b'] },
                newState: { count: 10, items: ['a', 'b'] },
              },
            },
          })
        )

      const result = await handler.execute({
        storeName: 'cartStore',
        updates: { count: 10 },
        merge: true,
      })

      expect(result.success).toBe(true)
      expect(result.data?.newState).toEqual({ count: 10, items: ['a', 'b'] })
    })
  })

  describe('zustand_subscribe_to_store', () => {
    const handler = new ZustandToolProvider().getHandler('zustand_subscribe_to_store')!

    it('should subscribe to store changes', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPResponse({ result: { value: { available: true } } }))
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(
          createCDPResponse({
            result: {
              value: {
                subscribed: true,
                listenerId: 'listener-123',
                message: 'Subscribed to userStore. Check console for state changes.',
              },
            },
          })
        )

      const result = await handler.execute({
        storeName: 'userStore',
      })

      expect(result).toEqual({
        success: true,
        data: {
          subscribed: true,
          listenerId: 'listener-123',
          message: 'Subscribed to userStore. Check console for state changes.',
        },
      })
    })

    it('should support custom selector', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPResponse({ result: { value: { available: true } } }))
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(
          createCDPResponse({
            result: {
              value: {
                subscribed: true,
                listenerId: 'listener-456',
                message: 'Subscribed to cartStore with selector.',
              },
            },
          })
        )

      const result = await handler.execute({
        storeName: 'cartStore',
        selector: 'state => state.items.length',
      })

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Runtime.evaluate',
        expect.objectContaining({
          expression: expect.stringContaining('state => state.items.length'),
        }),
        testSessionId
      )
      expect(result.success).toBe(true)
    })
  })

  describe('zustand_get_devtools_state', () => {
    const handler = new ZustandToolProvider().getHandler('zustand_get_devtools_state')!

    it('should get devtools connection state', async () => {
      const mockDevtools = {
        connected: true,
        stores: ['userStore', 'cartStore'],
        actions: [
          { type: 'userStore/setUser', timestamp: 1234567890 },
          { type: 'userStore/logout', timestamp: 1234567900 },
        ],
      }
      
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPResponse({ result: { value: { available: true } } }))
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(
          createCDPResponse({
            result: {
              value: mockDevtools,
            },
          })
        )

      const result = await handler.execute({})

      expect(result).toEqual({
        success: true,
        data: mockDevtools,
      })
    })

    it('should handle devtools not connected', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPResponse({ result: { value: { available: true } } }))
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(
          createCDPResponse({
            result: {
              value: {
                connected: false,
                message: 'Redux DevTools Extension not connected',
              },
            },
          })
        )

      const result = await handler.execute({})

      expect(result).toEqual({
        success: true,
        data: {
          connected: false,
          message: 'Redux DevTools Extension not connected',
        },
      })
    })
  })

  describe('error handling', () => {
    const handler = new ZustandToolProvider().getHandler('zustand_list_stores')!

    it('should handle evaluation errors', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPResponse({ result: { value: { available: true } } }))
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPError('Cannot read property of undefined'))

      const result = await handler.execute({})

      expect(result).toEqual({
        success: false,
        error: 'Error listing stores: Cannot read property of undefined',
      })
    })

    it('should handle CDP errors', async () => {
      mockChromeClient.send.mockRejectedValueOnce(new Error('WebSocket closed'))

      const result = await handler.execute({})

      expect(result).toEqual({
        success: false,
        error: 'WebSocket closed',
      })
    })
  })
})