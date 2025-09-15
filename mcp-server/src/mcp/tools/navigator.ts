/**
 * Page navigation tool for MCP
 */

import type { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { ChromeManager } from '../../chrome/manager.js'
import { logger } from '../../config/logger.js'

const NavigateSchema = z.object({
  url: z.string().url('Invalid URL format'),
  sessionId: z.string().optional()
})

export function setupNavigatorTool(server: Server) {
  server.setRequestHandler(ListToolsRequestSchema, async (request) => {
    logger.debug('Navigator tool list request')
    
    return {
      tools: [
        {
      name: 'page/navigate',
      description: 'Navigate to a URL in the browser',
      inputSchema: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'URL to navigate to',
            format: 'uri'
          },
          sessionId: {
            type: 'string',
            description: 'Session ID (optional, creates new if not provided)'
          }
        },
        required: ['url']
      }
        }
      ]
    }
  })

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params
    
    if (name === 'page/navigate') {
      logger.info('Page navigation requested', args)
      
      try {
        // Validate input
        const input = NavigateSchema.parse(args)
        
        const manager = ChromeManager.getInstance()
        const client = manager.getClient()
        
        // Use existing session or create new one
        let sessionId = input.sessionId
        if (!sessionId) {
          sessionId = await manager.createSession()
          logger.info('Created new browser session', { sessionId })
        }
        
        // Navigate to URL
        await client.navigate(sessionId, input.url)
        
        // Wait a bit for page to load
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        // Get page title
        const title = await client.evaluate(sessionId, 'document.title')
        const currentUrl = await client.evaluate(sessionId, 'window.location.href')
        
        return {
          content: [
            {
              type: 'text',
              text: `Successfully navigated to ${input.url}`
            }
          ],
          result: {
            sessionId,
            url: currentUrl,
            title,
            timestamp: new Date().toISOString()
          }
        }
      } catch (error) {
        logger.error('Navigation failed', error)
        return {
          content: [
            {
              type: 'text',
              text: `Navigation failed: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        }
      }
    }
    
    // Return empty for non-navigation tools
    return { content: [] }
  })
}