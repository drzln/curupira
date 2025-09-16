/**
 * Console Tool Provider - Browser console manipulation tools
 * Level 2: MCP Core (depends on Level 0-1)
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { SessionId } from '@curupira/shared/types'
import { ChromeManager } from '../../../chrome/manager.js'
import { logger } from '../../../config/logger.js'
import type { ToolProvider, ToolHandler, ToolResult } from '../registry.js'
import type {
  BaseToolArgs,
  ConsoleExecuteArgs,
  ConsoleMessagesArgs
} from '../types.js'
import { BaseToolProvider } from './base.js'

export class ConsoleToolProvider extends BaseToolProvider implements ToolProvider {
  name = 'console'
  
  listTools(): Tool[] {
    return [
      {
        name: 'console_clear',
        description: 'Clear browser console',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          }
        }
      },
      {
        name: 'console_execute',
        description: 'Execute JavaScript in console context',
        inputSchema: {
          type: 'object',
          properties: {
            expression: { type: 'string', description: 'JavaScript expression to execute' },
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          },
          required: ['expression']
        }
      },
      {
        name: 'console_get_messages',
        description: 'Get recent console messages',
        inputSchema: {
          type: 'object',
          properties: {
            level: { 
              type: 'string',
              enum: ['verbose', 'info', 'warning', 'error', 'all'],
              description: 'Filter by log level (optional)'
            },
            limit: { 
              type: 'number', 
              description: 'Max messages to return (default: 100)' 
            },
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          }
        }
      },
      {
        name: 'console_enable_monitoring',
        description: 'Enable console message monitoring',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          }
        }
      },
      {
        name: 'console_disable_monitoring',
        description: 'Disable console message monitoring',
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
      console_clear: {
        name: 'console_clear',
        description: 'Clear browser console',
        async execute(args): Promise<ToolResult> {
          try {
            const { sessionId: argSessionId } = args as BaseToolArgs
            const sessionId = await this.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const client = manager.getClient()
            
            await client.send('Console.enable', {}, sessionId)
            await client.send('Console.clearMessages', {}, sessionId)
            
            // Also clear via Runtime
            await client.send('Runtime.evaluate', {
              expression: 'console.clear()',
              userGesture: true
            }, sessionId)
            
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
              error: error instanceof Error ? error.message : 'Failed to clear console'
            }
          }
        }
      },
      
      console_execute: {
        name: 'console_execute',
        description: 'Execute JavaScript in console',
        async execute(args): Promise<ToolResult> {
          try {
            const { expression, sessionId: argSessionId } = args as ConsoleExecuteArgs
            const sessionId = await this.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const client = manager.getClient()
            
            await client.send('Runtime.enable', {}, sessionId)
            const result = await client.send('Runtime.evaluate', {
              expression,
              includeCommandLineAPI: true,
              userGesture: true,
              awaitPromise: true,
              returnByValue: true,
              generatePreview: true
            }, sessionId)
            
            if (result.exceptionDetails) {
              return {
                success: false,
                error: `Execution error: ${result.exceptionDetails.text}`,
                data: {
                  exceptionDetails: result.exceptionDetails,
                  stackTrace: result.exceptionDetails.stackTrace
                }
              }
            }
            
            return {
              success: true,
              data: {
                result: result.result.value,
                type: result.result.type,
                className: result.result.className,
                preview: result.result.preview
              }
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to execute command'
            }
          }
        }
      },
      
      console_get_messages: {
        name: 'console_get_messages',
        description: 'Get recent console messages',
        async execute(args): Promise<ToolResult> {
          try {
            const { level = 'all', limit = 100, sessionId: argSessionId } = args as ConsoleMessagesArgs
            const sessionId = await this.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const client = manager.getClient()
            
            // Store messages
            const messages: Array<{
              level: string;
              text: string;
              source?: string;
              url?: string;
              line?: number;
              column?: number;
              timestamp?: number;
              args?: Array<{ type: string; value: unknown; preview?: unknown }>;
            }> = []
            
            // Enable console monitoring
            await client.send('Console.enable', {}, sessionId)
            
            // Set up message listener
            const messageHandler = (params: { message: {
              level: string;
              text: string;
              source?: string;
              url?: string;
              line?: number;
              column?: number;
              timestamp?: number;
              args?: Array<{ type: string; value: unknown; preview?: unknown }>;
            } }) => {
              if (level === 'all' || params.message.level === level) {
                messages.push({
                  level: params.message.level,
                  text: params.message.text,
                  source: params.message.source,
                  url: params.message.url,
                  line: params.message.line,
                  column: params.message.column,
                  timestamp: params.message.timestamp,
                  args: params.message.args?.map((arg) => ({
                    type: arg.type,
                    value: arg.value,
                    preview: arg.preview
                  }))
                })
              }
            }
            
            client.on('Console.messageAdded', messageHandler)
            
            // Also get recent logs from the page
            await client.send('Runtime.enable', {}, sessionId)
            const logs = await client.send('Runtime.evaluate', {
              expression: `
                (() => {
                  const logs = [];
                  const originalLog = console.log;
                  const originalWarn = console.warn;
                  const originalError = console.error;
                  const originalInfo = console.info;
                  
                  // Capture recent logs if they've been stored
                  if (window.__CURUPIRA_CONSOLE_LOGS__) {
                    return window.__CURUPIRA_CONSOLE_LOGS__
                      .filter(log => '${level}' === 'all' || log.level === '${level}')
                      .slice(-${limit});
                  }
                  
                  // Install console interceptors for future logs
                  window.__CURUPIRA_CONSOLE_LOGS__ = [];
                  
                  const captureLog = (level, args) => {
                    const log = {
                      level,
                      text: args.map(arg => {
                        try {
                          return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
                        } catch (e) {
                          return String(arg);
                        }
                      }).join(' '),
                      timestamp: Date.now(),
                      args: args.map(arg => ({
                        type: typeof arg,
                        value: arg
                      }))
                    };
                    
                    window.__CURUPIRA_CONSOLE_LOGS__.push(log);
                    
                    // Keep only last 1000 logs
                    if (window.__CURUPIRA_CONSOLE_LOGS__.length > 1000) {
                      window.__CURUPIRA_CONSOLE_LOGS__.shift();
                    }
                  };
                  
                  console.log = function(...args) {
                    captureLog('info', args);
                    originalLog.apply(console, args);
                  };
                  
                  console.warn = function(...args) {
                    captureLog('warning', args);
                    originalWarn.apply(console, args);
                  };
                  
                  console.error = function(...args) {
                    captureLog('error', args);
                    originalError.apply(console, args);
                  };
                  
                  console.info = function(...args) {
                    captureLog('info', args);
                    originalInfo.apply(console, args);
                  };
                  
                  return [];
                })()
              `,
              returnByValue: true
            }, sessionId)
            
            // Combine CDP messages with captured logs
            const capturedLogs = (logs.result.value as Array<{
              level: string;
              text: string;
              timestamp: number;
              args?: Array<{ type: string; value: unknown }>;
            }>) || []
            const allMessages = [...capturedLogs, ...messages]
              .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
              .slice(-limit)
            
            // Clean up listener
            client.off('Console.messageAdded', messageHandler)
            
            return {
              success: true,
              data: {
                messages: allMessages,
                count: allMessages.length,
                level
              }
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to get console messages'
            }
          }
        }
      },
      
      console_enable_monitoring: {
        name: 'console_enable_monitoring',
        description: 'Enable console monitoring',
        async execute(args): Promise<ToolResult> {
          try {
            const { sessionId: argSessionId } = args as BaseToolArgs
            const sessionId = await this.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const client = manager.getClient()
            
            await client.send('Console.enable', {}, sessionId)
            await client.send('Runtime.enable', {}, sessionId)
            
            // Install console interceptors
            await client.send('Runtime.evaluate', {
              expression: `
                (() => {
                  if (window.__CURUPIRA_CONSOLE_MONITORING__) {
                    return 'Already monitoring';
                  }
                  
                  window.__CURUPIRA_CONSOLE_MONITORING__ = true;
                  window.__CURUPIRA_CONSOLE_LOGS__ = [];
                  
                  const methods = ['log', 'warn', 'error', 'info', 'debug'];
                  const originals = {};
                  
                  methods.forEach(method => {
                    originals[method] = console[method];
                    console[method] = function(...args) {
                      const log = {
                        level: method === 'log' ? 'info' : method,
                        text: args.map(arg => {
                          try {
                            return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
                          } catch (e) {
                            return String(arg);
                          }
                        }).join(' '),
                        timestamp: Date.now(),
                        stack: new Error().stack
                      };
                      
                      window.__CURUPIRA_CONSOLE_LOGS__.push(log);
                      
                      if (window.__CURUPIRA_CONSOLE_LOGS__.length > 1000) {
                        window.__CURUPIRA_CONSOLE_LOGS__.shift();
                      }
                      
                      originals[method].apply(console, args);
                    };
                  });
                  
                  window.__CURUPIRA_CONSOLE_ORIGINALS__ = originals;
                  
                  return 'Console monitoring enabled';
                })()
              `,
              returnByValue: true
            }, sessionId)
            
            return {
              success: true,
              data: {
                monitoring: true,
                timestamp: new Date().toISOString()
              }
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to enable monitoring'
            }
          }
        }
      },
      
      console_disable_monitoring: {
        name: 'console_disable_monitoring',
        description: 'Disable console monitoring',
        async execute(args): Promise<ToolResult> {
          try {
            const { sessionId: argSessionId } = args as BaseToolArgs
            const sessionId = await this.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const client = manager.getClient()
            
            // Restore original console methods
            await client.send('Runtime.evaluate', {
              expression: `
                (() => {
                  if (!window.__CURUPIRA_CONSOLE_MONITORING__) {
                    return 'Not monitoring';
                  }
                  
                  const originals = window.__CURUPIRA_CONSOLE_ORIGINALS__;
                  if (originals) {
                    Object.entries(originals).forEach(([method, original]) => {
                      console[method] = original;
                    });
                  }
                  
                  delete window.__CURUPIRA_CONSOLE_MONITORING__;
                  delete window.__CURUPIRA_CONSOLE_ORIGINALS__;
                  // Keep logs for retrieval
                  
                  return 'Console monitoring disabled';
                })()
              `,
              returnByValue: true
            }, sessionId)
            
            return {
              success: true,
              data: {
                monitoring: false,
                timestamp: new Date().toISOString()
              }
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to disable monitoring'
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
