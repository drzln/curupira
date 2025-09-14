/**
 * @fileoverview In-memory storage backend
 */

import type {
  StorageBackend,
  StorageValue,
  StorageQueryOptions,
  StorageStatistics
} from './types.js'
import type { Timestamp } from '@curupira/shared'

/**
 * In-memory storage backend
 */
export class MemoryBackend implements StorageBackend {
  readonly name = 'memory'
  private readonly store = new Map<string, StorageValue>()
  private stats = {
    reads: 0,
    writes: 0,
    deletes: 0
  }

  async get<T = unknown>(key: string): Promise<StorageValue<T> | undefined> {
    this.stats.reads++
    const value = this.store.get(key)
    
    if (value && this.isExpired(value)) {
      this.store.delete(key)
      return undefined
    }
    
    return value as StorageValue<T> | undefined
  }

  async getMany<T = unknown>(keys: string[]): Promise<Map<string, StorageValue<T>>> {
    const results = new Map<string, StorageValue<T>>()
    
    for (const key of keys) {
      const value = await this.get<T>(key)
      if (value) {
        results.set(key, value)
      }
    }
    
    return results
  }

  async set<T = unknown>(key: string, value: T, ttl?: number): Promise<void> {
    this.stats.writes++
    const now = Date.now() as Timestamp
    
    this.store.set(key, {
      value,
      created: now,
      updated: now,
      expires: ttl ? (now + ttl) as Timestamp : undefined
    })
  }

  async setMany<T = unknown>(entries: Array<[string, T, number?]>): Promise<void> {
    for (const [key, value, ttl] of entries) {
      await this.set(key, value, ttl)
    }
  }

  async delete(key: string): Promise<boolean> {
    this.stats.deletes++
    return this.store.delete(key)
  }

  async deleteMany(keys: string[]): Promise<number> {
    let deleted = 0
    
    for (const key of keys) {
      if (await this.delete(key)) {
        deleted++
      }
    }
    
    return deleted
  }

  async clear(): Promise<void> {
    this.store.clear()
  }

  async has(key: string): Promise<boolean> {
    const value = this.store.get(key)
    
    if (value && this.isExpired(value)) {
      this.store.delete(key)
      return false
    }
    
    return this.store.has(key)
  }

  async keys(options?: StorageQueryOptions): Promise<string[]> {
    this.cleanExpired()
    
    let keys = Array.from(this.store.keys())
    
    // Apply filters
    if (options?.prefix) {
      keys = keys.filter(key => key.startsWith(options.prefix!))
    }
    
    if (options?.pattern) {
      const regex = typeof options.pattern === 'string' 
        ? new RegExp(options.pattern)
        : options.pattern
      keys = keys.filter(key => regex.test(key))
    }
    
    // Apply sorting
    if (options?.sortBy) {
      keys.sort((a, b) => {
        if (options.sortBy === 'key') {
          return options.sortOrder === 'desc' ? b.localeCompare(a) : a.localeCompare(b)
        }
        
        const valueA = this.store.get(a)!
        const valueB = this.store.get(b)!
        
        const fieldA = valueA[options.sortBy as keyof StorageValue] as number
        const fieldB = valueB[options.sortBy as keyof StorageValue] as number
        
        return options.sortOrder === 'desc' ? fieldB - fieldA : fieldA - fieldB
      })
    }
    
    // Apply pagination
    if (options?.offset || options?.limit) {
      const start = options.offset || 0
      const end = options.limit ? start + options.limit : undefined
      keys = keys.slice(start, end)
    }
    
    return keys
  }

  async values<T = unknown>(options?: StorageQueryOptions): Promise<Array<StorageValue<T>>> {
    const keys = await this.keys(options)
    const values: Array<StorageValue<T>> = []
    
    for (const key of keys) {
      const value = this.store.get(key)
      if (value) {
        values.push(value as StorageValue<T>)
      }
    }
    
    return values
  }

  async entries<T = unknown>(options?: StorageQueryOptions): Promise<Array<[string, StorageValue<T>]>> {
    const keys = await this.keys(options)
    const entries: Array<[string, StorageValue<T>]> = []
    
    for (const key of keys) {
      const value = this.store.get(key)
      if (value) {
        entries.push([key, value as StorageValue<T>])
      }
    }
    
    return entries
  }

  async size(): Promise<number> {
    this.cleanExpired()
    return this.store.size
  }

  async stats(): Promise<StorageStatistics> {
    this.cleanExpired()
    
    let totalSize = 0
    let expired = 0
    
    for (const value of this.store.values()) {
      // Estimate size (rough)
      totalSize += JSON.stringify(value).length
      
      if (this.isExpired(value)) {
        expired++
      }
    }
    
    return {
      count: this.store.size,
      size: totalSize,
      expired,
      hitRate: 0,
      missRate: 0,
      avgReadTime: 0,
      avgWriteTime: 0
    }
  }

  private isExpired(value: StorageValue): boolean {
    return value.expires !== undefined && value.expires < Date.now()
  }

  private cleanExpired(): void {
    const now = Date.now()
    const toDelete: string[] = []
    
    for (const [key, value] of this.store.entries()) {
      if (this.isExpired(value)) {
        toDelete.push(key)
      }
    }
    
    for (const key of toDelete) {
      this.store.delete(key)
    }
  }
}