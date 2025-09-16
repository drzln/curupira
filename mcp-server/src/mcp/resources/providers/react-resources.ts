/**
 * React Resource Provider - Handles all React framework resources
 * Implements ResourceProvider interface for registry pattern
 */

import type { Resource } from '@modelcontextprotocol/sdk/types.js'
import type { SessionId } from '@curupira/shared/types'
import { ChromeManager } from '../../../chrome/manager.js'
import { logger } from '../../../config/logger.js'
import type { ResourceProvider } from '../registry.js'
import { ReactFrameworkProvider } from './react.js'

export class ReactResourceProviderImpl implements ResourceProvider {
  name = 'react'
  private reactProvider: ReactFrameworkProvider
  private isReactDetected = false
  
  constructor() {
    this.reactProvider = new ReactFrameworkProvider()
  }
  
  async detectReact(): Promise<boolean> {
    try {
      const chromeManager = ChromeManager.getInstance()
      const client = chromeManager.getClient()
      const sessions = client.getSessions()
      
      if (sessions.length === 0) {
        return false
      }
      
      const sessionId = sessions[0].sessionId as SessionId
      const reactInfo = await this.reactProvider.detectReact(sessionId)
      this.isReactDetected = reactInfo !== null
      return this.isReactDetected
    } catch (error) {
      logger.error({ error }, 'Failed to detect React')
      return false
    }
  }
  
  async listResources(): Promise<Resource[]> {
    // Only list React resources if React is detected
    if (!this.isReactDetected) {
      await this.detectReact()
    }
    
    if (!this.isReactDetected) {
      return []
    }
    
    return [
      {
        uri: 'react/fiber-tree',
        name: 'React Fiber Tree',
        description: 'React component tree structure',
        mimeType: 'application/json'
      },
      {
        uri: 'react/components',
        name: 'React Components',
        description: 'List of all React components in the page',
        mimeType: 'application/json'
      },
      {
        uri: 'react/hooks',
        name: 'React Hooks',
        description: 'Hook values and dependencies for components',
        mimeType: 'application/json'
      },
      {
        uri: 'react/props',
        name: 'Component Props',
        description: 'Props for all mounted components',
        mimeType: 'application/json'
      },
      {
        uri: 'react/state',
        name: 'Component State',
        description: 'State values for all stateful components',
        mimeType: 'application/json'
      },
      {
        uri: 'react/context',
        name: 'React Contexts',
        description: 'Active React context providers and values',
        mimeType: 'application/json'
      },
      {
        uri: 'react/performance',
        name: 'React Performance',
        description: 'React rendering performance data',
        mimeType: 'application/json'
      },
      {
        uri: 'react/profiler',
        name: 'React Profiler Data',
        description: 'Profiler data for performance analysis',
        mimeType: 'application/json'
      }
    ]
  }
  
  async readResource(uri: string): Promise<unknown> {
    const chromeManager = ChromeManager.getInstance()
    const client = chromeManager.getClient()
    const sessions = client.getSessions()
    
    if (sessions.length === 0) {
      throw new Error('No active Chrome sessions')
    }
    
    const sessionId = sessions[0].sessionId as SessionId
    const [, resource] = uri.split('/')
    
    try {
      switch (resource) {
        case 'fiber-tree':
          return this.reactProvider.getFiberTree(sessionId)
          
        case 'components':
          return this.reactProvider.getFiberTree(sessionId)
          
        case 'hooks':
          return {
            description: 'Use react_inspect_hooks tool for specific components',
            hint: 'Hooks require component ID'
          }
          
        case 'props':
          return {
            description: 'Use react_inspect_props tool for specific components',
            hint: 'Props require component ID'
          }
          
        case 'state':
          return {
            description: 'Use react_inspect_state tool for specific components',
            hint: 'State requires component ID'
          }
          
        case 'context':
          return {
            description: 'React context detection in development',
            hint: 'Use React DevTools for context inspection'
          }
          
        case 'performance':
          return this.reactProvider.getReactPerformance(sessionId)
          
        case 'profiler':
          return {
            description: 'Use react_profile_renders tool for profiling',
            hint: 'Start profiling session first'
          }
          
        default:
          throw new Error(`Unknown React resource: ${uri}`)
      }
    } catch (error) {
      logger.error({ error, uri }, 'Failed to read React resource')
      throw error
    }
  }
}