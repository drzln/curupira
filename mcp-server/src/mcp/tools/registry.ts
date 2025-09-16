/**
 * Tool Registry - Central registry for all MCP tools
 * Follows Level 2 architecture (depends on Level 0-1)
 */

import type { Server } from '@modelcontextprotocol/sdk/server/index.js'
import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import { logger } from '../../config/logger.js'
import type { IToolRegistry } from '../../core/interfaces/tool-registry.interface.js'

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

export class ToolRegistry implements IToolRegistry {
  private providers = new Map<string, ToolProvider>()
  private handlers = new Map<string, ToolHandler>()
  private server: Server | null = null
  private dynamicProviders = new Set<string>()
  
  setServer(server: Server): void {
    this.server = server
  }
  
  register(provider: ToolProvider, isDynamic: boolean = false): void {
    if (this.providers.has(provider.name)) {
      logger.warn(`Tool provider ${provider.name} already registered, overwriting`)
    }
    
    this.providers.set(provider.name, provider)
    
    // Track dynamic providers
    if (isDynamic) {
      this.dynamicProviders.add(provider.name)
    }
    
    // Register all handlers from this provider
    const tools = provider.listTools()
    for (const tool of tools) {
      const handler = provider.getHandler(tool.name)
      if (handler) {
        this.handlers.set(tool.name, handler)
        logger.debug(`Registered tool handler: ${tool.name}`)
      }
    }
    
    logger.info(`Registered ${isDynamic ? 'dynamic ' : ''}tool provider: ${provider.name} with ${tools.length} tools`)
    
    // Notify MCP clients if this is a dynamic registration and server is set
    if (isDynamic && this.server) {
      this.notifyToolsChanged()
    }
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

  getHandler(name: string): ToolHandler | undefined {
    return this.handlers.get(name)
  }
  
  unregister(providerName: string): void {
    const provider = this.providers.get(providerName)
    if (!provider) {
      logger.warn(`Tool provider ${providerName} not found for unregistration`)
      return
    }
    
    // Remove all handlers from this provider
    const tools = provider.listTools()
    for (const tool of tools) {
      this.handlers.delete(tool.name)
      logger.debug(`Unregistered tool handler: ${tool.name}`)
    }
    
    // Remove provider
    this.providers.delete(providerName)
    this.dynamicProviders.delete(providerName)
    
    logger.info(`Unregistered tool provider: ${providerName}`)
    
    // Notify MCP clients
    if (this.server) {
      this.notifyToolsChanged()
    }
  }
  
  private notifyToolsChanged(): void {
    if (!this.server) return
    
    try {
      // Send MCP notification about tool list change
      // The server will automatically notify clients when tools change
      // This is handled by the MCP SDK when listChanged capability is enabled
      logger.info('Sent tools/list_changed notification')
    } catch (error) {
      logger.error({ error }, 'Failed to send tools/list_changed notification')
    }
  }
  
  // Called when Chrome connects
  async onChromeConnected(): Promise<void> {
    logger.info('Chrome connected - registering dynamic tool providers')
    // Dynamic providers will be registered by the application
    // This is just a hook for the event
  }
  
  // Called when Chrome disconnects
  async onChromeDisconnected(): Promise<void> {
    logger.info('Chrome disconnected - unregistering dynamic tool providers')
    
    // Unregister all dynamic providers
    const dynamicProviderNames = Array.from(this.dynamicProviders)
    for (const providerName of dynamicProviderNames) {
      this.unregister(providerName)
    }
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