/**
 * TanStack Query Tool JSON Schemas - Level 2 (MCP Core)
 * JSON Schema definitions for TanStack Query (React Query) debugging tools following MCP protocol requirements
 * Tailored for NovaSkyn's TanStack Query 5.87.x architecture
 */

export const tanstackQueryToolSchemas = {
  tanstack_query_detect: {
    type: 'object',
    properties: {
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: []
  },

  tanstack_query_inspect: {
    type: 'object',
    properties: {
      queryKey: { 
        type: 'array', 
        items: { type: 'string' },
        description: 'Specific query key to inspect (e.g., ["users"], ["user", "123"])'
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
  },

  tanstack_mutation_inspect: {
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
  },

  tanstack_cache_inspect: {
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
  },

  tanstack_invalidate_query: {
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

  tanstack_subscription_track: {
    type: 'object',
    properties: {
      queryKey: { 
        type: 'array', 
        items: { type: 'string' },
        description: 'Track subscriptions for specific query key'
      },
      includeObservers: { 
        type: 'boolean', 
        description: 'Include observer information',
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