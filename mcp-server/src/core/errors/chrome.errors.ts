/**
 * Chrome-related Errors - Level 0 (Foundation)
 * Error classes for Chrome DevTools Protocol operations
 */

import { BaseError } from './base.error.js';

export class ChromeConnectionError extends BaseError {
  readonly code = 'CHROME_CONNECTION_ERROR';
  readonly statusCode = 503;

  constructor(message: string, details?: Record<string, any>) {
    super(message, details);
  }

  static connectionRefused(host: string, port: number): ChromeConnectionError {
    return new ChromeConnectionError(
      `Failed to connect to Chrome at ${host}:${port}`,
      { host, port, type: 'connection_refused' }
    );
  }

  static connectionTimeout(host: string, port: number, timeout: number): ChromeConnectionError {
    return new ChromeConnectionError(
      `Connection to Chrome at ${host}:${port} timed out after ${timeout}ms`,
      { host, port, timeout, type: 'connection_timeout' }
    );
  }

  static notConnected(): ChromeConnectionError {
    return new ChromeConnectionError(
      'Not connected to Chrome',
      { type: 'not_connected' }
    );
  }

  static sessionCreationFailed(message: string): ChromeConnectionError {
    return new ChromeConnectionError(
      `Failed to create Chrome session: ${message}`,
      { type: 'session_creation_failed', message }
    );
  }
}

export class ChromeSessionError extends BaseError {
  readonly code = 'CHROME_SESSION_ERROR';
  readonly statusCode = 500;

  constructor(message: string, details?: Record<string, any>) {
    super(message, details);
  }

  static sessionNotFound(sessionId: string): ChromeSessionError {
    return new ChromeSessionError(
      `Session ${sessionId} not found`,
      { sessionId, type: 'session_not_found' }
    );
  }

  static sessionClosed(sessionId: string): ChromeSessionError {
    return new ChromeSessionError(
      `Session ${sessionId} is closed`,
      { sessionId, type: 'session_closed' }
    );
  }

  static invalidTarget(targetId: string): ChromeSessionError {
    return new ChromeSessionError(
      `Invalid target: ${targetId}`,
      { targetId, type: 'invalid_target' }
    );
  }
}

export class ChromeProtocolError extends BaseError {
  readonly code = 'CHROME_PROTOCOL_ERROR';
  readonly statusCode = 500;

  constructor(method: string, errorDetails: any) {
    const message = errorDetails.message || `Chrome protocol error in ${method}`;
    super(message, { method, errorDetails });
  }
}