/**
 * Tool providers index
 * 
 * Main entry point for all MCP tool providers
 */

import type { RuntimeDomain } from '../chrome/domains/runtime.js'
import type { DOMDomain } from '../chrome/domains/dom.js'
import type { NetworkDomain } from '../chrome/domains/network.js'
import type { PageDomain } from '../chrome/domains/page.js'
import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import { DOMTool } from './dom-tool.js'
import { RuntimeTool } from './runtime-tool.js'
import { NetworkTool } from './network-tool.js'
import { PerformanceTool } from './performance-tool.js'
import { logger } from '../config/logger.js'

export interface ToolProviders {
  // List all available tools
  listTools(): Tool[]
  
  // Call a specific tool
  callTool(name: string, args: unknown): Promise<any>
  
  // Get tool by name
  getTool(name: string): Tool | undefined
}

export class ToolProvidersImpl implements ToolProviders {
  private dom: DOMTool
  private runtime: RuntimeTool
  private network: NetworkTool
  private performance: PerformanceTool
  private tools: Map<string, Tool> = new Map()

  constructor(
    runtime: RuntimeDomain,
    dom: DOMDomain,
    network: NetworkDomain,
    page: PageDomain
  ) {
    this.dom = new DOMTool(dom, runtime)
    this.runtime = new RuntimeTool(runtime)
    this.network = new NetworkTool(network)
    this.performance = new PerformanceTool(runtime, page)

    // Cache all tools
    this.cacheTools()
  }

  /**
   * Cache all tools for quick lookup
   */
  private cacheTools() {
    const allTools = [
      ...this.dom.listTools(),
      ...this.runtime.listTools(),
      ...this.network.listTools(),
      ...this.performance.listTools(),
    ]

    for (const tool of allTools) {
      this.tools.set(tool.name, tool)
    }

    logger.info({ count: this.tools.size }, 'Cached tools')
  }

  /**
   * List all available tools
   */
  listTools(): Tool[] {
    return Array.from(this.tools.values())
  }

  /**
   * Call a specific tool
   */
  async callTool(name: string, args: unknown): Promise<any> {
    try {
      // Determine which provider handles this tool
      const prefix = name.split('/')[0]

      switch (prefix) {
        case 'dom':
          return this.dom.callTool(name, args)
        
        case 'runtime':
          return this.runtime.callTool(name, args)
        
        case 'network':
          return this.network.callTool(name, args)
        
        case 'performance':
          return this.performance.callTool(name, args)
        
        default:
          throw new Error(`Unknown tool category: ${prefix}`)
      }
    } catch (error) {
      logger.error('Failed to call tool', { name, args, error })
      throw error
    }
  }

  /**
   * Get tool by name
   */
  getTool(name: string): Tool | undefined {
    return this.tools.get(name)
  }

  /**
   * Get tool categories
   */
  getCategories(): string[] {
    const categories = new Set<string>()
    
    for (const toolName of this.tools.keys()) {
      const category = toolName.split('/')[0]
      categories.add(category)
    }

    return Array.from(categories)
  }

  /**
   * Get tools by category
   */
  getToolsByCategory(category: string): Tool[] {
    return Array.from(this.tools.values()).filter(tool => 
      tool.name.startsWith(`${category}/`)
    )
  }

  /**
   * Validate tool arguments
   */
  validateToolArgs(name: string, args: unknown): { valid: boolean; errors?: string[] } {
    const tool = this.tools.get(name)
    if (!tool) {
      return { valid: false, errors: [`Tool not found: ${name}`] }
    }

    // Basic validation - can be extended with schema validation
    if (tool.inputSchema && args === undefined) {
      return { valid: false, errors: ['Tool requires arguments but none provided'] }
    }

    return { valid: true }
  }
}

// Factory function
export function createToolProviders(
  runtime: RuntimeDomain,
  dom: DOMDomain,
  network: NetworkDomain,
  page: PageDomain
): ToolProviders {
  return new ToolProvidersImpl(runtime, dom, network, page)
}

// Re-export individual tools
export {
  DOMTool,
  RuntimeTool,
  NetworkTool,
  PerformanceTool
}