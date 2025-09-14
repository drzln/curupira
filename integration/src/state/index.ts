/**
 * @fileoverview State management integrations
 */

// React DevTools integration
export * from './react.js'

// XState inspector integration
export * from './xstate.js'

// Zustand DevTools integration
export * from './zustand.js'

// Apollo Client DevTools integration
export * from './apollo.js'

// Re-export common types
export interface StateManager {
  connect(): Promise<void>
  disconnect(): void
  isConnected(): boolean
}

export interface StateIntegrationConfig {
  react?: boolean
  xstate?: boolean
  zustand?: boolean
  apollo?: boolean
  debugMode?: boolean
}

/**
 * Unified state management integration
 */
export class StateIntegrationManager {
  private readonly integrations = new Map<string, StateManager>()
  
  constructor(private readonly config: StateIntegrationConfig = {}) {}
  
  /**
   * Connect to all enabled state management tools
   */
  async connect(): Promise<void> {
    if (this.config.react) {
      const { ReactDevTools } = await import('./react.js')
      const integration = new ReactDevTools({ debugMode: this.config.debugMode })
      this.integrations.set('react', integration)
      await integration.attach()
    }
    
    if (this.config.xstate) {
      const { XStateInspector } = await import('./xstate.js')
      const integration = new XStateInspector({ debugMode: this.config.debugMode })
      this.integrations.set('xstate', integration)
      await integration.connect()
    }
    
    if (this.config.zustand) {
      const { ZustandDevTools } = await import('./zustand.js')
      const integration = new ZustandDevTools({ debugMode: this.config.debugMode })
      this.integrations.set('zustand', integration)
      await integration.connect()
    }
    
    if (this.config.apollo) {
      const { ApolloDevTools } = await import('./apollo.js')
      const integration = new ApolloDevTools({ debugMode: this.config.debugMode })
      this.integrations.set('apollo', integration)
      await integration.connect()
    }
  }
  
  /**
   * Disconnect from all integrations
   */
  disconnect(): void {
    for (const [name, integration] of this.integrations) {
      integration.disconnect()
    }
    this.integrations.clear()
  }
  
  /**
   * Get integration by name
   */
  getIntegration<T extends StateManager>(name: string): T | undefined {
    return this.integrations.get(name) as T
  }
  
  /**
   * Check if all integrations are connected
   */
  isConnected(): boolean {
    for (const integration of this.integrations.values()) {
      if (!integration.isConnected()) {
        return false
      }
    }
    return true
  }
}