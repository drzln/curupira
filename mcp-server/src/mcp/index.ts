import type { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { setupUnifiedResourceHandlers } from './resources/index.js'
import { setupUnifiedToolHandlers } from './tools/index.js'
import { setupDebuggingPrompts } from './prompts/debugging.js'
import { logger } from '../config/logger.js'

export function setupMCPHandlers(server: Server) {
  logger.info('Setting up MCP handlers')
  console.log('[MCP] Server instance:', server)

  // Setup unified resource handlers (handles all resources in one place)
  setupUnifiedResourceHandlers(server)

  // Setup unified tool handlers (handles all tools in one place)
  setupUnifiedToolHandlers(server)

  // Setup prompt templates
  setupDebuggingPrompts(server)

  logger.info('MCP handlers setup complete')
  console.log('[MCP] Handlers registered successfully')
}