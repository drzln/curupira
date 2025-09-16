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
import type { ExtendedTarget } from '../../../core/types/chrome-extensions.js'

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

export interface ExtendedToolResult extends ToolResult {
  data?: any & {
    troubleshooting?: string[]
    nextSteps?: string[]
    connectionInfo?: any
    errorType?: string
  }
}

// Utility functions
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}

function assessConnectionHealth(status: any): string {
  if (!status.connected) return '❌ Disconnected'
  if (status.activeSessions === 0) return '⚠️ Connected but no active sessions'
  if (status.activeSessions > 10) return '⚠️ Many active sessions'
  return '✅ Healthy'
}

export class ChromeToolProvider extends BaseToolProvider implements ToolProvider {
  name = 'chrome'
  
  /**
   * Format duration in human-readable format
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    } else {
      return `${seconds}s`
    }
  }
  
  /**
   * Assess connection health with Puppeteer-inspired metrics
   */
  private assessConnectionHealth(status: any): { score: number; status: string; issues: string[] } {
    const issues: string[] = []
    let score = 100
    
    if (!status.connected) {
      score = 0
      return { score, status: 'disconnected', issues: ['No Chrome connection'] }
    }
    
    // Check session age (connections over 1 hour might be stale)
    const oldSessions = status.sessions.filter((s: any) => 
      Date.now() - s.createdAt.getTime() > 3600000
    )
    if (oldSessions.length > 0) {
      score -= 20
      issues.push(`${oldSessions.length} session(s) older than 1 hour`)
    }
    
    // Check for too many sessions (might indicate connection leaks)
    if (status.activeSessions > 5) {
      score -= 15
      issues.push(`High session count: ${status.activeSessions}`)
    }
    
    // Check service URL availability
    if (!status.serviceUrl) {
      score -= 10
      issues.push('Service URL not available')
    }
    
    let healthStatus = 'excellent'
    if (score < 70) healthStatus = 'poor'
    else if (score < 85) healthStatus = 'fair'
    else if (score < 95) healthStatus = 'good'
    
    return { score, status: healthStatus, issues }
  }
  
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
                  
