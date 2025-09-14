/**
 * @fileoverview Resource-related MCP handlers
 */

import type { McpRequestHandler, HandlerContext } from './types.js'
import type { ResourceRegistry } from '../resources/types.js'

/**
 * Resource list handler
 */
export function createResourceListHandler(
  registry: ResourceRegistry
): McpRequestHandler<void, { resources: Array<{ uri: string; name: string; description?: string }> }> {
  return async (params, context) => {
    const resources = await registry.listAll()
    
    return {
      resources: resources.map(r => ({
        uri: r.uri,
        name: r.name,
        description: r.description
      }))
    }
  }
}

/**
 * Resource read handler
 */
export function createResourceReadHandler(
  registry: ResourceRegistry
): McpRequestHandler<{ uri: string }, { contents: Array<{ uri: string; text?: string; blob?: string }> }> {
  return async (params, context) => {
    const content = await registry.read(params.uri)
    
    return {
      contents: [{
        uri: params.uri,
        text: typeof content.data === 'string' 
          ? content.data 
          : JSON.stringify(content.data, null, 2)
      }]
    }
  }
}

/**
 * Resource subscribe handler
 */
export function createResourceSubscribeHandler(
  registry: ResourceRegistry
): McpRequestHandler<{ uri: string }, void> {
  return async (params, context) => {
    // Subscribe to resource changes
    const handler = registry.getHandlerForUri(params.uri)
    
    if (handler?.subscribe) {
      const unsubscribe = handler.subscribe(params.uri, async (content) => {
        // Notify about resource change
        await context.protocol.notify('notifications/resources/updated', {
          uri: params.uri
        })
      })
      
      // Store unsubscribe function for cleanup
      // In real implementation, would track subscriptions
    }
  }
}

/**
 * Resource unsubscribe handler
 */
export function createResourceUnsubscribeHandler(
  registry: ResourceRegistry
): McpRequestHandler<{ uri: string }, void> {
  return async (params, context) => {
    // Unsubscribe from resource changes
    // In real implementation, would clean up subscription
  }
}