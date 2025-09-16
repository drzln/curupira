/**
 * Apollo Tool Provider - Tools for debugging Apollo Client GraphQL cache
 * Level 2: MCP Core (depends on Level 0-1)
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { ToolProvider, ToolHandler, ToolResult } from '../registry.js'
import type { ApolloQueryArgs } from '../types.js'
import { BaseToolProvider } from './base.js'
import { validateAndCast, ArgSchemas } from '../validation.js'

export class ApolloToolProvider extends BaseToolProvider implements ToolProvider {
  name = 'apollo'
  
  listTools(): Tool[] {
    return [
      {
        name: 'apollo_inspect_cache',
        description: 'Inspect Apollo Client cache',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'GraphQL query to inspect (optional)' },
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          }
        }
      },
      {
        name: 'apollo_refetch_query',
        description: 'Refetch Apollo Client query',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'GraphQL query to refetch' },
            variables: { type: 'object', description: 'Query variables (optional)' },
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          },
          required: ['query']
        }
      },
      {
        name: 'apollo_clear_cache',
        description: 'Clear Apollo Client cache',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          }
        }
      },
      {
        name: 'apollo_write_cache',
        description: 'Write data directly to Apollo cache',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'GraphQL query' },
            data: { type: 'object', description: 'Data to write' },
            variables: { type: 'object', description: 'Query variables (optional)' },
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          },
          required: ['query', 'data']
        }
      }
    ]
  }
  
  getHandler(toolName: string): ToolHandler | undefined {
    const provider = this
    const handlers: Record<string, ToolHandler> = {
      apollo_inspect_cache: {
        name: 'apollo_inspect_cache',
        description: 'Inspect Apollo Client cache',
        async execute(args): Promise<ToolResult> {
          try {
            const { query, sessionId: argSessionId } = validateAndCast<ApolloQueryArgs>(
              args, ArgSchemas.apolloQuery, 'apollo_inspect_cache'
            )
            const sessionId = await provider.getSessionId(argSessionId)
            
            // First check if Apollo Client is available
            const check = await provider.checkLibraryAvailable(
              'window.__APOLLO_CLIENT__',
              sessionId,
              'Apollo Client'
            )
            
            if (!check.available) {
              return {
                success: false,
                error: check.error || 'Apollo Client not available'
              }
            }
            
            const script = query ? `
              (() => {
                const client = window.__APOLLO_CLIENT__
                
                try {
                  // Try to read specific query from cache
                  const result = client.readQuery({
                    query: ${JSON.stringify(query)}
                  })
                  
                  return {
                    query: ${JSON.stringify(query)},
                    data: result,
                    cacheSize: client.cache.data ? Object.keys(client.cache.data).length : 'unknown'
                  }
                } catch (error) {
                  // Query not in cache or error reading
                  return {
                    error: 'Query not found in cache: ' + error.message,
                    query: ${JSON.stringify(query)},
                    cacheSize: client.cache.data ? Object.keys(client.cache.data).length : 'unknown'
                  }
                }
              })()
            ` : `
              (() => {
                const client = window.__APOLLO_CLIENT__
                
                // Extract entire cache
                const cache = client.cache.extract()
                
                return {
                  cache,
                  cacheSize: Object.keys(cache).length,
                  rootQuery: cache.ROOT_QUERY || {},
                  rootMutation: cache.ROOT_MUTATION || {}
                }
              })()
            `
            
            const result = await provider.executeScript(script, sessionId)
            
            if (!result.success) {
              return result
            }
            
            const data = result.data as { error?: string }
            if (data?.error) {
              return {
                success: false,
                error: data.error,
                data
              }
            }
            
            return {
              success: true,
              data
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to inspect cache'
            }
          }
        }
      },
      
      apollo_refetch_query: {
        name: 'apollo_refetch_query',
        description: 'Refetch Apollo Client query',
        async execute(args): Promise<ToolResult> {
          try {
            const { query, variables, sessionId: argSessionId } = validateAndCast<ApolloQueryArgs>(
              args, ArgSchemas.apolloQuery, 'apollo_refetch_query'
            )
            const sessionId = await provider.getSessionId(argSessionId)
            
            const script = `
              (async () => {
                if (!window.__APOLLO_CLIENT__) {
                  return { error: 'Apollo Client not found' }
                }
                
                const client = window.__APOLLO_CLIENT__
                
                try {
                  const result = await client.query({
                    query: ${JSON.stringify(query)},
                    variables: ${JSON.stringify(variables || {})},
                    fetchPolicy: 'network-only'
                  })
                  
                  return {
                    success: true,
                    data: result.data,
                    loading: result.loading,
                    networkStatus: result.networkStatus
                  }
                } catch (error) {
                  return {
                    error: 'Query failed: ' + error.message,
                    details: error.graphQLErrors || error.networkError
                  }
                }
              })()
            `
            
            const result = await provider.executeScript(script, sessionId)
            
            if (!result.success) {
              return result
            }
            
            const data = result.data as { error?: string; success?: boolean }
            if (data?.error) {
              return {
                success: false,
                error: data.error,
                data
              }
            }
            
            return {
              success: true,
              data
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to refetch query'
            }
          }
        }
      },
      
      apollo_clear_cache: {
        name: 'apollo_clear_cache',
        description: 'Clear Apollo Client cache',
        async execute(args): Promise<ToolResult> {
          try {
            const { sessionId: argSessionId } = args as { sessionId?: string }
            const sessionId = await provider.getSessionId(argSessionId)
            
            const script = `
              (async () => {
                if (!window.__APOLLO_CLIENT__) {
                  return { error: 'Apollo Client not found' }
                }
                
                const client = window.__APOLLO_CLIENT__
                
                // Clear cache
                await client.clearStore()
                
                return {
                  success: true,
                  message: 'Apollo cache cleared successfully'
                }
              })()
            `
            
            const result = await provider.executeScript(script, sessionId)
            
            if (!result.success) {
              return result
            }
            
            const data = result.data as { error?: string; success?: boolean }
            if (data?.error) {
              return {
                success: false,
                error: data.error
              }
            }
            
            return {
              success: true,
              data
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to clear cache'
            }
          }
        }
      },
      
      apollo_write_cache: {
        name: 'apollo_write_cache',
        description: 'Write data to Apollo cache',
        async execute(args): Promise<ToolResult> {
          try {
            const args_validated = validateAndCast<ApolloQueryArgs & { data: unknown }>(
              args, 
              {
                ...ArgSchemas.apolloQuery,
                properties: {
                  ...ArgSchemas.apolloQuery.properties,
                  data: { type: 'object', description: 'Data to write to cache' }
                },
                required: ['query', 'data']
              }, 
              'apollo_write_cache'
            )
            const { query, data, variables, sessionId: argSessionId } = args_validated
            const sessionId = await provider.getSessionId(argSessionId)
            
            const script = `
              (() => {
                if (!window.__APOLLO_CLIENT__) {
                  return { error: 'Apollo Client not found' }
                }
                
                const client = window.__APOLLO_CLIENT__
                
                try {
                  client.writeQuery({
                    query: ${JSON.stringify(query)},
                    data: ${JSON.stringify(data)},
                    variables: ${JSON.stringify(variables || {})}
                  })
                  
                  return {
                    success: true,
                    message: 'Data written to cache successfully'
                  }
                } catch (error) {
                  return {
                    error: 'Failed to write to cache: ' + error.message
                  }
                }
              })()
            `
            
            const result = await provider.executeScript(script, sessionId)
            
            if (!result.success) {
              return result
            }
            
            const resultData = result.data as { error?: string; success?: boolean }
            if (resultData?.error) {
              return {
                success: false,
                error: resultData.error
              }
            }
            
            return {
              success: true,
              data: resultData
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to write cache'
            }
          }
        }
      }
    }
    
    const handler = handlers[toolName]
    if (!handler) return undefined
    
    return handler // ✅ FIXED: Proper binding
  }
}