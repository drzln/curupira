import type { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { ListResourcesRequestSchema, ReadResourceRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import type { ILogger } from '../../core/interfaces/logger.interface.js'
import type { IChromeService } from '../../core/interfaces/chrome-service.interface.js'

// State management library types
interface StateManagerInfo {
  type: 'react' | 'xstate' | 'zustand' | 'apollo' | 'redux' | 'jotai' | 'valtio'
  version?: string
  detected: boolean
  storeCount?: number
  devtoolsEnabled?: boolean
}

interface ReactState {
  componentName: string
  displayName: string
  key: string
  props: Record<string, any>
  state: Record<string, any>
  hooks?: Array<{
    type: string
    value: any
    deps?: any[]
  }>
}

interface XStateInfo {
  machineId: string
  currentState: string
  context: Record<string, any>
  events: string[]
  history?: string[]
}

interface ZustandStore {
  storeName: string
  state: Record<string, any>
  actions: string[]
  subscriptions: number
}

interface ApolloCache {
  typename: string
  data: Record<string, any>
  policies?: Record<string, any>
}

export function createStateResourceProvider(
  chromeService: IChromeService,
  logger: ILogger
) {
  return {
    name: 'state',
    
    async listResources() {
      try {
        const client = chromeService.getCurrentClient()
        if (!client) {
          return [{
            uri: 'state://overview',
            name: 'State Overview',
            description: 'State management overview (Chrome not connected)',
            mimeType: 'application/json'
          }]
        }
        
        return [{
          uri: 'state://overview',
          name: 'State Management Overview',
          description: 'Detection and overview of state management libraries',
          mimeType: 'application/json'
        }, {
          uri: 'state://react',
          name: 'React State',
          description: 'React component state and hooks',
          mimeType: 'application/json'
        }, {
          uri: 'state://xstate',
          name: 'XState Machines',
          description: 'XState machine states and transitions',
          mimeType: 'application/json'
        }, {
          uri: 'state://zustand',
          name: 'Zustand Stores',
          description: 'Zustand store state and actions',
          mimeType: 'application/json'
        }, {
          uri: 'state://apollo',
          name: 'Apollo Cache',
          description: 'Apollo Client cache and queries',
          mimeType: 'application/json'
        }]
      } catch (error) {
        logger.error({ error }, 'Failed to list state resources')
        return []
      }
    },
    
    async readResource(uri: string) {
      try {
        const client = chromeService.getCurrentClient()
        
        if (uri === 'state://overview') {
          if (!client) {
            return {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                error: 'Chrome not connected',
                message: 'Unable to detect state managers - Chrome DevTools connection not established'
              }, null, 2)
            }
          }
          
          const managers = await this.detectStateManagers()
          
          return {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              stateManagers: managers,
              summary: {
                reactDetected: managers.react?.detected || false,
                xstateDetected: managers.xstate?.detected || false,
                zustandDetected: managers.zustand?.detected || false,
                apolloDetected: managers.apollo?.detected || false,
                reduxDetected: managers.redux?.detected || false
              }
            }, null, 2)
          }
        }
        
        if (uri === 'state://react') {
          if (!client) {
            return {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                error: 'Chrome not connected',
                message: 'Unable to access React state - Chrome DevTools connection not established'
              }, null, 2)
            }
          }
          
          const reactState = await this.getReactState()
          
          return {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              reactState
            }, null, 2)
          }
        }
        
        if (uri === 'state://xstate') {
          if (!client) {
            return {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                error: 'Chrome not connected',
                message: 'Unable to access XState - Chrome DevTools connection not established'
              }, null, 2)
            }
          }
          
          const xstateInfo = await this.getXStateInfo()
          
          return {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              xstateInfo
            }, null, 2)
          }
        }
        
        if (uri === 'state://zustand') {
          if (!client) {
            return {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                error: 'Chrome not connected',
                message: 'Unable to access Zustand - Chrome DevTools connection not established'
              }, null, 2)
            }
          }
          
          const zustandStores = await this.getZustandStores()
          
          return {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              zustandStores
            }, null, 2)
          }
        }
        
        if (uri === 'state://apollo') {
          if (!client) {
            return {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                error: 'Chrome not connected',
                message: 'Unable to access Apollo - Chrome DevTools connection not established'
              }, null, 2)
            }
          }
          
          const apolloCache = await this.getApolloCache()
          
          return {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              apolloCache
            }, null, 2)
          }
        }
        
        throw new Error(`Invalid state resource URI: ${uri}`)
      } catch (error) {
        logger.error({ error, uri }, 'Failed to read state resource')
        throw error
      }
    },
    
    async detectStateManagers(): Promise<Record<string, StateManagerInfo>> {
      try {
        const client = chromeService.getCurrentClient()
        if (!client) {
          return {}
        }
        
        const result = await client.send('Runtime.evaluate', {
          expression: `
            (() => {
              const managers = {}
              
              // Detect React
              if (window.React || window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
                managers.react = {
                  type: 'react',
                  detected: true,
                  version: window.React?.version,
                  devtoolsEnabled: !!window.__REACT_DEVTOOLS_GLOBAL_HOOK__
                }
              }
              
              // Detect XState
              if (window.__xstate__ || document.querySelector('[data-xstate]')) {
                managers.xstate = {
                  type: 'xstate',
                  detected: true,
                  devtoolsEnabled: !!window.__xstate__
                }
              }
              
              // Detect Zustand
              if (window.__zustand__ || window.zustand) {
                managers.zustand = {
                  type: 'zustand',
                  detected: true,
                  storeCount: Object.keys(window.__zustand__ || {}).length
                }
              }
              
              // Detect Apollo Client
              if (window.__APOLLO_CLIENT__ || window.__APOLLO_DEVTOOLS_GLOBAL_HOOK__) {
                managers.apollo = {
                  type: 'apollo',
                  detected: true,
                  devtoolsEnabled: !!window.__APOLLO_DEVTOOLS_GLOBAL_HOOK__
                }
              }
              
              // Detect Redux
              if (window.__REDUX_DEVTOOLS_EXTENSION__ || window.__REDUX_STORE__) {
                managers.redux = {
                  type: 'redux',
                  detected: true,
                  devtoolsEnabled: !!window.__REDUX_DEVTOOLS_EXTENSION__
                }
              }
              
              return managers
            })()
          `,
          returnByValue: true
        })
        
        return result.result?.value as Record<string, StateManagerInfo> || {}
      } catch (error) {
        logger.error({ error }, 'Failed to detect state managers')
        return {}
      }
    },
    
    async getReactState(): Promise<ReactState[]> {
      try {
        const client = chromeService.getCurrentClient()
        if (!client) {
          return []
        }
        
        const result = await client.send('Runtime.evaluate', {
          expression: `
            (() => {
              if (!window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
                return []
              }
              
              const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__
              const components = []
              
              // This is a simplified implementation
              // Real React DevTools integration would be more complex
              if (hook.getFiberRoots) {
                try {
                  const roots = hook.getFiberRoots(1)
                  // Simplified component traversal
                  components.push({
                    componentName: 'Root',
                    displayName: 'React Root',
                    key: 'root',
                    props: {},
                    state: {},
                    hooks: []
                  })
                } catch (e) {
                  // DevTools API might not be available
                }
              }
              
              return components
            })()
          `,
          returnByValue: true
        })
        
        return result.result?.value as ReactState[] || []
      } catch (error) {
        logger.error({ error }, 'Failed to get React state')
        return []
      }
    },
    
    async getXStateInfo(): Promise<XStateInfo[]> {
      try {
        const client = chromeService.getCurrentClient()
        if (!client) {
          return []
        }
        
        const result = await client.send('Runtime.evaluate', {
          expression: `
            (() => {
              if (!window.__xstate__) {
                return []
              }
              
              const machines = []
              const xstate = window.__xstate__
              
              // Extract machine information
              if (xstate.services) {
                Object.entries(xstate.services).forEach(([id, service]) => {
                  try {
                    machines.push({
                      machineId: id,
                      currentState: service.state?.value || 'unknown',
                      context: service.state?.context || {},
                      events: service.machine?.events || [],
                      history: service.state?.history?.map(h => h.value) || []
                    })
                  } catch (e) {
                    // Skip problematic services
                  }
                })
              }
              
              return machines
            })()
          `,
          returnByValue: true
        })
        
        return result.result?.value as XStateInfo[] || []
      } catch (error) {
        logger.error({ error }, 'Failed to get XState info')
        return []
      }
    },
    
    async getZustandStores(): Promise<ZustandStore[]> {
      try {
        const client = chromeService.getCurrentClient()
        if (!client) {
          return []
        }
        
        const result = await client.send('Runtime.evaluate', {
          expression: `
            (() => {
              if (!window.__zustand__) {
                return []
              }
              
              const stores = []
              const zustand = window.__zustand__
              
              Object.entries(zustand).forEach(([name, store]) => {
                try {
                  stores.push({
                    storeName: name,
                    state: store.getState ? store.getState() : {},
                    actions: Object.keys(store.getState ? store.getState() : {}).filter(key => 
                      typeof store.getState()[key] === 'function'
                    ),
                    subscriptions: store.listeners?.size || 0
                  })
                } catch (e) {
                  // Skip problematic stores
                }
              })
              
              return stores
            })()
          `,
          returnByValue: true
        })
        
        return result.result?.value as ZustandStore[] || []
      } catch (error) {
        logger.error({ error }, 'Failed to get Zustand stores')
        return []
      }
    },
    
    async getApolloCache(): Promise<ApolloCache[]> {
      try {
        const client = chromeService.getCurrentClient()
        if (!client) {
          return []
        }
        
        const result = await client.send('Runtime.evaluate', {
          expression: `
            (() => {
              if (!window.__APOLLO_CLIENT__) {
                return []
              }
              
              const cacheData = []
              const client = window.__APOLLO_CLIENT__
              
              try {
                const cache = client.cache
                if (cache && cache.data) {
                  const data = cache.data.data || cache.data
                  
                  Object.entries(data).forEach(([key, value]) => {
                    cacheData.push({
                      typename: key,
                      data: value,
                      policies: cache.policies?.get?.(key) || {}
                    })
                  })
                }
              } catch (e) {
                // Apollo cache structure might vary
              }
              
              return cacheData
            })()
          `,
          returnByValue: true
        })
        
        return result.result?.value as ApolloCache[] || []
      } catch (error) {
        logger.error({ error }, 'Failed to get Apollo cache')
        return []
      }
    }
  }
}

