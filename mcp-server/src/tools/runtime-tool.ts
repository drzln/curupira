/**
 * Runtime execution tool
 * 
 * Provides MCP tools for JavaScript execution and debugging
 */

import type { RuntimeDomain } from '../chrome/domains/runtime.js'
import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { logger } from '../config/logger.js'

// Tool parameter schemas
const evaluateSchema = z.object({
  expression: z.string().describe('JavaScript expression to evaluate'),
  awaitPromise: z.boolean().optional().describe('Wait for promise resolution (default: true)'),
  returnByValue: z.boolean().optional().describe('Return value by value (default: true)')
})

const callFunctionSchema = z.object({
  functionDeclaration: z.string().describe('Function declaration as string'),
  args: z.array(z.any()).optional().describe('Arguments to pass to function'),
  awaitPromise: z.boolean().optional().describe('Wait for promise resolution (default: true)')
})

const consoleLogSchema = z.object({
  level: z.enum(['log', 'info', 'warn', 'error']).describe('Console log level'),
  message: z.string().describe('Message to log'),
  args: z.array(z.any()).optional().describe('Additional arguments to log')
})

const setGlobalSchema = z.object({
  name: z.string().describe('Global variable name'),
  value: z.any().describe('Value to set')
})

const getGlobalSchema = z.object({
  name: z.string().describe('Global variable name to get')
})

const installConsoleInterceptSchema = z.object({
  levels: z.array(z.enum(['log', 'info', 'warn', 'error', 'debug'])).optional()
    .describe('Console levels to intercept (default: all)')
})

const performanceMarkSchema = z.object({
  name: z.string().describe('Performance mark name')
})

const performanceMeasureSchema = z.object({
  name: z.string().describe('Performance measure name'),
  startMark: z.string().describe('Start mark name'),
  endMark: z.string().optional().describe('End mark name (default: now)')
})

export class RuntimeTool {
  private readonly toolPrefix = 'runtime'

  constructor(private runtime: RuntimeDomain) {}

  /**
   * List available runtime tools
   */
  listTools(): Tool[] {
    return [
      {
        name: `${this.toolPrefix}/evaluate`,
        description: 'Evaluate JavaScript expression in page context',
        inputSchema: evaluateSchema as any
      },
      {
        name: `${this.toolPrefix}/callFunction`,
        description: 'Call a function with arguments',
        inputSchema: callFunctionSchema as any
      },
      {
        name: `${this.toolPrefix}/consoleLog`,
        description: 'Log message to browser console',
        inputSchema: consoleLogSchema as any
      },
      {
        name: `${this.toolPrefix}/setGlobal`,
        description: 'Set a global variable',
        inputSchema: setGlobalSchema as any
      },
      {
        name: `${this.toolPrefix}/getGlobal`,
        description: 'Get a global variable value',
        inputSchema: getGlobalSchema as any
      },
      {
        name: `${this.toolPrefix}/installConsoleIntercept`,
        description: 'Install console interceptor for capturing logs',
        inputSchema: installConsoleInterceptSchema as any
      },
      {
        name: `${this.toolPrefix}/performanceMark`,
        description: 'Create a performance mark',
        inputSchema: performanceMarkSchema as any
      },
      {
        name: `${this.toolPrefix}/performanceMeasure`,
        description: 'Measure performance between marks',
        inputSchema: performanceMeasureSchema as any
      }
    ]
  }

  /**
   * Call a tool
   */
  async callTool(name: string, args: unknown): Promise<any> {
    const toolName = name.replace(`${this.toolPrefix}/`, '')

    try {
      switch (toolName) {
        case 'evaluate':
          return this.evaluate(evaluateSchema.parse(args))
        
        case 'callFunction':
          return this.callFunction(callFunctionSchema.parse(args))
        
        case 'consoleLog':
          return this.consoleLog(consoleLogSchema.parse(args))
        
        case 'setGlobal':
          return this.setGlobal(setGlobalSchema.parse(args))
        
        case 'getGlobal':
          return this.getGlobal(getGlobalSchema.parse(args))
        
        case 'installConsoleIntercept':
          return this.installConsoleIntercept(installConsoleInterceptSchema.parse(args))
        
        case 'performanceMark':
          return this.performanceMark(performanceMarkSchema.parse(args))
        
        case 'performanceMeasure':
          return this.performanceMeasure(performanceMeasureSchema.parse(args))
        
        default:
          throw new Error(`Unknown tool: ${name}`)
      }
    } catch (error) {
      logger.error('Runtime tool execution failed', { name, args, error })
      throw error
    }
  }

