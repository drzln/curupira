/**
 * Framework integrations index
 * 
 * Main entry point for all framework integrations
 */

import type { RuntimeDomain } from '../chrome/domains/runtime.js'
import type { DOMDomain } from '../chrome/domains/dom.js'
import type { 
  StateInspectionContext,
  StateSnapshot,
  ReactRenderInfo,
  XStateActor,
  ZustandStoreInfo
} from '@curupira/shared/types/state.js'
import { ReactIntegration, createReactIntegration } from './react/index.js'
import { XStateIntegration, createXStateIntegration } from './xstate/index.js'
import { ZustandIntegration, createZustandIntegration } from './zustand/index.js'
import { logger } from '../config/logger.js'

export interface FrameworkIntegrations {
  // Individual integrations
  react: ReactIntegration
  xstate: XStateIntegration
  zustand: ZustandIntegration

  // Combined operations
  detectAll(): Promise<StateInspectionContext>
  captureSnapshot(): Promise<StateSnapshot>
  
  // Monitoring
  enableAllMonitoring(): Promise<void>
  disableAllMonitoring(): Promise<void>
}

export class FrameworkIntegrationsImpl implements FrameworkIntegrations {
  public readonly react: ReactIntegration
  public readonly xstate: XStateIntegration
  public readonly zustand: ZustandIntegration

  constructor(
    runtime: RuntimeDomain,
    dom: DOMDomain
  ) {
    this.react = createReactIntegration(runtime, dom)
    this.xstate = createXStateIntegration(runtime)
    this.zustand = createZustandIntegration(runtime)
  }

  /**
   * Detect all frameworks
   */
  async detectAll(): Promise<StateInspectionContext> {
    const [reactInfo, xstateInfo, zustandInfo] = await Promise.all([
      this.react.detect(),
      this.xstate.detect(),
      this.zustand.detect()
    ])

    const context: StateInspectionContext = {}

    // React context
    if (reactInfo.detected) {
      const components = await this.react.getComponentTree()
      context.react = {
        components: new Map(
          components.map(c => [c.id, {
            componentId: c.id,
            displayName: c.name,
            type: c.type as 'function' | 'class' | 'memo' | 'forward_ref',
            interactions: new Set()
          }])
        )
      }
    }

    // XState context
    if (xstateInfo.detected) {
      const actors = await this.xstate.getActors()
      context.xstate = {
        actors: new Map(
          actors.map(a => [a.actor.id, {
            id: a.actor.id,
            type: a.machine?.id || 'unknown',
            machine: a.machine,
            sessionId: a.actor.sessionId,
            parent: undefined,
            children: new Set<XStateActor>(),
            observers: new Set()
          } as XStateActor])
        ),
        machines: new Map(
          xstateInfo.machines?.map(m => [m.id, {
            id: m.id,
            states: m.states.reduce((acc, state) => {
              acc[state] = { key: state }
              return acc
            }, {} as any)
          }]) || []
        ),
        events: []
      }
    }

    // Zustand context
    if (zustandInfo.detected) {
      const stores = await this.zustand.getStores()
      context.zustand = {
        stores: new Map(
          stores.map(s => [s.store.id, {
            id: s.store.id,
            name: s.store.name,
            store: {
              getState: () => s.state,
              setState: () => {},
              subscribe: () => () => {},
              destroy: () => {}
            },
            config: {
              devtools: { enabled: s.store.config.devtools || false },
              persist: s.store.config.persist ? { name: s.store.name } : undefined,
              immer: s.store.config.immer ? {} : undefined
            },
            subscribers: new Set(),
            history: s.history
          } as ZustandStoreInfo])
        )
      }
    }

    return context
  }

