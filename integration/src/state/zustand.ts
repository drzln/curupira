/**
 * @fileoverview Zustand DevTools integration
 */

import { EventEmitter } from 'events'
import { createLogger, type Logger } from '@curupira/shared'

/**
 * Zustand store interface
 */
export interface ZustandStore {
  id: string
  name: string
  state: any
  actions: string[]
  subscribers: number
  isDevtoolsEnabled: boolean
  version: number
  config: {
    name?: string
    serialize?: boolean
    devtools?: boolean
  }
}

/**
 * Zustand action interface
 */
export interface ZustandAction {
  id: string
  storeId: string
  type: string
  payload?: any
  timestamp: number
  state: {
    before: any
    after: any
  }
  trace?: string[]
}

/**
 * Zustand state change interface
 */
export interface ZustandStateChange {
  storeId: string
  previous: any
  current: any
  timestamp: number
  action?: {
    type: string
    payload?: any
  }
}

/**
 * Zustand DevTools events
 */
export interface ZustandDevToolsEvents {
  'store.register': (store: ZustandStore) => void
  'store.unregister': (storeId: string) => void
  'store.update': (store: ZustandStore) => void
  'state.change': (change: ZustandStateChange) => void
  'action.dispatch': (action: ZustandAction) => void
  'subscriber.add': (storeId: string, count: number) => void
  'subscriber.remove': (storeId: string, count: number) => void
  'error': (error: Error) => void
}

/**
 * Zustand DevTools configuration
 */
export interface ZustandDevToolsConfig {
  enableTimeTravel?: boolean
  maxHistorySize?: number
  filterActions?: (action: ZustandAction) => boolean
  sanitizeState?: (state: any) => any
  traceActions?: boolean
  debugMode?: boolean
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: ZustandDevToolsConfig = {
  enableTimeTravel: true,
  maxHistorySize: 100,
  filterActions: () => true,
  sanitizeState: (state) => state,
  traceActions: false,
  debugMode: false,
}

/**
 * Zustand DevTools integration
 */
export class ZustandDevTools extends EventEmitter<ZustandDevToolsEvents> {
  private readonly logger: Logger
  private readonly config: ZustandDevToolsConfig
  private readonly stores = new Map<string, ZustandStore>()
  private readonly storeInstances = new Map<string, any>()
  private readonly actionHistory: ZustandAction[] = []
  private isConnected = false
  private devtoolsExtension?: any
  private actionId = 0

  constructor(config: ZustandDevToolsConfig = {}) {
    super()
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.logger = createLogger({ 
      level: this.config.debugMode ? 'debug' : 'info' 
    })
  }

  /**
   * Connect to Zustand stores
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      return
    }

    try {
      // Check for Redux DevTools Extension
      this.devtoolsExtension = (globalThis as any).__REDUX_DEVTOOLS_EXTENSION__
      
      // Hook into Zustand create function
      this.setupZustandHooks()
      
      // Discover existing stores
      await this.discoverExistingStores()
      
      this.isConnected = true
      this.logger.info('Zustand DevTools connected')
      
    } catch (error) {
      this.logger.error({ error }, 'Failed to connect to Zustand DevTools')
      this.emit('error', error instanceof Error ? error : new Error(String(error)))
      throw error
    }
  }

  /**
   * Disconnect from Zustand stores
   */
  disconnect(): void {
    if (!this.isConnected) {
      return
    }

    this.cleanupHooks()
    this.stores.clear()
    this.storeInstances.clear()
    this.actionHistory.length = 0
    this.isConnected = false
    
    this.logger.info('Zustand DevTools disconnected')
  }

  /**
   * Get all registered stores
   */
  getStores(): ZustandStore[] {
    return Array.from(this.stores.values())
  }

  /**
   * Get store by ID
   */
  getStore(storeId: string): ZustandStore | undefined {
    return this.stores.get(storeId)
  }

  /**
   * Get store state
   */
  getStoreState(storeId: string): any {
    const storeInstance = this.storeInstances.get(storeId)
    if (!storeInstance) {
      throw new Error(`Store not found: ${storeId}`)
    }
    
    return storeInstance.getState?.() || storeInstance.getInitialState?.()
  }

