/**
 * XState integration index
 * 
 * Main entry point for XState debugging integration
 */

import type { RuntimeDomain } from '../../chrome/domains/runtime.js'
import type { 
  XStateActor,
  XStateMachine,
  XStateSnapshot,
  XStateEvent,
  ActorId
} from '@nexus/curupira-shared/types/index.js'
import { XStateDetector, type XStateInfo } from './detector.js'
import { XStateInspector, type ActorInspection } from './inspector.js'
import { logger } from '../../config/logger.js'

export interface XStateIntegration {
  // Detection
  detect(): Promise<XStateInfo>
  isXStateDetected(): boolean
  getVersion(): string | undefined

  // Actors
  getActors(): Promise<ActorInspection[]>
  getActor(actorId: string): Promise<ActorInspection | null>
  sendEvent(actorId: string, event: XStateEvent): Promise<boolean>

  // Inspection
  getSnapshot(actorId: string): Promise<XStateSnapshot | null>
  getContext(actorId: string): Promise<unknown>
  getStateValue(actorId: string): Promise<unknown>
  getEventHistory(actorId: string, limit?: number): Promise<XStateEvent[]>
  getMachine(actorId: string): Promise<XStateMachine | null>

  // Analysis
  getPossibleEvents(actorId: string): Promise<string[]>
  visualizeMachine(actorId: string): Promise<{
    states: Array<{ id: string; type?: string; initial?: string; final?: boolean }>
    transitions: Array<{ from: string; to: string; event: string }>
    currentState?: string
  }>

  // Actions
  logActor(actorId: string): Promise<void>
  monitorActor(actorId: string, callback: (snapshot: XStateSnapshot) => void): Promise<() => void>
}

export class XStateIntegrationImpl implements XStateIntegration {
  private detector: XStateDetector
  private inspector: XStateInspector
  private xstateInfo?: XStateInfo

  constructor(private runtime: RuntimeDomain) {
    this.detector = new XStateDetector(runtime)
    this.inspector = new XStateInspector(runtime)
  }

  /**
   * Initialize the integration
   */
  async initialize(): Promise<void> {
    try {
      // Detect XState
      this.xstateInfo = await this.detector.detect()
      
      if (this.xstateInfo.detected) {
        logger.info('XState detected', {
          version: this.xstateInfo.version,
          hasInspector: this.xstateInfo.hasInspector,
          actorCount: this.xstateInfo.actorCount
        })

        // Install inspector if needed
        if (!this.xstateInfo.hasInspector) {
          const installed = await this.detector.installInspector()
          if (installed) {
            logger.info('XState inspector installed')
            // Re-detect with inspector installed
            this.xstateInfo = await this.detector.detect()
          }
        }
      } else {
        logger.info('XState not detected on page')
      }
    } catch (error) {
      logger.error('XState integration initialization failed', error)
    }
  }

  // Detection methods
  async detect(): Promise<XStateInfo> {
    this.xstateInfo = await this.detector.detect()
    return this.xstateInfo
  }

  isXStateDetected(): boolean {
    return this.xstateInfo?.detected || false
  }

  getVersion(): string | undefined {
    return this.xstateInfo?.version
  }

  // Actor methods
  async getActors(): Promise<ActorInspection[]> {
    if (!this.isXStateDetected()) {
      return []
    }
    return this.inspector.getActors()
  }

  async getActor(actorId: string): Promise<ActorInspection | null> {
    if (!this.isXStateDetected()) {
      return null
    }
    return this.inspector.getActor(actorId as ActorId)
  }

  async sendEvent(actorId: string, event: XStateEvent): Promise<boolean> {
    if (!this.isXStateDetected()) {
      return false
    }
    return this.inspector.sendEvent(actorId as ActorId, event)
  }

  // Inspection methods
  async getSnapshot(actorId: string): Promise<XStateSnapshot | null> {
    if (!this.isXStateDetected()) {
      return null
    }
    return this.inspector.getSnapshot(actorId as ActorId)
  }

  async getContext(actorId: string): Promise<unknown> {
    if (!this.isXStateDetected()) {
      return null
    }
    return this.inspector.getContext(actorId as ActorId)
  }

  async getStateValue(actorId: string): Promise<unknown> {
    if (!this.isXStateDetected()) {
      return null
    }
    return this.inspector.getStateValue(actorId as ActorId)
  }

  async getEventHistory(actorId: string, limit?: number): Promise<XStateEvent[]> {
    if (!this.isXStateDetected()) {
      return []
    }
    return this.inspector.getEventHistory(actorId as ActorId, limit)
  }

  async getMachine(actorId: string): Promise<XStateMachine | null> {
    if (!this.isXStateDetected()) {
      return null
    }
    return this.inspector.getMachine(actorId as ActorId)
  }

  // Analysis methods
  async getPossibleEvents(actorId: string): Promise<string[]> {
    if (!this.isXStateDetected()) {
      return []
    }
    return this.inspector.getPossibleEvents(actorId as ActorId)
  }

  async visualizeMachine(actorId: string): Promise<{
    states: Array<{ id: string; type?: string; initial?: string; final?: boolean }>
    transitions: Array<{ from: string; to: string; event: string }>
    currentState?: string
  }> {
    if (!this.isXStateDetected()) {
      return { states: [], transitions: [] }
    }
    return this.inspector.visualizeMachine(actorId as ActorId)
  }

  // Action methods
  async logActor(actorId: string): Promise<void> {
    if (!this.isXStateDetected()) {
      return
    }
    await this.inspector.logActor(actorId as ActorId)
  }

  async monitorActor(
    actorId: string,
    callback: (snapshot: XStateSnapshot) => void
  ): Promise<() => void> {
    if (!this.isXStateDetected()) {
      return () => {} // No-op cleanup
    }
    return this.inspector.monitorActor(actorId as ActorId, callback)
  }

  /**
   * Create a state machine from definition
   */
  async createMachine(definition: XStateMachine): Promise<string | null> {
    if (!this.isXStateDetected()) {
      return null
    }

    const result = await this.runtime.evaluate<string>(`
      (() => {
        if (!window.XState || !window.XState.createMachine) {
          console.error('XState.createMachine not available')
          return null
        }

        try {
          const machine = window.XState.createMachine(${JSON.stringify(definition)})
          const actor = window.XState.createActor(machine)
          
          // Start the actor
          actor.start()
          
          // Register with inspector if available
          if (window.__XSTATE_INSPECT__) {
            window.__XSTATE_INSPECT__({
              type: '@xstate.actor',
              actorRef: actor
            })
          }
          
          return actor.id
        } catch (error) {
          console.error('Failed to create machine:', error)
          return null
        }
      })()
    `)

    return result.value
  }

  /**
   * Get all state machines
   */
  async getMachines(): Promise<Array<{
    id: string
    states: string[]
    actorCount: number
  }>> {
    if (!this.isXStateDetected()) {
      return []
    }

    return this.xstateInfo?.machines || []
  }
}

// Factory function
export function createXStateIntegration(runtime: RuntimeDomain): XStateIntegration {
  const integration = new XStateIntegrationImpl(runtime)
  // Auto-initialize on creation
  integration.initialize().catch(error => {
    logger.error('Failed to initialize XState integration', error)
  })
  return integration
}