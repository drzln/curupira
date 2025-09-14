import type { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { ListResourcesRequestSchema, ReadResourceRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { CircularBuffer } from '@curupira/shared'
import { logger } from '../../config/logger.js'

// Console log resource type
interface ConsoleLogResource {
  timestamp: number
  level: string
  message: string
  args?: unknown[]
  stackTrace?: string
}

const consoleBuffer = new CircularBuffer<ConsoleLogResource>(1000)

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

    let logs = consoleBuffer.getAll()

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

// Export function to add logs (called from Chrome extension)
export function addConsoleLog(log: ConsoleLogResource) {
  consoleBuffer.push(log)
  logger.debug({ level: log.level }, 'Added console log')
}