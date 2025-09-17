/**
 * Pino Logger Implementation - Level 2 (Infrastructure)
 * Concrete implementation of ILogger using Pino
 */

import pino, { Logger as PinoLogger } from 'pino';
import type { ILogger, LogContext } from '../../core/interfaces/logger.interface.js';

export class PinoLoggerAdapter implements ILogger {
  private pino: PinoLogger;

  constructor(options?: pino.LoggerOptions) {
    // In stdio mode, create a logger that writes to stderr to avoid polluting stdout
    if (process.env.CURUPIRA_STDIO_MODE === 'true' || process.env.CURUPIRA_TRANSPORT === 'stdio') {
      this.pino = pino({
        level: 'error', // Only log errors in stdio mode
        transport: {
          target: 'pino/file',
          options: { destination: 2 } // stderr
        }
      });
    } else {
      this.pino = pino({
        level: options?.level ?? 'info',
        transport: process.env.NODE_ENV !== 'production' 
          ? {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname'
              }
            }
          : undefined,
        ...options
      });
    }
  }

  debug(contextOrMessage: LogContext | string, message?: string): void {
    if (typeof contextOrMessage === 'string') {
      this.pino.debug(contextOrMessage);
    } else {
      this.pino.debug(contextOrMessage, message!);
    }
  }

  info(contextOrMessage: LogContext | string, message?: string): void {
    if (typeof contextOrMessage === 'string') {
      this.pino.info(contextOrMessage);
    } else {
      this.pino.info(contextOrMessage, message!);
    }
  }

  warn(contextOrMessage: LogContext | string, message?: string): void {
    if (typeof contextOrMessage === 'string') {
      this.pino.warn(contextOrMessage);
    } else {
      this.pino.warn(contextOrMessage, message!);
    }
  }

  error(contextOrMessage: LogContext | string, message?: string): void {
    if (typeof contextOrMessage === 'string') {
      this.pino.error(contextOrMessage);
    } else {
      this.pino.error(contextOrMessage, message!);
    }
  }

  child(context: LogContext): ILogger {
    return new PinoLoggerAdapter({
      base: context
    });
  }
}

/**
 * Logger provider for dependency injection
 */
export const loggerProvider = {
  provide: 'Logger',
  useFactory: () => {
    const level = process.env.LOG_LEVEL || 'info';
    return new PinoLoggerAdapter({ level });
  }
};