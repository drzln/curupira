import type { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { ListResourcesRequestSchema, ReadResourceRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import type { ConsoleMessage, NetworkRequest, DOMElement } from '@curupira/shared/types'
import { ChromeManager } from '../../chrome/manager.js'
import { logger } from '../../config/logger.js'
import { ReactDetector } from '../../integrations/react/detector.js'
import { XStateDetector } from '../../integrations/xstate/detector.js'
import { ZustandDetector } from '../../integrations/zustand/detector.js'

// Define missing types locally
interface DOMSnapshot {
  timestamp: number
  url: string
  html: string
  elements: DOMElement[]
}

interface ComponentState {
  componentId: string
  name: string
  props: Record<string, any>
  state: Record<string, any>
  hooks?: any[]
}

// Access browser state from global
// NOTE: This declaration is shared across multiple files, so we use the existing one

export function setupUnifiedResourceHandlers(server: Server) {
  // Single handler for listing all resources
  server.setRequestHandler(ListResourcesRequestSchema, async (request) => {
    logger.info('Resource list handler called!')
    console.log('[Resources] List handler called with request:', request)
    
    // Get Chrome manager instance
    const chromeManager = ChromeManager.getInstance()
    let detectedFrameworks = { react: false, xstate: false, zustand: false, apollo: false }
    
    // Try to detect frameworks if Chrome is connected
    try {
      // This would need access to runtime domain
      // For now, assume we expose all resources
      detectedFrameworks = { react: true, xstate: true, zustand: true, apollo: true }
    } catch (error) {
      logger.warn('Framework detection failed, showing all resources anyway', error)
    }
    
    const resources = [
      // Basic Browser Resources
      {
        uri: 'browser://status',
        name: 'Browser Status',
        mimeType: 'application/json',
        description: 'Current browser connection status and capabilities'
      },
      {
        uri: 'browser://tabs',
        name: 'Browser Tabs',
        mimeType: 'application/json',
        description: 'List of all open browser tabs and their states'
      },
      
      // Console Resources
      {
        uri: 'console://logs',
        name: 'Console Logs',
        description: 'Browser console logs (log, warn, error, info, debug)',
        mimeType: 'application/json',
      },
      {
        uri: 'console://errors',
        name: 'Console Errors',
        description: 'Filtered console errors and stack traces',
        mimeType: 'application/json',
      },
      
      // Network Resources
      {
        uri: 'network://requests',
        name: 'Network Requests',
        description: 'Browser network requests (XHR, fetch, etc)',
        mimeType: 'application/json',
      },
      {
        uri: 'network://timing',
        name: 'Network Timing',
        description: 'Network request timing and performance data',
        mimeType: 'application/json',
      },
      {
        uri: 'network://failures',
        name: 'Network Failures',
        description: 'Failed network requests with error details',
        mimeType: 'application/json',
      },
      
      // DOM Resources
      {
        uri: 'dom://snapshot',
        name: 'DOM Snapshot',
        description: 'Current DOM tree snapshot',
        mimeType: 'application/json',
      },
      {
        uri: 'dom://elements',
        name: 'DOM Elements',
        description: 'Interactive DOM element inspector',
        mimeType: 'application/json',
      },
      
      // State Resources
      {
        uri: 'state://components',
        name: 'Component States',
        description: 'React component states and props',
        mimeType: 'application/json',
      },
      
      // Performance Resources
      {
        uri: 'performance://profile',
        name: 'Performance Profile',
        description: 'CPU profiling results and analysis',
        mimeType: 'application/json',
      },
      {
        uri: 'performance://memory',
        name: 'Memory Analysis',
        description: 'Memory usage and heap snapshots',
        mimeType: 'application/json',
      },
      {
        uri: 'performance://render',
        name: 'Render Performance',
        description: 'React render performance and timing data',
        mimeType: 'application/json',
      },
      
      // Debug Resources
      {
        uri: 'debugger://breakpoints',
        name: 'Breakpoints',
        description: 'Active breakpoints and their states',
        mimeType: 'application/json',
      },
      {
        uri: 'debugger://callstack',
        name: 'Call Stack',
        description: 'Current execution call stack',
        mimeType: 'application/json',
      },
      {
        uri: 'debugger://scope',
        name: 'Variable Scope',
        description: 'Local and global variable scopes',
        mimeType: 'application/json',
      },
      
      // Error Tracking
      {
        uri: 'errors://tracking',
        name: 'Error Tracking',
        description: 'Tracked JavaScript errors with stack traces',
        mimeType: 'application/json',
      },
      {
        uri: 'errors://unhandled',
        name: 'Unhandled Errors',
        description: 'Unhandled promise rejections and exceptions',
        mimeType: 'application/json',
      }
    ]
    
    // Framework-specific resources (conditionally added)
    if (detectedFrameworks.react) {
      resources.push(
        {
          uri: 'react://components',
          name: 'React Components',
          description: 'React component tree and hierarchy',
          mimeType: 'application/json',
        },
        {
          uri: 'react://hooks',
          name: 'React Hooks',
          description: 'React hooks state and dependencies',
          mimeType: 'application/json',
        },
        {
          uri: 'react://fiber',
          name: 'React Fiber',
          description: 'React Fiber tree and internal state',
          mimeType: 'application/json',
        },
        {
          uri: 'react://renders',
          name: 'React Renders',
          description: 'Component render cycles and performance',
          mimeType: 'application/json',
        }
      )
    }
    
    if (detectedFrameworks.xstate) {
      resources.push(
        {
          uri: 'xstate://actors',
          name: 'XState Actors',
          description: 'Active XState actors and their states',
          mimeType: 'application/json',
        },
        {
          uri: 'xstate://machines',
          name: 'XState Machines',
          description: 'State machine definitions and configurations',
          mimeType: 'application/json',
        },
        {
          uri: 'xstate://events',
          name: 'XState Events',
          description: 'State machine events and transitions',
          mimeType: 'application/json',
        },
        {
          uri: 'xstate://history',
          name: 'XState History',
          description: 'State transition history and timeline',
          mimeType: 'application/json',
        }
      )
    }
    
    if (detectedFrameworks.zustand) {
      resources.push(
        {
          uri: 'zustand://stores',
          name: 'Zustand Stores',
          description: 'All Zustand store states and configurations',
          mimeType: 'application/json',
        },
        {
          uri: 'zustand://history',
          name: 'Zustand History',
          description: 'Store state change history and time travel',
          mimeType: 'application/json',
        },
        {
          uri: 'zustand://subscriptions',
          name: 'Zustand Subscriptions',
          description: 'Store subscriptions and listeners',
          mimeType: 'application/json',
        }
      )
    }
    
    if (detectedFrameworks.apollo) {
      resources.push(
        {
          uri: 'apollo://cache',
          name: 'Apollo Cache',
          description: 'Apollo GraphQL cache contents and normalized data',
          mimeType: 'application/json',
        },
        {
          uri: 'apollo://queries',
          name: 'Apollo Queries',
          description: 'Active GraphQL queries and their states',
          mimeType: 'application/json',
        },
        {
          uri: 'apollo://mutations',
          name: 'Apollo Mutations',
          description: 'GraphQL mutations and their results',
          mimeType: 'application/json',
        },
        {
          uri: 'apollo://subscriptions',
          name: 'Apollo Subscriptions',
          description: 'Active GraphQL subscriptions',
          mimeType: 'application/json',
        }
      )
    }
    
    return { resources }
  })

  // Single handler for reading any resource
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params
    
    if (!uri) {
      throw new Error('Resource URI is required')
    }

    logger.debug({ uri }, 'Reading resource')

    // Handle browser resources
    if (uri.startsWith('browser://')) {
      const manager = ChromeManager.getInstance()
      const isInitialized = false // Chrome manager may not be initialized
      const sessions: any[] = [] // TODO: implement getSessions method
      
      if (uri === 'browser://status') {
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                initialized: isInitialized,
                connected: isInitialized,
                sessions: sessions.map((session: any) => ({
                  id: session.id,
                  url: session.url,
                  title: session.title,
                  type: session.type,
                  attached: true
                })),
                capabilities: {
                  screenshot: true,
                  evaluate: true,
                  navigate: true,
                  inspect: true,
                  profiler: true,
                  debugger: true
                }
              }, null, 2),
            },
          ],
        }
      } else if (uri === 'browser://tabs') {
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                tabs: sessions.map((session: any) => ({
                  id: session.id,
                  url: session.url,
                  title: session.title,
                  type: session.type,
                  active: true,
                  loading: false
                })),
                count: sessions.length
              }, null, 2),
            },
          ],
        }
      }
    }

    // Handle console resources
    if (uri.startsWith('console://')) {
      const url = new URL(uri)
      const level = url.searchParams.get('level')
      const limit = parseInt(url.searchParams.get('limit') || '100', 10)

      // Get logs from browser state
      let logs = (global as any).curupiraBrowserState?.consoleLogs || []

      if (uri === 'console://logs') {
        // Filter by level if specified
        if (level) {
          logs = logs.filter((log: ConsoleMessage) => log.level === level)
        }

        // Apply limit
        logs = logs.slice(-limit)

        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(logs, null, 2),
            },
          ],
        }
      } else if (uri === 'console://errors') {
        // Filter for errors and warnings only
        const errorLogs = logs.filter((log: ConsoleMessage) => 
          log.level === 'error' || log.level === 'warn'
        ).slice(-limit)

        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                errors: errorLogs,
                count: errorLogs.length,
                lastError: errorLogs[errorLogs.length - 1]
              }, null, 2),
            },
          ],
        }
      }
    }

    // Handle network resources
    if (uri.startsWith('network://')) {
      const url = new URL(uri)
      const method = url.searchParams.get('method')
      const status = url.searchParams.get('status')
      const limit = parseInt(url.searchParams.get('limit') || '100', 10)

      // Get requests from browser state
      let requests = (global as any).curupiraBrowserState?.networkRequests || []

      if (uri === 'network://requests') {
        // Filter by method if specified
        if (method) {
          requests = requests.filter((req: NetworkRequest) => req.method === method.toUpperCase())
        }

        // Filter by status if specified
        if (status) {
          const statusCode = parseInt(status, 10)
          requests = requests.filter((req: NetworkRequest) => req.status === statusCode)
        }

        // Apply limit
        requests = requests.slice(-limit)

        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(requests, null, 2),
            },
          ],
        }
      } else if (uri === 'network://timing') {
        const timingData = requests.map((req: NetworkRequest) => ({
          url: req.url,
          method: req.method,
          timestamp: req.timestamp,
          duration: req.duration || 0,
          size: req.size || 0
        })).slice(-limit)

        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                requests: timingData,
                averageDuration: timingData.reduce((sum: number, req: any) => sum + req.duration, 0) / timingData.length || 0,
                slowestRequest: timingData.reduce((prev: any, curr: any) => prev.duration > curr.duration ? prev : curr, timingData[0])
              }, null, 2),
            },
          ],
        }
      } else if (uri === 'network://failures') {
        const failures = requests.filter((req: NetworkRequest) => 
          req.status !== undefined && req.status >= 400
        ).slice(-limit)

        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                failures,
                count: failures.length,
                byStatus: failures.reduce((acc: any, req: NetworkRequest) => {
                  acc[req.status || 0] = (acc[req.status || 0] || 0) + 1
                  return acc
                }, {})
              }, null, 2),
            },
          ],
        }
      }
    }

    // Handle DOM resources
    if (uri.startsWith('dom://')) {
      const snapshot = (global as any).curupiraBrowserState?.domSnapshot

      if (uri === 'dom://snapshot') {
        if (!snapshot) {
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify({ error: 'No DOM snapshot available' }, null, 2),
              },
            ],
          }
        }

        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(snapshot, null, 2),
            },
          ],
        }
      } else if (uri === 'dom://elements') {
        const url = new URL(uri)
        const selector = url.searchParams.get('selector')
        
        // This would need to fetch current DOM elements
        const elements = (global as any).curupiraBrowserState?.domElements || []
        
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                elements: selector ? elements.filter((el: any) => el.selector === selector) : elements,
                count: elements.length
              }, null, 2),
            },
          ],
        }
      }
    }

    // Handle state resources
    if (uri.startsWith('state://')) {
      const url = new URL(uri)
      const componentId = url.searchParams.get('id')

      const states = (global as any).curupiraBrowserState?.componentStates || new Map()

      if (componentId) {
        // Get specific component state
        const state = states.get(componentId)
        if (!state) {
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify({ error: `Component ${componentId} not found` }, null, 2),
              },
            ],
          }
        }

        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(state, null, 2),
            },
          ],
        }
      } else {
        // Get all component states
        const allStates = Array.from(states.values())

        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(allStates, null, 2),
            },
          ],
        }
      }
    }

    // Handle performance resources
    if (uri.startsWith('performance://')) {
      if (uri === 'performance://profile') {
        const profileData = (global as any).curupiraBrowserState?.performanceProfile || {
          samples: [],
          duration: 0,
          functions: []
        }

        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(profileData, null, 2),
            },
          ],
        }
      } else if (uri === 'performance://memory') {
        const memoryData = (global as any).curupiraBrowserState?.memoryProfile || {
          heapUsed: 0,
          heapTotal: 0,
          external: 0,
          snapshots: []
        }

        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(memoryData, null, 2),
            },
          ],
        }
      } else if (uri === 'performance://render') {
        const renderData = (global as any).curupiraBrowserState?.renderPerformance || {
          renders: [],
          averageRenderTime: 0,
          slowestRender: null
        }

        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(renderData, null, 2),
            },
          ],
        }
      }
    }

    // Handle debugger resources
    if (uri.startsWith('debugger://')) {
      if (uri === 'debugger://breakpoints') {
        const breakpoints = (global as any).curupiraBrowserState?.breakpoints || []

        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                breakpoints,
                count: breakpoints.length,
                active: breakpoints.filter((bp: any) => bp.enabled).length
              }, null, 2),
            },
          ],
        }
      } else if (uri === 'debugger://callstack') {
        const callStack = (global as any).curupiraBrowserState?.callStack || []

        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                frames: callStack,
                depth: callStack.length
              }, null, 2),
            },
          ],
        }
      } else if (uri === 'debugger://scope') {
        const scope = (global as any).curupiraBrowserState?.scope || {
          local: {},
          global: {},
          closure: {}
        }

        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(scope, null, 2),
            },
          ],
        }
      }
    }

    // Handle error tracking resources
    if (uri.startsWith('errors://')) {
      if (uri === 'errors://tracking') {
        const errors = (global as any).curupiraBrowserState?.trackedErrors || []

        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                errors,
                count: errors.length,
                recent: errors.slice(-10)
              }, null, 2),
            },
          ],
        }
      } else if (uri === 'errors://unhandled') {
        const unhandledErrors = (global as any).curupiraBrowserState?.unhandledErrors || []

        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                errors: unhandledErrors,
                count: unhandledErrors.length
              }, null, 2),
            },
          ],
        }
      }
    }

    // Handle React resources
    if (uri.startsWith('react://')) {
      const manager = ChromeManager.getInstance()
      
      if (uri === 'react://components') {
        const components = (global as any).curupiraBrowserState?.reactComponents || []

        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                components,
                count: components.length,
                tree: components.filter((c: any) => !c.parent) // Root components
              }, null, 2),
            },
          ],
        }
      } else if (uri === 'react://hooks') {
        const url = new URL(uri)
        const componentId = url.searchParams.get('componentId')
        
        const hooks = (global as any).curupiraBrowserState?.reactHooks || []
        const filteredHooks = componentId ? 
          hooks.filter((h: any) => h.componentId === componentId) : hooks

        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                hooks: filteredHooks,
                count: filteredHooks.length
              }, null, 2),
            },
          ],
        }
      } else if (uri === 'react://fiber') {
        const fiberTree = (global as any).curupiraBrowserState?.reactFiber || {}

        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(fiberTree, null, 2),
            },
          ],
        }
      } else if (uri === 'react://renders') {
        const renders = (global as any).curupiraBrowserState?.reactRenders || []

        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                renders,
                count: renders.length,
                recent: renders.slice(-20)
              }, null, 2),
            },
          ],
        }
      }
    }

    // Handle XState resources
    if (uri.startsWith('xstate://')) {
      if (uri === 'xstate://actors') {
        const actors = (global as any).curupiraBrowserState?.xstateActors || []

        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                actors,
                count: actors.length,
                active: actors.filter((a: any) => a.status === 'active').length
              }, null, 2),
            },
          ],
        }
      } else if (uri === 'xstate://machines') {
        const url = new URL(uri)
        const actorId = url.searchParams.get('actorId')
        
        const machines = (global as any).curupiraBrowserState?.xstateMachines || []
        const filteredMachines = actorId ? 
          machines.filter((m: any) => m.actorId === actorId) : machines

        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                machines: filteredMachines,
                count: filteredMachines.length
              }, null, 2),
            },
          ],
        }
      } else if (uri === 'xstate://events') {
        const events = (global as any).curupiraBrowserState?.xstateEvents || []

        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                events,
                count: events.length,
                recent: events.slice(-50)
              }, null, 2),
            },
          ],
        }
      } else if (uri === 'xstate://history') {
        const history = (global as any).curupiraBrowserState?.xstateHistory || []

        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                history,
                count: history.length
              }, null, 2),
            },
          ],
        }
      }
    }

    // Handle Zustand resources
    if (uri.startsWith('zustand://')) {
      if (uri === 'zustand://stores') {
        const stores = (global as any).curupiraBrowserState?.zustandStores || []

        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                stores,
                count: stores.length
              }, null, 2),
            },
          ],
        }
      } else if (uri === 'zustand://history') {
        const url = new URL(uri)
        const storeId = url.searchParams.get('storeId')
        
        const history = (global as any).curupiraBrowserState?.zustandHistory || []
        const filteredHistory = storeId ? 
          history.filter((h: any) => h.storeId === storeId) : history

        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                history: filteredHistory,
                count: filteredHistory.length
              }, null, 2),
            },
          ],
        }
      } else if (uri === 'zustand://subscriptions') {
        const subscriptions = (global as any).curupiraBrowserState?.zustandSubscriptions || []

        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                subscriptions,
                count: subscriptions.length
              }, null, 2),
            },
          ],
        }
      }
    }

    // Handle Apollo resources
    if (uri.startsWith('apollo://')) {
      if (uri === 'apollo://cache') {
        const cache = (global as any).curupiraBrowserState?.apolloCache || {}

        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(cache, null, 2),
            },
          ],
        }
      } else if (uri === 'apollo://queries') {
        const queries = (global as any).curupiraBrowserState?.apolloQueries || []

        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                queries,
                count: queries.length,
                active: queries.filter((q: any) => q.loading).length
              }, null, 2),
            },
          ],
        }
      } else if (uri === 'apollo://mutations') {
        const mutations = (global as any).curupiraBrowserState?.apolloMutations || []

        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                mutations,
                count: mutations.length
              }, null, 2),
            },
          ],
        }
      } else if (uri === 'apollo://subscriptions') {
        const subscriptions = (global as any).curupiraBrowserState?.apolloSubscriptions || []

        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                subscriptions,
                count: subscriptions.length,
                active: subscriptions.filter((s: any) => s.active).length
              }, null, 2),
            },
          ],
        }
      }
    }

    throw new Error(`Unknown resource URI: ${uri}`)
  })
}