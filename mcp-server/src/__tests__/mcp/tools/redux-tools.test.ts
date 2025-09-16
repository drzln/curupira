/**
 * Tests for Redux Tool Provider
 * Level 2: MCP Core tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ReduxToolProvider } from '../../../mcp/tools/providers/redux-tools.js'
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

describe('ReduxToolProvider', () => {
  let provider: ReduxToolProvider

  beforeEach(() => {
    resetAllMocks()
    provider = new ReduxToolProvider()
  })

  describe('listTools', () => {
    it('should return all Redux tools', () => {
      const tools = provider.listTools()
      
      expect(tools).toHaveLength(6)
      
      const toolNames = tools.map(t => t.name)
      expect(toolNames).toContain('redux_get_state')
      expect(toolNames).toContain('redux_dispatch_action')
      expect(toolNames).toContain('redux_get_action_history')
      expect(toolNames).toContain('redux_time_travel')
      expect(toolNames).toContain('redux_subscribe')
      expect(toolNames).toContain('redux_get_devtools_state')
    })
  })

  describe('redux_get_state', () => {
    const handler = new ReduxToolProvider().getHandler('redux_get_state')!

    it('should get Redux store state', async () => {
      const mockState = {
        user: {
          id: '123',
          name: 'John Doe',
          isAuthenticated: true,
        },
        cart: {
          items: [
            { id: '1', name: 'Product 1', price: 29.99 },
            { id: '2', name: 'Product 2', price: 49.99 },
          ],
          total: 79.98,
        },
        ui: {
          theme: 'dark',
          sidebarOpen: true,
        },
      }
      
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPResponse({ result: { value: { available: true } } })) // Check available
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(
          createCDPResponse({
            result: {
              value: { state: mockState },
            },
          })
        )

      const result = await handler.execute({})

      expect(result).toEqual({
        success: true,
        data: { state: mockState },
      })
    })

    it('should get state slice by path', async () => {
      const mockSlice = {
        id: '123',
        name: 'John Doe',
        isAuthenticated: true,
      }
      
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPResponse({ result: { value: { available: true } } }))
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(
          createCDPResponse({
            result: {
              value: { state: mockSlice },
            },
          })
        )

      const result = await handler.execute({
        path: 'user',
      })

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Runtime.evaluate',
        expect.objectContaining({
          expression: expect.stringContaining('user'),
        }),
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: { state: mockSlice },
      })
    })

    it('should handle Redux not available', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPResponse({ result: { value: { available: false } } }))

      const result = await handler.execute({})

      expect(result).toEqual({
        success: false,
        error: 'Redux not available in the page',
      })
    })
  })

  describe('redux_dispatch_action', () => {
    const handler = new ReduxToolProvider().getHandler('redux_dispatch_action')!

    it('should dispatch action object', async () => {
      const action = {
        type: 'user/login',
        payload: { id: '123', name: 'John Doe' },
      }
      
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPResponse({ result: { value: { available: true } } }))
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(
          createCDPResponse({
            result: {
              value: {
                dispatched: true,
                action,
                newState: {
                  user: { id: '123', name: 'John Doe', isAuthenticated: true },
                },
              },
            },
          })
        )

      const result = await handler.execute({ action })

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Runtime.evaluate',
        expect.objectContaining({
          expression: expect.stringContaining(JSON.stringify(action)),
        }),
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: {
          dispatched: true,
          action,
          newState: {
            user: { id: '123', name: 'John Doe', isAuthenticated: true },
          },
        },
      })
    })

    it('should dispatch simple action type', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPResponse({ result: { value: { available: true } } }))
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(
          createCDPResponse({
            result: {
              value: {
                dispatched: true,
                action: { type: 'cart/clear' },
              },
            },
          })
        )

      const result = await handler.execute({
        action: 'cart/clear',
      })

      expect(result.success).toBe(true)
      expect(result.data?.action).toEqual({ type: 'cart/clear' })
    })
  })

  describe('redux_get_action_history', () => {
    const handler = new ReduxToolProvider().getHandler('redux_get_action_history')!

    it('should get action history', async () => {
      const mockHistory = [
        {
          type: '@@INIT',
          timestamp: 1234567890,
        },
        {
          type: 'user/login',
          payload: { id: '123' },
          timestamp: 1234567900,
        },
        {
          type: 'cart/addItem',
          payload: { id: '1', name: 'Product 1' },
          timestamp: 1234567910,
        },
      ]
      
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPResponse({ result: { value: { available: true } } }))
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(
          createCDPResponse({
            result: {
              value: { actions: mockHistory },
            },
          })
        )

      const result = await handler.execute({})

      expect(result).toEqual({
        success: true,
        data: { actions: mockHistory },
      })
    })

    it('should limit action history', async () => {
      const mockHistory = [
        { type: 'action1', timestamp: 1 },
        { type: 'action2', timestamp: 2 },
      ]
      
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPResponse({ result: { value: { available: true } } }))
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(
          createCDPResponse({
            result: {
              value: { actions: mockHistory },
            },
          })
        )

      const result = await handler.execute({
        limit: 2,
      })

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Runtime.evaluate',
        expect.objectContaining({
          expression: expect.stringContaining('2'),
        }),
        testSessionId
      )
      expect(result.data?.actions).toHaveLength(2)
    })
  })

  describe('redux_time_travel', () => {
    const handler = new ReduxToolProvider().getHandler('redux_time_travel')!

    it('should time travel to specific state index', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPResponse({ result: { value: { available: true } } }))
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(
          createCDPResponse({
            result: {
              value: {
                success: true,
                jumpedTo: 5,
                currentState: { user: { id: '123' } },
              },
            },
          })
        )

      const result = await handler.execute({
        index: 5,
      })

      expect(result).toEqual({
        success: true,
        data: {
          success: true,
          jumpedTo: 5,
          currentState: { user: { id: '123' } },
        },
      })
    })

    it('should handle Redux DevTools not available', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPResponse({ result: { value: { available: true } } }))
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(
          createCDPResponse({
            result: {
              value: { error: 'Redux DevTools not available' },
            },
          })
        )

      const result = await handler.execute({
        index: 5,
      })

      expect(result).toEqual({
        success: false,
        error: 'Redux DevTools not available',
        data: { error: 'Redux DevTools not available' },
      })
    })
  })

  describe('redux_subscribe', () => {
    const handler = new ReduxToolProvider().getHandler('redux_subscribe')!

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
                listenerId: 'listener-redux-123',
                message: 'Subscribed to Redux store. Check console for state changes.',
              },
            },
          })
        )

      const result = await handler.execute({})

      expect(result).toEqual({
        success: true,
        data: {
          subscribed: true,
          listenerId: 'listener-redux-123',
          message: 'Subscribed to Redux store. Check console for state changes.',
        },
      })
    })

    it('should subscribe with selector', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPResponse({ result: { value: { available: true } } }))
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(
          createCDPResponse({
            result: {
              value: {
                subscribed: true,
                listenerId: 'listener-redux-456',
                message: 'Subscribed with selector.',
              },
            },
          })
        )

      const result = await handler.execute({
        selector: 'state => state.user.isAuthenticated',
      })

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Runtime.evaluate',
        expect.objectContaining({
          expression: expect.stringContaining('state => state.user.isAuthenticated'),
        }),
        testSessionId
      )
      expect(result.success).toBe(true)
    })
  })

  describe('redux_get_devtools_state', () => {
    const handler = new ReduxToolProvider().getHandler('redux_get_devtools_state')!

    it('should get Redux DevTools state', async () => {
      const mockDevtools = {
        connected: true,
        features: {
          pause: true,
          lock: true,
          persist: true,
          export: true,
          import: true,
          jump: true,
          skip: true,
          reorder: true,
          dispatch: true,
          test: true,
        },
        actionsCount: 42,
        currentStateIndex: 41,
        isLocked: false,
        isPaused: false,
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

    it('should handle DevTools not connected', async () => {
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
    const handler = new ReduxToolProvider().getHandler('redux_get_state')!

    it('should handle evaluation errors', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPResponse({ result: { value: { available: true } } }))
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPError('Cannot read property store of undefined'))

      const result = await handler.execute({})

      expect(result).toEqual({
        success: false,
        error: 'Error getting state: Cannot read property store of undefined',
      })
    })

    it('should handle CDP errors', async () => {
      mockChromeClient.send.mockRejectedValueOnce(new Error('CDP disconnected'))

      const result = await handler.execute({})

      expect(result).toEqual({
        success: false,
        error: 'CDP disconnected',
      })
    })
  })
})