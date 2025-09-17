/**
 * Apollo Client Tool Provider Factory - Level 2 (MCP Core)
 * Factory implementation for Apollo Client GraphQL debugging tools
 * Tailored for NovaSkyn's Apollo Client 3.13.x architecture
 */

import type { IToolProviderFactory, ProviderDependencies } from '../provider.factory.js';
import { BaseProviderFactory } from '../provider.factory.js';
import type { BaseToolProviderConfig } from '../base-tool-provider.js';
import { BaseToolProvider } from '../base-tool-provider.js';
import type { Schema } from '../../../core/interfaces/validator.interface.js';
import { withCDPCommand, withScriptExecution } from '../patterns/common-handlers.js';

// Schema definitions for Apollo Client tools
const apolloDetectionSchema: Schema<{ sessionId?: string }> = {
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

const apolloCacheInspectSchema: Schema<{ 
  cacheId?: string; 
  typename?: string; 
  fields?: string[]; 
  sessionId?: string;
}> = {
  parse: (value) => {
    const obj = (value || {}) as any;
    return {
      cacheId: obj.cacheId,
      typename: obj.typename,
      fields: Array.isArray(obj.fields) ? obj.fields : undefined,
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

const apolloQueryInspectSchema: Schema<{ 
  queryName?: string; 
  includeVariables?: boolean; 
  includeCache?: boolean;
  sessionId?: string;
}> = {
  parse: (value) => {
    const obj = (value || {}) as any;
    return {
      queryName: obj.queryName,
      includeVariables: typeof obj.includeVariables === 'boolean' ? obj.includeVariables : true,
      includeCache: typeof obj.includeCache === 'boolean' ? obj.includeCache : true,
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

const apolloMutationTrackSchema: Schema<{ 
  mutationName?: string; 
  trackOptimistic?: boolean;
  sessionId?: string;
}> = {
  parse: (value) => {
    const obj = (value || {}) as any;
    return {
      mutationName: obj.mutationName,
      trackOptimistic: typeof obj.trackOptimistic === 'boolean' ? obj.trackOptimistic : false,
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

class ApolloToolProvider extends BaseToolProvider {
  protected initializeTools(): void {
    // Register apollo_detect tool
    this.registerTool(
      this.createTool(
        'apollo_detect',
        'Detect Apollo Client instances and get configuration details',
        apolloDetectionSchema,
        async (args, context) => {
          const detectionScript = `
            (function() {
              const apolloInfo = {
                clients: [],
                devtools: false,
                globalClients: 0
              };
              
              // Check for Apollo DevTools
              if (window.__APOLLO_DEVTOOLS_GLOBAL_HOOK__) {
                apolloInfo.devtools = true;
                const hook = window.__APOLLO_DEVTOOLS_GLOBAL_HOOK__;
                
                if (hook.getApolloClientInstances) {
                  const instances = hook.getApolloClientInstances();
                  apolloInfo.globalClients = instances.length;
                  
                  instances.forEach((client, index) => {
                    const clientInfo = {
                      id: index,
                      cache: {
                        type: client.cache.constructor.name,
                        size: Object.keys(client.cache.data.data || {}).length,
                        policies: !!client.cache.policies
                      },
                      link: {
                        type: client.link.constructor.name,
                        request: !!client.link.request
                      },
                      queryManager: {
                        queries: client.queryManager ? Object.keys(client.queryManager.queries || {}).length : 0,
                        mutationStore: client.queryManager ? Object.keys(client.queryManager.mutationStore || {}).length : 0
                      },
                      version: client.version || 'unknown'
                    };
                    apolloInfo.clients.push(clientInfo);
                  });
                }
              }
              
              // Fallback: Check for global Apollo Client references
              if (apolloInfo.clients.length === 0) {
                // Check for common Apollo Client patterns
                const possibleClients = [
                  window.apolloClient,
                  window.__APOLLO_CLIENT__,
                  window.client
                ].filter(Boolean);
                
                possibleClients.forEach((client, index) => {
                  if (client && client.cache && client.link) {
                    apolloInfo.clients.push({
                      id: \`fallback-\${index}\`,
                      cache: {
                        type: client.cache.constructor.name,
                        size: Object.keys(client.cache.data?.data || {}).length || 0
                      },
                      link: {
                        type: client.link.constructor.name
                      },
                      source: 'global-reference'
                    });
                  }
                });
              }
              
              // Check for Apollo in React component tree
              if (window.React && apolloInfo.clients.length === 0) {
                try {
                  const rootElement = document.querySelector('#root, [data-reactroot]');
                  if (rootElement) {
                    const fiberKey = Object.keys(rootElement).find(key => 
                      key.startsWith('__reactFiber') || 
                      key.startsWith('_reactInternalFiber') ||
                      key.startsWith('__reactContainer')
                    );
                    
                    if (fiberKey && rootElement[fiberKey]) {
                      apolloInfo.reactFiberDetected = true;
                      // Could traverse React tree to find Apollo Provider
                    }
                  }
                } catch (error) {
                  apolloInfo.reactError = error.message;
                }
              }
              
              return {
                ...apolloInfo,
                timestamp: new Date().toISOString(),
                recommendation: apolloInfo.clients.length === 0 ? 
                  'No Apollo Client detected. Ensure Apollo DevTools are installed or Apollo Client is accessible globally.' :
                  \`Found \${apolloInfo.clients.length} Apollo Client instance(s)\`
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

    // Register apollo_cache_inspect tool
    this.registerTool(
      this.createTool(
        'apollo_cache_inspect',
        'Inspect Apollo Client cache contents and structure',
        apolloCacheInspectSchema,
        async (args, context) => {
          const cacheInspectionScript = `
            (function() {
              const cacheInfo = {
                entries: [],
                totalSize: 0,
                normalized: false,
                policies: {}
              };
              
              // Get Apollo Client instance
              let apolloClient = null;
              
              if (window.__APOLLO_DEVTOOLS_GLOBAL_HOOK__) {
                const instances = window.__APOLLO_DEVTOOLS_GLOBAL_HOOK__.getApolloClientInstances();
                apolloClient = instances[0]; // Use first instance
              } else {
                apolloClient = window.apolloClient || window.__APOLLO_CLIENT__ || window.client;
              }
              
              if (!apolloClient || !apolloClient.cache) {
                return { error: 'No Apollo Client cache found' };
              }
              
              const cache = apolloClient.cache;
              const cacheData = cache.data?.data || cache.data || {};
              
              cacheInfo.totalSize = Object.keys(cacheData).length;
              cacheInfo.normalized = !!cache.data;
              
              // Filter by typename if specified
              const typename = '${args.typename || ''}';
              const fields = ${JSON.stringify(args.fields || [])};
              
              Object.entries(cacheData).forEach(([key, value]) => {
                if (typeof value === 'object' && value !== null) {
                  const entry = {
                    id: key,
                    typename: value.__typename || 'Unknown',
                    fields: Object.keys(value),
                    size: JSON.stringify(value).length
                  };
                  
                  // Apply filters
                  if (typename && entry.typename !== typename) {
                    return;
                  }
                  
                  if (fields.length > 0) {
                    const filteredValue = {};
                    fields.forEach(field => {
                      if (value[field] !== undefined) {
                        filteredValue[field] = value[field];
                      }
                    });
                    entry.data = filteredValue;
                  } else {
                    entry.data = value;
                  }
                  
                  cacheInfo.entries.push(entry);
                }
              });
              
              // Get cache policies if available
              if (cache.policies) {
                cacheInfo.policies = {
                  typePolicies: Object.keys(cache.policies.typePolicies || {}),
                  fieldPolicies: Object.keys(cache.policies.rootTypename || {})
                };
              }
              
              // Sort entries by typename and size
              cacheInfo.entries.sort((a, b) => {
                if (a.typename !== b.typename) {
                  return a.typename.localeCompare(b.typename);
                }
                return b.size - a.size;
              });
              
              return {
                ...cacheInfo,
                summary: {
                  totalTypes: [...new Set(cacheInfo.entries.map(e => e.typename))].length,
                  averageSize: cacheInfo.entries.reduce((sum, e) => sum + e.size, 0) / cacheInfo.entries.length || 0,
                  largestEntry: cacheInfo.entries[0]?.id || null
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
            cacheId: { 
              type: 'string', 
              description: 'Specific cache entry ID to inspect'
            },
            typename: { 
              type: 'string', 
              description: 'Filter by GraphQL typename'
            },
            fields: { 
              type: 'array', 
              items: { type: 'string' },
              description: 'Specific fields to include in output'
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

    // Register apollo_query_inspect tool
    this.registerTool(
      this.createTool(
        'apollo_query_inspect',
        'Inspect active Apollo queries, their status, and cached results',
        apolloQueryInspectSchema,
        async (args, context) => {
          const queryInspectionScript = `
            (function() {
              const queryInfo = {
                activeQueries: [],
                totalQueries: 0,
                queryManager: null
              };
              
              // Get Apollo Client instance
              let apolloClient = null;
              
              if (window.__APOLLO_DEVTOOLS_GLOBAL_HOOK__) {
                const instances = window.__APOLLO_DEVTOOLS_GLOBAL_HOOK__.getApolloClientInstances();
                apolloClient = instances[0];
              } else {
                apolloClient = window.apolloClient || window.__APOLLO_CLIENT__ || window.client;
              }
              
              if (!apolloClient) {
                return { error: 'No Apollo Client found' };
              }
              
              const queryManager = apolloClient.queryManager;
              if (!queryManager) {
                return { error: 'No QueryManager found' };
              }
              
              queryInfo.queryManager = {
                queries: Object.keys(queryManager.queries || {}).length,
                observableQueries: Object.keys(queryManager.observableQueries || {}).length,
                requestIdCounter: queryManager.requestIdCounter || 0
              };
              
              // Inspect active queries
              const queries = queryManager.queries || {};
              const observableQueries = queryManager.observableQueries || {};
              
              Object.entries(queries).forEach(([queryId, query]) => {
                const queryName = '${args.queryName || ''}';
                const includeVariables = ${args.includeVariables || true};
                const includeCache = ${args.includeCache || true};
                
                try {
                  const queryInfo = {
                    queryId,
                    state: query.networkStatus || 0,
                    loading: query.loading || false,
                    error: query.error ? query.error.message : null,
                    document: query.document,
                    operationName: null,
                    variables: null,
                    cachedResult: null
                  };
                  
                  // Extract operation name
                  if (query.document && query.document.definitions) {
                    const operation = query.document.definitions.find(def => 
                      def.kind === 'OperationDefinition'
                    );
                    if (operation && operation.name) {
                      queryInfo.operationName = operation.name.value;
                    }
                  }
                  
                  // Filter by query name if specified
                  if (queryName && queryInfo.operationName !== queryName) {
                    return;
                  }
                  
                  // Include variables if requested
                  if (includeVariables && query.variables) {
                    queryInfo.variables = query.variables;
                  }
                  
                  // Include cached result if requested
                  if (includeCache && apolloClient.cache) {
                    try {
                      const cachedResult = apolloClient.cache.readQuery({
                        query: query.document,
                        variables: query.variables
                      });
                      queryInfo.cachedResult = cachedResult;
                    } catch (e) {
                      queryInfo.cachedResult = { error: 'Not in cache or cache miss' };
                    }
                  }
                  
                  queryInfo.activeQueries.push(queryInfo);
                } catch (error) {
                  // Skip queries that can't be processed
                }
              });
              
              // Check observable queries for additional context
              Object.entries(observableQueries).forEach(([queryId, observableQuery]) => {
                const existing = queryInfo.activeQueries.find(q => q.queryId === queryId);
                if (existing && observableQuery) {
                  existing.subscribed = true;
                  existing.refetch = !!observableQuery.refetch;
                  existing.fetchMore = !!observableQuery.fetchMore;
                }
              });
              
              queryInfo.totalQueries = queryInfo.activeQueries.length;
              
              return {
                ...queryInfo,
                summary: {
                  loading: queryInfo.activeQueries.filter(q => q.loading).length,
                  errors: queryInfo.activeQueries.filter(q => q.error).length,
                  cached: queryInfo.activeQueries.filter(q => q.cachedResult && !q.cachedResult.error).length
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
            queryName: { 
              type: 'string', 
              description: 'Filter by specific query operation name'
            },
            includeVariables: { 
              type: 'boolean', 
              description: 'Include query variables in output',
              default: true
            },
            includeCache: { 
              type: 'boolean', 
              description: 'Include cached results for queries',
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

    // Register apollo_mutation_track tool
    this.registerTool(
      this.createTool(
        'apollo_mutation_track',
        'Track Apollo mutations and their optimistic updates',
        apolloMutationTrackSchema,
        async (args, context) => {
          const mutationTrackingScript = `
            (function() {
              const mutationInfo = {
                activeMutations: [],
                mutationQueue: [],
                optimisticUpdates: []
              };
              
              // Get Apollo Client instance
              let apolloClient = null;
              
              if (window.__APOLLO_DEVTOOLS_GLOBAL_HOOK__) {
                const instances = window.__APOLLO_DEVTOOLS_GLOBAL_HOOK__.getApolloClientInstances();
                apolloClient = instances[0];
              } else {
                apolloClient = window.apolloClient || window.__APOLLO_CLIENT__ || window.client;
              }
              
              if (!apolloClient) {
                return { error: 'No Apollo Client found' };
              }
              
              const queryManager = apolloClient.queryManager;
              if (!queryManager) {
                return { error: 'No QueryManager found' };
              }
              
              // Check mutation store
              const mutationStore = queryManager.mutationStore || {};
              const mutationName = '${args.mutationName || ''}';
              const trackOptimistic = ${args.trackOptimistic || false};
              
              Object.entries(mutationStore).forEach(([mutationId, mutation]) => {
                try {
                  const mutationInfo = {
                    mutationId,
                    loading: mutation.loading || false,
                    error: mutation.error ? mutation.error.message : null,
                    operationName: null,
                    variables: mutation.variables || null,
                    optimisticResponse: mutation.optimisticResponse || null
                  };
                  
                  // Extract mutation name
                  if (mutation.document && mutation.document.definitions) {
                    const operation = mutation.document.definitions.find(def => 
                      def.kind === 'OperationDefinition'
                    );
                    if (operation && operation.name) {
                      mutationInfo.operationName = operation.name.value;
                    }
                  }
                  
                  // Filter by mutation name if specified
                  if (mutationName && mutationInfo.operationName !== mutationName) {
                    return;
                  }
                  
                  mutationInfo.activeMutations.push(mutationInfo);
                } catch (error) {
                  // Skip mutations that can't be processed
                }
              });
              
              // Track optimistic updates if requested
              if (trackOptimistic && apolloClient.cache) {
                try {
                  // Check for optimistic data in cache
                  const cache = apolloClient.cache;
                  if (cache.data && cache.data.optimisticData) {
                    Object.entries(cache.data.optimisticData).forEach(([layer, data]) => {
                      mutationInfo.optimisticUpdates.push({
                        layer,
                        keys: Object.keys(data || {}),
                        size: Object.keys(data || {}).length
                      });
                    });
                  }
                } catch (error) {
                  mutationInfo.optimisticError = error.message;
                }
              }
              
              return {
                ...mutationInfo,
                summary: {
                  totalActive: mutationInfo.activeMutations.length,
                  loading: mutationInfo.activeMutations.filter(m => m.loading).length,
                  errors: mutationInfo.activeMutations.filter(m => m.error).length,
                  withOptimistic: mutationInfo.activeMutations.filter(m => m.optimisticResponse).length
                }
              };
            })()
          `;

          const result = await withScriptExecution(mutationTrackingScript, context);

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
            mutationName: { 
              type: 'string', 
              description: 'Filter by specific mutation operation name'
            },
            trackOptimistic: { 
              type: 'boolean', 
              description: 'Track optimistic updates in cache',
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

    // Register apollo_network_inspect tool
    this.registerTool({
      name: 'apollo_network_inspect',
      description: 'Monitor Apollo Client network requests and GraphQL operations',
      argsSchema: {
        parse: (value) => {
          const obj = (value || {}) as any;
          return {
            includeHeaders: typeof obj.includeHeaders === 'boolean' ? obj.includeHeaders : false,
            operationType: obj.operationType, // 'query', 'mutation', 'subscription'
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
          includeHeaders: { 
            type: 'boolean', 
            description: 'Include HTTP headers in network request details',
            default: false
          },
          operationType: { 
            type: 'string', 
            enum: ['query', 'mutation', 'subscription'],
            description: 'Filter by GraphQL operation type'
          },
          sessionId: { 
            type: 'string', 
            description: 'Optional Chrome session ID'
          }
        },
        required: []
      },
      handler: async (args, context) => {
        const networkInspectionScript = `
          (function() {
            const networkInfo = {
              apolloRequests: [],
              linkChain: null,
              interceptors: []
            };
            
            // Get Apollo Client instance
            let apolloClient = null;
            
            if (window.__APOLLO_DEVTOOLS_GLOBAL_HOOK__) {
              const instances = window.__APOLLO_DEVTOOLS_GLOBAL_HOOK__.getApolloClientInstances();
              apolloClient = instances[0];
            } else {
              apolloClient = window.apolloClient || window.__APOLLO_CLIENT__ || window.client;
            }
            
            if (!apolloClient) {
              return { error: 'No Apollo Client found' };
            }
            
            // Analyze Apollo Link chain
            if (apolloClient.link) {
              const analyzeLink = (link, depth = 0) => {
                if (!link) return null;
                
                const linkInfo = {
                  type: link.constructor.name,
                  depth,
                  hasRequest: !!link.request,
                  hasNext: !!link.left || !!link.right
                };
                
                // Check for specific link types
                if (link.constructor.name === 'HttpLink') {
                  linkInfo.uri = link.uri;
                  linkInfo.credentials = link.credentials;
                }
                
                if (link.constructor.name === 'ErrorLink') {
                  linkInfo.errorHandler = !!link.errorHandler;
                }
                
                if (link.constructor.name === 'RetryLink') {
                  linkInfo.retryConfig = !!link.config;
                }
                
                return linkInfo;
              };
              
              networkInfo.linkChain = analyzeLink(apolloClient.link);
            }
            
            // Monitor for network activity (simplified - would need real network monitoring)
            const includeHeaders = ${args.includeHeaders || false};
            const operationType = '${args.operationType || ''}';
            
            // Note: In a real implementation, we would hook into the Apollo Link chain
            // or monitor network requests to capture actual GraphQL operations
            networkInfo.note = 'Network monitoring requires active request interception. Consider using apollo_query_inspect for current query states.';
            
            return networkInfo;
          })()
        `;

        const result = await withScriptExecution(networkInspectionScript, context);

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

export class ApolloToolProviderFactory extends BaseProviderFactory<ApolloToolProvider> {
  create(deps: ProviderDependencies): ApolloToolProvider {
    const config: BaseToolProviderConfig = {
      name: 'apollo',
      description: 'Apollo Client GraphQL debugging and inspection tools'
    };

    return new ApolloToolProvider(
      deps.chromeService,
      this.createProviderLogger(deps, config.name),
      deps.validator,
      config
    );
  }
}