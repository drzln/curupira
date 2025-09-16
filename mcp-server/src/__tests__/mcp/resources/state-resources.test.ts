/**
 * Tests for State Management Resource Provider
 * Level 2: MCP Core tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { StateManagementResourceProvider } from '../../../mcp/resources/providers/state-resources.js'
import { ChromeManager } from '../../../chrome/manager.js'
import { mockChromeClient, resetAllMocks, createCDPResponse, testSessionId } from '../../setup.js'

// Mock ChromeManager
vi.mock('../../../chrome/manager.js', () => ({
  ChromeManager: {
    getInstance: vi.fn(() => ({
      getClient: () => mockChromeClient,
    })),
  },
}))

describe('StateManagementResourceProvider', () => {
  let provider: StateManagementResourceProvider

  beforeEach(() => {
    resetAllMocks()
    provider = new StateManagementResourceProvider()
  })

  describe('listResources', () => {
    it('should return resources for detected state management libraries', async () => {
      // Mock detection of all state management libraries
      mockChromeClient.send
        .mockResolvedValueOnce(createCDPResponse({ result: { value: true } })) // XState detected
        .mockResolvedValueOnce(createCDPResponse({ result: { value: true } })) // Zustand detected
        .mockResolvedValueOnce(createCDPResponse({ result: { value: true } })) // Apollo detected
        .mockResolvedValueOnce(createCDPResponse({ result: { value: true } })) // Redux detected

      const resources = await provider.listResources()
      
      expect(resources.length).toBeGreaterThan(0)
      
      // Check for XState resources
      const xstateResources = resources.filter(r => r.uri.startsWith('xstate://'))
      expect(xstateResources).toHaveLength(4)
      expect(xstateResources.map(r => r.uri)).toContain('xstate://actors')
      expect(xstateResources.map(r => r.uri)).toContain('xstate://machines')
      
      // Check for Zustand resources
      const zustandResources = resources.filter(r => r.uri.startsWith('zustand://'))
      expect(zustandResources).toHaveLength(3)
      expect(zustandResources.map(r => r.uri)).toContain('zustand://stores')
      
      // Check for Apollo resources
      const apolloResources = resources.filter(r => r.uri.startsWith('apollo://'))
      expect(apolloResources).toHaveLength(4)
      expect(apolloResources.map(r => r.uri)).toContain('apollo://cache')
      
      // Check for Redux resources
      const reduxResources = resources.filter(r => r.uri.startsWith('redux://'))
      expect(reduxResources).toHaveLength(4)
      expect(reduxResources.map(r => r.uri)).toContain('redux://store')
    })

    it('should return empty array when no state management libraries detected', async () => {
      // Mock no libraries detected
      mockChromeClient.send
        .mockResolvedValueOnce(createCDPResponse({ result: { value: false } })) // No XState
        .mockResolvedValueOnce(createCDPResponse({ result: { value: false } })) // No Zustand
        .mockResolvedValueOnce(createCDPResponse({ result: { value: false } })) // No Apollo
        .mockResolvedValueOnce(createCDPResponse({ result: { value: false } })) // No Redux

      const resources = await provider.listResources()
      
      expect(resources).toEqual([])
    })

    it('should only return resources for detected libraries', async () => {
      // Mock only Zustand detected
      mockChromeClient.send
        .mockResolvedValueOnce(createCDPResponse({ result: { value: false } })) // No XState
        .mockResolvedValueOnce(createCDPResponse({ result: { value: true } }))  // Zustand detected
        .mockResolvedValueOnce(createCDPResponse({ result: { value: false } })) // No Apollo
        .mockResolvedValueOnce(createCDPResponse({ result: { value: false } })) // No Redux

      const resources = await provider.listResources()
      
      // Should only have Zustand resources
      expect(resources.every(r => r.uri.startsWith('zustand://'))).toBe(true)
      expect(resources).toHaveLength(3)
    })
  })

  describe('readResource - XState', () => {
    describe('xstate://actors', () => {
      it('should return active XState actors', async () => {
        const mockActors = [
          {
            id: 'auth-machine',
            state: 'authenticated',
            context: { user: { id: '123' } },
          },
          {
            id: 'cart-machine',
            state: 'empty',
            context: { items: [] },
          },
        ]
        
        mockChromeClient.send
          .mockResolvedValueOnce(undefined) // Runtime.enable
          .mockResolvedValueOnce(
            createCDPResponse({
              result: {
                value: { actors: mockActors },
              },
            })
          )

        const result = await provider.readResource('xstate://actors')
        
        expect(result).toEqual({ actors: mockActors })
      })
    })

    describe('xstate://machines', () => {
      it('should return machine definitions', async () => {
        const mockMachines = [
          {
            id: 'authMachine',
            initial: 'idle',
            states: ['idle', 'loading', 'authenticated', 'error'],
          },
        ]
        
        mockChromeClient.send
          .mockResolvedValueOnce(undefined) // Runtime.enable
          .mockResolvedValueOnce(
            createCDPResponse({
              result: {
                value: { machines: mockMachines },
              },
            })
          )

        const result = await provider.readResource('xstate://machines')
        
        expect(result).toEqual({ machines: mockMachines })
      })
    })

    describe('xstate://inspector', () => {
      it('should return inspector status', async () => {
        const mockInspector = {
          enabled: true,
          connectedActors: 2,
          eventLog: [
            { type: 'LOGIN', timestamp: 123456 },
          ],
        }
        
        mockChromeClient.send
          .mockResolvedValueOnce(undefined) // Runtime.enable
          .mockResolvedValueOnce(
            createCDPResponse({
              result: {
                value: mockInspector,
              },
            })
          )

        const result = await provider.readResource('xstate://inspector')
        
        expect(result).toEqual(mockInspector)
      })
    })
  })

  describe('readResource - Zustand', () => {
    describe('zustand://stores', () => {
      it('should return all Zustand stores', async () => {
        const mockStores = {
          stores: [
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
          ],
        }
        
        mockChromeClient.send
          .mockResolvedValueOnce(undefined) // Runtime.enable
          .mockResolvedValueOnce(
            createCDPResponse({
              result: {
                value: mockStores,
              },
            })
          )

        const result = await provider.readResource('zustand://stores')
        
        expect(result).toEqual(mockStores)
      })
    })

    describe('zustand://devtools', () => {
      it('should return devtools connection status', async () => {
        const mockDevtools = {
          connected: true,
          actions: [
            { type: 'setUser', timestamp: 123456 },
            { type: 'logout', timestamp: 123457 },
          ],
        }
        
        mockChromeClient.send
          .mockResolvedValueOnce(undefined) // Runtime.enable
          .mockResolvedValueOnce(
            createCDPResponse({
              result: {
                value: mockDevtools,
              },
            })
          )

        const result = await provider.readResource('zustand://devtools')
        
        expect(result).toEqual(mockDevtools)
      })
    })
  })

  describe('readResource - Apollo', () => {
    describe('apollo://cache', () => {
      it('should return Apollo cache contents', async () => {
        const mockCache = {
          ROOT_QUERY: {
            'user({"id":"123"})': { __ref: 'User:123' },
          },
          'User:123': {
            id: '123',
            name: 'John Doe',
            email: 'john@example.com',
          },
        }
        
        mockChromeClient.send
          .mockResolvedValueOnce(undefined) // Runtime.enable
          .mockResolvedValueOnce(
            createCDPResponse({
              result: {
                value: { cache: mockCache },
              },
            })
          )

        const result = await provider.readResource('apollo://cache')
        
        expect(result).toEqual({ cache: mockCache })
      })
    })

    describe('apollo://queries', () => {
      it('should return active queries', async () => {
        const mockQueries = {
          active: [
            {
              query: 'GetUser',
              variables: { id: '123' },
              loading: false,
              data: { user: { id: '123', name: 'John' } },
            },
          ],
        }
        
        mockChromeClient.send
          .mockResolvedValueOnce(undefined) // Runtime.enable
          .mockResolvedValueOnce(
            createCDPResponse({
              result: {
                value: mockQueries,
              },
            })
          )

        const result = await provider.readResource('apollo://queries')
        
        expect(result).toEqual(mockQueries)
      })
    })

    describe('apollo://mutations', () => {
      it('should return recent mutations', async () => {
        const mockMutations = {
          recent: [
            {
              mutation: 'UpdateUser',
              variables: { id: '123', name: 'Jane' },
              timestamp: 123456,
              result: { success: true },
            },
          ],
        }
        
        mockChromeClient.send
          .mockResolvedValueOnce(undefined) // Runtime.enable
          .mockResolvedValueOnce(
            createCDPResponse({
              result: {
                value: mockMutations,
              },
            })
          )

        const result = await provider.readResource('apollo://mutations')
        
        expect(result).toEqual(mockMutations)
      })
    })
  })

  describe('readResource - Redux', () => {
    describe('redux://store', () => {
      it('should return Redux store state', async () => {
        const mockStore = {
          state: {
            user: { id: '123', name: 'John' },
            cart: { items: [], total: 0 },
          },
          subscriberCount: 10,
        }
        
        mockChromeClient.send
          .mockResolvedValueOnce(undefined) // Runtime.enable
          .mockResolvedValueOnce(
            createCDPResponse({
              result: {
                value: mockStore,
              },
            })
          )

        const result = await provider.readResource('redux://store')
        
        expect(result).toEqual(mockStore)
      })
    })

    describe('redux://actions', () => {
      it('should return recent actions', async () => {
        const mockActions = {
          recent: [
            { type: 'USER_LOGIN', payload: { id: '123' }, timestamp: 123456 },
            { type: 'ADD_TO_CART', payload: { item: 'ABC' }, timestamp: 123457 },
          ],
        }
        
        mockChromeClient.send
          .mockResolvedValueOnce(undefined) // Runtime.enable
          .mockResolvedValueOnce(
            createCDPResponse({
              result: {
                value: mockActions,
              },
            })
          )

        const result = await provider.readResource('redux://actions')
        
        expect(result).toEqual(mockActions)
      })
    })

    describe('redux://devtools', () => {
      it('should return Redux DevTools status', async () => {
        const mockDevtools = {
          connected: true,
          features: ['time-travel', 'action-dispatch'],
          currentStateIndex: 5,
        }
        
        mockChromeClient.send
          .mockResolvedValueOnce(undefined) // Runtime.enable
          .mockResolvedValueOnce(
            createCDPResponse({
              result: {
                value: mockDevtools,
              },
            })
          )

        const result = await provider.readResource('redux://devtools')
        
        expect(result).toEqual(mockDevtools)
      })
    })
  })

  describe('error handling', () => {
    it('should handle unknown resource URI', async () => {
      const result = await provider.readResource('unknown://resource')
      
      expect(result).toEqual({
        error: 'Unknown state management resource: unknown://resource',
      })
    })

    it('should handle CDP errors gracefully', async () => {
      mockChromeClient.send.mockRejectedValueOnce(new Error('CDP connection failed'))

      const result = await provider.readResource('xstate://actors')
      
      expect(result).toEqual({
        error: 'Failed to read state resource: CDP connection failed',
      })
    })
  })
})