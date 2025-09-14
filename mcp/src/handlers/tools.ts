/**
 * @fileoverview Tool-related MCP handlers
 */

import type { McpRequestHandler, HandlerContext } from './types.js'
import type { ToolRegistry } from '../tools/types.js'

/**
 * Tool list handler
 */
export function createToolListHandler(
  registry: ToolRegistry
): McpRequestHandler<void, { tools: Array<{ name: string; description: string; inputSchema?: any }> }> {
  return async (params, context) => {
    const tools = registry.listTools()
    
    return {
      tools: tools.map(t => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema
      }))
    }
  }
}

/**
 * Tool call handler
 */
export function createToolCallHandler(
  registry: ToolRegistry
): McpRequestHandler<{ name: string; arguments?: any }, { content: Array<{ type: string; text?: string }> }> {
  return async (params, context) => {
    const result = await registry.execute(
      params.name,
      params.arguments || {},
      {
        sessionId: context.sessionId,
        metadata: context.metadata
      }
    )
    
    if (!result.success) {
      throw new Error(result.error || 'Tool execution failed')
    }
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result.data, null, 2)
      }]
    }
  }
}