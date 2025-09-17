/**
 * TanStack Query Tool Provider Factory - Level 2 (MCP Core)
 * Factory implementation for TanStack Query (React Query) debugging tools
 * Tailored for NovaSkyn's TanStack Query 5.87.x architecture
 */

import type { IToolProviderFactory, ProviderDependencies } from '../provider.factory.js';
import { BaseProviderFactory } from '../provider.factory.js';
import type { BaseToolProviderConfig } from '../base-tool-provider.js';
import { BaseToolProvider } from '../base-tool-provider.js';
import type { Schema } from '../../../core/interfaces/validator.interface.js';
import { withCDPCommand, withScriptExecution } from '../patterns/common-handlers.js';

// Schema definitions for TanStack Query tools
const queryDetectionSchema: Schema<{ sessionId?: string }> = {
  parse: (value) => {
    const obj = (value || {}) as any;
    return {
      sessionId: obj.sessionId
    };
  },
  safeParse: function(value) {
    try {
      const parsed = this.parse(value);
      return { success: true, data: parsed };
    } catch (error) {
      return { success: false, error };
    }
  }
};

const queryInspectSchema: Schema<{ 
  queryKey?: string[]; 
  status?: string; 
  includeData?: boolean; 
  sessionId?: string;
}> = {
  parse: (value) => {
    const obj = (value || {}) as any;
    return {
      queryKey: Array.isArray(obj.queryKey) ? obj.queryKey : undefined,
      status: obj.status,
      includeData: typeof obj.includeData === 'boolean' ? obj.includeData : true,
      sessionId: obj.sessionId
    };
  },
  safeParse: function(value) {
    try {
      const parsed = this.parse(value);
      return { success: true, data: parsed };
    } catch (error) {
      return { success: false, error };
    }
  }
};

const mutationInspectSchema: Schema<{ 
  mutationKey?: string; 
  status?: string; 
  includeVariables?: boolean;
  sessionId?: string;
}> = {
  parse: (value) => {
    const obj = (value || {}) as any;
    return {
      mutationKey: obj.mutationKey,
      status: obj.status,
      includeVariables: typeof obj.includeVariables === 'boolean' ? obj.includeVariables : true,
      sessionId: obj.sessionId
    };
  },
  safeParse: function(value) {
    try {
      const parsed = this.parse(value);
      return { success: true, data: parsed };
    } catch (error) {
      return { success: false, error };
    }
  }
};

const cacheInspectSchema: Schema<{ 
  queryKey?: string[]; 
  includeStale?: boolean; 
  includeInactive?: boolean;
  sessionId?: string;
}> = {
  parse: (value) => {
    const obj = (value || {}) as any;
    return {
      queryKey: Array.isArray(obj.queryKey) ? obj.queryKey : undefined,
      includeStale: typeof obj.includeStale === 'boolean' ? obj.includeStale : false,
      includeInactive: typeof obj.includeInactive === 'boolean' ? obj.includeInactive : false,
      sessionId: obj.sessionId
    };
  },
  safeParse: function(value) {
    try {
      const parsed = this.parse(value);
      return { success: true, data: parsed };
    } catch (error) {
      return { success: false, error };
    }
  }
};

