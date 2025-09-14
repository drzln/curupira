/**
 * @fileoverview Temporary fixes for transport compilation issues
 * 
 * This file contains minimal fixes to get the transport layer compiling.
 * These will be properly refactored in subsequent tasks.
 */

import type { ValidationError } from '../errors/types.js'
import { CurupiraError, CurupiraErrorCode } from '../errors/index.js'

/**
 * Create invalidConfiguration error
 */
export function invalidConfiguration(message: string): CurupiraError {
  return new CurupiraError({
    code: CurupiraErrorCode.CONFIG_INVALID_FORMAT,
    category: 'configuration',
    severity: 'high',
    message,
    recoverable: false,
    retryable: false
  })
}

/**
 * Type guard for WebSocket config
 */
export function isWebSocketConfig(config: any): config is { type: 'websocket'; url: string } {
  return config && config.type === 'websocket' && typeof config.url === 'string'
}

/**
 * Type guard for HTTP config
 */
export function isHttpConfig(config: any): config is { type: 'http'; baseUrl: string } {
  return config && config.type === 'http' && typeof config.baseUrl === 'string'
}