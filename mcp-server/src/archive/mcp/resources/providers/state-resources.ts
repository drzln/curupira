/**
 * State Management Resource Provider - Handles XState, Zustand, Apollo resources
 * Implements ResourceProvider interface for registry pattern
 */

import type { Resource } from '@modelcontextprotocol/sdk/types.js'
import type { SessionId } from '@curupira/shared/types'
import { ChromeManager } from '../../../chrome/manager.js'
import { logger } from '../../../config/logger.js'
import type { ResourceProvider } from '../registry.js'
import { StateManagementResourceProvider } from './state.js'

export class StateResourceProviderImpl implements ResourceProvider {
  name = 'state'
  private stateProvider: StateManagementResourceProvider
  private detectedLibraries = {
    xstate: false,
    zustand: false,
    apollo: false
  }
  
  constructor() {
    this.stateProvider = new StateManagementResourceProvider()
  }
  
  async detectLibraries(): Promise<void> {
    try {
      const chromeManager = ChromeManager.getInstance()
      const client = chromeManager.getClient()
      const sessions = client.getSessions()
      
      if (sessions.length === 0) {
        return
      }
      
      const sessionId = sessions[0].sessionId as SessionId
      
      // Detect each library
      this.detectedLibraries.xstate = await this.stateProvider.detectXState(sessionId)
      this.detectedLibraries.zustand = await this.stateProvider.detectZustand(sessionId)
      this.detectedLibraries.apollo = await this.stateProvider.detectApollo(sessionId)
    } catch (error) {
      logger.error({ error }, 'Failed to detect state management libraries')
    }
  }
  
  async listResources(): Promise<Resource[]> {
    // Detect libraries if not already done
    if (!Object.values(this.detectedLibraries).some(v => v)) {
      await this.detectLibraries()
    }
    
    const resources: Resource[] = []
    
    // XState resources
    if (this.detectedLibraries.xstate) {
      resources.push(
        {
          uri: 'state/xstate/machines',
          name: 'XState Machines',
          description: 'All XState machine instances',
          mimeType: 'application/json'
        },
        {
          uri: 'state/xstate/actors',
          name: 'XState Actors',
          description: 'Active XState actors and their states',
          mimeType: 'application/json'
        },
        {
          uri: 'state/xstate/inspector',
          name: 'XState Inspector Data',
          description: 'XState inspector connection status',
          mimeType: 'application/json'
        }
      )
    }
    
    // Zustand resources
    if (this.detectedLibraries.zustand) {
      resources.push(
        {
          uri: 'state/zustand/stores',
          name: 'Zustand Stores',
          description: 'All Zustand store instances',
          mimeType: 'application/json'
        },
        {
          uri: 'state/zustand/devtools',
          name: 'Zustand DevTools',
          description: 'Zustand Redux DevTools connection',
          mimeType: 'application/json'
        }
      )
    }
    
    // Apollo resources
    if (this.detectedLibraries.apollo) {
      resources.push(
        {
          uri: 'state/apollo/client',
          name: 'Apollo Client',
          description: 'Apollo Client instance and configuration',
          mimeType: 'application/json'
        },
        {
          uri: 'state/apollo/cache',
          name: 'Apollo Cache',
          description: 'Apollo Client cache contents',
          mimeType: 'application/json'
        },
        {
          uri: 'state/apollo/queries',
          name: 'Apollo Queries',
          description: 'Active Apollo queries and their states',
          mimeType: 'application/json'
        },
        {
          uri: 'state/apollo/mutations',
          name: 'Apollo Mutations',
          description: 'Apollo mutation history',
          mimeType: 'application/json'
        }
      )
    }
    
    return resources
  }
  
  async readResource(uri: string): Promise<unknown> {
    const chromeManager = ChromeManager.getInstance()
    const client = chromeManager.getClient()
    const sessions = client.getSessions()
    
    if (sessions.length === 0) {
      throw new Error('No active Chrome sessions')
    }
    
    const sessionId = sessions[0].sessionId as SessionId
    const parts = uri.split('/')
    const library = parts[1]
    const resource = parts[2]
    
    try {
      switch (`${library}/${resource}`) {
        // XState resources
        case 'xstate/machines':
          return this.stateProvider.getXStateMachines(sessionId)
          
        case 'xstate/actors':
          return this.stateProvider.getXStateActors(sessionId)
          
        case 'xstate/inspector':
          return {
            description: 'XState inspector connection status',
            connected: false,
            hint: 'Use @xstate/inspect for debugging'
          }
          
        // Zustand resources
        case 'zustand/stores':
          return this.stateProvider.getZustandStores(sessionId)
          
        case 'zustand/devtools':
          return {
            description: 'Zustand Redux DevTools integration',
            connected: false,
            hint: 'Use zustand/middleware for DevTools'
          }
          
        // Apollo resources
        case 'apollo/client':
          return this.stateProvider.getApolloClient(sessionId)
          
        case 'apollo/cache':
          return this.stateProvider.getApolloCache(sessionId)
          
        case 'apollo/queries':
          return this.stateProvider.getApolloQueries(sessionId)
          
        case 'apollo/mutations':
          return this.stateProvider.getApolloMutations(sessionId)
          
        default:
          throw new Error(`Unknown state management resource: ${uri}`)
      }
    } catch (error) {
      logger.error({ error, uri }, 'Failed to read state management resource')
      throw error
    }
  }
}