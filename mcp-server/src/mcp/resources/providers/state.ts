/**
 * State Management Resource Provider
 * Provides integration with XState, Zustand, Apollo Client, and other state managers
 * 
 * Level 3: Integration Layer (depends on Level 0-2)
 */

import type { SessionId } from '@curupira/shared/types'
import { ChromeManager } from '../../../chrome/manager.js'
import { logger } from '../../../config/logger.js'

// XState Types
export interface XStateActor {
  id: string
  sessionId: string
  status: 'active' | 'done' | 'error' | 'stopped'
  value: unknown
  context: Record<string, unknown>
  event: unknown
  machine: {
    id: string
    version?: string
    config: unknown
  }
  parent?: string
  children: XStateActor[]
}

export interface XStateMachine {
  id: string
  version?: string
  config: unknown
  options: Record<string, unknown>
  context: Record<string, unknown>
  states: Record<string, unknown>
  events: string[]
}

// Zustand Types
export interface ZustandStore {
  id: string
  name?: string
  state: Record<string, unknown>
  actions: string[]
  subscribers: number
  devtools: boolean
  persist: boolean
  history?: ZustandStateChange[]
}

export interface ZustandStateChange {
  timestamp: number
  previousState: Record<string, unknown>
  nextState: Record<string, unknown>
  action?: string
  diff: Record<string, unknown>
}

// Apollo Types
export interface ApolloClient {
  version: string
  cache: {
    data: Record<string, unknown>
    optimistic: Record<string, unknown>
    watches: number
  }
  queries: ApolloQuery[]
  mutations: ApolloMutation[]
  subscriptions: ApolloSubscription[]
  networkStatus: 'ready' | 'loading' | 'error' | 'polling'
}

export interface ApolloQuery {
  queryId: string
  queryName?: string
  query: string
  variables: Record<string, unknown>
  result?: unknown
  error?: unknown
  loading: boolean
  networkStatus: number
  fetchPolicy: string
  cacheKey: string
}

export interface ApolloMutation {
  mutationId: string
  mutationName?: string
  mutation: string
  variables: Record<string, unknown>
  result?: unknown
  error?: unknown
  loading: boolean
}

export interface ApolloSubscription {
  subscriptionId: string
  subscriptionName?: string
  subscription: string
  variables: Record<string, unknown>
  active: boolean
  error?: unknown
}

export interface StateManagementProvider {
  // XState methods
  detectXState(sessionId: SessionId): Promise<boolean>
  getXStateActors(sessionId: SessionId): Promise<XStateActor[]>
  getXStateMachines(sessionId: SessionId): Promise<XStateMachine[]>
  getXStateEvents(sessionId: SessionId, actorId?: string): Promise<unknown[]>
  
  // Zustand methods
  detectZustand(sessionId: SessionId): Promise<boolean>
  getZustandStores(sessionId: SessionId): Promise<ZustandStore[]>
  getZustandHistory(sessionId: SessionId, storeId?: string): Promise<ZustandStateChange[]>
  
  // Apollo methods
  detectApollo(sessionId: SessionId): Promise<boolean>
  getApolloClient(sessionId: SessionId): Promise<ApolloClient | null>
  getApolloQueries(sessionId: SessionId): Promise<ApolloQuery[]>
  getApolloMutations(sessionId: SessionId): Promise<ApolloMutation[]>
  getApolloSubscriptions(sessionId: SessionId): Promise<ApolloSubscription[]>
  getApolloCache(sessionId: SessionId): Promise<Record<string, unknown>>
}

export class StateManagementResourceProvider implements StateManagementProvider {
  private chromeManager: ChromeManager

  constructor() {
    this.chromeManager = ChromeManager.getInstance()
  }

