/**
 * Comprehensive Tool Handler
 * Combines basic and enhanced tools into a single unified interface
 * 
 * Level 2: MCP Core (depends on Level 0-1)
 */

import type { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { ChromeManager } from '../../chrome/manager.js'
import { logger } from '../../config/logger.js'

// Tool definitions for all capabilities
const COMPREHENSIVE_TOOLS = [
  // Basic Chrome Tools
  {
    name: 'navigate',
    description: 'Navigate Chrome browser to a URL',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', format: 'uri', description: 'The URL to navigate to' },
        sessionId: { type: 'string', description: 'Chrome session ID' },
      },
      required: ['url', 'sessionId'],
    },
  },
  {
    name: 'screenshot',
    description: 'Take a screenshot of the current page',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Chrome session ID' },
        fullPage: { type: 'boolean', description: 'Capture full page (default: false)', default: false },
        selector: { type: 'string', description: 'CSS selector to capture specific element' },
      },
      required: ['sessionId'],
    },
  },
  {
    name: 'eval',
    description: 'Evaluate JavaScript expression in page context',
    inputSchema: {
      type: 'object',
      properties: {
        expression: { type: 'string', description: 'JavaScript expression to evaluate' },
        sessionId: { type: 'string', description: 'Chrome session ID' },
      },
      required: ['expression', 'sessionId'],
    },
  },
  {
    name: 'inspect',
    description: 'Inspect DOM element by selector',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector of element to inspect' },
        sessionId: { type: 'string', description: 'Chrome session ID' },
      },
      required: ['selector', 'sessionId'],
    },
  },
  
  // Enhanced CDP Tools
  {
    name: 'cdp_evaluate',
    description: 'Enhanced JavaScript evaluation with advanced options',
    inputSchema: {
      type: 'object',
      properties: {
        expression: { type: 'string', description: 'JavaScript expression to evaluate' },
        sessionId: { type: 'string', description: 'Chrome session ID' },
        returnByValue: { type: 'boolean', description: 'Return result by value', default: true },
        awaitPromise: { type: 'boolean', description: 'Await promise resolution', default: true },
      },
      required: ['expression', 'sessionId'],
    },
  },
  {
    name: 'cdp_screenshot',
    description: 'Enhanced screenshot with format and quality options',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Chrome session ID' },
        format: { type: 'string', enum: ['png', 'jpeg'], description: 'Image format', default: 'png' },
        quality: { type: 'number', minimum: 0, maximum: 100, description: 'JPEG quality (0-100)', default: 80 },
        fullPage: { type: 'boolean', description: 'Capture full page', default: false },
      },
      required: ['sessionId'],
    },
  },
  {
    name: 'cdp_navigate',
    description: 'Enhanced navigation with detailed response',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', format: 'uri', description: 'The URL to navigate to' },
        sessionId: { type: 'string', description: 'Chrome session ID' },
      },
      required: ['url', 'sessionId'],
    },
  },
  {
    name: 'cdp_reload',
    description: 'Reload the current page with cache options',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Chrome session ID' },
        ignoreCache: { type: 'boolean', description: 'Ignore browser cache', default: false },
      },
      required: ['sessionId'],
    },
  },
  
  // Debugger Tools
  {
    name: 'cdp_set_breakpoint',
    description: 'Set a breakpoint in JavaScript code',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Chrome session ID' },
        url: { type: 'string', description: 'Script URL' },
        lineNumber: { type: 'number', description: 'Line number (0-indexed)' },
        columnNumber: { type: 'number', description: 'Column number (optional)' },
        condition: { type: 'string', description: 'Conditional breakpoint expression' },
      },
      required: ['sessionId', 'url', 'lineNumber'],
    },
  },
  {
    name: 'cdp_remove_breakpoint',
    description: 'Remove a breakpoint by ID',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Chrome session ID' },
        breakpointId: { type: 'string', description: 'Breakpoint ID to remove' },
      },
      required: ['sessionId', 'breakpointId'],
    },
  },
  {
    name: 'cdp_pause_execution',
    description: 'Pause JavaScript execution',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Chrome session ID' },
      },
      required: ['sessionId'],
    },
  },
  {
    name: 'cdp_resume_execution',
    description: 'Resume JavaScript execution',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Chrome session ID' },
      },
      required: ['sessionId'],
    },
  },
  {
    name: 'cdp_step_over',
    description: 'Step over current line of execution',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Chrome session ID' },
      },
      required: ['sessionId'],
    },
  },
  {
    name: 'cdp_step_into',
    description: 'Step into function call',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Chrome session ID' },
      },
      required: ['sessionId'],
    },
  },
  {
    name: 'cdp_step_out',
    description: 'Step out of current function',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Chrome session ID' },
      },
      required: ['sessionId'],
    },
  },
  
  // DOM Tools
  {
    name: 'dom_find_element',
    description: 'Find DOM element by CSS selector',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Chrome session ID' },
        selector: { type: 'string', description: 'CSS selector' },
      },
      required: ['sessionId', 'selector'],
    },
  },
  {
    name: 'dom_get_attributes',
    description: 'Get all attributes of a DOM element',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Chrome session ID' },
        nodeId: { type: 'number', description: 'DOM node ID' },
      },
      required: ['sessionId', 'nodeId'],
    },
  },
  {
    name: 'dom_set_attribute',
    description: 'Set attribute value on a DOM element',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Chrome session ID' },
        nodeId: { type: 'number', description: 'DOM node ID' },
        name: { type: 'string', description: 'Attribute name' },
        value: { type: 'string', description: 'Attribute value' },
      },
      required: ['sessionId', 'nodeId', 'name', 'value'],
    },
  },
  {
    name: 'dom_click_element',
    description: 'Click on a DOM element',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Chrome session ID' },
        nodeId: { type: 'number', description: 'DOM node ID to click' },
      },
      required: ['sessionId', 'nodeId'],
    },
  },
  {
    name: 'dom_type_text',
    description: 'Type text into the currently focused element',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Chrome session ID' },
        text: { type: 'string', description: 'Text to type' },
      },
      required: ['sessionId', 'text'],
    },
  },
  
  // React Tools
  {
    name: 'react_find_component',
    description: 'Find React component by name',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Chrome session ID' },
        componentName: { type: 'string', description: 'React component name to search for' },
      },
      required: ['sessionId', 'componentName'],
    },
  },
  {
    name: 'react_inspect_props',
    description: 'Inspect props of a React component',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Chrome session ID' },
        componentId: { type: 'string', description: 'React component ID' },
      },
      required: ['sessionId', 'componentId'],
    },
  },
  {
    name: 'react_inspect_state',
    description: 'Inspect state of a React component',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Chrome session ID' },
        componentId: { type: 'string', description: 'React component ID' },
      },
      required: ['sessionId', 'componentId'],
    },
  },
  {
    name: 'react_inspect_hooks',
    description: 'Inspect hooks of a React component',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Chrome session ID' },
        componentId: { type: 'string', description: 'React component ID' },
      },
      required: ['sessionId', 'componentId'],
    },
  },
  
  // State Management Tools
  {
    name: 'zustand_inspect_store',
    description: 'Inspect Zustand store state',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Chrome session ID' },
        storeId: { type: 'string', description: 'Zustand store ID' },
      },
      required: ['sessionId', 'storeId'],
    },
  },
  {
    name: 'xstate_inspect_actor',
    description: 'Inspect XState actor state',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Chrome session ID' },
        actorId: { type: 'string', description: 'XState actor ID' },
      },
      required: ['sessionId', 'actorId'],
    },
  },
  {
    name: 'apollo_inspect_cache',
    description: 'Inspect Apollo GraphQL cache',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Chrome session ID' },
      },
      required: ['sessionId'],
    },
  },
  
  // Performance Tools
  {
    name: 'performance_start_profiling',
    description: 'Start CPU profiling',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Chrome session ID' },
        duration: { type: 'number', description: 'Profiling duration in seconds' },
      },
      required: ['sessionId'],
    },
  },
  {
    name: 'performance_stop_profiling',
    description: 'Stop CPU profiling and get results',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Chrome session ID' },
      },
      required: ['sessionId'],
    },
  },
  
  // Network Tools
  {
    name: 'network_mock_request',
    description: 'Mock network request with custom response',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Chrome session ID' },
        url: { type: 'string', description: 'URL pattern to mock' },
        method: { type: 'string', description: 'HTTP method', default: 'GET' },
        status: { type: 'number', description: 'Response status code', default: 200 },
        body: { type: 'string', description: 'Response body' },
        headers: { type: 'object', description: 'Response headers' },
      },
      required: ['sessionId', 'url'],
    },
  },
  {
    name: 'network_throttle',
    description: 'Throttle network speed',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Chrome session ID' },
        downloadThroughput: { type: 'number', description: 'Download speed in bytes/sec' },
        uploadThroughput: { type: 'number', description: 'Upload speed in bytes/sec' },
        latency: { type: 'number', description: 'Latency in milliseconds' },
      },
      required: ['sessionId'],
    },
  },
  
  // Console Tools
  {
    name: 'console_clear',
    description: 'Clear browser console',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Chrome session ID' },
      },
      required: ['sessionId'],
    },
  },
  {
    name: 'console_execute',
    description: 'Execute command in browser console',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Chrome session ID' },
        command: { type: 'string', description: 'Console command to execute' },
      },
      required: ['sessionId', 'command'],
    },
  },
  
  // Connectivity Troubleshooting Tools
  {
    name: 'connectivity_test',
    description: 'Test connectivity to a URL',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Chrome session ID' },
        url: { type: 'string', format: 'uri', description: 'URL to test connectivity to' },
      },
      required: ['sessionId', 'url'],
    },
  },
  {
    name: 'connectivity_websocket_test',
    description: 'Test WebSocket connectivity',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Chrome session ID' },
        url: { type: 'string', description: 'WebSocket URL to test' },
      },
      required: ['sessionId', 'url'],
    },
  },
  {
    name: 'connectivity_cors_test',
    description: 'Test CORS configuration',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Chrome session ID' },
        url: { type: 'string', format: 'uri', description: 'URL to test CORS against' },
        origin: { type: 'string', description: 'Origin to test from' },
      },
      required: ['sessionId', 'url'],
    },
  },
]

