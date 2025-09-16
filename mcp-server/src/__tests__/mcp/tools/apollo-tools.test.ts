/**
 * Tests for Apollo Tool Provider
 * Level 2: MCP Core tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ApolloToolProvider } from '../../../mcp/tools/providers/apollo-tools.js'
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

describe('ApolloToolProvider', () => {
  let provider: ApolloToolProvider

  beforeEach(() => {
    resetAllMocks()
    provider = new ApolloToolProvider()
  })

  describe('listTools', () => {
    it('should return all Apollo tools', () => {
      const tools = provider.listTools()
      
      expect(tools).toHaveLength(7)
      
      const toolNames = tools.map(t => t.name)
      expect(toolNames).toContain('apollo_inspect_cache')
      expect(toolNames).toContain('apollo_extract_cache')
      expect(toolNames).toContain('apollo_write_cache')
      expect(toolNames).toContain('apollo_evict_cache')
      expect(toolNames).toContain('apollo_list_active_queries')
      expect(toolNames).toContain('apollo_refetch_queries')
      expect(toolNames).toContain('apollo_get_client_state')
    })
  })

  describe('apollo_inspect_cache', () => {

    it('should inspect Apollo cache', async () => {
      const mockCache = {
        ROOT_QUERY: {
          'user({"id":"123"})': { __ref: 'User:123' },
          'posts({"limit":10})': {
            __typename: 'PostConnection',
            edges: [{ __ref: 'Post:1' }, { __ref: 'Post:2' }],
          },
        },
        'User:123': {
          __typename: 'User',
          id: '123',
          name: 'John Doe',
          email: 'john@example.com',
        },
        'Post:1': {
          __typename: 'Post',
          id: '1',
          title: 'First Post',
          author: { __ref: 'User:123' },
        },
      }
      
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPResponse({ result: { value: { available: true } } })) // Check available
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(
          createCDPResponse({
            result: {
              value: { cache: mockCache },
            },
          })
        )

      const handler = provider.getHandler('apollo_inspect_cache')!

      const result = await handler.execute({})

      expect(result).toEqual({
        success: true,
        data: { cache: mockCache },
      })
    })

    it('should handle Apollo not available', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPResponse({ result: { value: { available: false } } }))

      const handler = provider.getHandler('apollo_inspect_cache')!

      const result = await handler.execute({})

      expect(result).toEqual({
        success: false,
        error: 'Apollo Client not available in the page',
      })
    })
  })

  describe('apollo_extract_cache', () => {

    it('should extract cache data by query', async () => {
      const mockExtracted = {
        user: {
          id: '123',
          name: 'John Doe',
          email: 'john@example.com',
          __typename: 'User',
        },
      }
      
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPResponse({ result: { value: { available: true } } }))
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(
          createCDPResponse({
            result: {
              value: { data: mockExtracted },
            },
          })
        )

      const handler = provider.getHandler('apollo_extract_cache')!

      const result = await handler.execute({
        query: 'query GetUser($id: ID!) { user(id: $id) { id name email } }',
        variables: { id: '123' },
      })

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Runtime.evaluate',
        expect.objectContaining({
          expression: expect.stringContaining('GetUser'),
        }),
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: { data: mockExtracted },
      })
    })

    it('should handle query not found in cache', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPResponse({ result: { value: { available: true } } }))
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(
          createCDPResponse({
            result: {
              value: { error: 'Query not found in cache' },
            },
          })
        )

      const handler = provider.getHandler('apollo_extract_cache')!

      const result = await handler.execute({
        query: 'query NonExistent { nonExistent }',
      })

      expect(result).toEqual({
        success: false,
        error: 'Query not found in cache',
        data: { error: 'Query not found in cache' },
      })
    })
  })

  describe('apollo_write_cache', () => {

    it('should write data to cache', async () => {
      const dataToWrite = {
        user: {
          id: '456',
          name: 'Jane Smith',
          email: 'jane@example.com',
          __typename: 'User',
        },
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
                written: dataToWrite,
              },
            },
          })
        )

      const handler = provider.getHandler('apollo_write_cache')!

      const result = await handler.execute({
        query: 'query GetUser($id: ID!) { user(id: $id) { id name email } }',
        data: dataToWrite,
        variables: { id: '456' },
      })

      expect(result).toEqual({
        success: true,
        data: {
          success: true,
          written: dataToWrite,
        },
      })
    })
  })

  describe('apollo_evict_cache', () => {

    it('should evict cache by id', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPResponse({ result: { value: { available: true } } }))
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(
          createCDPResponse({
            result: {
              value: {
                evicted: true,
                id: 'User:123',
              },
            },
          })
        )

      const handler = provider.getHandler('apollo_evict_cache')!

      const result = await handler.execute({
        id: 'User:123',
      })

      expect(result).toEqual({
        success: true,
        data: {
          evicted: true,
          id: 'User:123',
        },
      })
    })

    it('should evict cache by field', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPResponse({ result: { value: { available: true } } }))
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(
          createCDPResponse({
            result: {
              value: {
                evicted: true,
                field: 'posts',
                args: { limit: 10 },
              },
            },
          })
        )

      const handler = provider.getHandler('apollo_evict_cache')!

      const result = await handler.execute({
        field: 'posts',
        args: { limit: 10 },
      })

      expect(result).toEqual({
        success: true,
        data: {
          evicted: true,
          field: 'posts',
          args: { limit: 10 },
        },
      })
    })
  })

  describe('apollo_list_active_queries', () => {

    it('should list active queries', async () => {
      const mockQueries = [
        {
          queryId: 'query-1',
          queryName: 'GetUser',
          variables: { id: '123' },
          loading: false,
          fetchPolicy: 'cache-first',
          observableQuery: true,
        },
        {
          queryId: 'query-2',
          queryName: 'GetPosts',
          variables: { limit: 10 },
          loading: true,
          fetchPolicy: 'network-only',
          observableQuery: true,
        },
      ]
      
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPResponse({ result: { value: { available: true } } }))
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(
          createCDPResponse({
            result: {
              value: { queries: mockQueries },
            },
          })
        )

      const handler = provider.getHandler('apollo_list_active_queries')!

      const result = await handler.execute({})

      expect(result).toEqual({
        success: true,
        data: { queries: mockQueries },
      })
    })
  })

  describe('apollo_refetch_queries', () => {

    it('should refetch specific queries', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPResponse({ result: { value: { available: true } } }))
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(
          createCDPResponse({
            result: {
              value: {
                refetched: ['GetUser', 'GetPosts'],
                count: 2,
              },
            },
          })
        )

      const handler = provider.getHandler('apollo_refetch_queries')!

      const result = await handler.execute({
        queries: ['GetUser', 'GetPosts'],
      })

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Runtime.evaluate',
        expect.objectContaining({
          expression: expect.stringContaining(JSON.stringify(['GetUser', 'GetPosts'])),
        }),
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: {
          refetched: ['GetUser', 'GetPosts'],
          count: 2,
        },
      })
    })

    it('should refetch all queries when none specified', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPResponse({ result: { value: { available: true } } }))
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(
          createCDPResponse({
            result: {
              value: {
                refetched: 'all',
                count: 5,
              },
            },
          })
        )

      const handler = provider.getHandler('apollo_refetch_queries')!

      const result = await handler.execute({})

      expect(result).toEqual({
        success: true,
        data: {
          refetched: 'all',
          count: 5,
        },
      })
    })
  })

  describe('apollo_get_client_state', () => {

    it('should get Apollo Client state', async () => {
      const mockState = {
        version: '3.7.0',
        defaultOptions: {
          watchQuery: { fetchPolicy: 'cache-first' },
          query: { fetchPolicy: 'network-only' },
        },
        cache: {
          optimistic: [],
          watches: 12,
          evictions: 0,
        },
        queries: {
          active: 3,
          stopped: 7,
        },
        mutations: {
          inFlight: 0,
        },
      }
      
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPResponse({ result: { value: { available: true } } }))
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(
          createCDPResponse({
            result: {
              value: mockState,
            },
          })
        )

      const handler = provider.getHandler('apollo_get_client_state')!

      const result = await handler.execute({})

      expect(result).toEqual({
        success: true,
        data: mockState,
      })
    })
  })

  describe('error handling', () => {

    it('should handle evaluation errors', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPResponse({ result: { value: { available: true } } }))
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPError('Cannot access __APOLLO_CLIENT__'))

      const result = await handler.execute({})

      expect(result).toEqual({
        success: false,
        error: 'Error inspecting cache: Cannot access __APOLLO_CLIENT__',
      })
    })

    it('should handle CDP errors', async () => {
      mockChromeClient.send.mockRejectedValueOnce(new Error('Connection timeout'))

      const result = await handler.execute({})

      expect(result).toEqual({
        success: false,
        error: 'Connection timeout',
      })
    })
  })
})