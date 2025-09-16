/**
 * Base Error Class - Level 0 (Foundation)
 * Base class for all domain-specific errors
 */

export abstract class BaseError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;

  constructor(
    message: string,
    public readonly context?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert the error to a JSON-serializable object
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
      stack: this.stack
    };
  }

  /**
   * Create a string representation of the error
   */
  toString(): string {
    const contextStr = this.context 
      ? ` Context: ${JSON.stringify(this.context)}`
      : '';
    return `${this.name} [${this.code}]: ${this.message}${contextStr}`;
  }
}