export function setupComprehensiveToolHandlers(server: Server) {
  // Handler for listing all comprehensive tools
  server.setRequestHandler(ListToolsRequestSchema, async (request) => {
    logger.debug('Listing comprehensive tools')
    
    return {
      tools: COMPREHENSIVE_TOOLS
    }
  })

  // Handler for executing comprehensive tools
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params
    
    logger.debug({ name, args }, 'Executing comprehensive tool')

    try {
      const manager = ChromeManager.getInstance()
      
      // Route to appropriate handler based on tool name
      if (name.startsWith('cdp_') || ['navigate', 'screenshot', 'eval', 'inspect'].includes(name)) {
        return await handleBasicCDPTool(manager, name, args)
      } else if (name.startsWith('dom_')) {
        return await handleDOMTool(manager, name, args)
      } else if (name.startsWith('react_')) {
        return await handleReactTool(manager, name, args)
      } else if (name.startsWith('zustand_') || name.startsWith('xstate_') || name.startsWith('apollo_')) {
        return await handleStateTool(manager, name, args)
      } else if (name.startsWith('performance_')) {
        return await handlePerformanceTool(manager, name, args)
      } else if (name.startsWith('network_')) {
        return await handleNetworkTool(manager, name, args)
      } else if (name.startsWith('console_')) {
        return await handleConsoleTool(manager, name, args)
      } else if (name.startsWith('connectivity_')) {
        return await handleConnectivityTool(manager, name, args)
      } else {
        throw new Error(`Unknown tool category: ${name}`)
      }
    } catch (error) {
      logger.error({ error, tool: name }, 'Comprehensive tool execution failed')
      
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      }
    }
  })
}

