/**
 * XState Tool JSON Schemas - Level 2 (MCP Core)
 * JSON Schema definitions for XState finite state machine debugging tools following MCP protocol requirements
 * Tailored for NovaSkyn's XState 5.20.x architecture
 */

export const xstateToolSchemas = {
  xstate_detect: {
    type: 'object',
    properties: {
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: []
  },

  xstate_machine_inspect: {
    type: 'object',
    properties: {
      machineId: { 
        type: 'string', 
        description: 'Specific machine ID to inspect (e.g., authMachine, userMachine)'
      },
      includeContext: { 
        type: 'boolean', 
        description: 'Include machine context schema in output',
        default: true
      },
      includeEvents: { 
        type: 'boolean', 
        description: 'Include machine event types in output',
        default: true
      },
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: []
  },

  xstate_actor_inspect: {
    type: 'object',
    properties: {
      actorId: { 
        type: 'string', 
        description: 'Specific actor ID to inspect (e.g., authActor, userService)'
      },
      includeChildren: { 
        type: 'boolean', 
        description: 'Include child actors in inspection',
        default: true
      },
      includeHistory: { 
        type: 'boolean', 
        description: 'Include state transition history',
        default: false
      },
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: []
  },

  xstate_send_event: {
    type: 'object',
    properties: {
      machineId: { 
        type: 'string', 
        description: 'Specific actor/machine ID to send event to'
      },
      event: { 
        type: 'string', 
        description: 'Event type to send (e.g., LOGIN, LOGOUT, FETCH_DATA)'
      },
      payload: { 
        description: 'Additional event payload data (any type)'
      },
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: ['event']
  },

  xstate_visualize_machine: {
    type: 'object',
    properties: {
      machineId: { 
        type: 'string', 
        description: 'Specific machine ID to visualize'
      },
      format: { 
        type: 'string', 
        enum: ['mermaid', 'dot', 'json'],
        description: 'Output format for visualization',
        default: 'mermaid'
      },
      includeActions: { 
        type: 'boolean', 
        description: 'Include actions in visualization',
        default: false
      },
      includeGuards: { 
        type: 'boolean', 
        description: 'Include guards/conditions in visualization',
        default: false
      },
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: []
  },

  xstate_context_update: {
    type: 'object',
    properties: {
      actorId: { 
        type: 'string', 
        description: 'Actor ID to update context for'
      },
      contextUpdates: { 
        type: 'object', 
        description: 'Context updates to apply'
      },
      merge: { 
        type: 'boolean', 
        description: 'Whether to merge or replace context',
        default: true
      },
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: ['contextUpdates']
  }
};