/**
 * Resource Registry - Central registry for all MCP resources
 * Follows Level 2 architecture (depends on Level 0-1)
 */

import type { Server } from '@modelcontextprotocol/sdk/server/index.js'
import type { Resource } from '@modelcontextprotocol/sdk/types.js'
import { logger } from '../../config/logger.js'

export interface ResourceProvider {
  name: string
  listResources(): Promise<Resource[]>
  readResource(uri: string): Promise<unknown>
}

export class ResourceRegistry {
  private providers = new Map<string, ResourceProvider>()
  
  register(provider: ResourceProvider): void {
    if (this.providers.has(provider.name)) {
      logger.warn(`Resource provider ${provider.name} already registered, overwriting`)
    }
    this.providers.set(provider.name, provider)
    logger.info(`Registered resource provider: ${provider.name}`)
  }
  
  async listAllResources(): Promise<Resource[]> {
    const resources: Resource[] = []
    
    for (const provider of this.providers.values()) {
      try {
        const providerResources = await provider.listResources()
        resources.push(...providerResources)
      } catch (error) {
        logger.error({ error, provider: provider.name }, 'Failed to list resources from provider')
      }
    }
    
    return resources
  }
  
  async readResource(uri: string): Promise<unknown> {
    // Extract provider name from URI (e.g., "cdp/runtime/console" -> "cdp")
    const [providerName] = uri.split('/')
    const provider = this.providers.get(providerName)
    
    if (!provider) {
      throw new Error(`No provider registered for URI: ${uri}`)
    }
    
    return provider.readResource(uri)
  }
  
  getProviders(): ResourceProvider[] {
    return Array.from(this.providers.values())
  }
}

// Singleton instance
let registry: ResourceRegistry | null = null

export function getResourceRegistry(): ResourceRegistry {
  if (!registry) {
    registry = new ResourceRegistry()
  }
  return registry
}