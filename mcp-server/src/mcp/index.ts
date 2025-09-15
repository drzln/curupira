import type { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { setupUnifiedResourceHandlers } from './resources/index.js'
import { setupComprehensiveToolHandlers } from './tools/comprehensive.js'
import { setupDebuggingPrompts } from './prompts/debugging.js'
import { logger } from '../config/logger.js'

export function setupMCPHandlers(server: Server) {
  logger.info('Setting up enhanced MCP handlers')
  console.log('[MCP] Server instance:', server)

  // Setup unified resource handlers with enhanced providers
  setupUnifiedResourceHandlers(server)

  // Setup comprehensive tool handlers (includes basic + enhanced tools)
  setupComprehensiveToolHandlers(server)

  // Setup prompt templates
  setupDebuggingPrompts(server)

  logger.info('Enhanced MCP handlers setup complete')
  console.log('[MCP] Enhanced handlers registered successfully')
}