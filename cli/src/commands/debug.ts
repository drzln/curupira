/**
 * @fileoverview 'curupira debug' command implementation
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

const logger = createLogger({ level: 'debug', name: 'debug-command' })

/**
 * Debug command options
 */
export interface DebugCommandOptions {
  component?: string
  url?: string
  profile?: boolean
  snapshot?: boolean
}

/**
 * Run targeted debugging session with enhanced inspection capabilities
 */
export class DebugCommand implements BaseCommand {
  name = 'debug'
  description = 'Run targeted debugging session'

  async execute(context: CliContext, options: DebugCommandOptions = {}): Promise<CommandResult> {
    try {
      if (!context.config.silent) {
        console.log(chalk.blue('🔍 Starting targeted debug session...'))
        console.log(chalk.gray('Debug session features:'))
        console.log(chalk.gray('  • Targeted component inspection'))
        console.log(chalk.gray('  • Performance profiling'))
        console.log(chalk.gray('  • State snapshots'))
        console.log(chalk.gray('  • Interactive debugging tools'))
        console.log('')
      }

      // Load project configuration
      const projectConfig = await ProjectConfigLoader.loadConfig(context.cwd)
      
      if (!projectConfig) {
        console.log(chalk.yellow('⚠ No curupira.yml found. Debug session will use default settings.'))
        console.log(chalk.gray('  Run "curupira init" to create a configuration file for better debugging.'))
        console.log('')
      }

      // Debug session configuration
      const host = 'localhost'
      const port = parseInt(process.env.CURUPIRA_DEBUG_PORT || '8081', 10)
      const environment = 'debug'

      if (!context.config.silent) {
        console.log(chalk.cyan('🎯 Debug Session Configuration:'))
        console.log(chalk.gray(`   Mode: Targeted Debugging`))
        console.log(chalk.gray(`   Server: ${host}:${port}`))
        console.log(chalk.gray(`   Project: ${projectConfig?.project?.name || 'Debug Session'}`))
        
        if (options.component) {
          console.log(chalk.gray(`   Target Component: ${options.component}`))
        }
        if (options.url) {
          console.log(chalk.gray(`   Target URL: ${options.url}`))
        }
        if (options.profile) {
          console.log(chalk.gray(`   Performance Profiling: Enabled`))
        }
        if (options.snapshot) {
          console.log(chalk.gray(`   State Snapshots: Enabled`))
        }
        console.log('')
      }

      // Set up environment variables for debug session
      process.env.CURUPIRA_TRANSPORT = 'stdio'
      process.env.CURUPIRA_PORT = port.toString()
      process.env.CURUPIRA_HOST = host
      process.env.NODE_ENV = environment
      process.env.CURUPIRA_DEBUG_MODE = 'true'
      process.env.LOG_LEVEL = 'debug'
      
      // Debug-specific environment variables
      if (options.component) {
        process.env.CURUPIRA_TARGET_COMPONENT = options.component
      }
      if (options.url) {
        process.env.CURUPIRA_TARGET_URL = options.url
      }
      if (options.profile) {
        process.env.CURUPIRA_ENABLE_PROFILING = 'true'
      }
      if (options.snapshot) {
        process.env.CURUPIRA_ENABLE_SNAPSHOTS = 'true'
      }

      // Create application container with all dependencies
      const container = createApplicationContainer()
      
      // Register all tool and resource providers
      registerToolProviders(container)
      registerResourceProviders(container)

      // Create and start the MCP server in debug mode
      const server = new CurupiraServer(container)
      
      logger.info({ 
        host, 
        port, 
        environment, 
        component: options.component,
        url: options.url,
        profile: options.profile,
        snapshot: options.snapshot 
      }, 'Starting debug session MCP server')

      try {
        await server.start()
        
        if (!context.config.silent) {
          console.log(chalk.green('✅ Debug session started successfully!'))
          console.log('')
          console.log(chalk.cyan('🔧 Debug Session Features:'))
          console.log(chalk.gray('   • MCP server running in debug mode'))
          console.log(chalk.gray('   • Enhanced inspection tools available'))
          console.log(chalk.gray('   • Real-time state monitoring'))
          console.log(chalk.gray('   • Performance analysis enabled'))
          console.log('')
          
          if (options.component) {
            console.log(chalk.yellow(`🎯 Targeting Component: ${options.component}`))
            console.log(chalk.gray('   • Component state will be monitored'))
            console.log(chalk.gray('   • Props and hooks inspection enabled'))
          }
          
          if (options.url) {
            console.log(chalk.yellow(`🌐 Targeting URL: ${options.url}`))
            console.log(chalk.gray('   • Page-specific debugging enabled'))
            console.log(chalk.gray('   • Network requests will be tracked'))
          }
          
          if (options.profile) {
            console.log(chalk.yellow('📊 Performance Profiling Enabled'))
            console.log(chalk.gray('   • Render performance tracking'))
            console.log(chalk.gray('   • Memory usage monitoring'))
            console.log(chalk.gray('   • Core Web Vitals measurement'))
          }
          
          if (options.snapshot) {
            console.log(chalk.yellow('📸 State Snapshots Enabled'))
            console.log(chalk.gray('   • Automatic state captures'))
            console.log(chalk.gray('   • Time-travel debugging ready'))
            console.log(chalk.gray('   • Component state history'))
          }
          
          console.log('')
          console.log(chalk.cyan('🔍 Debug Commands Available:'))
          console.log(chalk.gray('   • Use MCP tools to inspect state'))
          console.log(chalk.gray('   • Query resources for current data'))
          console.log(chalk.gray('   • Run performance analysis'))
          console.log('')
          console.log(chalk.cyan('📚 Debug Resources:'))
          console.log(chalk.gray('   • browser://status - Chrome connection'))
          console.log(chalk.gray('   • dom://current - DOM structure'))
          console.log(chalk.gray('   • network://requests - Network activity'))
          console.log(chalk.gray('   • state://overview - State management'))
          if (options.component) {
            console.log(chalk.gray(`   • component:///${options.component} - Target component`))
          }
          console.log('')
          console.log(chalk.gray('Press Ctrl+C to end the debug session'))
        }

        // Keep the debug session running
        return new Promise<CommandResult>((resolve) => {
          let sessionDuration = 0
          const startTime = Date.now()
          
          // Optional: periodic status updates in debug mode
          const statusInterval = setInterval(() => {
            sessionDuration = Math.floor((Date.now() - startTime) / 1000)
            if (sessionDuration % 60 === 0 && sessionDuration > 0) {
              logger.debug({ sessionDuration }, `Debug session running for ${sessionDuration}s`)
            }
          }, 1000)

          const shutdown = () => {
            clearInterval(statusInterval)
            sessionDuration = Math.floor((Date.now() - startTime) / 1000)
            
            if (!context.config.silent) {
              console.log('')
              console.log(chalk.yellow('🔄 Ending debug session...'))
              console.log(chalk.gray(`   Session duration: ${sessionDuration}s`))
            }
            logger.info({ sessionDuration }, 'Debug session ending...')
            
            server.stop().then(() => {
              if (!context.config.silent) {
                console.log(chalk.green('✅ Debug session completed'))
                if (options.profile || options.snapshot) {
                  console.log(chalk.gray('   Check logs for captured performance data and state snapshots'))
                }
              }
              resolve({
                success: true,
                message: `Debug session completed (${sessionDuration}s)`,
                exitCode: 0
              })
            }).catch((error) => {
              logger.error({ error }, 'Error during debug session shutdown')
              resolve({
                success: false,
                message: 'Error during debug session shutdown',
                error,
                exitCode: 1
              })
            })
          }

          // Handle graceful shutdown
          process.on('SIGINT', shutdown)
          process.on('SIGTERM', shutdown)
        })

      } catch (error) {
        logger.error({ error }, 'Failed to start debug session')
        return {
          success: false,
          message: error instanceof Error ? error.message : 'Failed to start debug session',
          error: error instanceof Error ? error : new Error(String(error)),
          exitCode: 1
        }
      }

    } catch (error) {
      logger.error({ error }, 'Debug command failed')
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        error: error instanceof Error ? error : new Error(String(error)),
        exitCode: 1
      }
    }
  }
}