  // XState Implementation
  async detectXState(sessionId: SessionId): Promise<boolean> {
    const client = this.chromeManager.getClient()
    
    try {
      const result = await client.send('Runtime.evaluate', {
        expression: `
          (() => {
            // Check for XState in various forms
            return !!(
              window.XState ||
              window.xstate ||
              window.__XSTATE__ ||
              (window.process && window.process.env && window.process.env.XSTATE_DEBUG) ||
              document.querySelector('[data-xstate]') ||
              Array.from(document.scripts).some(script => 
                script.src.includes('xstate') || 
                script.textContent.includes('createMachine') ||
                script.textContent.includes('interpret')
              )
            );
          })()
        `,
        returnByValue: true
      }, sessionId)
      
      if (result && typeof result === 'object' && 'result' in result) {
        const evalResult = result as { result: { value: boolean } }
        return evalResult.result.value
      }
      
      return false
    } catch (error) {
      logger.error('Failed to detect XState:', error)
      return false
    }
  }

  async getXStateActors(sessionId: SessionId): Promise<XStateActor[]> {
    const client = this.chromeManager.getClient()
    
    try {
      const result = await client.send('Runtime.evaluate', {
        expression: `
          (() => {
            const actors = [];
            
            // Check for XState global registry
            if (window.__XSTATE__ && window.__XSTATE__.actors) {
              for (const [id, actor] of window.__XSTATE__.actors) {
                try {
                  actors.push({
                    id: id,
                    sessionId: actor.sessionId || 'unknown',
                    status: actor.status || 'unknown',
                    value: actor.getSnapshot ? actor.getSnapshot().value : actor.state?.value,
                    context: actor.getSnapshot ? actor.getSnapshot().context : actor.state?.context,
                    event: actor.getSnapshot ? actor.getSnapshot().event : actor.state?.event,
                    machine: {
                      id: actor.machine?.id || 'unknown',
                      version: actor.machine?.version,
                      config: actor.machine?.config
                    },
                    children: []
                  });
                } catch (e) {
                  actors.push({
                    id: id,
                    sessionId: 'unknown',
                    status: 'error',
                    value: null,
                    context: {},
                    event: null,
                    machine: { id: 'error', config: null },
                    children: []
                  });
                }
              }
            }
            
            // Look for actors in global scope
            for (const key of Object.keys(window)) {
              try {
                const obj = window[key];
                if (obj && typeof obj === 'object' && 
                    (obj.machine || obj._state || obj.getSnapshot)) {
                  // Likely an XState actor
                  actors.push({
                    id: key,
                    sessionId: 'global',
                    status: obj.status || 'unknown',
                    value: obj.getSnapshot ? obj.getSnapshot().value : obj._state?.value,
                    context: obj.getSnapshot ? obj.getSnapshot().context : obj._state?.context,
                    event: null,
                    machine: {
                      id: obj.machine?.id || key,
                      config: obj.machine?.config
                    },
                    children: []
                  });
                }
              } catch (e) {
                // Skip inaccessible properties
              }
            }
            
            return actors;
          })()
        `,
        returnByValue: true
      }, sessionId)
      
      if (result && typeof result === 'object' && 'result' in result) {
        const evalResult = result as { result: { value: XStateActor[] } }
        return evalResult.result.value || []
      }
      
      return []
    } catch (error) {
      logger.error('Failed to get XState actors:', error)
      return []
    }
  }

  async getXStateMachines(sessionId: SessionId): Promise<XStateMachine[]> {
    const client = this.chromeManager.getClient()
    
    try {
      const result = await client.send('Runtime.evaluate', {
        expression: `
          (() => {
            const machines = [];
            
            // Check for machine registry
            if (window.__XSTATE__ && window.__XSTATE__.machines) {
              for (const [id, machine] of window.__XSTATE__.machines) {
                machines.push({
                  id: id,
                  version: machine.version,
                  config: machine.config,
                  options: machine.options || {},
                  context: machine.context || {},
                  states: machine.states || {},
                  events: machine.events || []
                });
              }
            }
            
            return machines;
          })()
        `,
        returnByValue: true
      }, sessionId)
      
      if (result && typeof result === 'object' && 'result' in result) {
        const evalResult = result as { result: { value: XStateMachine[] } }
        return evalResult.result.value || []
      }
      
      return []
    } catch (error) {
      logger.error('Failed to get XState machines:', error)
      return []
    }
  }

