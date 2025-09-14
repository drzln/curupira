/**
 * @fileoverview Unified storage store
 * 
 * This file provides a high-level storage interface that can use
 * different backends and includes caching, namespacing, and events.
 */

import { EventEmitter } from 'eventemitter3'
import type {
  StorageBackend,
  StorageOptions,
  StorageValue,
  StorageQueryOptions,
  StorageStatistics,
  StorageEvents,
  CacheOptions
} from './types.js'
import {
  createLogger,
  type Logger,
  type Timestamp
} from '@curupira/shared'
import { MemoryBackend } from './memory.js'
import { CacheLayer } from './cache.js'

/**
 * Storage store
 */
export class StorageStore extends EventEmitter<StorageEvents> {
  private readonly backend: StorageBackend
  private readonly cache?: CacheLayer
  private readonly options: Required<StorageOptions>
  private readonly logger: Logger
  private readonly stats = {
    reads: 0,
    writes: 0,
    deletes: 0,
    hits: 0,
    misses: 0,
    errors: 0,
    totalReadTime: 0,
    totalWriteTime: 0
  }

  constructor(
    backend?: StorageBackend,
    options?: StorageOptions & { cache?: CacheOptions }
  ) {
    super()
    
    this.backend = backend || new MemoryBackend()
    this.options = {
      defaultTTL: 0,
      namespace: '',
      serialization: 'json',
      compression: false,
      encryption: undefined,
      ...options
    }
    
    this.logger = createLogger({ level: 'info' })
    
    // Initialize cache if enabled
    if (options?.cache) {
      this.cache = new CacheLayer(options.cache)
    }
  }

  /**
   * Get value
   */
  async get<T = unknown>(key: string): Promise<T | undefined> {
    const startTime = Date.now()
    const namespacedKey = this.getNamespacedKey(key)
    
    this.stats.reads++
    
    try {
      // Check cache first
      if (this.cache) {
        const cached = await this.cache.get<T>(namespacedKey)
        if (cached !== undefined) {
          this.stats.hits++
          this.emit('hit', key)
          this.emit('get', key, true)
          return cached
        }
      }
      
      // Get from backend
      const stored = await this.backend.get<T>(namespacedKey)
      
      if (stored) {
        // Check expiry
        if (this.isExpired(stored)) {
          await this.backend.delete(namespacedKey)
          this.emit('expire', key)
          this.emit('get', key, false)
          return undefined
        }
        
        // Update cache
        if (this.cache) {
          await this.cache.set(namespacedKey, stored.value, this.getTTL(stored))
        }
        
        this.emit('get', key, true)
        return stored.value
      }
      
      this.stats.misses++
      this.emit('miss', key)
      this.emit('get', key, false)
      return undefined
    } catch (error) {
      this.stats.errors++
      this.logger.error({ error, key }, 'Storage get error')
      this.emit('error', error as Error, 'get')
      throw error
    } finally {
      this.stats.totalReadTime += Date.now() - startTime
    }
  }

  /**
   * Get multiple values
   */
  async getMany<T = unknown>(keys: string[]): Promise<Map<string, T>> {
    const results = new Map<string, T>()
    
    // Parallel fetch
    const promises = keys.map(async key => {
      const value = await this.get<T>(key)
      if (value !== undefined) {
        results.set(key, value)
      }
    })
    
    await Promise.all(promises)
    return results
  }

  /**
   * Set value
   */
  async set<T = unknown>(key: string, value: T, ttl?: number): Promise<void> {
    const startTime = Date.now()
    const namespacedKey = this.getNamespacedKey(key)
    const effectiveTTL = ttl ?? this.options.defaultTTL
    
    this.stats.writes++
    
    try {
      const now = Date.now() as Timestamp
      const stored: StorageValue<T> = {
        value,
        created: now,
        updated: now,
        expires: effectiveTTL > 0 ? (now + effectiveTTL) as Timestamp : undefined
      }
      
      // Set in backend
      await this.backend.set(namespacedKey, value, effectiveTTL)
      
      // Update cache
      if (this.cache) {
        await this.cache.set(namespacedKey, value, effectiveTTL)
      }
      
      this.emit('set', key, value)
    } catch (error) {
      this.stats.errors++
      this.logger.error({ error, key }, 'Storage set error')
      this.emit('error', error as Error, 'set')
      throw error
    } finally {
      this.stats.totalWriteTime += Date.now() - startTime
    }
  }

