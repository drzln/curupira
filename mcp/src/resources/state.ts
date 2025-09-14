/**
 * @fileoverview State resource handler for React/Redux/etc
 */

import type {
  ResourceHandler,
  ResourceMetadata,
  ResourceContent,
  StateResource
} from './types.js'
import type { StorageStore } from '@curupira/integration'

/**
 * State resource handler
 */
export class StateResourceHandler implements ResourceHandler {
  name = 'state'
  description = 'Application state (React, Redux, XState, etc)'
  pattern = /^state:\/\//

  constructor(
    private readonly storage: StorageStore
  ) {}

  /**
   * List state resources
   */
  async list(pattern?: string): Promise<ResourceMetadata[]> {
    const keys = await this.storage.keys({ prefix: 'state:' })
    const resources: ResourceMetadata[] = []
    
    for (const key of keys) {
      if (pattern && !key.includes(pattern)) {
        continue
      }
      
      const state = await this.storage.get<StateResource>(key)
      if (state) {
        resources.push({
          uri: `state://${key}`,
          name: `${state.type}: ${state.name}`,
          type: 'state',
          mimeType: 'application/json',
          lastModified: new Date(),
          metadata: {
            type: state.type,
            name: state.name,
            updates: state.updates,
            path: state.path
          }
        })
      }
    }
    
    return resources
  }

  /**
   * Read state resource
   */
  async read(uri: string): Promise<ResourceContent> {
    const key = uri.replace('state://', '')
    const state = await this.storage.get<StateResource>(key)
    
    if (!state) {
      throw new Error(`State not found: ${uri}`)
    }
    
    return {
      data: state,
      encoding: 'json',
      contentType: 'application/json'
    }
  }

  /**
   * Update state
   */
  async updateState(state: StateResource): Promise<void> {
    const key = `state:${state.type}:${state.name}`
    await this.storage.set(key, state)
  }

  /**
   * Subscribe to state changes
   */
  subscribe(
    uri: string,
    callback: (content: ResourceContent) => void
  ): () => void {
    const key = uri.replace('state://', '')
    
    // Set up polling for state changes
    const interval = setInterval(async () => {
      try {
        const content = await this.read(uri)
        callback(content)
      } catch {
        // State might have been removed
      }
    }, 1000)
    
    // Return unsubscribe function
    return () => clearInterval(interval)
  }

  /**
   * Clear state
   */
  async clear(type?: StateResource['type']): Promise<void> {
    const prefix = type ? `state:${type}:` : 'state:'
    const keys = await this.storage.keys({ prefix })
    await Promise.all(keys.map(key => this.storage.delete(key)))
  }
}