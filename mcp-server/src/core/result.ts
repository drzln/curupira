/**
 * Result Type Pattern - Level 0 (Foundation)
 * Provides a type-safe way to handle success and error cases
 */

export class Result<T, E> {
  private constructor(
    private readonly value: T | null,
    private readonly error: E | null
  ) {}

  /**
   * Create a successful result
   * @param value The success value
   * @returns A successful Result
   */
  static ok<T, E>(value: T): Result<T, E> {
    return new Result<T, E>(value, null);
  }

  /**
   * Create an error result
   * @param error The error value
   * @returns An error Result
   */
  static err<T, E>(error: E): Result<T, E> {
    return new Result<T, E>(null, error);
  }

  /**
   * Check if the result is successful
   */
  isOk(): boolean {
    return this.value !== null && this.error === null;
  }

  /**
   * Check if the result is an error
   */
  isErr(): boolean {
    return this.error !== null && this.value === null;
  }

  /**
   * Get the success value, throwing if the result is an error
   * @throws Error if the result is an error
   */
  unwrap(): T {
    if (this.isErr()) {
      throw new Error('Called unwrap on an Err value');
    }
    return this.value!;
  }

  /**
   * Get the error value, throwing if the result is successful
   * @throws Error if the result is successful
   */
  unwrapErr(): E {
    if (this.isOk()) {
      throw new Error('Called unwrapErr on an Ok value');
    }
    return this.error!;
  }

  /**
   * Get the success value or a default
   * @param defaultValue The default value to return if the result is an error
   */
  unwrapOr(defaultValue: T): T {
    return this.isOk() ? this.value! : defaultValue;
  }

  /**
   * Map the success value to a new type
   * @param fn The mapping function
   * @returns A new Result with the mapped value
   */
  map<U>(fn: (value: T) => U): Result<U, E> {
    return this.isOk()
      ? Result.ok(fn(this.value!))
      : Result.err(this.error!);
  }

  /**
   * Map the error value to a new type
   * @param fn The mapping function
   * @returns A new Result with the mapped error
   */
  mapErr<F>(fn: (error: E) => F): Result<T, F> {
    return this.isErr()
      ? Result.err(fn(this.error!))
      : Result.ok(this.value!);
  }

  /**
   * Chain another Result-returning operation
   * @param fn The function that returns a Result
   * @returns The result of the chained operation
   */
  andThen<U>(fn: (value: T) => Result<U, E>): Result<U, E> {
    return this.isOk() ? fn(this.value!) : Result.err(this.error!);
  }

  /**
   * Execute a side effect if the result is successful
   * @param fn The side effect function
   * @returns The original Result for chaining
   */
  ifOk(fn: (value: T) => void): Result<T, E> {
    if (this.isOk()) {
      fn(this.value!);
    }
    return this;
  }

  /**
   * Execute a side effect if the result is an error
   * @param fn The side effect function
   * @returns The original Result for chaining
   */
  ifErr(fn: (error: E) => void): Result<T, E> {
    if (this.isErr()) {
      fn(this.error!);
    }
    return this;
  }

  /**
   * Match on the result, handling both success and error cases
   * @param handlers Object with ok and err handler functions
   * @returns The value returned by the appropriate handler
   */
  match<R>(handlers: { ok: (value: T) => R; err: (error: E) => R }): R {
    return this.isOk() ? handlers.ok(this.value!) : handlers.err(this.error!);
  }
}