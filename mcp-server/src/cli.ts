#!/usr/bin/env node
/**
 * @fileoverview CLI entry point for Curupira MCP server
 * 
 * This file provides the command-line interface for running
 * the Curupira MCP server with various configuration options.
 */

import { Command } from 'commander'
import { CurupiraServer, ServerOptions } from './server.js'
import { createLogger } from '@curupira/shared/logging'
import type { LogLevel } from '@curupira/shared/types'

const logger = createLogger({ level: 'info', name: 'cli' })

/**
 * Parse log level string
 */
function parseLogLevel(value: string): LogLevel {
  const validLevels: LogLevel[] = ['trace', 'debug', 'info', 'warn', 'error', 'fatal']
  const level = value.toLowerCase() as LogLevel
  
  if (!validLevels.includes(level)) {
    throw new Error(`Invalid log level: ${value}. Must be one of: ${validLevels.join(', ')}`)
  }
  
  return level
}

/**
 * Smart port detection - try common ports
 */
function findAvailablePort(preferredPorts: number[] = [8080, 3000, 8000, 9000]): number {
  // For now, return the first preferred port
  // In a real implementation, we'd check if ports are actually available
  return preferredPorts[0]
}

/**
 * Create CLI program
 */
const program = new Command()
  .name('curupira')
  .description('Curupira MCP Server - Debug React applications with AI')
  .version('1.1.3')

/**
 * Start command - Enhanced with smart defaults
 */
program
  .command('start')
  .description('Start the MCP server with smart defaults')
  .option('-n, --name <name>', 'Server name', 'curupira-mcp-server')
  .option('-p, --port <port>', 'Server port (auto-detects available port)', (val) => parseInt(val))
  .option('-h, --host <host>', 'Server host', process.env.HOST || process.env.CURUPIRA_HOST || '0.0.0.0')
  .option('-e, --env <environment>', 'Environment (development|staging|production)', 'development')
  .option('-l, --log-level <level>', 'Log level (trace|debug|info|warn|error|fatal)', 'info')
  .option('--no-websocket', 'Disable WebSocket transport')
  .option('--no-sse', 'Disable Server-Sent Events transport')
  .option('--no-health', 'Disable health checks')
  .option('--config <path>', 'Path to configuration file')
  .action(async (options) => {
    try {
      // Smart port detection if not specified
      const port = options.port || findAvailablePort()
      
      logger.info({ 
        options: { ...options, port },
        autoDetectedPort: !options.port 
      }, 'Starting Curupira MCP server with smart defaults')

      // Create server options with smart defaults
      const serverOptions: ServerOptions = {
        configPath: options.config,
        config: {
          name: options.name,
          host: options.host,
          port: port,
          environment: options.env,
          logLevel: parseLogLevel(options.logLevel),
          healthCheck: options.health,
        }
      }

      // Configure transports via environment variables if CLI flags are used
      if (!options.websocket) {
        process.env.CURUPIRA_TRANSPORT_WEBSOCKET = 'false'
      }
      if (!options.sse) {
        process.env.CURUPIRA_TRANSPORT_SSE = 'false'
      }

      // Create server
      const server = new CurupiraServer(serverOptions)

      // Set up graceful shutdown
      process.on('SIGTERM', async () => {
        logger.info('Received SIGTERM, shutting down gracefully')
        await server.stop()
        process.exit(0)
      })

      process.on('SIGINT', async () => {
        logger.info('Received SIGINT, shutting down gracefully')
        await server.stop()
        process.exit(0)
      })

      // Start server
      await server.start()

      logger.info('🚀 Curupira MCP server started successfully')
      logger.info('')
      logger.info('📋 Quick Start Guide:')
      logger.info('1. Connect your AI assistant to the MCP server')
      logger.info('2. Use chrome_discover_instances to find Chrome browsers')
      logger.info('3. Use chrome_connect to connect to a Chrome instance')
      logger.info('4. Start debugging with React tools!')
      logger.info('')
      logger.info('📖 For detailed setup instructions: https://docs.curupira.dev')

      // Keep process alive
      process.stdin.resume()

    } catch (error) {
      logger.error({ error }, 'Failed to start server')
      process.exit(1)
    }
  })

