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
import type { IConsoleBufferService, ConsoleMessage } from '../../../chrome/services/console-buffer.service.js';
import { withCDPCommand } from '../patterns/common-handlers.js';
import { consoleToolSchemas } from '../schemas/console-schemas.js';

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
  private consoleBufferService?: IConsoleBufferService;

  constructor(
    chromeService: any,
    logger: any,
    validator: any,
    config: BaseToolProviderConfig,
    consoleBufferService?: IConsoleBufferService
  ) {
    super(chromeService, logger, validator, config);
    this.consoleBufferService = consoleBufferService;
  }

  protected initializeTools(): void {
    // Register console_clear tool
    this.registerTool({
      name: 'console_clear',
      description: 'Clear browser console',
      argsSchema: {
        parse: (value) => value || {},
        safeParse: (value) => ({ success: true, data: value || {} })
      },
      jsonSchema: consoleToolSchemas.console_clear,
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
    this.registerTool({
      name: 'console_execute',
      description: 'Execute JavaScript in console context',
      argsSchema: executeSchema,
      jsonSchema: consoleToolSchemas.console_execute,
      handler: async (args, context) => {
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
    });

    // Register console_get_messages tool
    this.registerTool({
      name: 'console_get_messages',
      description: 'Get recent console messages',
      argsSchema: getMessagesSchema,
      jsonSchema: consoleToolSchemas.console_get_messages,
      handler: async (args, context) => {
          if (!this.consoleBufferService) {
            this.logger.warn('Console buffer service not available');
            return {
              success: true,
              data: {
                messages: [],
                totalCount: 0
              }
            };
          }

          // Get messages from buffer
          const messages = this.consoleBufferService.getMessages({
            sessionId: args.sessionId || context.sessionId,
            limit: args.limit || 100
          });

          // Format messages for output
          const formattedMessages = messages.map((msg: ConsoleMessage) => ({
            level: msg.level,
            text: msg.text,
            timestamp: new Date(msg.timestamp).toISOString(),
            source: msg.source,
            url: msg.url,
            line: msg.lineNumber,
            column: msg.columnNumber
          }));

          return {
            success: true,
            data: {
              messages: formattedMessages,
              totalCount: formattedMessages.length
            }
          };
        }
    });

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
      jsonSchema: consoleToolSchemas.console_monitor,
      handler: async (args, context) => {
        if (args.enabled) {
          // Enable console monitoring
          await withCDPCommand('Runtime.enable', {}, context);
          await withCDPCommand('Console.enable', {}, context);
          
          // Enable buffer service for this session
          if (this.consoleBufferService && context.sessionId) {
            this.consoleBufferService.enableSession(context.sessionId as any);
            this.logger.info({ sessionId: context.sessionId }, 'Console buffer enabled for session');
          }
          
          return {
            success: true,
            data: { message: 'Console monitoring enabled' }
          };
        } else {
          // Disable console monitoring
          await withCDPCommand('Console.disable', {}, context);
          
          // Disable buffer service for this session
          if (this.consoleBufferService && context.sessionId) {
            this.consoleBufferService.disableSession(context.sessionId as any);
            this.logger.info({ sessionId: context.sessionId }, 'Console buffer disabled for session');
          }
          
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
      config,
      deps.consoleBufferService
    );
  }
}