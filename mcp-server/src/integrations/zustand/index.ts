/**
 * Zustand integration index
 * 
 * Main entry point for Zustand store debugging
 */

import type { RuntimeDomain } from '../../chrome/domains/runtime.js'
import type { 
  ZustandStore,
  ZustandStoreInfo,
  ZustandStateChange,
  StoreId
} from '@curupira/shared/types/index.js'
import { ZustandDetector, type ZustandInfo } from './detector.js'
import { ZustandInspector, type StoreInspection } from './inspector.js'
import { logger } from '../../config/logger.js'

export interface ZustandIntegration {
  // Detection
  detect(): Promise<ZustandInfo>
  isZustandDetected(): boolean
  findStores(): Promise<number>

  // Stores
  getStores(): Promise<StoreInspection[]>
  getStore<T = unknown>(storeId: string): Promise<StoreInspection<T> | null>
  
  // State management
  getState<T = unknown>(storeId: string): Promise<T | null>
  setState<T = unknown>(storeId: string, partial: Partial<T> | ((state: T) => Partial<T>), replace?: boolean): Promise<boolean>
  
  // History
  getHistory<T = unknown>(storeId: string, limit?: number): Promise<ZustandStateChange<T>[]>
  timeTravel<T = unknown>(storeId: string, historyIndex: number): Promise<boolean>
  
  // Monitoring
  subscribe<T = unknown>(storeId: string, callback: (state: T, prevState: T) => void): Promise<() => void>
  
  // Analysis
  getSelectors(storeId: string): Promise<string[]>
  compareStates<T = unknown>(storeId: string, stateA: T, stateB: T): Promise<{
    added: string[]
    removed: string[]
    changed: Array<{ path: string; oldValue: unknown; newValue: unknown }>
  }>
  
  // Import/Export
  exportState(storeId: string): Promise<{ store: string; state: unknown; timestamp: number }>
  importState<T = unknown>(storeId: string, state: T): Promise<boolean>
  
  // Actions
  logStore(storeId: string): Promise<void>
}

export class ZustandIntegrationImpl implements ZustandIntegration {
  private detector: ZustandDetector
  private inspector: ZustandInspector
  private zustandInfo?: ZustandInfo

  constructor(private runtime: RuntimeDomain) {
    this.detector = new ZustandDetector(runtime)
    this.inspector = new ZustandInspector(runtime)
  }

  /**
   * Initialize the integration
   */
  async initialize(): Promise<void> {
    try {
      // Detect Zustand
      this.zustandInfo = await this.detector.detect()
      
      if (this.zustandInfo.detected) {
        logger.info('Zustand detected', {
          version: this.zustandInfo.version,
          hasDevtools: this.zustandInfo.hasDevtools,
          storeCount: this.zustandInfo.storeCount
        })

        // Install tracking
        const installed = await this.detector.installTracking()
        if (installed) {
          logger.info('Zustand tracking installed')
          
          // Try to find stores
          const foundCount = await this.detector.findStores()
          if (foundCount > 0) {
            logger.info(`Found ${foundCount} Zustand stores`)
            // Re-detect with stores found
            this.zustandInfo = await this.detector.detect()
          }
        }
      } else {
        logger.info('Zustand not detected on page')
      }
    } catch (error) {
      logger.error('Zustand integration initialization failed', error)
    }
  }

  // Detection methods
  async detect(): Promise<ZustandInfo> {
    this.zustandInfo = await this.detector.detect()
    return this.zustandInfo
  }

  isZustandDetected(): boolean {
    return this.zustandInfo?.detected || false
  }

  async findStores(): Promise<number> {
    if (!this.isZustandDetected()) {
      return 0
    }
    return this.detector.findStores()
  }

  // Store methods
  async getStores(): Promise<StoreInspection[]> {
    if (!this.isZustandDetected()) {
      return []
    }
    return this.inspector.getStores()
  }

  async getStore<T = unknown>(storeId: string): Promise<StoreInspection<T> | null> {
    if (!this.isZustandDetected()) {
      return null
    }
    return this.inspector.getStore<T>(storeId as StoreId)
  }

  // State management methods
  async getState<T = unknown>(storeId: string): Promise<T | null> {
    if (!this.isZustandDetected()) {
      return null
    }
    return this.inspector.getState<T>(storeId as StoreId)
  }

  async setState<T = unknown>(
    storeId: string,
    partial: Partial<T> | ((state: T) => Partial<T>),
    replace = false
  ): Promise<boolean> {
    if (!this.isZustandDetected()) {
      return false
    }
    return this.inspector.setState(storeId as StoreId, partial, replace)
  }