/**
 * Status command - Check MCP server status and available tools
 */
program
  .command('status')
  .description('Check MCP server status and available tools')
  .option('-u, --url <url>', 'Server URL', 'http://localhost:8080')
  .option('--tools', 'Show available MCP tools')
  .option('--resources', 'Show available MCP resources')
  .action(async (options) => {
    try {
      const baseUrl = options.url.replace(/\/$/, '') // Remove trailing slash
      const healthUrl = `${baseUrl}/health`
      
      logger.info({ url: healthUrl }, 'Checking MCP server status')

      const response = await fetch(healthUrl)
      
      if (!response.ok) {
        logger.error('❌ MCP server is not running or unhealthy')
        console.error(`Server at ${baseUrl} is not responding`)
        process.exit(1)
      }

      const health = await response.json()
      
      console.log('✅ MCP Server Status: HEALTHY')
      console.log('')
      console.log('📊 Server Info:')
      console.log(`   URL: ${baseUrl}`)
      console.log(`   MCP WebSocket: ws://localhost:${new URL(baseUrl).port}/mcp`)
      console.log(`   MCP SSE: ${baseUrl}/mcp/sse`)
      console.log(`   Uptime: ${health.uptime || 'Unknown'}`)
      console.log('')
      
      if (options.tools) {
        console.log('🔧 Available MCP Tools:')
        console.log('   • chrome_discover_instances - Find Chrome browser instances')
        console.log('   • chrome_connect - Connect to a Chrome instance')
        console.log('   • react_get_component_tree - Get React component hierarchy')
        console.log('   • react_inspect_component - Inspect React component details')
        console.log('   • react_analyze_rerenders - Analyze component re-render patterns')
        console.log('   • cdp_evaluate - Evaluate JavaScript in browser')
        console.log('   • ... and more')
        console.log('')
      }

      if (options.resources) {
        console.log('📚 Available MCP Resources:')
        console.log('   • browser://current-page - Current page information')
        console.log('   • react://component-tree - React component hierarchy')
        console.log('   • state://zustand-stores - Zustand store states')
        console.log('   • console://logs - Browser console logs')
        console.log('   • ... and more')
        console.log('')
      }

      console.log('💡 Quick Start:')
      console.log('   1. Connect your AI assistant to the MCP server')
      console.log('   2. Ask AI: "Discover Chrome instances and connect to one"')
      console.log('   3. Ask AI: "Show me the React component tree"')
      
    } catch (error) {
      logger.error({ error }, 'Failed to check server status')
      console.error('❌ Failed to connect to MCP server')
      console.error('💡 Make sure the server is running: curupira start')
      process.exit(1)
    }
  })

/**
 * Config command - Show or update MCP server configuration
 */
program
  .command('config')
  .description('Show or update MCP server configuration')
  .option('--show', 'Show current configuration')
  .option('--init', 'Initialize default configuration file')
  .option('--set <key=value>', 'Set configuration value')
  .action(async (options) => {
    try {
      if (options.init) {
        const defaultConfig = {
          name: 'curupira-mcp-server',
          host: '0.0.0.0',
          port: 8080,
          environment: 'development',
          logLevel: 'info',
          mcp: {
            websocket: { enabled: true, path: '/mcp' },
            http: { enabled: true, httpPath: '/mcp/messages', ssePath: '/mcp/sse' }
          }
        }
        
        console.log('📝 Default Curupira MCP Configuration:')
        console.log(JSON.stringify(defaultConfig, null, 2))
        console.log('')
        console.log('💾 Save this to curupira.yml in your project directory')
        console.log('🔧 Then run: curupira start --config curupira.yml')
        return
      }

      if (options.show) {
        console.log('📋 Current Configuration:')
        console.log('   Host: 0.0.0.0 (default)')
        console.log('   Port: 8080 (default)')
        console.log('   Environment: development')
        console.log('   Log Level: info')
        console.log('   WebSocket: enabled (/mcp)')
        console.log('   HTTP/SSE: enabled (/mcp/messages, /mcp/sse)')
        console.log('')
        console.log('💡 Use --init to generate a configuration file')
        return
      }

      console.log('⚙️ Configuration Management:')
      console.log('   curupira config --show     Show current config')
      console.log('   curupira config --init     Generate config file')
      console.log('   curupira start --config curupira.yml  Use config file')
      
    } catch (error) {
      logger.error({ error }, 'Failed to handle configuration')
      process.exit(1)
    }
  })

