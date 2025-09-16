/**
 * Tests for React Resource Provider
 * Level 2: MCP Core tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ReactFrameworkProvider } from '../../../mcp/resources/providers/react-resources.js'
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

describe('ReactFrameworkProvider', () => {
  let provider: ReactFrameworkProvider

  beforeEach(() => {
    resetAllMocks()
    provider = new ReactFrameworkProvider()
  })

  describe('listResources', () => {
    it('should return all React resource types when React is detected', async () => {
      // Mock React detection
      mockChromeClient.send.mockResolvedValueOnce(
        createCDPResponse({
          result: {
            type: 'boolean',
            value: true, // React is present
          },
        })
      )

      const resources = await provider.listResources()
      
      expect(resources).toHaveLength(8)
      
      // Check core resources
      expect(resources[0]).toEqual({
        uri: 'react://version',
        name: 'React Version Info',
        mimeType: 'application/json',
        description: 'React library version and renderer information',
      })
      
      // Verify all resource types
      const uris = resources.map(r => r.uri)
      expect(uris).toContain('react://version')
      expect(uris).toContain('react://fiber-tree')
      expect(uris).toContain('react://components')
      expect(uris).toContain('react://hooks')
      expect(uris).toContain('react://profiler')
      expect(uris).toContain('react://errors')
      expect(uris).toContain('react://context')
      expect(uris).toContain('react://suspense')
    })

    it('should return empty array when React is not detected', async () => {
      // Mock no React
      mockChromeClient.send.mockResolvedValueOnce(
        createCDPResponse({
          result: {
            type: 'boolean',
            value: false,
          },
        })
      )

      const resources = await provider.listResources()
      
      expect(resources).toEqual([])
    })
  })

  describe('readResource', () => {
    describe('react version info', () => {
      it('should return React version information', async () => {
        const mockVersionInfo = {
          version: '18.2.0',
          renderer: 'ReactDOM',
          devToolsPresent: true,
        }
        
        mockChromeClient.send
          .mockResolvedValueOnce(undefined) // Runtime.enable
          .mockResolvedValueOnce(
            createCDPResponse({
              result: {
                type: 'object',
                value: mockVersionInfo,
              },
            })
          )

        const result = await provider.readResource('react://version')
        
        expect(mockChromeClient.send).toHaveBeenCalledWith('Runtime.enable', {}, testSessionId)
        expect(mockChromeClient.send).toHaveBeenCalledWith(
          'Runtime.evaluate',
          expect.objectContaining({
            expression: expect.stringContaining('React.version'),
          }),
          testSessionId
        )
        expect(result).toEqual(mockVersionInfo)
      })

      it('should handle missing React', async () => {
        mockChromeClient.send
          .mockResolvedValueOnce(undefined) // Runtime.enable
          .mockResolvedValueOnce(
            createCDPResponse({
              result: {
                type: 'object',
                value: { error: 'React not found' },
              },
            })
          )

        const result = await provider.readResource('react://version')
        
        expect(result).toEqual({ error: 'React not found' })
      })
    })

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
        
        mockChromeClient.send
          .mockResolvedValueOnce(undefined) // Runtime.enable
          .mockResolvedValueOnce(
            createCDPResponse({
              result: {
                type: 'object',
                value: mockFiberTree,
              },
            })
          )

        const result = await provider.readResource('react://fiber-tree')
        
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
        
        mockChromeClient.send
          .mockResolvedValueOnce(undefined) // Runtime.enable
          .mockResolvedValueOnce(
            createCDPResponse({
              result: {
                type: 'object',
                value: { components: mockComponents },
              },
            })
          )

        const result = await provider.readResource('react://components')
        
        expect(result).toEqual({ components: mockComponents })
      })

      it('should filter components by name', async () => {
        const mockComponents = [
          { name: 'App', type: 'function' },
        ]
        
        mockChromeClient.send
          .mockResolvedValueOnce(undefined) // Runtime.enable
          .mockResolvedValueOnce(
            createCDPResponse({
              result: {
                type: 'object',
                value: { components: mockComponents },
              },
            })
          )

        const result = await provider.readResource('react://components?name=App')
        
        expect(mockChromeClient.send).toHaveBeenCalledWith(
          'Runtime.evaluate',
          expect.objectContaining({
            expression: expect.stringContaining("name === 'App'"),
          }),
          testSessionId
        )
      })
    })

    describe('hooks', () => {
      it('should return hooks information', async () => {
        const mockHooks = {
          components: [
            {
              name: 'Counter',
              hooks: [
                { type: 'useState', value: 0 },
                { type: 'useEffect', deps: [] },
              ],
            },
          ],
        }
        
        mockChromeClient.send
          .mockResolvedValueOnce(undefined) // Runtime.enable
          .mockResolvedValueOnce(
            createCDPResponse({
              result: {
                type: 'object',
                value: mockHooks,
              },
            })
          )

        const result = await provider.readResource('react://hooks')
        
        expect(result).toEqual(mockHooks)
      })
    })

    describe('profiler', () => {
      it('should return profiler data', async () => {
        const mockProfilerData = {
          enabled: true,
          interactions: [
            {
              id: 1,
              name: 'button-click',
              timestamp: 123456,
            },
          ],
          measurements: [
            {
              componentName: 'App',
              renderTime: 16.5,
              count: 10,
            },
          ],
        }
        
        mockChromeClient.send
          .mockResolvedValueOnce(undefined) // Runtime.enable
          .mockResolvedValueOnce(
            createCDPResponse({
              result: {
                type: 'object',
                value: mockProfilerData,
              },
            })
          )

        const result = await provider.readResource('react://profiler')
        
        expect(result).toEqual(mockProfilerData)
      })
    })

    describe('errors', () => {
      it('should return React error boundaries info', async () => {
        const mockErrors = {
          errorBoundaries: [
            {
              componentName: 'ErrorBoundary',
              hasError: false,
              errorInfo: null,
            },
          ],
          recentErrors: [],
        }
        
        mockChromeClient.send
          .mockResolvedValueOnce(undefined) // Runtime.enable
          .mockResolvedValueOnce(
            createCDPResponse({
              result: {
                type: 'object',
                value: mockErrors,
              },
            })
          )

        const result = await provider.readResource('react://errors')
        
        expect(result).toEqual(mockErrors)
      })
    })

    describe('context', () => {
      it('should return React context information', async () => {
        const mockContext = {
          providers: [
            {
              name: 'ThemeContext',
              value: { theme: 'dark' },
              consumers: 5,
            },
          ],
        }
        
        mockChromeClient.send
          .mockResolvedValueOnce(undefined) // Runtime.enable
          .mockResolvedValueOnce(
            createCDPResponse({
              result: {
                type: 'object',
                value: mockContext,
              },
            })
          )

        const result = await provider.readResource('react://context')
        
        expect(result).toEqual(mockContext)
      })
    })

    describe('suspense', () => {
      it('should return Suspense boundary info', async () => {
        const mockSuspense = {
          boundaries: [
            {
              componentName: 'SuspenseBoundary',
              fallback: 'Loading...',
              suspended: false,
            },
          ],
        }
        
        mockChromeClient.send
          .mockResolvedValueOnce(undefined) // Runtime.enable
          .mockResolvedValueOnce(
            createCDPResponse({
              result: {
                type: 'object',
                value: mockSuspense,
              },
            })
          )

        const result = await provider.readResource('react://suspense')
        
        expect(result).toEqual(mockSuspense)
      })
    })

    it('should handle unknown resource URI', async () => {
      const result = await provider.readResource('react://unknown')
      
      expect(result).toEqual({
        error: 'Unknown React resource: react://unknown',
      })
    })

    it('should handle errors gracefully', async () => {
      mockChromeClient.send.mockRejectedValueOnce(new Error('CDP error'))

      const result = await provider.readResource('react://version')
      
      expect(result).toEqual({
        error: 'Failed to read React resource: CDP error',
      })
    })
  })
})