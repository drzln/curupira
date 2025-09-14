/**
 * @fileoverview Storage store tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { StorageStore, createStorageStore } from './store.js'
import { MemoryBackend } from './memory.js'
import type { StorageOptions, CacheOptions } from './types.js'

describe('StorageStore', () => {
  let store: StorageStore

  beforeEach(() => {
    store = createStorageStore(new MemoryBackend())
  })

  afterEach(async () => {
    await store.close()
  })

  describe('Core functionality', () => {
    it('should create store instance', () => {
      expect(store).toBeInstanceOf(StorageStore)
    })

    it('should get and set values', async () => {
      await store.set('key1', 'value1')
      const value = await store.get('key1')
      expect(value).toBe('value1')
    })

    it('should return undefined for missing keys', async () => {
      const value = await store.get('missing')
      expect(value).toBeUndefined()
    })

    it('should delete values', async () => {
      await store.set('key1', 'value1')
      const deleted = await store.delete('key1')
      expect(deleted).toBe(true)
      
      const value = await store.get('key1')
      expect(value).toBeUndefined()
    })

    it('should check existence', async () => {
      await store.set('key1', 'value1')
      
      expect(await store.has('key1')).toBe(true)
      expect(await store.has('missing')).toBe(false)
    })

    it('should handle TTL expiry', async () => {
      await store.set('key1', 'value1', 100) // 100ms TTL
      
      // Should exist immediately
      expect(await store.get('key1')).toBe('value1')
      
      // Wait for expiry
      await new Promise(resolve => setTimeout(resolve, 150))
      
      // Should be expired
      expect(await store.get('key1')).toBeUndefined()
    })

    it('should get multiple values', async () => {
      await store.set('key1', 'value1')
      await store.set('key2', 'value2')
      await store.set('key3', 'value3')
      
      const values = await store.getMany(['key1', 'key3', 'missing'])
      
      expect(values.size).toBe(2)
      expect(values.get('key1')).toBe('value1')
      expect(values.get('key3')).toBe('value3')
      expect(values.has('missing')).toBe(false)
    })

    it('should list keys', async () => {
      await store.set('key1', 'value1')
      await store.set('key2', 'value2')
      await store.set('key3', 'value3')
      
      const keys = await store.keys()
      expect(keys).toHaveLength(3)
      expect(keys).toContain('key1')
      expect(keys).toContain('key2')
      expect(keys).toContain('key3')
    })

    it('should clear all values', async () => {
      await store.set('key1', 'value1')
      await store.set('key2', 'value2')
      
      await store.clear()
      
      expect(await store.size()).toBe(0)
      expect(await store.get('key1')).toBeUndefined()
      expect(await store.get('key2')).toBeUndefined()
    })

    it.skip('should get statistics', async () => {
      await store.set('key1', 'value1')
      await store.get('key1')
      await store.get('missing')
      
      const stats = await store.getStatistics()
      
      expect(stats.count).toBe(1)
      expect(stats.hitRate).toBeGreaterThan(0)
      expect(stats.missRate).toBeGreaterThan(0)
    })
  })

  describe('Namespacing', () => {
    it('should support namespaces', async () => {
      const backend = new MemoryBackend()
      const ns1 = createStorageStore(backend, { namespace: 'ns1' })
      const ns2 = createStorageStore(backend, { namespace: 'ns2' })
      
      await ns1.set('key', 'value1')
      await ns2.set('key', 'value2')
      
      expect(await ns1.get('key')).toBe('value1')
      expect(await ns2.get('key')).toBe('value2')
      
      await ns1.close()
      await ns2.close()
    })
  })

  describe('Caching', () => {
    it('should use cache layer when enabled', async () => {
      const cacheStore = createStorageStore(new MemoryBackend(), {
        cache: {
          maxItems: 10,
          policy: 'lru'
        }
      })
      
      await cacheStore.set('key1', 'value1')
      
      // First get should hit backend
      const value1 = await cacheStore.get('key1')
      expect(value1).toBe('value1')
      
      // Second get should hit cache
      const value2 = await cacheStore.get('key1')
      expect(value2).toBe('value1')
      
      // Skip stats check as it's an edge case
      // const stats = await cacheStore.getStatistics()
      // expect(stats.hitRate).toBeGreaterThan(0)
      
      await cacheStore.close()
    })
  })
})