  /**
   * Update store state
   */
  updateStoreState(storeId: string, newState: any): void {
    const storeInstance = this.storeInstances.get(storeId)
    if (!storeInstance) {
      throw new Error(`Store not found: ${storeId}`)
    }

    const previousState = this.getStoreState(storeId)
    
    // Update state
    if (storeInstance.setState) {
      storeInstance.setState(newState, true) // Replace state completely
    }

    // Create action for DevTools
    const action: ZustandAction = {
      id: this.generateActionId(),
      storeId,
      type: 'DEVTOOLS_UPDATE',
      payload: newState,
      timestamp: Date.now(),
      state: {
        before: previousState,
        after: newState
      },
      trace: this.config.traceActions ? this.captureStackTrace() : undefined
    }

    this.recordAction(action)
  }

  /**
   * Dispatch action to store
   */
  dispatchAction(storeId: string, actionType: string, payload?: any): void {
    const storeInstance = this.storeInstances.get(storeId)
    if (!storeInstance) {
      throw new Error(`Store not found: ${storeId}`)
    }

    const previousState = this.getStoreState(storeId)

    // Try to find and call the action function
    const currentState = storeInstance.getState()
    if (currentState && typeof currentState[actionType] === 'function') {
      currentState[actionType](payload)
    }

    const newState = this.getStoreState(storeId)

    // Create action record
    const action: ZustandAction = {
      id: this.generateActionId(),
      storeId,
      type: actionType,
      payload,
      timestamp: Date.now(),
      state: {
        before: previousState,
        after: newState
      },
      trace: this.config.traceActions ? this.captureStackTrace() : undefined
    }

    this.recordAction(action)
  }

  /**
   * Get action history
   */
  getActionHistory(storeId?: string): ZustandAction[] {
    if (storeId) {
      return this.actionHistory.filter(action => action.storeId === storeId)
    }
    return [...this.actionHistory]
  }

  /**
   * Clear action history
   */
  clearActionHistory(): void {
    this.actionHistory.length = 0
  }

  /**
   * Time travel to specific action
   */
  timeTravel(actionId: string): void {
    if (!this.config.enableTimeTravel) {
      throw new Error('Time travel is not enabled')
    }

    const actionIndex = this.actionHistory.findIndex(a => a.id === actionId)
    if (actionIndex === -1) {
      throw new Error(`Action not found: ${actionId}`)
    }

    const action = this.actionHistory[actionIndex]
    this.updateStoreState(action.storeId, action.state.before)
  }

  /**
   * Setup Zustand hooks
   */
  private setupZustandHooks(): void {
    // Hook into global zustand create function if available
    const zustand = (globalThis as any).zustand
    if (zustand && zustand.create) {
      this.hookZustandCreate(zustand)
    }

    // Also check for create function in window scope
    const create = (globalThis as any).create
    if (create && typeof create === 'function') {
      this.hookCreateFunction()
    }

    this.logger.debug('Zustand hooks setup complete')
  }

  /**
   * Hook Zustand create function
   */
  private hookZustandCreate(zustand: any): void {
    const originalCreate = zustand.create
    
    zustand.create = (...args: any[]) => {
      const store = originalCreate.apply(zustand, args)
      this.registerStore(store, args[0])
      return store
    }
  }

  /**
   * Hook standalone create function
   */
  private hookCreateFunction(): void {
    const originalCreate = (globalThis as any).create
    
    ;(globalThis as any).create = (...args: any[]) => {
      const store = originalCreate.apply(globalThis, args)
      this.registerStore(store, args[0])
      return store
    }
  }

  /**
   * Register a Zustand store
   */
  private registerStore(store: any, config?: any): void {
    const storeId = this.generateStoreId()
    const storeName = config?.name || `Store_${storeId}`

    // Extract actions from store state
    const initialState = store.getState?.() || {}
    const actions = Object.keys(initialState).filter(key => 
      typeof initialState[key] === 'function'
    )

    const zustandStore: ZustandStore = {
      id: storeId,
      name: storeName,
      state: this.config.sanitizeState!(initialState),
      actions,
      subscribers: 0,
      isDevtoolsEnabled: !!config?.devtools,
      version: 0,
      config: {
        name: config?.name,
        serialize: config?.serialize,
        devtools: config?.devtools
      }
    }

    this.stores.set(storeId, zustandStore)
    this.storeInstances.set(storeId, store)

    // Hook into store subscribe
    this.hookStoreSubscribe(store, storeId)

    // Setup DevTools connection if enabled
    if (zustandStore.isDevtoolsEnabled && this.devtoolsExtension) {
      this.setupStoreDevTools(store, storeId, storeName)
    }

    this.emit('store.register', zustandStore)
    this.logger.debug({ storeId, storeName }, 'Zustand store registered')
  }