class TanStackQueryToolProvider extends BaseToolProvider {
  protected initializeTools(): void {
    // Register tanstack_query_detect tool
    this.registerTool(
      this.createTool(
        'tanstack_query_detect',
        'Detect TanStack Query client instances and configuration',
        queryDetectionSchema,
        async (args, context) => {
          const detectionScript = `
            (function() {
              const queryInfo = {
                clients: [],
                devtools: false,
                version: null,
                globalClients: 0
              };
              
              // Check for TanStack Query DevTools
              if (window.__REACT_QUERY_DEVTOOLS__ || window.__TANSTACK_QUERY_DEVTOOLS__) {
                queryInfo.devtools = true;
              }
              
              // Method 1: Check for global QueryClient instances
              if (window.queryClient) {
                queryInfo.clients.push({
                  id: 'global-queryClient',
                  source: 'window.queryClient',
                  type: window.queryClient.constructor?.name || 'QueryClient'
                });
              }
              
              // Method 2: Check for React Query context
              if (window.React && window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
                try {
                  // Look for QueryClient in React component tree
                  queryInfo.reactDevtoolsDetected = true;
                  
                  // In a real implementation, we'd traverse the React tree
                  // to find QueryClient providers and their instances
                } catch (error) {
                  queryInfo.reactError = error.message;
                }
              }
              
              // Method 3: Check for common TanStack Query patterns
              const possibleClients = [
                window.queryClient,
                window.client,
                window.tanstackQueryClient,
                window.reactQueryClient
              ].filter(Boolean);
              
              possibleClients.forEach((client, index) => {
                if (client && typeof client === 'object') {
                  try {
                    const clientInfo = {
                      id: \`client-\${index}\`,
                      type: client.constructor?.name || 'Unknown',
                      queries: 0,
                      mutations: 0,
                      cache: null
                    };
                    
                    // Check for QueryCache
                    if (client.getQueryCache && typeof client.getQueryCache === 'function') {
                      const queryCache = client.getQueryCache();
                      clientInfo.queries = queryCache.getAll ? queryCache.getAll().length : 0;
                      clientInfo.cache = {
                        type: queryCache.constructor?.name || 'QueryCache',
                        size: clientInfo.queries
                      };
                    }
                    
                    // Check for MutationCache
                    if (client.getMutationCache && typeof client.getMutationCache === 'function') {
                      const mutationCache = client.getMutationCache();
                      clientInfo.mutations = mutationCache.getAll ? mutationCache.getAll().length : 0;
                    }
                    
                    // Check for default options
                    if (client.getDefaultOptions && typeof client.getDefaultOptions === 'function') {
                      const options = client.getDefaultOptions();
                      clientInfo.defaultOptions = {
                        queries: options.queries ? Object.keys(options.queries) : [],
                        mutations: options.mutations ? Object.keys(options.mutations) : []
                      };
                    }
                    
                    queryInfo.clients.push(clientInfo);
                  } catch (error) {
                    queryInfo.clients.push({
                      id: \`client-\${index}\`,
                      error: error.message
                    });
                  }
                }
              });
              
              // Method 4: Check for TanStack Query in module system
              if (window.__webpack_require__ || window.require) {
                try {
                  queryInfo.moduleSystemDetected = true;
                  // Could check for @tanstack/react-query module
                } catch (error) {
                  queryInfo.moduleError = error.message;
                }
              }
              
              // Method 5: Look for query-related storage
              try {
                const storageKeys = Object.keys(localStorage);
                const queryKeys = storageKeys.filter(key => 
                  key.includes('query') || 
                  key.includes('tanstack') ||
                  key.includes('react-query')
                );
                
                if (queryKeys.length > 0) {
                  queryInfo.persistedQueries = queryKeys.length;
                }
              } catch (error) {
                queryInfo.storageError = error.message;
              }
              
              queryInfo.globalClients = queryInfo.clients.length;
              
              return {
                ...queryInfo,
                timestamp: new Date().toISOString(),
                recommendation: queryInfo.clients.length === 0 ? 
                  'No TanStack Query clients detected. Ensure QueryClient is globally accessible or React DevTools are available.' :
                  \`Found \${queryInfo.clients.length} TanStack Query client(s)\`
              };
            })()
          `;

          const result = await withCDPCommand(
            'Runtime.evaluate',
            {
              expression: detectionScript,
              returnByValue: true,
              generatePreview: false
            },
            context
          );

          if (result.isErr()) {
            return {
              success: false,
              error: result.unwrapErr()
            };
          }

          const unwrapped = result.unwrap() as any;
          return {
            success: true,
            data: unwrapped.result?.value || { clients: [], devtools: false }
          };
        },
        {
          type: 'object',
          properties: {
            sessionId: { 
              type: 'string', 
              description: 'Optional Chrome session ID'
            }
          },
          required: []
        }
      )
    );

    // Register tanstack_query_inspect tool
    this.registerTool(
      this.createTool(
        'tanstack_query_inspect',
        'Inspect TanStack Query queries and their current state',
        queryInspectSchema,
        async (args, context) => {
          const queryInspectionScript = `
            (function() {
              const queryInfo = {
                queries: [],
                totalQueries: 0,
                queryCache: null
              };
              
              const targetQueryKey = ${JSON.stringify(args.queryKey || null)};
              const statusFilter = '${args.status || ''}';
              const includeData = ${args.includeData !== false};
              
              // Find QueryClient
              let queryClient = window.queryClient || window.client || window.tanstackQueryClient;
              
              if (!queryClient) {
                return { error: 'No TanStack Query client found' };
              }
              
              try {
                // Get QueryCache
                const queryCache = queryClient.getQueryCache();
                if (!queryCache) {
                  return { error: 'QueryCache not found in client' };
                }
                
                queryInfo.queryCache = {
                  type: queryCache.constructor?.name || 'QueryCache'
                };
                
                // Get all queries
                const allQueries = queryCache.getAll();
                queryInfo.totalQueries = allQueries.length;
                
                allQueries.forEach((query, index) => {
                  try {
                    const queryData = {
                      id: \`query-\${index}\`,
                      queryKey: query.queryKey,
                      queryHash: query.queryHash,
                      state: query.state?.status || 'unknown',
                      dataUpdatedAt: query.state?.dataUpdatedAt,
                      errorUpdatedAt: query.state?.errorUpdatedAt,
                      fetchStatus: query.state?.fetchStatus,
                      isStale: query.isStale ? query.isStale() : false,
                      isInactive: query.getObserversCount ? query.getObserversCount() === 0 : false,
                      observerCount: query.getObserversCount ? query.getObserversCount() : 0
                    };
                    
                    // Filter by query key if specified
                    if (targetQueryKey && 
                        JSON.stringify(query.queryKey) !== JSON.stringify(targetQueryKey)) {
                      return;
                    }
                    
                    // Filter by status if specified
                    if (statusFilter && queryData.state !== statusFilter) {
                      return;
                    }
                    
                    // Include data if requested
                    if (includeData && query.state) {
                      queryData.data = query.state.data;
                      queryData.error = query.state.error ? {
                        message: query.state.error.message,
                        name: query.state.error.name
                      } : null;
                    }
                    
                    // Include query function info
                    if (query.options) {
                      queryData.options = {
                        staleTime: query.options.staleTime,
                        cacheTime: query.options.cacheTime || query.options.gcTime,
                        refetchOnWindowFocus: query.options.refetchOnWindowFocus,
                        refetchOnReconnect: query.options.refetchOnReconnect,
                        retry: query.options.retry,
                        enabled: query.options.enabled
                      };
                    }
                    
                    queryInfo.queries.push(queryData);
                  } catch (error) {
                    queryInfo.queries.push({
                      id: \`query-\${index}\`,
                      error: error.message,
                      queryKey: query.queryKey || 'unknown'
                    });
                  }
                });
                
                // Sort queries by most recently updated
                queryInfo.queries.sort((a, b) => {
                  const aTime = a.dataUpdatedAt || a.errorUpdatedAt || 0;
                  const bTime = b.dataUpdatedAt || b.errorUpdatedAt || 0;
                  return bTime - aTime;
                });
                
              } catch (error) {
                return { error: \`Failed to inspect queries: \${error.message}\` };
              }
              
              return {
                ...queryInfo,
                summary: {
                  active: queryInfo.queries.filter(q => !q.isInactive).length,
                  stale: queryInfo.queries.filter(q => q.isStale).length,
                  loading: queryInfo.queries.filter(q => q.state === 'loading').length,
                  error: queryInfo.queries.filter(q => q.state === 'error').length,
                  success: queryInfo.queries.filter(q => q.state === 'success').length
                }
              };
            })()
          `;

          const result = await withScriptExecution(queryInspectionScript, context);

          if (result.isErr()) {
            return {
              success: false,
              error: result.unwrapErr()
            };
          }

          return {
            success: true,
            data: result.unwrap()
          };
        },
        {
          type: 'object',
          properties: {
            queryKey: { 
              type: 'array', 
              items: { type: 'string' },
              description: 'Specific query key to inspect'
            },
            status: { 
              type: 'string', 
              enum: ['loading', 'error', 'success', 'idle'],
              description: 'Filter queries by status'
            },
            includeData: { 
              type: 'boolean', 
              description: 'Include query data and errors in output',
              default: true
            },
            sessionId: { 
              type: 'string', 
              description: 'Optional Chrome session ID'
            }
          },
          required: []
        }
      )
    );

    // Register tanstack_mutation_inspect tool
    this.registerTool(
      this.createTool(
        'tanstack_mutation_inspect',
        'Inspect TanStack Query mutations and their current state',
        mutationInspectSchema,
        async (args, context) => {
          const mutationInspectionScript = `
            (function() {
              const mutationInfo = {
                mutations: [],
                totalMutations: 0,
                mutationCache: null
              };
              
              const mutationKeyFilter = '${args.mutationKey || ''}';
              const statusFilter = '${args.status || ''}';
              const includeVariables = ${args.includeVariables !== false};
              
              // Find QueryClient
              let queryClient = window.queryClient || window.client || window.tanstackQueryClient;
              
              if (!queryClient) {
                return { error: 'No TanStack Query client found' };
              }
              
              try {
                // Get MutationCache
                const mutationCache = queryClient.getMutationCache();
                if (!mutationCache) {
                  return { error: 'MutationCache not found in client' };
                }
                
                mutationInfo.mutationCache = {
                  type: mutationCache.constructor?.name || 'MutationCache'
                };
                
                // Get all mutations
                const allMutations = mutationCache.getAll();
                mutationInfo.totalMutations = allMutations.length;
                
                allMutations.forEach((mutation, index) => {
                  try {
                    const mutationData = {
                      id: \`mutation-\${index}\`,
                      mutationKey: mutation.options?.mutationKey,
                      mutationId: mutation.mutationId,
                      state: mutation.state?.status || 'idle',
                      submittedAt: mutation.state?.submittedAt,
                      isPaused: mutation.state?.isPaused || false,
                      context: mutation.state?.context,
                      failureCount: mutation.state?.failureCount || 0,
                      failureReason: mutation.state?.failureReason
                    };
                    
                    // Filter by mutation key if specified
                    if (mutationKeyFilter && 
                        (!mutationData.mutationKey || 
                         !mutationData.mutationKey.includes(mutationKeyFilter))) {
                      return;
                    }
                    
                    // Filter by status if specified
                    if (statusFilter && mutationData.state !== statusFilter) {
                      return;
                    }
                    
                    // Include variables if requested
                    if (includeVariables && mutation.state) {
                      mutationData.variables = mutation.state.variables;
                      mutationData.data = mutation.state.data;
                      mutationData.error = mutation.state.error ? {
                        message: mutation.state.error.message,
                        name: mutation.state.error.name
                      } : null;
                    }
                    
                    // Include mutation options
                    if (mutation.options) {
                      mutationData.options = {
                        retry: mutation.options.retry,
                        retryDelay: mutation.options.retryDelay,
                        onSuccess: !!mutation.options.onSuccess,
                        onError: !!mutation.options.onError,
                        onSettled: !!mutation.options.onSettled
                      };
                    }
                    
                    mutationInfo.mutations.push(mutationData);
                  } catch (error) {
                    mutationInfo.mutations.push({
                      id: \`mutation-\${index}\`,
                      error: error.message,
                      mutationKey: mutation.options?.mutationKey || 'unknown'
                    });
                  }
                });
                
                // Sort mutations by most recently submitted
                mutationInfo.mutations.sort((a, b) => {
                  const aTime = a.submittedAt || 0;
                  const bTime = b.submittedAt || 0;
                  return bTime - aTime;
                });
                
              } catch (error) {
                return { error: \`Failed to inspect mutations: \${error.message}\` };
              }
              
              return {
                ...mutationInfo,
                summary: {
                  idle: mutationInfo.mutations.filter(m => m.state === 'idle').length,
                  loading: mutationInfo.mutations.filter(m => m.state === 'loading').length,
                  error: mutationInfo.mutations.filter(m => m.state === 'error').length,
                  success: mutationInfo.mutations.filter(m => m.state === 'success').length,
                  paused: mutationInfo.mutations.filter(m => m.isPaused).length
                }
              };
            })()
          `;

          const result = await withScriptExecution(mutationInspectionScript, context);

          if (result.isErr()) {
            return {
              success: false,
              error: result.unwrapErr()
            };
          }

          return {
            success: true,
            data: result.unwrap()
          };
        },
        {
          type: 'object',
          properties: {
            mutationKey: { 
              type: 'string', 
              description: 'Filter mutations by key pattern'
            },
            status: { 
              type: 'string', 
              enum: ['idle', 'loading', 'error', 'success'],
              description: 'Filter mutations by status'
            },
            includeVariables: { 
              type: 'boolean', 
              description: 'Include mutation variables and data in output',
              default: true
            },
            sessionId: { 
              type: 'string', 
              description: 'Optional Chrome session ID'
            }
          },
          required: []
        }
      )
    );

    // Register tanstack_cache_inspect tool
    this.registerTool(
      this.createTool(
        'tanstack_cache_inspect',
        'Inspect TanStack Query cache state and storage',
        cacheInspectSchema,
        async (args, context) => {
          const cacheInspectionScript = `
            (function() {
              const cacheInfo = {
                queries: [],
                cache: null,
                storage: null,
                totalSize: 0
              };
              
              const targetQueryKey = ${JSON.stringify(args.queryKey || null)};
              const includeStale = ${args.includeStale === true};
              const includeInactive = ${args.includeInactive === true};
              
              // Find QueryClient
              let queryClient = window.queryClient || window.client || window.tanstackQueryClient;
              
              if (!queryClient) {
                return { error: 'No TanStack Query client found' };
              }
              
              try {
                // Get QueryCache
                const queryCache = queryClient.getQueryCache();
                if (!queryCache) {
                  return { error: 'QueryCache not found in client' };
                }
                
                cacheInfo.cache = {
                  type: queryCache.constructor?.name || 'QueryCache'
                };
                
                // Get all queries for cache analysis
                const allQueries = queryCache.getAll();
                
                allQueries.forEach((query, index) => {
                  try {
                    const isStale = query.isStale ? query.isStale() : false;
                    const isInactive = query.getObserversCount ? query.getObserversCount() === 0 : false;
                    
                    // Apply filters
                    if (!includeStale && isStale) return;
                    if (!includeInactive && isInactive) return;
                    
                    if (targetQueryKey && 
                        JSON.stringify(query.queryKey) !== JSON.stringify(targetQueryKey)) {
                      return;
                    }
                    
                    const queryData = {
                      queryKey: query.queryKey,
                      queryHash: query.queryHash,
                      isStale,
                      isInactive,
                      dataUpdatedAt: query.state?.dataUpdatedAt,
                      status: query.state?.status,
                      size: 0,
                      gcTime: query.options?.cacheTime || query.options?.gcTime
                    };
                    
                    // Calculate data size
                    if (query.state?.data) {
                      try {
                        queryData.size = JSON.stringify(query.state.data).length;
                        cacheInfo.totalSize += queryData.size;
                      } catch (error) {
                        queryData.sizeError = 'Cannot serialize data';
                      }
                    }
                    
                    // Include sample of data structure
                    if (query.state?.data && typeof query.state.data === 'object') {
                      queryData.dataStructure = {
                        type: Array.isArray(query.state.data) ? 'array' : 'object',
                        keys: Array.isArray(query.state.data) ? 
                          query.state.data.length : 
                          Object.keys(query.state.data).slice(0, 10)
                      };
                    }
                    
                    cacheInfo.queries.push(queryData);
                  } catch (error) {
                    cacheInfo.queries.push({
                      queryKey: query.queryKey || 'unknown',
                      error: error.message
                    });
                  }
                });
                
                // Check for persisted cache
                try {
                  const persistedKeys = Object.keys(localStorage).filter(key => 
                    key.includes('query') || key.includes('tanstack')
                  );
                  
                  if (persistedKeys.length > 0) {
                    cacheInfo.storage = {
                      type: 'localStorage',
                      keys: persistedKeys,
                      totalKeys: persistedKeys.length
                    };
                  }
                } catch (error) {
                  cacheInfo.storageError = error.message;
                }
                
                // Sort by data size (largest first)
                cacheInfo.queries.sort((a, b) => (b.size || 0) - (a.size || 0));
                
              } catch (error) {
                return { error: \`Failed to inspect cache: \${error.message}\` };
              }
              
              return {
                ...cacheInfo,
                summary: {
                  totalQueries: cacheInfo.queries.length,
                  staleQueries: cacheInfo.queries.filter(q => q.isStale).length,
                  inactiveQueries: cacheInfo.queries.filter(q => q.isInactive).length,
                  totalSizeMB: Math.round(cacheInfo.totalSize / 1024 / 1024 * 100) / 100,
                  averageSizeKB: cacheInfo.queries.length > 0 ? 
                    Math.round(cacheInfo.totalSize / cacheInfo.queries.length / 1024 * 100) / 100 : 0
                }
              };
            })()
          `;

          const result = await withScriptExecution(cacheInspectionScript, context);

          if (result.isErr()) {
            return {
              success: false,
              error: result.unwrapErr()
            };
          }

          return {
            success: true,
            data: result.unwrap()
          };
        },
        {
          type: 'object',
          properties: {
            queryKey: { 
              type: 'array', 
              items: { type: 'string' },
              description: 'Specific query key to inspect in cache'
            },
            includeStale: { 
              type: 'boolean', 
              description: 'Include stale queries in cache inspection',
              default: false
            },
            includeInactive: { 
              type: 'boolean', 
              description: 'Include inactive queries in cache inspection',
              default: false
            },
            sessionId: { 
              type: 'string', 
              description: 'Optional Chrome session ID'
            }
          },
          required: []
        }
      )
    );

    // Register tanstack_invalidate_query tool
    this.registerTool({
      name: 'tanstack_invalidate_query',
      description: 'Invalidate TanStack Query queries to trigger refetch',
      argsSchema: {
        parse: (value) => {
          if (typeof value !== 'object' || value === null) {
            throw new Error('Expected object');
          }
          const obj = value as any;
          if (!obj.queryKey && !obj.queryHash) {
            throw new Error('Either queryKey or queryHash must be provided');
          }
          return {
            queryKey: Array.isArray(obj.queryKey) ? obj.queryKey : undefined,
            queryHash: obj.queryHash,
            exact: typeof obj.exact === 'boolean' ? obj.exact : false,
            refetchType: obj.refetchType || 'active',
            sessionId: obj.sessionId
          };
        },
        safeParse: function(value) {
          try {
            const parsed = this.parse(value);
            return { success: true, data: parsed };
          } catch (error) {
            return { success: false, error };
          }
        }
      },
      jsonSchema: {
        type: 'object',
        properties: {
          queryKey: { 
            type: 'array', 
            items: { type: 'string' },
            description: 'Query key to invalidate'
          },
          queryHash: { 
            type: 'string', 
            description: 'Specific query hash to invalidate'
          },
          exact: { 
            type: 'boolean', 
            description: 'Whether to match query key exactly',
            default: false
          },
          refetchType: { 
            type: 'string', 
            enum: ['active', 'inactive', 'all', 'none'],
            description: 'Which queries to refetch after invalidation',
            default: 'active'
          },
          sessionId: { 
            type: 'string', 
            description: 'Optional Chrome session ID'
          }
        },
        required: []
      },
      handler: async (args, context) => {
        const invalidateScript = `
          (function() {
            const queryKey = ${JSON.stringify(args.queryKey || null)};
            const queryHash = '${args.queryHash || ''}';
            const exact = ${args.exact === true};
            const refetchType = '${args.refetchType || 'active'}';
            
            // Find QueryClient
            let queryClient = window.queryClient || window.client || window.tanstackQueryClient;
            
            if (!queryClient) {
              return { error: 'No TanStack Query client found' };
            }
            
            try {
              let result = { invalidated: false, refetched: false };
              
              if (queryKey) {
                // Invalidate by query key
                const invalidateOptions = { exact, refetchType };
                queryClient.invalidateQueries(queryKey, invalidateOptions);
                result.invalidated = true;
                result.method = 'queryKey';
                result.queryKey = queryKey;
              } else if (queryHash) {
                // Find query by hash and invalidate
                const queryCache = queryClient.getQueryCache();
                const query = queryCache.get(queryHash);
                
                if (query) {
                  query.invalidate();
                  result.invalidated = true;
                  result.method = 'queryHash';
                  result.queryHash = queryHash;
                  result.queryKey = query.queryKey;
                } else {
                  return { error: \`Query with hash '\${queryHash}' not found\` };
                }
              }
              
              return {
                ...result,
                timestamp: new Date().toISOString(),
                success: true
              };
            } catch (error) {
              return { 
                error: \`Failed to invalidate query: \${error.message}\`,
                queryKey,
                queryHash
              };
            }
          })()
        `;

        const result = await withScriptExecution(invalidateScript, context);

        if (result.isErr()) {
          return {
            success: false,
            error: result.unwrapErr()
          };
        }

        return {
          success: true,
          data: result.unwrap()
        };
      }
    });
  }
}

export class TanStackQueryToolProviderFactory extends BaseProviderFactory<TanStackQueryToolProvider> {
  create(deps: ProviderDependencies): TanStackQueryToolProvider {
    const config: BaseToolProviderConfig = {
      name: 'tanstack-query',
      description: 'TanStack Query (React Query) debugging and inspection tools'
    };

    return new TanStackQueryToolProvider(
      deps.chromeService,
      this.createProviderLogger(deps, config.name),
      deps.validator,
      config
    );
  }
}