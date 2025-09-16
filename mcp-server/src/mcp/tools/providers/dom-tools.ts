/**
 * DOM Tool Provider - DOM manipulation and inspection tools
 * Level 2: MCP Core (depends on Level 0-1)
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { SessionId } from '@curupira/shared/types'
import { ChromeManager } from '../../../chrome/manager.js'
import { logger } from '../../../config/logger.js'
import type { ToolProvider, ToolHandler, ToolResult } from '../registry.js'
import type {
  DOMSelectorArgs,
  DOMNodeArgs,
  DOMAttributeArgs,
  DOMHtmlArgs
} from '../types.js'
import { BaseToolProvider } from './base.js'

export class DOMToolProvider extends BaseToolProvider implements ToolProvider {
  name = 'dom'
  
  listTools(): Tool[] {
    return [
      {
        name: 'dom_query_selector',
        description: 'Find DOM element by CSS selector',
        inputSchema: {
          type: 'object',
          properties: {
            selector: { type: 'string', description: 'CSS selector' },
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          },
          required: ['selector']
        }
      },
      {
        name: 'dom_query_selector_all',
        description: 'Find all DOM elements by CSS selector',
        inputSchema: {
          type: 'object',
          properties: {
            selector: { type: 'string', description: 'CSS selector' },
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          },
          required: ['selector']
        }
      },
      {
        name: 'dom_get_attributes',
        description: 'Get attributes of a DOM element',
        inputSchema: {
          type: 'object',
          properties: {
            nodeId: { type: 'number', description: 'DOM node ID' },
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          },
          required: ['nodeId']
        }
      },
      {
        name: 'dom_set_attribute',
        description: 'Set attribute on a DOM element',
        inputSchema: {
          type: 'object',
          properties: {
            nodeId: { type: 'number', description: 'DOM node ID' },
            name: { type: 'string', description: 'Attribute name' },
            value: { type: 'string', description: 'Attribute value' },
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          },
          required: ['nodeId', 'name', 'value']
        }
      },
      {
        name: 'dom_remove_attribute',
        description: 'Remove attribute from a DOM element',
        inputSchema: {
          type: 'object',
          properties: {
            nodeId: { type: 'number', description: 'DOM node ID' },
            name: { type: 'string', description: 'Attribute name' },
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          },
          required: ['nodeId', 'name']
        }
      },
      {
        name: 'dom_get_outer_html',
        description: 'Get outer HTML of a DOM element',
        inputSchema: {
          type: 'object',
          properties: {
            nodeId: { type: 'number', description: 'DOM node ID' },
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          },
          required: ['nodeId']
        }
      },
      {
        name: 'dom_set_outer_html',
        description: 'Set outer HTML of a DOM element',
        inputSchema: {
          type: 'object',
          properties: {
            nodeId: { type: 'number', description: 'DOM node ID' },
            outerHTML: { type: 'string', description: 'New outer HTML' },
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          },
          required: ['nodeId', 'outerHTML']
        }
      },
      {
        name: 'dom_click_element',
        description: 'Click on a DOM element',
        inputSchema: {
          type: 'object',
          properties: {
            nodeId: { type: 'number', description: 'DOM node ID' },
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          },
          required: ['nodeId']
        }
      },
      {
        name: 'dom_focus_element',
        description: 'Focus on a DOM element',
        inputSchema: {
          type: 'object',
          properties: {
            nodeId: { type: 'number', description: 'DOM node ID' },
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          },
          required: ['nodeId']
        }
      },
      {
        name: 'dom_scroll_into_view',
        description: 'Scroll element into view',
        inputSchema: {
          type: 'object',
          properties: {
            nodeId: { type: 'number', description: 'DOM node ID' },
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          },
          required: ['nodeId']
        }
      }
    ]
  }
  
  getHandler(toolName: string): ToolHandler | undefined {
    const handlers: Record<string, ToolHandler> = {
      dom_query_selector: {
        name: 'dom_query_selector',
        description: 'Find DOM element by CSS selector',
        async execute(args): Promise<ToolResult> {
          try {
            const { selector, sessionId: argSessionId } = args as DOMSelectorArgs
            const sessionId = await this.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const client = manager.getClient()
            
            await client.send('DOM.enable', {}, sessionId)
            const { root } = await client.send('DOM.getDocument', {}, sessionId)
            const { nodeId } = await client.send('DOM.querySelector', {
              nodeId: root.nodeId,
              selector
            }, sessionId)
            
            if (!nodeId) {
              return {
                success: false,
                error: `No element found for selector: ${selector}`
              }
            }
            
            const { node } = await client.send('DOM.describeNode', { nodeId }, sessionId)
            
            return {
              success: true,
              data: { nodeId, node }
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Query failed'
            }
          }
        }
      },
      
      dom_query_selector_all: {
        name: 'dom_query_selector_all',
        description: 'Find all DOM elements by CSS selector',
        async execute(args): Promise<ToolResult> {
          try {
            const { selector, sessionId: argSessionId } = args as DOMSelectorArgs
            const sessionId = await this.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const client = manager.getClient()
            
            await client.send('DOM.enable', {}, sessionId)
            const { root } = await client.send('DOM.getDocument', {}, sessionId)
            const { nodeIds } = await client.send('DOM.querySelectorAll', {
              nodeId: root.nodeId,
              selector
            }, sessionId)
            
            const nodes = await Promise.all(
              nodeIds.map(async (nodeId) => {
                const { node } = await client.send('DOM.describeNode', { nodeId }, sessionId)
                return { nodeId, node }
              })
            )
            
            return {
              success: true,
              data: { count: nodes.length, nodes }
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Query failed'
            }
          }
        }
      },
      
      dom_get_attributes: {
        name: 'dom_get_attributes',
        description: 'Get attributes of a DOM element',
        async execute(args): Promise<ToolResult> {
          try {
            const { nodeId, sessionId: argSessionId } = args as DOMNodeArgs
            const sessionId = await this.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const client = manager.getClient()
            
            await client.send('DOM.enable', {}, sessionId)
            const { attributes } = await client.send('DOM.getAttributes', { nodeId }, sessionId)
            
            // Convert flat array to object
            const attrObj: Record<string, string> = {}
            for (let i = 0; i < attributes.length; i += 2) {
              attrObj[attributes[i]] = attributes[i + 1]
            }
            
            return {
              success: true,
              data: attrObj
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to get attributes'
            }
          }
        }
      },
      
      dom_set_attribute: {
        name: 'dom_set_attribute',
        description: 'Set attribute on a DOM element',
        async execute(args): Promise<ToolResult> {
          try {
            const { nodeId, name, value, sessionId: argSessionId } = args as DOMAttributeArgs
            const sessionId = await this.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const client = manager.getClient()
            
            await client.send('DOM.enable', {}, sessionId)
            await client.send('DOM.setAttributeValue', { nodeId, name, value }, sessionId)
            
            return {
              success: true,
              data: { nodeId, name, value }
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to set attribute'
            }
          }
        }
      },
      
      dom_remove_attribute: {
        name: 'dom_remove_attribute',
        description: 'Remove attribute from a DOM element',
        async execute(args): Promise<ToolResult> {
          try {
            const { nodeId, name, sessionId: argSessionId } = args as DOMAttributeArgs
            const sessionId = await this.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const client = manager.getClient()
            
            await client.send('DOM.enable', {}, sessionId)
            await client.send('DOM.removeAttribute', { nodeId, name }, sessionId)
            
            return {
              success: true,
              data: { nodeId, name }
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to remove attribute'
            }
          }
        }
      },
      
      dom_get_outer_html: {
        name: 'dom_get_outer_html',
        description: 'Get outer HTML of a DOM element',
        async execute(args): Promise<ToolResult> {
          try {
            const { nodeId, sessionId: argSessionId } = args as DOMNodeArgs
            const sessionId = await this.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const client = manager.getClient()
            
            await client.send('DOM.enable', {}, sessionId)
            const { outerHTML } = await client.send('DOM.getOuterHTML', { nodeId }, sessionId)
            
            return {
              success: true,
              data: { nodeId, outerHTML }
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to get outer HTML'
            }
          }
        }
      },
      
      dom_set_outer_html: {
        name: 'dom_set_outer_html',
        description: 'Set outer HTML of a DOM element',
        async execute(args): Promise<ToolResult> {
          try {
            const { nodeId, outerHTML, sessionId: argSessionId } = args as DOMHtmlArgs
            const sessionId = await this.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const client = manager.getClient()
            
            await client.send('DOM.enable', {}, sessionId)
            await client.send('DOM.setOuterHTML', { nodeId, outerHTML }, sessionId)
            
            return {
              success: true,
              data: { nodeId }
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to set outer HTML'
            }
          }
        }
      },
      
      dom_click_element: {
        name: 'dom_click_element',
        description: 'Click on a DOM element',
        async execute(args): Promise<ToolResult> {
          try {
            const { nodeId, sessionId: argSessionId } = args as DOMNodeArgs
            const sessionId = await this.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const client = manager.getClient()
            
            // Get element center coordinates
            await client.send('DOM.enable', {}, sessionId)
            const { model } = await client.send('DOM.getBoxModel', { nodeId }, sessionId)
            
            const x = (model.content[0] + model.content[2]) / 2
            const y = (model.content[1] + model.content[5]) / 2
            
            // Dispatch click
            await client.send('Input.dispatchMouseEvent', {
              type: 'mousePressed',
              x,
              y,
              button: 'left',
              clickCount: 1
            }, sessionId)
            
            await client.send('Input.dispatchMouseEvent', {
              type: 'mouseReleased',
              x,
              y,
              button: 'left',
              clickCount: 1
            }, sessionId)
            
            return {
              success: true,
              data: { nodeId, x, y }
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to click element'
            }
          }
        }
      },
      
      dom_focus_element: {
        name: 'dom_focus_element',
        description: 'Focus on a DOM element',
        async execute(args): Promise<ToolResult> {
          try {
            const { nodeId, sessionId: argSessionId } = args as DOMNodeArgs
            const sessionId = await this.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const client = manager.getClient()
            
            await client.send('DOM.enable', {}, sessionId)
            await client.send('DOM.focus', { nodeId }, sessionId)
            
            return {
              success: true,
              data: { nodeId }
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to focus element'
            }
          }
        }
      },
      
      dom_scroll_into_view: {
        name: 'dom_scroll_into_view',
        description: 'Scroll element into view',
        async execute(args): Promise<ToolResult> {
          try {
            const { nodeId, sessionId: argSessionId } = args as DOMNodeArgs
            const sessionId = await this.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const client = manager.getClient()
            
            await client.send('DOM.enable', {}, sessionId)
            await client.send('DOM.scrollIntoViewIfNeeded', { nodeId }, sessionId)
            
            return {
              success: true,
              data: { nodeId }
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to scroll element'
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