  /**
   * Set multiple values
   */
  async setMany<T = unknown>(entries: Array<[string, T, number?]>): Promise<void> {
    const promises = entries.map(([key, value, ttl]) => 
      this.set(key, value, ttl)
    )
    
    await Promise.all(promises)
  }

  /**
   * Delete value
   */
  async delete(key: string): Promise<boolean> {
    const namespacedKey = this.getNamespacedKey(key)
    
    this.stats.deletes++
    
    try {
      // Delete from cache
      if (this.cache) {
        await this.cache.delete(namespacedKey)
      }
      
      // Delete from backend
      const existed = await this.backend.delete(namespacedKey)
      
      this.emit('delete', key, existed)
      return existed
    } catch (error) {
      this.stats.errors++
      this.logger.error({ error, key }, 'Storage delete error')
      this.emit('error', error as Error, 'delete')
      throw error
    }
  }

  /**
   * Delete multiple values
   */
  async deleteMany(keys: string[]): Promise<number> {
    const results = await Promise.all(
      keys.map(key => this.delete(key))
    )
    
    return results.filter(existed => existed).length
  }

  /**
   * Clear all values
   */
  async clear(): Promise<void> {
    if (this.cache) {
      await this.cache.clear()
    }
    
    if (this.options.namespace) {
      // Clear only namespaced keys
      const keys = await this.keys()
      await this.deleteMany(keys)
    } else {
      // Clear all
      await this.backend.clear()
    }
  }

  /**
   * Check existence
   */
  async has(key: string): Promise<boolean> {
    const value = await this.get(key)
    return value !== undefined
  }

  /**
   * Get all keys
   */
  async keys(options?: StorageQueryOptions): Promise<string[]> {
    const backendKeys = await this.backend.keys(options)
    
    // Remove namespace prefix
    if (this.options.namespace) {
      const prefix = this.options.namespace + ':'
      return backendKeys
        .filter(key => key.startsWith(prefix))
        .map(key => key.slice(prefix.length))
    }
    
    return backendKeys
  }

  /**
   * Get size
   */
  async size(): Promise<number> {
    if (this.options.namespace) {
      const keys = await this.keys()
      return keys.length
    }
    
    return this.backend.size()
  }

  /**
   * Get statistics
   */
  async getStatistics(): Promise<StorageStatistics> {
    const backendStats = await this.backend.stats()
    
    return {
      ...backendStats,
      hitRate: this.stats.reads > 0 
        ? this.stats.hits / this.stats.reads 
        : 0,
      missRate: this.stats.reads > 0 
        ? this.stats.misses / this.stats.reads 
        : 0,
      avgReadTime: this.stats.reads > 0 
        ? this.stats.totalReadTime / this.stats.reads 
        : 0,
      avgWriteTime: this.stats.writes > 0 
        ? this.stats.totalWriteTime / this.stats.writes 
        : 0
    }
  }

  /**
   * Close store
   */
  async close(): Promise<void> {
    if (this.cache) {
      this.cache.clear()
    }
    
    if (this.backend.close) {
      await this.backend.close()
    }
    
    this.removeAllListeners()
  }

  /**
   * Get namespaced key
   */
  private getNamespacedKey(key: string): string {
    return this.options.namespace 
      ? `${this.options.namespace}:${key}`
      : key
  }

  /**
   * Check if value is expired
   */
  private isExpired(stored: StorageValue): boolean {
    return stored.expires !== undefined && 
           stored.expires < Date.now()
  }

  /**
   * Get TTL from stored value
   */
  private getTTL(stored: StorageValue): number {
    if (!stored.expires) return 0
    
    const remaining = stored.expires - Date.now()
    return remaining > 0 ? remaining : 0
  }
}

/**
 * Create storage store
 */
export function createStorageStore(
  backend?: StorageBackend,
  options?: StorageOptions & { cache?: CacheOptions }
): StorageStore {
  return new StorageStore(backend, options)
}