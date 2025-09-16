/**
 * Common Tool Handler Patterns - Level 2 (MCP Core)
 * Reusable patterns to eliminate code duplication across providers
 */

import type { ToolResult } from '../registry.js';
import type { ExecutionContext } from '../base-tool-provider.js';
import type { ILogger } from '../../../core/interfaces/logger.interface.js';
import type { IValidator, Schema } from '../../../core/interfaces/validator.interface.js';
import { Result } from '../../../core/result.js';
import { ChromeConnectionError } from '../../../core/errors/chrome.errors.js';

export interface WithSessionOptions<TArgs> {
  name: string;
  validator: IValidator;
  argsSchema: Schema<TArgs>;
  handler: (args: TArgs, context: ExecutionContext) => Promise<ToolResult>;
}

/**
 * Common pattern for tools that need session and validation
 */
export async function withSessionAndValidation<TArgs>(
  args: Record<string, unknown>,
  options: WithSessionOptions<TArgs>
): Promise<ToolResult> {
  // Validate arguments
  const validationResult = options.validator.validateAndTransform(
    args,
    options.argsSchema,
    options.name
  );

  if (validationResult.isErr()) {
    return {
      success: false,
      error: validationResult.unwrapErr().message
    };
  }

  // This would be called within a provider context that has session management
  // For now, we'll make this a building block that providers can use
  return {
    success: false,
    error: 'Session management must be implemented by provider'
  };
}

/**
 * Common pattern for library presence checks
 */
export async function withLibraryCheck(
  libraryName: string,
  checkExpression: string,
  context: ExecutionContext
): Promise<Result<boolean, string>> {
  try {
    const client = context.chromeClient;
    const result = await client.send('Runtime.evaluate', {
      expression: checkExpression,
      returnByValue: true
    }, context.sessionId);

    if (result.exceptionDetails) {
      return Result.err(`Library check failed: ${result.exceptionDetails.text}`);
    }

    return Result.ok(result.result.value === true);
  } catch (error) {
    return Result.err(`Failed to check ${libraryName}: ${error}`);
  }
}

/**
 * Common pattern for CDP command execution with error handling
 */
export async function withCDPCommand<TParams, TResult>(
  method: string,
  params: TParams,
  context: ExecutionContext
): Promise<Result<TResult, string>> {
  try {
    const client = context.chromeClient;
    const result = await client.send(method, params, context.sessionId);
    return Result.ok(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    context.logger.error(
      { method, params, error: errorMessage },
      'CDP command failed'
    );
    return Result.err(`CDP command ${method} failed: ${errorMessage}`);
  }
}

/**
 * Common pattern for script execution with result formatting
 */
export async function withScriptExecution<TResult = any>(
  script: string,
  context: ExecutionContext,
  options: {
    awaitPromise?: boolean;
    returnByValue?: boolean;
    includeCommandLineAPI?: boolean;
  } = {}
): Promise<Result<TResult, string>> {
  const evaluateOptions = {
    expression: script,
    awaitPromise: options.awaitPromise ?? true,
    returnByValue: options.returnByValue ?? true,
    includeCommandLineAPI: options.includeCommandLineAPI ?? false
  };

  const result = await withCDPCommand<any, any>(
    'Runtime.evaluate',
    evaluateOptions,
    context
  );

  if (result.isErr()) {
    return Result.err(result.unwrapErr());
  }

  const evaluateResult = result.unwrap();

  if (evaluateResult.exceptionDetails) {
    return Result.err(
      `Script execution error: ${evaluateResult.exceptionDetails.text}`
    );
  }

  return Result.ok(evaluateResult.result.value);
}

/**
 * Common pattern for DOM operations
 */
export async function withDOMOperation<TResult>(
  operation: () => Promise<TResult>,
  context: ExecutionContext,
  domReadyCheck: boolean = true
): Promise<Result<TResult, string>> {
  // Enable DOM domain if needed
  if (domReadyCheck) {
    const enableResult = await withCDPCommand(
      'DOM.enable',
      {},
      context
    );

    if (enableResult.isErr()) {
      return Result.err(enableResult.unwrapErr());
    }
  }

  try {
    const result = await operation();
    return Result.ok(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return Result.err(`DOM operation failed: ${errorMessage}`);
  }
}

/**
 * Common pattern for retrying operations
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxAttempts?: number;
    delay?: number;
    shouldRetry?: (error: any) => boolean;
  } = {}
): Promise<Result<T, string>> {
  const maxAttempts = options.maxAttempts ?? 3;
  const delay = options.delay ?? 1000;
  const shouldRetry = options.shouldRetry ?? (() => true);

  let lastError: any;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await operation();
      return Result.ok(result);
    } catch (error) {
      lastError = error;

      if (attempt < maxAttempts && shouldRetry(error)) {
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      break;
    }
  }

  const errorMessage = lastError instanceof Error 
    ? lastError.message 
    : String(lastError);

  return Result.err(
    `Operation failed after ${maxAttempts} attempts: ${errorMessage}`
  );
}