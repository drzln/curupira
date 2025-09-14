/**
 * @fileoverview Cache layer implementation
 */

import type { CacheOptions, CachePolicy } from './types.js'

interface CacheEntry<T> {
  value: T
  expires?: number
  hits: number
  lastAccess: number
}

/**
 * Cache layer
 */
export class CacheLayer {
  private readonly cache = new Map<string, CacheEntry<unknown>>()
  private readonly options: Required<CacheOptions>
  private readonly accessOrder: string[] = []

  constructor(options: CacheOptions = {}) {
    this.options = {
      maxItems: 1000,
      maxSize: Infinity,
      policy: 'lru',
      defaultTTL: 0,
      onEviction: undefined,
      ...options
    }
  }

  /**
   * Get value from cache
   */
  async get<T = unknown>(key: string): Promise<T | undefined> {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined
    
    if (!entry) {
      return undefined
    }
    
    // Check expiry
    if (entry.expires && entry.expires < Date.now()) {
      this.cache.delete(key)
      this.removeFromAccessOrder(key)
      return undefined
    }
    
    // Update access info
    entry.hits++
    entry.lastAccess = Date.now()
    
    // Update access order for LRU
    if (this.options.policy === 'lru') {
      this.updateAccessOrder(key)
    }
    
    return entry.value
  }

  /**
   * Set value in cache
   */
  async set<T = unknown>(key: string, value: T, ttl?: number): Promise<void> {
    const effectiveTTL = ttl ?? this.options.defaultTTL
    
    // Check if we need to evict
    if (this.cache.size >= this.options.maxItems) {
      this.evict()
    }
    
    const entry: CacheEntry<T> = {
      value,
      expires: effectiveTTL > 0 ? Date.now() + effectiveTTL : undefined,
      hits: 0,
      lastAccess: Date.now()
    }
    
    this.cache.set(key, entry)
    
    if (this.options.policy === 'lru' || this.options.policy === 'fifo') {
      this.accessOrder.push(key)
    }
  }

  /**
   * Delete from cache
   */
  async delete(key: string): Promise<boolean> {
    const existed = this.cache.delete(key)
    
    if (existed) {
      this.removeFromAccessOrder(key)
    }
    
    return existed
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear()
    this.accessOrder.length = 0
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size
  }

  /**
   * Evict items based on policy
   */
  private evict(): void {
    let keyToEvict: string | undefined
    
    switch (this.options.policy) {
      case 'lru':
        // Least Recently Used
        keyToEvict = this.accessOrder[0]
        break
        
      case 'lfu':
        // Least Frequently Used
        let minHits = Infinity
        for (const [key, entry] of this.cache.entries()) {
          if (entry.hits < minHits) {
            minHits = entry.hits
            keyToEvict = key
          }
        }
        break
        
      case 'fifo':
        // First In First Out
        keyToEvict = this.accessOrder[0]
        break
        
      case 'ttl':
        // Shortest TTL
        let shortestTTL = Infinity
        const now = Date.now()
        for (const [key, entry] of this.cache.entries()) {
          if (entry.expires) {
            const ttl = entry.expires - now
            if (ttl < shortestTTL) {
              shortestTTL = ttl
              keyToEvict = key
            }
          }
        }
        break
    }
    
    if (keyToEvict) {
      const entry = this.cache.get(keyToEvict)
      this.cache.delete(keyToEvict)
      this.removeFromAccessOrder(keyToEvict)
      
      if (this.options.onEviction && entry) {
        this.options.onEviction(keyToEvict, {
          value: entry.value,
          created: entry.lastAccess as any,
          updated: entry.lastAccess as any,
          expires: entry.expires as any
        })
      }
    }
  }

  /**
   * Update access order for LRU
   */
  private updateAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key)
    if (index > -1) {
      this.accessOrder.splice(index, 1)
    }
    this.accessOrder.push(key)
  }

  /**
   * Remove from access order
   */
  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key)
    if (index > -1) {
      this.accessOrder.splice(index, 1)
    }
  }
}