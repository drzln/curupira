/**
 * Debugger Tool Provider - Typed Implementation
 * Uses TypedCDPClient for full type safety
 * Level 2: MCP Core (depends on Level 0-1)
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { SessionId } from '@curupira/shared/types'
import { ChromeManager } from '../../../chrome/manager.js'
import { logger } from '../../../config/logger.js'
import type { ToolProvider, ToolHandler, ToolResult } from '../registry.js'
import { BaseToolProvider } from './base.js'
import { validateAndCast, ArgSchemas } from '../validation.js'
import type * as CDP from '@curupira/shared/cdp-types'

export class DebuggerToolProvider extends BaseToolProvider implements ToolProvider {
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
      }
    ]
  }
  
  getHandler(toolName: string): ToolHandler | undefined {
    const provider = this
    const handlers: Record<string, ToolHandler> = {
      debugger_set_breakpoint: {
        name: 'debugger_set_breakpoint',
        description: 'Set a breakpoint',
        async execute(args): Promise<ToolResult> {
          try {
            const validArgs = validateAndCast<{
              url: string;
              lineNumber: number;
              columnNumber?: number;
              condition?: string;
              sessionId?: string 
            }>(args, ArgSchemas.setBreakpoint, 'debugger_set_breakpoint')
            const { url, lineNumber, columnNumber, condition, sessionId: argSessionId } = validArgs
            const sessionId = await provider.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const typed = manager.getTypedClient()
            
            await typed.enableDebugger({}, sessionId)
            
            const result = await typed.setBreakpointByUrl({
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
            const validArgs = validateAndCast<{ 
              breakpointId: string;
              sessionId?: string 
            }>(args, ArgSchemas.removeBreakpoint, 'debugger_remove_breakpoint')
            const { breakpointId, sessionId: argSessionId } = validArgs
            const sessionId = await provider.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const typed = manager.getTypedClient()
            
            await typed.removeBreakpoint(breakpointId as CDP.Debugger.BreakpointId, sessionId)
            
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
            const validArgs = validateAndCast<{ sessionId?: string }>(args, ArgSchemas.baseToolArgs, 'debugger_pause')
            const { sessionId: argSessionId } = validArgs
            const sessionId = await provider.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const typed = manager.getTypedClient()
            
            await typed.enableDebugger({}, sessionId)
            await typed.pause(sessionId)
            
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
            const validArgs = validateAndCast<{ sessionId?: string }>(args, ArgSchemas.baseToolArgs, 'debugger_resume')
            const { sessionId: argSessionId } = validArgs
            const sessionId = await provider.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const typed = manager.getTypedClient()
            
            await typed.resume({}, sessionId)
            
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
            const validArgs = validateAndCast<{ sessionId?: string }>(args, ArgSchemas.baseToolArgs, 'debugger_step_over')
            const { sessionId: argSessionId } = validArgs
            const sessionId = await provider.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const typed = manager.getTypedClient()
            
            await typed.stepOver({}, sessionId)
            
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
            const validArgs = validateAndCast<{ sessionId?: string }>(args, ArgSchemas.baseToolArgs, 'debugger_step_into')
            const { sessionId: argSessionId } = validArgs
            const sessionId = await provider.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const typed = manager.getTypedClient()
            
            await typed.stepInto({}, sessionId)
            
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
            const validArgs = validateAndCast<{ sessionId?: string }>(args, ArgSchemas.baseToolArgs, 'debugger_step_out')
            const { sessionId: argSessionId } = validArgs
            const sessionId = await provider.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const typed = manager.getTypedClient()
            
            await typed.stepOut(sessionId)
            
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
      
      debugger_evaluate_on_call_frame: {
        name: 'debugger_evaluate_on_call_frame',
        description: 'Evaluate in paused context',
        async execute(args): Promise<ToolResult> {
          try {
            const validArgs = validateAndCast<{
              callFrameId: string;
              expression: string;
              sessionId?: string
            }>(args, ArgSchemas.evaluateOnCallFrame, 'debugger_evaluate_on_call_frame')
            const { callFrameId, expression, sessionId: argSessionId } = validArgs
            const sessionId = await provider.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const typed = manager.getTypedClient()
            
            const result = await typed.evaluateOnCallFrame({
              callFrameId: callFrameId as CDP.Debugger.CallFrameId,
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
      }
    }
    
    const handler = handlers[toolName]
    if (!handler) return undefined
    
    return handler
  }
}

// Benefits of typed implementation:
// - All CDP debugger operations are type-safe
// - No more property access errors
// - Full IntelliSense for debugger protocol
// - Compile-time validation of breakpoint operations