  /**
   * Evaluate expression
   */
  private async evaluate(args: z.infer<typeof evaluateSchema>) {
    const result = await this.runtime.evaluate(
      args.expression,
      {
        awaitPromise: args.awaitPromise ?? true,
        returnByValue: args.returnByValue ?? true
      }
    )

    return {
      expression: args.expression,
      value: result.value,
      error: result.error,
      type: typeof result.value,
      executionTime: Date.now()
    }
  }

  /**
   * Call function
   */
  private async callFunction(args: z.infer<typeof callFunctionSchema>) {
    const wrappedExpression = `
      (async () => {
        const fn = ${args.functionDeclaration};
        const args = ${JSON.stringify(args.args || [])};
        return await fn(...args);
      })()
    `

    const result = await this.runtime.evaluate(
      wrappedExpression,
      {
        awaitPromise: args.awaitPromise ?? true,
        returnByValue: true
      }
    )

    return {
      functionDeclaration: args.functionDeclaration,
      args: args.args,
      value: result.value,
      error: result.error,
      type: typeof result.value
    }
  }

  /**
   * Console log
   */
  private async consoleLog(args: z.infer<typeof consoleLogSchema>) {
    const expression = `
      (() => {
        console.${args.level}(${JSON.stringify(args.message)}, ...${JSON.stringify(args.args || [])});
        return true;
      })()
    `

    await this.runtime.evaluate(expression)

    return {
      level: args.level,
      message: args.message,
      args: args.args,
      timestamp: Date.now()
    }
  }

  /**
   * Set global variable
   */
  private async setGlobal(args: z.infer<typeof setGlobalSchema>) {
    const expression = `
      (() => {
        window[${JSON.stringify(args.name)}] = ${JSON.stringify(args.value)};
        return true;
      })()
    `

    const result = await this.runtime.evaluate(expression)

    return {
      name: args.name,
      value: args.value,
      success: result.value === true
    }
  }

  /**
   * Get global variable
   */
  private async getGlobal(args: z.infer<typeof getGlobalSchema>) {
    const expression = `window[${JSON.stringify(args.name)}]`

    const result = await this.runtime.evaluate(expression, {
      returnByValue: true
    })

    return {
      name: args.name,
      value: result.value,
      exists: result.value !== undefined,
      type: typeof result.value
    }
  }

  /**
   * Install console interceptor
   */
  private async installConsoleIntercept(args: z.infer<typeof installConsoleInterceptSchema>) {
    const levels = args.levels || ['log', 'info', 'warn', 'error', 'debug']

    const expression = `
      (() => {
        if (window.__CURUPIRA_CONSOLE_INSTALLED__) {
          return { installed: false, reason: 'Already installed' };
        }

        window.__CURUPIRA_CONSOLE_LOGS__ = [];
        window.__CURUPIRA_CONSOLE_ORIGINAL__ = {};

        const levels = ${JSON.stringify(levels)};
        
        levels.forEach(level => {
          window.__CURUPIRA_CONSOLE_ORIGINAL__[level] = console[level];
          
          console[level] = function(...args) {
            // Store in our buffer
            window.__CURUPIRA_CONSOLE_LOGS__.push({
              level,
              args,
              timestamp: Date.now(),
              stack: new Error().stack
            });
            
            // Keep only last 1000 entries
            if (window.__CURUPIRA_CONSOLE_LOGS__.length > 1000) {
              window.__CURUPIRA_CONSOLE_LOGS__ = window.__CURUPIRA_CONSOLE_LOGS__.slice(-1000);
            }
            
            // Call original method
            window.__CURUPIRA_CONSOLE_ORIGINAL__[level].apply(console, args);
          };
        });

        window.__CURUPIRA_CONSOLE_INSTALLED__ = true;
        return { installed: true, levels };
      })()
    `

    const result = await this.runtime.evaluate(expression)

    return result.value || { installed: false, error: result.error }
  }