                  for (const target of targets as ExtendedTarget[]) {
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

              // Enhanced AI-friendly recommendations with Puppeteer-inspired resilience
              if (instances.length === 0) {
                recommendations.push('🔍 No Chrome instances found. Let me help you start Chrome properly:')
                recommendations.push('')
                recommendations.push('📋 Option 1 - Basic Chrome with debugging:')
                recommendations.push('  google-chrome --remote-debugging-port=9222 --disable-features=VizDisplayCompositor')
                recommendations.push('')
                recommendations.push('📋 Option 2 - Chrome for development (recommended):')
                recommendations.push('  google-chrome --remote-debugging-port=9222 --disable-web-security --disable-features=VizDisplayCompositor --user-data-dir=/tmp/chrome-debug')
                recommendations.push('')
                recommendations.push('📋 Option 3 - Headless Chrome:')
                recommendations.push('  google-chrome --headless --remote-debugging-port=9222 --disable-gpu --no-sandbox')
                recommendations.push('')
                recommendations.push('💡 After starting Chrome, run chrome_discover_instances again')
                recommendations.push('⚠️  If issues persist, try different ports: 9223, 9224, or 9225')
              } else {
                recommendations.push(`✅ Found ${instances.length} Chrome instance(s) ready for debugging`)
                
                // Enhanced React app detection with multiple patterns
                const reactInstances = instances.filter(i => {
                  const title = i.title.toLowerCase()
                  const url = i.url.toLowerCase()
                  
                  return title.includes('react') || 
                         title.includes('vite') ||
                         title.includes('next') ||
                         title.includes('webpack') ||
                         url.includes('localhost') ||
                         url.includes('127.0.0.1') ||
                         url.includes(':3000') ||
                         url.includes(':3001') ||
                         url.includes(':5173') ||
                         url.includes(':8080')
                })
                
                const devInstances = instances.filter(i => {
                  const url = i.url.toLowerCase()
                  return url.includes('localhost') || url.includes('127.0.0.1') || url.includes('dev')
                })
                
                if (reactInstances.length > 0) {
                  recommendations.push(`🎯 Detected ${reactInstances.length} potential React/development app(s)`)
                  recommendations.push(`🚀 Recommended: Use chrome_connect with instanceId: '${reactInstances[0].id}'`)
                  recommendations.push(`📱 App: ${reactInstances[0].title} (${reactInstances[0].url})`)
                  
                  if (reactInstances.length > 1) {
                    recommendations.push(`💡 Other options: ${reactInstances.slice(1).map(r => r.id).join(', ')}`)
                  }
                } else if (devInstances.length > 0) {
                  recommendations.push(`🔧 Found ${devInstances.length} development instance(s)`)
                  recommendations.push(`🚀 Try: chrome_connect with instanceId: '${devInstances[0].id}'`)
                } else {
                  recommendations.push(`🌐 Found ${instances.length} browser instance(s)`)
                  recommendations.push(`🚀 Connect to: chrome_connect with instanceId: '${instances[0].id}'`)
                }
                
                recommendations.push('')
                recommendations.push('🔄 Pro tip: Refresh the page if React DevTools aren\'t detected')
                recommendations.push('🛠️  Use chrome_status after connecting to verify the connection')
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
          async execute(args: Record<string, unknown>): Promise<ExtendedToolResult> {
            const instanceId = args.instanceId as string
            const host = (args.host as string) || 'localhost'
            const port = (args.port as number) || 9222
            
            try {

              logger.info({ instanceId, host, port }, 'Connecting to Chrome instance')

              // Initialize Chrome manager with Puppeteer-inspired resilience patterns
              const chromeManager = ChromeManager.getInstance()
              
              // Enhanced connection options with retry logic
              const connectionOptions = {
                host,
                port,
                secure: false,
                timeout: 15000,        // Longer timeout for slower systems
                retryAttempts: 5,      // More retry attempts
                retryDelay: 2000,      // Longer delay between retries
                // Puppeteer-inspired connection resilience
                keepAlive: true,
                maxReconnectAttempts: 3,
                reconnectDelay: 1000
              }
              
              logger.info('🔗 Attempting Chrome connection with enhanced resilience...')
              
              // Multi-stage connection with progressive fallback
              let connectionError: string | null = null
              
              try {
                await chromeManager.initialize(connectionOptions)
              } catch (error) {
                connectionError = error instanceof Error ? error.message : 'Unknown error'
                logger.warn(`Initial connection failed: ${connectionError}`)
                
                // Fallback: Try with reduced timeout for faster feedback
                logger.info('🔄 Trying fallback connection with reduced timeout...')
                try {
                  await chromeManager.initialize({
                    ...connectionOptions,
                    timeout: 5000
                    // retryAttempts: 2 // Not part of CDPConnectionOptions
                  })
                  connectionError = null // Success on fallback
                } catch (fallbackError) {
                  connectionError = fallbackError instanceof Error ? fallbackError.message : 'Connection failed'
                }
              }
              
              if (connectionError) {
                return {
                  success: false,
                  error: `Chrome connection failed: ${connectionError}`,
                  data: {
                    troubleshooting: [
                      '🔧 Ensure Chrome is running with --remote-debugging-port=9222',
                      '🌐 Check if another application is using the debugging port',
                      '🔄 Try restarting Chrome with debugging enabled',
                      '🎯 Verify the instanceId is correct from chrome_discover_instances',
                      '⚡ Try a different port (9223, 9224) if 9222 is busy'
                    ],
                    nextSteps: [
                      'Run chrome_discover_instances to verify available instances',
                      'Check Chrome process: ps aux | grep chrome',
                      'Try manual connection: chrome://inspect in browser'
                    ]
                  }
                }
              }

              // Create a debugging session
              const sessionId = await chromeManager.createSession()

              logger.info({ sessionId }, 'Chrome session created successfully')

              // Enhanced success response with comprehensive capabilities
              const capabilities = [
                '⚛️  React component inspection and analysis',
                '🔄 State management debugging (Redux, Zustand, Context)',
                '⚡ Performance analysis and re-render monitoring',
                '🧪 JavaScript evaluation and testing',
                '🌐 Network request monitoring',
                '📸 State snapshot capture and time-travel debugging',
                '🔍 Hook dependency analysis and optimization',
                '🎯 Component tree visualization and navigation'
              ]
              
              logger.info(`✅ Chrome connection successful! Session: ${sessionId}`)
              
              return {
                success: true,
                data: {
                  success: true,
                  instanceId: instanceId || 'default',
                  sessionId,
                  message: `🚀 Successfully connected to Chrome! Ready for React debugging.`,
                  connectionInfo: {
                    host,
                    port,
                    sessionId,
                    timestamp: new Date().toISOString()
                  },
                  capabilities,
                  nextSteps: [
                    '🌳 Run react_get_component_tree to explore your React app structure',
                    '🔍 Use react_detect_version to verify React and DevTools availability',
                    '🎯 Try react_find_component to locate specific components',
                    '📊 Use chrome_status anytime to check connection health'
                  ],
                  tips: [
                    '💡 All React debugging tools are now available',
                    '🔄 Connection will auto-reconnect if interrupted',
                    '📝 Use descriptive component names for easier debugging',
                    '⚡ Enable React DevTools browser extension for enhanced debugging'
                  ]
                }
              }

            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error'
              logger.error({ error: errorMessage, host, port, instanceId }, 'Chrome connection failed')
              
              // Puppeteer-inspired error analysis and recommendations
              const isTimeoutError = errorMessage.toLowerCase().includes('timeout')
              const isConnectionRefused = errorMessage.toLowerCase().includes('econnrefused')
              const isProtocolError = errorMessage.toLowerCase().includes('protocol')
              
              let recommendations: string[] = []
              
              if (isTimeoutError) {
                recommendations = [
                  '⏱️  Connection timed out - Chrome may be slow to respond',
                  '🔄 Try again - Chrome might be starting up',
                  '⚡ Close other browser tabs to reduce Chrome load',
                  '🎯 Ensure Chrome has --remote-debugging-port flag'
                ]
              } else if (isConnectionRefused) {
                recommendations = [
                  '🚫 Connection refused - Chrome debugging port not accessible',
                  '🔧 Start Chrome with: --remote-debugging-port=9222',
                  '🌐 Check if port 9222 is available: netstat -an | grep 9222',
                  '🎯 Try alternative ports: 9223, 9224, 9225'
                ]
              } else if (isProtocolError) {
                recommendations = [
                  '🔌 Protocol error - Chrome DevTools version mismatch',
                  '🔄 Restart Chrome with fresh debugging session',
                  '🎯 Use Chrome Canary or stable Chrome version',
                  '💻 Update Chrome to latest version'
                ]
              } else {
                recommendations = [
                  '🔍 Run chrome_discover_instances to check available instances',
                  '🔧 Verify Chrome is running with debugging enabled',
                  '🌐 Check network connectivity to Chrome instance',
                  '📋 Try manual connection via chrome://inspect'
                ]
              }
              
              return {
                success: false,
                error: `Chrome connection failed: ${errorMessage}`,
                data: {
                  errorType: isTimeoutError ? 'timeout' : isConnectionRefused ? 'connection_refused' : isProtocolError ? 'protocol_error' : 'unknown',
                  recommendations,
                  nextSteps: [
                    'Run chrome_discover_instances to verify available instances',
                    'Check Chrome startup command includes --remote-debugging-port',
                    'Try chrome_status to verify current connection state',
                    'Consider restarting Chrome with debugging enabled'
                  ],
                  troubleshooting: {
                    quickFix: 'google-chrome --remote-debugging-port=9222',
                    advancedFix: 'google-chrome --remote-debugging-port=9222 --disable-web-security --user-data-dir=/tmp/chrome-debug',
                    networkCheck: 'curl http://localhost:9222/json',
                    processCheck: 'ps aux | grep "remote-debugging-port"'
                  }
                }
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

              // Enhanced status with Puppeteer-inspired health monitoring
              const healthInfo = {
                connected: status.connected,
                serviceUrl: status.serviceUrl,
                activeSessions: status.activeSessions,
                sessions: status.sessions.map(s => ({
                  sessionId: s.sessionId,
                  createdAt: s.createdAt.toISOString(),
                  age: Date.now() - s.createdAt.getTime(),
                  ageFormatted: formatDuration(Date.now() - s.createdAt.getTime())
                })),
                health: assessConnectionHealth(status),
                capabilities: status.connected ? [
                  '✅ Chrome DevTools Protocol available',
                  '✅ JavaScript evaluation ready',
                  '✅ React debugging tools active',
                  '✅ Performance monitoring enabled'
                ] : [
                  '❌ No active Chrome connection',
                  '❌ Debugging tools unavailable',
                  '❌ Cannot execute JavaScript',
                  '❌ React tools not accessible'
                ]
              }
              
              return {
                success: true,
                data: {
                  ...healthInfo,
                  recommendations: status.connected ? [
                    '🎯 Connection is healthy and ready for debugging',
                    '🌳 Try react_get_component_tree to start debugging',
                    '🔍 Use react_detect_version to verify React availability',
                    '📊 Monitor with react_analyze_rerenders for performance issues'
                  ] : [
                    '🔌 No Chrome connection detected',
                    '🚀 Run chrome_discover_instances to find available Chrome instances',
                    '🔗 Use chrome_connect to establish debugging connection',
                    '🔧 Ensure Chrome is running with --remote-debugging-port=9222'
                  ]
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

              logger.info('🔌 Chrome disconnection successful')
              
              return {
                success: true,
                data: { 
                  message: '✅ Disconnected from Chrome successfully',
                  timestamp: new Date().toISOString(),
                  summary: {
                    sessionsTerminated: 'All active sessions closed',
                    resourcesFreed: 'Memory and connections cleaned up',
                    state: 'Ready for new connection'
                  },
                  nextSteps: [
                    '🔍 Run chrome_discover_instances to find Chrome instances',
                    '🔗 Use chrome_connect to establish new debugging session',
                    '📊 Check chrome_status to verify disconnection'
                  ]
                }
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