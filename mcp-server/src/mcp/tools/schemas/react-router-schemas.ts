/**
 * React Router Tool JSON Schemas - Level 2 (MCP Core)
 * JSON Schema definitions for React Router debugging tools following MCP protocol requirements
 * Tailored for NovaSkyn's React Router navigation architecture
 */

export const reactRouterToolSchemas = {
  react_router_detect: {
    type: 'object',
    properties: {
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: []
  },

  react_router_current_route: {
    type: 'object',
    properties: {
      includeParams: { 
        type: 'boolean', 
        description: 'Include route parameters in output',
        default: true
      },
      includeQuery: { 
        type: 'boolean', 
        description: 'Include query parameters in output',
        default: true
      },
      includeState: { 
        type: 'boolean', 
        description: 'Include history state in output',
        default: true
      },
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: []
  },

  react_router_navigate: {
    type: 'object',
    properties: {
      to: { 
        type: 'string', 
        description: 'Target route path to navigate to'
      },
      replace: { 
        type: 'boolean', 
        description: 'Replace current history entry instead of pushing new one',
        default: false
      },
      state: { 
        description: 'State object to pass with navigation (any type)'
      },
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: ['to']
  },

  react_router_history_inspect: {
    type: 'object',
    properties: {
      includeEntries: { 
        type: 'boolean', 
        description: 'Include detailed history entries (limited by browser security)',
        default: false
      },
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: []
  }
};