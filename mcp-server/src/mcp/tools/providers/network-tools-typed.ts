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
        name: 'network_get_cookies',
        description: 'Get cookies for current page',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          }
        }
      },
      {
        name: 'network_set_cookie',
        description: 'Set a cookie',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Cookie name' },
            value: { type: 'string', description: 'Cookie value' },
            domain: { type: 'string', description: 'Cookie domain (optional)' },
            path: { type: 'string', description: 'Cookie path (optional)' },
            secure: { type: 'boolean', description: 'Secure cookie (optional)' },
            httpOnly: { type: 'boolean', description: 'HTTP only cookie (optional)' },
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          },
          required: ['name', 'value']
        }
      }
    ]
  }
  
  getHandler(toolName: string): ToolHandler | undefined {
    const provider = this
    const handlers: Record<string, ToolHandler> = {
      network_clear_cache: {
        name: 'network_clear_cache',
        description: 'Clear browser cache',
        async execute(args): Promise<ToolResult> {
          try {
            const { sessionId: argSessionId } = args as { sessionId?: string }
            const sessionId = await provider.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const typed = manager.getTypedClient()
            
            await typed.enableNetwork(sessionId)
            
            // Clear browser cache and cookies
            await typed.send('Network.clearBrowserCache', {}, sessionId)
            await typed.send('Network.clearBrowserCookies', {}, sessionId)
            
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
      
      network_get_cookies: {
        name: 'network_get_cookies',
        description: 'Get cookies',
        async execute(args): Promise<ToolResult> {
          try {
            const { sessionId: argSessionId } = args as { sessionId?: string }
            const sessionId = await provider.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const typed = manager.getTypedClient()
            
            await typed.enableNetwork(sessionId)
            
            const result = await typed.getCookies({}, sessionId)
            
            return {
              success: true,
              data: {
                cookies: result.cookies,
                count: result.cookies.length
              }
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to get cookies'
            }
          }
        }
      },
      
      network_set_cookie: {
        name: 'network_set_cookie',
        description: 'Set a cookie',
        async execute(args): Promise<ToolResult> {
          try {
            const { 
              name, 
              value, 
              domain, 
              path = '/', 
              secure = false, 
              httpOnly = false,
              sessionId: argSessionId 
            } = args as { 
              name: string;
              value: string;
              domain?: string;
              path?: string;
              secure?: boolean;
              httpOnly?: boolean;
              sessionId?: string 
            }
            const sessionId = await provider.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const typed = manager.getTypedClient()
            
            await typed.enableNetwork(sessionId)
            
            const result = await typed.setCookie({
              name,
              value,
              domain,
              path,
              secure,
              httpOnly
            }, sessionId)
            
            return {
              success: result.success,
              data: {
                name,
                value,
                domain,
                path
              }
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to set cookie'
            }
          }
        }
      }
    }
    
    const handler = handlers[toolName]
    if (!handler) return undefined
    
    return handler
  }
}

// Benefits of typed implementation:
// - All network operations are type-safe
// - Cookie operations have proper types
// - No more property access errors
// - Simplified implementation focusing on type safety