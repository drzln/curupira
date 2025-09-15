/**
 * XState inspector
 * 
 * Provides inspection capabilities for XState actors and machines
 */

import type { RuntimeDomain } from '../../chrome/domains/runtime.js'
import type { 
  XStateActor, 
  XStateMachine, 
  XStateSnapshot,
  XStateEvent,
  ActorId 
} from '@nexus/curupira-shared/types/index.js'
import { CircularBuffer } from '@nexus/curupira-shared/utils/index.js'
import { logger } from '../../config/logger.js'

export interface ActorInspection {
  actor: {
    id: ActorId
    machineId?: string
    sessionId: string
    parentId?: ActorId
    system?: string
  }
  machine?: XStateMachine
  snapshot: XStateSnapshot
  children: ActorId[]
  eventHistory: XStateEvent[]
}

export class XStateInspector {
  private eventBuffer: CircularBuffer<XStateEvent>

  constructor(
    private runtime: RuntimeDomain,
    bufferSize = 1000
  ) {
    this.eventBuffer = new CircularBuffer(bufferSize)
  }

  /**
   * Get all active actors
   */
  async getActors(): Promise<ActorInspection[]> {
    const result = await this.runtime.evaluate<any[]>(`
      (() => {
        const storage = window.__CURUPIRA_XSTATE__
        if (!storage) return []

        const actors = []
        for (const [id, actor] of storage.actors) {
          const inspection = {
            actor: {
              id: actor.id,
              machineId: actor.machine?.id,
              sessionId: actor.sessionId || 'default',
              parentId: actor.parent?.id,
              system: actor.system?.id
            },
            machine: actor.machine,
            snapshot: actor.snapshot || {
              value: 'unknown',
              context: {},
              status: 'active'
            },
            children: Array.from(actor.children || []).map(child => child.id),
            eventHistory: storage.events
              .filter(e => e.actorId === actor.id)
              .slice(-10) // Last 10 events per actor
          }
          actors.push(inspection)
        }

        return actors
      })()
    `)

    return result.value || []
  }

  /**
   * Get a specific actor
   */
  async getActor(actorId: ActorId): Promise<ActorInspection | null> {
    const actors = await this.getActors()
    return actors.find(a => a.actor.id === actorId) || null
  }

  /**
   * Send event to actor
   */
  async sendEvent(actorId: ActorId, event: XStateEvent): Promise<boolean> {
    const result = await this.runtime.evaluate<boolean>(`
      (() => {
        const storage = window.__CURUPIRA_XSTATE__
        if (!storage) return false

        const actor = storage.actors.get(${JSON.stringify(actorId)})
        if (!actor || !actor.actorRef) return false

        try {
          // Send event to actual actor
          actor.actorRef.send(${JSON.stringify(event)})
          return true
        } catch (error) {
          console.error('Failed to send event:', error)
          return false
        }
      })()
    `)

    return result.value === true
  }

  /**
   * Get actor snapshot
   */
  async getSnapshot(actorId: ActorId): Promise<XStateSnapshot | null> {
    const result = await this.runtime.evaluate<XStateSnapshot>(`
      (() => {
        const storage = window.__CURUPIRA_XSTATE__
        if (!storage) return null

        const actor = storage.actors.get(${JSON.stringify(actorId)})
        return actor?.snapshot || null
      })()
    `)

    return result.value
  }

  /**
   * Get actor context
   */
  async getContext(actorId: ActorId): Promise<unknown> {
    const snapshot = await this.getSnapshot(actorId)
    return snapshot?.context
  }

  /**
   * Get current state value
   */
  async getStateValue(actorId: ActorId): Promise<unknown> {
    const snapshot = await this.getSnapshot(actorId)
    return snapshot?.value
  }

  /**
   * Get event history for an actor
   */
  async getEventHistory(actorId: ActorId, limit = 50): Promise<XStateEvent[]> {
    const result = await this.runtime.evaluate<XStateEvent[]>(`
      (() => {
        const storage = window.__CURUPIRA_XSTATE__
        if (!storage) return []

        return storage.events
          .filter(e => e.actorId === ${JSON.stringify(actorId)})
          .slice(-${limit})
          .map(e => e.event)
      })()
    `)

    return result.value || []
  }

  /**
   * Get state machine definition
   */
  async getMachine(actorId: ActorId): Promise<XStateMachine | null> {
    const result = await this.runtime.evaluate<XStateMachine>(`
      (() => {
        const storage = window.__CURUPIRA_XSTATE__
        if (!storage) return null

        const actor = storage.actors.get(${JSON.stringify(actorId)})
        return actor?.machine || null
      })()
    `)

    return result.value
  }

  /**
   * Get possible events for current state
   */
  async getPossibleEvents(actorId: ActorId): Promise<string[]> {
    const result = await this.runtime.evaluate<string[]>(`
      (() => {
        const storage = window.__CURUPIRA_XSTATE__
        if (!storage) return []

        const actor = storage.actors.get(${JSON.stringify(actorId)})
        if (!actor || !actor.machine || !actor.snapshot) return []

        const currentState = actor.snapshot.value
        const machine = actor.machine

        // Get state node
        const getStateNode = (stateValue) => {
          if (typeof stateValue === 'string') {
            return machine.states[stateValue]
          }
          // Handle compound states
          const keys = Object.keys(stateValue)
          if (keys.length === 0) return null
          
          let node = machine.states[keys[0]]
          if (node && typeof stateValue[keys[0]] === 'object') {
            // Recurse for nested states
            const nestedNode = getStateNode(stateValue[keys[0]])
            if (nestedNode) node = nestedNode
          }
          return node
        }

        const stateNode = getStateNode(currentState)
        if (!stateNode || !stateNode.on) return []

        // Get event types from transitions
        const events = Object.keys(stateNode.on)
        
        // Add always events
        if (stateNode.always) {
          events.push('xstate.always')
        }

        return [...new Set(events)]
      })()
    `)

    return result.value || []
  }

