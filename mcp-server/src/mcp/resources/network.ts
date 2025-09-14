import type { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { CircularBuffer } from '@curupira/shared'
import type { NetworkRequestResource } from '@curupira/shared'
import { logger } from '../../config/logger.js'

const networkBuffer = new CircularBuffer<NetworkRequestResource>(500)

export function setupNetworkResource(server: Server) {
  // TODO: Implement network resource
  logger.debug('Network resource setup - not yet implemented')
}