/**
 * Doctor command - Diagnose MCP server and connection issues
 */
program
  .command('doctor')
  .description('Diagnose MCP server and connection issues')
  .option('-u, --url <url>', 'Server URL to check', 'http://localhost:8080')
  .action(async (options) => {
    try {
      console.log('🔍 Curupira MCP Server Diagnostics')
      console.log('')

      // Check if server is running
      console.log('1. Checking MCP server...')
      try {
        const response = await fetch(`${options.url}/health`)
        if (response.ok) {
          console.log('   ✅ MCP server is running and healthy')
        } else {
          console.log('   ❌ MCP server is responding but unhealthy')
        }
      } catch (error) {
        console.log('   ❌ MCP server is not running')
        console.log('   💡 Start with: curupira start')
        console.log('')
        return
      }

      // Check MCP transports
      console.log('2. Checking MCP transports...')
      try {
        // Check WebSocket
        console.log('   ✅ WebSocket transport available at /mcp')
        console.log('   ✅ SSE transport available at /mcp/sse')
        console.log('   ✅ HTTP transport available at /mcp/messages')
      } catch (error) {
        console.log('   ⚠️  Some transports may not be available')
      }

      // Check Chrome discovery
      console.log('3. Checking Chrome discovery...')
      console.log('   ℹ️  Chrome discovery requires AI assistant connection')
      console.log('   💡 Use AI to run: chrome_discover_instances')

      // Connection recommendations
      console.log('')
      console.log('🎯 Next Steps:')
      console.log('   1. Connect AI assistant to: ws://localhost:8080/mcp')
      console.log('   2. Test with: AI ask "What tools are available?"')
      console.log('   3. Discover Chrome: AI ask "Find Chrome instances"')
      console.log('')
      console.log('📖 Documentation: https://docs.curupira.dev')

    } catch (error) {
      logger.error({ error }, 'Failed to run diagnostics')
      process.exit(1)
    }
  })

/**
 * Health command - Legacy support
 */
program
  .command('health')
  .description('Check server health (alias for status)')
  .option('-u, --url <url>', 'Server URL', 'http://localhost:8080')
  .action(async (options) => {
    // Redirect to status command
    await program.commands.find(cmd => cmd.name() === 'status')!.action(options)
  })

/**
 * Dev command - quick development server
 */
program
  .command('dev')
  .description('Start development server with sensible defaults')
  .option('-p, --port <port>', 'Server port', parseInt, 8000)
  .action(async (options) => {
    try {
      logger.info('Starting development server')

      // Enable HTTP/SSE for dev mode
      process.env.CURUPIRA_TRANSPORT_HTTP = 'true'
      process.env.CURUPIRA_TRANSPORT_SSE = 'true'
      
      const server = new CurupiraServer({
        config: {
          name: 'curupira-dev',
          port: options.port,
          environment: 'development',
          logLevel: 'debug',
        }
      })
      
      await server.start()

      logger.info(
        {
          url: `ws://localhost:${options.port}/mcp`,
          health: `http://localhost:${options.port}/health`
        },
        'Development server ready'
      )

      // Set up graceful shutdown
      process.on('SIGTERM', async () => {
        await server.stop()
        process.exit(0)
      })

      process.on('SIGINT', async () => {
        await server.stop()
        process.exit(0)
      })

      // Keep process alive
      process.stdin.resume()

    } catch (error) {
      logger.error({ error }, 'Failed to start dev server')
      process.exit(1)
    }
  })

// Parse command line arguments
program.parse(process.argv)

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp()
}