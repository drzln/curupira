/**
 * DOM Tool JSON Schemas - Level 2 (MCP Core)
 * JSON Schema definitions for DOM tools following MCP protocol requirements
 */

export const domToolSchemas = {
  dom_query_selector: {
    type: 'object',
    properties: {
      selector: { 
        type: 'string', 
        description: 'CSS selector to find elements'
      },
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: ['selector']
  },

  dom_click: {
    type: 'object',
    properties: {
      selector: { 
        type: 'string', 
        description: 'CSS selector of element to click'
      },
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: ['selector']
  },

  dom_set_value: {
    type: 'object',
    properties: {
      selector: { 
        type: 'string', 
        description: 'CSS selector of input element'
      },
      value: { 
        type: 'string', 
        description: 'Value to set'
      },
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: ['selector', 'value']
  },

  dom_get_text: {
    type: 'object',
    properties: {
      selector: { 
        type: 'string', 
        description: 'CSS selector of elements to get text from'
      },
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: ['selector']
  },

  dom_get_attributes: {
    type: 'object',
    properties: {
      selector: { 
        type: 'string', 
        description: 'CSS selector of elements to get attributes from'
      },
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: ['selector']
  },

  dom_wait_for_selector: {
    type: 'object',
    properties: {
      selector: { 
        type: 'string', 
        description: 'CSS selector to wait for'
      },
      timeout: { 
        type: 'number', 
        description: 'Timeout in milliseconds',
        default: 5000
      },
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: ['selector']
  }
};