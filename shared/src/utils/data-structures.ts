/**
 * @fileoverview Data structure utilities for Curupira
 * 
 * This file contains reusable data structures and algorithms
 */

/**
 * LRU (Least Recently Used) Cache implementation
 */
export class LRUCache<K, V> {
  private capacity: number
  private cache: Map<K, V>

  constructor(capacity: number) {
    if (capacity <= 0) {
      throw new Error('Cache capacity must be positive')
    }
    this.capacity = capacity
    this.cache = new Map()
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) {
      return undefined
    }

    // Move to end (most recently used)
    const value = this.cache.get(key)!
    this.cache.delete(key)
    this.cache.set(key, value)
    return value
  }

  set(key: K, value: V): void {
    // Remove old value if exists
    if (this.cache.has(key)) {
      this.cache.delete(key)
    }

    // Check capacity
    if (this.cache.size >= this.capacity) {
      // Remove least recently used (first item)
      const firstKey = this.cache.keys().next().value
      if (firstKey !== undefined) {
        this.cache.delete(firstKey)
      }
    }

    // Add new value
    this.cache.set(key, value)
  }

  has(key: K): boolean {
    return this.cache.has(key)
  }

  delete(key: K): boolean {
    return this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  get size(): number {
    return this.cache.size
  }

  entries(): IterableIterator<[K, V]> {
    return this.cache.entries()
  }
}

/**
 * Priority Queue implementation using a binary heap
 */
export class PriorityQueue<T> {
  private heap: Array<{ item: T; priority: number }> = []
  private compare: (a: number, b: number) => number

  constructor(isMinHeap: boolean = true) {
    this.compare = isMinHeap
      ? (a, b) => a - b
      : (a, b) => b - a
  }

  enqueue(item: T, priority: number): void {
    this.heap.push({ item, priority })
    this.bubbleUp(this.heap.length - 1)
  }

  dequeue(): T | undefined {
    if (this.heap.length === 0) {
      return undefined
    }

    if (this.heap.length === 1) {
      return this.heap.pop()!.item
    }

    const result = this.heap[0]
    this.heap[0] = this.heap.pop()!
    this.bubbleDown(0)
    return result.item
  }

  peek(): T | undefined {
    return this.heap[0]?.item
  }

  get size(): number {
    return this.heap.length
  }

  isEmpty(): boolean {
    return this.heap.length === 0
  }

  clear(): void {
    this.heap = []
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2)
      if (this.compare(this.heap[index].priority, this.heap[parentIndex].priority) >= 0) {
        break
      }
      [this.heap[index], this.heap[parentIndex]] = [this.heap[parentIndex], this.heap[index]]
      index = parentIndex
    }
  }

  private bubbleDown(index: number): void {
    while (true) {
      let smallest = index
      const leftChild = 2 * index + 1
      const rightChild = 2 * index + 2

      if (
        leftChild < this.heap.length &&
        this.compare(this.heap[leftChild].priority, this.heap[smallest].priority) < 0
      ) {
        smallest = leftChild
      }

      if (
        rightChild < this.heap.length &&
        this.compare(this.heap[rightChild].priority, this.heap[smallest].priority) < 0
      ) {
        smallest = rightChild
      }

      if (smallest === index) {
        break
      }

      [this.heap[index], this.heap[smallest]] = [this.heap[smallest], this.heap[index]]
      index = smallest
    }
  }
}

/**
 * Trie data structure for efficient string prefix matching
 */
export class Trie {
  private root: TrieNode = new TrieNode()

  insert(word: string): void {
    let node = this.root
    for (const char of word) {
      if (!node.children.has(char)) {
        node.children.set(char, new TrieNode())
      }
      node = node.children.get(char)!
    }
    node.isEndOfWord = true
    node.word = word
  }

  search(word: string): boolean {
    const node = this.searchNode(word)
    return node !== null && node.isEndOfWord
  }

  startsWith(prefix: string): boolean {
    return this.searchNode(prefix) !== null
  }

  getAllWithPrefix(prefix: string): string[] {
    const node = this.searchNode(prefix)
    if (!node) return []

    const results: string[] = []
    this.collectWords(node, results)
    return results
  }

