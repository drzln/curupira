/**
 * Chrome Tool Provider - Chrome Discovery and Connection Management
 * Level 2: MCP Core (depends on Level 0-1)
 * 
 * Provides MCP tools for AI assistants to discover and connect to Chrome instances
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import { ChromeManager } from '../../../chrome/manager.js'
import { logger } from '../../../config/logger.js'
import type { ToolProvider, ToolHandler, ToolResult } from '../registry.js'
import { BaseToolProvider } from './base.js'
import * as ChromeRemoteInterface from 'chrome-remote-interface'

export interface ChromeInstance {
  id: string
  type: string
  url: string
  title: string
  description?: string
  webSocketDebuggerUrl?: string
  faviconUrl?: string
  host: string
  port: number
}

export interface ChromeDiscoveryResult {
  instances: ChromeInstance[]
  totalFound: number
  recommendations: string[]
}

export interface ChromeConnectionResult {
  success: boolean
  instanceId: string
  sessionId?: string
  message: string
  capabilities?: string[]
}

export class ChromeToolProvider extends BaseToolProvider implements ToolProvider {
  name = 'chrome'
  
  listTools(): Tool[] {
    return [
      {
        name: 'chrome_discover_instances',
        description: 'Discover available Chrome browser instances for debugging. AI assistants should use this first to find Chrome instances to connect to.',
        inputSchema: {
          type: 'object',
          properties: {
            host: { 
              type: 'string', 
              description: 'Host to search for Chrome instances (default: localhost)',
              default: 'localhost'
            },
            ports: {
              type: 'array',
              items: { type: 'number' },
              description: 'Ports to check for Chrome DevTools (default: [9222, 9223, 9224])',
              default: [9222, 9223, 9224]
            }
          },
          required: []
        }
      },
      {
        name: 'chrome_connect',
        description: 'Connect to a specific Chrome instance for debugging. Use chrome_discover_instances first to find available instances.',
        inputSchema: {
          type: 'object',
          properties: {
            instanceId: {
              type: 'string',
              description: 'Chrome instance ID from chrome_discover_instances'
            },
            host: {
              type: 'string',
              description: 'Chrome DevTools host (default: localhost)',
              default: 'localhost'
            },
            port: {
              type: 'number',
              description: 'Chrome DevTools port (default: 9222)',
              default: 9222
            }
          },
          required: []
        }
      },
      {
        name: 'chrome_status',
        description: 'Get current Chrome connection status and active sessions',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'chrome_disconnect',
        description: 'Disconnect from current Chrome instance',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      }
    ]
  }

  getHandler(toolName: string): ToolHandler | undefined {
    const provider = this

    switch (toolName) {
      case 'chrome_discover_instances':
        return {
          name: toolName,
          description: 'Discover available Chrome browser instances',
          async execute(args: Record<string, unknown>): Promise<ToolResult<ChromeDiscoveryResult>> {
            try {
              const host = (args.host as string) || 'localhost'
              const ports = (args.ports as number[]) || [9222, 9223, 9224]
              
              logger.info({ host, ports }, 'Discovering Chrome instances')

              const instances: ChromeInstance[] = []
              const recommendations: string[] = []

              for (const port of ports) {
                try {
                  // Use chrome-remote-interface to discover instances
                  const targets = await ChromeRemoteInterface.List({ host, port })
                  
                  for (const target of targets) {
                    if (target.type === 'page') {
                      instances.push({
                        id: target.id,
                        type: target.type,
                        url: target.url,
                        title: target.title,
                        description: target.description,
                        webSocketDebuggerUrl: target.webSocketDebuggerUrl,
                        faviconUrl: target.faviconUrl,
                        host,
                        port
                      })
                    }
                  }
                } catch (error) {
                  logger.debug({ host, port, error }, 'No Chrome instance found on port')
                }
              }

              // Generate AI-friendly recommendations
              if (instances.length === 0) {
                recommendations.push('No Chrome instances found. Start Chrome with debugging enabled:')
                recommendations.push('  Chrome: google-chrome --remote-debugging-port=9222')
                recommendations.push('  Chrome (headless): google-chrome --headless --remote-debugging-port=9222')
                recommendations.push('  Then run chrome_discover_instances again')
              } else {
                recommendations.push(`Found ${instances.length} Chrome instance(s)`)
                
                // Find React apps
                const reactInstances = instances.filter(i => 
                  i.title.toLowerCase().includes('react') || 
                  i.url.includes('localhost') ||
                  i.url.includes('3000') ||
                  i.url.includes('3001')
                )
                
                if (reactInstances.length > 0) {
                  recommendations.push(`Detected ${reactInstances.length} potential React app(s)`)
                  recommendations.push(`Use chrome_connect with instanceId: ${reactInstances[0].id}`)
                } else {
                  recommendations.push(`Use chrome_connect with instanceId: ${instances[0].id}`)
                }
              }

              return {
                success: true,
                data: {
                  instances,
                  totalFound: instances.length,
                  recommendations
                }
              }

            } catch (error) {
              logger.error({ error }, 'Failed to discover Chrome instances')
              return {
                success: false,
                error: `Chrome discovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`
              }
            }
          }
        }

      case 'chrome_connect':
        return {
          name: toolName,
          description: 'Connect to a Chrome instance',
          async execute(args: Record<string, unknown>): Promise<ToolResult<ChromeConnectionResult>> {
            try {
              const instanceId = args.instanceId as string
              const host = (args.host as string) || 'localhost'
              const port = (args.port as number) || 9222

              logger.info({ instanceId, host, port }, 'Connecting to Chrome instance')

              // Initialize Chrome manager with connection options
              const chromeManager = ChromeManager.getInstance()
              
              await chromeManager.initialize({
                host,
                port,
                secure: false,
                timeout: 10000,
                retryAttempts: 3,
                retryDelay: 1000
              })

              // Create a debugging session
              const sessionId = await chromeManager.createSession()

              logger.info({ sessionId }, 'Chrome session created successfully')

              return {
                success: true,
                data: {
                  success: true,
                  instanceId: instanceId || 'default',
                  sessionId,
                  message: `Connected to Chrome successfully. Session ID: ${sessionId}`,
                  capabilities: [
                    'React component inspection',
                    'State management debugging',
                    'Performance analysis',
                    'JavaScript evaluation',
                    'Network monitoring'
                  ]
                }
              }

            } catch (error) {
              logger.error({ error }, 'Failed to connect to Chrome')
              return {
                success: false,
                error: `Chrome connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
              }
            }
          }
        }

      case 'chrome_status':
        return {
          name: toolName,
          description: 'Get Chrome connection status',
          async execute(): Promise<ToolResult> {
            try {
              const chromeManager = ChromeManager.getInstance()
              const status = chromeManager.getStatus()

              return {
                success: true,
                data: {
                  connected: status.connected,
                  serviceUrl: status.serviceUrl,
                  activeSessions: status.activeSessions,
                  sessions: status.sessions.map(s => ({
                    sessionId: s.sessionId,
                    createdAt: s.createdAt.toISOString(),
                    age: Date.now() - s.createdAt.getTime()
                  }))
                }
              }

            } catch (error) {
              logger.error({ error }, 'Failed to get Chrome status')
              return {
                success: false,
                error: `Failed to get Chrome status: ${error instanceof Error ? error.message : 'Unknown error'}`
              }
            }
          }
        }

      case 'chrome_disconnect':
        return {
          name: toolName,
          description: 'Disconnect from Chrome',
          async execute(): Promise<ToolResult> {
            try {
              const chromeManager = ChromeManager.getInstance()
              await chromeManager.disconnect()

              return {
                success: true,
                data: { message: 'Disconnected from Chrome successfully' }
              }

            } catch (error) {
              logger.error({ error }, 'Failed to disconnect from Chrome')
              return {
                success: false,
                error: `Failed to disconnect: ${error instanceof Error ? error.message : 'Unknown error'}`
              }
            }
          }
        }

      default:
        return undefined
    }
  }
}