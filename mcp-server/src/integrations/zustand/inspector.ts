/**
 * Zustand store inspector
 * 
 * Provides inspection capabilities for Zustand stores
 */

import type { RuntimeDomain } from '../../chrome/domains/runtime.js'
import type { 
  ZustandStore,
  ZustandStoreInfo,
  ZustandStateChange,
  StoreId
} from '@curupira/shared/types/index.js'
import { CircularBuffer } from '@curupira/shared/utils'
import { logger } from '../../config/logger.js'

export interface StoreInspection<T = unknown> {
  store: {
    id: StoreId
    name: string
    subscriberCount: number
    config: {
      devtools?: boolean
      persist?: boolean
      immer?: boolean
    }
  }
  state: T
  history: ZustandStateChange<T>[]
}

export class ZustandInspector {
  private changeBuffer: CircularBuffer<ZustandStateChange>

  constructor(
    private runtime: RuntimeDomain,
    bufferSize = 500
  ) {
    this.changeBuffer = new CircularBuffer(bufferSize)
  }

  /**
   * Get all stores
   */
  async getStores(): Promise<StoreInspection[]> {
    const result = await this.runtime.evaluate<any[]>(`
      (() => {
        if (!window.__ZUSTAND_STORES__) return []
        
        const stores = []
        for (const [id, info] of window.__ZUSTAND_STORES__) {
          const inspection = {
            store: {
              id,
              name: info.name || id,
              subscriberCount: info.subscribers?.size || 0,
              config: {
                devtools: info.config?.devtools?.enabled || false,
                persist: !!info.config?.persist,
                immer: !!info.config?.immer
              }
            },
            state: info.store?.getState?.() || {},
            history: info.history || []
          }
          stores.push(inspection)
        }
        
        return stores
      })()
    `)

    return result.value || []
  }

  /**
   * Get a specific store
   */
  async getStore<T = unknown>(storeId: StoreId): Promise<StoreInspection<T> | null> {
    const stores = await this.getStores()
    return stores.find(s => s.store.id === storeId) as StoreInspection<T> || null
  }

  /**
   * Get store state
   */
  async getState<T = unknown>(storeId: StoreId): Promise<T | null> {
    const result = await this.runtime.evaluate<T>(`
      (() => {
        const info = window.__ZUSTAND_STORES__?.get(${JSON.stringify(storeId)})
        return info?.store?.getState?.() || null
      })()
    `)

    return result.value || null
  }

  /**
   * Set store state
   */
  async setState<T = unknown>(
    storeId: StoreId,
    partial: Partial<T> | ((state: T) => Partial<T>),
    replace = false
  ): Promise<boolean> {
    const result = await this.runtime.evaluate<boolean>(`
      (() => {
        const info = window.__ZUSTAND_STORES__?.get(${JSON.stringify(storeId)})
        if (!info?.store?.setState) return false
        
        try {
          const partial = ${JSON.stringify(partial)}
          info.store.setState(partial, ${replace})
          return true
        } catch (error) {
          console.error('Failed to set state:', error)
          return false
        }
      })()
    `)

    return result.value === true
  }

  /**
   * Get state history
   */
  async getHistory<T = unknown>(
    storeId: StoreId,
    limit = 50
  ): Promise<ZustandStateChange<T>[]> {
    const result = await this.runtime.evaluate<any[]>(`
      (() => {
        const info = window.__ZUSTAND_STORES__?.get(${JSON.stringify(storeId)})
        if (!info?.history) return []
        
        return info.history.slice(-${limit})
      })()
    `)

    return result.value || []
  }

  /**
   * Subscribe to store changes
   */
  async subscribe<T = unknown>(
    storeId: StoreId,
    callback: (state: T, prevState: T) => void
  ): Promise<() => void> {
    // Set up listener in page
    await this.runtime.evaluate(`
      (() => {
        window.__CURUPIRA_SUBSCRIPTIONS__ = window.__CURUPIRA_SUBSCRIPTIONS__ || new Map()
        
        const handler = (event) => {
          if (event.detail.storeId === ${JSON.stringify(storeId)}) {
            // Store for retrieval
            window.__CURUPIRA_SUBSCRIPTIONS__.set(${JSON.stringify(storeId)}, {
              state: event.detail.state,
              prevState: event.detail.prevState
            })
          }
        }
        
        window.addEventListener('curupira:zustand:change', handler)
        
        // Store handler for cleanup
        window.__CURUPIRA_SUBSCRIPTIONS__.set(${JSON.stringify(storeId)} + '_handler', handler)
      })()
    `)

    // Poll for changes
    const interval = setInterval(async () => {
      const result = await this.runtime.evaluate<{ state: T; prevState: T }>(`
        (() => {
          const data = window.__CURUPIRA_SUBSCRIPTIONS__?.get(${JSON.stringify(storeId)})
          if (data) {
            window.__CURUPIRA_SUBSCRIPTIONS__.delete(${JSON.stringify(storeId)})
            return data
          }
          return null
        })()
      `)
      
      if (result.value) {
        callback(result.value.state, result.value.prevState)
      }
    }, 100)

    // Return cleanup function
    return () => {
      clearInterval(interval)
      this.runtime.evaluate(`
        (() => {
          const handler = window.__CURUPIRA_SUBSCRIPTIONS__?.get(${JSON.stringify(storeId)} + '_handler')
          if (handler) {
            window.removeEventListener('curupira:zustand:change', handler)
            window.__CURUPIRA_SUBSCRIPTIONS__.delete(${JSON.stringify(storeId)} + '_handler')
          }
        })()
      `)
    }
  }