  /**
   * Visualize state machine
   */
  async visualizeMachine(actorId: ActorId): Promise<{
    states: Array<{
      id: string
      type?: string
      initial?: string
      final?: boolean
    }>
    transitions: Array<{
      from: string
      to: string
      event: string
    }>
    currentState?: string
  }> {
    const result = await this.runtime.evaluate<any>(`
      (() => {
        const storage = window.__CURUPIRA_XSTATE__
        if (!storage) return { states: [], transitions: [] }

        const actor = storage.actors.get(${JSON.stringify(actorId)})
        if (!actor || !actor.machine) return { states: [], transitions: [] }

        const machine = actor.machine
        const states = []
        const transitions = []

        // Extract states and transitions
        function processState(stateNode, parentId = '') {
          const stateId = parentId ? parentId + '.' + stateNode.key : stateNode.key
          
          states.push({
            id: stateId,
            type: stateNode.type,
            initial: stateNode.initial,
            final: stateNode.type === 'final'
          })

          // Process transitions
          if (stateNode.on) {
            Object.entries(stateNode.on).forEach(([event, transition]) => {
              const targets = Array.isArray(transition) ? transition : [transition]
              targets.forEach(t => {
                if (t.target) {
                  transitions.push({
                    from: stateId,
                    to: t.target,
                    event
                  })
                }
              })
            })
          }

          // Process child states
          if (stateNode.states) {
            Object.values(stateNode.states).forEach(childState => {
              processState(childState, stateId)
            })
          }
        }

        // Process all root states
        if (machine.states) {
          Object.values(machine.states).forEach(state => {
            processState(state)
          })
        }

        return {
          states,
          transitions,
          currentState: actor.snapshot?.value
        }
      })()
    `)

    return result.value || { states: [], transitions: [] }
  }

  /**
   * Log actor state to console
   */
  async logActor(actorId: ActorId): Promise<void> {
    const inspection = await this.getActor(actorId)
    if (!inspection) return

    await this.runtime.evaluate(`
      (() => {
        console.group('🤖 XState Actor Inspector')
        console.log('Actor ID:', ${JSON.stringify(actorId)})
        console.log('Machine:', ${JSON.stringify(inspection.machine?.id || 'anonymous')})
        console.log('Current State:', ${JSON.stringify(inspection.snapshot.value)})
        console.log('Context:', ${JSON.stringify(inspection.snapshot.context)})
        console.log('Status:', ${JSON.stringify(inspection.snapshot.status)})
        
        if (${inspection.eventHistory.length > 0}) {
          console.group('Recent Events:')
          ${JSON.stringify(inspection.eventHistory)}.forEach(event => {
            console.log(event.type, event)
          })
          console.groupEnd()
        }
        
        console.groupEnd()
      })()
    `)
  }

  /**
   * Monitor actor for changes
   */
  async monitorActor(
    actorId: ActorId,
    callback: (snapshot: XStateSnapshot) => void
  ): Promise<() => void> {
    // Set up event listener in the page
    await this.runtime.evaluate(`
      (() => {
        window.__CURUPIRA_MONITORS__ = window.__CURUPIRA_MONITORS__ || new Map()
        
        const handler = (event) => {
          if (event.detail.type === '@xstate.snapshot' && 
              event.detail.actorRef.id === ${JSON.stringify(actorId)}) {
            // Store for retrieval
            window.__CURUPIRA_MONITORS__.set(${JSON.stringify(actorId)}, event.detail.snapshot)
          }
        }
        
        window.addEventListener('curupira:xstate:event', handler)
        
        // Store handler for cleanup
        window.__CURUPIRA_MONITORS__.set(${JSON.stringify(actorId)} + '_handler', handler)
      })()
    `)

    // Poll for changes (simplified - real implementation would use proper event system)
    const interval = setInterval(async () => {
      const result = await this.runtime.evaluate<XStateSnapshot>(`
        window.__CURUPIRA_MONITORS__?.get(${JSON.stringify(actorId)})
      `)
      
      if (result.value) {
        callback(result.value)
        // Clear after callback
        await this.runtime.evaluate(`
          window.__CURUPIRA_MONITORS__?.delete(${JSON.stringify(actorId)})
        `)
      }
    }, 100)

    // Return cleanup function
    return () => {
      clearInterval(interval)
      this.runtime.evaluate(`
        (() => {
          const handler = window.__CURUPIRA_MONITORS__?.get(${JSON.stringify(actorId)} + '_handler')
          if (handler) {
            window.removeEventListener('curupira:xstate:event', handler)
            window.__CURUPIRA_MONITORS__.delete(${JSON.stringify(actorId)} + '_handler')
          }
        })()
      `)
    }
  }
}