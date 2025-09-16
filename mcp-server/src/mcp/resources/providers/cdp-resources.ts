/**
 * CDP Resource Provider - Handles all Chrome DevTools Protocol resources
 * Implements ResourceProvider interface for registry pattern
 */

import type { Resource } from '@modelcontextprotocol/sdk/types.js'
import type { SessionId } from '@curupira/shared/types'
import { ChromeManager } from '../../../chrome/manager.js'
import { logger } from '../../../config/logger.js'
import type { ResourceProvider } from '../registry.js'
import { ChromeCDPResourceProvider } from './cdp.js'

export class CDPResourceProviderImpl implements ResourceProvider {
  name = 'cdp'
  private cdpProvider: ChromeCDPResourceProvider
  
  constructor() {
    this.cdpProvider = new ChromeCDPResourceProvider()
  }
  
  async listResources(): Promise<Resource[]> {
    const resources: Resource[] = [
      // Runtime & Console
      {
        uri: 'cdp/runtime/console',
        name: 'Console Logs',
        description: 'Browser console messages and errors',
        mimeType: 'application/json'
      },
      {
        uri: 'cdp/runtime/evaluate',
        name: 'Runtime Evaluation',
        description: 'Evaluate JavaScript expressions in the browser',
        mimeType: 'application/json'
      },
      
      // DOM
      {
        uri: 'cdp/dom/tree',
        name: 'DOM Tree',
        description: 'Current DOM tree structure',
        mimeType: 'application/json'
      },
      {
        uri: 'cdp/dom/snapshot',
        name: 'DOM Snapshot',
        description: 'Snapshot of the entire DOM with computed styles',
        mimeType: 'application/json'
      },
      
      // Network
      {
        uri: 'cdp/network/requests',
        name: 'Network Requests',
        description: 'All network requests and responses',
        mimeType: 'application/json'
      },
      {
        uri: 'cdp/network/websockets',
        name: 'WebSocket Connections',
        description: 'Active WebSocket connections and messages',
        mimeType: 'application/json'
      },
      
      // Performance
      {
        uri: 'cdp/performance/metrics',
        name: 'Performance Metrics',
        description: 'Core Web Vitals and performance metrics',
        mimeType: 'application/json'
      },
      {
        uri: 'cdp/performance/timeline',
        name: 'Performance Timeline',
        description: 'Performance timeline events',
        mimeType: 'application/json'
      },
      
      // Page
      {
        uri: 'cdp/page/info',
        name: 'Page Information',
        description: 'Current page URL, title, and metadata',
        mimeType: 'application/json'
      },
      {
        uri: 'cdp/page/resources',
        name: 'Page Resources',
        description: 'All resources loaded by the page',
        mimeType: 'application/json'
      },
      
      // Debugger
      {
        uri: 'cdp/debugger/scripts',
        name: 'Loaded Scripts',
        description: 'All JavaScript files loaded in the page',
        mimeType: 'application/json'
      },
      {
        uri: 'cdp/debugger/breakpoints',
        name: 'Active Breakpoints',
        description: 'Currently set breakpoints',
        mimeType: 'application/json'
      },
      
      // CSS
      {
        uri: 'cdp/css/stylesheets',
        name: 'Stylesheets',
        description: 'All loaded CSS stylesheets',
        mimeType: 'application/json'
      },
      {
        uri: 'cdp/css/computed',
        name: 'Computed Styles',
        description: 'Computed styles for elements',
        mimeType: 'application/json'
      },
      
      // Storage
      {
        uri: 'cdp/storage/cookies',
        name: 'Cookies',
        description: 'Browser cookies for current domain',
        mimeType: 'application/json'
      },
      {
        uri: 'cdp/storage/local',
        name: 'Local Storage',
        description: 'LocalStorage data',
        mimeType: 'application/json'
      },
      {
        uri: 'cdp/storage/session',
        name: 'Session Storage',
        description: 'SessionStorage data',
        mimeType: 'application/json'
      }
    ]
    
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
    const [, domain, resource] = uri.split('/')
    
    try {
      switch (`${domain}/${resource}`) {
        case 'runtime/console':
          return this.cdpProvider.getConsoleHistory(sessionId)
          
        case 'runtime/evaluate':
          return {
            description: 'Use the eval tool to evaluate JavaScript',
            example: 'document.title'
          }
          
        case 'dom/tree':
          return this.cdpProvider.getDOMNodes(sessionId)
          
        case 'dom/snapshot':
          return this.cdpProvider.getDOMSnapshot(sessionId)
          
        case 'network/requests':
          return this.cdpProvider.getNetworkRequests(sessionId)
          
        case 'network/websockets':
          return {
            description: 'WebSocket monitoring requires manual CDP setup',
            hint: 'Use Network domain events to track WebSocket connections'
          }
          
        case 'performance/metrics':
          return this.cdpProvider.getPerformanceMetrics(sessionId)
          
        case 'performance/timeline':
          return this.cdpProvider.getPerformanceTimeline(sessionId)
          
        case 'page/info':
          return this.cdpProvider.getPageFrameTree(sessionId)
          
        case 'page/resources':
          return this.cdpProvider.getPageMetrics(sessionId)
          
        case 'debugger/scripts':
          return {
            description: 'Use Debugger.scriptParsed events to track loaded scripts',
            hint: 'Enable Debugger domain first'
          }
          
        case 'debugger/breakpoints':
          return this.cdpProvider.getBreakpoints(sessionId)
          
        case 'css/stylesheets':
          return this.cdpProvider.getStyleSheets(sessionId)
          
        case 'css/computed':
          return {
            description: 'Use DOM tools to get computed styles for specific elements',
            hint: 'First get element nodeId, then query computed styles'
          }
          
        case 'storage/cookies':
          return {
            description: 'Use Storage or Network domains to access cookies',
            hint: 'Network.getCookies or Storage.getCookies'
          }
          
        case 'storage/local':
          return this.cdpProvider.getRuntimeProperties(sessionId, 'localStorage')
          
        case 'storage/session':
          return this.cdpProvider.getRuntimeProperties(sessionId, 'sessionStorage')
          
        default:
          throw new Error(`Unknown CDP resource: ${uri}`)
      }
    } catch (error) {
      logger.error({ error, uri }, 'Failed to read CDP resource')
      throw error
    }
  }
}