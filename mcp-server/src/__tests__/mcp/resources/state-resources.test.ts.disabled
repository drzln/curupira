/**
 * Tests for State Management Resource Provider
 * Level 2: MCP Core tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { StateResourceProviderImpl } from '../../../mcp/resources/providers/state-resources.js'
import { StateManagementResourceProvider } from '../../../mcp/resources/providers/state.js'
import { ChromeManager } from '../../../chrome/manager.js'
import { mockChromeClient, resetAllMocks, createCDPResponse, testSessionId } from '../../setup.js'

// Mock StateManagementResourceProvider
vi.mock('../../../mcp/resources/providers/state.js', () => ({
  StateManagementResourceProvider: vi.fn().mockImplementation(() => ({
    detectXState: vi.fn(),
    detectZustand: vi.fn(),
    detectApollo: vi.fn(),
    detectRedux: vi.fn(),
    getXStateActors: vi.fn(),
    getXStateMachines: vi.fn(),
    getXStateInspector: vi.fn(),
    getZustandStores: vi.fn(),
    getZustandDevtools: vi.fn(),
    getApolloCache: vi.fn(),
    getApolloQueries: vi.fn(),
    getApolloMutations: vi.fn(),
    getReduxStore: vi.fn(),
    getReduxActions: vi.fn(),
    getReduxDevtools: vi.fn(),
  }))
}))

// Mock ChromeManager
vi.mock('../../../chrome/manager.js', () => ({
  ChromeManager: {
    getInstance: vi.fn(() => ({
      getClient: () => mockChromeClient,
    })),
  },
}))

describe('StateResourceProviderImpl', () => {
  let provider: StateResourceProviderImpl

  beforeEach(() => {
    resetAllMocks()
    provider = new StateResourceProviderImpl()
  })

  describe('listResources', () => {
    it('should return resources for detected state management libraries', async () => {
      // Mock detection of all state management libraries
      const mockStateProvider = (provider as any).stateProvider
      mockStateProvider.detectXState.mockResolvedValue(true)
      mockStateProvider.detectZustand.mockResolvedValue(true)
      mockStateProvider.detectApollo.mockResolvedValue(true)

      const resources = await provider.listResources()
      
      expect(resources.length).toBeGreaterThan(0)
      
      // Check for XState resources
      const xstateResources = resources.filter(r => r.uri.startsWith('state/xstate/'))
      expect(xstateResources).toHaveLength(3)
      expect(xstateResources.map(r => r.uri)).toContain('state/xstate/actors')
      expect(xstateResources.map(r => r.uri)).toContain('state/xstate/machines')
      expect(xstateResources.map(r => r.uri)).toContain('state/xstate/inspector')
      
      // Check for Zustand resources
      const zustandResources = resources.filter(r => r.uri.startsWith('state/zustand/'))
      expect(zustandResources).toHaveLength(2)
      expect(zustandResources.map(r => r.uri)).toContain('state/zustand/stores')
      expect(zustandResources.map(r => r.uri)).toContain('state/zustand/devtools')
      
      // Check for Apollo resources
      const apolloResources = resources.filter(r => r.uri.startsWith('state/apollo/'))
      expect(apolloResources).toHaveLength(4)
      expect(apolloResources.map(r => r.uri)).toContain('state/apollo/client')
      expect(apolloResources.map(r => r.uri)).toContain('state/apollo/cache')
      expect(apolloResources.map(r => r.uri)).toContain('state/apollo/queries')
      expect(apolloResources.map(r => r.uri)).toContain('state/apollo/mutations')
    })

    it('should return empty array when no state management libraries detected', async () => {
      // Mock no libraries detected
      const mockStateProvider = (provider as any).stateProvider
      mockStateProvider.detectXState.mockResolvedValue(false)
      mockStateProvider.detectZustand.mockResolvedValue(false)
      mockStateProvider.detectApollo.mockResolvedValue(false)

      const resources = await provider.listResources()
      
      expect(resources).toEqual([])
    })

    it('should only return resources for detected libraries', async () => {
      // Mock only Zustand detected
      const mockStateProvider = (provider as any).stateProvider
      mockStateProvider.detectXState.mockResolvedValue(false)
      mockStateProvider.detectZustand.mockResolvedValue(true)
      mockStateProvider.detectApollo.mockResolvedValue(false)

      const resources = await provider.listResources()
      
      // Should only have Zustand resources
      expect(resources.every(r => r.uri.startsWith('state/zustand/'))).toBe(true)
      expect(resources).toHaveLength(2)
    })
  })

  describe('readResource - XState', () => {
    describe('state/xstate/actors', () => {
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
        
        const mockStateProvider = (provider as any).stateProvider
        mockStateProvider.getXStateActors.mockResolvedValue(mockActors)

        const result = await provider.readResource('state/xstate/actors')
        
        expect(result).toEqual(mockActors)
      })
    })

    describe('state/xstate/machines', () => {
      it('should return machine definitions', async () => {
        const mockMachines = [
          {
            id: 'authMachine',
            initial: 'idle',
            states: ['idle', 'loading', 'authenticated', 'error'],
          },
        ]
        
        const mockStateProvider = (provider as any).stateProvider
        mockStateProvider.getXStateMachines.mockResolvedValue(mockMachines)

        const result = await provider.readResource('state/xstate/machines')
        
        expect(result).toEqual(mockMachines)
      })
    })

    describe('state/xstate/inspector', () => {
      it('should return inspector status', async () => {
        const result = await provider.readResource('state/xstate/inspector')
        
        expect(result).toEqual({
          description: 'XState inspector connection status',
          connected: false,
          hint: 'Use @xstate/inspect for debugging'
        })
      })
    })
  })

  describe('readResource - Zustand', () => {
    describe('state/zustand/stores', () => {
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
        
        const mockStateProvider = (provider as any).stateProvider
        mockStateProvider.getZustandStores.mockResolvedValue(mockStores)

        const result = await provider.readResource('state/zustand/stores')
        
        expect(result).toEqual(mockStores)
      })
    })

    describe('state/zustand/devtools', () => {
      it('should return devtools connection status', async () => {
        const result = await provider.readResource('state/zustand/devtools')
        
        expect(result).toEqual({
          description: 'Zustand Redux DevTools integration',
          connected: false,
          hint: 'Use zustand/middleware for DevTools'
        })
      })
    })
  })

  describe('readResource - Apollo', () => {
    describe('state/apollo/cache', () => {
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
        
        const mockStateProvider = (provider as any).stateProvider
        mockStateProvider.getApolloCache.mockResolvedValue(mockCache)

        const result = await provider.readResource('state/apollo/cache')
        
        expect(result).toEqual(mockCache)
      })
    })

    describe('state/apollo/queries', () => {
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
        
        const mockStateProvider = (provider as any).stateProvider
        mockStateProvider.getApolloQueries.mockResolvedValue(mockQueries)

        const result = await provider.readResource('state/apollo/queries')
        
        expect(result).toEqual(mockQueries)
      })
    })

    describe('state/apollo/mutations', () => {
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
        
        const mockStateProvider = (provider as any).stateProvider
        mockStateProvider.getApolloMutations.mockResolvedValue(mockMutations)

        const result = await provider.readResource('state/apollo/mutations')
        
        expect(result).toEqual(mockMutations)
      })
    })
  })


  describe('error handling', () => {
    it('should handle unknown resource URI', async () => {
      await expect(provider.readResource('unknown://resource')).rejects.toThrow('Unknown state management resource: unknown://resource')
    })

    it('should handle CDP errors gracefully', async () => {
      const mockStateProvider = (provider as any).stateProvider
      mockStateProvider.getXStateActors.mockRejectedValue(new Error('CDP connection failed'))

      await expect(provider.readResource('state/xstate/actors')).rejects.toThrow('CDP connection failed')
    })
  })
})