  /**
   * Performance mark
   */
  private async performanceMark(args: z.infer<typeof performanceMarkSchema>) {
    const expression = `
      (() => {
        performance.mark(${JSON.stringify(args.name)});
        return {
          name: ${JSON.stringify(args.name)},
          timestamp: performance.now()
        };
      })()
    `

    const result = await this.runtime.evaluate(expression)

    return result.value || { error: result.error }
  }

  /**
   * Performance measure
   */
  private async performanceMeasure(args: z.infer<typeof performanceMeasureSchema>) {
    const expression = `
      (() => {
        const measureName = ${JSON.stringify(args.name)};
        const startMark = ${JSON.stringify(args.startMark)};
        const endMark = ${args.endMark ? JSON.stringify(args.endMark) : 'undefined'};
        
        try {
          if (endMark) {
            performance.measure(measureName, startMark, endMark);
          } else {
            performance.measure(measureName, startMark);
          }
          
          const entries = performance.getEntriesByName(measureName, 'measure');
          const measure = entries[entries.length - 1];
          
          return {
            name: measureName,
            startMark,
            endMark,
            duration: measure.duration,
            startTime: measure.startTime
          };
        } catch (error) {
          return {
            error: error.message,
            availableMarks: performance.getEntriesByType('mark').map(m => m.name)
          };
        }
      })()
    `

    const result = await this.runtime.evaluate(expression)

    return result.value || { error: result.error }
  }

  /**
   * Get performance entries
   */
  async getPerformanceEntries(type?: string, name?: string) {
    const expression = `
      (() => {
        let entries;
        const type = ${JSON.stringify(type)};
        const name = ${JSON.stringify(name)};
        
        if (name) {
          entries = performance.getEntriesByName(name, type);
        } else if (type) {
          entries = performance.getEntriesByType(type);
        } else {
          entries = performance.getEntries();
        }
        
        return entries.slice(-100).map(entry => ({
          name: entry.name,
          entryType: entry.entryType,
          startTime: entry.startTime,
          duration: entry.duration,
          detail: entry.detail || undefined
        }));
      })()
    `

    const result = await this.runtime.evaluate(expression)

    return {
      entries: result.value || [],
      type,
      name
    }
  }

  /**
   * Install error handler
   */
  async installErrorHandler() {
    const expression = `
      (() => {
        if (window.__CURUPIRA_ERROR_HANDLER_INSTALLED__) {
          return { installed: false, reason: 'Already installed' };
        }

        window.__CURUPIRA_ERRORS__ = [];

        window.addEventListener('error', (event) => {
          window.__CURUPIRA_ERRORS__.push({
            type: 'error',
            message: event.message,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            error: event.error ? {
              name: event.error.name,
              message: event.error.message,
              stack: event.error.stack
            } : null,
            timestamp: Date.now()
          });
          
          // Keep only last 100 errors
          if (window.__CURUPIRA_ERRORS__.length > 100) {
            window.__CURUPIRA_ERRORS__ = window.__CURUPIRA_ERRORS__.slice(-100);
          }
        });

        window.addEventListener('unhandledrejection', (event) => {
          window.__CURUPIRA_ERRORS__.push({
            type: 'unhandledRejection',
            reason: event.reason,
            promise: 'Promise',
            timestamp: Date.now()
          });
          
          // Keep only last 100 errors
          if (window.__CURUPIRA_ERRORS__.length > 100) {
            window.__CURUPIRA_ERRORS__ = window.__CURUPIRA_ERRORS__.slice(-100);
          }
        });

        window.__CURUPIRA_ERROR_HANDLER_INSTALLED__ = true;
        return { installed: true };
      })()
    `

    const result = await this.runtime.evaluate(expression)

    return result.value || { installed: false, error: result.error }
  }
}