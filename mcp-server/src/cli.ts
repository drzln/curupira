#!/usr/bin/env node
/**
 * @fileoverview CLI entry point for Curupira MCP server
 * 
 * This file provides the command-line interface for running
 * the Curupira MCP server with various configuration options.
 */

import { Command } from 'commander'
import { createServerBuilder, createDevServer, createProductionServer } from './server/builder.js'
import { loadConfig } from '@curupira/shared/config'
import { createLogger } from '@curupira/shared/logging'
import type { LogLevel } from '@curupira/shared/config'
import type { CurupiraServer } from './server/server.js'

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
 * Create CLI program
 */
const program = new Command()
  .name('curupira-mcp')
  .description('Curupira MCP Server - Debug React applications with AI')
  .version('1.0.0')

/**
 * Start command
 */
program
  .command('start')
  .description('Start the MCP server')
  .option('-n, --name <name>', 'Server name', 'curupira-mcp-server')
  .option('-p, --port <port>', 'Server port', parseInt, 8000)
  .option('-h, --host <host>', 'Server host', 'localhost')
  .option('-e, --env <environment>', 'Environment (development|staging|production)', 'development')
  .option('-l, --log-level <level>', 'Log level (trace|debug|info|warn|error|fatal)', 'info')
  .option('--no-websocket', 'Disable WebSocket transport')
  .option('--no-health', 'Disable health checks')
  .option('--config <path>', 'Path to configuration file')
  .action(async (options) => {
    try {
      logger.info({ options }, 'Starting Curupira MCP server')

      let server: CurupiraServer

      // Load config from file if provided
      if (options.config) {
        const config = await loadConfig(options.config)
        server = createServerBuilder()
          .withName(options.name)
          .withAddress(options.host, options.port)
          .withEnvironment(options.env)
          .withLogLevel(parseLogLevel(options.logLevel))
          .build()
      } else {
        // Use environment-specific builder
        if (options.env === 'production') {
          server = createProductionServer(options.name, '1.0.0', options.port)
            .withAddress(options.host, options.port)
            .withLogLevel(parseLogLevel(options.logLevel))
            .build()
        } else {
          server = createDevServer(options.name, options.port)
            .withAddress(options.host, options.port)
            .withEnvironment(options.env)
            .withLogLevel(parseLogLevel(options.logLevel))
            .build()
        }

        // Configure transports
        if (!options.websocket) {
          // Remove WebSocket transport if disabled
          // This would need additional API in builder
        }

        // Configure health checks
        if (!options.health) {
          // Disable health checks
          // This would need additional API in builder
        }
      }

      // Set up graceful shutdown
      process.on('SIGTERM', async () => {
        logger.info('Received SIGTERM, shutting down gracefully')
        await server.stop('SIGTERM')
        process.exit(0)
      })

      process.on('SIGINT', async () => {
        logger.info('Received SIGINT, shutting down gracefully')
        await server.stop('SIGINT')
        process.exit(0)
      })

      // Start server
      await server.start()

      logger.info(
        {
          name: server.config.name,
          version: server.config.version,
          host: server.config.host,
          port: server.config.port,
          environment: server.config.environment
        },
        'Curupira MCP server started successfully'
      )

      // Keep process alive
      process.stdin.resume()

    } catch (error) {
      logger.error({ error }, 'Failed to start server')
      process.exit(1)
    }
  })

/**
 * Health command
 */
program
  .command('health')
  .description('Check server health')
  .option('-u, --url <url>', 'Server URL', 'http://localhost:8000')
  .action(async (options) => {
    try {
      const url = `${options.url}/health`
      logger.info({ url }, 'Checking server health')

      const response = await fetch(url)
      const health = await response.json()

      if (response.ok) {
        logger.info({ health }, 'Server is healthy')
        console.log(JSON.stringify(health, null, 2))
        process.exit(0)
      } else {
        logger.error({ health }, 'Server is unhealthy')
        console.error(JSON.stringify(health, null, 2))
        process.exit(1)
      }
    } catch (error) {
      logger.error({ error }, 'Failed to check health')
      process.exit(1)
    }
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

      const server = await createDevServer('curupira-dev', options.port)
        .buildAndStart()

      logger.info(
        {
          url: `ws://localhost:${options.port}/mcp`,
          health: `http://localhost:${options.port}/health`
        },
        'Development server ready'
      )

      // Set up graceful shutdown
      process.on('SIGTERM', async () => {
        await server.stop('SIGTERM')
        process.exit(0)
      })

      process.on('SIGINT', async () => {
        await server.stop('SIGINT')
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