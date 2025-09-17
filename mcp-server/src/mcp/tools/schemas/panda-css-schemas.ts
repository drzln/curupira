/**
 * Panda CSS Tool JSON Schemas - Level 2 (MCP Core)
 * JSON Schema definitions for Panda CSS debugging tools following MCP protocol requirements
 * Tailored for NovaSkyn's Panda CSS 1.1.x atomic CSS architecture
 */

export const pandaCSSToolSchemas = {
  panda_css_detect: {
    type: 'object',
    properties: {
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: []
  },

  panda_css_class_analysis: {
    type: 'object',
    properties: {
      selector: { 
        type: 'string', 
        description: 'CSS selector to analyze (default: all elements)'
      },
      includeStyles: { 
        type: 'boolean', 
        description: 'Include computed styles for elements',
        default: true
      },
      includeUtilities: { 
        type: 'boolean', 
        description: 'Include utility class analysis',
        default: true
      },
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: []
  },

  panda_css_token_inspect: {
    type: 'object',
    properties: {
      tokenType: { 
        type: 'string', 
        description: 'Filter by token type/category (e.g., color, spacing, font, border)'
      },
      tokenName: { 
        type: 'string', 
        description: 'Filter by specific token name pattern'
      },
      includeValues: { 
        type: 'boolean', 
        description: 'Include token values in output',
        default: true
      },
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: []
  },

  panda_css_recipe_inspect: {
    type: 'object',
    properties: {
      recipeName: { 
        type: 'string', 
        description: 'Specific recipe name to inspect (e.g., button, card, input)'
      },
      includeVariants: { 
        type: 'boolean', 
        description: 'Include recipe variants in analysis',
        default: true
      },
      includeSlots: { 
        type: 'boolean', 
        description: 'Include slot-based recipe analysis',
        default: true
      },
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: []
  },

  panda_css_performance_analyze: {
    type: 'object',
    properties: {
      includeUnused: { 
        type: 'boolean', 
        description: 'Analyze unused CSS rules (performance intensive)',
        default: false
      },
      analyzeBundleSize: { 
        type: 'boolean', 
        description: 'Analyze CSS bundle size and compression',
        default: true
      },
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: []
  },

  panda_css_theme_inspect: {
    type: 'object',
    properties: {
      themeScope: { 
        type: 'string', 
        enum: ['light', 'dark', 'auto', 'all'],
        description: 'Inspect specific theme scope',
        default: 'all'
      },
      includeCustomProperties: { 
        type: 'boolean', 
        description: 'Include CSS custom properties in theme analysis',
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