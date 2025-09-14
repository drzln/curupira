import type { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { ListResourcesRequestSchema, ReadResourceRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import type { ConsoleMessage } from '@curupira/shared/types'
import { logger } from '../../config/logger.js'

// Access browser state from global
declare global {
  var curupiraBrowserState: {
    consoleLogs: ConsoleMessage[]
    networkRequests: any[]
    domSnapshot: any
    componentStates: Map<string, any>
  }
}

export function setupConsoleResource(server: Server) {
  // List available console resources
  server.setRequestHandler(ListResourcesRequestSchema, async (request) => {

    return {
      resources: [
        {
          uri: 'console://logs',
          name: 'Console Logs',
          description: 'Browser console logs (log, warn, error, info, debug)',
          mimeType: 'application/json',
        },
      ],
    }
  })

  // Get console logs
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    
    const { uri } = request.params as { uri: string }
    if (!uri?.startsWith('console://')) {
      throw new Error('Invalid resource URI')
    }

    const url = new URL(uri)
    const level = url.searchParams.get('level')
    const limit = parseInt(url.searchParams.get('limit') || '100', 10)

    // Get logs from browser state
    let logs = global.curupiraBrowserState?.consoleLogs || []

    // Filter by level if specified
    if (level) {
      logs = logs.filter((log) => log.level === level)
    }

    // Apply limit
    logs = logs.slice(-limit)

    logger.debug({ count: logs.length, level }, 'Returning console logs')

    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(logs, null, 2),
        },
      ],
    }
  })
}