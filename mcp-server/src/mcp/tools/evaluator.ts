import type { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { ChromeManager } from '../../chrome/manager.js'
import { logger } from '../../config/logger.js'

const EvaluateSchema = z.object({
  expression: z.string(),
  sessionId: z.string()
})

export function setupEvalTool(server: Server) {
  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async (request) => {

    return {
      tools: [
        {
          name: 'eval',
          description: 'Evaluate JavaScript expression in page context',
          inputSchema: {
            type: 'object',
            properties: {
              expression: {
                type: 'string',
                description: 'JavaScript expression to evaluate',
              },
              context: {
                type: 'object',
                description: 'Optional context variables',
                additionalProperties: true,
              },
            },
            required: ['expression'],
          },
        },
      ],
    }
  })

  // Handle eval tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params

    if (name !== 'eval' && name !== 'console/evaluate') {
      throw new Error(`Unknown tool: ${name}`)
    }

    try {
      logger.info({ expression: args?.expression }, 'Evaluating expression')

      // Validate input
      const input = EvaluateSchema.parse(args)
      
      const manager = ChromeManager.getInstance()
      const client = manager.getClient()
      
      // Evaluate expression in Chrome
      const result = await client.evaluate(input.sessionId, input.expression)
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      }
    } catch (error) {
      logger.error({ error }, 'Failed to evaluate expression')
      throw error
    }
  })
}