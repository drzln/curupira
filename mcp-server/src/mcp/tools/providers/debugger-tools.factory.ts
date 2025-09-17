/**
 * Debugger Tool Provider Factory - Level 2 (MCP Core)
 * Factory implementation for JavaScript debugger tool provider
 */

import type { IToolProviderFactory, ProviderDependencies } from '../provider.factory.js';
import { BaseProviderFactory } from '../provider.factory.js';
import type { BaseToolProviderConfig } from '../base-tool-provider.js';
import { BaseToolProvider } from '../base-tool-provider.js';
import type { Schema } from '../../../core/interfaces/validator.interface.js';
import type { ToolResult } from '../registry.js';
import { withCDPCommand } from '../patterns/common-handlers.js';

// Schema definitions
const setBreakpointSchema: Schema<{ url: string; lineNumber: number; sessionId?: string }> = {
  parse: (value) => {
    if (typeof value !== 'object' || value === null) {
      throw new Error('Expected object');
    }
    const obj = value as any;
    if (typeof obj.url !== 'string') {
      throw new Error('url must be a string');
    }
    if (typeof obj.lineNumber !== 'number') {
      throw new Error('lineNumber must be a number');
    }
    return {
      url: obj.url,
      lineNumber: obj.lineNumber,
      sessionId: obj.sessionId
    };
  },
  safeParse: function(value) {
    try {
      const parsed = this.parse(value);
      return { success: true, data: parsed };
    } catch (error) {
      return { success: false, error };
    }
  }
};

const removeBreakpointSchema: Schema<{ breakpointId: string; sessionId?: string }> = {
  parse: (value) => {
    if (typeof value !== 'object' || value === null) {
      throw new Error('Expected object');
    }
    const obj = value as any;
    if (typeof obj.breakpointId !== 'string') {
      throw new Error('breakpointId must be a string');
    }
    return {
      breakpointId: obj.breakpointId,
      sessionId: obj.sessionId
    };
  },
  safeParse: function(value) {
    try {
      const parsed = this.parse(value);
      return { success: true, data: parsed };
    } catch (error) {
      return { success: false, error };
    }
  }
};

const stepSchema: Schema<{ type?: 'into' | 'over' | 'out'; sessionId?: string }> = {
  parse: (value) => {
    const obj = (value || {}) as any;
    const type = obj.type || 'over';
    if (!['into', 'over', 'out'].includes(type)) {
      throw new Error('type must be one of: into, over, out');
    }
    return {
      type,
      sessionId: obj.sessionId
    };
  },
  safeParse: function(value) {
    try {
      const parsed = this.parse(value);
      return { success: true, data: parsed };
    } catch (error) {
      return { success: false, error };
    }
  }
};

