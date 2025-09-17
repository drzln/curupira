/**
 * Apollo Client Tool JSON Schemas - Level 2 (MCP Core)
 * JSON Schema definitions for Apollo Client debugging tools following MCP protocol requirements
 * Tailored for NovaSkyn's Apollo Client 3.13.x architecture
 */

export const apolloToolSchemas = {
  apollo_detect: {
    type: 'object',
    properties: {
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: []
  },

  apollo_cache_inspect: {
    type: 'object',
    properties: {
      cacheId: { 
        type: 'string', 
        description: 'Specific cache entry ID to inspect'
      },
      typename: { 
        type: 'string', 
        description: 'Filter by GraphQL typename (e.g., User, Product, Order)'
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
  },

  apollo_query_inspect: {
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
  },

  apollo_mutation_track: {
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
  },

  apollo_network_inspect: {
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

  apollo_subscription_monitor: {
    type: 'object',
    properties: {
      subscriptionName: { 
        type: 'string', 
        description: 'Filter by specific subscription operation name'
      },
      includeData: { 
        type: 'boolean', 
        description: 'Include subscription data in output',
        default: true
      },
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: []
  }
};