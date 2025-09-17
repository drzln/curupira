/**
 * Chrome Independent Tool Provider - Level 2 (MCP Core)
 * Base class for tool providers that don't require Chrome connection
 */

import type { SessionId } from '@curupira/shared/types';
import { Result } from '../../core/result.js';
import { BaseToolProvider, type BaseToolProviderConfig, type ExecutionContext, type ToolDefinition } from './base-tool-provider.js';
import type { IChromeService } from '../../core/interfaces/chrome-service.interface.js';
import type { ILogger } from '../../core/interfaces/logger.interface.js';
import type { IValidator } from '../../core/interfaces/validator.interface.js';
import type { ToolHandler, ToolResult } from './registry.js';
import { ChromeConnectionError } from '../../core/errors/chrome.errors.js';

export abstract class ChromeIndependentToolProvider<TConfig extends BaseToolProviderConfig = BaseToolProviderConfig> 
  extends BaseToolProvider<TConfig> {
  
  constructor(
    chromeService: IChromeService,
    logger: ILogger,
    validator: IValidator,
    config: TConfig
  ) {
    super(chromeService, logger, validator, config);
  }

  /**
   * Override getHandler to bypass session creation for Chrome-independent tools
   */
  getHandler(toolName: string): ToolHandler | undefined {
    const definition = this.tools.get(toolName);
    if (!definition) {
      return undefined;
    }

    return {
      name: definition.name,
      description: definition.description,
      execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
        // Validate arguments
        const validationResult = this.validator.validateAndTransform(
          args,
          definition.argsSchema,
          `${this.name}.${toolName}`
        );

        if (validationResult.isErr()) {
          return {
            success: false,
            error: validationResult.unwrapErr().message
          };
        }

        // Create execution context without requiring Chrome session
        // Chrome-independent tools don't need a Chrome client
        const context: ExecutionContext = {
          sessionId: 'chrome-independent' as SessionId,
          chromeClient: null,
          logger: this.logger.child({ 
            tool: toolName,
            provider: this.name 
          })
        };

        // Execute the tool
        try {
          this.logger.debug({ tool: toolName, args: validationResult.unwrap() }, 'Executing Chrome-independent tool');
          const result = await definition.handler(validationResult.unwrap(), context);
          this.logger.debug({ tool: toolName, success: result.success }, 'Chrome-independent tool completed');
          return result;
        } catch (error) {
          this.logger.error(
            { 
              error: error instanceof Error ? {
                message: error.message,
                stack: error.stack,
                name: error.name
              } : error,
              tool: toolName, 
              provider: this.name 
            },
            'Chrome-independent tool execution failed'
          );

          return {
            success: false,
            error: error instanceof Error ? error.message : 'Tool execution failed'
          };
        }
      }
    };
  }

  /**
   * Override getOrCreateSession to not require Chrome connection
   * Tools that need Chrome will handle connection internally
   */
  protected async getOrCreateSession(
    sessionId?: string
  ): Promise<Result<{ sessionId: SessionId; client: any }, ChromeConnectionError>> {
    // Return a pending session without Chrome client
    // Individual tools will handle Chrome connection as needed
    const pendingSessionId = (sessionId || 'pending') as SessionId;

    return Result.ok({
      sessionId: pendingSessionId,
      client: null // No client required for Chrome-independent tools
    });
  }

  /**
   * Create execution context without Chrome client requirement
   */
  protected createIndependentContext(sessionId?: string): ExecutionContext {
    return {
      sessionId: (sessionId || 'pending') as SessionId,
      chromeClient: null,
      logger: this.logger
    };
  }
}