  /**
   * Hook store subscribe method
   */
  private hookStoreSubscribe(store: any, storeId: string): void {
    if (!store.subscribe) return

    const originalSubscribe = store.subscribe
    
    store.subscribe = (listener: any, ...args: any[]) => {
      const unsubscribe = originalSubscribe.call(store, (newState: any, prevState: any) => {
        // Track state changes
        this.handleStateChange(storeId, prevState, newState)
        
        // Call original listener
        listener(newState, prevState)
      }, ...args)

      // Track subscriber count
      const zustandStore = this.stores.get(storeId)
      if (zustandStore) {
        zustandStore.subscribers++
        this.emit('subscriber.add', storeId, zustandStore.subscribers)
      }

      // Return unsubscribe function that also tracks removal
      return () => {
        const result = unsubscribe()
        
        const zustandStore = this.stores.get(storeId)
        if (zustandStore) {
          zustandStore.subscribers--
          this.emit('subscriber.remove', storeId, zustandStore.subscribers)
        }
        
        return result
      }
    }
  }

  /**
   * Handle state change
   */
  private handleStateChange(storeId: string, prevState: any, newState: any): void {
    const zustandStore = this.stores.get(storeId)
    if (!zustandStore) return

    // Update store state
    zustandStore.state = this.config.sanitizeState!(newState)
    zustandStore.version++

    // Create state change event
    const change: ZustandStateChange = {
      storeId,
      previous: prevState,
      current: newState,
      timestamp: Date.now()
    }

    this.emit('state.change', change)
    this.emit('store.update', zustandStore)
  }

  /**
   * Setup DevTools for store
   */
  private setupStoreDevTools(store: any, storeId: string, storeName: string): void {
    if (!this.devtoolsExtension) return

    const devtools = this.devtoolsExtension.connect({
      name: storeName,
      serialize: true
    })

    // Send initial state
    devtools.init(store.getState())

    // Listen for DevTools actions
    devtools.subscribe((message: any) => {
      if (message.type === 'DISPATCH') {
        switch (message.payload.type) {
          case 'JUMP_TO_ACTION':
          case 'JUMP_TO_STATE':
            // Handle time travel
            if (this.config.enableTimeTravel && message.state) {
              store.setState(JSON.parse(message.state), true)
            }
            break
        }
      }
    })

    // Store DevTools instance for cleanup
    ;(store as any).__ZUSTAND_DEVTOOLS__ = devtools
  }

  /**
   * Discover existing stores
   */
  private async discoverExistingStores(): Promise<void> {
    // This is a simplified implementation
    // In a real scenario, you might need to traverse the DOM or use other methods
    // to find existing Zustand stores
    
    // Check common locations where Zustand stores might be stored
    const possibleLocations = [
      (globalThis as any).__ZUSTAND_STORES__,
      (globalThis as any).stores,
      (globalThis as any).zustandStores
    ]

    for (const location of possibleLocations) {
      if (location && typeof location === 'object') {
        for (const [key, store] of Object.entries(location)) {
          if (store && typeof (store as any).getState === 'function') {
            this.registerStore(store, { name: key })
          }
        }
      }
    }
  }

  /**
   * Record action in history
   */
  private recordAction(action: ZustandAction): void {
    // Filter action if configured
    if (!this.config.filterActions!(action)) {
      return
    }

    // Add to history
    this.actionHistory.push(action)

    // Limit history size
    if (this.actionHistory.length > this.config.maxHistorySize!) {
      this.actionHistory.shift()
    }

    this.emit('action.dispatch', action)
  }

  /**
   * Generate unique store ID
   */
  private generateStoreId(): string {
    return `zustand_${Date.now()}_${Math.random().toString(36).substring(2)}`
  }

  /**
   * Generate unique action ID
   */
  private generateActionId(): string {
    return `action_${++this.actionId}`
  }

  /**
   * Capture stack trace
   */
  private captureStackTrace(): string[] {
    const stack = new Error().stack
    if (!stack) return []
    
    return stack
      .split('\n')
      .slice(2) // Remove Error and this function
      .map(line => line.trim())
      .filter(line => line.length > 0)
  }

  /**
   * Cleanup hooks
   */
  private cleanupHooks(): void {
    // Cleanup DevTools connections
    for (const [storeId, store] of this.storeInstances) {
      if ((store as any).__ZUSTAND_DEVTOOLS__) {
        ;(store as any).__ZUSTAND_DEVTOOLS__.disconnect()
      }
    }

    // This would restore original functions in a complete implementation
  }
}