  async getXStateEvents(sessionId: SessionId, actorId?: string): Promise<unknown[]> {
    // XState events are captured over time, return from cache
    const events = (global as any).curupiraBrowserState?.xstateEvents || []
    
    if (actorId) {
      return events.filter((event: any) => event.actorId === actorId)
    }
    
    return events
  }

  // Zustand Implementation
  async detectZustand(sessionId: SessionId): Promise<boolean> {
    const client = this.chromeManager.getClient()
    
    try {
      const result = await client.send('Runtime.evaluate', {
        expression: `
          (() => {
            return !!(
              window.zustand ||
              window.__ZUSTAND__ ||
              Array.from(document.scripts).some(script => 
                script.src.includes('zustand') || 
                script.textContent.includes('create(') ||
                script.textContent.includes('useStore')
              ) ||
              // Look for Zustand DevTools
              window.__REDUX_DEVTOOLS_EXTENSION__ && 
              Object.keys(window).some(key => key.includes('zustand'))
            );
          })()
        `,
        returnByValue: true
      }, sessionId)
      
      if (result && typeof result === 'object' && 'result' in result) {
        const evalResult = result as { result: { value: boolean } }
        return evalResult.result.value
      }
      
      return false
    } catch (error) {
      logger.error('Failed to detect Zustand:', error)
      return false
    }
  }

  async getZustandStores(sessionId: SessionId): Promise<ZustandStore[]> {
    const client = this.chromeManager.getClient()
    
    try {
      const result = await client.send('Runtime.evaluate', {
        expression: `
          (() => {
            const stores = [];
            
            // Check for Zustand global registry
            if (window.__ZUSTAND__) {
              for (const [id, store] of Object.entries(window.__ZUSTAND__)) {
                try {
                  const state = store.getState ? store.getState() : store;
                  stores.push({
                    id: id,
                    name: store.name || id,
                    state: state,
                    actions: Object.keys(state).filter(key => typeof state[key] === 'function'),
                    subscribers: store.listeners ? store.listeners.size : 0,
                    devtools: !!store.devtools,
                    persist: !!store.persist
                  });
                } catch (e) {
                  stores.push({
                    id: id,
                    name: id,
                    state: { error: 'Could not access store state' },
                    actions: [],
                    subscribers: 0,
                    devtools: false,
                    persist: false
                  });
                }
              }
            }
            
            // Look for stores in global scope
            for (const key of Object.keys(window)) {
              try {
                const obj = window[key];
                if (obj && typeof obj === 'object' && 
                    (obj.getState || obj.subscribe) && 
                    !stores.some(s => s.id === key)) {
                  const state = obj.getState ? obj.getState() : obj;
                  stores.push({
                    id: key,
                    name: key,
                    state: state,
                    actions: Object.keys(state).filter(k => typeof state[k] === 'function'),
                    subscribers: obj.listeners ? obj.listeners.size : 0,
                    devtools: false,
                    persist: false
                  });
                }
              } catch (e) {
                // Skip inaccessible properties
              }
            }
            
            return stores;
          })()
        `,
        returnByValue: true
      }, sessionId)
      
      if (result && typeof result === 'object' && 'result' in result) {
        const evalResult = result as { result: { value: ZustandStore[] } }
        return evalResult.result.value || []
      }
      
      return []
    } catch (error) {
      logger.error('Failed to get Zustand stores:', error)
      return []
    }
  }

  async getZustandHistory(sessionId: SessionId, storeId?: string): Promise<ZustandStateChange[]> {
    // Zustand history is captured over time, return from cache
    const history = (global as any).curupiraBrowserState?.zustandHistory || []
    
    if (storeId) {
      return history.filter((change: any) => change.storeId === storeId)
    }
    
    return history
  }

