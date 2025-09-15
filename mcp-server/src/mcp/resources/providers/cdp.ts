/**
 * Chrome DevTools Protocol Resource Provider
 * Provides direct access to all CDP domains and capabilities
 * 
 * Level 2: MCP Core (depends on Level 0-1)
 */

import type { SessionId, CDPSession } from '@curupira/shared/types'

// Define TargetId locally since it's not exported from shared types
type TargetId = string & { readonly _brand: 'TargetId' }
import { ChromeManager } from '../../../chrome/manager.js'
import { logger } from '../../../config/logger.js'

export interface CDPResourceProvider {
  // Runtime Domain Resources
  getRuntimeProperties(sessionId: SessionId, objectId?: string): Promise<unknown>
  getRuntimeCallFrame(sessionId: SessionId): Promise<unknown>
  getGlobalObject(sessionId: SessionId): Promise<unknown>
  
  // DOM Domain Resources  
  getDOMSnapshot(sessionId: SessionId): Promise<unknown>
  getDOMNodes(sessionId: SessionId, selector?: string): Promise<unknown>
  getComputedStyles(sessionId: SessionId, nodeId: number): Promise<unknown>
  
  // Network Domain Resources
  getNetworkRequests(sessionId: SessionId): Promise<unknown>
  getNetworkTiming(sessionId: SessionId, requestId: string): Promise<unknown>
  getNetworkCookies(sessionId: SessionId): Promise<unknown>
  
  // Page Domain Resources
  getPageFrameTree(sessionId: SessionId): Promise<unknown>
  getPageNavigationHistory(sessionId: SessionId): Promise<unknown>
  getPageMetrics(sessionId: SessionId): Promise<unknown>
  
  // Performance Domain Resources
  getPerformanceMetrics(sessionId: SessionId): Promise<unknown>
  getPerformanceTimeline(sessionId: SessionId): Promise<unknown>
  
  // Debugger Domain Resources
  getBreakpoints(sessionId: SessionId): Promise<unknown>
  getCallStack(sessionId: SessionId): Promise<unknown>
  getVariableScope(sessionId: SessionId, callFrameId: string): Promise<unknown>
  
  // Console Domain Resources
  getConsoleHistory(sessionId: SessionId): Promise<unknown>
  
  // CSS Domain Resources
  getStyleSheets(sessionId: SessionId): Promise<unknown>
  getMatchedStyles(sessionId: SessionId, nodeId: number): Promise<unknown>
}

export class ChromeCDPResourceProvider implements CDPResourceProvider {
  private chromeManager: ChromeManager
  private enabledDomains: Map<SessionId, Set<string>> = new Map()

  constructor() {
    this.chromeManager = ChromeManager.getInstance()
  }

  private async ensureDomainsEnabled(sessionId: SessionId, domains: string[]): Promise<void> {
    const sessionDomains = this.enabledDomains.get(sessionId) || new Set()
    
    for (const domain of domains) {
      if (!sessionDomains.has(domain)) {
        try {
          const client = this.chromeManager.getClient()
          await client.send(`${domain}.enable`, {}, sessionId)
          sessionDomains.add(domain)
          logger.debug(`Enabled CDP domain: ${domain} for session: ${sessionId}`)
        } catch (error) {
          logger.error(`Failed to enable domain ${domain}:`, error)
          throw new Error(`Failed to enable CDP domain: ${domain}`)
        }
      }
    }
    
    this.enabledDomains.set(sessionId, sessionDomains)
  }

  // Runtime Domain Implementation
  async getRuntimeProperties(sessionId: SessionId, objectId?: string): Promise<unknown> {
    await this.ensureDomainsEnabled(sessionId, ['Runtime'])
    
    const client = this.chromeManager.getClient()
    
    if (objectId) {
      // Get properties of specific object
      return await client.send('Runtime.getProperties', {
        objectId,
        ownProperties: true,
        generatePreview: true
      }, sessionId)
    } else {
      // Get global object
      const result = await client.send('Runtime.evaluate', {
        expression: 'window',
        returnByValue: false,
        generatePreview: true
      }, sessionId)
      
      if (result && typeof result === 'object' && 'result' in result) {
        const evalResult = result as { result: { objectId?: string } }
        if (evalResult.result.objectId) {
          return await client.send('Runtime.getProperties', {
            objectId: evalResult.result.objectId,
            ownProperties: true,
            generatePreview: true
          }, sessionId)
        }
      }
      
      return result
    }
  }

