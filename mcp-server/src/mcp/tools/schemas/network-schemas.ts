/**
 * Network Tool JSON Schemas - Level 2 (MCP Core)
 * JSON Schema definitions for network tools following MCP protocol requirements
 */

export const networkToolSchemas = {
  network_enable: {
    type: 'object',
    properties: {
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: []
  },

  network_disable: {
    type: 'object',
    properties: {
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: []
  },

  network_get_requests: {
    type: 'object',
    properties: {
      filter: { 
        type: 'string', 
        description: 'URL pattern to filter requests'
      },
      limit: { 
        type: 'number', 
        description: 'Maximum number of requests to return',
        default: 100
      },
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: []
  },

  network_mock_request: {
    type: 'object',
    properties: {
      url: { 
        type: 'string', 
        description: 'URL pattern to mock'
      },
      response: { 
        type: 'object', 
        description: 'Response data to return'
      },
      status: { 
        type: 'number', 
        description: 'HTTP status code',
        default: 200
      },
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: ['url', 'response']
  },

  network_clear_cache: {
    type: 'object',
    properties: {
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: []
  },

  network_clear_cookies: {
    type: 'object',
    properties: {
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: []
  },

  network_throttle: {
    type: 'object',
    properties: {
      downloadThroughput: { 
        type: 'number', 
        description: 'Download speed in bytes/sec (-1 for no limit)',
        default: -1
      },
      uploadThroughput: { 
        type: 'number', 
        description: 'Upload speed in bytes/sec (-1 for no limit)',
        default: -1
      },
      latency: { 
        type: 'number', 
        description: 'Additional latency in milliseconds',
        default: 0
      },
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: []
  },

  network_get_cookies: {
    type: 'object',
    properties: {
      urls: { 
        type: 'array',
        items: { type: 'string' },
        description: 'URLs to get cookies for'
      },
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: []
  }
};