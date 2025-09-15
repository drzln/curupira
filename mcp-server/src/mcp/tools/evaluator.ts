import type { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { logger } from '../../config/logger.js'

// Store active evaluation sessions
const evaluationSessions = new Map<string, any>()

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

    if (name !== 'eval') {
      throw new Error(`Unknown tool: ${name}`)
    }

    try {
      logger.info({ expression: args?.expression }, 'Evaluating expression')

      // TODO: Send to Chrome extension for execution
      // For now, return a placeholder
      const result = {
        value: 'Expression evaluation not yet implemented',
        type: 'string',
        timestamp: Date.now(),
      }

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