/**
 * Resource providers index
 * 
 * Main entry point for all MCP resource providers
 */

import type { RuntimeDomain } from '../chrome/domains/runtime.js'
import type { DOMDomain } from '../chrome/domains/dom.js'
import type { NetworkDomain } from '../chrome/domains/network.js'
import type { PageDomain } from '../chrome/domains/page.js'
import type { FrameworkIntegrations } from '../integrations/index.js'
import type { Resource, ResourceTemplate } from '@modelcontextprotocol/sdk/types.js'
import { BrowserResourceProvider } from './browser-resource.js'
import { ReactResourceProvider } from './react-resource.js'
import { StateResourceProvider } from './state-resource.js'
import { NetworkResourceProvider } from './network-resource.js'
import { logger } from '../config/logger.js'

export interface ResourceProviders {
  // List all available resources
  listResources(): Promise<Resource[]>
  
  // Get all resource templates
  getResourceTemplates(): ResourceTemplate[]
  
  // Read a specific resource
  readResource(uri: string): Promise<{ content: string; mimeType: string }>
  
  // Get provider statistics
  getStatistics(): Promise<{
    totalResources: number
    byProvider: Record<string, number>
  }>
}

export class ResourceProvidersImpl implements ResourceProviders {
  private browser: BrowserResourceProvider
  private react: ReactResourceProvider
  private state: StateResourceProvider
  private network: NetworkResourceProvider

  constructor(
    runtime: RuntimeDomain,
    dom: DOMDomain,
    network: NetworkDomain,
    page: PageDomain,
    integrations: FrameworkIntegrations
  ) {
    this.browser = new BrowserResourceProvider(page, runtime)
    this.react = new ReactResourceProvider(integrations.react)
    this.state = new StateResourceProvider(integrations.xstate, integrations.zustand)
    this.network = new NetworkResourceProvider(network)
  }

  /**
   * List all available resources
   */
  async listResources(): Promise<Resource[]> {
    try {
      const [browserResources, reactResources, stateResources, networkResources] = 
        await Promise.all([
          this.browser.listResources(),
          this.react.listResources(),
          this.state.listResources(),
          this.network.listResources()
        ])

      return [
        ...browserResources,
        ...reactResources,
        ...stateResources,
        ...networkResources
      ]
    } catch (error) {
      logger.error('Failed to list resources', error)
      return []
    }
  }

  /**
   * Get all resource templates
   */
  getResourceTemplates(): ResourceTemplate[] {
    return [
      ...this.browser.getResourceTemplates(),
      ...this.react.getResourceTemplates(),
      ...this.state.getResourceTemplates(),
      ...this.network.getResourceTemplates()
    ]
  }

  /**
   * Read a specific resource
   */
  async readResource(uri: string): Promise<{ content: string; mimeType: string }> {
    try {
      const url = new URL(uri)
      const protocol = url.protocol.slice(0, -1) // Remove trailing :

      switch (protocol) {
        case 'browser':
          return this.browser.readResource(uri)
        
        case 'react':
          return this.react.readResource(uri)
        
        case 'xstate':
        case 'zustand':
          return this.state.readResource(uri)
        
        case 'network':
          return this.network.readResource(uri)
        
        default:
          throw new Error(`Unknown resource protocol: ${protocol}`)
      }
    } catch (error) {
      logger.error('Failed to read resource', { uri, error })
      
      // Return error as JSON
      return {
        content: JSON.stringify({
          error: {
            message: error instanceof Error ? error.message : 'Unknown error',
            uri
          }
        }, null, 2),
        mimeType: 'application/json'
      }
    }
  }

  /**
   * Get provider statistics
   */
  async getStatistics(): Promise<{
    totalResources: number
    byProvider: Record<string, number>
  }> {
    const resources = await this.listResources()
    
    const byProvider = resources.reduce((acc, resource) => {
      const protocol = new URL(resource.uri).protocol.slice(0, -1)
      acc[protocol] = (acc[protocol] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return {
      totalResources: resources.length,
      byProvider
    }
  }

  /**
   * Get resource by URI pattern
   */
  async findResources(pattern: string): Promise<Resource[]> {
    const allResources = await this.listResources()
    const regex = new RegExp(pattern, 'i')
    
    return allResources.filter(resource => 
      regex.test(resource.uri) || 
      regex.test(resource.name) ||
      regex.test(resource.description || '')
    )
  }

  /**
   * Get resource metadata
   */
  async getResourceMetadata(uri: string): Promise<{
    exists: boolean
    size?: number
    lastModified?: number
    provider?: string
  }> {
    try {
      const { content } = await this.readResource(uri)
      const url = new URL(uri)
      
      return {
        exists: true,
        size: content.length,
        lastModified: Date.now(),
        provider: url.protocol.slice(0, -1)
      }
    } catch {
      return { exists: false }
    }
  }
}

// Factory function
export function createResourceProviders(
  runtime: RuntimeDomain,
  dom: DOMDomain,
  network: NetworkDomain,
  page: PageDomain,
  integrations: FrameworkIntegrations
): ResourceProviders {
  return new ResourceProvidersImpl(runtime, dom, network, page, integrations)
}

// Re-export individual providers
export {
  BrowserResourceProvider,
  ReactResourceProvider,
  StateResourceProvider,
  NetworkResourceProvider
}