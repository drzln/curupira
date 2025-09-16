/**
 * Redux Tool Provider - Tools for debugging Redux state management
 * Level 2: MCP Core (depends on Level 0-1)
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { ToolProvider, ToolHandler, ToolResult } from '../registry.js'
import type { ReduxPathArgs, ReduxActionArgs } from '../types.js'
import { BaseToolProvider } from './base.js'

export class ReduxToolProvider extends BaseToolProvider implements ToolProvider {
  name = 'redux'
  
  listTools(): Tool[] {
    return [
      {
        name: 'redux_inspect_state',
        description: 'Inspect Redux store state',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'State path to inspect (optional)' },
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          }
        }
      },
      {
        name: 'redux_dispatch_action',
        description: 'Dispatch action to Redux store',
        inputSchema: {
          type: 'object',
          properties: {
            type: { type: 'string', description: 'Action type' },
            payload: { type: 'object', description: 'Action payload (optional)' },
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          },
          required: ['type']
        }
      },
      {
        name: 'redux_get_actions',
        description: 'Get dispatched Redux actions',
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'Number of recent actions (default: 10)' },
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          }
        }
      },
      {
        name: 'redux_time_travel',
        description: 'Time travel to previous Redux state',
        inputSchema: {
          type: 'object',
          properties: {
            actionIndex: { type: 'number', description: 'Action index to travel to' },
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          },
          required: ['actionIndex']
        }
      }
    ]
  }
  
  getHandler(toolName: string): ToolHandler | undefined {
    const provider = this
    const handlers: Record<string, ToolHandler> = {
      redux_inspect_state: {
        name: 'redux_inspect_state',
        description: 'Inspect Redux store state',
        async execute(args): Promise<ToolResult> {
          try {
            const { path, sessionId: argSessionId } = args as ReduxPathArgs
            const sessionId = await provider.getSessionId(argSessionId)
            
            const script = `
              (() => {
                // Try multiple ways to find Redux store
                let store = null
                
                // Method 1: Redux DevTools
                if (window.__REDUX_DEVTOOLS_EXTENSION__) {
                  const devtools = window.__REDUX_DEVTOOLS_EXTENSION__.connect()
                  if (devtools && devtools.getState) {
                    const state = devtools.getState()
                    if (state) {
                      return {
                        state: ${path ? `state.${path}` : 'state'},
                        source: 'Redux DevTools'
                      }
                    }
                  }
                }
                
                // Method 2: Direct store reference
                if (window.store) {
                  store = window.store
                } else if (window.__store__) {
                  store = window.__store__
                } else if (window.__REDUX_STORE__) {
                  store = window.__REDUX_STORE__
                }
                
                if (!store || !store.getState) {
                  return { error: 'Redux store not found. Make sure Redux DevTools is enabled or store is exposed.' }
                }
                
                const state = store.getState()
                
                if (${JSON.stringify(path)}) {
                  // Navigate to specific path
                  const pathParts = ${JSON.stringify(path)}.split('.')
                  let value = state
                  
                  for (const part of pathParts) {
                    if (value && typeof value === 'object' && part in value) {
                      value = value[part]
                    } else {
                      return {
                        error: 'Path not found: ' + ${JSON.stringify(path)},
                        availableKeys: value && typeof value === 'object' ? Object.keys(value) : []
                      }
                    }
                  }
                  
                  return {
                    path: ${JSON.stringify(path)},
                    value,
                    type: typeof value
                  }
                }
                
                return {
                  state,
                  stateKeys: Object.keys(state),
                  source: 'Redux Store'
                }
              })()
            `
            
            const result = await provider.executeScript(script, sessionId)
            
            if (!result.success) {
              return result
            }
            
            const data = result.data as { error?: string }
            if (data?.error) {
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
              error: error instanceof Error ? error.message : 'Failed to inspect state'
            }
          }
        }
      },
      
      redux_dispatch_action: {
        name: 'redux_dispatch_action',
        description: 'Dispatch Redux action',
        async execute(args): Promise<ToolResult> {
          try {
            const { type, payload, sessionId: argSessionId } = args as ReduxActionArgs
            const sessionId = await provider.getSessionId(argSessionId)
            
            const script = `
              (() => {
                let store = null
                
                // Find Redux store
                if (window.store) {
                  store = window.store
                } else if (window.__store__) {
                  store = window.__store__
                } else if (window.__REDUX_STORE__) {
                  store = window.__REDUX_STORE__
                }
                
                if (!store || !store.dispatch) {
                  return { error: 'Redux store not found or dispatch not available' }
                }
                
                const previousState = store.getState()
                
                // Create action
                const action = {
                  type: ${JSON.stringify(type)},
                  ${payload ? `payload: ${JSON.stringify(payload)}` : ''}
                }
                
                // Dispatch action
                try {
                  store.dispatch(action)
                  
                  const newState = store.getState()
                  
                  return {
                    success: true,
                    action,
                    previousState,
                    newState,
                    stateChanged: JSON.stringify(previousState) !== JSON.stringify(newState)
                  }
                } catch (error) {
                  return {
                    error: 'Failed to dispatch action: ' + error.message,
                    action
                  }
                }
              })()
            `
            
            const result = await provider.executeScript(script, sessionId)
            
            if (!result.success) {
              return result
            }
            
            const data = result.data as { error?: string; success?: boolean }
            if (data?.error) {
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
      
      redux_get_actions: {
        name: 'redux_get_actions',
        description: 'Get Redux actions history',
        async execute(args): Promise<ToolResult> {
          try {
            const { limit = 10, sessionId: argSessionId } = args as { limit?: number; sessionId?: string }
            const sessionId = await provider.getSessionId(argSessionId)
            
            const script = `
              (() => {
                // Check Redux DevTools
                if (window.__REDUX_DEVTOOLS_EXTENSION__) {
                  const devtools = window.__REDUX_DEVTOOLS_EXTENSION__.connect()
                  if (devtools && devtools.subscribe) {
                    // Try to get action history from DevTools
                    // Note: This is limited by what DevTools exposes
                    return {
                      message: 'Action history available in Redux DevTools',
                      tip: 'Open Redux DevTools in Chrome to see full action history'
                    }
                  }
                }
                
                // If no DevTools, we can't get history without middleware
                return {
                  error: 'Action history not available. Redux DevTools required for action history.',
                  suggestion: 'Install Redux DevTools extension or add logging middleware to your store'
                }
              })()
            `
            
            const result = await provider.executeScript(script, sessionId)
            
            if (!result.success) {
              return result
            }
            
            return {
              success: true,
              data: result.data
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to get actions'
            }
          }
        }
      },
      
      redux_time_travel: {
        name: 'redux_time_travel',
        description: 'Time travel to previous state',
        async execute(args): Promise<ToolResult> {
          try {
            const { actionIndex, sessionId: argSessionId } = args as { actionIndex: number; sessionId?: string }
            const sessionId = await provider.getSessionId(argSessionId)
            
            const script = `
              (() => {
                // Time travel requires Redux DevTools
                if (!window.__REDUX_DEVTOOLS_EXTENSION__) {
                  return { error: 'Redux DevTools required for time travel functionality' }
                }
                
                const devtools = window.__REDUX_DEVTOOLS_EXTENSION__.connect()
                
                if (!devtools || !devtools.send) {
                  return { error: 'Redux DevTools not properly initialized' }
                }
                
                // Send jump to action command
                devtools.send(
                  { type: 'JUMP_TO_ACTION', index: ${actionIndex} },
                  devtools.getState()
                )
                
                return {
                  success: true,
                  message: 'Time travel command sent to Redux DevTools',
                  actionIndex: ${actionIndex}
                }
              })()
            `
            
            const result = await provider.executeScript(script, sessionId)
            
            if (!result.success) {
              return result
            }
            
            const data = result.data as { error?: string; success?: boolean }
            if (data?.error) {
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
              error: error instanceof Error ? error.message : 'Failed to time travel'
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