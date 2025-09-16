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

// Mock BaseToolProvider with executeScript method
vi.mock('../../../mcp/tools/providers/base.js', () => ({
  BaseToolProvider: class {
    async getSessionId(argSessionId?: string) {
      return argSessionId || testSessionId
    }
    
    async executeScript(script: string, sessionId: string) {
      const manager = this.constructor.name === 'ChromeManager' ? this : { getClient: () => mockChromeClient }
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

describe('ReduxToolProvider', () => {
  let provider: ReduxToolProvider

  beforeEach(() => {
    resetAllMocks()
    provider = new ReduxToolProvider()
  })

  describe('listTools', () => {
    it('should return all Redux tools', () => {
      const tools = provider.listTools()
      
      expect(tools).toHaveLength(4) // Actual count from implementation
      
      const toolNames = tools.map(t => t.name)
      expect(toolNames).toContain('redux_inspect_state')
      expect(toolNames).toContain('redux_dispatch_action')
      expect(toolNames).toContain('redux_get_actions')
      expect(toolNames).toContain('redux_time_travel')
    })
  })

  describe('redux_inspect_state', () => {

    it('should inspect Redux store state', async () => {
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
        .mockResolvedValueOnce(createCDPResponse({
          state: mockState,
          stateKeys: Object.keys(mockState),
          source: 'Redux Store'
        }))

      const handler = provider.getHandler('redux_inspect_state')!

      const result = await handler.execute({})

      expect(result).toEqual({
        success: true,
        data: {
          state: mockState,
          stateKeys: Object.keys(mockState),
          source: 'Redux Store'
        }
      })
    })

    it('should inspect state by path', async () => {
      const mockUserState = {
        id: '123',
        name: 'John Doe',
        isAuthenticated: true,
      }
      
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPResponse({
          path: 'user',
          value: mockUserState,
          type: 'object'
        }))

      const handler = provider.getHandler('redux_inspect_state')!

      const result = await handler.execute({
        path: 'user',
      })

      expect(result).toEqual({
        success: true,
        data: {
          path: 'user',
          value: mockUserState,
          type: 'object'
        }
      })
    })

    it('should handle Redux store not found', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPResponse({
          error: 'Redux store not found. Make sure Redux DevTools is enabled or store is exposed.'
        }))

      const handler = provider.getHandler('redux_inspect_state')!

      const result = await handler.execute({})

      expect(result).toEqual({
        success: false,
        error: 'Redux store not found. Make sure Redux DevTools is enabled or store is exposed.',
        data: {
          error: 'Redux store not found. Make sure Redux DevTools is enabled or store is exposed.'
        }
      })
    })
  })

  describe('redux_dispatch_action', () => {

    it('should dispatch action with type and payload', async () => {
      const actionType = 'user/login'
      const payload = { id: '123', name: 'John Doe' }
      const previousState = { user: null }
      const newState = { user: { id: '123', name: 'John Doe', isAuthenticated: true } }
      
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPResponse({
          success: true,
          action: { type: actionType, payload },
          previousState,
          newState,
          stateChanged: true
        }))

      const handler = provider.getHandler('redux_dispatch_action')!

      const result = await handler.execute({ 
        type: actionType,
        payload 
      })

      expect(result).toEqual({
        success: true,
        data: {
          success: true,
          action: { type: actionType, payload },
          previousState,
          newState,
          stateChanged: true
        }
      })
    })

    it('should dispatch action with type only', async () => {
      const actionType = 'cart/clear'
      const previousState = { cart: { items: [1, 2, 3] } }
      const newState = { cart: { items: [] } }
      
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPResponse({
          success: true,
          action: { type: actionType },
          previousState,
          newState,
          stateChanged: true
        }))

      const handler = provider.getHandler('redux_dispatch_action')!

      const result = await handler.execute({
        type: actionType
      })

      expect(result.success).toBe(true)
      expect(result.data?.action).toEqual({ type: actionType })
      expect(result.data?.stateChanged).toBe(true)
    })

    it('should handle dispatch errors', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPResponse({
          error: 'Failed to dispatch action: Action type is required',
          action: { type: 'invalid' }
        }))

      const handler = provider.getHandler('redux_dispatch_action')!

      const result = await handler.execute({
        type: 'invalid'
      })

      expect(result).toEqual({
        success: false,
        error: 'Failed to dispatch action: Action type is required',
        data: {
          error: 'Failed to dispatch action: Action type is required',
          action: { type: 'invalid' }
        }
      })
    })
  })

  describe('redux_get_actions', () => {

    it('should get actions from Redux DevTools', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPResponse({
          message: 'Action history available in Redux DevTools',
          tip: 'Open Redux DevTools in Chrome to see full action history'
        }))

      const handler = provider.getHandler('redux_get_actions')!

      const result = await handler.execute({})

      expect(result).toEqual({
        success: true,
        data: {
          message: 'Action history available in Redux DevTools',
          tip: 'Open Redux DevTools in Chrome to see full action history'
        }
      })
    })

    it('should handle when DevTools not available', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPResponse({
          error: 'Action history not available. Redux DevTools required for action history.',
          suggestion: 'Install Redux DevTools extension or add logging middleware to your store'
        }))

      const handler = provider.getHandler('redux_get_actions')!

      const result = await handler.execute({
        limit: 10
      })

      expect(result).toEqual({
        success: true,
        data: {
          error: 'Action history not available. Redux DevTools required for action history.',
          suggestion: 'Install Redux DevTools extension or add logging middleware to your store'
        }
      })
    })
  })

  describe('redux_time_travel', () => {

    it('should time travel to specific action index', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPResponse({
          success: true,
          message: 'Time travel command sent to Redux DevTools',
          actionIndex: 5
        }))

      const handler = provider.getHandler('redux_time_travel')!

      const result = await handler.execute({
        actionIndex: 5,
      })

      expect(result).toEqual({
        success: true,
        data: {
          success: true,
          message: 'Time travel command sent to Redux DevTools',
          actionIndex: 5
        }
      })
    })

    it('should handle Redux DevTools not available', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPResponse({
          error: 'Redux DevTools required for time travel functionality'
        }))

      const handler = provider.getHandler('redux_time_travel')!

      const result = await handler.execute({
        actionIndex: 5,
      })

      expect(result).toEqual({
        success: false,
        error: 'Redux DevTools required for time travel functionality'
      })
    })

    it('should handle DevTools not properly initialized', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPResponse({
          error: 'Redux DevTools not properly initialized'
        }))

      const handler = provider.getHandler('redux_time_travel')!

      const result = await handler.execute({
        actionIndex: 3,
      })

      expect(result).toEqual({
        success: false,
        error: 'Redux DevTools not properly initialized'
      })
    })
  })

  describe('error handling', () => {

    it('should handle executeScript errors', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPError('Cannot read property store of undefined'))

      const handler = provider.getHandler('redux_inspect_state')!

      const result = await handler.execute({})

      expect(result).toEqual({
        success: false,
        error: 'Script execution error: Cannot read property store of undefined',
        data: expect.any(Object)
      })
    })

    it('should handle CDP connection errors', async () => {
      mockChromeClient.send.mockRejectedValueOnce(new Error('CDP disconnected'))

      const handler = provider.getHandler('redux_inspect_state')!

      const result = await handler.execute({})

      expect(result).toEqual({
        success: false,
        error: 'CDP disconnected',
      })
    })

    it('should handle dispatch action errors', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPResponse({
          error: 'Redux store not found or dispatch not available'
        }))

      const handler = provider.getHandler('redux_dispatch_action')!

      const result = await handler.execute({
        type: 'test/action'
      })

      expect(result).toEqual({
        success: false,
        error: 'Redux store not found or dispatch not available',
        data: {
          error: 'Redux store not found or dispatch not available'
        }
      })
    })

    it('should handle time travel errors', async () => {
      mockChromeClient.send.mockRejectedValueOnce(new Error('Network error'))

      const handler = provider.getHandler('redux_time_travel')!

      const result = await handler.execute({
        actionIndex: 5
      })

      expect(result).toEqual({
        success: false,
        error: 'Network error',
      })
    })
  })
})