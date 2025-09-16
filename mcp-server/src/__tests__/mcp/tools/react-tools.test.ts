/**
 * Tests for React Tool Provider
 * Level 2: MCP Core tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ReactToolProvider } from '../../../mcp/tools/providers/react-tools.js'
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
  }
}))

describe('ReactToolProvider', () => {
  let provider: ReactToolProvider

  beforeEach(() => {
    resetAllMocks()
    provider = new ReactToolProvider()
  })

  describe('listTools', () => {
    it('should return all React tools', () => {
      const tools = provider.listTools()
      
      expect(tools).toHaveLength(8)
      
      const toolNames = tools.map(t => t.name)
      expect(toolNames).toContain('react_find_component')
      expect(toolNames).toContain('react_inspect_props')
      expect(toolNames).toContain('react_inspect_state')
      expect(toolNames).toContain('react_inspect_hooks')
      expect(toolNames).toContain('react_trigger_re_render')
      expect(toolNames).toContain('react_profile_render')
      expect(toolNames).toContain('react_get_fiber_tree')
    })
  })

  describe('react_find_component', () => {

    it('should find React component by name', async () => {
      const mockComponents = [
        {
          id: 'comp-1',
          name: 'Button',
          props: { label: 'Click me' },
          type: 'function',
        },
        {
          id: 'comp-2',
          name: 'Button',
          props: { label: 'Submit' },
          type: 'function',
        },
      ]
      
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(
          createCDPResponse({
            result: {
              value: {
                found: true,
                components: mockComponents,
              },
            },
          })
        )

      const handler = provider.getHandler('react_find_component')!

      const result = await handler.execute({
        componentName: 'Button',
      })

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Runtime.evaluate',
        expect.objectContaining({
          expression: expect.stringContaining('name.includes'),
          awaitPromise: true,
        }),
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: {
          found: true,
          components: mockComponents,
        },
      })
    })

    it('should handle component not found', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(
          createCDPResponse({
            result: {
              value: {
                error: 'No components found with name: NonExistent',
              },
            },
          })
        )

      const handler = provider.getHandler('react_find_component')!

      const result = await handler.execute({
        componentName: 'NonExistent',
      })

      expect(result).toEqual({
        success: false,
        error: 'No components found with name: NonExistent',
        data: {
          error: 'No components found with name: NonExistent',
        },
      })
    })
  })

  describe('react_inspect_props', () => {

    it('should inspect component props', async () => {
      const mockProps = {
        componentId: 'comp-1',
        name: 'UserProfile',
        props: {
          user: { id: '123', name: 'John' },
          isEditing: false,
        },
      }
      
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(
          createCDPResponse({
            result: {
              value: mockProps,
            },
          })
        )

      const handler = provider.getHandler('react_inspect_props')!

      const result = await handler.execute({
        componentId: 'comp-1',
      })

      expect(result).toEqual({
        success: true,
        data: mockProps,
      })
    })

    it('should handle missing component', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(
          createCDPResponse({
            result: {
              value: {
                error: 'Component not found',
              },
            },
          })
        )

      const handler = provider.getHandler('react_inspect_props')!

      const result = await handler.execute({
        componentId: 'invalid-id',
      })

      expect(result).toEqual({
        success: false,
        error: 'Component not found',
        data: { error: 'Component not found' },
      })
    })
  })

  describe('react_inspect_state', () => {

    it('should inspect class component state', async () => {
      const mockState = {
        componentId: 'comp-1',
        name: 'TodoList',
        state: {
          todos: [
            { id: 1, text: 'Learn React', done: true },
            { id: 2, text: 'Build app', done: false },
          ],
          filter: 'all',
        },
      }
      
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(
          createCDPResponse({
            result: {
              value: mockState,
            },
          })
        )

      const handler = provider.getHandler('react_inspect_state')!

      const result = await handler.execute({
        componentId: 'comp-1',
      })

      expect(result).toEqual({
        success: true,
        data: mockState,
      })
    })

    it('should handle functional component (no state)', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(
          createCDPResponse({
            result: {
              value: {
                error: 'Component has no state (functional component)',
              },
            },
          })
        )

      const handler = provider.getHandler('react_inspect_state')!

      const result = await handler.execute({
        componentId: 'comp-1',
      })

      expect(result).toEqual({
        success: false,
        error: 'Component has no state (functional component)',
        data: { error: 'Component has no state (functional component)' },
      })
    })
  })

  describe('react_inspect_hooks', () => {

    it('should inspect component hooks', async () => {
      const mockHooks = {
        componentId: 'comp-1',
        name: 'Counter',
        hooks: [
          { type: 'useState', value: 0, index: 0 },
          { type: 'useEffect', deps: [], index: 1 },
          { type: 'useCallback', deps: [0], index: 2 },
        ],
      }
      
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(
          createCDPResponse({
            result: {
              value: mockHooks,
            },
          })
        )

      const handler = provider.getHandler('react_inspect_hooks')!

      const result = await handler.execute({
        componentId: 'comp-1',
      })

      expect(result).toEqual({
        success: true,
        data: mockHooks,
      })
    })
  })

  describe('react_trigger_re_render', () => {

    it('should trigger component re-render', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(
          createCDPResponse({
            result: {
              value: {
                success: true,
                componentId: 'comp-1',
                message: 'Component re-rendered',
              },
            },
          })
        )

      const handler = provider.getHandler('react_trigger_re_render')!

      const result = await handler.execute({
        componentId: 'comp-1',
      })

      expect(result).toEqual({
        success: true,
        data: {
          success: true,
          componentId: 'comp-1',
          message: 'Component re-rendered',
        },
      })
    })
  })

  describe('react_profile_render', () => {

    it('should profile component render performance', async () => {
      const mockProfile = {
        componentName: 'ExpensiveList',
        measurements: [
          { phase: 'mount', actualDuration: 45.5, baseDuration: 40.2 },
          { phase: 'update', actualDuration: 15.3, baseDuration: 12.1 },
        ],
        renderCount: 5,
        averageRenderTime: 20.4,
      }
      
      // Mock waiting for profiling
      await new Promise(resolve => setTimeout(resolve, 10))
      
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable (start)
        .mockResolvedValueOnce(createCDPResponse({ result: { value: { started: true } } }))
        .mockResolvedValueOnce(undefined) // Runtime.enable (stop)
        .mockResolvedValueOnce(
          createCDPResponse({
            result: {
              value: mockProfile,
            },
          })
        )

      const handler = provider.getHandler('react_profile_render')!

      const result = await handler.execute({
        duration: 100, // 100ms profiling
        componentName: 'ExpensiveList',
      })

      expect(result).toEqual({
        success: true,
        data: mockProfile,
      })
    })
  })

  describe('react_get_fiber_tree', () => {

    it('should get React fiber tree', async () => {
      const mockFiberTree = {
        root: {
          type: 'HostRoot',
          child: {
            type: 'App',
            elementType: 'App',
            props: { title: 'My App' },
            child: {
              type: 'Header',
              elementType: 'Header',
              props: {},
            },
            sibling: {
              type: 'Main',
              elementType: 'Main',
              props: {},
            },
          },
        },
      }
      
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(
          createCDPResponse({
            result: {
              value: mockFiberTree,
            },
          })
        )

      const handler = provider.getHandler('react_get_fiber_tree')!

      const result = await handler.execute({})

      expect(result).toEqual({
        success: true,
        data: mockFiberTree,
      })
    })

    it('should filter fiber tree by root selector', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(
          createCDPResponse({
            result: {
              value: { root: {} },
            },
          })
        )

      const handler = provider.getHandler('react_get_fiber_tree')!

      const result = await handler.execute({
        rootSelector: '#app',
      })

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Runtime.evaluate',
        expect.objectContaining({
          expression: expect.stringContaining('#app'),
        }),
        testSessionId
      )
      expect(result.success).toBe(true)
    })
  })

  describe('error handling', () => {

    it('should handle evaluation errors', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPError('React is not defined'))

      const handler = provider.getHandler('react_find_component')!
      const result = await handler.execute({
        componentName: 'Button',
      })

      expect(result).toEqual({
        success: false,
        error: 'Error finding component: React is not defined',
      })
    })

    it('should handle CDP errors', async () => {
      mockChromeClient.send.mockRejectedValueOnce(new Error('Connection lost'))

      const handler = provider.getHandler('react_find_component')!
      const result = await handler.execute({
        componentName: 'Button',
      })

      expect(result).toEqual({
        success: false,
        error: 'Connection lost',
      })
    })
  })
})