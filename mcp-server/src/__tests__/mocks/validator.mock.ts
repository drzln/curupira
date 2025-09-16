/**
 * Mock Validator - Test Infrastructure
 * Mock implementation of IValidator for testing
 */

import type { IValidator, Schema } from '../../core/interfaces/validator.interface.js';
import { Result } from '../../core/result.js';
import { ValidationError } from '../../core/errors/validation.error.js';

export class MockValidator implements IValidator {
  private validationResults = new Map<string, any>();
  private shouldFailValidation = false;

  validateAndTransform<T>(
    input: unknown,
    schema: Schema<T>,
    context: string
  ): Result<T, ValidationError> {
    // Check if we have a mock result for this context
    if (this.validationResults.has(context)) {
      return Result.ok(this.validationResults.get(context));
    }

    // Check if we should simulate validation failure
    if (this.shouldFailValidation) {
      return Result.err(
        new ValidationError(context, {
          type: 'mock_error',
          message: 'Mock validation failed'
        })
      );
    }

    // Try to use the actual schema if available
    try {
      const result = schema.safeParse(input);
      if (result.success) {
        return Result.ok(result.data);
      } else {
        return Result.err(
          new ValidationError(context, {
            type: 'validation_failed',
            details: result.error
          })
        );
      }
    } catch {
      // Fallback to simple pass-through
      return Result.ok(input as T);
    }
  }

  isValid<T>(input: unknown, schema: Schema<T>): boolean {
    if (this.shouldFailValidation) {
      return false;
    }

    try {
      const result = schema.safeParse(input);
      return result.success;
    } catch {
      return true; // Default to valid in mock
    }
  }

  // Test helper methods
  setMockResult(context: string, result: any): void {
    this.validationResults.set(context, result);
  }

  setFailValidation(shouldFail: boolean): void {
    this.shouldFailValidation = shouldFail;
  }

  reset(): void {
    this.validationResults.clear();
    this.shouldFailValidation = false;
  }
}