/**
 * DOM Tool Provider - Typed Implementation
 * Uses TypedCDPClient for full type safety
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
import { validateAndCast, ArgSchemas } from '../validation.js'
import type * as CDP from '@curupira/shared/cdp-types'

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
    const provider = this
    const handlers: Record<string, ToolHandler> = {
      dom_query_selector: {
        name: 'dom_query_selector',
        description: 'Find DOM element by CSS selector',
        async execute(args): Promise<ToolResult> {
          try {
            const validArgs = validateAndCast<DOMSelectorArgs>(args, ArgSchemas.domSelector, 'dom_query_selector')
            const { selector, sessionId: argSessionId } = validArgs
            const sessionId = await provider.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const typed = manager.getTypedClient()
            
            await typed.enableDOM(sessionId)
            const document = await typed.getDocument({}, sessionId)
            const result = await typed.querySelector(document.root.nodeId, selector, sessionId)
            
            if (!result.nodeId) {
              return {
                success: false,
                error: `No element found for selector: ${selector}`
              }
            }
            
            const nodeInfo = await typed.describeNode({ nodeId: result.nodeId }, sessionId)
            
            return {
              success: true,
              data: { 
                nodeId: result.nodeId, 
                node: nodeInfo.node 
              }
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
            const validArgs = validateAndCast<DOMSelectorArgs>(args, ArgSchemas.domSelector, 'dom_query_selector_all')
            const { selector, sessionId: argSessionId } = validArgs
            const sessionId = await provider.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const typed = manager.getTypedClient()
            
            await typed.enableDOM(sessionId)
            const document = await typed.getDocument({}, sessionId)
            const result = await typed.querySelectorAll(document.root.nodeId, selector, sessionId)
            
            const nodes = await Promise.all(
              result.nodeIds.map(async (nodeId) => {
                const nodeInfo = await typed.describeNode({ nodeId }, sessionId)
                return { nodeId, node: nodeInfo.node }
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
            const validArgs = validateAndCast<DOMNodeArgs>(args, ArgSchemas.domNodeArgs, 'dom_get_attributes')
            const { nodeId, sessionId: argSessionId } = validArgs
            const sessionId = await provider.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const typed = manager.getTypedClient()
            
            await typed.enableDOM(sessionId)
            const result = await typed.getAttributes(nodeId, sessionId)
            
            // Convert flat array to object
            const attrObj: Record<string, string> = {}
            for (let i = 0; i < result.attributes.length; i += 2) {
              attrObj[result.attributes[i]] = result.attributes[i + 1]
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
            const validArgs = validateAndCast<DOMAttributeArgs>(args, ArgSchemas.domAttributeArgs, 'dom_set_attribute')
            const { nodeId, name, value, sessionId: argSessionId } = validArgs
            const sessionId = await provider.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const typed = manager.getTypedClient()
            
            await typed.enableDOM(sessionId)
            await typed.setAttributeValue(nodeId, name, value, sessionId)
            
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
            const validArgs = validateAndCast<DOMAttributeArgs>(args, ArgSchemas.domAttributeArgs, 'dom_remove_attribute')
            const { nodeId, name, sessionId: argSessionId } = validArgs
            const sessionId = await provider.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const typed = manager.getTypedClient()
            
            await typed.enableDOM(sessionId)
            await typed.removeAttribute(nodeId, name, sessionId)
            
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
            const validArgs = validateAndCast<DOMNodeArgs>(args, ArgSchemas.domNodeArgs, 'dom_get_outer_html')
            const { nodeId, sessionId: argSessionId } = validArgs
            const sessionId = await provider.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const typed = manager.getTypedClient()
            
            await typed.enableDOM(sessionId)
            const result = await typed.getOuterHTML({ nodeId }, sessionId)
            
            return {
              success: true,
              data: { 
                nodeId, 
                outerHTML: result.outerHTML 
              }
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
            const validArgs = validateAndCast<DOMHtmlArgs>(args, ArgSchemas.domHtmlArgs, 'dom_set_outer_html')
            const { nodeId, outerHTML, sessionId: argSessionId } = validArgs
            const sessionId = await provider.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const typed = manager.getTypedClient()
            
            await typed.enableDOM(sessionId)
            await typed.setOuterHTML(nodeId, outerHTML, sessionId)
            
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
            const validArgs = validateAndCast<DOMNodeArgs>(args, ArgSchemas.domNodeArgs, 'dom_click_element')
            const { nodeId, sessionId: argSessionId } = validArgs
            const sessionId = await provider.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const typed = manager.getTypedClient()
            
            // Get element center coordinates
            await typed.enableDOM(sessionId)
            const boxModel = await typed.getBoxModel({ nodeId }, sessionId)
            
            const x = (boxModel.model.content[0] + boxModel.model.content[2]) / 2
            const y = (boxModel.model.content[1] + boxModel.model.content[5]) / 2
            
            // Dispatch click
            await typed.dispatchMouseEvent({
              type: 'mousePressed',
              x,
              y,
              button: 'left',
              clickCount: 1
            }, sessionId)
            
            await typed.dispatchMouseEvent({
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
            const validArgs = validateAndCast<DOMNodeArgs>(args, ArgSchemas.domNodeArgs, 'dom_focus_element')
            const { nodeId, sessionId: argSessionId } = validArgs
            const sessionId = await provider.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const typed = manager.getTypedClient()
            
            await typed.enableDOM(sessionId)
            await typed.focus({ nodeId }, sessionId)
            
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
            const validArgs = validateAndCast<DOMNodeArgs>(args, ArgSchemas.domNodeArgs, 'dom_scroll_into_view')
            const { nodeId, sessionId: argSessionId } = validArgs
            const sessionId = await provider.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const typed = manager.getTypedClient()
            
            await typed.enableDOM(sessionId)
            await typed.scrollIntoViewIfNeeded({ nodeId }, sessionId)
            
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
    if (!handler) return undefined
    
    return handler
  }
}

// Benefits of typed implementation:
// - All CDP responses have proper types
// - No more property access errors on unknown types
// - Full IntelliSense support
// - Compile-time safety for all DOM operations