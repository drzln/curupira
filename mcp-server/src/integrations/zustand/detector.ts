/**
 * Zustand store detector
 * 
 * Detects Zustand stores in the target page
 */

import type { RuntimeDomain } from '../../chrome/domains/runtime.js'
import type { ZustandStoreInfo } from '@nexus/curupira-shared/types/state.js'
import { logger } from '../../config/logger.js'

export interface ZustandInfo {
  detected: boolean
  version?: string
  hasDevtools?: boolean
  storeCount?: number
  stores?: Array<{
    name: string
    hasDevtools: boolean
    hasPersist: boolean
    hasImmer: boolean
  }>
}

export class ZustandDetector {
  constructor(private runtime: RuntimeDomain) {}

  /**
   * Detect Zustand in the page
   */
  async detect(): Promise<ZustandInfo> {
    try {
      const result = await this.runtime.evaluate<ZustandInfo>(`
        (() => {
          // Initialize Zustand tracking if not present
          if (!window.__ZUSTAND_STORES__) {
            window.__ZUSTAND_STORES__ = new Map()
          }

          // Check for Zustand patterns
          const hasZustand = (() => {
            // Check for common Zustand globals
            if (window.zustand) return true
            
            // Check for store patterns in React components
            try {
              // Look for hooks that match Zustand patterns
              const hasUseStore = !!window.React && 
                Object.values(window).some(val => 
                  typeof val === 'function' && 
                  val.name && val.name.includes('useStore')
                )
              
              if (hasUseStore) return true
              
              // Check for Zustand in bundled code
              const scripts = Array.from(document.scripts)
              return scripts.some(script => 
                script.textContent && 
                (script.textContent.includes('zustand') || 
                 script.textContent.includes('create(') && 
                 script.textContent.includes('setState'))
              )
            } catch {
              return false
            }
          })()

          if (!hasZustand) {
            return { detected: false }
          }

          // Try to get store information
          const stores = []
          const devtools = window.__REDUX_DEVTOOLS_EXTENSION__
          
          // Check for stores registered with our tracking
          for (const [name, storeInfo] of window.__ZUSTAND_STORES__) {
            stores.push({
              name: storeInfo.name || name,
              hasDevtools: !!storeInfo.config?.devtools?.enabled,
              hasPersist: !!storeInfo.config?.persist,
              hasImmer: !!storeInfo.config?.immer
            })
          }

          // Check for Redux DevTools connections (Zustand can use these)
          if (devtools && devtools.instances) {
            const zustandInstances = Array.from(devtools.instances)
              .filter(([_, instance]) => 
                instance.name && instance.name.toLowerCase().includes('zustand')
              )
            
            zustandInstances.forEach(([_, instance]) => {
              if (!stores.find(s => s.name === instance.name)) {
                stores.push({
                  name: instance.name,
                  hasDevtools: true,
                  hasPersist: false,
                  hasImmer: false
                })
              }
            })
          }

          return {
            detected: true,
            version: 'unknown', // Zustand doesn't expose version easily
            hasDevtools: !!devtools,
            storeCount: stores.length,
            stores
          }
        })()
      `)

      if (result.error || !result.value) {
        return { detected: false }
      }

      return result.value
    } catch (error) {
      logger.error('Zustand detection failed', error)
      return { detected: false }
    }
  }

  /**
   * Install Zustand store tracking
   */
  async installTracking(): Promise<boolean> {
    const result = await this.runtime.evaluate<boolean>(`
      (() => {
        // Initialize store registry
        if (!window.__ZUSTAND_STORES__) {
          window.__ZUSTAND_STORES__ = new Map()
        }

        if (!window.__CURUPIRA_BRIDGE__) {
          window.__CURUPIRA_BRIDGE__ = {}
        }

        // Function to register Zustand stores
        window.__CURUPIRA_BRIDGE__.registerZustandStore = function(id, info) {
          window.__ZUSTAND_STORES__.set(id, info)
          
          // Hook into store subscriptions
          if (info.store) {
            const originalSubscribe = info.store.subscribe
            const subscribers = info.subscribers || new Set()
            
            info.store.subscribe = function(listener) {
              subscribers.add(listener)
              info.subscribers = subscribers
              
              // Track state changes
              const wrappedListener = (state, prevState) => {
                // Store state change
                if (!info.history) info.history = []
                info.history.push({
                  id: 'change_' + Date.now(),
                  timestamp: Date.now(),
                  prevState,
                  nextState: state
                })
                
                // Keep only last 100 changes
                if (info.history.length > 100) {
                  info.history = info.history.slice(-100)
                }
                
                // Call original listener
                listener(state, prevState)
                
                // Emit event for monitoring
                window.dispatchEvent(new CustomEvent('curupira:zustand:change', {
                  detail: { storeId: id, state, prevState }
                }))
              }
              
              return originalSubscribe.call(this, wrappedListener)
            }
          }
        }

        // Try to hook into existing stores
        // This is framework-specific and may need adjustment
        console.log('Zustand tracking installed by Curupira')
        
        return true
      })()
    `)

    return result.value === true
  }

  /**
   * Find and register stores automatically
   */
  async findStores(): Promise<number> {
    const result = await this.runtime.evaluate<number>(`
      (() => {
        let foundCount = 0
        
        // Strategy 1: Check React DevTools for hooks
        if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
          // This would need to traverse fiber tree
          // looking for Zustand hooks
        }
        
        // Strategy 2: Check for common store patterns
        const checkObject = (obj, path = '') => {
          if (!obj || typeof obj !== 'object') return
          
          // Check if this looks like a Zustand store
          if (typeof obj.getState === 'function' && 
              typeof obj.setState === 'function' && 
              typeof obj.subscribe === 'function') {
            
            const storeName = path || 'store_' + foundCount
            window.__CURUPIRA_BRIDGE__.registerZustandStore(storeName, {
              name: storeName,
              store: obj,
              config: {}
            })
            foundCount++
          }
          
          // Recurse into properties (with depth limit)
          if (path.split('.').length < 3) {
            try {
              Object.keys(obj).forEach(key => {
                if (key !== 'window' && key !== 'document') {
                  checkObject(obj[key], path ? path + '.' + key : key)
                }
              })
            } catch {}
          }
        }
        
        // Check window object
        checkObject(window)
        
        // Check for stores in common locations
        ['store', 'useStore', 'appStore', 'globalStore'].forEach(name => {
          if (window[name]) {
            checkObject(window[name], name)
          }
        })
        
        return foundCount
      })()
    `)

    return result.value || 0
  }

  /**
   * Get all registered stores
   */
  async getStores(): Promise<Array<{
    id: string
    name: string
    state: unknown
    subscriberCount: number
  }>> {
    const result = await this.runtime.evaluate<any[]>(`
      (() => {
        if (!window.__ZUSTAND_STORES__) return []
        
        const stores = []
        for (const [id, info] of window.__ZUSTAND_STORES__) {
          stores.push({
            id,
            name: info.name || id,
            state: info.store?.getState?.() || null,
            subscriberCount: info.subscribers?.size || 0
          })
        }
        
        return stores
      })()
    `)

    return result.value || []
  }
}