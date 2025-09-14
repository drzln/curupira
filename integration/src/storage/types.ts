/**
 * @fileoverview Storage abstraction types
 * 
 * This file defines types for the storage abstraction layer,
 * supporting various storage backends and caching strategies.
 */

import type { Timestamp } from '@curupira/shared'

/**
 * Storage value wrapper
 */
export interface StorageValue<T = unknown> {
  /** Value */
  value: T
  /** Created timestamp */
  created: Timestamp
  /** Updated timestamp */
  updated: Timestamp
  /** Expiry timestamp */
  expires?: Timestamp
  /** Metadata */
  metadata?: Record<string, unknown>
}

/**
 * Storage options
 */
export interface StorageOptions {
  /** Default TTL in milliseconds */
  defaultTTL?: number
  /** Namespace prefix */
  namespace?: string
  /** Serialization format */
  serialization?: 'json' | 'msgpack' | 'none'
  /** Compression */
  compression?: boolean
  /** Encryption */
  encryption?: {
    algorithm: string
    key: string
  }
}

/**
 * Storage query options
 */
export interface StorageQueryOptions {
  /** Key prefix */
  prefix?: string
  /** Key pattern */
  pattern?: string | RegExp
  /** Limit results */
  limit?: number
  /** Offset */
  offset?: number
  /** Include expired */
  includeExpired?: boolean
  /** Sort by */
  sortBy?: 'key' | 'created' | 'updated'
  /** Sort order */
  sortOrder?: 'asc' | 'desc'
}

/**
 * Storage statistics
 */
export interface StorageStatistics {
  /** Total items */
  count: number
  /** Total size in bytes */
  size: number
  /** Expired items */
  expired: number
  /** Hit rate */
  hitRate: number
  /** Miss rate */
  missRate: number
  /** Average read time */
  avgReadTime: number
  /** Average write time */
  avgWriteTime: number
}

/**
 * Storage transaction
 */
export interface StorageTransaction {
  /** Get value */
  get<T = unknown>(key: string): Promise<T | undefined>
  /** Set value */
  set<T = unknown>(key: string, value: T, ttl?: number): Promise<void>
  /** Delete value */
  delete(key: string): Promise<boolean>
  /** Check existence */
  has(key: string): Promise<boolean>
  /** Commit transaction */
  commit(): Promise<void>
  /** Rollback transaction */
  rollback(): Promise<void>
}

/**
 * Storage backend interface
 */
export interface StorageBackend {
  /** Backend name */
  readonly name: string
  
  /** Get value */
  get<T = unknown>(key: string): Promise<StorageValue<T> | undefined>
  
  /** Get multiple values */
  getMany<T = unknown>(keys: string[]): Promise<Map<string, StorageValue<T>>>
  
  /** Set value */
  set<T = unknown>(key: string, value: T, ttl?: number): Promise<void>
  
  /** Set multiple values */
  setMany<T = unknown>(entries: Array<[string, T, number?]>): Promise<void>
  
  /** Delete value */
  delete(key: string): Promise<boolean>
  
  /** Delete multiple values */
  deleteMany(keys: string[]): Promise<number>
  
  /** Clear all values */
  clear(): Promise<void>
  
  /** Check existence */
  has(key: string): Promise<boolean>
  
  /** Get all keys */
  keys(options?: StorageQueryOptions): Promise<string[]>
  
  /** Get all values */
  values<T = unknown>(options?: StorageQueryOptions): Promise<Array<StorageValue<T>>>
  
  /** Get all entries */
  entries<T = unknown>(options?: StorageQueryOptions): Promise<Array<[string, StorageValue<T>]>>
  
  /** Get size */
  size(): Promise<number>
  
  /** Get statistics */
  stats(): Promise<StorageStatistics>
  
  /** Begin transaction */
  transaction?(): Promise<StorageTransaction>
  
  /** Close backend */
  close?(): Promise<void>
}

/**
 * Cache policy
 */
export type CachePolicy = 
  | 'lru' // Least Recently Used
  | 'lfu' // Least Frequently Used
  | 'fifo' // First In First Out
  | 'ttl' // Time To Live only

/**
 * Cache options
 */
export interface CacheOptions {
  /** Maximum items */
  maxItems?: number
  /** Maximum size in bytes */
  maxSize?: number
  /** Cache policy */
  policy?: CachePolicy
  /** Default TTL */
  defaultTTL?: number
  /** On eviction callback */
  onEviction?: <T>(key: string, value: StorageValue<T>) => void
}

/**
 * Storage events
 */
export interface StorageEvents {
  /** Value set */
  'set': (key: string, value: unknown) => void
  /** Value get */
  'get': (key: string, found: boolean) => void
  /** Value deleted */
  'delete': (key: string, existed: boolean) => void
  /** Value expired */
  'expire': (key: string) => void
  /** Cache hit */
  'hit': (key: string) => void
  /** Cache miss */
  'miss': (key: string) => void
  /** Error occurred */
  'error': (error: Error, operation: string) => void
}

/**
 * Storage factory
 */
export interface StorageFactory {
  /** Create storage backend */
  create(type: string, options?: any): StorageBackend
  /** Register backend type */
  register(type: string, factory: () => StorageBackend): void
  /** Get registered types */
  getTypes(): string[]
}