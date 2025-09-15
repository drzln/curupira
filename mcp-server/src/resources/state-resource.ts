/**
 * State management resource provider
 * 
 * Provides XState and Zustand state as MCP resources
 */

import type { XStateIntegration } from '../integrations/xstate/index.js'
import type { ZustandIntegration } from '../integrations/zustand/index.js'
import type { Resource, ResourceTemplate } from '@modelcontextprotocol/sdk/types.js'
import { logger } from '../config/logger.js'

export class StateResourceProvider {
  private readonly xstatePrefix = 'xstate'
  private readonly zustandPrefix = 'zustand'

  constructor(
    private xstate: XStateIntegration,
    private zustand: ZustandIntegration
  ) {}

  /**
   * List available state resources
   */
  async listResources(): Promise<Resource[]> {
    const resources: Resource[] = []

    // XState resources
    if (this.xstate.isXStateDetected()) {
      resources.push(
        {
          uri: `${this.xstatePrefix}://info`,
          name: 'XState Info',
          description: 'XState version and detection information',
          mimeType: 'application/json'
        },
        {
          uri: `${this.xstatePrefix}://actors`,
          name: 'XState Actors',
          description: 'All active XState actors',
          mimeType: 'application/json'
        },
        {
          uri: `${this.xstatePrefix}://machines`,
          name: 'XState Machines',
          description: 'All registered state machines',
          mimeType: 'application/json'
        }
      )

      // Add actor-specific resources
      try {
        const actors = await this.xstate.getActors()
        for (const actor of actors.slice(0, 10)) { // Limit to 10
          resources.push({
            uri: `${this.xstatePrefix}://actor/${actor.actor.id}`,
            name: `Actor: ${actor.actor.machineId || actor.actor.id}`,
            description: `XState actor state and context`,
            mimeType: 'application/json'
          })
        }
      } catch (error) {
        logger.error('Failed to list XState actor resources', error)
      }
    }

    // Zustand resources
    if (this.zustand.isZustandDetected()) {
      resources.push(
        {
          uri: `${this.zustandPrefix}://info`,
          name: 'Zustand Info',
          description: 'Zustand detection information',
          mimeType: 'application/json'
        },
        {
          uri: `${this.zustandPrefix}://stores`,
          name: 'Zustand Stores',
          description: 'All Zustand stores',
          mimeType: 'application/json'
        }
      )

      // Add store-specific resources
      try {
        const stores = await this.zustand.getStores()
        for (const store of stores) {
          resources.push({
            uri: `${this.zustandPrefix}://store/${store.store.id}`,
            name: `Store: ${store.store.name}`,
            description: `Zustand store state`,
            mimeType: 'application/json'
          })
        }
      } catch (error) {
        logger.error('Failed to list Zustand store resources', error)
      }
    }

    return resources
  }

  /**
   * Get resource templates
   */
  getResourceTemplates(): ResourceTemplate[] {
    return [
      // XState templates
      {
        uriTemplate: `${this.xstatePrefix}://actor/{actorId}`,
        name: 'XState Actor',
        description: 'Inspect specific XState actor',
        mimeType: 'application/json'
      },
      {
        uriTemplate: `${this.xstatePrefix}://actor/{actorId}/snapshot`,
        name: 'Actor Snapshot',
        description: 'Current snapshot of XState actor',
        mimeType: 'application/json'
      },
      {
        uriTemplate: `${this.xstatePrefix}://actor/{actorId}/context`,
        name: 'Actor Context',
        description: 'Context data of XState actor',
        mimeType: 'application/json'
      },
      {
        uriTemplate: `${this.xstatePrefix}://actor/{actorId}/events`,
        name: 'Actor Events',
        description: 'Event history for XState actor',
        mimeType: 'application/json'
      },
      {
        uriTemplate: `${this.xstatePrefix}://actor/{actorId}/machine`,
        name: 'Actor Machine',
        description: 'State machine definition',
        mimeType: 'application/json'
      },
      // Zustand templates
      {
        uriTemplate: `${this.zustandPrefix}://store/{storeId}`,
        name: 'Zustand Store',
        description: 'Inspect Zustand store',
        mimeType: 'application/json'
      },
      {
        uriTemplate: `${this.zustandPrefix}://store/{storeId}/state`,
        name: 'Store State',
        description: 'Current state of Zustand store',
        mimeType: 'application/json'
      },
      {
        uriTemplate: `${this.zustandPrefix}://store/{storeId}/history`,
        name: 'Store History',
        description: 'State change history',
        mimeType: 'application/json'
      }
    ]
  }