  /**
   * Capture a snapshot of all state
   */
  async captureSnapshot(): Promise<StateSnapshot> {
    const timestamp = Date.now() as any
    const snapshot: StateSnapshot = {
      id: `snapshot_${timestamp}` as any,
      timestamp,
      react: {
        components: [],
        renderCount: 0
      },
      xstate: {
        actors: [],
        eventCount: 0
      },
      zustand: {
        stores: [],
        changeCount: 0
      },
      apollo: {
        queries: [],
        cacheSize: 0,
        networkRequests: 0
      }
    }

    // React snapshot
    if (this.react.isReactDetected()) {
      const components = await this.react.getComponentTree()
      const metrics = await this.react.getRenderMetrics()
      
      snapshot.react = {
        components: components.map(c => ({
          componentId: c.id,
          displayName: c.name,
          type: c.type,
          interactions: new Set()
        } as ReactRenderInfo)),
        renderCount: metrics.renderCount
      }
    }

    // XState snapshot
    if (this.xstate.isXStateDetected()) {
      const actors = await this.xstate.getActors()
      
      snapshot.xstate = {
        actors: actors.map(a => ({
          id: a.actor.id,
          type: a.machine?.id || 'unknown',
          machine: a.machine,
          sessionId: a.actor.sessionId
        })),
        eventCount: actors.reduce((sum, a) => sum + a.eventHistory.length, 0)
      }
    }

    // Zustand snapshot
    if (this.zustand.isZustandDetected()) {
      const stores = await this.zustand.getStores()
      
      snapshot.zustand = {
        stores: stores.map(s => ({
          id: s.store.id,
          name: s.store.name,
          state: s.state
        })),
        changeCount: stores.reduce((sum, s) => sum + s.history.length, 0)
      }
    }

    return snapshot
  }

  /**
   * Enable monitoring for all frameworks
   */
  async enableAllMonitoring(): Promise<void> {
    const promises: Promise<void>[] = []

    if (this.react.isReactDetected()) {
      promises.push(
        (this.react as any).enablePerformanceMonitoring?.() || Promise.resolve()
      )
    }

    // XState and Zustand auto-monitor when inspector is installed
    
    await Promise.all(promises)
    logger.info('All framework monitoring enabled')
  }

  /**
   * Disable monitoring for all frameworks
   */
  async disableAllMonitoring(): Promise<void> {
    const promises: Promise<void>[] = []

    if (this.react.isReactDetected()) {
      promises.push(
        (this.react as any).disablePerformanceMonitoring?.() || Promise.resolve()
      )
    }

    await Promise.all(promises)
    logger.info('All framework monitoring disabled')
  }

  /**
   * Get combined statistics
   */
  async getStatistics(): Promise<{
    frameworks: string[]
    components: number
    actors: number
    stores: number
    totalStateSize: number
  }> {
    const frameworks: string[] = []
    let components = 0
    let actors = 0
    let stores = 0
    let totalStateSize = 0

    if (this.react.isReactDetected()) {
      frameworks.push('React')
      const tree = await this.react.getComponentTree()
      components = tree.length
    }

    if (this.xstate.isXStateDetected()) {
      frameworks.push('XState')
      const actorList = await this.xstate.getActors()
      actors = actorList.length
      
      // Estimate state size
      for (const actor of actorList) {
        totalStateSize += JSON.stringify(actor.snapshot).length
      }
    }

    if (this.zustand.isZustandDetected()) {
      frameworks.push('Zustand')
      const storeList = await this.zustand.getStores()
      stores = storeList.length
      
      // Estimate state size
      for (const store of storeList) {
        totalStateSize += JSON.stringify(store.state).length
      }
    }

    return {
      frameworks,
      components,
      actors,
      stores,
      totalStateSize
    }
  }
}

// Factory function
export function createFrameworkIntegrations(
  runtime: RuntimeDomain,
  dom: DOMDomain
): FrameworkIntegrations {
  return new FrameworkIntegrationsImpl(runtime, dom)
}

// Re-export individual integrations
export type { ReactIntegration } from './react/index.js'
export type { XStateIntegration } from './xstate/index.js'
export type { ZustandIntegration } from './zustand/index.js'