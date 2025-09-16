/**
 * Validator Service Implementation - Level 2 (Infrastructure)
 * Concrete implementation of IValidator
 */

import type { IValidator, Schema } from '../../core/interfaces/validator.interface.js';
import type { ILogger } from '../../core/interfaces/logger.interface.js';
import { Result } from '../../core/result.js';
import { ValidationError } from '../../core/errors/validation.error.js';

export class ValidatorService implements IValidator {
  constructor(private readonly logger: ILogger) {}

  validateAndTransform<T>(
    input: unknown,
    schema: Schema<T>,
    context: string
  ): Result<T, ValidationError> {
    try {
      const result = schema.safeParse(input);
      
      if (result.success) {
        return Result.ok(result.data);
      }

      // Extract error details from the schema's error
      const errorDetails = this.extractErrorDetails(result.error);
      
      this.logger.debug(
        { context, input, errorDetails },
        'Validation failed'
      );

      return Result.err(
        new ValidationError(context, errorDetails)
      );
    } catch (error) {
      // Fallback for schemas that don't implement safeParse
      try {
        const validated = schema.parse(input);
        return Result.ok(validated);
      } catch (parseError) {
        this.logger.debug(
          { context, input, error: parseError },
          'Validation failed with exception'
        );

        return Result.err(
          new ValidationError(context, {
            type: 'parse_error',
            message: parseError instanceof Error ? parseError.message : String(parseError)
          })
        );
      }
    }
  }

  isValid<T>(input: unknown, schema: Schema<T>): boolean {
    try {
      const result = schema.safeParse(input);
      return result.success;
    } catch {
      // Fallback for schemas that don't implement safeParse
      try {
        schema.parse(input);
        return true;
      } catch {
        return false;
      }
    }
  }

  private extractErrorDetails(error: any): any {
    // Handle Zod-style errors
    if (error && typeof error === 'object' && 'errors' in error) {
      return error.errors;
    }

    // Handle other error formats
    if (error && typeof error === 'object') {
      return {
        type: error.type || 'unknown',
        message: error.message || 'Validation failed',
        details: error
      };
    }

    return {
      type: 'unknown',
      message: String(error)
    };
  }
}

/**
 * Validator provider for dependency injection
 */
export const validatorProvider = {
  provide: 'Validator',
  useFactory: (logger: ILogger) => {
    return new ValidatorService(logger);
  },
  inject: ['Logger'] as const
};