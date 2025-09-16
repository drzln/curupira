/**
 * Chrome DevTools Protocol Type Definitions
 * Complete type safety for CDP operations
 */

// Re-export all CDP domains
export * from './runtime.js'
export * from './page.js'
export * from './dom.js'
export * from './network.js'
export * from './debugger.js'
export * from './console.js'
export * from './performance.js'
export * from './input.js'
export * from './profiler.js'

// Common types used across domains
export interface CDPSession {
  id: string
  sessionId: string
  targetId: string
  targetType: 'page' | 'iframe' | 'worker' | 'service_worker' | 'other'
}

export interface CDPError {
  code: number
  message: string
  data?: any
}

export interface CDPEvent<T = any> {
  method: string
  params: T
  sessionId?: string
}