/**
 * @fileoverview Network resource handler
 */

import type {
  ResourceHandler,
  ResourceMetadata,
  ResourceContent,
  NetworkResource
} from './types.js'
import type { StorageStore } from '@curupira/integration'

/**
 * Network resource handler
 */
export class NetworkResourceHandler implements ResourceHandler {
  name = 'network'
  description = 'Network requests and responses'
  pattern = /^network:\/\//

  constructor(
    private readonly storage: StorageStore
  ) {}

  /**
   * List network resources
   */
  async list(pattern?: string): Promise<ResourceMetadata[]> {
    const keys = await this.storage.keys({ prefix: 'network:' })
    const resources: ResourceMetadata[] = []
    
    for (const key of keys) {
      if (pattern && !key.includes(pattern)) {
        continue
      }
      
      const request = await this.storage.get<NetworkResource>(key)
      if (request) {
        resources.push({
          uri: `network://${key}`,
          name: `${request.method} ${new URL(request.url).pathname}`,
          type: 'network',
          mimeType: 'application/json',
          size: request.size?.response,
          lastModified: new Date(request.timing?.start || Date.now()),
          metadata: {
            method: request.method,
            status: request.status,
            duration: request.timing?.duration
          }
        })
      }
    }
    
    return resources
  }

  /**
   * Read network resource
   */
  async read(uri: string): Promise<ResourceContent> {
    const key = uri.replace('network://', '')
    const request = await this.storage.get<NetworkResource>(key)
    
    if (!request) {
      throw new Error(`Network request not found: ${uri}`)
    }
    
    return {
      data: request,
      encoding: 'json',
      contentType: 'application/json'
    }
  }

  /**
   * Add network request
   */
  async addRequest(request: NetworkResource): Promise<void> {
    const key = `network:${request.requestId}`
    await this.storage.set(key, request, 3600000) // 1 hour TTL
  }

  /**
   * Update network request
   */
  async updateRequest(requestId: string, updates: Partial<NetworkResource>): Promise<void> {
    const key = `network:${requestId}`
    const existing = await this.storage.get<NetworkResource>(key)
    
    if (existing) {
      const updated = { ...existing, ...updates }
      await this.storage.set(key, updated, 3600000)
    }
  }

  /**
   * Clear network requests
   */
  async clear(): Promise<void> {
    const keys = await this.storage.keys({ prefix: 'network:' })
    await Promise.all(keys.map(key => this.storage.delete(key)))
  }
}