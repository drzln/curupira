/**
 * Tests for XState Tool Provider
 * Level 2: MCP Core tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { XStateToolProvider } from '../../../mcp/tools/providers/xstate-tools.js'
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

describe('XStateToolProvider', () => {
  let provider: XStateToolProvider

  beforeEach(() => {
    resetAllMocks()
    provider = new XStateToolProvider()
  })

  describe('listTools', () => {
    it('should return all XState tools', () => {
      const tools = provider.listTools()
      
      expect(tools).toHaveLength(4)
      
      const toolNames = tools.map(t => t.name)
      expect(toolNames).toContain('xstate_inspect_actor')
      expect(toolNames).toContain('xstate_send_event')
      expect(toolNames).toContain('xstate_list_actors')
      expect(toolNames).toContain('xstate_inspect_machine')
    })
  })

  describe('xstate_list_actors', () => {

    it('should list all active actors', async () => {
      const mockActors = [
        {
          id: 'auth.actor',
          machineId: 'authMachine',
          state: { value: 'authenticated', context: { user: { id: '123' } } },
          sessionId: 'session-1',
        },
        {
          id: 'cart.actor',
          machineId: 'cartMachine',
          state: { value: 'hasItems', context: { items: [{ id: '1' }] } },
          sessionId: 'session-2',
        },
      ]
      
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce({
          result: {
            value: {
              actors: mockActors,
            }
          }
        })

      const handler = provider.getHandler('xstate_list_actors')!

      const result = await handler.execute({})

      expect(result).toEqual({
        success: true,
        data: { actors: mockActors },
      })
    })

    it('should handle no actors found', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce({
          result: {
            value: {
              error: 'XState actors not found. Make sure XState devtools is enabled.'
            }
          }
        })

      const handler = provider.getHandler('xstate_list_actors')!

      const result = await handler.execute({})

      expect(result).toEqual({
        success: true,
        data: {
          error: 'XState actors not found. Make sure XState devtools is enabled.'
        }
      })
    })
  })

  describe('xstate_inspect_actor', () => {

    it('should inspect actor state', async () => {
      const mockActor = {
        id: 'auth.actor',
        machineId: 'authMachine',
        state: {
          value: 'authenticated',
          context: {
            user: { id: '123', name: 'John Doe' },
            token: 'abc123',
          },
          actions: [],
          activities: {},
          meta: {},
        },
        sessionId: 'session-1',
      }
      
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce({
          result: {
            value: mockActor
          }
        })

      const handler = provider.getHandler('xstate_inspect_actor')!

      const result = await handler.execute({
        actorId: 'auth.actor',
      })

      expect(result).toEqual({
        success: true,
        data: mockActor,
      })
    })

    it('should handle actor not found', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce({
          result: {
            value: {
              error: 'Actor not found'
            }
          }
        })

      const handler = provider.getHandler('xstate_inspect_actor')!

      const result = await handler.execute({
        actorId: 'nonexistent.actor',
      })

      expect(result).toEqual({
        success: true,
        data: { error: 'Actor not found' }
      })
    })
  })

  describe('xstate_inspect_machine', () => {

    it('should inspect machine configuration', async () => {
      const mockMachine = {
        id: 'authMachine',
        config: {
          initial: 'idle',
          states: {
            idle: { on: { LOGIN: 'loading' } },
            loading: { on: { SUCCESS: 'authenticated', FAILURE: 'error' } },
            authenticated: { on: { LOGOUT: 'idle' } },
            error: { on: { RETRY: 'loading' } },
          },
        },
        stateNodes: ['idle', 'loading', 'authenticated', 'error'],
        events: ['LOGIN', 'SUCCESS', 'FAILURE', 'LOGOUT', 'RETRY'],
      }
      
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce({
          result: {
            value: mockMachine
          }
        })

      const handler = provider.getHandler('xstate_inspect_machine')!

      const result = await handler.execute({
        actorId: 'auth.actor',
      })

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Runtime.evaluate',
        expect.objectContaining({
          expression: expect.stringContaining('auth.actor'),
        }),
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: mockMachine,
      })
    })
  })

  describe('xstate_send_event', () => {

    it('should send event to actor', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce({
          result: {
            value: {
              success: true,
              previousState: { value: 'idle' },
              newState: { value: 'loading' },
            }
          }
        })

      const handler = provider.getHandler('xstate_send_event')!

      const result = await handler.execute({
        actorId: 'auth.actor',
        event: { type: 'LOGIN', email: 'user@example.com', password: 'secret' },
      })

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Runtime.evaluate',
        expect.objectContaining({
          expression: expect.stringContaining(JSON.stringify({ type: 'LOGIN', email: 'user@example.com', password: 'secret' })),
        }),
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: {
          success: true,
          previousState: { value: 'idle' },
          newState: { value: 'loading' },
        }
      })
    })

    it('should handle event send failure', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce({
          result: {
            value: {
              error: 'Invalid event for current state'
            }
          }
        })

      const handler = provider.getHandler('xstate_send_event')!

      const result = await handler.execute({
        actorId: 'auth.actor',
        event: { type: 'INVALID_EVENT' },
      })

      expect(result).toEqual({
        success: true,
        data: { error: 'Invalid event for current state' }
      })
    })
  })

  describe('error handling', () => {

    it('should handle evaluation errors', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce({ exceptionDetails: { text: 'XState is not defined' } })

      const handler = provider.getHandler('xstate_list_actors')!

      const result = await handler.execute({})

      expect(result).toEqual({
        success: false,
        error: 'Script execution error: XState is not defined',
        data: {
          text: 'XState is not defined'
        }
      })
    })

    it('should handle CDP errors', async () => {
      mockChromeClient.send.mockRejectedValueOnce(new Error('Connection lost'))

      const handler = provider.getHandler('xstate_list_actors')!

      const result = await handler.execute({})

      expect(result).toEqual({
        success: false,
        error: 'Connection lost',
      })
    })
  })
})