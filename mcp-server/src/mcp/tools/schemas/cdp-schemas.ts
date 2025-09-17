/**
 * CDP Tool JSON Schemas - Level 2 (MCP Core)
 * JSON Schema definitions for Chrome DevTools Protocol tools
 */

export const cdpToolSchemas = {
  cdp_evaluate: {
    type: 'object',
    properties: {
      expression: { 
        type: 'string', 
        description: 'JavaScript expression to evaluate in the browser context'
      },
      awaitPromise: { 
        type: 'boolean', 
        description: 'Wait for promise resolution',
        default: true
      },
      returnByValue: { 
        type: 'boolean', 
        description: 'Return object as value instead of reference',
        default: true
      },
      userGesture: { 
        type: 'boolean', 
        description: 'Simulate user gesture',
        default: false
      },
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: ['expression']
  },

  cdp_navigate: {
    type: 'object',
    properties: {
      url: { 
        type: 'string', 
        description: 'URL to navigate to'
      },
      waitUntil: { 
        type: 'string', 
        description: 'Wait condition for navigation',
        enum: ['load', 'domcontentloaded', 'networkidle0', 'networkidle2'],
        default: 'load'
      },
      timeout: { 
        type: 'number', 
        description: 'Navigation timeout in milliseconds',
        default: 30000
      },
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: ['url']
  },

  cdp_screenshot: {
    type: 'object',
    properties: {
      format: { 
        type: 'string', 
        description: 'Image format',
        enum: ['png', 'jpeg', 'webp'],
        default: 'png'
      },
      quality: { 
        type: 'number', 
        description: 'Image quality (1-100, only for jpeg/webp)',
        minimum: 1,
        maximum: 100,
        default: 80
      },
      fullPage: { 
        type: 'boolean', 
        description: 'Capture full page',
        default: false
      },
      clip: { 
        type: 'object',
        description: 'Clip region',
        properties: {
          x: { type: 'number' },
          y: { type: 'number' },
          width: { type: 'number' },
          height: { type: 'number' }
        }
      },
      selector: { 
        type: 'string', 
        description: 'CSS selector of element to screenshot'
      },
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: []
  },

  cdp_set_cookie: {
    type: 'object',
    properties: {
      name: { 
        type: 'string', 
        description: 'Cookie name'
      },
      value: { 
        type: 'string', 
        description: 'Cookie value'
      },
      domain: { 
        type: 'string', 
        description: 'Cookie domain'
      },
      path: { 
        type: 'string', 
        description: 'Cookie path',
        default: '/'
      },
      secure: { 
        type: 'boolean', 
        description: 'Secure cookie',
        default: false
      },
      httpOnly: { 
        type: 'boolean', 
        description: 'HTTP only cookie',
        default: false
      },
      sameSite: { 
        type: 'string', 
        description: 'Same site policy',
        enum: ['Strict', 'Lax', 'None']
      },
      expires: { 
        type: 'number', 
        description: 'Cookie expiration timestamp'
      },
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: ['name', 'value']
  },

  cdp_get_cookies: {
    type: 'object',
    properties: {
      urls: { 
        type: 'array',
        items: { type: 'string' },
        description: 'Filter cookies by URLs'
      },
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: []
  },

  cdp_clear_cookies: {
    type: 'object',
    properties: {
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: []
  },

  cdp_reload: {
    type: 'object',
    properties: {
      ignoreCache: { 
        type: 'boolean', 
        description: 'Ignore cache when reloading',
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