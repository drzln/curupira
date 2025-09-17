/**
 * Framer Motion Tool JSON Schemas - Level 2 (MCP Core)
 * JSON Schema definitions for Framer Motion animation debugging tools following MCP protocol requirements
 * Tailored for NovaSkyn's animation and interaction architecture
 */

export const framerMotionToolSchemas = {
  framer_motion_detect: {
    type: 'object',
    properties: {
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: []
  },

  framer_motion_animations_inspect: {
    type: 'object',
    properties: {
      selector: { 
        type: 'string', 
        description: 'CSS selector to filter animated elements'
      },
      includeValues: { 
        type: 'boolean', 
        description: 'Include motion values and computed timing',
        default: true
      },
      includeTimeline: { 
        type: 'boolean', 
        description: 'Include animation keyframes and timeline data',
        default: false
      },
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: []
  },

  framer_motion_gestures_inspect: {
    type: 'object',
    properties: {
      selector: { 
        type: 'string', 
        description: 'CSS selector to filter interactive elements'
      },
      includeHandlers: { 
        type: 'boolean', 
        description: 'Include React component gesture handlers',
        default: true
      },
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: []
  },

  framer_motion_performance_analyze: {
    type: 'object',
    properties: {
      duration: { 
        type: 'number', 
        description: 'Monitoring duration in milliseconds',
        default: 5000,
        minimum: 1000,
        maximum: 60000
      },
      includeFrameData: { 
        type: 'boolean', 
        description: 'Include detailed frame timing data',
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