  private searchNode(str: string): TrieNode | null {
    let node = this.root
    for (const char of str) {
      if (!node.children.has(char)) {
        return null
      }
      node = node.children.get(char)!
    }
    return node
  }

  private collectWords(node: TrieNode, results: string[]): void {
    if (node.isEndOfWord && node.word) {
      results.push(node.word)
    }
    for (const child of node.children.values()) {
      this.collectWords(child, results)
    }
  }
}

class TrieNode {
  children: Map<string, TrieNode> = new Map()
  isEndOfWord: boolean = false
  word?: string
}

/**
 * Time-based expiring cache
 */
export class ExpiringCache<K, V> {
  private cache: Map<K, { value: V; expiresAt: number }> = new Map()
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor(
    private defaultTTL: number = 60000, // 1 minute default
    cleanupIntervalMs: number = 10000 // 10 seconds default
  ) {
    this.startCleanup(cleanupIntervalMs)
  }

  set(key: K, value: V, ttl: number = this.defaultTTL): void {
    const expiresAt = Date.now() + ttl
    this.cache.set(key, { value, expiresAt })
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key)
    if (!entry) return undefined

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return undefined
    }

    return entry.value
  }

  has(key: K): boolean {
    return this.get(key) !== undefined
  }

  delete(key: K): boolean {
    return this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  get size(): number {
    this.cleanup()
    return this.cache.size
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key)
      }
    }
  }

  private startCleanup(intervalMs: number): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, intervalMs)
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.cache.clear()
  }
}

/**
 * Simple event emitter
 */
export class EventEmitter<T extends Record<string, any[]>> {
  private listeners = new Map<keyof T, Set<Function>>()
  private onceListeners = new Map<keyof T, Set<Function>>()

  on<K extends keyof T>(event: K, listener: (...args: T[K]) => void): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(listener)
    return this
  }

  once<K extends keyof T>(event: K, listener: (...args: T[K]) => void): this {
    if (!this.onceListeners.has(event)) {
      this.onceListeners.set(event, new Set())
    }
    this.onceListeners.get(event)!.add(listener)
    return this
  }

  off<K extends keyof T>(event: K, listener?: (...args: T[K]) => void): this {
    if (listener) {
      this.listeners.get(event)?.delete(listener)
      this.onceListeners.get(event)?.delete(listener)
    } else {
      this.listeners.delete(event)
      this.onceListeners.delete(event)
    }
    return this
  }

  emit<K extends keyof T>(event: K, ...args: T[K]): boolean {
    let handled = false

    // Regular listeners
    const listeners = this.listeners.get(event)
    if (listeners) {
      listeners.forEach(listener => {
        listener(...args)
        handled = true
      })
    }

    // Once listeners
    const onceListeners = this.onceListeners.get(event)
    if (onceListeners) {
      onceListeners.forEach(listener => {
        listener(...args)
        handled = true
      })
      this.onceListeners.delete(event)
    }

    return handled
  }

  removeAllListeners(): this {
    this.listeners.clear()
    this.onceListeners.clear()
    return this
  }

  listenerCount<K extends keyof T>(event: K): number {
    const regular = this.listeners.get(event)?.size || 0
    const once = this.onceListeners.get(event)?.size || 0
    return regular + once
  }
}

/**
 * Async queue for sequential processing
 */
export class AsyncQueue<T> {
  private queue: Array<() => Promise<T>> = []
  private processing = false
  private concurrency: number
  private running = 0

  constructor(concurrency: number = 1) {
    this.concurrency = concurrency
  }

  async add(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await task()
          resolve(result)
          return result
        } catch (error) {
          reject(error)
          throw error
        }
      })
      this.process()
    })
  }

  private async process(): Promise<void> {
    if (this.running >= this.concurrency) {
      return
    }

    const task = this.queue.shift()
    if (!task) {
      return
    }

    this.running++
    try {
      await task()
    } finally {
      this.running--
      this.process()
    }
  }

  get size(): number {
    return this.queue.length
  }

  get pending(): number {
    return this.running
  }

  clear(): void {
    this.queue = []
  }
}