  // Apollo Implementation
  async detectApollo(sessionId: SessionId): Promise<boolean> {
    const client = this.chromeManager.getClient()
    
    try {
      const result = await client.send('Runtime.evaluate', {
        expression: `
          (() => {
            return !!(
              window.__APOLLO_CLIENT__ ||
              window.__APOLLO_DEVTOOLS_GLOBAL_HOOK__ ||
              Array.from(document.scripts).some(script => 
                script.src.includes('apollo') || 
                script.textContent.includes('ApolloClient') ||
                script.textContent.includes('apollo-client')
              ) ||
              // Look for Apollo in React DevTools
              window.__REACT_DEVTOOLS_GLOBAL_HOOK__ &&
              Object.keys(window).some(key => key.includes('apollo'))
            );
          })()
        `,
        returnByValue: true
      }, sessionId)
      
      if (result && typeof result === 'object' && 'result' in result) {
        const evalResult = result as { result: { value: boolean } }
        return evalResult.result.value
      }
      
      return false
    } catch (error) {
      logger.error('Failed to detect Apollo:', error)
      return false
    }
  }

  async getApolloClient(sessionId: SessionId): Promise<ApolloClient | null> {
    const client = this.chromeManager.getClient()
    
    try {
      const result = await client.send('Runtime.evaluate', {
        expression: `
          (() => {
            let apolloClient = null;
            
            // Check for global Apollo client
            if (window.__APOLLO_CLIENT__) {
              apolloClient = window.__APOLLO_CLIENT__;
            } else {
              // Look for Apollo client in global scope
              for (const key of Object.keys(window)) {
                const obj = window[key];
                if (obj && typeof obj === 'object' && 
                    (obj.cache || obj.queryManager || obj.version)) {
                  apolloClient = obj;
                  break;
                }
              }
            }
            
            if (!apolloClient) return null;
            
            try {
              return {
                version: apolloClient.version || 'unknown',
                cache: {
                  data: apolloClient.cache?.data?.data || {},
                  optimistic: apolloClient.cache?.optimisticData?.data || {},
                  watches: apolloClient.cache?.watches?.size || 0
                },
                queries: [],
                mutations: [],
                subscriptions: [],
                networkStatus: apolloClient.networkStatus || 'ready'
              };
            } catch (e) {
              return {
                version: 'unknown',
                cache: { data: {}, optimistic: {}, watches: 0 },
                queries: [],
                mutations: [],
                subscriptions: [],
                networkStatus: 'error'
              };
            }
          })()
        `,
        returnByValue: true
      }, sessionId)
      
      if (result && typeof result === 'object' && 'result' in result) {
        const evalResult = result as { result: { value: ApolloClient | null } }
        return evalResult.result.value
      }
      
      return null
    } catch (error) {
      logger.error('Failed to get Apollo client:', error)
      return null
    }
  }

  async getApolloQueries(sessionId: SessionId): Promise<ApolloQuery[]> {
    // Apollo queries are captured over time, return from cache
    const queries = (global as any).curupiraBrowserState?.apolloQueries || []
    return queries
  }

  async getApolloMutations(sessionId: SessionId): Promise<ApolloMutation[]> {
    // Apollo mutations are captured over time, return from cache
    const mutations = (global as any).curupiraBrowserState?.apolloMutations || []
    return mutations
  }

  async getApolloSubscriptions(sessionId: SessionId): Promise<ApolloSubscription[]> {
    // Apollo subscriptions are captured over time, return from cache
    const subscriptions = (global as any).curupiraBrowserState?.apolloSubscriptions || []
    return subscriptions
  }

  async getApolloCache(sessionId: SessionId): Promise<Record<string, unknown>> {
    const apolloClient = await this.getApolloClient(sessionId)
    return apolloClient?.cache.data || {}
  }
}