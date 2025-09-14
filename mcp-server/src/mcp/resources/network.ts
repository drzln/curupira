import type { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { CircularBuffer } from '@curupira/shared'
import { logger } from '../../config/logger.js'

// Network request resource type
interface NetworkRequestResource {
  timestamp: number
  method: string
  url: string
  status?: number
  statusText?: string
  headers?: Record<string, string>
  responseTime?: number
  error?: string
}

const networkBuffer = new CircularBuffer<NetworkRequestResource>(500)

export function setupNetworkResource(server: Server) {
  // TODO: Implement network resource
  logger.debug('Network resource setup - not yet implemented')
}