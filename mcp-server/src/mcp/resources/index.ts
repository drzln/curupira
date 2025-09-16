/**
 * MCP Resource Handler Setup - Uses registry pattern for modularity
 * This replaces the 1000+ line index.ts with a clean, modular approach
 */

import type { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { ListResourcesRequestSchema, ReadResourceRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { logger } from '../../config/logger.js'
import { getResourceRegistry } from './registry.js'
import { CDPResourceProviderImpl } from './providers/cdp-resources.js'
import { ReactResourceProviderImpl } from './providers/react-resources.js'
import { StateResourceProviderImpl } from './providers/state-resources.js'
import { ConnectivityTroubleshootingProvider } from './providers/connectivity.js'

export function setupUnifiedResourceHandlers(server: Server) {
  logger.info('Setting up unified resource handlers with registry pattern')
  
  // Initialize the registry
  const registry = getResourceRegistry()
  
  // Register all resource providers
  registry.register(new CDPResourceProviderImpl())
  registry.register(new ReactResourceProviderImpl())
  registry.register(new StateResourceProviderImpl())
  
  // Register connectivity provider directly (it already implements ResourceProvider interface)
  const connectivityProvider = new ConnectivityTroubleshootingProvider()
  registry.register({
    name: 'connectivity',
    async listResources() {
      return [
        {
          uri: 'connectivity/http-test',
          name: 'HTTP Connectivity Test',
          description: 'Test HTTP connectivity to a URL',
          mimeType: 'application/json'
        },
        {
          uri: 'connectivity/websocket-test',
          name: 'WebSocket Connectivity Test',
          description: 'Test WebSocket connectivity',
          mimeType: 'application/json'
        },
        {
          uri: 'connectivity/cors-test',
          name: 'CORS Configuration Test',
          description: 'Test CORS configuration for a URL',
          mimeType: 'application/json'
        },
        {
          uri: 'connectivity/diagnostic',
          name: 'Network Diagnostic',
          description: 'Comprehensive network diagnostic',
          mimeType: 'application/json'
        }
      ]
    },
    async readResource(uri: string) {
      const [, resource] = uri.split('/')
      
      // For connectivity resources, we return instructions
      // The actual testing is done via tools
      switch (resource) {
        case 'http-test':
          return {
            description: 'Use the connectivity_test tool to test HTTP connectivity',
            example: { url: 'https://api.example.com', method: 'GET' }
          }
          
        case 'websocket-test':
          return {
            description: 'Use the connectivity_websocket_test tool to test WebSocket',
            example: { url: 'wss://ws.example.com' }
          }
          
        case 'cors-test':
          return {
            description: 'Use the connectivity_cors_test tool to test CORS',
            example: { url: 'https://api.example.com', origin: 'https://app.example.com' }
          }
          
        case 'diagnostic':
          return {
            description: 'Use the connectivity_diagnostic tool for comprehensive testing',
            example: {
              targets: {
                http: ['https://api.example.com'],
                websocket: ['wss://ws.example.com'],
                cors: [{ url: 'https://api.example.com', origin: 'https://app.example.com' }]
              }
            }
          }
          
        default:
          throw new Error(`Unknown connectivity resource: ${uri}`)
      }
    }
  })
  
  // Set up the list resources handler
  server.setRequestHandler(ListResourcesRequestSchema, async (request) => {
    logger.info('Resource list request received')
    
    try {
      const resources = await registry.listAllResources()
      
      logger.info(`Returning ${resources.length} resources`)
      return { resources }
    } catch (error) {
      logger.error({ error }, 'Failed to list resources')
      return { resources: [] }
    }
  })
  
  // Set up the read resource handler
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params
    logger.info({ uri }, 'Resource read request received')
    
    try {
      const contents = await registry.readResource(uri)
      
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(contents, null, 2)
          }
        ]
      }
    } catch (error) {
      logger.error({ error, uri }, 'Failed to read resource')
      
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              error: error instanceof Error ? error.message : 'Unknown error',
              timestamp: new Date().toISOString()
            }, null, 2)
          }
        ]
      }
    }
  })
  
  logger.info('Unified resource handlers setup complete')
}