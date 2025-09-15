/**
 * Screenshot tool for MCP
 */

import type { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { ChromeManager } from '../../chrome/manager.js'
import { logger } from '../../config/logger.js'

const ScreenshotSchema = z.object({
  sessionId: z.string()
})

export function setupScreenshotTool(server: Server) {
  server.setRequestHandler(ListToolsRequestSchema, async (request) => {
    logger.debug('Screenshot tool list request')
    
    return {
      tools: [
        {
      name: 'page/screenshot',
      description: 'Take a screenshot of the current page',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: 'Session ID of the browser page'
          }
        },
        required: ['sessionId']
      }
        }
      ]
    }
  })

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params
    
    if (name === 'page/screenshot') {
      logger.info('Screenshot requested', args)
      
      try {
        // Validate input
        const input = ScreenshotSchema.parse(args)
        
        const manager = ChromeManager.getInstance()
        const client = manager.getClient()
        
        // Take screenshot
        const screenshot = await client.screenshot(input.sessionId)
        
        return {
          content: [
            {
              type: 'text',
              text: `Screenshot captured successfully (${screenshot.width}x${screenshot.height})`
            },
            {
              type: 'image',
              data: screenshot.data,
              mimeType: 'image/png'
            }
          ],
          result: {
            sessionId: input.sessionId,
            timestamp: new Date().toISOString(),
            size: Buffer.from(screenshot.data, 'base64').length
          }
        }
      } catch (error) {
        logger.error('Screenshot failed', error)
        return {
          content: [
            {
              type: 'text',
              text: `Screenshot failed: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        }
      }
    }
    
    // Return empty for non-screenshot tools
    return { content: [] }
  })
}