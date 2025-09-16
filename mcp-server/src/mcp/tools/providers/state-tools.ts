/**
 * State Management Tool Provider - Composite provider for all state management tools
 * Level 2: MCP Core (depends on Level 0-1)
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { ToolProvider, ToolHandler } from '../registry.js'
import { ZustandToolProvider } from './zustand-tools.js'
import { XStateToolProvider } from './xstate-tools.js'
import { ApolloToolProvider } from './apollo-tools.js'
import { ReduxToolProvider } from './redux-tools.js'

/**
 * Composite provider that aggregates all state management tool providers
 */
export class StateToolProvider implements ToolProvider {
  name = 'state'
  
  private providers: ToolProvider[]
  
  constructor() {
    this.providers = [
      new ZustandToolProvider(),
      new XStateToolProvider(),
      new ApolloToolProvider(),
      new ReduxToolProvider()
    ]
  }
  
  listTools(): Tool[] {
    // Aggregate tools from all providers
    return this.providers.flatMap(provider => provider.listTools())
  }
  
  getHandler(toolName: string): ToolHandler | undefined {
    // Find the handler from the appropriate provider
    for (const provider of this.providers) {
      const handler = provider.getHandler(toolName)
      if (handler) {
        return handler
      }
    }
    return undefined
  }
}