/**
 * Browser resource provider
 * 
 * Provides browser state and metadata as MCP resources
 */

import type { PageDomain } from '../chrome/domains/page.js'
import type { RuntimeDomain } from '../chrome/domains/runtime.js'
import type { Resource, ResourceTemplate } from '@modelcontextprotocol/sdk/types.js'
import { logger } from '../config/logger.js'

export class BrowserResourceProvider {
  private readonly resourcePrefix = 'browser'

  constructor(
    private page: PageDomain,
    private runtime: RuntimeDomain
  ) {}

  /**
   * List available browser resources
   */
  async listResources(): Promise<Resource[]> {
    const resources: Resource[] = [
      {
        uri: `${this.resourcePrefix}://page/info`,
        name: 'Page Information',
        description: 'Current page URL, title, and metadata',
        mimeType: 'application/json'
      },
      {
        uri: `${this.resourcePrefix}://page/metrics`,
        name: 'Page Metrics',
        description: 'Page performance metrics and layout information',
        mimeType: 'application/json'
      },
      {
        uri: `${this.resourcePrefix}://console/logs`,
        name: 'Console Logs',
        description: 'Browser console output (last 1000 entries)',
        mimeType: 'application/json'
      },
      {
        uri: `${this.resourcePrefix}://navigation/history`,
        name: 'Navigation History',
        description: 'Browser navigation history',
        mimeType: 'application/json'
      },
      {
        uri: `${this.resourcePrefix}://frames`,
        name: 'Frame Tree',
        description: 'Page frame hierarchy',
        mimeType: 'application/json'
      },
      {
        uri: `${this.resourcePrefix}://cookies`,
        name: 'Cookies',
        description: 'All cookies for the current page',
        mimeType: 'application/json'
      },
      {
        uri: `${this.resourcePrefix}://storage/local`,
        name: 'Local Storage',
        description: 'Local storage data',
        mimeType: 'application/json'
      },
      {
        uri: `${this.resourcePrefix}://storage/session`,
        name: 'Session Storage',
        description: 'Session storage data',
        mimeType: 'application/json'
      },
      {
        uri: `${this.resourcePrefix}://performance/timing`,
        name: 'Performance Timing',
        description: 'Navigation and resource timing data',
        mimeType: 'application/json'
      }
    ]

    return resources
  }

