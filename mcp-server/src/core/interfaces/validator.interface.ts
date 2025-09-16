/**
 * Validator Interface - Level 0 (Foundation)
 * Defines the contract for validation services
 */

import type { Result } from '../result.js';
import type { ValidationError } from '../errors/validation.error.js';

export type Schema<T> = {
  parse(value: unknown): T;
  safeParse(value: unknown): { success: true; data: T } | { success: false; error: any };
};

export interface IValidator {
  /**
   * Validate and transform input data
   * @param input The input data to validate
   * @param schema The validation schema
   * @param context Context for error messages
   * @returns A Result containing the validated data or a validation error
   */
  validateAndTransform<T>(
    input: unknown,
    schema: Schema<T>,
    context: string
  ): Result<T, ValidationError>;

  /**
   * Check if input matches schema without transforming
   * @param input The input data to check
   * @param schema The validation schema
   * @returns True if input matches schema, false otherwise
   */
  isValid<T>(input: unknown, schema: Schema<T>): boolean;
}