/**
 * Console Tool Provider Factory - Level 2 (MCP Core)
 * Factory implementation for Console tool provider
 */

import type { IToolProviderFactory, ProviderDependencies } from '../provider.factory.js';
import { BaseProviderFactory } from '../provider.factory.js';
import type { BaseToolProviderConfig } from '../base-tool-provider.js';
import { BaseToolProvider } from '../base-tool-provider.js';
import type { Schema } from '../../../core/interfaces/validator.interface.js';
import type { ToolResult } from '../registry.js';
import { withCDPCommand } from '../patterns/common-handlers.js';

// Schema definitions
const executeSchema: Schema<{ expression: string; sessionId?: string }> = {
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
      sessionId: obj.sessionId
    };
  },
  safeParse: (value) => {
    try {
      return { success: true, data: executeSchema.parse(value) };
    } catch (error) {
      return { success: false, error };
    }
  }
};

const getMessagesSchema: Schema<{ limit?: number; sessionId?: string }> = {
  parse: (value) => {
    const obj = (value || {}) as any;
    return {
      limit: typeof obj.limit === 'number' ? obj.limit : 100,
      sessionId: obj.sessionId
    };
  },
  safeParse: (value) => {
    try {
      return { success: true, data: getMessagesSchema.parse(value) };
    } catch (error) {
      return { success: false, error };
    }
  }
};

class ConsoleToolProvider extends BaseToolProvider {
  protected initializeTools(): void {
    // Register console_clear tool
    this.registerTool({
      name: 'console_clear',
      description: 'Clear browser console',
      argsSchema: {
        parse: (value) => value || {},
        safeParse: (value) => ({ success: true, data: value || {} })
      },
      handler: async (args, context) => {
        const result = await withCDPCommand(
          'Runtime.evaluate',
          { expression: 'console.clear()' },
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
          data: { message: 'Console cleared' }
        };
      }
    });

    // Register console_execute tool
    this.registerTool(
      this.createTool(
        'console_execute',
        'Execute JavaScript in console context',
        executeSchema,
        async (args, context) => {
          const result = await withCDPCommand(
            'Runtime.evaluate',
            {
              expression: args.expression,
              generatePreview: true,
              includeCommandLineAPI: true
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

    // Register console_get_messages tool
    this.registerTool(
      this.createTool(
        'console_get_messages',
        'Get recent console messages',
        getMessagesSchema,
        async (args, context) => {
          // Enable console API first
          await withCDPCommand('Runtime.enable', {}, context);
          await withCDPCommand('Console.enable', {}, context);

          // Get messages - this would need to be implemented with proper message collection
          // For now, return empty array
          return {
            success: true,
            data: {
              messages: [],
              totalCount: 0
            }
          };
        }
      )
    );

    // Register console_monitor tool
    this.registerTool({
      name: 'console_monitor',
      description: 'Monitor console output in real-time',
      argsSchema: {
        parse: (value) => {
          const obj = (value || {}) as any;
          return {
            enabled: obj.enabled !== false,
            sessionId: obj.sessionId
          };
        },
        safeParse: (value) => {
          try {
            return { 
              success: true, 
              data: {
                enabled: (value as any)?.enabled !== false,
                sessionId: (value as any)?.sessionId
              }
            };
          } catch (error) {
            return { success: false, error };
          }
        }
      },
      handler: async (args, context) => {
        if (args.enabled) {
          // Enable console monitoring
          await withCDPCommand('Console.enable', {}, context);
          return {
            success: true,
            data: { message: 'Console monitoring enabled' }
          };
        } else {
          // Disable console monitoring
          await withCDPCommand('Console.disable', {}, context);
          return {
            success: true,
            data: { message: 'Console monitoring disabled' }
          };
        }
      }
    });
  }
}

export class ConsoleToolProviderFactory extends BaseProviderFactory<ConsoleToolProvider> {
  create(deps: ProviderDependencies): ConsoleToolProvider {
    const config: BaseToolProviderConfig = {
      name: 'console',
      description: 'Browser console management tools'
    };

    return new ConsoleToolProvider(
      deps.chromeService,
      this.createProviderLogger(deps, config.name),
      deps.validator,
      config
    );
  }
}