/**
 * Vite Development Tool JSON Schemas - Level 2 (MCP Core)
 * JSON Schema definitions for Vite development debugging tools following MCP protocol requirements
 * Tailored for NovaSkyn's Vite build and development environment
 */

export const viteToolSchemas = {
  vite_detect: {
    type: 'object',
    properties: {
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: []
  },

  vite_hmr_inspect: {
    type: 'object',
    properties: {
      includeModules: { 
        type: 'boolean', 
        description: 'Include module information in HMR inspection',
        default: true
      },
      includeHistory: { 
        type: 'boolean', 
        description: 'Include HMR update history',
        default: false
      },
      moduleFilter: { 
        type: 'string', 
        description: 'Filter modules by URL pattern'
      },
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: []
  },

  vite_bundle_analyze: {
    type: 'object',
    properties: {
      analyzeSize: { 
        type: 'boolean', 
        description: 'Analyze module and asset sizes',
        default: true
      },
      analyzeImports: { 
        type: 'boolean', 
        description: 'Analyze import dependencies and relationships',
        default: true
      },
      includeAssets: { 
        type: 'boolean', 
        description: 'Include analysis of images, fonts, and other assets',
        default: false
      },
      sessionId: { 
        type: 'string', 
        description: 'Optional Chrome session ID'
      }
    },
    required: []
  },

  vite_dev_server_info: {
    type: 'object',
    properties: {
      includeConfig: { 
        type: 'boolean', 
        description: 'Include Vite configuration information',
        default: true
      },
      includePlugins: { 
        type: 'boolean', 
        description: 'Include detected Vite plugins',
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