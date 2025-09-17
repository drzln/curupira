/**
 * Zustand Store Tool JSON Schemas - Level 2 (MCP Core)
 * JSON Schema definitions for Zustand state management debugging tools following MCP protocol requirements
 * Tailored for NovaSkyn's Zustand 5.0.x architecture
 */

export const zustandToolSchemas = {
  zustand_detect: {
    type: 'object',
    properties: {
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: []
  },

  zustand_store_inspect: {
    type: 'object',
    properties: {
      storeId: { 
        type: 'string', 
        description: 'Specific store ID to inspect (e.g., useStore, appStore, userStore)'
      },
      includeActions: { 
        type: 'boolean', 
        description: 'Include store actions in output',
        default: true
      },
      includeComputed: { 
        type: 'boolean', 
        description: 'Include computed values in output',
        default: false
      },
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: []
  },

  zustand_subscription_track: {
    type: 'object',
    properties: {
      storeId: { 
        type: 'string', 
        description: 'Specific store ID to track subscriptions for'
      },
      trackSelectors: { 
        type: 'boolean', 
        description: 'Track selector function usage patterns',
        default: false
      },
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: []
  },

  zustand_action_dispatch: {
    type: 'object',
    properties: {
      storeId: { 
        type: 'string', 
        description: 'Store ID to dispatch action to'
      },
      actionName: { 
        type: 'string', 
        description: 'Name of the action function to call'
      },
      payload: { 
        description: 'Payload to pass to the action function (any type)'
      },
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: ['storeId', 'actionName']
  },

  zustand_persist_inspect: {
    type: 'object',
    properties: {
      storeId: { 
        type: 'string', 
        description: 'Specific store ID to inspect persistence for'
      },
      includeStorage: { 
        type: 'boolean', 
        description: 'Include localStorage/sessionStorage data',
        default: true
      },
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: []
  },

  zustand_middleware_inspect: {
    type: 'object',
    properties: {
      storeId: { 
        type: 'string', 
        description: 'Specific store ID to inspect middleware for'
      },
      middlewareType: { 
        type: 'string', 
        enum: ['persist', 'devtools', 'subscribeWithSelector', 'immer'],
        description: 'Filter by specific middleware type'
      },
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: []
  }
};