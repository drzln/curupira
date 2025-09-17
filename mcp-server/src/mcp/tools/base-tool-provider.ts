/**
 * Base Tool Provider - Level 2 (MCP Core)
 * Abstract base class for all tool providers with common patterns
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { ToolResult, ToolHandler, ToolProvider } from './registry.js';
import type { IChromeService } from '../../core/interfaces/chrome-service.interface.js';
import type { ILogger } from '../../core/interfaces/logger.interface.js';
import type { IValidator } from '../../core/interfaces/validator.interface.js';
import type { Schema } from '../../core/interfaces/validator.interface.js';
import type { SessionId } from '@curupira/shared/types';
import { Result } from '../../core/result.js';
import { ValidationError } from '../../core/errors/validation.error.js';
import { ChromeConnectionError } from '../../core/errors/chrome.errors.js';

export interface ToolDefinition {
  name: string;
  description: string;
  argsSchema: Schema<any>;
  jsonSchema?: any; // JSON Schema representation for MCP
  handler: (args: any, context: ExecutionContext) => Promise<ToolResult>;
}

export interface ExecutionContext {
  sessionId: SessionId;
  chromeClient: any; // Will be typed properly when we have the typed client
  logger: ILogger;
}

export interface BaseToolProviderConfig {
  name: string;
  description: string;
}

export abstract class BaseToolProvider<TConfig extends BaseToolProviderConfig = BaseToolProviderConfig> 
  implements ToolProvider {
  
  protected readonly tools = new Map<string, ToolDefinition>();
  
  constructor(
    protected readonly chromeService: IChromeService,
    protected readonly logger: ILogger,
    protected readonly validator: IValidator,
    protected readonly config: TConfig
  ) {
    this.initializeTools();
  }

  get name(): string {
    return this.config.name;
  }

  /**
   * Initialize tools - must be implemented by subclasses
   */
  protected abstract initializeTools(): void;

  /**
   * Register a tool definition
   */
  protected registerTool(definition: ToolDefinition): void {
    this.tools.set(definition.name, definition);
    this.logger.debug(
      { provider: this.name, tool: definition.name },
      'Tool registered'
    );
  }

  /**
   * List all tools provided by this provider
   */
  listTools(): Tool[] {
    return Array.from(this.tools.values()).map(def => {
      // Use provided jsonSchema if available
      if (def.jsonSchema) {
        return {
          name: def.name,
          description: def.description,
          inputSchema: def.jsonSchema
        };
      }
      
      // For chrome_connect, we need the proper schema
      if (def.name === 'chrome_connect') {
        return {
          name: def.name,
          description: def.description,
          inputSchema: {
            type: 'object',
            properties: {
              host: { type: 'string', description: 'Chrome host' },
              port: { type: 'number', description: 'Chrome debugging port', default: 9222 },
              secure: { type: 'boolean', description: 'Use secure connection', default: false }
            },
            required: ['host']
          }
        };
      }
      
      // For chrome_discover
      if (def.name === 'chrome_discover') {
        return {
          name: def.name,
          description: def.description,
          inputSchema: {
            type: 'object',
            properties: {
              hosts: { 
                type: 'array', 
                items: { type: 'string' },
                description: 'Hosts to scan for Chrome instances'
              },
              ports: { 
                type: 'array', 
                items: { type: 'number' },
                description: 'Ports to scan'
              },
              timeout: { 
                type: 'number',
                description: 'Discovery timeout in ms',
                default: 5000
              }
            },
            required: []
          }
        };
      }
      
      // Default for other tools - warn but continue (temporarily during migration)
      this.logger.warn({ tool: def.name }, 'No JSON schema defined for tool - using fallback');
      return {
        name: def.name,
        description: def.description,
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
          additionalProperties: true // Allow any properties
        }
      };
    });
  }

  /**
   * Get a handler for a specific tool
   */
  getHandler(toolName: string): ToolHandler | undefined {
    const definition = this.tools.get(toolName);
    if (!definition) {
      return undefined;
    }

    return {
      name: definition.name,
      description: definition.description,
      execute: async (args: Record<string, unknown>) => {
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

        // Get or create session
        const sessionResult = await this.getOrCreateSession(
          (args.sessionId as string) || undefined
        );

        if (sessionResult.isErr()) {
          return {
            success: false,
            error: sessionResult.unwrapErr().message
          };
        }

        // Create execution context
        const context: ExecutionContext = {
          sessionId: sessionResult.unwrap().sessionId,
          chromeClient: sessionResult.unwrap().client,
          logger: this.logger.child({ 
            tool: toolName,
            provider: this.name 
          })
        };

        // Execute the tool
        try {
          return await definition.handler(validationResult.unwrap(), context);
        } catch (error) {
          this.logger.error(
            { error, tool: toolName, provider: this.name },
            'Tool execution failed'
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
   * Get or create a Chrome session
   */
  protected async getOrCreateSession(
    sessionId?: string
  ): Promise<Result<{ sessionId: SessionId; client: any }, ChromeConnectionError>> {
    const client = this.chromeService.getCurrentClient();
    
    if (!client) {
      return Result.err(ChromeConnectionError.notConnected());
    }

    // For tools that need sessions, create one only when needed
    // For chrome_discover and other connection tools, don't create sessions
    if (sessionId) {
      // If a specific session is requested, try to use it
      return Result.ok({
        sessionId: sessionId as SessionId,
        client
      });
    }

    // If no sessionId provided, try to create a session for tools that need it
    try {
      this.logger.debug('Creating new Chrome CDP session for tool that requires it');
      const session = await client.createSession();
      return Result.ok({
        sessionId: session.sessionId as SessionId,
        client
      });
    } catch (error) {
      this.logger.error({ error }, 'Failed to create Chrome session');
      return Result.err(ChromeConnectionError.sessionCreationFailed(
        error instanceof Error ? error.message : 'Unknown session creation error'
      ));
    }
  }

  /**
   * Helper method to create a tool definition with automatic validation
   */
  protected createTool<TArgs>(
    name: string,
    description: string,
    argsSchema: Schema<TArgs>,
    handler: (args: TArgs, context: ExecutionContext) => Promise<ToolResult>,
    jsonSchema?: any
  ): ToolDefinition {
    return {
      name,
      description,
      argsSchema,
      jsonSchema,
      handler: handler as any
    };
  }
}