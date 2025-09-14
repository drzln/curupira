/**
 * @fileoverview Resource registry tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ResourceRegistryImpl } from './registry.js'
import type { ResourceHandler } from './types.js'

describe('ResourceRegistry', () => {
  let registry: ResourceRegistryImpl
  let mockHandler: ResourceHandler

  beforeEach(() => {
    registry = new ResourceRegistryImpl()
    mockHandler = {
      name: 'test',
      description: 'Test handler',
      pattern: /^test:\/\//,
      list: vi.fn().mockResolvedValue([]),
      read: vi.fn().mockResolvedValue({ data: 'test', encoding: 'json' })
    }
  })

  describe('Core functionality', () => {
    it('should register handler', () => {
      registry.register(mockHandler)
      expect(registry.getHandler('test')).toBe(mockHandler)
    })

    it('should prevent duplicate registration', () => {
      registry.register(mockHandler)
      expect(() => registry.register(mockHandler)).toThrow('already registered')
    })

    it('should unregister handler', () => {
      registry.register(mockHandler)
      registry.unregister('test')
      expect(registry.getHandler('test')).toBeUndefined()
    })

    it('should get handler for URI', () => {
      registry.register(mockHandler)
      const handler = registry.getHandlerForUri('test://resource')
      expect(handler).toBe(mockHandler)
    })

    it('should list all resources', async () => {
      mockHandler.list = vi.fn().mockResolvedValue([
        { uri: 'test://1', name: 'Resource 1', type: 'test' }
      ])
      
      registry.register(mockHandler)
      const resources = await registry.listAll()
      
      expect(resources).toHaveLength(1)
      expect(resources[0].name).toBe('Resource 1')
    })

    it('should read resource', async () => {
      registry.register(mockHandler)
      const content = await registry.read('test://resource')
      
      expect(mockHandler.read).toHaveBeenCalledWith('test://resource')
      expect(content.data).toBe('test')
    })

    it('should throw error for unknown URI', async () => {
      await expect(registry.read('unknown://resource')).rejects.toThrow('No handler found')
    })
  })
})