  async getRuntimeCallFrame(sessionId: SessionId): Promise<unknown> {
    await this.ensureDomainsEnabled(sessionId, ['Runtime', 'Debugger'])
    
    const client = this.chromeManager.getClient()
    
    // First pause execution to get call frames
    try {
      await client.send('Debugger.pause', {}, sessionId)
      
      // Small delay to ensure pause is processed
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Get current call stack
      const result = await client.send('Debugger.getCurrentCallStack', {}, sessionId)
      
      // Resume execution
      await client.send('Debugger.resume', {}, sessionId)
      
      return result
    } catch (error) {
      logger.error('Failed to get call frame:', error)
      // Try to resume anyway
      try {
        await client.send('Debugger.resume', {}, sessionId)
      } catch (resumeError) {
        logger.error('Failed to resume after call frame error:', resumeError)
      }
      throw error
    }
  }

  async getGlobalObject(sessionId: SessionId): Promise<unknown> {
    await this.ensureDomainsEnabled(sessionId, ['Runtime'])
    
    const client = this.chromeManager.getClient()
    
    return await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const global = window;
          const keys = Object.getOwnPropertyNames(global);
          const result = {};
          
          // Get important global properties
          const importantGlobals = [
            'React', 'ReactDOM', '__REACT_DEVTOOLS_GLOBAL_HOOK__',
            'Vue', '$', 'jQuery', 'angular', 'ng',
            'console', 'document', 'location', 'navigator',
            'localStorage', 'sessionStorage',
            'performance', 'requestAnimationFrame'
          ];
          
          for (const key of importantGlobals) {
            if (key in global) {
              try {
                result[key] = typeof global[key] === 'function' ? '[Function]' : 
                             typeof global[key] === 'object' && global[key] !== null ? '[Object]' :
                             global[key];
              } catch (e) {
                result[key] = '[Error accessing property]';
              }
            }
          }
          
          result._totalGlobals = keys.length;
          return result;
        })()
      `,
      returnByValue: true
    }, sessionId)
  }

  // DOM Domain Implementation
  async getDOMSnapshot(sessionId: SessionId): Promise<unknown> {
    await this.ensureDomainsEnabled(sessionId, ['DOM', 'DOMSnapshot'])
    
    const client = this.chromeManager.getClient()
    
    return await client.send('DOMSnapshot.captureSnapshot', {
      computedStyles: [],
      includePaintOrder: true,
      includeDOMRects: true
    }, sessionId)
  }

  async getDOMNodes(sessionId: SessionId, selector?: string): Promise<unknown> {
    await this.ensureDomainsEnabled(sessionId, ['DOM'])
    
    const client = this.chromeManager.getClient()
    
    // Get document root first
    const doc = await client.send('DOM.getDocument', { depth: -1 }, sessionId)
    
    if (selector) {
      // Find nodes by selector
      return await client.send('DOM.querySelectorAll', {
        nodeId: (doc as any).root.nodeId,
        selector
      }, sessionId)
    } else {
      // Return document tree
      return doc
    }
  }

  async getComputedStyles(sessionId: SessionId, nodeId: number): Promise<unknown> {
    await this.ensureDomainsEnabled(sessionId, ['CSS', 'DOM'])
    
    const client = this.chromeManager.getClient()
    
    return await client.send('CSS.getComputedStyleForNode', {
      nodeId
    }, sessionId)
  }

  // Network Domain Implementation  
  async getNetworkRequests(sessionId: SessionId): Promise<unknown> {
    await this.ensureDomainsEnabled(sessionId, ['Network'])
    
    // Note: Network events are captured over time, not retrieved on demand
    // This would typically return cached network events
    const networkEvents = (global as any).curupiraBrowserState?.networkRequests || []
    
    return {
      requests: networkEvents,
      count: networkEvents.length,
      lastUpdated: new Date().toISOString()
    }
  }

  async getNetworkTiming(sessionId: SessionId, requestId: string): Promise<unknown> {
    await this.ensureDomainsEnabled(sessionId, ['Network'])
    
    const client = this.chromeManager.getClient()
    
    return await client.send('Network.getResponseBodyForInterception', {
      interceptionId: requestId
    }, sessionId)
  }

  async getNetworkCookies(sessionId: SessionId): Promise<unknown> {
    await this.ensureDomainsEnabled(sessionId, ['Network'])
    
    const client = this.chromeManager.getClient()
    
    return await client.send('Network.getAllCookies', {}, sessionId)
  }

  // Page Domain Implementation
  async getPageFrameTree(sessionId: SessionId): Promise<unknown> {
    await this.ensureDomainsEnabled(sessionId, ['Page'])
    
    const client = this.chromeManager.getClient()
    
    return await client.send('Page.getFrameTree', {}, sessionId)
  }

  async getPageNavigationHistory(sessionId: SessionId): Promise<unknown> {
    await this.ensureDomainsEnabled(sessionId, ['Page'])
    
    const client = this.chromeManager.getClient()
    
    return await client.send('Page.getNavigationHistory', {}, sessionId)
  }

  async getPageMetrics(sessionId: SessionId): Promise<unknown> {
    await this.ensureDomainsEnabled(sessionId, ['Page'])
    
    const client = this.chromeManager.getClient()
    
    // Get layout metrics
    const layoutMetrics = await client.send('Page.getLayoutMetrics', {}, sessionId)
    
    // Get app manifest if available
    let manifest = null
    try {
      manifest = await client.send('Page.getAppManifest', {}, sessionId)
    } catch (error) {
      // Manifest might not be available
      logger.debug('No app manifest available')
    }
    
    return {
      layout: layoutMetrics,
      manifest,
      timestamp: new Date().toISOString()
    }
  }

  // Performance Domain Implementation
  async getPerformanceMetrics(sessionId: SessionId): Promise<unknown> {
    await this.ensureDomainsEnabled(sessionId, ['Performance'])
    
    const client = this.chromeManager.getClient()
    
    return await client.send('Performance.getMetrics', {}, sessionId)
  }

  async getPerformanceTimeline(sessionId: SessionId): Promise<unknown> {
    await this.ensureDomainsEnabled(sessionId, ['Performance'])
    
    // Performance timeline events are captured over time
    const performanceEvents = (global as any).curupiraBrowserState?.performanceEvents || []
    
    return {
      events: performanceEvents,
      count: performanceEvents.length,
      lastUpdated: new Date().toISOString()
    }
  }

  // Debugger Domain Implementation
  async getBreakpoints(sessionId: SessionId): Promise<unknown> {
    await this.ensureDomainsEnabled(sessionId, ['Debugger'])
    
    // Breakpoints are managed state, return from cache
    const breakpoints = (global as any).curupiraBrowserState?.breakpoints || []
    
    return {
      breakpoints,
      count: breakpoints.length,
      active: breakpoints.filter((bp: any) => bp.enabled).length
    }
  }

  async getCallStack(sessionId: SessionId): Promise<unknown> {
    await this.ensureDomainsEnabled(sessionId, ['Debugger'])
    
    // Call stack is only available when paused
    const callStack = (global as any).curupiraBrowserState?.callStack || []
    
    return {
      frames: callStack,
      depth: callStack.length,
      paused: callStack.length > 0
    }
  }

  async getVariableScope(sessionId: SessionId, callFrameId: string): Promise<unknown> {
    await this.ensureDomainsEnabled(sessionId, ['Debugger'])
    
    const client = this.chromeManager.getClient()
    
    try {
      return await client.send('Debugger.evaluateOnCallFrame', {
        callFrameId,
        expression: 'this',
        generatePreview: true
      }, sessionId)
    } catch (error) {
      logger.error('Failed to get variable scope:', error)
      return {
        error: 'Variables scope not available (not paused at breakpoint)',
        callFrameId
      }
    }
  }

  // Console Domain Implementation
  async getConsoleHistory(sessionId: SessionId): Promise<unknown> {
    await this.ensureDomainsEnabled(sessionId, ['Console'])
    
    // Console messages are captured via events
    const consoleMessages = (global as any).curupiraBrowserState?.consoleLogs || []
    
    return {
      messages: consoleMessages,
      count: consoleMessages.length,
      byLevel: consoleMessages.reduce((acc: any, msg: any) => {
        acc[msg.level] = (acc[msg.level] || 0) + 1
        return acc
      }, {})
    }
  }

  // CSS Domain Implementation
  async getStyleSheets(sessionId: SessionId): Promise<unknown> {
    await this.ensureDomainsEnabled(sessionId, ['CSS'])
    
    const client = this.chromeManager.getClient()
    
    return await client.send('CSS.getAllStyleSheets', {}, sessionId)
  }

  async getMatchedStyles(sessionId: SessionId, nodeId: number): Promise<unknown> {
    await this.ensureDomainsEnabled(sessionId, ['CSS'])
    
    const client = this.chromeManager.getClient()
    
    return await client.send('CSS.getMatchedStylesForNode', {
      nodeId
    }, sessionId)
  }
}