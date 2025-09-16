/**
 * Logger Interface - Level 0 (Foundation)
 * Defines the contract for logging services
 */

export interface LogContext {
  [key: string]: any;
}

export interface ILogger {
  /**
   * Log a debug message
   * @param context Additional context for the log
   * @param message The log message
   */
  debug(context: LogContext, message: string): void;
  debug(message: string): void;

  /**
   * Log an info message
   * @param context Additional context for the log
   * @param message The log message
   */
  info(context: LogContext, message: string): void;
  info(message: string): void;

  /**
   * Log a warning message
   * @param context Additional context for the log
   * @param message The log message
   */
  warn(context: LogContext, message: string): void;
  warn(message: string): void;

  /**
   * Log an error message
   * @param context Additional context for the log
   * @param message The log message
   */
  error(context: LogContext, message: string): void;
  error(message: string): void;

  /**
   * Create a child logger with additional context
   * @param context Additional context to include in all logs
   * @returns A new logger instance with the added context
   */
  child(context: LogContext): ILogger;
}