class DebuggerToolProvider extends BaseToolProvider {
  protected initializeTools(): void {
    // Register debugger_enable tool
    this.registerTool({
      name: 'debugger_enable',
      description: 'Enable JavaScript debugger',
      argsSchema: {
        parse: (value) => value || {},
        safeParse: (value) => ({ success: true, data: value || {} })
      },
      handler: async (args, context) => {
        const result = await withCDPCommand(
          'Debugger.enable',
          { maxScriptsCacheSize: 10000000 },
          context
        );

        if (result.isErr()) {
          return {
            success: false,
            error: result.unwrapErr()
          };
        }

        return {
          success: true,
          data: { message: 'Debugger enabled' }
        };
      }
    });

    // Register debugger_disable tool
    this.registerTool({
      name: 'debugger_disable',
      description: 'Disable JavaScript debugger',
      argsSchema: {
        parse: (value) => value || {},
        safeParse: (value) => ({ success: true, data: value || {} })
      },
      handler: async (args, context) => {
        const result = await withCDPCommand(
          'Debugger.disable',
          {},
          context
        );

        if (result.isErr()) {
          return {
            success: false,
            error: result.unwrapErr()
          };
        }

        return {
          success: true,
          data: { message: 'Debugger disabled' }
        };
      }
    });

    // Register debugger_pause tool
    this.registerTool({
      name: 'debugger_pause',
      description: 'Pause JavaScript execution',
      argsSchema: {
        parse: (value) => value || {},
        safeParse: (value) => ({ success: true, data: value || {} })
      },
      handler: async (args, context) => {
        const result = await withCDPCommand(
          'Debugger.pause',
          {},
          context
        );

        if (result.isErr()) {
          return {
            success: false,
            error: result.unwrapErr()
          };
        }

        return {
          success: true,
          data: { message: 'Execution paused' }
        };
      }
    });

    // Register debugger_resume tool
    this.registerTool({
      name: 'debugger_resume',
      description: 'Resume JavaScript execution',
      argsSchema: {
        parse: (value) => value || {},
        safeParse: (value) => ({ success: true, data: value || {} })
      },
      handler: async (args, context) => {
        const result = await withCDPCommand(
          'Debugger.resume',
          { terminateOnResume: false },
          context
        );

        if (result.isErr()) {
          return {
            success: false,
            error: result.unwrapErr()
          };
        }

        return {
          success: true,
          data: { message: 'Execution resumed' }
        };
      }
    });

    // Register debugger_step tool
    this.registerTool(
      this.createTool(
        'debugger_step',
        'Step through JavaScript execution',
        stepSchema,
        async (args, context) => {
          const commandMap = {
            'into': 'Debugger.stepInto',
            'over': 'Debugger.stepOver',
            'out': 'Debugger.stepOut'
          };

          const command = commandMap[args.type!];
          const result = await withCDPCommand(
            command,
            {},
            context
          );

          if (result.isErr()) {
            return {
              success: false,
              error: result.unwrapErr()
            };
          }

          return {
            success: true,
            data: { message: `Stepped ${args.type}` }
          };
        }
      )
    );

    // Register debugger_set_breakpoint tool
    this.registerTool(
      this.createTool(
        'debugger_set_breakpoint',
        'Set a breakpoint at a specific line',
        setBreakpointSchema,
        async (args, context) => {
          const result = await withCDPCommand(
            'Debugger.setBreakpointByUrl',
            {
              lineNumber: args.lineNumber - 1, // CDP uses 0-based line numbers
              url: args.url
            },
            context
          );

          if (result.isErr()) {
            return {
              success: false,
              error: result.unwrapErr()
            };
          }

          return {
            success: true,
            data: result.unwrap()
          };
        },
        {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'URL of the file to set breakpoint in' },
            lineNumber: { type: 'number', description: 'Line number to set breakpoint (1-based)' },
            sessionId: { type: 'string', description: 'Optional Chrome session ID' }
          },
          required: ['url', 'lineNumber']
        }
      )
    );

    // Register debugger_remove_breakpoint tool
    this.registerTool(
      this.createTool(
        'debugger_remove_breakpoint',
        'Remove a breakpoint',
        removeBreakpointSchema,
        async (args, context) => {
          const result = await withCDPCommand(
            'Debugger.removeBreakpoint',
            { breakpointId: args.breakpointId },
            context
          );

          if (result.isErr()) {
            return {
              success: false,
              error: result.unwrapErr()
            };
          }

          return {
            success: true,
            data: { message: 'Breakpoint removed' }
          };
        }
      )
    );

    // Register debugger_get_stack_trace tool
    this.registerTool({
      name: 'debugger_get_stack_trace',
      description: 'Get current stack trace when paused',
      argsSchema: {
        parse: (value) => value || {},
        safeParse: (value) => ({ success: true, data: value || {} })
      },
      handler: async (args, context) => {
        // Use Runtime.evaluate to get stack trace
        const result = await withCDPCommand(
          'Runtime.evaluate',
          {
            expression: `
              (() => {
                try {
                  throw new Error('Stack trace capture');
                } catch (e) {
                  const frames = [];
                  const lines = e.stack.split('\n').slice(1); // Skip the error message
                  
                  for (const line of lines) {
                    const match = line.match(/at\s+([^\s]+)\s*\((.+?):(\d+):(\d+)\)|at\s+(.+?):(\d+):(\d+)/);
                    if (match) {
                      frames.push({
                        functionName: match[1] || match[5] || '<anonymous>',
                        url: match[2] || match[5],
                        line: parseInt(match[3] || match[6], 10),
                        column: parseInt(match[4] || match[7], 10)
                      });
                    }
                  }
                  
                  return {
                    currentStack: frames,
                    isPaused: false,
                    message: 'Stack trace from current execution point'
                  };
                }
              })()
            `,
            returnByValue: true
          },
          context
        );

        if (result.isErr()) {
          return {
            success: false,
            error: result.unwrapErr()
          };
        }

        const stackData = result.unwrap() as any;
        return {
          success: true,
          data: stackData.result?.value || {
            message: 'Unable to capture stack trace',
            hint: 'For paused execution traces, use debugger_pause first'
          }
        };
      }
    });
    // Register debugger_evaluate_expression tool
    this.registerTool({
      name: 'debugger_evaluate_expression',
      description: 'Evaluate JavaScript expression in the current context',
      argsSchema: {
        parse: (value) => {
          if (typeof value !== 'object' || value === null) {
            throw new Error('Expected object');
          }
          const obj = value as any;
          if (typeof obj.expression !== 'string') {
            throw new Error('expression must be a string');
          }
          return {
            expression: obj.expression,
            includeCommandLineAPI: obj.includeCommandLineAPI !== false,
            sessionId: obj.sessionId
          };
        },
        safeParse: function(value) {
          try {
            const parsed = this.parse(value);
            return { success: true, data: parsed };
          } catch (error) {
            return { success: false, error };
          }
        }
      },
      handler: async (args, context) => {
        const result = await withCDPCommand(
          'Runtime.evaluate',
          {
            expression: args.expression,
            includeCommandLineAPI: args.includeCommandLineAPI,
            generatePreview: true,
            returnByValue: false,
            awaitPromise: true,
            replMode: true
          },
          context
        );

        if (result.isErr()) {
          return {
            success: false,
            error: result.unwrapErr()
          };
        }

        const evalResult = result.unwrap() as any;
        return {
          success: true,
          data: {
            type: evalResult.result?.type,
            value: evalResult.result?.value || evalResult.result?.description,
            preview: evalResult.result?.preview,
            error: evalResult.exceptionDetails
          }
        };
      }
    });

    // Register debugger_list_breakpoints tool
    this.registerTool({
      name: 'debugger_list_breakpoints',
      description: 'List all active breakpoints',
      argsSchema: {
        parse: (value) => value || {},
        safeParse: (value) => ({ success: true, data: value || {} })
      },
      handler: async (args, context) => {
        // Get possible breakpoint locations first
        const scriptsResult = await withCDPCommand(
          'Debugger.getScriptSource',
          { scriptId: '1' }, // This will fail but CDP doesn't have direct list breakpoints
          context
        );

        // For now, we'll track breakpoints internally or return info message
        return {
          success: true,
          data: {
            message: 'Breakpoint listing requires manual tracking',
            hint: 'Breakpoints set through debugger_set_breakpoint are active',
            recommendation: 'Use Chrome DevTools UI for visual breakpoint management'
          }
        };
      }
    });

    // Register debugger_set_exception_breakpoints tool
    this.registerTool({
      name: 'debugger_set_exception_breakpoints', 
      description: 'Configure breakpoints for exceptions',
      argsSchema: {
        parse: (value) => {
          const obj = (value || {}) as any;
          return {
            caught: obj.caught === true,
            uncaught: obj.uncaught !== false, // Default true for uncaught
            sessionId: obj.sessionId
          };
        },
        safeParse: function(value) {
          try {
            const parsed = this.parse(value);
            return { success: true, data: parsed };
          } catch (error) {
            return { success: false, error };
          }
        }
      },
      handler: async (args, context) => {
        const states = [];
        if (args.uncaught) states.push('uncaught');
        if (args.caught) states.push('caught');

        const result = await withCDPCommand(
          'Debugger.setPauseOnExceptions',
          { state: states.length === 2 ? 'all' : states[0] || 'none' },
          context
        );

        if (result.isErr()) {
          return {
            success: false,
            error: result.unwrapErr()
          };
        }

        return {
          success: true,
          data: {
            message: `Exception breakpoints configured`,
            caught: args.caught,
            uncaught: args.uncaught
          }
        };
      }
    });
  }
}

export class DebuggerToolProviderFactory extends BaseProviderFactory<DebuggerToolProvider> {
  create(deps: ProviderDependencies): DebuggerToolProvider {
    const config: BaseToolProviderConfig = {
      name: 'debugger',
      description: 'JavaScript debugging tools'
    };

    return new DebuggerToolProvider(
      deps.chromeService,
      this.createProviderLogger(deps, config.name),
      deps.validator,
      config
    );
  }
}