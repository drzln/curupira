/**
 * Common Handler Patterns - Phase 5: DRY Implementation
 * Level 2: MCP Core (reusable patterns)
 */

import type { SessionId } from '@curupira/shared/types'
import type { ToolHandler, ToolResult } from '../registry.js'
import type { BaseToolProvider } from '../providers/base.js'
import { validateAndCast, type JSONSchema } from '../validation.js'
import { ChromeManager } from '../../../chrome/manager.js'

/**
 * Common handler patterns to eliminate code duplication across providers
 */
export const HandlerPatterns = {
  /**
   * Standard session-aware handler with validation
   */
  withSessionAndValidation<TArgs extends { sessionId?: string }, TResult = unknown>(
    argSchema: JSONSchema,
    toolName: string,
    handler: (this: BaseToolProvider, args: TArgs, sessionId: SessionId) => Promise<ToolResult<TResult>>
  ): ToolHandler['execute'] {
    return async function(this: BaseToolProvider, args: Record<string, unknown>): Promise<ToolResult<TResult>> {
      try {
        const validArgs = validateAndCast<TArgs>(args, argSchema, toolName)
        const sessionId = await this.getSessionId(validArgs.sessionId)
        return await handler.call(this, validArgs, sessionId)
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Handler execution failed'
        }
      }
    }
  },

  /**
   * Library-dependent handler with availability check
   */
  withLibraryCheck<TArgs extends { sessionId?: string }, TResult = unknown>(
    argSchema: JSONSchema,
    toolName: string,
    libraryCheck: string,
    libraryName: string,
    handler: (this: BaseToolProvider, args: TArgs, sessionId: SessionId) => Promise<ToolResult<TResult>>
  ): ToolHandler['execute'] {
    return HandlerPatterns.withSessionAndValidation<TArgs, TResult>(
      argSchema, 
      toolName, 
      async function(args, sessionId) {
        const check = await this.checkLibraryAvailable(libraryCheck, sessionId, libraryName)
        if (!check.available) {
          return { 
            success: false, 
            error: check.error || `${libraryName} not available` 
          }
        }
        return await handler.call(this, args, sessionId)
      }
    )
  },

  /**
   * CDP command execution with type safety
   */
  withCDPCommand<TArgs extends { sessionId?: string }, TCommand = any, TResult = unknown>(
    argSchema: JSONSchema,
    toolName: string,
    command: string,
    commandBuilder: (args: TArgs) => TCommand,
    resultTransformer?: (result: any) => TResult
  ): ToolHandler['execute'] {
    return HandlerPatterns.withSessionAndValidation<TArgs, TResult>(
      argSchema, 
      toolName, 
      async function(args, sessionId) {
        const manager = ChromeManager.getInstance()
        const client = manager.getClient()
        
        const commandParams = commandBuilder(args)
        const result = await client.send(command, commandParams as unknown as Record<string, unknown>, sessionId)
        
        const transformedData = resultTransformer ? resultTransformer(result) : result as TResult
        return { success: true, data: transformedData }
      }
    )
  },

  /**
   * Script execution handler with result parsing
   */
  withScriptExecution<TArgs extends { sessionId?: string }, TResult = unknown>(
    argSchema: JSONSchema,
    toolName: string,
    scriptBuilder: (args: TArgs) => string,
    resultParser?: (result: any) => TResult
  ): ToolHandler['execute'] {
    return HandlerPatterns.withSessionAndValidation<TArgs, TResult>(
      argSchema,
      toolName,
      async function(args, sessionId) {
        const script = scriptBuilder(args)
        const result = await this.executeScript(script, sessionId)
        
        if (!result.success) {
          return result as ToolResult<TResult>
        }
        
        const parsedData = resultParser && result.data 
          ? resultParser(result.data) 
          : result.data as TResult
          
        return { 
          success: true, 
          data: parsedData,
          warnings: result.warnings 
        }
      }
    )
  },

  /**
   * DOM operation handler with automatic DOM enablement
   */
  withDOMOperation<TArgs extends { sessionId?: string }, TResult = unknown>(
    argSchema: JSONSchema,
    toolName: string,
    operation: (client: any, args: TArgs, sessionId: SessionId) => Promise<TResult>
  ): ToolHandler['execute'] {
    return HandlerPatterns.withSessionAndValidation<TArgs, TResult>(
      argSchema,
      toolName,
      async function(args, sessionId) {
        const manager = ChromeManager.getInstance()
        const client = manager.getClient()
        
        // Enable DOM domain
        await client.send('DOM.enable', {}, sessionId)
        
        const result = await operation(client, args, sessionId)
        return { success: true, data: result }
      }
    )
  },

  /**
   * Console operation handler with result formatting
   */
  withConsoleOperation<TArgs extends { sessionId?: string }, TResult = unknown>(
    argSchema: JSONSchema,
    toolName: string,
    operation: (client: any, args: TArgs, sessionId: SessionId) => Promise<any>,
    formatResult: (raw: any) => TResult
  ): ToolHandler['execute'] {
    return HandlerPatterns.withSessionAndValidation<TArgs, TResult>(
      argSchema,
      toolName,
      async function(args, sessionId) {
        const manager = ChromeManager.getInstance()
        const client = manager.getClient()
        
        // Enable necessary domains
        await client.send('Runtime.enable', {}, sessionId)
        await client.send('Console.enable', {}, sessionId)
        
        const raw = await operation(client, args, sessionId)
        const formatted = formatResult(raw)
        
        return { success: true, data: formatted }
      }
    )
  }
}

/**
 * Type-safe handler builder for creating tool handlers
 */
export class HandlerBuilder<TProvider extends BaseToolProvider> {
  constructor(private provider: TProvider) {}

  /**
   * Build a handler with validation
   */
  validated<TArgs extends { sessionId?: string }, TResult = unknown>(
    name: string,
    description: string,
    argSchema: JSONSchema,
    handler: (this: TProvider, args: TArgs, sessionId: SessionId) => Promise<ToolResult<TResult>>
  ): ToolHandler {
    return {
      name,
      description,
      execute: HandlerPatterns.withSessionAndValidation(argSchema, name, handler as (this: BaseToolProvider, args: TArgs, sessionId: SessionId) => Promise<ToolResult<TResult>>).bind(this.provider)
    }
  }

  /**
   * Build a CDP command handler
   */
  cdpCommand<TArgs extends { sessionId?: string }, TResult = unknown>(
    name: string,
    description: string,
    argSchema: JSONSchema,
    command: string,
    commandBuilder: (args: TArgs) => any,
    resultTransformer?: (result: any) => TResult
  ): ToolHandler {
    return {
      name,
      description,
      execute: HandlerPatterns.withCDPCommand(
        argSchema,
        name,
        command,
        commandBuilder,
        resultTransformer
      ).bind(this.provider)
    }
  }

  /**
   * Build a script execution handler
   */
  scriptExecution<TArgs extends { sessionId?: string }, TResult = unknown>(
    name: string,
    description: string,
    argSchema: JSONSchema,
    scriptBuilder: (args: TArgs) => string,
    resultParser?: (result: any) => TResult
  ): ToolHandler {
    return {
      name,
      description,
      execute: HandlerPatterns.withScriptExecution(
        argSchema,
        name,
        scriptBuilder,
        resultParser
      ).bind(this.provider)
    }
  }
}