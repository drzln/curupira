/**
 * Tests for React Resource Provider
 * Level 2: MCP Core tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ReactResourceProviderImpl } from '../../../mcp/resources/providers/react-resources.js'
import { ReactFrameworkProvider } from '../../../mcp/resources/providers/react.js'
import { ChromeManager } from '../../../chrome/manager.js'
import { mockChromeClient, resetAllMocks, createCDPResponse, testSessionId } from '../../setup.js'

// Mock ReactFrameworkProvider
vi.mock('../../../mcp/resources/providers/react.js', () => ({
  ReactFrameworkProvider: vi.fn().mockImplementation(() => ({
    detectReact: vi.fn(),
    getFiberTree: vi.fn(),
    getComponentHooks: vi.fn(),
    getComponentProps: vi.fn(),
    getComponentState: vi.fn(),
    getReactPerformance: vi.fn(),
    findComponentsByName: vi.fn(),
    getContextValues: vi.fn(),
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

describe('ReactResourceProviderImpl', () => {
  let provider: ReactResourceProviderImpl

  beforeEach(() => {
    resetAllMocks()
    provider = new ReactResourceProviderImpl()
  })

  describe('listResources', () => {
    it('should return all React resource types when React is detected', async () => {
      // Mock React detection
      const mockReactProvider = (provider as any).reactProvider
      mockReactProvider.detectReact.mockResolvedValue({
        version: '18.0.0',
        devtools: true,
        mode: 'development',
        features: ['hooks', 'suspense']
      })

      const resources = await provider.listResources()
      
      expect(resources).toHaveLength(8)
      
      // Check core resources
      expect(resources[0]).toEqual({
        uri: 'react/fiber-tree',
        name: 'React Fiber Tree',
        mimeType: 'application/json',
        description: 'React component tree structure',
      })
      
      // Verify all resource types
      const uris = resources.map(r => r.uri)
      expect(uris).toContain('react/fiber-tree')
      expect(uris).toContain('react/components')
      expect(uris).toContain('react/hooks')
      expect(uris).toContain('react/props')
      expect(uris).toContain('react/state')
      expect(uris).toContain('react/context')
      expect(uris).toContain('react/performance')
      expect(uris).toContain('react/profiler')
    })

    it('should return empty array when React is not detected', async () => {
      // Mock no React
      const mockReactProvider = (provider as any).reactProvider
      mockReactProvider.detectReact.mockResolvedValue(null)

      const resources = await provider.listResources()
      
      expect(resources).toEqual([])
    })
  })

  describe('readResource', () => {

    describe('fiber tree', () => {
      it('should return React fiber tree', async () => {
        const mockFiberTree = {
          root: {
            type: 'HostRoot',
            children: [
              {
                type: 'App',
                props: { name: 'TestApp' },
                children: [],
              },
            ],
          },
        }
        
        const mockReactProvider = (provider as any).reactProvider
        mockReactProvider.getFiberTree.mockResolvedValue(mockFiberTree)

        const result = await provider.readResource('react/fiber-tree')
        
        expect(result).toEqual(mockFiberTree)
      })
    })

    describe('components', () => {
      it('should return React components list', async () => {
        const mockComponents = [
          {
            name: 'App',
            type: 'function',
            props: { title: 'Test' },
            hooks: ['useState', 'useEffect'],
          },
          {
            name: 'Header',
            type: 'class',
            props: { user: 'John' },
            state: { expanded: false },
          },
        ]
        
        const mockReactProvider = (provider as any).reactProvider
        mockReactProvider.getFiberTree.mockResolvedValue(mockComponents)

        const result = await provider.readResource('react/components')
        
        expect(result).toEqual(mockComponents)
      })

      it('should return components', async () => {
        const mockComponents = [
          { name: 'App', type: 'function' },
          { name: 'Header', type: 'function' },
        ]
        
        const mockReactProvider = (provider as any).reactProvider
        mockReactProvider.getFiberTree.mockResolvedValue(mockComponents)

        const result = await provider.readResource('react/components')
        
        expect(result).toEqual(mockComponents)
      })
    })

    describe('hooks', () => {
      it('should return hooks information', async () => {
        const result = await provider.readResource('react/hooks')
        
        expect(result).toEqual({
          description: 'Use react_inspect_hooks tool for specific components',
          hint: 'Hooks require component ID'
        })
      })
    })

    describe('profiler', () => {
      it('should return profiler data', async () => {
        const result = await provider.readResource('react/profiler')
        
        expect(result).toEqual({
          description: 'Use react_profile_renders tool for profiling',
          hint: 'Start profiling session first'
        })
      })
    })


    describe('context', () => {
      it('should return React context information', async () => {
        const result = await provider.readResource('react/context')
        
        expect(result).toEqual({
          description: 'React context detection in development',
          hint: 'Use React DevTools for context inspection'
        })
      })
    })

    describe('props', () => {
      it('should return props hint', async () => {
        const result = await provider.readResource('react/props')
        
        expect(result).toEqual({
          description: 'Use react_inspect_props tool for specific components',
          hint: 'Props require component ID'
        })
      })
    })

    describe('state', () => {
      it('should return state hint', async () => {
        const result = await provider.readResource('react/state')
        
        expect(result).toEqual({
          description: 'Use react_inspect_state tool for specific components',
          hint: 'State requires component ID'
        })
      })
    })

    describe('performance', () => {
      it('should return performance data', async () => {
        const mockPerformance = { renderTime: 16.5 }
        const mockReactProvider = (provider as any).reactProvider
        mockReactProvider.getReactPerformance.mockResolvedValue(mockPerformance)

        const result = await provider.readResource('react/performance')
        
        expect(result).toEqual(mockPerformance)
      })
    })

    it('should handle unknown resource URI', async () => {
      await expect(provider.readResource('react/unknown')).rejects.toThrow('Unknown React resource: react/unknown')
    })

    it('should handle errors gracefully', async () => {
      const mockReactProvider = (provider as any).reactProvider
      mockReactProvider.getReactPerformance.mockRejectedValue(new Error('CDP error'))

      await expect(provider.readResource('react/performance')).rejects.toThrow('CDP error')
    })
  })
})