export function setupStateResource(server: Server) {
  // Legacy setup function - deprecated, use factory pattern instead
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [{
        uri: 'state://react',
        name: 'React State',
        description: 'React component state and hooks',
        mimeType: 'application/json'
      }, {
        uri: 'state://xstate',
        name: 'XState Machines',
        description: 'XState machine states and transitions',
        mimeType: 'application/json'
      }, {
        uri: 'state://zustand',
        name: 'Zustand Stores',
        description: 'Zustand store state and actions',
        mimeType: 'application/json'
      }, {
        uri: 'state://apollo',
        name: 'Apollo Cache',
        description: 'Apollo Client cache and queries',
        mimeType: 'application/json'
      }]
    }
  })
  
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params?.uri
    
    if (uri === 'state://react') {
      return {
        contents: [{
          type: 'text' as const,
          text: JSON.stringify({
            message: 'React state resource provider not fully connected to Chrome service yet',
            placeholder: 'Will provide React component state, hooks, and props'
          }, null, 2)
        }]
      }
    }
    
    if (uri === 'state://xstate') {
      return {
        contents: [{
          type: 'text' as const,
          text: JSON.stringify({
            message: 'XState resource provider not fully connected to Chrome service yet',
            placeholder: 'Will provide XState machine states, transitions, and context'
          }, null, 2)
        }]
      }
    }
    
    if (uri === 'state://zustand') {
      return {
        contents: [{
          type: 'text' as const,
          text: JSON.stringify({
            message: 'Zustand resource provider not fully connected to Chrome service yet',
            placeholder: 'Will provide Zustand store state and actions'
          }, null, 2)
        }]
      }
    }
    
    if (uri === 'state://apollo') {
      return {
        contents: [{
          type: 'text' as const,
          text: JSON.stringify({
            message: 'Apollo resource provider not fully connected to Chrome service yet',
            placeholder: 'Will provide Apollo Client cache, queries, and mutations'
          }, null, 2)
        }]
      }
    }
    
    throw new Error(`Unknown resource: ${uri}`)
  })
}