  /**
   * Read a resource
   */
  async readResource(uri: string): Promise<{ content: string; mimeType: string }> {
    try {
      const url = new URL(uri)
      const protocol = url.protocol.slice(0, -1) // Remove trailing :
      const path = url.pathname.substring(2) // Remove leading //

      if (protocol === this.xstatePrefix) {
        return this.readXStateResource(path)
      }

      if (protocol === this.zustandPrefix) {
        return this.readZustandResource(path)
      }

      throw new Error(`Unknown resource protocol: ${protocol}`)
    } catch (error) {
      logger.error('Failed to read state resource', { uri, error })
      throw error
    }
  }

  /**
   * Read XState resource
   */
  private async readXStateResource(path: string): Promise<{ content: string; mimeType: string }> {
    if (!this.xstate.isXStateDetected()) {
      throw new Error('XState not detected on page')
    }

    // Static resources
    if (path === 'info') {
      const info = await this.xstate.detect()
      return {
        content: JSON.stringify(info, null, 2),
        mimeType: 'application/json'
      }
    }

    if (path === 'actors') {
      const actors = await this.xstate.getActors()
      return {
        content: JSON.stringify({
          total: actors.length,
          actors: actors.map(a => ({
            id: a.actor.id,
            machineId: a.actor.machineId,
            state: a.snapshot.value,
            status: a.snapshot.status,
            childCount: a.children.length
          }))
        }, null, 2),
        mimeType: 'application/json'
      }
    }

    if (path === 'machines') {
      const machines = await this.xstate.getMachines()
      return {
        content: JSON.stringify({
          total: machines.length,
          machines
        }, null, 2),
        mimeType: 'application/json'
      }
    }

    // Dynamic actor resources
    if (path.startsWith('actor/')) {
      const parts = path.split('/')
      const actorId = parts[1]

      if (parts.length === 2) {
        const actor = await this.xstate.getActor(actorId)
        if (!actor) {
          throw new Error(`Actor not found: ${actorId}`)
        }
        return {
          content: JSON.stringify(actor, null, 2),
          mimeType: 'application/json'
        }
      }

      if (parts[2] === 'snapshot') {
        const snapshot = await this.xstate.getSnapshot(actorId)
        return {
          content: JSON.stringify(snapshot, null, 2),
          mimeType: 'application/json'
        }
      }

      if (parts[2] === 'context') {
        const context = await this.xstate.getContext(actorId)
        return {
          content: JSON.stringify({
            actorId,
            context
          }, null, 2),
          mimeType: 'application/json'
        }
      }

      if (parts[2] === 'events') {
        const events = await this.xstate.getEventHistory(actorId, 50)
        return {
          content: JSON.stringify({
            actorId,
            eventCount: events.length,
            events
          }, null, 2),
          mimeType: 'application/json'
        }
      }

      if (parts[2] === 'machine') {
        const machine = await this.xstate.getMachine(actorId)
        const visualization = await this.xstate.visualizeMachine(actorId)
        return {
          content: JSON.stringify({
            actorId,
            machine,
            visualization
          }, null, 2),
          mimeType: 'application/json'
        }
      }
    }

    throw new Error(`Unknown XState resource: ${path}`)
  }

  /**
   * Read Zustand resource
   */
  private async readZustandResource(path: string): Promise<{ content: string; mimeType: string }> {
    if (!this.zustand.isZustandDetected()) {
      throw new Error('Zustand not detected on page')
    }

    // Static resources
    if (path === 'info') {
      const info = await this.zustand.detect()
      return {
        content: JSON.stringify(info, null, 2),
        mimeType: 'application/json'
      }
    }

    if (path === 'stores') {
      const stores = await this.zustand.getStores()
      return {
        content: JSON.stringify({
          total: stores.length,
          stores: stores.map(s => ({
            id: s.store.id,
            name: s.store.name,
            subscriberCount: s.store.subscriberCount,
            config: s.store.config,
            statePreview: JSON.stringify(s.state).substring(0, 100) + '...'
          }))
        }, null, 2),
        mimeType: 'application/json'
      }
    }

    // Dynamic store resources
    if (path.startsWith('store/')) {
      const parts = path.split('/')
      const storeId = parts[1]

      if (parts.length === 2) {
        const store = await this.zustand.getStore(storeId)
        if (!store) {
          throw new Error(`Store not found: ${storeId}`)
        }
        return {
          content: JSON.stringify(store, null, 2),
          mimeType: 'application/json'
        }
      }

      if (parts[2] === 'state') {
        const state = await this.zustand.getState(storeId)
        const selectors = await this.zustand.getSelectors(storeId)
        return {
          content: JSON.stringify({
            storeId,
            state,
            selectors
          }, null, 2),
          mimeType: 'application/json'
        }
      }

      if (parts[2] === 'history') {
        const history = await this.zustand.getHistory(storeId, 50)
        return {
          content: JSON.stringify({
            storeId,
            changeCount: history.length,
            history
          }, null, 2),
          mimeType: 'application/json'
        }
      }
    }

    throw new Error(`Unknown Zustand resource: ${path}`)
  }
}