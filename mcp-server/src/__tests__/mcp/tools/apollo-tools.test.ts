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

// Mock BaseToolProvider with executeScript method
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
      try {
        const client = mockChromeClient
        
        await client.send('Runtime.enable', {}, sessionId)
        const result = await client.send('Runtime.evaluate', {
          expression: script,
          returnByValue: true,
          awaitPromise: true
        }, sessionId)
        
        if (result && result.exceptionDetails) {
          return {
            success: false,
            error: `Script execution error: ${result.exceptionDetails.text}`,
            data: result.exceptionDetails
          }
        }
        
        return {
          success: true,
          data: result && result.result ? result.result.value : result
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Script execution failed'
        }
      }
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
      
      expect(tools).toHaveLength(4) // Actual count from implementation
      
      const toolNames = tools.map(t => t.name)
      expect(toolNames).toContain('apollo_inspect_cache')
      expect(toolNames).toContain('apollo_refetch_query')
      expect(toolNames).toContain('apollo_clear_cache')
      expect(toolNames).toContain('apollo_write_cache')
    })
  })

  describe('apollo_inspect_cache', () => {

    it('should inspect entire Apollo cache', async () => {
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
        .mockResolvedValueOnce({
          result: {
            value: {
              cache: mockCache,
              cacheSize: Object.keys(mockCache).length,
              rootQuery: mockCache.ROOT_QUERY || {},
              rootMutation: {}
            }
          }
        })

      const handler = provider.getHandler('apollo_inspect_cache')!

      const result = await handler.execute({})

      expect(result).toEqual({
        success: true,
        data: {
          cache: mockCache,
          cacheSize: Object.keys(mockCache).length,
          rootQuery: mockCache.ROOT_QUERY || {},
          rootMutation: {}
        }
      })
    })

    it('should inspect specific query in cache', async () => {
      const mockQuery = 'query GetUser($id: ID!) { user(id: $id) { id name email } }'
      const mockData = {
        user: {
          id: '123',
          name: 'John Doe',
          email: 'john@example.com'
        }
      }
      
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce({
          result: {
            value: {
              query: mockQuery,
              data: mockData,
              cacheSize: 5
            }
          }
        })

      const handler = provider.getHandler('apollo_inspect_cache')!

      const result = await handler.execute({
        query: mockQuery
      })

      expect(result).toEqual({
        success: true,
        data: {
          query: mockQuery,
          data: mockData,
          cacheSize: 5
        }
      })
    })

    it('should handle query not found in cache', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce({
          result: {
            value: {
              error: 'Query not found in cache: Query not found',
              query: 'query NonExistent { nonExistent }',
              cacheSize: 5
            }
          }
        })

      const handler = provider.getHandler('apollo_inspect_cache')!

      const result = await handler.execute({
        query: 'query NonExistent { nonExistent }'
      })

      expect(result).toEqual({
        success: false,
        error: 'Query not found in cache: Query not found',
        data: {
          error: 'Query not found in cache: Query not found',
          query: 'query NonExistent { nonExistent }',
          cacheSize: 5
        }
      })
    })

    it('should handle Apollo Client not available', async () => {
      const mockProvider = new ApolloToolProvider()
      
      // Mock checkLibraryAvailable to return not available
      mockProvider['checkLibraryAvailable'] = vi.fn().mockResolvedValue({
        available: false,
        error: 'Apollo Client not available'
      })

      const handler = mockProvider.getHandler('apollo_inspect_cache')!

      const result = await handler.execute({})

      expect(result).toEqual({
        success: false,
        error: 'Apollo Client not available'
      })
    })
  })

  describe('apollo_refetch_query', () => {

    it('should refetch a query successfully', async () => {
      const mockQuery = 'query GetUser($id: ID!) { user(id: $id) { id name email } }'
      const mockVariables = { id: '123' }
      const mockData = {
        user: {
          id: '123',
          name: 'John Doe',
          email: 'john@example.com'
        }
      }
      
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce({
          result: {
            value: {
              success: true,
              data: mockData,
              loading: false,
              networkStatus: 7
            }
          }
        })

      const handler = provider.getHandler('apollo_refetch_query')!

      const result = await handler.execute({
        query: mockQuery,
        variables: mockVariables
      })

      expect(result).toEqual({
        success: true,
        data: {
          success: true,
          data: mockData,
          loading: false,
          networkStatus: 7
        }
      })
    })

    it('should handle query refetch errors', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce({
          result: {
            value: {
              error: 'Query failed: Network error',
              details: { networkError: 'Failed to fetch' }
            }
          }
        })

      const handler = provider.getHandler('apollo_refetch_query')!

      const result = await handler.execute({
        query: 'query FailingQuery { failing }'
      })

      expect(result).toEqual({
        success: false,
        error: 'Query failed: Network error',
        data: {
          error: 'Query failed: Network error',
          details: { networkError: 'Failed to fetch' }
        }
      })
    })

    it('should handle Apollo Client not found', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce({
          result: {
            value: {
              error: 'Apollo Client not found'
            }
          }
        })

      const handler = provider.getHandler('apollo_refetch_query')!

      const result = await handler.execute({
        query: 'query Test { test }'
      })

      expect(result).toEqual({
        success: false,
        error: 'Apollo Client not found',
        data: {
          error: 'Apollo Client not found'
        }
      })
    })
  })

  describe('apollo_clear_cache', () => {

    it('should clear Apollo cache successfully', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce({
          result: {
            value: {
              success: true,
              message: 'Apollo cache cleared successfully'
            }
          }
        })

      const handler = provider.getHandler('apollo_clear_cache')!

      const result = await handler.execute({})

      expect(result).toEqual({
        success: true,
        data: {
          success: true,
          message: 'Apollo cache cleared successfully'
        }
      })
    })

    it('should handle clear cache errors', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce({
          result: {
            value: {
              error: 'Apollo Client not found'
            }
          }
        })

      const handler = provider.getHandler('apollo_clear_cache')!

      const result = await handler.execute({})

      expect(result).toEqual({
        success: false,
        error: 'Apollo Client not found'
      })
    })
  })

  describe('apollo_write_cache', () => {

    it('should write data to cache successfully', async () => {
      const mockQuery = 'query GetUser($id: ID!) { user(id: $id) { id name email } }'
      const mockData = {
        user: {
          id: '456',
          name: 'Jane Smith',
          email: 'jane@example.com',
          __typename: 'User',
        },
      }
      const mockVariables = { id: '456' }
      
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce({
          result: {
            value: {
              success: true,
              message: 'Data written to cache successfully'
            }
          }
        })

      const handler = provider.getHandler('apollo_write_cache')!

      const result = await handler.execute({
        query: mockQuery,
        data: mockData,
        variables: mockVariables
      })

      expect(result).toEqual({
        success: true,
        data: {
          success: true,
          message: 'Data written to cache successfully'
        }
      })
    })

    it('should handle write cache errors', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce({
          result: {
            value: {
              error: 'Failed to write to cache: Invalid query'
            }
          }
        })

      const handler = provider.getHandler('apollo_write_cache')!

      const result = await handler.execute({
        query: 'invalid query',
        data: { test: 'data' }
      })

      expect(result).toEqual({
        success: false,
        error: 'Failed to write to cache: Invalid query'
      })
    })

    it('should handle Apollo Client not found', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce({
          result: {
            value: {
              error: 'Apollo Client not found'
            }
          }
        })

      const handler = provider.getHandler('apollo_write_cache')!

      const result = await handler.execute({
        query: 'query Test { test }',
        data: { test: 'data' }
      })

      expect(result).toEqual({
        success: false,
        error: 'Apollo Client not found'
      })
    })
  })

  describe('error handling', () => {

    it('should handle executeScript errors', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPError('Cannot access __APOLLO_CLIENT__'))

      const handler = provider.getHandler('apollo_inspect_cache')!

      const result = await handler.execute({})

      expect(result).toEqual({
        success: false,
        error: 'Script execution error: Cannot access __APOLLO_CLIENT__',
        data: expect.any(Object)
      })
    })

    it('should handle CDP connection errors', async () => {
      mockChromeClient.send.mockRejectedValueOnce(new Error('Connection timeout'))

      const handler = provider.getHandler('apollo_inspect_cache')!

      const result = await handler.execute({})

      expect(result).toEqual({
        success: false,
        error: 'Connection timeout',
      })
    })

    it('should handle refetch query errors', async () => {
      mockChromeClient.send.mockRejectedValueOnce(new Error('Network failure'))

      const handler = provider.getHandler('apollo_refetch_query')!

      const result = await handler.execute({
        query: 'query Test { test }'
      })

      expect(result).toEqual({
        success: false,
        error: 'Network failure',
      })
    })

    it('should handle clear cache errors', async () => {
      mockChromeClient.send.mockRejectedValueOnce(new Error('Clear operation failed'))

      const handler = provider.getHandler('apollo_clear_cache')!

      const result = await handler.execute({})

      expect(result).toEqual({
        success: false,
        error: 'Clear operation failed',
      })
    })

    it('should handle write cache errors', async () => {
      mockChromeClient.send.mockRejectedValueOnce(new Error('Write operation failed'))

      const handler = provider.getHandler('apollo_write_cache')!

      const result = await handler.execute({
        query: 'query Test { test }',
        data: { test: 'data' }
      })

      expect(result).toEqual({
        success: false,
        error: 'Write operation failed',
      })
    })
  })
})