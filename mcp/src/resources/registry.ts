/**
 * @fileoverview Resource registry implementation
 */

import type {
  ResourceHandler,
  ResourceRegistry,
  ResourceMetadata,
  ResourceContent
} from './types.js'
import { ValidationErrors, createLogger, type Logger } from '@curupira/shared'

/**
 * Resource registry implementation
 */
export class ResourceRegistryImpl implements ResourceRegistry {
  private readonly handlers = new Map<string, ResourceHandler>()
  private readonly logger: Logger

  constructor() {
    this.logger = createLogger({ level: 'info' })
  }

  /**
   * Register resource handler
   */
  register(handler: ResourceHandler): void {
    if (this.handlers.has(handler.name)) {
      throw new Error(`Resource handler '${handler.name}' already registered`)
    }

    this.handlers.set(handler.name, handler)
    this.logger.info({ handler: handler.name }, 'Resource handler registered')
  }

  /**
   * Unregister resource handler
   */
  unregister(name: string): void {
    this.handlers.delete(name)
    this.logger.info({ handler: name }, 'Resource handler unregistered')
  }

  /**
   * Get handler by name
   */
  getHandler(name: string): ResourceHandler | undefined {
    return this.handlers.get(name)
  }

  /**
   * Get handler for URI
   */
  getHandlerForUri(uri: string): ResourceHandler | undefined {
    for (const handler of this.handlers.values()) {
      const pattern = handler.pattern
      
      if (typeof pattern === 'string') {
        if (uri.startsWith(pattern)) {
          return handler
        }
      } else if (pattern.test(uri)) {
        return handler
      }
    }
    
    return undefined
  }

  /**
   * List all resources
   */
  async listAll(): Promise<ResourceMetadata[]> {
    const allResources: ResourceMetadata[] = []
    
    for (const handler of this.handlers.values()) {
      try {
        const resources = await handler.list()
        allResources.push(...resources)
      } catch (error) {
        this.logger.error({ error, handler: handler.name }, 'Failed to list resources')
      }
    }
    
    return allResources
  }

  /**
   * Read resource
   */
  async read(uri: string): Promise<ResourceContent> {
    const handler = this.getHandlerForUri(uri)
    
    if (!handler) {
      throw new Error(`No handler found for URI: ${uri}`)
    }
    
    try {
      return await handler.read(uri)
    } catch (error) {
      this.logger.error({ error, uri, handler: handler.name }, 'Failed to read resource')
      throw error
    }
  }

  /**
   * Get all handlers
   */
  getAllHandlers(): ResourceHandler[] {
    return Array.from(this.handlers.values())
  }
}