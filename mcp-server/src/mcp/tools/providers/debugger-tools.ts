/**
 * Debugger Tool Provider - JavaScript debugging tools
 * Level 2: MCP Core (depends on Level 0-1)
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { SessionId } from '@curupira/shared/types'
import { ChromeManager } from '../../../chrome/manager.js'
import { logger } from '../../../config/logger.js'
import type { ToolProvider, ToolHandler, ToolResult } from '../registry.js'

export class DebuggerToolProvider implements ToolProvider {
  name = 'debugger'
  
  listTools(): Tool[] {
    return [
      {
        name: 'debugger_set_breakpoint',
        description: 'Set a breakpoint in JavaScript code',
        inputSchema: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'Script URL' },
            lineNumber: { type: 'number', description: 'Line number (0-based)' },
            columnNumber: { type: 'number', description: 'Column number (optional)' },
            condition: { type: 'string', description: 'Breakpoint condition (optional)' },
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          },
          required: ['url', 'lineNumber']
        }
      },
      {
        name: 'debugger_remove_breakpoint',
        description: 'Remove a breakpoint',
        inputSchema: {
          type: 'object',
          properties: {
            breakpointId: { type: 'string', description: 'Breakpoint ID to remove' },
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          },
          required: ['breakpointId']
        }
      },
      {
        name: 'debugger_pause',
        description: 'Pause JavaScript execution',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          }
        }
      },
      {
        name: 'debugger_resume',
        description: 'Resume JavaScript execution',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          }
        }
      },
      {
        name: 'debugger_step_over',
        description: 'Step over to next line',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          }
        }
      },
      {
        name: 'debugger_step_into',
        description: 'Step into function call',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          }
        }
      },
      {
        name: 'debugger_step_out',
        description: 'Step out of current function',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          }
        }
      },
      {
        name: 'debugger_get_call_stack',
        description: 'Get current call stack',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          }
        }
      },
      {
        name: 'debugger_evaluate_on_call_frame',
        description: 'Evaluate expression in paused context',
        inputSchema: {
          type: 'object',
          properties: {
            callFrameId: { type: 'string', description: 'Call frame ID' },
            expression: { type: 'string', description: 'Expression to evaluate' },
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          },
          required: ['callFrameId', 'expression']
        }
      },
      {
        name: 'debugger_get_scope_variables',
        description: 'Get variables in current scope',
        inputSchema: {
          type: 'object',
          properties: {
            callFrameId: { type: 'string', description: 'Call frame ID' },
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          },
          required: ['callFrameId']
        }
      }
    ]
  }
  
  getHandler(toolName: string): ToolHandler | undefined {
    const handlers: Record<string, ToolHandler> = {
      debugger_set_breakpoint: {
        name: 'debugger_set_breakpoint',
        description: 'Set a breakpoint',
        async execute(args): Promise<ToolResult> {
          try {
            const { url, lineNumber, columnNumber, condition, sessionId: argSessionId } = args as { 
              url: string;
              lineNumber: number;
              columnNumber?: number;
              condition?: string;
              sessionId?: string 
            }
            const sessionId = await this.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const client = manager.getClient()
            
            await client.send('Debugger.enable', {}, sessionId)
            
            const result = await client.send('Debugger.setBreakpointByUrl', {
              url,
              lineNumber,
              columnNumber,
              condition
            }, sessionId)
            
            return {
              success: true,
              data: {
                breakpointId: result.breakpointId,
                locations: result.locations,
                url,
                lineNumber
              }
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to set breakpoint'
            }
          }
        }
      },
      
      debugger_remove_breakpoint: {
        name: 'debugger_remove_breakpoint',
        description: 'Remove a breakpoint',
        async execute(args): Promise<ToolResult> {
          try {
            const { breakpointId, sessionId: argSessionId } = args as { 
              breakpointId: string;
              sessionId?: string 
            }
            const sessionId = await this.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const client = manager.getClient()
            
            await client.send('Debugger.removeBreakpoint', { breakpointId }, sessionId)
            
            return {
              success: true,
              data: {
                breakpointId,
                removed: true
              }
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to remove breakpoint'
            }
          }
        }
      },
      
      debugger_pause: {
        name: 'debugger_pause',
        description: 'Pause execution',
        async execute(args): Promise<ToolResult> {
          try {
            const { sessionId: argSessionId } = args as { sessionId?: string }
            const sessionId = await this.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const client = manager.getClient()
            
            await client.send('Debugger.enable', {}, sessionId)
            await client.send('Debugger.pause', {}, sessionId)
            
            return {
              success: true,
              data: {
                paused: true,
                timestamp: new Date().toISOString()
              }
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to pause execution'
            }
          }
        }
      },
      
      debugger_resume: {
        name: 'debugger_resume',
        description: 'Resume execution',
        async execute(args): Promise<ToolResult> {
          try {
            const { sessionId: argSessionId } = args as { sessionId?: string }
            const sessionId = await this.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const client = manager.getClient()
            
            await client.send('Debugger.resume', {}, sessionId)
            
            return {
              success: true,
              data: {
                resumed: true,
                timestamp: new Date().toISOString()
              }
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to resume execution'
            }
          }
        }
      },
      
      debugger_step_over: {
        name: 'debugger_step_over',
        description: 'Step over',
        async execute(args): Promise<ToolResult> {
          try {
            const { sessionId: argSessionId } = args as { sessionId?: string }
            const sessionId = await this.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const client = manager.getClient()
            
            await client.send('Debugger.stepOver', {}, sessionId)
            
            return {
              success: true,
              data: {
                stepped: 'over',
                timestamp: new Date().toISOString()
              }
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to step over'
            }
          }
        }
      },
      
      debugger_step_into: {
        name: 'debugger_step_into',
        description: 'Step into',
        async execute(args): Promise<ToolResult> {
          try {
            const { sessionId: argSessionId } = args as { sessionId?: string }
            const sessionId = await this.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const client = manager.getClient()
            
            await client.send('Debugger.stepInto', {}, sessionId)
            
            return {
              success: true,
              data: {
                stepped: 'into',
                timestamp: new Date().toISOString()
              }
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to step into'
            }
          }
        }
      },
      
      debugger_step_out: {
        name: 'debugger_step_out',
        description: 'Step out',
        async execute(args): Promise<ToolResult> {
          try {
            const { sessionId: argSessionId } = args as { sessionId?: string }
            const sessionId = await this.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const client = manager.getClient()
            
            await client.send('Debugger.stepOut', {}, sessionId)
            
            return {
              success: true,
              data: {
                stepped: 'out',
                timestamp: new Date().toISOString()
              }
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to step out'
            }
          }
        }
      },
      
      debugger_get_call_stack: {
        name: 'debugger_get_call_stack',
        description: 'Get call stack',
        async execute(args): Promise<ToolResult> {
          try {
            const { sessionId: argSessionId } = args as { sessionId?: string }
            const sessionId = await this.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const client = manager.getClient()
            
            // Store call frames from paused event
            let callFrames: any[] = []
            
            // Listen for pause event
            client.on('Debugger.paused', (params) => {
              callFrames = params.callFrames || []
            })
            
            // If not paused, pause first
            const isPaused = callFrames.length > 0
            if (!isPaused) {
              await client.send('Debugger.pause', {}, sessionId)
              // Wait a bit for pause event
              await new Promise(resolve => setTimeout(resolve, 100))
            }
            
            const stack = callFrames.map(frame => ({
              functionName: frame.functionName || 'anonymous',
              url: frame.url,
              lineNumber: frame.location.lineNumber,
              columnNumber: frame.location.columnNumber,
              callFrameId: frame.callFrameId,
              scopeChain: frame.scopeChain.map((scope: any) => ({
                type: scope.type,
                name: scope.name
              }))
            }))
            
            // Resume if we paused
            if (!isPaused && callFrames.length > 0) {
              await client.send('Debugger.resume', {}, sessionId)
            }
            
            return {
              success: true,
              data: {
                callStack: stack,
                depth: stack.length
              }
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to get call stack'
            }
          }
        }
      },
      
      debugger_evaluate_on_call_frame: {
        name: 'debugger_evaluate_on_call_frame',
        description: 'Evaluate in paused context',
        async execute(args): Promise<ToolResult> {
          try {
            const { callFrameId, expression, sessionId: argSessionId } = args as { 
              callFrameId: string;
              expression: string;
              sessionId?: string 
            }
            const sessionId = await this.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const client = manager.getClient()
            
            const result = await client.send('Debugger.evaluateOnCallFrame', {
              callFrameId,
              expression,
              returnByValue: true,
              generatePreview: true
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
              data: {
                result: result.result.value,
                type: result.result.type,
                className: result.result.className
              }
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to evaluate expression'
            }
          }
        }
      },
      
      debugger_get_scope_variables: {
        name: 'debugger_get_scope_variables',
        description: 'Get scope variables',
        async execute(args): Promise<ToolResult> {
          try {
            const { callFrameId, sessionId: argSessionId } = args as { 
              callFrameId: string;
              sessionId?: string 
            }
            const sessionId = await this.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const client = manager.getClient()
            
            // Store call frames from paused event
            let targetFrame: any = null
            
            client.on('Debugger.paused', (params) => {
              targetFrame = params.callFrames?.find((f: any) => f.callFrameId === callFrameId)
            })
            
            // If we don't have the frame, we need to be paused
            if (!targetFrame) {
              return {
                success: false,
                error: 'Call frame not found. Debugger must be paused at this frame.'
              }
            }
            
            // Get variables from each scope
            const scopes = await Promise.all(
              targetFrame.scopeChain.map(async (scope: any) => {
                const properties = await client.send('Runtime.getProperties', {
                  objectId: scope.object.objectId,
                  ownProperties: true,
                  generatePreview: true
                }, sessionId)
                
                return {
                  type: scope.type,
                  name: scope.name || scope.type,
                  variables: properties.result
                    .filter((prop: any) => !prop.symbol)
                    .map((prop: any) => ({
                      name: prop.name,
                      value: prop.value?.value || prop.value?.description,
                      type: prop.value?.type,
                      className: prop.value?.className
                    }))
                }
              })
            )
            
            return {
              success: true,
              data: {
                callFrameId,
                scopes
              }
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to get scope variables'
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
  
  private async getSessionId(argSessionId?: string): Promise<SessionId> {
    if (argSessionId) {
      return argSessionId as SessionId
    }
    
    const manager = ChromeManager.getInstance()
    const client = manager.getClient()
    const sessions = client.getSessions()
    
    if (sessions.length === 0) {
      throw new Error('No active Chrome session available')
    }
    
    return sessions[0].sessionId as SessionId
  }
}
