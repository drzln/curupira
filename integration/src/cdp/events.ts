/**
 * @fileoverview CDP event helpers
 */

import type { CdpEvent } from './types.js'

/**
 * Event filter function
 */
export type EventFilter = (event: CdpEvent) => boolean

/**
 * Create event filter by method
 */
export function filterByMethod(method: string | RegExp): EventFilter {
  if (typeof method === 'string') {
    return (event: CdpEvent) => event.method === method
  }
  return (event: CdpEvent) => method.test(event.method)
}

/**
 * Create event filter by domain
 */
export function filterByDomain(domain: string): EventFilter {
  return (event: CdpEvent) => event.method.startsWith(`${domain}.`)
}

/**
 * Create event filter by session
 */
export function filterBySession(sessionId: string): EventFilter {
  return (event: CdpEvent) => event.sessionId === sessionId
}

/**
 * Combine event filters with AND logic
 */
export function combineFilters(...filters: EventFilter[]): EventFilter {
  return (event: CdpEvent) => filters.every(filter => filter(event))
}

/**
 * Create event buffer with filtering
 */
export class EventBuffer {
  private readonly events: CdpEvent[] = []
  private readonly maxSize: number

  constructor(maxSize = 1000) {
    this.maxSize = maxSize
  }

  /**
   * Add event to buffer
   */
  add(event: CdpEvent): void {
    this.events.push(event)
    if (this.events.length > this.maxSize) {
      this.events.shift()
    }
  }

  /**
   * Get filtered events
   */
  getFiltered(filter: EventFilter): CdpEvent[] {
    return this.events.filter(filter)
  }

  /**
   * Get all events
   */
  getAll(): ReadonlyArray<CdpEvent> {
    return [...this.events]
  }

  /**
   * Clear buffer
   */
  clear(): void {
    this.events.length = 0
  }

  /**
   * Get size
   */
  size(): number {
    return this.events.length
  }
}