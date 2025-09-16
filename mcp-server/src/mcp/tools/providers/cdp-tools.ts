/**
 * CDP Tool Provider - Chrome DevTools Protocol debugging tools
 * Level 2: MCP Core (depends on Level 0-1)
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { SessionId } from '@curupira/shared/types'
import { ChromeManager } from '../../../chrome/manager.js'
import { logger } from '../../../config/logger.js'
import type { ToolProvider, ToolHandler, ToolResult } from '../registry.js'
import type {
  EvaluateArgs,
  NavigateArgs,
  ScreenshotArgs,
  CookieArgs,
  SetCookieArgs,
  BaseToolArgs
} from '../types.js'
import { BaseToolProvider } from './base.js'

export class CDPToolProvider extends BaseToolProvider implements ToolProvider {
  name = 'cdp'
  
  listTools(): Tool[] {
    return [
      {
        name: 'cdp_evaluate',
        description: 'Evaluate JavaScript expression in the browser',
        inputSchema: {
          type: 'object',
          properties: {
            expression: { type: 'string', description: 'JavaScript expression to evaluate' },
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          },
          required: ['expression']
        }
      },
      {
        name: 'cdp_navigate',
        description: 'Navigate to a URL',
        inputSchema: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'URL to navigate to' },
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' },
            waitUntil: { 
              type: 'string', 
              enum: ['load', 'domcontentloaded', 'networkidle0', 'networkidle2'],
              description: 'Wait condition (optional)'
            }
          },
          required: ['url']
        }
      },
      {
        name: 'cdp_screenshot',
        description: 'Take a screenshot of the page',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' },
            fullPage: { type: 'boolean', description: 'Capture full page (optional)' },
            selector: { type: 'string', description: 'CSS selector to capture (optional)' }
          }
        }
      },
      {
        name: 'cdp_get_cookies',
        description: 'Get browser cookies',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' },
            urls: { 
              type: 'array', 
              items: { type: 'string' },
              description: 'Filter cookies by URLs (optional)'
            }
          }
        }
      },
      {
        name: 'cdp_set_cookie',
        description: 'Set a browser cookie',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' },
            name: { type: 'string', description: 'Cookie name' },
            value: { type: 'string', description: 'Cookie value' },
            domain: { type: 'string', description: 'Cookie domain (optional)' },
            path: { type: 'string', description: 'Cookie path (optional)' },
            secure: { type: 'boolean', description: 'Secure cookie (optional)' },
            httpOnly: { type: 'boolean', description: 'HTTP only cookie (optional)' },
            sameSite: { 
              type: 'string',
              enum: ['Strict', 'Lax', 'None'],
              description: 'SameSite attribute (optional)'
            }
          },
          required: ['name', 'value']
        }
      },
      {
        name: 'cdp_clear_cookies',
        description: 'Clear browser cookies',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          }
        }
      }
    ]
  }
  
  getHandler(toolName: string): ToolHandler | undefined {
    const handlers: Record<string, ToolHandler> = {
      cdp_evaluate: {
        name: 'cdp_evaluate',
        description: 'Evaluate JavaScript expression in the browser',
        execute: async (args): Promise<ToolResult> => {
          try {
            const { expression, sessionId: argSessionId } = args as EvaluateArgs
            const sessionId = await this.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const client = manager.getClient()
            
            await client.send('Runtime.enable', {}, sessionId)
            const result = await client.send('Runtime.evaluate', {
              expression,
              returnByValue: true,
              awaitPromise: true
            }, sessionId)
            
            if (result.exceptionDetails) {
              return {
                success: false,
                error: `Evaluation error: ${result.exceptionDetails.text}`,
                data: result.exceptionDetails
              }
            }
            
            return {
              success: true,
              data: result.result.value
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Evaluation failed'
            }
          }
        }
      },
      
      cdp_navigate: {
        name: 'cdp_navigate',
        description: 'Navigate to a URL',
        async execute(args): Promise<ToolResult> {
          try {
            const { url, sessionId: argSessionId, waitUntil = 'load' } = args as NavigateArgs
            const sessionId = await this.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const client = manager.getClient()
            
            await client.send('Page.enable', {}, sessionId)
            
            const { frameId } = await client.send('Page.navigate', { url }, sessionId)
            
            // Wait for the specified event
            if (waitUntil === 'load') {
              await client.send('Page.waitForLoadEvent', {}, sessionId)
            }
            
            return {
              success: true,
              data: { frameId, url }
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Navigation failed'
            }
          }
        }
      },
      
      cdp_screenshot: {
        name: 'cdp_screenshot',
        description: 'Take a screenshot',
        async execute(args): Promise<ToolResult> {
          try {
            const { sessionId: argSessionId, fullPage = false, selector } = args as ScreenshotArgs
            const sessionId = await this.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const client = manager.getClient()
            
            await client.send('Page.enable', {}, sessionId)
            
            // If selector provided, find the element first
            let clip
            if (selector) {
              await client.send('DOM.enable', {}, sessionId)
              const { root } = await client.send('DOM.getDocument', {}, sessionId)
              const { nodeId } = await client.send('DOM.querySelector', {
                nodeId: root.nodeId,
                selector
              }, sessionId)
              
              if (nodeId) {
                const { model } = await client.send('DOM.getBoxModel', { nodeId }, sessionId)
                const [x, y] = model.content.slice(0, 2)
                const width = model.width
                const height = model.height
                clip = { x, y, width, height, scale: 1 }
              }
            }
            
            const { data } = await client.send('Page.captureScreenshot', {
              format: 'png',
              captureBeyondViewport: fullPage,
              clip
            }, sessionId)
            
            return {
              success: true,
              data: {
                screenshot: `data:image/png;base64,${data}`,
                fullPage,
                selector
              }
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Screenshot failed'
            }
          }
        }
      },
      
      cdp_get_cookies: {
        name: 'cdp_get_cookies',
        description: 'Get browser cookies',
        async execute(args): Promise<ToolResult> {
          try {
            const { sessionId: argSessionId, urls } = args as CookieArgs
            const sessionId = await this.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const client = manager.getClient()
            
            await client.send('Network.enable', {}, sessionId)
            const { cookies } = await client.send('Network.getCookies', urls ? { urls } : {}, sessionId)
            
            return {
              success: true,
              data: cookies
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to get cookies'
            }
          }
        }
      },
      
      cdp_set_cookie: {
        name: 'cdp_set_cookie',
        description: 'Set a browser cookie',
        async execute(args): Promise<ToolResult> {
          try {
            const { 
              sessionId: argSessionId, 
              name, 
              value,
              domain,
              path,
              secure,
              httpOnly,
              sameSite
            } = args as SetCookieArgs
            const sessionId = await this.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const client = manager.getClient()
            
            await client.send('Network.enable', {}, sessionId)
            
            const cookie: Record<string, unknown> = { name, value }
            if (domain !== undefined) cookie.domain = domain
            if (path !== undefined) cookie.path = path
            if (secure !== undefined) cookie.secure = secure
            if (httpOnly !== undefined) cookie.httpOnly = httpOnly
            if (sameSite !== undefined) cookie.sameSite = sameSite
            
            const result = await client.send('Network.setCookie', cookie, sessionId)
            
            return {
              success: result.success || false,
              data: result
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to set cookie'
            }
          }
        }
      },
      
      cdp_clear_cookies: {
        name: 'cdp_clear_cookies',
        description: 'Clear browser cookies',
        async execute(args): Promise<ToolResult> {
          try {
            const { sessionId: argSessionId } = args as BaseToolArgs
            const sessionId = await this.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const client = manager.getClient()
            
            await client.send('Network.enable', {}, sessionId)
            await client.send('Network.clearBrowserCookies', {}, sessionId)
            
            return {
              success: true,
              data: { message: 'Cookies cleared' }
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to clear cookies'
            }
          }
        }
      }
    }
    
    const handler = handlers[toolName]
    if (handler) {
      // Bind the execute method to this instance to preserve context
      return {
        ...handler,
        execute: handler.execute.bind(this)
      }
    }
    return undefined
  }
}