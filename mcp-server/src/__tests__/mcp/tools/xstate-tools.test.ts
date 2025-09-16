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
      
      expect(tools).toHaveLength(8)
      
      const toolNames = tools.map(t => t.name)
      expect(toolNames).toContain('xstate_list_machines')
      expect(toolNames).toContain('xstate_list_actors')
      expect(toolNames).toContain('xstate_inspect_machine')
      expect(toolNames).toContain('xstate_inspect_actor')
      expect(toolNames).toContain('xstate_send_event')
      expect(toolNames).toContain('xstate_get_state_value')
      expect(toolNames).toContain('xstate_enable_inspector')
      expect(toolNames).toContain('xstate_disable_inspector')
    })
  })

  describe('xstate_list_machines', () => {
    const handler = new XStateToolProvider().getHandler('xstate_list_machines')!

    it('should list all XState machines', async () => {
      const mockMachines = [
        {
          id: 'authMachine',
          config: {
            initial: 'idle',
            states: { idle: {}, loading: {}, authenticated: {} },
          },
        },
        {
          id: 'cartMachine',
          config: {
            initial: 'empty',
            states: { empty: {}, hasItems: {} },
          },
        },
      ]
      
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPResponse({ result: { value: { available: true } } })) // Check available
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(
          createCDPResponse({
            result: {
              value: { machines: mockMachines },
            },
          })
        )

      const result = await handler.execute({})

      expect(result).toEqual({
        success: true,
        data: { machines: mockMachines },
      })
    })

    it('should handle XState not available', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPResponse({ result: { value: { available: false } } }))

      const result = await handler.execute({})

      expect(result).toEqual({
        success: false,
        error: 'XState not available in the page',
      })
    })
  })

  describe('xstate_list_actors', () => {
    const handler = new XStateToolProvider().getHandler('xstate_list_actors')!

    it('should list all active actors', async () => {
      const mockActors = [
        {
          id: 'auth.actor',
          machineId: 'authMachine',
          state: { value: 'authenticated', context: { user: { id: '123' } } },
          sessionId: 'session-1',
        },
      ]
      
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPResponse({ result: { value: { available: true } } }))
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(
          createCDPResponse({
            result: {
              value: { actors: mockActors },
            },
          })
        )

      const result = await handler.execute({})

      expect(result).toEqual({
        success: true,
        data: { actors: mockActors },
      })
    })
  })

  describe('xstate_inspect_machine', () => {
    const handler = new XStateToolProvider().getHandler('xstate_inspect_machine')!

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
        .mockResolvedValueOnce(createCDPResponse({ result: { value: { available: true } } }))
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(
          createCDPResponse({
            result: {
              value: mockMachine,
            },
          })
        )

      const result = await handler.execute({
        machineId: 'authMachine',
      })

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Runtime.evaluate',
        expect.objectContaining({
          expression: expect.stringContaining('authMachine'),
        }),
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: mockMachine,
      })
    })

    it('should handle machine not found', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPResponse({ result: { value: { available: true } } }))
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(
          createCDPResponse({
            result: {
              value: { error: 'Machine not found: unknownMachine' },
            },
          })
        )

      const result = await handler.execute({
        machineId: 'unknownMachine',
      })

      expect(result).toEqual({
        success: false,
        error: 'Machine not found: unknownMachine',
        data: { error: 'Machine not found: unknownMachine' },
      })
    })
  })

  describe('xstate_inspect_actor', () => {
    const handler = new XStateToolProvider().getHandler('xstate_inspect_actor')!

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
        .mockResolvedValueOnce(createCDPResponse({ result: { value: { available: true } } }))
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(
          createCDPResponse({
            result: {
              value: mockActor,
            },
          })
        )

      const result = await handler.execute({
        actorId: 'auth.actor',
      })

      expect(result).toEqual({
        success: true,
        data: mockActor,
      })
    })
  })

  describe('xstate_send_event', () => {
    const handler = new XStateToolProvider().getHandler('xstate_send_event')!

    it('should send event to actor', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPResponse({ result: { value: { available: true } } }))
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(
          createCDPResponse({
            result: {
              value: {
                success: true,
                newState: { value: 'loading' },
              },
            },
          })
        )

      const result = await handler.execute({
        actorId: 'auth.actor',
        event: { type: 'LOGIN', email: 'user@example.com' },
      })

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Runtime.evaluate',
        expect.objectContaining({
          expression: expect.stringContaining('{"type":"LOGIN","email":"user@example.com"}'),
        }),
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: {
          success: true,
          newState: { value: 'loading' },
        },
      })
    })

    it('should send simple string event', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPResponse({ result: { value: { available: true } } }))
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(
          createCDPResponse({
            result: {
              value: {
                success: true,
                newState: { value: 'idle' },
              },
            },
          })
        )

      const result = await handler.execute({
        actorId: 'auth.actor',
        event: 'LOGOUT',
      })

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Runtime.evaluate',
        expect.objectContaining({
          expression: expect.stringContaining('"LOGOUT"'),
        }),
        testSessionId
      )
      expect(result.success).toBe(true)
    })
  })

  describe('xstate_get_state_value', () => {
    const handler = new XStateToolProvider().getHandler('xstate_get_state_value')!

    it('should get current state value', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPResponse({ result: { value: { available: true } } }))
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(
          createCDPResponse({
            result: {
              value: {
                value: 'authenticated.profile',
                context: { user: { id: '123' } },
                matches: ['authenticated', 'authenticated.profile'],
              },
            },
          })
        )

      const result = await handler.execute({
        actorId: 'auth.actor',
      })

      expect(result).toEqual({
        success: true,
        data: {
          value: 'authenticated.profile',
          context: { user: { id: '123' } },
          matches: ['authenticated', 'authenticated.profile'],
        },
      })
    })
  })

  describe('xstate_enable_inspector', () => {
    const handler = new XStateToolProvider().getHandler('xstate_enable_inspector')!

    it('should enable XState inspector', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPResponse({ result: { value: { available: true } } }))
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(
          createCDPResponse({
            result: {
              value: {
                enabled: true,
                url: 'https://stately.ai/viz?inspect',
              },
            },
          })
        )

      const result = await handler.execute({})

      expect(result).toEqual({
        success: true,
        data: {
          enabled: true,
          url: 'https://stately.ai/viz?inspect',
        },
      })
    })
  })

  describe('xstate_disable_inspector', () => {
    const handler = new XStateToolProvider().getHandler('xstate_disable_inspector')!

    it('should disable XState inspector', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPResponse({ result: { value: { available: true } } }))
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(
          createCDPResponse({
            result: {
              value: { disabled: true },
            },
          })
        )

      const result = await handler.execute({})

      expect(result).toEqual({
        success: true,
        data: { disabled: true },
      })
    })
  })

  describe('error handling', () => {
    const handler = new XStateToolProvider().getHandler('xstate_list_machines')!

    it('should handle evaluation errors', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPResponse({ result: { value: { available: true } } }))
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPError('XState is not defined'))

      const result = await handler.execute({})

      expect(result).toEqual({
        success: false,
        error: 'Error listing machines: XState is not defined',
      })
    })

    it('should handle CDP errors', async () => {
      mockChromeClient.send.mockRejectedValueOnce(new Error('Connection lost'))

      const result = await handler.execute({})

      expect(result).toEqual({
        success: false,
        error: 'Connection lost',
      })
    })
  })
})