/**
 * Console Tool JSON Schemas - Level 2 (MCP Core)
 * JSON Schema definitions for console tools following MCP protocol requirements
 */

export const consoleToolSchemas = {
  console_clear: {
    type: 'object',
    properties: {
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: []
  },

  console_execute: {
    type: 'object',
    properties: {
      expression: { 
        type: 'string', 
        description: 'JavaScript expression to execute in console'
      },
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: ['expression']
  },

  console_get_messages: {
    type: 'object',
    properties: {
      level: { 
        type: 'string', 
        description: 'Filter by log level (log, info, warn, error)',
        enum: ['log', 'info', 'warn', 'error']
      },
      limit: { 
        type: 'number', 
        description: 'Maximum number of messages to return',
        default: 100
      },
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: []
  },

  console_monitor: {
    type: 'object',
    properties: {
      enable: { 
        type: 'boolean', 
        description: 'Enable or disable console monitoring',
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