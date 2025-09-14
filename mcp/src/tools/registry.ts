/**
 * @fileoverview Tool registry implementation
 */

import type {
  ToolHandler,
  ToolRegistry,
  ToolMetadata,
  ToolContext,
  ToolResult
} from './types.js'
import type { JsonValue } from '@curupira/shared'
import { createLogger, type Logger } from '@curupira/shared'

/**
 * Tool registry implementation
 */
export class ToolRegistryImpl implements ToolRegistry {
  private readonly tools = new Map<string, ToolHandler>()
  private readonly logger: Logger

  constructor() {
    this.logger = createLogger({ level: 'info' })
  }

  /**
   * Register tool
   */
  register(tool: ToolHandler): void {
    const name = tool.metadata.name
    
    if (this.tools.has(name)) {
      throw new Error(`Tool '${name}' already registered`)
    }

    this.tools.set(name, tool)
    this.logger.info({ tool: name }, 'Tool registered')
  }

  /**
   * Unregister tool
   */
  unregister(name: string): void {
    this.tools.delete(name)
    this.logger.info({ tool: name }, 'Tool unregistered')
  }

  /**
   * Get tool by name
   */
  getTool(name: string): ToolHandler | undefined {
    return this.tools.get(name)
  }

  /**
   * List all tools
   */
  listTools(): ToolMetadata[] {
    return Array.from(this.tools.values()).map(tool => tool.metadata)
  }

  /**
   * Execute tool
   */
  async execute(
    name: string,
    input: JsonValue,
    context: ToolContext
  ): Promise<ToolResult> {
    const tool = this.tools.get(name)
    
    if (!tool) {
      return {
        success: false,
        error: `Tool not found: ${name}`
      }
    }

    const startTime = Date.now()
    
    try {
      // Validate input if validator provided
      if (tool.validate && !tool.validate(input)) {
        return {
          success: false,
          error: 'Invalid input'
        }
      }

      // Execute tool
      const result = await tool.execute(input, context)
      
      // Add duration if not provided
      if (!result.duration) {
        result.duration = Date.now() - startTime
      }
      
      this.logger.info({ 
        tool: name, 
        duration: result.duration,
        success: result.success 
      }, 'Tool executed')
      
      return result
    } catch (error) {
      const duration = Date.now() - startTime
      
      this.logger.error({ error, tool: name }, 'Tool execution failed')
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration
      }
    }
  }

  /**
   * Get all tools
   */
  getAllTools(): ToolHandler[] {
    return Array.from(this.tools.values())
  }
}