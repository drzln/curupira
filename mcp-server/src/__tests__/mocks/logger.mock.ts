/**
 * Mock Logger - Test Infrastructure
 * Mock implementation of ILogger for testing
 */

import type { ILogger, LogContext } from '../../core/interfaces/logger.interface.js';

export class MockLogger implements ILogger {
  private logs: Array<{
    level: string;
    message: string;
    context?: LogContext;
    timestamp: Date;
  }> = [];

  debug(contextOrMessage: LogContext | string, message?: string): void {
    this.log('debug', contextOrMessage, message);
  }

  info(contextOrMessage: LogContext | string, message?: string): void {
    this.log('info', contextOrMessage, message);
  }

  warn(contextOrMessage: LogContext | string, message?: string): void {
    this.log('warn', contextOrMessage, message);
  }

  error(contextOrMessage: LogContext | string, message?: string): void {
    this.log('error', contextOrMessage, message);
  }

  child(context: LogContext): ILogger {
    const childLogger = new MockLogger();
    childLogger.logs = this.logs; // Share logs with parent
    return childLogger;
  }

  private log(
    level: string,
    contextOrMessage: LogContext | string,
    message?: string
  ): void {
    const entry = {
      level,
      message: typeof contextOrMessage === 'string' ? contextOrMessage : message!,
      context: typeof contextOrMessage === 'object' ? contextOrMessage : undefined,
      timestamp: new Date()
    };

    this.logs.push(entry);
  }

  // Test helper methods
  getLogs(level?: string): typeof this.logs {
    if (level) {
      return this.logs.filter(log => log.level === level);
    }
    return this.logs;
  }

  hasLog(level: string, message: string): boolean {
    return this.logs.some(log => log.level === level && log.message === message);
  }

  hasLogWithContext(level: string, context: Partial<LogContext>): boolean {
    return this.logs.some(log => {
      if (log.level !== level || !log.context) return false;
      
      return Object.entries(context).every(
        ([key, value]) => log.context![key] === value
      );
    });
  }

  getLastLog(): typeof this.logs[0] | undefined {
    return this.logs[this.logs.length - 1];
  }

  reset(): void {
    this.logs = [];
  }
}