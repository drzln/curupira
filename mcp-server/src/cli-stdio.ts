#!/usr/bin/env node
/**
 * @fileoverview Stdio-based CLI for Curupira MCP server
 * This is what Claude Code will execute via .mcp.json
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/node/stdio.js'
import { WebSocketServer } from 'ws'
import { createLogger } from '@curupira/shared/logging'
import { setupMCPHandlers } from './mcp/index.js'
import type { 
  ConsoleMessage, 
  NetworkRequest, 
  DOMSnapshot,
  ComponentState 
} from '@curupira/shared/types'

const logger = createLogger({ level: 'debug', name: 'curupira-mcp' })

// Store browser state received from Chrome extension
const browserState = {
  consoleLogs: [] as ConsoleMessage[],
  networkRequests: [] as NetworkRequest[],
  domSnapshot: null as DOMSnapshot | null,
  componentStates: new Map<string, ComponentState>()
}

async function main() {
  logger.info('Starting Curupira MCP server with stdio transport')

  // Create MCP server
  const server = new Server(
    {
      name: 'curupira-mcp-server',
      version: '1.0.0'
    },
    {
      capabilities: {
        resources: {},
        tools: {},
        prompts: {}
      }
    }
  )

  // Setup MCP handlers
  setupMCPHandlers(server)

  // Create stdio transport for Claude Code
  const transport = new StdioServerTransport()
  await server.connect(transport)

  logger.info('MCP server connected via stdio')

  // Start WebSocket server for Chrome extension
  const wsPort = parseInt(process.env.WS_PORT || '8080')
  const wss = new WebSocketServer({ 
    port: wsPort,
    host: '0.0.0.0'
  })

  logger.info({ port: wsPort }, 'WebSocket server listening for Chrome extension')

  wss.on('connection', (ws) => {
    logger.info('Chrome extension connected')

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString())
        logger.debug({ type: message.type }, 'Received message from extension')

        // Update browser state based on message type
        switch (message.type) {
          case 'console':
            browserState.consoleLogs.push(...(message.data || []))
            // Keep last 1000 logs
            if (browserState.consoleLogs.length > 1000) {
              browserState.consoleLogs = browserState.consoleLogs.slice(-1000)
            }
            break

          case 'network':
            browserState.networkRequests.push(...(message.data || []))
            // Keep last 500 requests
            if (browserState.networkRequests.length > 500) {
              browserState.networkRequests = browserState.networkRequests.slice(-500)
            }
            break

          case 'dom':
            browserState.domSnapshot = message.data
            break

          case 'state':
            if (message.data?.componentId) {
              browserState.componentStates.set(
                message.data.componentId,
                message.data
              )
            }
            break

          default:
            logger.warn({ type: message.type }, 'Unknown message type')
        }

        // Send acknowledgment
        ws.send(JSON.stringify({ 
          type: 'ack', 
          id: message.id 
        }))

      } catch (error) {
        logger.error({ error }, 'Failed to process extension message')
      }
    })

    ws.on('close', () => {
      logger.info('Chrome extension disconnected')
    })

    ws.on('error', (error) => {
      logger.error({ error }, 'WebSocket error')
    })
  })

  // Handle shutdown
  process.on('SIGINT', () => {
    logger.info('Shutting down')
    wss.close()
    process.exit(0)
  })

  process.on('SIGTERM', () => {
    logger.info('Shutting down')
    wss.close()
    process.exit(0)
  })

  // Export browser state for MCP handlers to access
  ;(global as any).curupiraBrowserState = browserState
}

main().catch((error) => {
  logger.error({ error }, 'Fatal error')
  process.exit(1)
})