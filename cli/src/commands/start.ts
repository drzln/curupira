/**
 * @fileoverview 'curupira start' command - Start MCP server
 */

import { createLogger, ProjectConfigLoader } from '@curupira/shared'
import type { BaseCommand, CliContext, CommandResult } from '../types.js'
import { 
  CurupiraServer, 
  createApplicationContainer, 
  registerToolProviders, 
  registerResourceProviders
} from 'curupira-mcp-server'

const logger = createLogger({ level: 'info', name: 'start-command' })

/**
 * Start command options
 */
export interface StartCommandOptions {
  port?: number
  host?: string
  transport?: 'stdio' | 'http' | 'sse'
  chrome?: {
    host?: string
    port?: number
  }
}

/**
 * Start Curupira MCP server
 */
export class StartCommand implements BaseCommand {
  name = 'start'
  description = 'Start Curupira MCP server'

  async execute(context: CliContext, options: StartCommandOptions = {}): Promise<CommandResult> {
    try {
      // Load project configuration
      const projectConfig = await ProjectConfigLoader.loadConfig(context.cwd)
      
      if (!projectConfig) {
        return {
          success: false,
          message: 'No curupira.yml found. Run "curupira init" first.',
          exitCode: 1
        }
      }

      // Use command options or defaults (projectConfig.server has different structure)
      const host = options.host || 'localhost'
      const port = options.port || 8080
      const environment = process.env.NODE_ENV || 'development'

      if (!context.config.silent) {
        console.log(`Starting Curupira MCP server...`)
        console.log(`Environment: ${environment}`)
        console.log(`Server: ${host}:${port}`)
        console.log(`Project: ${projectConfig.project?.name || 'Unknown'}`)
      }

      // Set up environment variables for the server
      const transport = options.transport || 'stdio'
      process.env.CURUPIRA_TRANSPORT = transport
      process.env.CURUPIRA_PORT = port.toString()
      process.env.CURUPIRA_HOST = host
      process.env.NODE_ENV = environment
      
      // Set Chrome connection details
      if (options.chrome?.host) {
        process.env.CHROME_HOST = options.chrome.host
      }
      if (options.chrome?.port) {
        process.env.CHROME_PORT = options.chrome.port.toString()
      }

      // Create application container with all dependencies
      const container = createApplicationContainer()
      
      // Register all tool and resource providers
      registerToolProviders(container)
      registerResourceProviders(container)

      // Create and start the actual MCP server
      const server = new CurupiraServer(container)
      
      logger.info({ host, port, environment, transport }, 'Starting MCP server')

      try {
        await server.start()
        
        if (!context.config.silent) {
          console.log(`Server started successfully`)
          if (transport === 'stdio') {
            console.log(`MCP server running with stdio transport`)
            console.log(`Connect your AI assistant via stdio`)
          } else {
            console.log(`Connect your AI assistant to: ${transport}://${host}:${port}/mcp`)
          }
        }

        // Keep the process running
        return new Promise<CommandResult>((resolve) => {
          const shutdown = () => {
            logger.info('Shutting down...')
            server.stop().then(() => {
              resolve({
                success: true,
                message: 'Server stopped',
                exitCode: 0
              })
            }).catch((error) => {
              logger.error({ error }, 'Error during shutdown')
              resolve({
                success: false,
                message: 'Error during shutdown',
                error,
                exitCode: 1
              })
            })
          }

          process.on('SIGINT', shutdown)
          process.on('SIGTERM', shutdown)
        })

      } catch (error) {
        logger.error({ error }, 'Failed to start server')
        return {
          success: false,
          message: error instanceof Error ? error.message : 'Failed to start server',
          error: error instanceof Error ? error : new Error(String(error)),
          exitCode: 1
        }
      }

    } catch (error) {
      logger.error({ error }, 'Start failed')
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        error: error instanceof Error ? error : new Error(String(error)),
        exitCode: 1
      }
    }
  }
}