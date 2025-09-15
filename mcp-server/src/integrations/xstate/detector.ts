/**
 * XState detector
 * 
 * Detects XState presence and actors in the target page
 */

import type { RuntimeDomain } from '../../chrome/domains/runtime.js'
import type { XStateActor, XStateMachine } from '@curupira/shared/types/state.js'
import { logger } from '../../config/logger.js'

export interface XStateInfo {
  detected: boolean
  version?: string
  hasInspector?: boolean
  actorCount?: number
  machines?: Array<{
    id: string
    states: string[]
  }>
}

export class XStateDetector {
  constructor(private runtime: RuntimeDomain) {}

  /**
   * Detect XState in the page
   */
  async detect(): Promise<XStateInfo> {
    try {
      const result = await this.runtime.evaluate<XStateInfo>(`
        (() => {
          // Check for XState v5 global
          if (typeof window !== 'undefined' && window.XState) {
            return {
              detected: true,
              version: window.XState.version || '5.x',
              hasInspector: typeof window.__XSTATE_INSPECT__ === 'function'
            }
          }

          // Check for XState in common bundlers
          const hasXState = (() => {
            try {
              // Check if any global objects contain XState patterns
              const globals = Object.keys(window)
              return globals.some(key => {
                const val = window[key]
                return val && typeof val === 'object' && 
                       (val.createMachine || val.createActor || val.interpret)
              })
            } catch {
              return false
            }
          })()

          if (hasXState) {
            return {
              detected: true,
              version: 'unknown',
              hasInspector: typeof window.__XSTATE_INSPECT__ === 'function'
            }
          }

          // Check for XState actors in memory
          const hasActors = (() => {
            try {
              // Look for XState patterns in existing objects
              const allObjects = Object.values(window)
              return allObjects.some(obj => 
                obj && typeof obj === 'object' && 
                obj._state && obj._machine && typeof obj.send === 'function'
              )
            } catch {
              return false
            }
          })()

          return {
            detected: hasActors,
            version: hasActors ? 'unknown' : undefined,
            hasInspector: false
          }
        })()
      `)

      if (result.error || !result.value) {
        return { detected: false }
      }

      // If detected, try to get more info
      if (result.value.detected) {
        const actorInfo = await this.getActorInfo()
        return {
          ...result.value,
          ...actorInfo
        }
      }

      return result.value
    } catch (error) {
      logger.error('XState detection failed', error)
      return { detected: false }
    }
  }

  /**
   * Install XState inspector
   */
  async installInspector(): Promise<boolean> {
    const result = await this.runtime.evaluate<boolean>(`
      (() => {
        if (window.__XSTATE_INSPECT__) {
          return true // Already installed
        }

        // Create inspection storage
        window.__CURUPIRA_XSTATE__ = {
          actors: new Map(),
          events: [],
          machines: new Map()
        }

        // Install inspector function
        window.__XSTATE_INSPECT__ = (event) => {
          const storage = window.__CURUPIRA_XSTATE__
          
          switch (event.type) {
            case '@xstate.actor':
              storage.actors.set(event.actorRef.id, {
                id: event.actorRef.id,
                sessionId: event.actorRef.sessionId,
                machine: event.actorRef.machine,
                parent: event.actorRef.parent,
                system: event.actorRef.system
              })
              break
              
            case '@xstate.snapshot':
              // Update actor snapshot
              const actor = storage.actors.get(event.actorRef.id)
              if (actor) {
                actor.snapshot = event.snapshot
                actor.lastUpdate = Date.now()
              }
              break
              
            case '@xstate.event':
              // Store event
              storage.events.push({
                actorId: event.actorRef.id,
                event: event.event,
                timestamp: Date.now()
              })
              
              // Keep only last 1000 events
              if (storage.events.length > 1000) {
                storage.events = storage.events.slice(-1000)
              }
              break
          }
          
          // Emit custom event for monitoring
          window.dispatchEvent(new CustomEvent('curupira:xstate:event', {
            detail: event
          }))
        }

        // Try to enable on existing actors
        try {
          // This would need to hook into existing actors
          // Implementation depends on how XState is used in the app
          console.log('XState inspector installed by Curupira')
        } catch (e) {
          console.error('Failed to hook existing actors:', e)
        }

        return true
      })()
    `)

    return result.value === true
  }

  /**
   * Get information about active actors
   */
  private async getActorInfo(): Promise<{
    actorCount: number
    machines: Array<{ id: string; states: string[] }>
  }> {
    const result = await this.runtime.evaluate<any>(`
      (() => {
        const storage = window.__CURUPIRA_XSTATE__
        if (!storage) {
          return { actorCount: 0, machines: [] }
        }

        const machines = []
        const machineMap = new Map()

        // Group actors by machine
        for (const [id, actor] of storage.actors) {
          if (actor.machine) {
            const machineId = actor.machine.id || 'anonymous'
            if (!machineMap.has(machineId)) {
              machineMap.set(machineId, {
                id: machineId,
                states: []
              })
            }
            
            // Collect states from machine definition
            if (actor.machine.states) {
              const states = Object.keys(actor.machine.states)
              const machineInfo = machineMap.get(machineId)
              machineInfo.states = [...new Set([...machineInfo.states, ...states])]
            }
          }
        }

        return {
          actorCount: storage.actors.size,
          machines: Array.from(machineMap.values())
        }
      })()
    `)

    return result.value || { actorCount: 0, machines: [] }
  }

  /**
   * Get all active actors
   */
  async getActors(): Promise<Array<{
    id: string
    machineId?: string
    state?: string
    context?: unknown
  }>> {
    const result = await this.runtime.evaluate<any[]>(`
      (() => {
        const storage = window.__CURUPIRA_XSTATE__
        if (!storage) return []

        const actors = []
        for (const [id, actor] of storage.actors) {
          actors.push({
            id: actor.id,
            machineId: actor.machine?.id,
            state: actor.snapshot?.value,
            context: actor.snapshot?.context
          })
        }

        return actors
      })()
    `)

    return result.value || []
  }

  /**
   * Enable XState inspection on a specific actor system
   */
  async enableSystemInspection(systemId?: string): Promise<boolean> {
    const result = await this.runtime.evaluate<boolean>(`
      (() => {
        // This would hook into the actor system
        // Implementation depends on XState version and usage
        console.log('Enabling XState inspection for system:', ${JSON.stringify(systemId)})
        return true
      })()
    `)

    return result.value === true
  }
}