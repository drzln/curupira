/**
 * @fileoverview Console resource handler
 */

import type {
  ResourceHandler,
  ResourceMetadata,
  ResourceContent,
  ConsoleResource
} from './types.js'
import type { StorageStore } from '@curupira/integration'

/**
 * Console resource handler
 */
export class ConsoleResourceHandler implements ResourceHandler {
  name = 'console'
  description = 'Browser console logs and messages'
  pattern = /^console:\/\//

  constructor(
    private readonly storage: StorageStore
  ) {}

  /**
   * List console resources
   */
  async list(pattern?: string): Promise<ResourceMetadata[]> {
    const keys = await this.storage.keys({ prefix: 'console:' })
    const resources: ResourceMetadata[] = []
    
    for (const key of keys) {
      if (pattern && !key.includes(pattern)) {
        continue
      }
      
      const log = await this.storage.get<ConsoleResource>(key)
      if (log) {
        resources.push({
          uri: `console://${key}`,
          name: `${log.level}: ${log.message.substring(0, 50)}...`,
          type: 'console',
          mimeType: 'application/json',
          lastModified: new Date(log.timestamp),
          metadata: {
            level: log.level,
            source: log.source?.url
          }
        })
      }
    }
    
    return resources
  }

  /**
   * Read console resource
   */
  async read(uri: string): Promise<ResourceContent> {
    const key = uri.replace('console://', '')
    const log = await this.storage.get<ConsoleResource>(key)
    
    if (!log) {
      throw new Error(`Console log not found: ${uri}`)
    }
    
    return {
      data: log,
      encoding: 'json',
      contentType: 'application/json'
    }
  }

  /**
   * Add console log
   */
  async addLog(log: ConsoleResource): Promise<void> {
    const key = `console:${log.timestamp}:${Math.random().toString(36).substring(2, 9)}`
    await this.storage.set(key, log, 3600000) // 1 hour TTL
  }

  /**
   * Clear console logs
   */
  async clear(): Promise<void> {
    const keys = await this.storage.keys({ prefix: 'console:' })
    await Promise.all(keys.map(key => this.storage.delete(key)))
  }
}