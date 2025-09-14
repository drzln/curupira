import type { Server } from '@modelcontextprotocol/sdk/server/index.js'
import type { EvaluateParams } from '@curupira/shared'
import { logger } from '../../config/logger.js'

// Store active evaluation sessions
const evaluationSessions = new Map<string, any>()

export function setupEvalTool(server: Server) {
  // List available tools
  server.setRequestHandler('tools/list', async (request) => {
    if (request.method !== 'tools/list') return

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
  server.setRequestHandler('tools/call', async (request) => {
    if (request.method !== 'tools/call') return
    
    const { name, arguments: args } = request.params as {
      name: string
      arguments: EvaluateParams
    }

    if (name !== 'eval') return

    try {
      logger.info({ expression: args.expression }, 'Evaluating expression')

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