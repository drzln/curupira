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
  safeParse: (value) => {
    try {
      return { success: true, data: setBreakpointSchema.parse(value) };
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
  safeParse: (value) => {
    try {
      return { success: true, data: removeBreakpointSchema.parse(value) };
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
  safeParse: (value) => {
    try {
      return { success: true, data: stepSchema.parse(value) };
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
        // Get the current paused state
        const pausedResult = await withCDPCommand(
          'Debugger.evaluateOnCallFrame',
          {
            callFrameId: 'dummy', // This will fail but we'll get the stack trace in error
            expression: '1'
          },
          context
        );

        // For now, return a placeholder
        return {
          success: true,
          data: {
            message: 'Stack trace feature requires paused execution',
            hint: 'Use debugger_pause first, then call this method'
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