  // History methods
  async getHistory<T = unknown>(
    storeId: string,
    limit?: number
  ): Promise<ZustandStateChange<T>[]> {
    if (!this.isZustandDetected()) {
      return []
    }
    return this.inspector.getHistory<T>(storeId as StoreId, limit)
  }

  async timeTravel<T = unknown>(
    storeId: string,
    historyIndex: number
  ): Promise<boolean> {
    if (!this.isZustandDetected()) {
      return false
    }
    return this.inspector.timeTravel<T>(storeId as StoreId, historyIndex)
  }

  // Monitoring methods
  async subscribe<T = unknown>(
    storeId: string,
    callback: (state: T, prevState: T) => void
  ): Promise<() => void> {
    if (!this.isZustandDetected()) {
      return () => {} // No-op cleanup
    }
    return this.inspector.subscribe<T>(storeId as StoreId, callback)
  }

  // Analysis methods
  async getSelectors(storeId: string): Promise<string[]> {
    if (!this.isZustandDetected()) {
      return []
    }
    return this.inspector.getSelectors(storeId as StoreId)
  }

  async compareStates<T = unknown>(
    storeId: string,
    stateA: T,
    stateB: T
  ): Promise<{
    added: string[]
    removed: string[]
    changed: Array<{ path: string; oldValue: unknown; newValue: unknown }>
  }> {
    if (!this.isZustandDetected()) {
      return { added: [], removed: [], changed: [] }
    }
    return this.inspector.compareStates(storeId as StoreId, stateA, stateB)
  }

  // Import/Export methods
  async exportState(storeId: string): Promise<{
    store: string
    state: unknown
    timestamp: number
  }> {
    if (!this.isZustandDetected()) {
      return { store: storeId, state: null, timestamp: Date.now() }
    }
    return this.inspector.exportState(storeId as StoreId)
  }

  async importState<T = unknown>(
    storeId: string,
    state: T
  ): Promise<boolean> {
    if (!this.isZustandDetected()) {
      return false
    }
    return this.inspector.importState(storeId as StoreId, state)
  }

  // Action methods
  async logStore(storeId: string): Promise<void> {
    if (!this.isZustandDetected()) {
      return
    }
    await this.inspector.logStore(storeId as StoreId)
  }

  /**
   * Create a new Zustand store (for testing)
   */
  async createStore<T extends Record<string, unknown>>(
    name: string,
    initialState: T
  ): Promise<string | null> {
    if (!this.isZustandDetected()) {
      return null
    }

    const result = await this.runtime.evaluate<string>(`
      (() => {
        // Check if we have a Zustand create function
        if (!window.zustand?.create && !window.create) {
          console.error('Zustand create function not found')
          return null
        }

        const create = window.zustand?.create || window.create
        
        try {
          // Create store
          const store = create(() => (${JSON.stringify(initialState)}))
          
          // Register with our tracking
          const storeId = ${JSON.stringify(name)}
          window.__CURUPIRA_BRIDGE__.registerZustandStore(storeId, {
            name: storeId,
            store,
            config: {}
          })
          
          // Make available globally for testing
          window[storeId] = store
          
          return storeId
        } catch (error) {
          console.error('Failed to create store:', error)
          return null
        }
      })()
    `)

    return result.value || null
  }

  /**
   * Connect store to Redux DevTools
   */
  async connectToDevTools(storeId: string): Promise<boolean> {
    if (!this.isZustandDetected()) {
      return false
    }

    const result = await this.runtime.evaluate<boolean>(`
      (() => {
        const info = window.__ZUSTAND_STORES__?.get(${JSON.stringify(storeId)})
        if (!info?.store) return false

        const devtools = window.__REDUX_DEVTOOLS_EXTENSION__
        if (!devtools) {
          console.error('Redux DevTools not found')
          return false
        }

        try {
          const connection = devtools.connect({
            name: info.name || ${JSON.stringify(storeId)}
          })

          // Send initial state
          connection.init(info.store.getState())

          // Subscribe to changes
          info.store.subscribe((state, prevState) => {
            connection.send({ type: 'STATE_CHANGE', state }, state)
          })

          return true
        } catch (error) {
          console.error('Failed to connect to DevTools:', error)
          return false
        }
      })()
    `)

    return result.value === true
  }
}

// Factory function
export function createZustandIntegration(runtime: RuntimeDomain): ZustandIntegration {
  const integration = new ZustandIntegrationImpl(runtime)
  // Auto-initialize on creation
  integration.initialize().catch(error => {
    logger.error('Failed to initialize Zustand integration', error)
  })
  return integration
}