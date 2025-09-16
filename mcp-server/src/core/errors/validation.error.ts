/**
 * Validation Error - Level 0 (Foundation)
 * Error class for validation failures
 */

import { BaseError } from './base.error.js';

export class ValidationError extends BaseError {
  readonly code = 'VALIDATION_ERROR';
  readonly statusCode = 400;

  constructor(field: string, details: any) {
    super(`Validation failed for ${field}`, { field, details });
  }

  /**
   * Create a validation error for missing required field
   */
  static missingField(field: string): ValidationError {
    return new ValidationError(field, { type: 'missing', message: `${field} is required` });
  }

  /**
   * Create a validation error for invalid type
   */
  static invalidType(field: string, expected: string, actual: string): ValidationError {
    return new ValidationError(field, {
      type: 'invalid_type',
      message: `Expected ${expected} but got ${actual}`,
      expected,
      actual
    });
  }

  /**
   * Create a validation error for invalid format
   */
  static invalidFormat(field: string, format: string): ValidationError {
    return new ValidationError(field, {
      type: 'invalid_format',
      message: `Invalid ${format} format`,
      format
    });
  }

  /**
   * Create a validation error for invalid enum value
   */
  static invalidEnum(field: string, value: any, allowed: string[]): ValidationError {
    return new ValidationError(field, {
      type: 'invalid_enum',
      message: `Value must be one of: ${allowed.join(', ')}`,
      value,
      allowed
    });
  }
}