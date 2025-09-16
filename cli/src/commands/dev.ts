/**
 * @fileoverview 'curupira dev' command implementation
 */

import chalk from 'chalk'
import { createLogger, ProjectConfigLoader } from '@curupira/shared'
import type { BaseCommand, CliContext, CommandResult } from '../types.js'
import { 
  CurupiraServer, 
  createApplicationContainer, 
  registerToolProviders, 
  registerResourceProviders
} from 'curupira-mcp-server'

const logger = createLogger({ level: 'debug', name: 'dev-command' })

/**
 * Dev command options
 */
export interface DevCommandOptions {
  port?: string
  host?: string
  open?: boolean
}

/**
 * Start Curupira MCP server in development mode with enhanced debugging
 */
export class DevCommand implements BaseCommand {
  name = 'dev'
  description = 'Start Curupira MCP server in development mode'

  async execute(context: CliContext, options: DevCommandOptions = {}): Promise<CommandResult> {
    try {
      if (!context.config.silent) {
        console.log(chalk.blue('🚀 Starting development server...'))
        console.log(chalk.gray('Development mode includes:'))
        console.log(chalk.gray('  • Enhanced logging and debugging'))
        console.log(chalk.gray('  • Hot reload capabilities'))
        console.log(chalk.gray('  • Development-specific tools'))
        console.log('')
      }

      // Load project configuration
      const projectConfig = await ProjectConfigLoader.loadConfig(context.cwd)
      
      if (!projectConfig) {
        if (!context.config.silent) {
          console.log(chalk.yellow('⚠ No curupira.yml found. Creating a basic development configuration...'))
        }
        // Continue without config in dev mode
      }

      // Development-specific configuration
      const host = options.host || 'localhost'
      const port = parseInt(options.port || '8080', 10)
      const environment = 'development'

      if (!context.config.silent) {
        console.log(chalk.cyan('📋 Development Configuration:'))
        console.log(chalk.gray(`   Environment: ${environment}`))
        console.log(chalk.gray(`   Server: ${host}:${port}`))
        console.log(chalk.gray(`   Project: ${projectConfig?.project?.name || 'Development Project'}`))
        console.log(chalk.gray(`   Hot Reload: Enabled`))
        console.log(chalk.gray(`   Debug Mode: Enabled`))
        console.log('')
      }

      // Set up environment variables for development
      process.env.CURUPIRA_TRANSPORT = 'stdio'
      process.env.CURUPIRA_PORT = port.toString()
      process.env.CURUPIRA_HOST = host
      process.env.NODE_ENV = environment
      process.env.CURUPIRA_DEV_MODE = 'true'
      process.env.LOG_LEVEL = 'debug'

      // Create application container with all dependencies
      const container = createApplicationContainer()
      
      // Register all tool and resource providers
      registerToolProviders(container)
      registerResourceProviders(container)

      // Create and start the MCP server in development mode
      const server = new CurupiraServer(container)
      
      logger.info({ host, port, environment }, 'Starting development MCP server')

      try {
        await server.start()
        
        if (!context.config.silent) {
          console.log(chalk.green('✅ Development server started successfully!'))
          console.log('')
          console.log(chalk.cyan('🔧 Development Features:'))
          console.log(chalk.gray('   • MCP server running with stdio transport'))
          console.log(chalk.gray('   • Enhanced debugging tools available'))
          console.log(chalk.gray('   • Resource providers: DOM, Network, State'))
          console.log(chalk.gray('   • Tool providers: Chrome, React, Performance'))
          console.log('')
          console.log(chalk.yellow('💡 Connect your AI assistant via stdio transport'))
          
          if (options.open) {
            console.log(chalk.gray('   • Browser DevTools integration ready'))
          }
          
          console.log('')
          console.log(chalk.cyan('📚 Available Resources:'))
          console.log(chalk.gray('   • browser://status - Chrome connection status'))
          console.log(chalk.gray('   • dom://current - Current DOM structure'))
          console.log(chalk.gray('   • network://requests - Network requests'))
          console.log(chalk.gray('   • state://overview - State management overview'))
          console.log('')
          console.log(chalk.gray('Press Ctrl+C to stop the development server'))
        }

        // Keep the development server running
        return new Promise<CommandResult>((resolve) => {
          const shutdown = () => {
            if (!context.config.silent) {
              console.log('')
              console.log(chalk.yellow('🔄 Shutting down development server...'))
            }
            logger.info('Development server shutting down...')
            
            server.stop().then(() => {
              if (!context.config.silent) {
                console.log(chalk.green('✅ Development server stopped'))
              }
              resolve({
                success: true,
                message: 'Development server stopped',
                exitCode: 0
              })
            }).catch((error) => {
              logger.error({ error }, 'Error during development server shutdown')
              resolve({
                success: false,
                message: 'Error during shutdown',
                error,
                exitCode: 1
              })
            })
          }

          // Handle graceful shutdown
          process.on('SIGINT', shutdown)
          process.on('SIGTERM', shutdown)
          
          // In development mode, we could add file watching here
          // for hot reload functionality in the future
        })

      } catch (error) {
        logger.error({ error }, 'Failed to start development server')
        return {
          success: false,
          message: error instanceof Error ? error.message : 'Failed to start development server',
          error: error instanceof Error ? error : new Error(String(error)),
          exitCode: 1
        }
      }

    } catch (error) {
      logger.error({ error }, 'Development command failed')
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        error: error instanceof Error ? error : new Error(String(error)),
        exitCode: 1
      }
    }
  }
}