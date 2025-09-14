import type { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { logger } from '../../config/logger.js'

export function setupDebuggingPrompts(server: Server) {
  // List available prompts
  server.setRequestHandler('prompts/list', async (request) => {
    if (request.method !== 'prompts/list') return

    return {
      prompts: [
        {
          name: 'debug-lazy-loading',
          description: 'Debug lazy-loaded component issues',
          arguments: [
            {
              name: 'componentName',
              description: 'Name of the component having issues',
              required: true,
            },
          ],
        },
        {
          name: 'trace-graphql-error',
          description: 'Trace GraphQL query errors',
          arguments: [
            {
              name: 'operation',
              description: 'GraphQL operation name',
              required: true,
            },
            {
              name: 'error',
              description: 'Error message',
              required: true,
            },
          ],
        },
        {
          name: 'profile-performance',
          description: 'Profile component render performance',
          arguments: [
            {
              name: 'component',
              description: 'Component to profile',
              required: false,
            },
          ],
        },
      ],
    }
  })

  // Get prompt template
  server.setRequestHandler('prompts/get', async (request) => {
    if (request.method !== 'prompts/get') return

    const { name, arguments: args } = request.params as {
      name: string
      arguments?: Record<string, string>
    }

    logger.debug({ name, args }, 'Getting prompt template')

    let messages = []

    switch (name) {
      case 'debug-lazy-loading':
        messages = [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Debug why the ${args?.componentName || 'component'} is stuck in loading state. Check:
1. Static vs dynamic imports
2. XState machine transitions
3. Loading state conditions
4. Error boundaries
5. Network requests`,
            },
          },
        ]
        break

      case 'trace-graphql-error':
        messages = [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Trace GraphQL error for operation "${args?.operation || 'unknown'}":
Error: ${args?.error || 'Unknown error'}

Check:
1. Query structure vs schema
2. Apollo cache state
3. Network request/response
4. Variable types
5. Server-side resolver`,
            },
          },
        ]
        break

      case 'profile-performance':
        messages = [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Profile render performance${args?.component ? ` for ${args.component}` : ''}:
1. Start performance recording
2. Trigger re-renders
3. Analyze flame graph
4. Check unnecessary renders
5. Identify optimization opportunities`,
            },
          },
        ]
        break

      default:
        throw new Error(`Unknown prompt: ${name}`)
    }

    return {
      description: `Debugging prompt for ${name}`,
      messages,
    }
  })
}