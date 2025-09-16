/**
 * Error Handler Service - Level 1 (Core Services)
 * Centralized error handling with logging
 */

import { BaseError } from './errors/base.error.js';
import { Result } from './result.js';
import type { ILogger } from './interfaces/logger.interface.js';

export class ErrorHandler {
  constructor(private readonly logger: ILogger) {}

  /**
   * Handle an async operation with error catching and logging
   * @param operation The async operation to execute
   * @param context Context for error logging
   * @returns A Result with the operation outcome
   */
  async handle<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<Result<T, BaseError>> {
    try {
      const result = await operation();
      return Result.ok(result);
    } catch (error) {
      this.logger.error({ error, context }, 'Operation failed');

      if (error instanceof BaseError) {
        return Result.err(error);
      }

      // Convert unknown errors to a generic internal error
      const message = error instanceof Error ? error.message : String(error);
      return Result.err(
        new InternalError('Unexpected error occurred', {
          originalError: message,
          context
        })
      );
    }
  }

  /**
   * Handle a sync operation with error catching and logging
   * @param operation The sync operation to execute
   * @param context Context for error logging
   * @returns A Result with the operation outcome
   */
  handleSync<T>(
    operation: () => T,
    context: string
  ): Result<T, BaseError> {
    try {
      const result = operation();
      return Result.ok(result);
    } catch (error) {
      this.logger.error({ error, context }, 'Operation failed');

      if (error instanceof BaseError) {
        return Result.err(error);
      }

      // Convert unknown errors to a generic internal error
      const message = error instanceof Error ? error.message : String(error);
      return Result.err(
        new InternalError('Unexpected error occurred', {
          originalError: message,
          context
        })
      );
    }
  }

  /**
   * Log an error without wrapping in Result
   * @param error The error to log
   * @param context Context for error logging
   */
  logError(error: unknown, context: string): void {
    if (error instanceof BaseError) {
      this.logger.error(
        {
          error: error.toJSON(),
          context
        },
        error.message
      );
    } else if (error instanceof Error) {
      this.logger.error(
        {
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack
          },
          context
        },
        error.message
      );
    } else {
      this.logger.error(
        {
          error: String(error),
          context
        },
        'Unknown error occurred'
      );
    }
  }
}

// Internal error class for unexpected errors
class InternalError extends BaseError {
  readonly code = 'INTERNAL_ERROR';
  readonly statusCode = 500;
}