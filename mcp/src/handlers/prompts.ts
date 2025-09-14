/**
 * @fileoverview Prompt-related MCP handlers
 */

import type { McpRequestHandler, HandlerContext } from './types.js'
import type { PromptRegistry } from '../prompts/types.js'

/**
 * Prompt list handler
 */
export function createPromptListHandler(
  registry: PromptRegistry
): McpRequestHandler<void, { prompts: Array<{ name: string; description: string; arguments?: any[] }> }> {
  return async (params, context) => {
    const prompts = registry.listPrompts()
    
    return {
      prompts: prompts.map(p => ({
        name: p.name,
        description: p.description,
        arguments: p.arguments
      }))
    }
  }
}

/**
 * Prompt get handler
 */
export function createPromptGetHandler(
  registry: PromptRegistry
): McpRequestHandler<{ name: string; arguments?: Record<string, any> }, { messages: Array<{ role: string; content: { type: string; text: string } }> }> {
  return async (params, context) => {
    const prompt = registry.getPrompt(params.name)
    
    if (!prompt) {
      throw new Error(`Prompt not found: ${params.name}`)
    }
    
    const rendered = prompt.render(params.arguments || {})
    
    return {
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: rendered
        }
      }]
    }
  }
}