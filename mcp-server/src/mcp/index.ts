import type { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { setupConsoleResource } from './resources/console.js'
import { setupNetworkResource } from './resources/network.js'
import { setupDOMResource } from './resources/dom.js'
import { setupStateResource } from './resources/state.js'
import { setupEvalTool } from './tools/evaluator.js'
import { setupInspectTool } from './tools/inspector.js'
import { setupDebuggerTool } from './tools/debugger.js'
import { setupProfilerTool } from './tools/profiler.js'
import { setupDebuggingPrompts } from './prompts/debugging.js'
import { logger } from '../config/logger.js'

export function setupMCPHandlers(server: Server) {
  logger.info('Setting up MCP handlers')

  // Setup resource providers
  setupConsoleResource(server)
  setupNetworkResource(server)
  setupDOMResource(server)
  setupStateResource(server)

  // Setup tool providers
  setupEvalTool(server)
  setupInspectTool(server)
  setupDebuggerTool(server)
  setupProfilerTool(server)

  // Setup prompt templates
  setupDebuggingPrompts(server)

  logger.info('MCP handlers setup complete')
}