  /**
   * Time travel to previous state
   */
  async timeTravel<T = unknown>(
    storeId: StoreId,
    historyIndex: number
  ): Promise<boolean> {
    const result = await this.runtime.evaluate<boolean>(`
      (() => {
        const info = window.__ZUSTAND_STORES__?.get(${JSON.stringify(storeId)})
        if (!info?.store?.setState || !info?.history) return false
        
        const change = info.history[${historyIndex}]
        if (!change) return false
        
        try {
          info.store.setState(change.prevState, true)
          return true
        } catch (error) {
          console.error('Failed to time travel:', error)
          return false
        }
      })()
    `)

    return result.value === true
  }

  /**
   * Get store selectors (if using selector pattern)
   */
  async getSelectors(storeId: StoreId): Promise<string[]> {
    const result = await this.runtime.evaluate<string[]>(`
      (() => {
        const info = window.__ZUSTAND_STORES__?.get(${JSON.stringify(storeId)})
        if (!info?.store) return []
        
        // Try to find selector functions
        const selectors = []
        const store = info.store
        
        // Check for common selector patterns
        if (store.selectors) {
          selectors.push(...Object.keys(store.selectors))
        }
        
        // Check for getter functions
        const state = store.getState()
        if (state && typeof state === 'object') {
          Object.keys(state).forEach(key => {
            if (typeof state[key] === 'function') {
              selectors.push(key)
            }
          })
        }
        
        return selectors
      })()
    `)

    return result.value || []
  }

  /**
   * Log store to console
   */
  async logStore(storeId: StoreId): Promise<void> {
    const inspection = await this.getStore(storeId)
    if (!inspection) return

    await this.runtime.evaluate(`
      (() => {
        console.group('🐻 Zustand Store Inspector')
        console.log('Store:', ${JSON.stringify(inspection.store.name)})
        console.log('ID:', ${JSON.stringify(storeId)})
        console.log('Subscribers:', ${inspection.store.subscriberCount})
        console.log('Current State:', ${JSON.stringify(inspection.state)})
        
        if (${inspection.store.config.devtools}) {
          console.log('DevTools:', 'Enabled')
        }
        if (${inspection.store.config.persist}) {
          console.log('Persistence:', 'Enabled')
        }
        if (${inspection.store.config.immer}) {
          console.log('Immer:', 'Enabled')
        }
        
        if (${inspection.history.length > 0}) {
          console.group('Recent Changes:')
          ${JSON.stringify(inspection.history.slice(-5))}.forEach((change, i) => {
            console.log(\`Change \${i + 1}:\`, change)
          })
          console.groupEnd()
        }
        
        console.groupEnd()
      })()
    `)
  }

  /**
   * Compare states
   */
  async compareStates<T = unknown>(
    storeId: StoreId,
    stateA: T,
    stateB: T
  ): Promise<{
    added: string[]
    removed: string[]
    changed: Array<{
      path: string
      oldValue: unknown
      newValue: unknown
    }>
  }> {
    const result = await this.runtime.evaluate<any>(`
      (() => {
        const stateA = ${JSON.stringify(stateA)}
        const stateB = ${JSON.stringify(stateB)}
        
        const changes = {
          added: [],
          removed: [],
          changed: []
        }
        
        function diff(obj1, obj2, path = '') {
          const keys1 = Object.keys(obj1 || {})
          const keys2 = Object.keys(obj2 || {})
          
          keys1.forEach(key => {
            if (!keys2.includes(key)) {
              changes.removed.push(path + key)
            } else if (obj1[key] !== obj2[key]) {
              if (typeof obj1[key] === 'object' && typeof obj2[key] === 'object') {
                diff(obj1[key], obj2[key], path + key + '.')
              } else {
                changes.changed.push({
                  path: path + key,
                  oldValue: obj1[key],
                  newValue: obj2[key]
                })
              }
            }
          })
          
          keys2.forEach(key => {
            if (!keys1.includes(key)) {
              changes.added.push(path + key)
            }
          })
        }
        
        diff(stateA, stateB)
        return changes
      })()
    `)

    return result.value || { added: [], removed: [], changed: [] }
  }

  /**
   * Export store state
   */
  async exportState(storeId: StoreId): Promise<{
    store: string
    state: unknown
    timestamp: number
  }> {
    const state = await this.getState(storeId)
    return {
      store: storeId,
      state,
      timestamp: Date.now()
    }
  }

  /**
   * Import store state
   */
  async importState<T = unknown>(
    storeId: StoreId,
    state: T
  ): Promise<boolean> {
    return this.setState(storeId, state as any, true)
  }
}