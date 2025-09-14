/**
 * @fileoverview Storage resource handler
 */

import type {
  ResourceHandler,
  ResourceMetadata,
  ResourceContent,
  StorageResource
} from './types.js'
import type { CdpClient } from '@curupira/integration'

/**
 * Storage resource handler
 */
export class StorageResourceHandler implements ResourceHandler {
  name = 'storage'
  description = 'Browser storage (localStorage, sessionStorage, cookies)'
  pattern = /^storage:\/\//

  constructor(
    private readonly cdpClient: CdpClient
  ) {}

  /**
   * List storage resources
   */
  async list(pattern?: string): Promise<ResourceMetadata[]> {
    const resources: ResourceMetadata[] = []
    
    // Get localStorage items
    const localStorage = await this.getStorageItems('localStorage')
    for (const [key, value] of Object.entries(localStorage)) {
      const uri = `storage://localStorage/${key}`
      if (!pattern || uri.includes(pattern)) {
        resources.push({
          uri,
          name: `localStorage: ${key}`,
          type: 'storage',
          mimeType: 'application/json',
          size: JSON.stringify(value).length,
          metadata: { type: 'localStorage', key }
        })
      }
    }
    
    // Get sessionStorage items
    const sessionStorage = await this.getStorageItems('sessionStorage')
    for (const [key, value] of Object.entries(sessionStorage)) {
      const uri = `storage://sessionStorage/${key}`
      if (!pattern || uri.includes(pattern)) {
        resources.push({
          uri,
          name: `sessionStorage: ${key}`,
          type: 'storage',
          mimeType: 'application/json',
          size: JSON.stringify(value).length,
          metadata: { type: 'sessionStorage', key }
        })
      }
    }
    
    // Get cookies
    const cookies = await this.getCookies()
    for (const cookie of cookies) {
      const uri = `storage://cookie/${cookie.name}`
      if (!pattern || uri.includes(pattern)) {
        resources.push({
          uri,
          name: `cookie: ${cookie.name}`,
          type: 'storage',
          mimeType: 'application/json',
          size: cookie.value.length,
          metadata: { 
            type: 'cookies',
            key: cookie.name,
            domain: cookie.domain,
            expires: cookie.expires
          }
        })
      }
    }
    
    return resources
  }

  /**
   * Read storage resource
   */
  async read(uri: string): Promise<ResourceContent> {
    const parts = uri.replace('storage://', '').split('/')
    const type = parts[0] as StorageResource['type']
    const key = parts.slice(1).join('/')
    
    let resource: StorageResource
    
    switch (type) {
      case 'localStorage':
      case 'sessionStorage': {
        const items = await this.getStorageItems(type)
        const value = items[key]
        
        if (value === undefined) {
          throw new Error(`Storage item not found: ${uri}`)
        }
        
        resource = {
          type,
          key,
          value: this.parseValue(value)
        }
        break
      }
      
      case 'cookies': {
        const cookies = await this.getCookies()
        const cookie = cookies.find(c => c.name === key)
        
        if (!cookie) {
          throw new Error(`Cookie not found: ${uri}`)
        }
        
        resource = {
          type: 'cookies',
          key: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path,
          expires: cookie.expires ? new Date(cookie.expires * 1000) : undefined
        }
        break
      }
      
      default:
        throw new Error(`Unknown storage type: ${type}`)
    }
    
    return {
      data: resource,
      encoding: 'json',
      contentType: 'application/json'
    }
  }

  /**
   * Get storage items
   */
  private async getStorageItems(
    type: 'localStorage' | 'sessionStorage'
  ): Promise<Record<string, string>> {
    const result = await this.cdpClient.send<any>({
      method: 'Runtime.evaluate',
      params: {
        expression: `Object.entries(${type})`,
        returnByValue: true
      }
    })
    
    if (result.result?.result?.value) {
      const entries = result.result.result.value as Array<[string, string]>
      return Object.fromEntries(entries)
    }
    
    return {}
  }

  /**
   * Get cookies
   */
  private async getCookies(): Promise<any[]> {
    const result = await this.cdpClient.send<{ cookies: any[] }>({
      method: 'Network.getCookies'
    })
    
    return result.result?.cookies || []
  }

  /**
   * Parse storage value
   */
  private parseValue(value: string): any {
    try {
      return JSON.parse(value)
    } catch {
      return value
    }
  }
}