/**
 * @fileoverview File-based storage backend
 */

import { promises as fs } from 'fs'
import path from 'path'
import type {
  StorageBackend,
  StorageValue,
  StorageQueryOptions,
  StorageStatistics
} from './types.js'
import type { Timestamp } from '@curupira/shared'

/**
 * File storage backend
 */
export class FileBackend implements StorageBackend {
  readonly name = 'file'
  private readonly basePath: string
  private readonly encoding = 'utf8'

  constructor(basePath: string) {
    this.basePath = basePath
  }

  async get<T = unknown>(key: string): Promise<StorageValue<T> | undefined> {
    const filePath = this.getFilePath(key)
    
    try {
      const data = await fs.readFile(filePath, this.encoding)
      const stored = JSON.parse(data) as StorageValue<T>
      
      // Check expiry
      if (stored.expires && stored.expires < Date.now()) {
        await this.delete(key)
        return undefined
      }
      
      return stored
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return undefined
      }
      throw error
    }
  }

  async getMany<T = unknown>(keys: string[]): Promise<Map<string, StorageValue<T>>> {
    const results = new Map<string, StorageValue<T>>()
    
    const promises = keys.map(async key => {
      const value = await this.get<T>(key)
      if (value) {
        results.set(key, value)
      }
    })
    
    await Promise.all(promises)
    return results
  }

  async set<T = unknown>(key: string, value: T, ttl?: number): Promise<void> {
    const filePath = this.getFilePath(key)
    const dir = path.dirname(filePath)
    
    // Ensure directory exists
    await fs.mkdir(dir, { recursive: true })
    
    const now = Date.now() as Timestamp
    const stored: StorageValue<T> = {
      value,
      created: now,
      updated: now,
      expires: ttl ? (now + ttl) as Timestamp : undefined
    }
    
    await fs.writeFile(filePath, JSON.stringify(stored), this.encoding)
  }

  async setMany<T = unknown>(entries: Array<[string, T, number?]>): Promise<void> {
    const promises = entries.map(([key, value, ttl]) => 
      this.set(key, value, ttl)
    )
    
    await Promise.all(promises)
  }

  async delete(key: string): Promise<boolean> {
    const filePath = this.getFilePath(key)
    
    try {
      await fs.unlink(filePath)
      return true
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return false
      }
      throw error
    }
  }

  async deleteMany(keys: string[]): Promise<number> {
    const results = await Promise.all(
      keys.map(key => this.delete(key))
    )
    
    return results.filter(existed => existed).length
  }

  async clear(): Promise<void> {
    try {
      await fs.rm(this.basePath, { recursive: true, force: true })
      await fs.mkdir(this.basePath, { recursive: true })
    } catch (error) {
      // Ignore errors
    }
  }

  async has(key: string): Promise<boolean> {
    const filePath = this.getFilePath(key)
    
    try {
      await fs.access(filePath)
      
      // Check if expired
      const value = await this.get(key)
      return value !== undefined
    } catch {
      return false
    }
  }

  async keys(options?: StorageQueryOptions): Promise<string[]> {
    const allKeys: string[] = []
    
    const scanDir = async (dir: string, prefix: string = ''): Promise<void> => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true })
        
        for (const entry of entries) {
          if (entry.isDirectory()) {
            await scanDir(
              path.join(dir, entry.name),
              prefix ? `${prefix}/${entry.name}` : entry.name
            )
          } else if (entry.name.endsWith('.json')) {
            const key = prefix 
              ? `${prefix}/${entry.name.slice(0, -5)}`
              : entry.name.slice(0, -5)
            allKeys.push(key)
          }
        }
      } catch {
        // Ignore errors
      }
    }
    
    await scanDir(this.basePath)
    
    // Apply filters
    let filtered = allKeys
    
    if (options?.prefix) {
      filtered = filtered.filter(key => key.startsWith(options.prefix!))
    }
    
    if (options?.pattern) {
      const regex = typeof options.pattern === 'string' 
        ? new RegExp(options.pattern)
        : options.pattern
      filtered = filtered.filter(key => regex.test(key))
    }
    
    // Apply sorting
    if (options?.sortBy === 'key') {
      filtered.sort((a, b) => 
        options.sortOrder === 'desc' ? b.localeCompare(a) : a.localeCompare(b)
      )
    }
    
    // Apply pagination
    if (options?.offset || options?.limit) {
      const start = options.offset || 0
      const end = options.limit ? start + options.limit : undefined
      filtered = filtered.slice(start, end)
    }
    
    return filtered
  }

  async values<T = unknown>(options?: StorageQueryOptions): Promise<Array<StorageValue<T>>> {
    const keys = await this.keys(options)
    const values: Array<StorageValue<T>> = []
    
    for (const key of keys) {
      const value = await this.get<T>(key)
      if (value) {
        values.push(value)
      }
    }
    
    return values
  }

  async entries<T = unknown>(options?: StorageQueryOptions): Promise<Array<[string, StorageValue<T>]>> {
    const keys = await this.keys(options)
    const entries: Array<[string, StorageValue<T>]> = []
    
    for (const key of keys) {
      const value = await this.get<T>(key)
      if (value) {
        entries.push([key, value])
      }
    }
    
    return entries
  }

  async size(): Promise<number> {
    const keys = await this.keys()
    return keys.length
  }

  async stats(): Promise<StorageStatistics> {
    const keys = await this.keys()
    let totalSize = 0
    let expired = 0
    
    for (const key of keys) {
      const filePath = this.getFilePath(key)
      try {
        const stat = await fs.stat(filePath)
        totalSize += stat.size
        
        const value = await this.get(key)
        if (value && value.expires && value.expires < Date.now()) {
          expired++
        }
      } catch {
        // Ignore errors
      }
    }
    
    return {
      count: keys.length,
      size: totalSize,
      expired,
      hitRate: 0,
      missRate: 0,
      avgReadTime: 0,
      avgWriteTime: 0
    }
  }

  async close(): Promise<void> {
    // Nothing to close
  }

  private getFilePath(key: string): string {
    // Sanitize key to be filesystem-safe
    const safeName = key.replace(/[^a-zA-Z0-9-_./]/g, '_')
    return path.join(this.basePath, `${safeName}.json`)
  }
}