  /**
   * Get resource templates
   */
  getResourceTemplates(): ResourceTemplate[] {
    return [
      {
        uriTemplate: `${this.resourcePrefix}://page/{property}`,
        name: 'Page Property',
        description: 'Access specific page properties',
        mimeType: 'application/json'
      },
      {
        uriTemplate: `${this.resourcePrefix}://eval/{expression}`,
        name: 'Evaluate Expression',
        description: 'Evaluate JavaScript expression in page context',
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
      const path = url.pathname.substring(2) // Remove leading //
      
      switch (path) {
        case 'page/info':
          return this.getPageInfo()
        
        case 'page/metrics':
          return this.getPageMetrics()
        
        case 'console/logs':
          return this.getConsoleLogs()
        
        case 'navigation/history':
          return this.getNavigationHistory()
        
        case 'frames':
          return this.getFrameTree()
        
        case 'cookies':
          return this.getCookies()
        
        case 'storage/local':
          return this.getLocalStorage()
        
        case 'storage/session':
          return this.getSessionStorage()
        
        case 'performance/timing':
          return this.getPerformanceTiming()
        
        default:
          // Check if it's a template match
          if (path.startsWith('page/')) {
            const property = path.substring(5)
            return this.getPageProperty(property)
          }
          
          if (path.startsWith('eval/')) {
            const expression = decodeURIComponent(path.substring(5))
            return this.evaluateExpression(expression)
          }
          
          throw new Error(`Unknown resource: ${uri}`)
      }
    } catch (error) {
      logger.error('Failed to read browser resource', { uri, error })
      throw error
    }
  }

  /**
   * Get page information
   */
  private async getPageInfo(): Promise<{ content: string; mimeType: string }> {
    const info = await this.runtime.evaluate<{
      url: string
      title: string
      referrer: string
      readyState: string
      characterSet: string
      contentType: string
      lastModified: string
      visibilityState: string
    }>(`
      ({
        url: window.location.href,
        title: document.title,
        referrer: document.referrer,
        readyState: document.readyState,
        characterSet: document.characterSet,
        contentType: document.contentType,
        lastModified: document.lastModified,
        visibilityState: document.visibilityState
      })
    `)

    return {
      content: JSON.stringify(info.value || {}, null, 2),
      mimeType: 'application/json'
    }
  }

  /**
   * Get page metrics
   */
  private async getPageMetrics(): Promise<{ content: string; mimeType: string }> {
    const metrics = await this.page.getLayoutMetrics()
    
    const content = {
      layoutViewport: metrics.layoutViewport,
      visualViewport: metrics.visualViewport,
      contentSize: metrics.contentSize,
      scrollOffset: {
        x: metrics.visualViewport.pageX,
        y: metrics.visualViewport.pageY
      },
      zoom: metrics.visualViewport.zoom
    }

    return {
      content: JSON.stringify(content, null, 2),
      mimeType: 'application/json'
    }
  }

  /**
   * Get console logs
   */
  private async getConsoleLogs(): Promise<{ content: string; mimeType: string }> {
    const logs = await this.runtime.evaluate<any[]>(`
      (() => {
        // Get logs from our console intercept if available
        if (window.__CURUPIRA_CONSOLE_LOGS__) {
          return window.__CURUPIRA_CONSOLE_LOGS__.slice(-1000)
        }
        
        // Fallback to empty array
        return []
      })()
    `)

    return {
      content: JSON.stringify(logs.value || [], null, 2),
      mimeType: 'application/json'
    }
  }

  /**
   * Get navigation history
   */
  private async getNavigationHistory(): Promise<{ content: string; mimeType: string }> {
    const history = await this.page.getNavigationHistory()
    
    return {
      content: JSON.stringify(history, null, 2),
      mimeType: 'application/json'
    }
  }

  /**
   * Get frame tree
   */
  private async getFrameTree(): Promise<{ content: string; mimeType: string }> {
    const frameTree = await this.page.getFrameTree()
    
    return {
      content: JSON.stringify(frameTree, null, 2),
      mimeType: 'application/json'
    }
  }

  /**
   * Get cookies
   */
  private async getCookies(): Promise<{ content: string; mimeType: string }> {
    const cookies = await this.runtime.evaluate<any[]>(`
      document.cookie.split(';').map(c => {
        const [name, ...valueParts] = c.trim().split('=')
        return { name, value: valueParts.join('=') }
      }).filter(c => c.name)
    `)

    return {
      content: JSON.stringify(cookies.value || [], null, 2),
      mimeType: 'application/json'
    }
  }

  /**
   * Get local storage
   */
  private async getLocalStorage(): Promise<{ content: string; mimeType: string }> {
    const storage = await this.runtime.evaluate<Record<string, string>>(`
      (() => {
        const items = {}
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key) {
            items[key] = localStorage.getItem(key)
          }
        }
        return items
      })()
    `)

    return {
      content: JSON.stringify(storage.value || {}, null, 2),
      mimeType: 'application/json'
    }
  }

  /**
   * Get session storage
   */
  private async getSessionStorage(): Promise<{ content: string; mimeType: string }> {
    const storage = await this.runtime.evaluate<Record<string, string>>(`
      (() => {
        const items = {}
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i)
          if (key) {
            items[key] = sessionStorage.getItem(key)
          }
        }
        return items
      })()
    `)

    return {
      content: JSON.stringify(storage.value || {}, null, 2),
      mimeType: 'application/json'
    }
  }

  /**
   * Get performance timing
   */
  private async getPerformanceTiming(): Promise<{ content: string; mimeType: string }> {
    const timing = await this.runtime.evaluate<any>(`
      (() => {
        const navigation = performance.getEntriesByType('navigation')[0]
        const resources = performance.getEntriesByType('resource')
        
        return {
          navigation: navigation ? {
            domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
            loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
            domInteractive: navigation.domInteractive - navigation.fetchStart,
            firstPaint: navigation.responseEnd - navigation.fetchStart
          } : null,
          resources: resources.slice(0, 50).map(r => ({
            name: r.name,
            duration: r.duration,
            size: r.transferSize,
            type: r.initiatorType
          })),
          memory: performance.memory ? {
            usedJSHeapSize: performance.memory.usedJSHeapSize,
            totalJSHeapSize: performance.memory.totalJSHeapSize,
            jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
          } : null
        }
      })()
    `)

    return {
      content: JSON.stringify(timing.value || {}, null, 2),
      mimeType: 'application/json'
    }
  }

  /**
   * Get specific page property
   */
  private async getPageProperty(property: string): Promise<{ content: string; mimeType: string }> {
    const result = await this.runtime.evaluate(`
      (() => {
        const props = ${JSON.stringify(property)}.split('.')
        let value = window
        for (const prop of props) {
          value = value[prop]
          if (value === undefined) break
        }
        return value
      })()
    `)

    return {
      content: JSON.stringify(result.value, null, 2),
      mimeType: 'application/json'
    }
  }

  /**
   * Evaluate expression
   */
  private async evaluateExpression(expression: string): Promise<{ content: string; mimeType: string }> {
    const result = await this.runtime.evaluate(expression)
    
    return {
      content: JSON.stringify({
        value: result.value,
        error: result.error?.message
      }, null, 2),
      mimeType: 'application/json'
    }
  }
}