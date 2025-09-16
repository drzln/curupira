/**
 * Tool Registry - Central registry for all MCP tools
 * Follows Level 2 architecture (depends on Level 0-1)
 */

import type { Server } from '@modelcontextprotocol/sdk/server/index.js'
import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import { logger } from '../../config/logger.js'

export interface ToolResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
  warnings?: string[]
}

export interface ToolHandler {
  name: string
  description: string
  inputSchema?: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
  execute(args: Record<string, unknown>): Promise<ToolResult>
}

export interface ToolProvider {
  name: string
  listTools(): Tool[]
  getHandler(toolName: string): ToolHandler | undefined
}

export class ToolRegistry {
  private providers = new Map<string, ToolProvider>()
  private handlers = new Map<string, ToolHandler>()
  
  register(provider: ToolProvider): void {
    if (this.providers.has(provider.name)) {
      logger.warn(`Tool provider ${provider.name} already registered, overwriting`)
    }
    
    this.providers.set(provider.name, provider)
    
    // Register all handlers from this provider
    const tools = provider.listTools()
    for (const tool of tools) {
      const handler = provider.getHandler(tool.name)
      if (handler) {
        this.handlers.set(tool.name, handler)
        logger.debug(`Registered tool handler: ${tool.name}`)
      }
    }
    
    logger.info(`Registered tool provider: ${provider.name} with ${tools.length} tools`)
  }
  
  listAllTools(): Tool[] {
    const tools: Tool[] = []
    
    for (const provider of this.providers.values()) {
      try {
        const providerTools = provider.listTools()
        tools.push(...providerTools)
      } catch (error) {
        logger.error({ error, provider: provider.name }, 'Failed to list tools from provider')
      }
    }
    
    return tools
  }
  
  async executeTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    const handler = this.handlers.get(name)
    
    if (!handler) {
      return {
        success: false,
        error: `Unknown tool: ${name}`
      }
    }
    
    try {
      return await handler.execute(args)
    } catch (error) {
      logger.error({ error, tool: name }, 'Tool execution failed')
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Tool execution failed'
      }
    }
  }
  
  getProviders(): ToolProvider[] {
    return Array.from(this.providers.values())
  }
}

// Singleton instance
let registry: ToolRegistry | null = null

export function getToolRegistry(): ToolRegistry {
  if (!registry) {
    registry = new ToolRegistry()
  }
  return registry
}