/**
 * Network Tool Provider - Typed Implementation
 * Uses TypedCDPClient for full type safety
 * Level 2: MCP Core (depends on Level 0-1)
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { SessionId } from '@curupira/shared/types'
import { ChromeManager } from '../../../chrome/manager.js'
import { logger } from '../../../config/logger.js'
import type { ToolProvider, ToolHandler, ToolResult } from '../registry.js'
import { BaseToolProvider } from './base.js'
import type * as CDP from '@curupira/shared/cdp-types'

export class NetworkToolProvider extends BaseToolProvider implements ToolProvider {
  name = 'network'
  
  listTools(): Tool[] {
    return [
      {
        name: 'network_mock_request',
        description: 'Mock network request responses',
        inputSchema: {
          type: 'object',
          properties: {
            urlPattern: { type: 'string', description: 'URL pattern to match' },
            method: { 
              type: 'string', 
              enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
              description: 'HTTP method (optional)' 
            },
            response: {
              type: 'object',
              properties: {
                status: { type: 'number', description: 'HTTP status code' },
                body: { type: 'object', description: 'Response body' },
                headers: { type: 'object', description: 'Response headers (optional)' }
              },
              required: ['status', 'body']
            },
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          },
          required: ['urlPattern', 'response']
        }
      },
      {
        name: 'network_block_urls',
        description: 'Block network requests to specific URLs',
        inputSchema: {
          type: 'object',
          properties: {
            urlPatterns: { 
              type: 'array', 
              items: { type: 'string' },
              description: 'URL patterns to block' 
            },
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          },
          required: ['urlPatterns']
        }
      },
      {
        name: 'network_throttle',
        description: 'Throttle network speed',
        inputSchema: {
          type: 'object',
          properties: {
            profile: { 
              type: 'string',
              enum: ['offline', 'slow-3g', 'fast-3g', '4g', 'wifi', 'online'],
              description: 'Network throttling profile'
            },
            custom: {
              type: 'object',
              properties: {
                downloadThroughput: { type: 'number', description: 'Download speed in bytes/sec' },
                uploadThroughput: { type: 'number', description: 'Upload speed in bytes/sec' },
                latency: { type: 'number', description: 'Latency in milliseconds' }
              },
              description: 'Custom throttling settings (optional)'
            },
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          },
          required: ['profile']
        }
      },
      {
        name: 'network_clear_cache',
        description: 'Clear browser cache',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          }
        }
      },
      {
        name: 'network_get_requests',
        description: 'Get recent network requests',
        inputSchema: {
          type: 'object',
          properties: {
            filter: { 
              type: 'string', 
              description: 'Filter by URL pattern (optional)' 
            },
            limit: { 
              type: 'number', 
              description: 'Max number of requests to return (default: 50)' 
            },
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          }
        }
      },
      {
        name: 'network_modify_headers',
        description: 'Modify request/response headers',
        inputSchema: {
          type: 'object',
          properties: {
            urlPattern: { type: 'string', description: 'URL pattern to match' },
            requestHeaders: { 
              type: 'object', 
              description: 'Headers to add/modify in requests (optional)' 
            },
            responseHeaders: { 
              type: 'object', 
              description: 'Headers to add/modify in responses (optional)' 
            },
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          },
          required: ['urlPattern']
        }
      },
      {
        name: 'network_replay_request',
        description: 'Replay a network request',
        inputSchema: {
          type: 'object',
          properties: {
            requestId: { type: 'string', description: 'ID of request to replay' },
            modifyBody: { type: 'object', description: 'Modified request body (optional)' },
            modifyHeaders: { type: 'object', description: 'Modified headers (optional)' },
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          },
          required: ['requestId']
        }
      }
    ]
  }
  
  getHandler(toolName: string): ToolHandler | undefined {
    const provider = this
    const handlers: Record<string, ToolHandler> = {
      network_mock_request: {
        name: 'network_mock_request',
        description: 'Mock network request responses',
        async execute(args): Promise<ToolResult> {
          try {
            const { urlPattern, method = '*', response, sessionId: argSessionId } = args as { 
              urlPattern: string;
              method?: string;
              response: {
                status: number;
                body: unknown;
                headers?: Record<string, string>;
              };
              sessionId?: string 
            }
            const sessionId = await provider.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const client = manager.getClient()
            const typed = manager.getTypedClient()
            
            await client.send('Fetch.enable', {
              patterns: [{
                urlPattern,
                requestStage: 'Response'
              }]
            }, sessionId)
            
            // Store mock configuration
            await typed.evaluate(`
                window.__CURUPIRA_MOCKS__ = window.__CURUPIRA_MOCKS__ || new Map();
                window.__CURUPIRA_MOCKS__.set('${urlPattern}', {
                  method: '${method}',
                  response: ${JSON.stringify(response)}
                });
                'Mock configured for ' + '${urlPattern}';
              `, {
              returnByValue: true
            }, sessionId)
            
            // Set up request interception
            client.on('Fetch.requestPaused', async (params) => {
              if (params.request.url.match(new RegExp(urlPattern))) {
                if (method === '*' || params.request.method === method) {
                  // Send mocked response
                  const responseBody = typeof response.body === 'string' 
                    ? response.body 
                    : JSON.stringify(response.body)
                  
                  await client.send('Fetch.fulfillRequest', {
                    requestId: params.requestId,
                    responseCode: response.status,
                    responseHeaders: Object.entries(response.headers || {
                      'Content-Type': 'application/json'
                    }).map(([name, value]) => ({ name, value })),
                    body: Buffer.from(responseBody).toString('base64')
                  }, sessionId)
                  
                  return
                }
              }
              
              // Continue other requests normally
              await client.send('Fetch.continueRequest', {
                requestId: params.requestId
              }, sessionId)
            })
            
            return {
              success: true,
              data: {
                urlPattern,
                method,
                mockActive: true,
                response
              }
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to mock request'
            }
          }
        }
      },
      
      network_block_urls: {
        name: 'network_block_urls',
        description: 'Block network requests to specific URLs',
        async execute(args): Promise<ToolResult> {
          try {
            const { urlPatterns, sessionId: argSessionId } = args as { 
              urlPatterns: string[];
              sessionId?: string 
            }
            const sessionId = await provider.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const client = manager.getClient()
            
            // Enable request interception for all patterns
            await client.send('Fetch.enable', {
              patterns: urlPatterns.map(urlPattern => ({
                urlPattern,
                requestStage: 'Request'
              }))
            }, sessionId)
            
            // Set up blocking
            client.on('Fetch.requestPaused', async (params) => {
              const shouldBlock = urlPatterns.some(pattern => 
                params.request.url.match(new RegExp(pattern))
              )
              
              if (shouldBlock) {
                // Fail the request
                await client.send('Fetch.failRequest', {
                  requestId: params.requestId,
                  errorReason: 'BlockedByClient'
                }, sessionId)
              } else {
                // Continue normally
                await client.send('Fetch.continueRequest', {
                  requestId: params.requestId
                }, sessionId)
              }
            })
            
            return {
              success: true,
              data: {
                blockedPatterns: urlPatterns,
                status: 'active'
              }
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to block URLs'
            }
          }
        }
      },
      
      network_throttle: {
        name: 'network_throttle',
        description: 'Throttle network speed',
        async execute(args): Promise<ToolResult> {
          try {
            const { profile, custom, sessionId: argSessionId } = args as { 
              profile: string;
              custom?: {
                downloadThroughput: number;
                uploadThroughput: number;
                latency: number;
              };
              sessionId?: string 
            }
            const sessionId = await provider.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const client = manager.getClient()
            
            // Network profiles
            const profiles: Record<string, any> = {
              offline: { offline: true, downloadThroughput: 0, uploadThroughput: 0, latency: 0 },
              'slow-3g': { offline: false, downloadThroughput: 50 * 1024, uploadThroughput: 50 * 1024, latency: 2000 },
              'fast-3g': { offline: false, downloadThroughput: 180 * 1024, uploadThroughput: 84 * 1024, latency: 562 },
              '4g': { offline: false, downloadThroughput: 4 * 1024 * 1024, uploadThroughput: 3 * 1024 * 1024, latency: 150 },
              wifi: { offline: false, downloadThroughput: 30 * 1024 * 1024, uploadThroughput: 15 * 1024 * 1024, latency: 40 },
              online: { offline: false, downloadThroughput: -1, uploadThroughput: -1, latency: 0 }
            }
            
            const conditions = custom || profiles[profile] || profiles.online
            
            await client.send('Network.enable', {}, sessionId)
            await client.send('Network.emulateNetworkConditions', conditions, sessionId)
            
            return {
              success: true,
              data: {
                profile,
                conditions,
                status: 'active'
              }
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to throttle network'
            }
          }
        }
      },
      
      network_clear_cache: {
        name: 'network_clear_cache',
        description: 'Clear browser cache',
        async execute(args): Promise<ToolResult> {
          try {
            const { sessionId: argSessionId } = args as { sessionId?: string }
            const sessionId = await provider.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const client = manager.getClient()
            
            await client.send('Network.enable', {}, sessionId)
            await client.send('Network.clearBrowserCache', {}, sessionId)
            await client.send('Network.clearBrowserCookies', {}, sessionId)
            
            return {
              success: true,
              data: {
                cleared: true,
                timestamp: new Date().toISOString()
              }
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to clear cache'
            }
          }
        }
      },
      
      network_get_requests: {
        name: 'network_get_requests',
        description: 'Get recent network requests',
        async execute(args): Promise<ToolResult> {
          try {
            const { filter, limit = 50, sessionId: argSessionId } = args as { 
              filter?: string;
              limit?: number;
              sessionId?: string 
            }
            const sessionId = await provider.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const typed = manager.getTypedClient()
            
            // Get requests from performance entries
            await typed.enableRuntime(sessionId)
            const result = await typed.evaluate(`
                (() => {
                  const entries = performance.getEntriesByType('resource');
                  const navigation = performance.getEntriesByType('navigation')[0];
                  
                  const requests = [];
                  
                  // Add navigation request
                  if (navigation) {
                    requests.push({
                      url: navigation.name,
                      method: 'GET',
                      startTime: navigation.startTime,
                      duration: navigation.duration,
                      transferSize: navigation.transferSize,
                      encodedBodySize: navigation.encodedBodySize,
                      decodedBodySize: navigation.decodedBodySize,
                      type: 'navigation'
                    });
                  }
                  
                  // Add resource requests
                  entries.forEach(entry => {
                    if ('${filter}' && !entry.name.includes('${filter}')) return;
                    
                    requests.push({
                      url: entry.name,
                      startTime: entry.startTime,
                      duration: entry.duration,
                      transferSize: entry.transferSize || 0,
                      encodedBodySize: entry.encodedBodySize || 0,
                      decodedBodySize: entry.decodedBodySize || 0,
                      initiatorType: entry.initiatorType,
                      type: 'resource'
                    });
                  });
                  
                  // Sort by start time descending
                  requests.sort((a, b) => b.startTime - a.startTime);
                  
                  return {
                    requests: requests.slice(0, ${limit}),
                    total: requests.length
                  };
                })()
              `, {
              returnByValue: true
            }, sessionId)
            
            return {
              success: true,
              data: result.result.value
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to get requests'
            }
          }
        }
      },
      
      network_modify_headers: {
        name: 'network_modify_headers',
        description: 'Modify request/response headers',
        async execute(args): Promise<ToolResult> {
          try {
            const { 
              urlPattern, 
              requestHeaders, 
              responseHeaders, 
              sessionId: argSessionId 
            } = args as { 
              urlPattern: string;
              requestHeaders?: Record<string, string>;
              responseHeaders?: Record<string, string>;
              sessionId?: string 
            }
            const sessionId = await provider.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const client = manager.getClient()
            
            // Enable fetch for header modification
            await client.send('Fetch.enable', {
              patterns: [{
                urlPattern,
                requestStage: requestHeaders ? 'Request' : 'Response'
              }]
            }, sessionId)
            
            client.on('Fetch.requestPaused', async (params) => {
              if (!params.request.url.match(new RegExp(urlPattern))) {
                await client.send('Fetch.continueRequest', {
                  requestId: params.requestId
                }, sessionId)
                return
              }
              
              if (params.responseStatusCode && responseHeaders) {
                // Modify response headers
                const headers = params.responseHeaders || []
                
                // Add/modify headers
                Object.entries(responseHeaders).forEach(([name, value]) => {
                  const existing = headers.findIndex(h => 
                    h.name.toLowerCase() === name.toLowerCase()
                  )
                  
                  if (existing >= 0) {
                    headers[existing].value = value
                  } else {
                    headers.push({ name, value })
                  }
                })
                
                await client.send('Fetch.continueResponse', {
                  requestId: params.requestId,
                  responseHeaders: headers
                }, sessionId)
              } else if (!params.responseStatusCode && requestHeaders) {
                // Modify request headers
                const headers = params.request.headers
                
                Object.entries(requestHeaders).forEach(([name, value]) => {
                  headers[name] = value
                })
                
                await client.send('Fetch.continueRequest', {
                  requestId: params.requestId,
                  headers
                }, sessionId)
              } else {
                await client.send('Fetch.continueRequest', {
                  requestId: params.requestId
                }, sessionId)
              }
            })
            
            return {
              success: true,
              data: {
                urlPattern,
                requestHeaders,
                responseHeaders,
                status: 'active'
              }
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to modify headers'
            }
          }
        }
      },
      
      network_replay_request: {
        name: 'network_replay_request',
        description: 'Replay a network request',
        async execute(args): Promise<ToolResult> {
          try {
            const { 
              requestId, 
              modifyBody, 
              modifyHeaders, 
              sessionId: argSessionId 
            } = args as { 
              requestId: string;
              modifyBody?: unknown;
              modifyHeaders?: Record<string, string>;
              sessionId?: string 
            }
            const sessionId = await provider.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const typed = manager.getTypedClient()
            
            // This is a simplified version - in practice, you'd need to store
            // request details from Network.requestWillBeSent events
            await typed.enableRuntime(sessionId)
            const result = await typed.evaluate(`
                (() => {
                  // Note: This is a placeholder - real implementation would
                  // require storing actual request details
                  return {
                    message: 'Request replay requires request history tracking',
                    requestId: '${requestId}',
                    note: 'Enable Network domain events to capture requests for replay'
                  };
                })()
              `, {
              returnByValue: true
            }, sessionId)
            
            return {
              success: true,
              data: result.result.value,
              warnings: ['Full request replay requires request history tracking']
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to replay request'
            }
          }
        }
      }
    }
    
    const handler = handlers[toolName]
    if (!handler) return undefined
    
    return handler // ✅ FIXED: Proper binding
  }
}