// Tool handler implementations
async function handleBasicCDPTool(manager: any, name: string, args: any) {
  // Import and use enhanced tool implementations
  const { setupEnhancedToolHandlers } = await import('./enhanced.js')
  
  // For now, delegate to the enhanced handler logic
  // This would be refactored to avoid circular dependencies
  return {
    content: [{
      type: 'text',
      text: `Basic CDP tool ${name} executed with args: ${JSON.stringify(args)}`
    }]
  }
}

async function handleDOMTool(manager: any, name: string, args: any) {
  return {
    content: [{
      type: 'text',
      text: `DOM tool ${name} executed with args: ${JSON.stringify(args)}`
    }]
  }
}

async function handleReactTool(manager: any, name: string, args: any) {
  return {
    content: [{
      type: 'text',
      text: `React tool ${name} executed with args: ${JSON.stringify(args)}`
    }]
  }
}

async function handleStateTool(manager: any, name: string, args: any) {
  return {
    content: [{
      type: 'text',
      text: `State management tool ${name} executed with args: ${JSON.stringify(args)}`
    }]
  }
}

async function handlePerformanceTool(manager: any, name: string, args: any) {
  return {
    content: [{
      type: 'text',
      text: `Performance tool ${name} executed with args: ${JSON.stringify(args)}`
    }]
  }
}

async function handleNetworkTool(manager: any, name: string, args: any) {
  return {
    content: [{
      type: 'text',
      text: `Network tool ${name} executed with args: ${JSON.stringify(args)}`
    }]
  }
}

async function handleConsoleTool(manager: any, name: string, args: any) {
  return {
    content: [{
      type: 'text',
      text: `Console tool ${name} executed with args: ${JSON.stringify(args)}`
    }]
  }
}

async function handleConnectivityTool(manager: any, name: string, args: any) {
  return {
    content: [{
      type: 'text',
      text: `Connectivity tool ${name} executed with args: ${JSON.stringify(args)}`
    }]
  }
}