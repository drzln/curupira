/**
 * Browser status resource provider using DI pattern
 */

import type { IChromeService } from '../../core/interfaces/chrome-service.interface.js'
import type { ILogger } from '../../core/interfaces/logger.interface.js'
import type { IResourceRegistry } from '../../core/interfaces/resource-registry.interface.js'

export interface BrowserResourceProvider {
  name: string
  listResources(): Promise<any[]>
  readResource(uri: string): Promise<any>
}

export function createBrowserResourceProvider(
  chromeService: IChromeService,
  logger: ILogger
): BrowserResourceProvider {
  return {
    name: 'browser',
    
    async listResources() {
      return [
        {
          uri: 'browser://status',
          name: 'browser/status',
          mimeType: 'application/json',
          description: 'Current browser connection status and capabilities'
        }
      ]
    },

    async readResource(uri: string) {
      if (uri === 'browser://status' || uri === 'browser/status') {
        logger.debug('Reading browser status')
        
        try {
          const client = chromeService.getCurrentClient()
          
          return {
            connected: !!client,
            serviceUrl: 'chrome://localhost:9222',
            activeSessions: client ? 1 : 0,
            sessions: client ? [{
              sessionId: 'default',
              createdAt: new Date().toISOString(),
              duration: 0
            }] : [],
            capabilities: {
              screenshot: true,
              evaluate: true,
              navigate: true,
              profiling: true,
              debugging: true
            }
          }
        } catch (error) {
          logger.error({ error }, 'Failed to get browser status')
          return {
            connected: false,
            error: error instanceof Error ? error.message : String(error)
          }
        }
      }
      
      throw new Error(`Resource not found: ${uri}`)
    }
  }
}