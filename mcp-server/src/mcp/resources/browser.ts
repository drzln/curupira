/**
 * Browser status resource for MCP
 */

import type { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { ListResourcesRequestSchema, ReadResourceRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { ChromeManager } from '../../chrome/manager.js'
import { logger } from '../../config/logger.js'

export function setupBrowserResource(server: Server) {
  server.setRequestHandler(ListResourcesRequestSchema, async (request) => {
    logger.debug('Browser resource list request')
    
    return {
      resources: [
        {
          uri: 'browser://status',
          name: 'browser/status',
          mimeType: 'application/json',
          description: 'Current browser connection status and capabilities'
        }
      ]
    }
  })

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params
    
    if (uri === 'browser://status' || uri === 'browser/status') {
      logger.debug('Reading browser status')
      
      try {
        const manager = ChromeManager.getInstance()
        const status = manager.getStatus()
        
        return {
          contents: [
            {
              uri: 'browser://status',
              mimeType: 'application/json',
              text: JSON.stringify({
                connected: status.connected,
                serviceUrl: status.serviceUrl,
                activeSessions: status.activeSessions,
                sessions: status.sessions.map(s => ({
                  sessionId: s.sessionId,
                  createdAt: s.createdAt.toISOString(),
                  duration: Date.now() - s.createdAt.getTime()
                })),
                capabilities: {
                  screenshot: true,
                  evaluate: true,
                  navigate: true,
                  profiling: true,
                  debugging: true
                }
              }, null, 2)
            }
          ]
        }
      } catch (error) {
        logger.error('Failed to get browser status', error)
        return {
          contents: [
            {
              uri: 'browser://status',
              mimeType: 'application/json',
              text: JSON.stringify({
                connected: false,
                error: error instanceof Error ? error.message : String(error)
              }, null, 2)
            }
          ]
        }
      }
    }
    
    // Return empty for non-browser resources
    return { contents: [] }
  })
}