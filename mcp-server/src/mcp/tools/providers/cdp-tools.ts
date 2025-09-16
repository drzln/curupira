/**
 * CDP Tool Provider - Typed Implementation
 * Uses TypedCDPClient for full type safety
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
import { validateAndCast, ArgSchemas } from '../validation.js'
import type * as CDP from '@curupira/shared/cdp-types'

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
        description: 'Take a screenshot of the current page',
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
        name: 'cdp_set_cookie',
        description: 'Set a cookie',
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
        name: 'cdp_get_cookies',
        description: 'Get all cookies',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' },
            urls: { 
              type: 'array', 
              items: { type: 'string' },
              description: 'URLs to get cookies for (optional)' 
            }
          }
        }
      },
      {
        name: 'cdp_reload',
        description: 'Reload the current page',
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
    const provider = this
    const handlers: Record<string, ToolHandler> = {
      cdp_evaluate: {
        name: 'cdp_evaluate',
        description: 'Evaluate JavaScript expression in the browser',
        execute: async (args): Promise<ToolResult> => {
          try {
            const validArgs = validateAndCast<EvaluateArgs>(args, ArgSchemas.evaluate, 'cdp_evaluate')
            const { expression, sessionId: argSessionId } = validArgs
            const sessionId = await provider.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const typed = manager.getTypedClient()
            
            await typed.enableRuntime(sessionId)
            const result = await typed.evaluate(expression, {
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
            const validArgs = validateAndCast<NavigateArgs>(args, ArgSchemas.navigate, 'cdp_navigate')
            const { url, sessionId: argSessionId, waitUntil = 'load' } = validArgs
            const sessionId = await provider.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const typed = manager.getTypedClient()
            
            const result = await typed.navigate(url, {}, sessionId)
            
            if (result.errorText) {
              return {
                success: false,
                error: `Navigation failed: ${result.errorText}`
              }
            }
            
            // Wait for page load based on waitUntil
            if (waitUntil !== 'load') {
              logger.info(`Waiting for ${waitUntil} is not fully implemented yet`)
            }
            
            return {
              success: true,
              data: {
                frameId: result.frameId,
                loaderId: result.loaderId
              }
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
            const validArgs = validateAndCast<ScreenshotArgs>(args, ArgSchemas.screenshot, 'cdp_screenshot')
            const { sessionId: argSessionId, fullPage, selector } = validArgs
            const sessionId = await provider.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const typed = manager.getTypedClient()
            
            const params: CDP.Page.CaptureScreenshotParams = {}
            if (fullPage !== undefined) {
              params.captureBeyondViewport = fullPage
            }
            
            if (selector) {
              // Enable DOM to query selector
              await typed.enableDOM(sessionId)
              const doc = await typed.getDocument({}, sessionId)
              const { nodeId } = await typed.querySelector(doc.root.nodeId, selector, sessionId)
              
              if (!nodeId) {
                return {
                  success: false,
                  error: `Element not found: ${selector}`
                }
              }
              
              const { model } = await typed.getBoxModel({ nodeId }, sessionId)
              params.clip = {
                x: model.content[0],
                y: model.content[1],
                width: model.content[2] - model.content[0],
                height: model.content[5] - model.content[1]
              }
            }
            
            const result = await typed.captureScreenshot(params, sessionId)
            
            return {
              success: true,
              data: result.data
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Screenshot failed'
            }
          }
        }
      },
      
      cdp_set_cookie: {
        name: 'cdp_set_cookie',
        description: 'Set a cookie',
        async execute(args): Promise<ToolResult> {
          try {
            const validArgs = validateAndCast<SetCookieArgs>(args, ArgSchemas.setCookie, 'cdp_set_cookie')
            const { sessionId: argSessionId, name, value, domain, path, secure, httpOnly, sameSite } = validArgs
            const sessionId = await provider.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const typed = manager.getTypedClient()
            
            await typed.enableNetwork({}, sessionId)
            
            const result = await typed.setCookie({
              name,
              value,
              domain,
              path: path || '/',
              secure: secure || false,
              httpOnly: httpOnly || false,
              sameSite: (sameSite as CDP.Network.CookieSameSite) || 'Lax'
            }, sessionId)
            
            return {
              success: result.success,
              data: { name, value }
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to set cookie'
            }
          }
        }
      },
      
      cdp_get_cookies: {
        name: 'cdp_get_cookies',
        description: 'Get cookies',
        async execute(args): Promise<ToolResult> {
          try {
            const validArgs = validateAndCast<CookieArgs>(args, ArgSchemas.getCookies, 'cdp_get_cookies')
            const { sessionId: argSessionId, urls } = validArgs
            const sessionId = await provider.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const typed = manager.getTypedClient()
            
            await typed.enableNetwork({}, sessionId)
            
            const result = await typed.getCookies({ urls }, sessionId)
            
            return {
              success: true,
              data: result.cookies
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to get cookies'
            }
          }
        }
      },
      
      cdp_reload: {
        name: 'cdp_reload',
        description: 'Reload page',
        async execute(args): Promise<ToolResult> {
          try {
            const validArgs = validateAndCast<BaseToolArgs>(args, ArgSchemas.baseToolArgs, 'cdp_reload')
            const { sessionId: argSessionId } = validArgs
            const sessionId = await provider.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const typed = manager.getTypedClient()
            
            await typed.reload({}, sessionId)
            
            return {
              success: true,
              data: { reloaded: true }
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to reload page'
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

// Compare results:
// - All `result.property` accesses are now type-safe
// - No more TS18046 errors (unknown types)
// - No more TS2339 errors (property does not exist)
// - Full IntelliSense support for CDP operations