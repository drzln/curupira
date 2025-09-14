/**
 * @fileoverview Message queue implementation
 */

import type {
  Message,
  MessageQueueItem
} from './types.js'
import type { Timestamp } from '@curupira/shared'

/**
 * Message queue
 */
export class MessageQueue {
  private readonly items: MessageQueueItem[] = []
  private readonly maxSize: number

  constructor(maxSize = 1000) {
    this.maxSize = maxSize
  }

  /**
   * Enqueue message
   */
  enqueue(message: Message): boolean {
    if (this.items.length >= this.maxSize) {
      return false
    }

    this.items.push({
      message,
      retries: 0,
      added: Date.now() as Timestamp
    })

    return true
  }

  /**
   * Dequeue message
   */
  dequeue(): MessageQueueItem | undefined {
    const item = this.items.shift()
    
    if (item) {
      item.lastAttempt = Date.now() as Timestamp
      item.retries++
    }
    
    return item
  }

  /**
   * Peek at next message
   */
  peek(): MessageQueueItem | undefined {
    return this.items[0]
  }

  /**
   * Get queue size
   */
  size(): number {
    return this.items.length
  }

  /**
   * Check if empty
   */
  isEmpty(): boolean {
    return this.items.length === 0
  }

  /**
   * Check if full
   */
  isFull(): boolean {
    return this.items.length >= this.maxSize
  }

  /**
   * Clear queue
   */
  clear(): void {
    this.items.length = 0
  }

  /**
   * Get all items
   */
  getAll(): ReadonlyArray<MessageQueueItem> {
    return [...this.items]
  }

  /**
   * Remove expired items
   */
  removeExpired(ttl: number): number {
    const now = Date.now()
    const before = this.items.length
    
    this.items.splice(0, this.items.length, 
      ...this.items.filter(item => {
        const age = now - item.added
        return age < ttl
      })
    )
    
    return before - this.items.length
  }

  /**
   * Requeue item
   */
  requeue(item: MessageQueueItem): boolean {
    if (this.items.length >= this.maxSize) {
      return false
    }

    // Add to end of queue
    this.items.push(item)
    return true
  }

  /**
   * Get statistics
   */
  getStatistics() {
    const now = Date.now()
    const ages = this.items.map(item => now - item.added)
    const retries = this.items.map(item => item.retries)
    
    return {
      size: this.items.length,
      maxSize: this.maxSize,
      oldestAge: ages.length > 0 ? Math.max(...ages) : 0,
      newestAge: ages.length > 0 ? Math.min(...ages) : 0,
      avgAge: ages.length > 0 ? ages.reduce((a, b) => a + b, 0) / ages.length : 0,
      maxRetries: retries.length > 0 ? Math.max(...retries) : 0,
      avgRetries: retries.length > 0 ? retries.reduce((a, b) => a + b, 0) / retries.length : 0
    }
  }
}