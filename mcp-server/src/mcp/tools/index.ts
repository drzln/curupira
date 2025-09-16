/**
 * Tool Handler Setup - Manages all MCP tool registrations
 * Level 2: MCP Core (depends on Level 0-1)
 */

import type { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { getToolRegistry } from './registry.js'
import { logger } from '../../config/logger.js'

// Import all tool providers
import { CDPToolProvider } from './providers/cdp-tools.js'
import { DOMToolProvider } from './providers/dom-tools.js'
import { ReactToolProvider } from './providers/react-tools.js'
import { StateToolProvider } from './providers/state-tools.js'
import { PerformanceToolProvider } from './providers/performance-tools.js'
import { NetworkToolProvider } from './providers/network-tools.js'
import { DebuggerToolProvider } from './providers/debugger-tools.js'
import { ConsoleToolProvider } from './providers/console-tools.js'

export function setupUnifiedToolHandlers(server: Server) {
  const registry = getToolRegistry()
  
  // Register all tool providers
  registry.register(new CDPToolProvider())
  registry.register(new DOMToolProvider())
  registry.register(new ReactToolProvider())
  registry.register(new StateToolProvider())
  registry.register(new PerformanceToolProvider())
  registry.register(new NetworkToolProvider())
  registry.register(new DebuggerToolProvider())
  registry.register(new ConsoleToolProvider())
  
  logger.info(`Registered ${registry.getProviders().length} tool providers`)
  
  // Handler for listing all tools
  server.setRequestHandler(ListToolsRequestSchema, async (request) => {
    logger.debug('Listing all available tools')
    
    const tools = registry.listAllTools()
    logger.info(`Found ${tools.length} tools available`)
    
    return { tools }
  })
  
  // Handler for calling tools
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params
    
    logger.debug({ name, args }, 'Calling tool')
    
    try {
      const result = await registry.executeTool(name, args || {})
      
      if (!result.success) {
        logger.error({ tool: name, error: result.error }, 'Tool execution failed')
        
        return {
          content: [{
            type: 'text',
            text: `Error: ${result.error || 'Unknown error'}`
          }],
          isError: true
        }
      }
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result.data, null, 2)
        }]
      }
      
    } catch (error) {
      logger.error({ error, tool: name }, 'Tool execution failed')
      
      return {
        content: [{
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      }
    }
  })
}