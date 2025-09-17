/**
 * WebSocket/GraphQL Subscription Tool JSON Schemas - Level 2 (MCP Core)
 * JSON Schema definitions for WebSocket and GraphQL subscription debugging tools following MCP protocol requirements
 * Tailored for NovaSkyn's real-time GraphQL architecture
 */

export const websocketGraphQLToolSchemas = {
  websocket_detect: {
    type: 'object',
    properties: {
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: []
  },

  websocket_inspect: {
    type: 'object',
    properties: {
      url: { 
        type: 'string', 
        description: 'Filter by WebSocket URL pattern'
      },
      includeMessages: { 
        type: 'boolean', 
        description: 'Include message history in output',
        default: true
      },
      messageLimit: { 
        type: 'number', 
        description: 'Maximum number of messages to include',
        default: 50,
        minimum: 1,
        maximum: 1000
      },
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: []
  },

  graphql_subscription_inspect: {
    type: 'object',
    properties: {
      subscriptionName: { 
        type: 'string', 
        description: 'Filter by subscription operation name'
      },
      includeData: { 
        type: 'boolean', 
        description: 'Include subscription data in output',
        default: true
      },
      includeErrors: { 
        type: 'boolean', 
        description: 'Include subscription errors in output',
        default: true
      },
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: []
  },

  websocket_send_message: {
    type: 'object',
    properties: {
      url: { 
        type: 'string', 
        description: 'Target WebSocket URL pattern'
      },
      message: { 
        description: 'Message to send (any type)'
      },
      messageType: { 
        type: 'string', 
        enum: ['text', 'json', 'binary'],
        description: 'Type of message to send',
        default: 'text'
      },
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: ['message']
  },

  realtime_connection_monitor: {
    type: 'object',
    properties: {
      duration: { 
        type: 'number', 
        description: 'Monitoring duration in milliseconds',
        default: 30000,
        minimum: 1000,
        maximum: 300000
      },
      includeMetrics: { 
        type: 'boolean', 
        description: 'Include performance metrics',
        default: true
      },
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: []
  },

  subscription_performance_analyze: {
    type: 'object',
    properties: {
      subscriptionName: { 
        type: 'string', 
        description: 'Specific subscription to analyze performance for'
      },
      includeLatency: { 
        type: 'boolean', 
        description: 'Include latency measurements',
        default: true
      },
      includeThroughput: { 
        type: 'boolean', 
        description: 'Include throughput analysis',
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