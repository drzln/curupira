/**
 * Main MCP server entry point
 * 
 * Orchestrates all components and starts the server
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { MCPHandler } from './mcp-handler.js'
import { ChromeClient } from '../chrome/client.js'
import { RuntimeDomain } from '../chrome/domains/runtime.js'
import { DOMDomain } from '../chrome/domains/dom.js'
import { NetworkDomain } from '../chrome/domains/network.js'
import { PageDomain } from '../chrome/domains/page.js'
import { createFrameworkIntegrations } from '../integrations/index.js'
import { createResourceProviders } from '../resources/index.js'
import { createToolProviders } from '../tools/index.js'
import { TransportManager, type TransportType } from './transport.js'
import { HealthChecker } from './health.js'
import { logger } from '../config/logger.js'
import { loadConfig } from '../config/config.js'
import type { CDPConnectionOptions } from '../shared/src/types/cdp.js'

export class CurupiraServer {
  private server: Server
  private handler: MCPHandler
  private chromeClient: ChromeClient
  private transportManager?: TransportManager
  private healthChecker: HealthChecker
  private isConnected = false

  constructor() {
    this.server = new Server(
      {
        name: 'curupira-debug',
        version: '1.0.0',
      },
      {
        capabilities: {
          resources: {
            list: true,
            read: true,
            subscribe: false,
          },
          tools: {
            list: true,
            call: true,
          },
          prompts: {
            list: true,
            get: true,
          },
        },
      }
    )

    this.chromeClient = new ChromeClient()
    this.handler = new MCPHandler()
    this.healthChecker = new HealthChecker(this.chromeClient)
  }

  /**
   * Initialize and start the server
   */
  async start() {
    try {
      // Load configuration
      const config = loadConfig()
      logger.info({ config }, 'Starting Curupira MCP server')

      // Connect to Chrome
      await this.connectToChrome(config.cdp)

      // Initialize domains
      const domains = await this.initializeDomains()

      // Create integrations
      const integrations = createFrameworkIntegrations(
        domains.runtime,
        domains.dom
      )

      // Create providers
      const resourceProviders = createResourceProviders(
        domains.runtime,
        domains.dom,
        domains.network,
        domains.page,
        integrations
      )

      const toolProviders = createToolProviders(
        domains.runtime,
        domains.dom,
        domains.network,
        domains.page
      )

      // Initialize handler with providers
      this.handler.initialize(resourceProviders, toolProviders)

      // Update health checker with counts
      const resources = await resourceProviders.listResources()
      const tools = toolProviders.listTools()
      this.healthChecker.updateCounts(resources.length, tools.length)

      // Setup request handlers
      this.setupHandlers()

      // Start transport
      const transportType = (process.env.CURUPIRA_TRANSPORT || 'stdio') as TransportType
      this.transportManager = new TransportManager(this.server, {
        type: transportType,
        port: config.server?.port,
        corsOrigins: config.server?.corsOrigins,
        healthChecker: this.healthChecker,
      })
      await this.transportManager.start()

      logger.info({ transport: transportType }, 'MCP server started successfully')
    } catch (error) {
      logger.error({ error }, 'Failed to start MCP server')
      throw error
    }
  }

  /**
   * Connect to Chrome DevTools Protocol
   */
  private async connectToChrome(options: CDPConnectionOptions) {
    try {
      await this.chromeClient.connect(options)
      this.isConnected = true
      logger.info('Connected to Chrome DevTools Protocol')

      // Setup connection event handlers
      this.chromeClient.on('disconnect', () => {
        logger.warn('Chrome connection lost, attempting reconnect...')
        this.handleReconnect(options)
      })
    } catch (error) {
      logger.error({ error }, 'Failed to connect to Chrome')
      throw error
    }
  }

  /**
   * Initialize CDP domains
   */
  private async initializeDomains() {
    const runtime = new RuntimeDomain(this.chromeClient)
    const dom = new DOMDomain(this.chromeClient)
    const network = new NetworkDomain(this.chromeClient)
    const page = new PageDomain(this.chromeClient)

    // Enable domains
    await Promise.all([
      runtime.enable(),
      dom.enable(),
      network.enable(),
      page.enable(),
    ])

    logger.info('CDP domains initialized')

    return { runtime, dom, network, page }
  }

  /**
   * Setup MCP request handlers
   */
  private setupHandlers() {
    // Resource handlers
    this.server.setRequestHandler(
      'resources/list',
      async () => this.handler.listResources()
    )

    this.server.setRequestHandler(
      'resources/read',
      async (request) => this.handler.readResource(request.params as any)
    )

    // Tool handlers
    this.server.setRequestHandler(
      'tools/list',
      async () => this.handler.listTools()
    )

    this.server.setRequestHandler(
      'tools/call',
      async (request) => this.handler.callTool(request.params as any)
    )

    // Prompt handlers
    this.server.setRequestHandler(
      'prompts/list',
      async () => this.handler.listPrompts()
    )

    this.server.setRequestHandler(
      'prompts/get',
      async (request) => this.handler.getPrompt(request.params as any)
    )

    // Health check
    this.server.setRequestHandler(
      'health',
      async () => this.healthChecker.check()
    )

    // Statistics
    this.server.setRequestHandler(
      'statistics',
      async () => this.handler.getStatistics()
    )

    logger.info('Request handlers configured')
  }

  /**
   * Handle Chrome reconnection
   */
  private async handleReconnect(options: CDPConnectionOptions) {
    const maxRetries = 5
    const baseDelay = 1000

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const delay = baseDelay * Math.pow(2, attempt - 1)
        logger.info({ attempt, delay }, 'Attempting reconnection')
        
        await new Promise(resolve => setTimeout(resolve, delay))
        await this.chromeClient.connect(options)
        
        this.isConnected = true
        logger.info('Reconnected successfully')
        return
      } catch (error) {
        logger.error({ error, attempt }, 'Reconnection failed')
        
        if (attempt === maxRetries) {
          logger.error('Max reconnection attempts reached')
          this.isConnected = false
        }
      }
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    logger.info('Shutting down MCP server')
    
    try {
      await this.chromeClient.disconnect()
      if (this.transportManager) {
        await this.transportManager.stop()
      }
      await this.server.close()
      logger.info('Server shut down successfully')
    } catch (error) {
      logger.error({ error }, 'Error during shutdown')
    }
  }
}

// Main entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new CurupiraServer()
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('Received SIGINT signal')
    await server.shutdown()
    process.exit(0)
  })

  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM signal')
    await server.shutdown()
    process.exit(0)
  })

  // Start server
  server.start().catch((error) => {
    logger.error({ error }, 'Fatal error')
    process.exit(1)
  })
}