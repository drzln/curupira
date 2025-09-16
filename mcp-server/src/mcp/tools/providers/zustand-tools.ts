/**
 * Zustand Tool Provider - Tools for debugging Zustand state management
 * Level 2: MCP Core (depends on Level 0-1)
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { SessionId } from '@curupira/shared/types'
import { ChromeManager } from '../../../chrome/manager.js'
import { logger } from '../../../config/logger.js'
import type { ToolProvider, ToolHandler, ToolResult } from '../registry.js'
import type { ZustandStoreArgs, ZustandActionArgs } from '../types.js'
import { BaseToolProvider } from './base.js'

export class ZustandToolProvider extends BaseToolProvider implements ToolProvider {
  name = 'zustand'
  
  listTools(): Tool[] {
    return [
      {
        name: 'zustand_inspect_store',
        description: 'Inspect Zustand store state',
        inputSchema: {
          type: 'object',
          properties: {
            storeName: { type: 'string', description: 'Store name (optional)' },
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          }
        }
      },
      {
        name: 'zustand_dispatch_action',
        description: 'Dispatch action to Zustand store',
        inputSchema: {
          type: 'object',
          properties: {
            storeName: { type: 'string', description: 'Store name' },
            action: { type: 'string', description: 'Action name' },
            payload: { type: 'object', description: 'Action payload (optional)' },
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          },
          required: ['storeName', 'action']
        }
      },
      {
        name: 'zustand_list_stores',
        description: 'List all Zustand stores',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          }
        }
      },
      {
        name: 'zustand_subscribe_to_store',
        description: 'Subscribe to Zustand store changes',
        inputSchema: {
          type: 'object',
          properties: {
            storeName: { type: 'string', description: 'Store name' },
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          },
          required: ['storeName']
        }
      }
    ]
  }
  
  getHandler(toolName: string): ToolHandler | undefined {
    const handlers: Record<string, ToolHandler> = {
      zustand_inspect_store: {
        name: 'zustand_inspect_store',
        description: 'Inspect Zustand store state',
        async execute(args): Promise<ToolResult> {
          try {
            const { storeName, sessionId: argSessionId } = args as ZustandStoreArgs
            const sessionId = await this.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const client = manager.getClient()
            
            await client.send('Runtime.enable', {}, sessionId)
            
            const script = storeName ? `
              (() => {
                if (!window.__ZUSTAND_STORES__) {
                  return { error: 'Zustand stores not found. Make sure Zustand devtools is enabled.' }
                }
                
                const store = window.__ZUSTAND_STORES__.get('${storeName}')
                if (!store) {
                  return { 
                    error: 'Store not found', 
                    availableStores: Array.from(window.__ZUSTAND_STORES__.keys())
                  }
                }
                
                return {
                  storeName: '${storeName}',
                  state: store.getState(),
                  listeners: store.listeners ? store.listeners.size : 0
                }
              })()
            ` : `
              (() => {
                if (!window.__ZUSTAND_STORES__) {
                  return { error: 'Zustand stores not found. Make sure Zustand devtools is enabled.' }
                }
                
                const stores = {}
                window.__ZUSTAND_STORES__.forEach((store, name) => {
                  stores[name] = {
                    state: store.getState(),
                    listeners: store.listeners ? store.listeners.size : 0
                  }
                })
                
                return { stores }
              })()
            `
            
            const result = await client.send('Runtime.evaluate', {
              expression: script,
              returnByValue: true,
              awaitPromise: true
            }, sessionId)
            
            if (result.exceptionDetails) {
              return {
                success: false,
                error: `Error inspecting store: ${result.exceptionDetails.text}`
              }
            }
            
            const data = result.result.value as { error?: string; stores?: Record<string, unknown>; storeName?: string; state?: unknown }
            if (data.error) {
              return {
                success: false,
                error: data.error,
                data: data
              }
            }
            
            return {
              success: true,
              data
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to inspect store'
            }
          }
        }
      },
      
      zustand_dispatch_action: {
        name: 'zustand_dispatch_action',
        description: 'Dispatch action to Zustand store',
        async execute(args): Promise<ToolResult> {
          try {
            const { storeName, action, payload, sessionId: argSessionId } = args as ZustandActionArgs
            const sessionId = await this.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const client = manager.getClient()
            
            await client.send('Runtime.enable', {}, sessionId)
            
            const script = `
              (() => {
                if (!window.__ZUSTAND_STORES__) {
                  return { error: 'Zustand stores not found' }
                }
                
                const store = window.__ZUSTAND_STORES__.get('${storeName}')
                if (!store) {
                  return { 
                    error: 'Store not found', 
                    availableStores: Array.from(window.__ZUSTAND_STORES__.keys())
                  }
                }
                
                const previousState = store.getState()
                
                // Try to find and call the action
                const state = store.getState()
                if (typeof state['${action}'] === 'function') {
                  state['${action}'](${payload ? JSON.stringify(payload) : ''})
                } else {
                  // Try direct set for simple state updates
                  store.setState({ '${action}': ${JSON.stringify(payload)} })
                }
                
                const newState = store.getState()
                
                return {
                  success: true,
                  previousState,
                  newState,
                  changed: JSON.stringify(previousState) !== JSON.stringify(newState)
                }
              })()
            `
            
            const result = await client.send('Runtime.evaluate', {
              expression: script,
              returnByValue: true,
              awaitPromise: true
            }, sessionId)
            
            if (result.exceptionDetails) {
              return {
                success: false,
                error: `Error dispatching action: ${result.exceptionDetails.text}`
              }
            }
            
            const data = result.result.value as { error?: string; success?: boolean }
            if (data.error) {
              return {
                success: false,
                error: data.error,
                data
              }
            }
            
            return {
              success: true,
              data
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to dispatch action'
            }
          }
        }
      },
      
      zustand_list_stores: {
        name: 'zustand_list_stores',
        description: 'List all Zustand stores',
        async execute(args): Promise<ToolResult> {
          try {
            const { sessionId: argSessionId } = args as ZustandStoreArgs
            const sessionId = await this.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const client = manager.getClient()
            
            await client.send('Runtime.enable', {}, sessionId)
            
            const result = await client.send('Runtime.evaluate', {
              expression: `
                (() => {
                  if (!window.__ZUSTAND_STORES__) {
                    return { error: 'Zustand stores not found' }
                  }
                  
                  const stores = Array.from(window.__ZUSTAND_STORES__.keys())
                  return { stores }
                })()
              `,
              returnByValue: true
            }, sessionId)
            
            if (result.exceptionDetails) {
              return {
                success: false,
                error: `Error listing stores: ${result.exceptionDetails.text}`
              }
            }
            
            return {
              success: true,
              data: result.result.value
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to list stores'
            }
          }
        }
      },
      
      zustand_subscribe_to_store: {
        name: 'zustand_subscribe_to_store',
        description: 'Subscribe to Zustand store changes',
        async execute(args): Promise<ToolResult> {
          try {
            const { storeName, sessionId: argSessionId } = args as ZustandStoreArgs
            const sessionId = await this.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const client = manager.getClient()
            
            await client.send('Runtime.enable', {}, sessionId)
            await client.send('Console.enable', {}, sessionId)
            
            const script = `
              (() => {
                if (!window.__ZUSTAND_STORES__) {
                  return { error: 'Zustand stores not found' }
                }
                
                const store = window.__ZUSTAND_STORES__.get('${storeName}')
                if (!store) {
                  return { error: 'Store not found' }
                }
                
                // Remove any existing subscription
                if (window.__ZUSTAND_SUBSCRIPTION_${storeName}__) {
                  window.__ZUSTAND_SUBSCRIPTION_${storeName}__()
                }
                
                // Subscribe to store changes
                window.__ZUSTAND_SUBSCRIPTION_${storeName}__ = store.subscribe((state) => {
                  console.log('[Zustand Store Update]', '${storeName}', state)
                })
                
                return { 
                  success: true, 
                  message: 'Subscribed to store changes. Check console for updates.'
                }
              })()
            `
            
            const result = await client.send('Runtime.evaluate', {
              expression: script,
              returnByValue: true
            }, sessionId)
            
            if (result.exceptionDetails) {
              return {
                success: false,
                error: `Error subscribing: ${result.exceptionDetails.text}`
              }
            }
            
            const data = result.result.value as { error?: string; success?: boolean; message?: string }
            if (data.error) {
              return {
                success: false,
                error: data.error
              }
            }
            
            return {
              success: true,
              data
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to subscribe'
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