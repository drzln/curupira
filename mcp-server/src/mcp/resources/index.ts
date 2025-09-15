import type { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { ListResourcesRequestSchema, ReadResourceRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import type { ConsoleMessage, NetworkRequest, DOMElement } from '@curupira/shared/types'
import { ChromeManager } from '../../chrome/manager.js'
import { logger } from '../../config/logger.js'

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
    
    return {
      resources: [
        // Browser resources
        {
          uri: 'browser://status',
          name: 'browser/status',
          mimeType: 'application/json',
          description: 'Current browser connection status and capabilities'
        },
        // Console resources
        {
          uri: 'console://logs',
          name: 'Console Logs',
          description: 'Browser console logs (log, warn, error, info, debug)',
          mimeType: 'application/json',
        },
        // Network resources
        {
          uri: 'network://requests',
          name: 'Network Requests',
          description: 'Browser network requests (XHR, fetch, etc)',
          mimeType: 'application/json',
        },
        // DOM resources
        {
          uri: 'dom://snapshot',
          name: 'DOM Snapshot',
          description: 'Current DOM tree snapshot',
          mimeType: 'application/json',
        },
        // State resources
        {
          uri: 'state://components',
          name: 'Component States',
          description: 'React component states and props',
          mimeType: 'application/json',
        },
      ],
    }
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
                inspect: true
              }
            }, null, 2),
          },
        ],
      }
    }

    // Handle console resources
    if (uri.startsWith('console://')) {
      const url = new URL(uri)
      const level = url.searchParams.get('level')
      const limit = parseInt(url.searchParams.get('limit') || '100', 10)

      // Get logs from browser state
      let logs = (global as any).curupiraBrowserState?.consoleLogs || []

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
    }

    // Handle network resources
    if (uri.startsWith('network://')) {
      const url = new URL(uri)
      const method = url.searchParams.get('method')
      const status = url.searchParams.get('status')
      const limit = parseInt(url.searchParams.get('limit') || '100', 10)

      // Get requests from browser state
      let requests = (global as any).curupiraBrowserState?.networkRequests || []

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
    }

    // Handle DOM resources
    if (uri.startsWith('dom://')) {
      const snapshot = (global as any).curupiraBrowserState?.domSnapshot

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

    throw new Error(`Unknown resource URI: ${uri}`)
  })
}