/**
 * @fileoverview Error factory functions
 * 
 * This file provides factory functions for creating specific
 * types of errors with appropriate defaults and context.
 */

import {
  CurupiraError,
  chainErrors
} from './base.js'
import { CurupiraErrorCode } from './types.js'
import type {
  CurupiraErrorInfo,
  ConfigurationError,
  NetworkError,
  ProtocolError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  BrowserError,
  ExtensionError,
  StateError,
  PerformanceError,
  InternalError,
  ErrorDetails,
  ErrorMetadata
} from './types.js'
import type {
  SessionId,
  RequestId,
  TabId,
  ComponentId,
  Timestamp
} from '../types/index.js'

/**
 * Common context for error creation
 */
interface ErrorContext {
  sessionId?: SessionId
  requestId?: RequestId
  tabId?: TabId
  componentId?: ComponentId
  userId?: string
  cause?: Error | CurupiraErrorInfo
}

/**
 * Configuration error factory
 */
export const ConfigurationErrors = {
  validationFailed: (
    message: string,
    details?: ErrorDetails,
    context?: ErrorContext
  ): CurupiraError => new CurupiraError({
    code: CurupiraErrorCode.CONFIG_VALIDATION_FAILED,
    category: 'configuration',
    severity: 'high',
    message,
    details,
    recoverable: false,
    retryable: false,
    metadata: createMetadata(context)
  }),

  missingRequired: (
    fieldName: string,
    context?: ErrorContext
  ): CurupiraError => new CurupiraError({
    code: CurupiraErrorCode.CONFIG_MISSING_REQUIRED,
    category: 'configuration',
    severity: 'high',
    message: `Required configuration field missing: ${fieldName}`,
    details: {
      technical: { fieldName },
      suggestions: [
        `Add the required field '${fieldName}' to your configuration`,
        'Check the documentation for required configuration fields'
      ]
    },
    recoverable: false,
    retryable: false,
    metadata: createMetadata(context)
  }),

  invalidFormat: (
    fieldName: string,
    expectedFormat: string,
    actualValue?: unknown,
    context?: ErrorContext
  ): CurupiraError => new CurupiraError({
    code: CurupiraErrorCode.CONFIG_INVALID_FORMAT,
    category: 'configuration',
    severity: 'medium',
    message: `Configuration field '${fieldName}' has invalid format`,
    details: {
      technical: { fieldName, expectedFormat, actualValue },
      suggestions: [
        `Ensure '${fieldName}' follows the format: ${expectedFormat}`,
        'Check the configuration documentation for valid formats'
      ]
    },
    recoverable: false,
    retryable: false,
    metadata: createMetadata(context)
  }),

  loadFailed: (
    source: string,
    reason: string,
    context?: ErrorContext
  ): CurupiraError => new CurupiraError({
    code: CurupiraErrorCode.CONFIG_LOAD_FAILED,
    category: 'configuration',
    severity: 'critical',
    message: `Failed to load configuration from ${source}: ${reason}`,
    details: {
      technical: { source, reason },
      suggestions: [
        'Check if the configuration file exists and is readable',
        'Verify the configuration file has valid syntax',
        'Ensure proper permissions to read the configuration file'
      ]
    },
    recoverable: false,
    retryable: true,
    retryDelay: 5000,
    metadata: createMetadata(context)
  })
}

/**
 * Network error factory
 */
export const NetworkErrors = {
  connectionFailed: (
    endpoint: string,
    reason?: string,
    context?: ErrorContext
  ): CurupiraError => new CurupiraError({
    code: CurupiraErrorCode.NETWORK_CONNECTION_FAILED,
    category: 'network',
    severity: 'medium',
    message: `Failed to connect to ${endpoint}${reason ? `: ${reason}` : ''}`,
    details: {
      technical: { endpoint, reason },
      suggestions: [
        'Check network connectivity',
        'Verify the endpoint URL is correct',
        'Check if the service is running'
      ]
    },
    recoverable: true,
    retryable: true,
    retryDelay: 1000,
    metadata: createMetadata(context)
  }),

  timeout: (
    endpoint: string,
    timeoutMs?: number,
    context?: ErrorContext
  ): CurupiraError => new CurupiraError({
    code: CurupiraErrorCode.NETWORK_TIMEOUT,
    category: 'network',
    severity: 'medium',
    message: `Request to ${endpoint} timed out${timeoutMs ? ` after ${timeoutMs}ms` : ''}`,
    details: {
      technical: { endpoint, timeoutMs },
      suggestions: [
        'Check network connectivity',
        'Consider increasing timeout value',
        'Verify the service is responding normally'
      ]
    },
    recoverable: true,
    retryable: true,
    retryDelay: 2000,
    metadata: createMetadata(context)
  }),

  rateLimited: (
    endpoint: string,
    retryAfter?: number,
    context?: ErrorContext
  ): CurupiraError => new CurupiraError({
    code: CurupiraErrorCode.NETWORK_RATE_LIMITED,
    category: 'network',
    severity: 'low',
    message: `Rate limited by ${endpoint}`,
    details: {
      technical: { endpoint, retryAfter },
      suggestions: [
        'Reduce request frequency',
        'Wait before retrying',
        'Consider implementing request batching'
      ]
    },
    recoverable: true,
    retryable: true,
    retryDelay: retryAfter ? retryAfter * 1000 : 60000,
    metadata: createMetadata(context)
  }),

  notConnected: (
    reason?: string,
    context?: ErrorContext
  ): CurupiraError => new CurupiraError({
    code: CurupiraErrorCode.NETWORK_NOT_CONNECTED,
    category: 'network',
    severity: 'medium',
    message: reason || 'Not connected to network',
    details: {
      suggestions: [
        'Ensure connection is established before sending',
        'Check connection state',
        'Handle connection events properly'
      ]
    },
    recoverable: true,
    retryable: true,
    retryDelay: 1000,
    metadata: createMetadata(context)
  }),

  sendFailed: (
    reason: string,
    context?: ErrorContext
  ): CurupiraError => new CurupiraError({
    code: CurupiraErrorCode.NETWORK_SEND_FAILED,
    category: 'network',
    severity: 'medium',
    message: reason,
    details: {
      suggestions: [
        'Check message format',
        'Verify connection is stable',
        'Consider retry logic'
      ]
    },
    recoverable: true,
    retryable: true,
    retryDelay: 1000,
    metadata: createMetadata(context)
  }),

  protocolError: (
    reason: string,
    context?: ErrorContext
  ): CurupiraError => new CurupiraError({
    code: CurupiraErrorCode.PROTOCOL_ERROR,
    category: 'protocol',
    severity: 'high',
    message: reason,
    details: {
      suggestions: [
        'Check protocol implementation',
        'Verify message format',
        'Review protocol documentation'
      ]
    },
    recoverable: false,
    retryable: false,
    metadata: createMetadata(context)
  }),

  payloadTooLarge: (
    message: string,
    context?: ErrorContext
  ): CurupiraError => new CurupiraError({
    code: CurupiraErrorCode.NETWORK_PAYLOAD_TOO_LARGE,
    category: 'network',
    severity: 'medium',
    message,
    details: {
      suggestions: [
        'Reduce payload size',
        'Consider chunking large messages',
        'Compress data before sending'
      ]
    },
    recoverable: true,
    retryable: false,
    metadata: createMetadata(context)
  }),

  requestFailed: (
    url: string,
    reason: string,
    context?: ErrorContext
  ): CurupiraError => new CurupiraError({
    code: CurupiraErrorCode.NETWORK_REQUEST_FAILED,
    category: 'network',
    severity: 'medium',
    message: `Request to ${url} failed: ${reason}`,
    details: {
      technical: { url, reason },
      suggestions: [
        'Check endpoint availability',
        'Verify request parameters',
        'Review error details'
      ]
    },
    recoverable: true,
    retryable: true,
    retryDelay: 2000,
    metadata: createMetadata(context)
  })
}

/**
 * Protocol error factory
 */
export const ProtocolErrors = {
  timeout: (
    message: string,
    context?: ErrorContext
  ): CurupiraError => new CurupiraError({
    code: CurupiraErrorCode.PROTOCOL_TIMEOUT,
    category: 'protocol',
    severity: 'medium',
    message,
    details: {
      suggestions: [
        'Increase timeout duration',
        'Check server responsiveness',
        'Verify network conditions'
      ]
    },
    recoverable: true,
    retryable: true,
    retryDelay: 2000,
    metadata: createMetadata(context)
  }),

  cancelled: (
    message: string,
    context?: ErrorContext
  ): CurupiraError => new CurupiraError({
    code: CurupiraErrorCode.PROTOCOL_CANCELLED,
    category: 'protocol',
    severity: 'low',
    message,
    details: {
      suggestions: [
        'Operation was cancelled by user',
        'No action required'
      ]
    },
    recoverable: true,
    retryable: false,
    metadata: createMetadata(context)
  }),

  invalidState: (
    message: string,
    context?: ErrorContext
  ): CurupiraError => new CurupiraError({
    code: CurupiraErrorCode.PROTOCOL_INVALID_STATE,
    category: 'protocol',
    severity: 'high',
    message,
    details: {
      suggestions: [
        'Check protocol state',
        'Ensure proper initialization',
        'Review operation sequence'
      ]
    },
    recoverable: false,
    retryable: false,
    metadata: createMetadata(context)
  }),

  unsupportedOperation: (
    operation: string,
    context?: ErrorContext
  ): CurupiraError => new CurupiraError({
    code: CurupiraErrorCode.PROTOCOL_UNSUPPORTED_OPERATION,
    category: 'protocol',
    severity: 'medium',
    message: `Unsupported operation: ${operation}`,
    details: {
      technical: { operation },
      suggestions: [
        'Check protocol capabilities',
        'Verify operation is supported',
        'Update to newer version if available'
      ]
    },
    recoverable: false,
    retryable: false,
    metadata: createMetadata(context)
  }),

  remoteError: (
    message: string,
    code: number,
    data?: unknown,
    context?: ErrorContext
  ): CurupiraError => new CurupiraError({
    code: CurupiraErrorCode.PROTOCOL_REMOTE_ERROR,
    category: 'protocol',
    severity: 'high',
    message: `Remote error: ${message}`,
    details: {
      technical: { remoteCode: code, remoteData: data },
      suggestions: [
        'Check remote server logs',
        'Verify request parameters',
        'Contact server administrator if issue persists'
      ]
    },
    recoverable: false,
    retryable: false,
    metadata: createMetadata(context)
  }),
  invalidMessage: (
    reason: string,
    messageData?: unknown,
    context?: ErrorContext
  ): CurupiraError => new CurupiraError({
    code: CurupiraErrorCode.PROTOCOL_INVALID_MESSAGE,
    category: 'protocol',
    severity: 'medium',
    message: `Invalid protocol message: ${reason}`,
    details: {
      technical: { reason, messageData },
      suggestions: [
        'Check message format against protocol specification',
        'Verify all required fields are present',
        'Ensure message structure is valid'
      ]
    },
    recoverable: false,
    retryable: false,
    metadata: createMetadata(context)
  }),

  unsupportedVersion: (
    receivedVersion: string,
    supportedVersions: string[],
    context?: ErrorContext
  ): CurupiraError => new CurupiraError({
    code: CurupiraErrorCode.PROTOCOL_UNSUPPORTED_VERSION,
    category: 'protocol',
    severity: 'high',
    message: `Unsupported protocol version: ${receivedVersion}`,
    details: {
      technical: { receivedVersion, supportedVersions },
      suggestions: [
        `Use one of the supported versions: ${supportedVersions.join(', ')}`,
        'Update client or server to compatible version'
      ]
    },
    recoverable: false,
    retryable: false,
    metadata: createMetadata(context)
  }),

  messageTooLarge: (
    messageSize: number,
    maxSize: number,
    context?: ErrorContext
  ): CurupiraError => new CurupiraError({
    code: CurupiraErrorCode.PROTOCOL_MESSAGE_TOO_LARGE,
    category: 'protocol',
    severity: 'medium',
    message: `Message size ${messageSize} bytes exceeds maximum ${maxSize} bytes`,
    details: {
      technical: { messageSize, maxSize },
      suggestions: [
        'Reduce message payload size',
        'Split large messages into smaller chunks',
        'Consider using message streaming'
      ]
    },
    recoverable: false,
    retryable: false,
    metadata: createMetadata(context)
  })
}

/**
 * Validation error factory
 */
export const ValidationErrors = {
  invalidConfiguration: (
    message: string,
    context?: ErrorContext
  ): CurupiraError => new CurupiraError({
    code: CurupiraErrorCode.CONFIG_INVALID_FORMAT,
    category: 'configuration',
    severity: 'high',
    message,
    details: {
      suggestions: [
        'Check configuration format',
        'Review configuration documentation',
        'Validate against schema'
      ]
    },
    recoverable: false,
    retryable: false,
    metadata: createMetadata(context)
  }),
  requiredField: (
    fieldName: string,
    context?: ErrorContext
  ): CurupiraError => new CurupiraError({
    code: CurupiraErrorCode.VALIDATION_REQUIRED_FIELD,
    category: 'validation',
    severity: 'medium',
    message: `Required field missing: ${fieldName}`,
    details: {
      technical: { fieldName },
      suggestions: [`Provide a value for the required field '${fieldName}'`]
    },
    recoverable: false,
    retryable: false,
    metadata: createMetadata(context)
  }),

  invalidType: (
    fieldName: string,
    expectedType: string,
    actualType: string,
    context?: ErrorContext
  ): CurupiraError => new CurupiraError({
    code: CurupiraErrorCode.VALIDATION_INVALID_TYPE,
    category: 'validation',
    severity: 'medium',
    message: `Field '${fieldName}' expected ${expectedType}, got ${actualType}`,
    details: {
      technical: { fieldName, expectedType, actualType },
      suggestions: [`Provide a ${expectedType} value for field '${fieldName}'`]
    },
    recoverable: false,
    retryable: false,
    metadata: createMetadata(context)
  }),

  outOfRange: (
    fieldName: string,
    value: number,
    min?: number,
    max?: number,
    context?: ErrorContext
  ): CurupiraError => new CurupiraError({
    code: CurupiraErrorCode.VALIDATION_OUT_OF_RANGE,
    category: 'validation',
    severity: 'medium',
    message: `Field '${fieldName}' value ${value} is out of range`,
    details: {
      technical: { fieldName, value, min, max },
      suggestions: [
        `Provide a value between ${min ?? 'minimum'} and ${max ?? 'maximum'} for '${fieldName}'`
      ]
    },
    recoverable: false,
    retryable: false,
    metadata: createMetadata(context)
  })
}

/**
 * Browser error factory
 */
export const BrowserErrors = {
  tabNotFound: (
    tabId: TabId,
    context?: ErrorContext
  ): CurupiraError => new CurupiraError({
    code: CurupiraErrorCode.BROWSER_TAB_NOT_FOUND,
    category: 'browser',
    severity: 'medium',
    message: `Browser tab not found: ${tabId}`,
    details: {
      technical: { tabId },
      suggestions: [
        'Check if the tab still exists',
        'Refresh the list of available tabs',
        'Ensure the tab has not been closed'
      ]
    },
    recoverable: true,
    retryable: true,
    retryDelay: 1000,
    metadata: createMetadata(context)
  }),

  permissionDenied: (
    permission: string,
    context?: ErrorContext
  ): CurupiraError => new CurupiraError({
    code: CurupiraErrorCode.BROWSER_PERMISSION_DENIED,
    category: 'browser',
    severity: 'high',
    message: `Browser permission denied: ${permission}`,
    details: {
      technical: { permission },
      suggestions: [
        'Grant the required browser permission',
        'Check browser security settings',
        'Ensure the extension has necessary permissions'
      ]
    },
    recoverable: false,
    retryable: false,
    metadata: createMetadata(context)
  }),

  scriptInjectionFailed: (
    tabId: TabId,
    scriptName: string,
    reason?: string,
    context?: ErrorContext
  ): CurupiraError => new CurupiraError({
    code: CurupiraErrorCode.BROWSER_SCRIPT_INJECTION_FAILED,
    category: 'browser',
    severity: 'high',
    message: `Failed to inject script '${scriptName}' into tab ${tabId}`,
    details: {
      technical: { tabId, scriptName, reason },
      suggestions: [
        'Check if the tab allows script injection',
        'Verify script syntax and permissions',
        'Ensure the page has finished loading'
      ]
    },
    recoverable: true,
    retryable: true,
    retryDelay: 2000,
    metadata: createMetadata(context)
  })
}

/**
 * Extension error factory
 */
export const ExtensionErrors = {
  notInstalled: (
    context?: ErrorContext
  ): CurupiraError => new CurupiraError({
    code: CurupiraErrorCode.EXTENSION_NOT_INSTALLED,
    category: 'extension',
    severity: 'critical',
    message: 'Curupira browser extension is not installed',
    details: {
      suggestions: [
        'Install the Curupira browser extension',
        'Ensure the extension is enabled',
        'Refresh the page after installation'
      ],
      documentation: [
        'https://docs.curupira.dev/installation'
      ]
    },
    recoverable: false,
    retryable: false,
    metadata: createMetadata(context)
  }),

  connectionLost: (
    context?: ErrorContext
  ): CurupiraError => new CurupiraError({
    code: CurupiraErrorCode.EXTENSION_CONNECTION_LOST,
    category: 'extension',
    severity: 'high',
    message: 'Lost connection to browser extension',
    details: {
      suggestions: [
        'Refresh the page to reconnect',
        'Check if the extension is still enabled',
        'Verify the extension is running properly'
      ]
    },
    recoverable: true,
    retryable: true,
    retryDelay: 3000,
    metadata: createMetadata(context)
  })
}

/**
 * State management error factory
 */
export const StateErrors = {
  storeNotFound: (
    storeId: string,
    context?: ErrorContext
  ): CurupiraError => new CurupiraError({
    code: CurupiraErrorCode.STATE_STORE_NOT_FOUND,
    category: 'state',
    severity: 'medium',
    message: `State store not found: ${storeId}`,
    details: {
      technical: { storeId },
      suggestions: [
        'Check if the store ID is correct',
        'Ensure the store has been initialized',
        'Verify the store is still active'
      ]
    },
    recoverable: false,
    retryable: true,
    retryDelay: 1000,
    metadata: createMetadata(context)
  }),

  snapshotFailed: (
    storeId: string,
    reason: string,
    context?: ErrorContext
  ): CurupiraError => new CurupiraError({
    code: CurupiraErrorCode.STATE_SNAPSHOT_FAILED,
    category: 'state',
    severity: 'medium',
    message: `Failed to create state snapshot for store ${storeId}: ${reason}`,
    details: {
      technical: { storeId, reason },
      suggestions: [
        'Check if the state is serializable',
        'Reduce state complexity',
        'Ensure no circular references in state'
      ]
    },
    recoverable: true,
    retryable: true,
    retryDelay: 500,
    metadata: createMetadata(context)
  })
}

/**
 * Performance error factory
 */
export const PerformanceErrors = {
  timeout: (
    operation: string,
    timeoutMs: number,
    context?: ErrorContext
  ): CurupiraError => new CurupiraError({
    code: CurupiraErrorCode.PERFORMANCE_TIMEOUT,
    category: 'performance',
    severity: 'medium',
    message: `Operation '${operation}' timed out after ${timeoutMs}ms`,
    details: {
      technical: { operation, timeoutMs },
      suggestions: [
        'Increase timeout value if appropriate',
        'Optimize the operation for better performance',
        'Consider breaking down large operations'
      ]
    },
    recoverable: true,
    retryable: true,
    retryDelay: Math.min(timeoutMs * 0.5, 10000),
    metadata: createMetadata(context)
  }),

  memoryLimit: (
    currentUsage: number,
    limit: number,
    context?: ErrorContext
  ): CurupiraError => new CurupiraError({
    code: CurupiraErrorCode.PERFORMANCE_MEMORY_LIMIT,
    category: 'performance',
    severity: 'high',
    message: `Memory usage ${currentUsage}MB exceeds limit of ${limit}MB`,
    details: {
      technical: { currentUsage, limit },
      suggestions: [
        'Reduce memory usage by cleaning up unused objects',
        'Implement memory optimization strategies',
        'Consider increasing memory limits if necessary'
      ]
    },
    recoverable: true,
    retryable: false,
    metadata: createMetadata(context)
  })
}

/**
 * Internal error factory
 */
export const InternalErrors = {
  unexpected: (
    message: string,
    cause?: Error,
    context?: ErrorContext
  ): CurupiraError => new CurupiraError({
    code: CurupiraErrorCode.INTERNAL_UNEXPECTED_ERROR,
    category: 'internal',
    severity: 'critical',
    message: `Unexpected error: ${message}`,
    cause,
    recoverable: false,
    retryable: false,
    metadata: createMetadata(context)
  }),

  assertionFailed: (
    assertion: string,
    context?: ErrorContext
  ): CurupiraError => new CurupiraError({
    code: CurupiraErrorCode.INTERNAL_ASSERTION_FAILED,
    category: 'internal',
    severity: 'critical',
    message: `Assertion failed: ${assertion}`,
    recoverable: false,
    retryable: false,
    metadata: createMetadata(context)
  }),

  resourceExhausted: (
    resource: string,
    context?: ErrorContext
  ): CurupiraError => new CurupiraError({
    code: CurupiraErrorCode.INTERNAL_RESOURCE_EXHAUSTED,
    category: 'internal',
    severity: 'high',
    message: `Resource exhausted: ${resource}`,
    details: {
      technical: { resource },
      suggestions: [
        'Free up system resources',
        'Restart the application',
        'Check system resource limits'
      ]
    },
    recoverable: true,
    retryable: true,
    retryDelay: 5000,
    metadata: createMetadata(context)
  })
}

/**
 * Helper to create error metadata
 */
function createMetadata(context?: ErrorContext): ErrorMetadata {
  return {
    timestamp: Date.now() as Timestamp,
    sessionId: context?.sessionId,
    requestId: context?.requestId,
    tabId: context?.tabId,
    componentId: context?.componentId,
    userId: context?.userId,
    stackTrace: new Error().stack
  }
}

/**
 * Security error factory
 */
export const SecurityErrors = {
  unauthorized: (
    message: string,
    context?: ErrorContext
  ): CurupiraError => new CurupiraError({
    code: CurupiraErrorCode.SECURITY_UNAUTHORIZED,
    category: 'security',
    severity: 'high',
    message: `Unauthorized: ${message}`,
    details: {
      technical: { message },
      suggestions: [
        'Check if authentication token is valid',
        'Ensure token has not expired',
        'Verify user has necessary permissions'
      ]
    },
    recoverable: false,
    retryable: false,
    metadata: createMetadata(context)
  }),

  forbidden: (
    message: string,
    context?: ErrorContext
  ): CurupiraError => new CurupiraError({
    code: CurupiraErrorCode.SECURITY_FORBIDDEN,
    category: 'security',
    severity: 'high',
    message: `Forbidden: ${message}`,
    details: {
      technical: { message },
      suggestions: [
        'Check user permissions',
        'Verify resource access rights',
        'Contact administrator for access'
      ]
    },
    recoverable: false,
    retryable: false,
    metadata: createMetadata(context)
  }),

  tooManyRequests: (
    message: string,
    rateLimit?: { limit: number; reset: Date; retryAfter?: number },
    context?: ErrorContext
  ): CurupiraError => new CurupiraError({
    code: CurupiraErrorCode.SECURITY_RATE_LIMITED,
    category: 'security',
    severity: 'medium',
    message: `Rate limited: ${message}`,
    details: {
      technical: { message, rateLimit },
      suggestions: [
        'Wait before retrying',
        'Reduce request frequency',
        'Use batch operations where possible'
      ]
    },
    recoverable: true,
    retryable: true,
    retryDelay: (rateLimit?.retryAfter || 60) * 1000,
    metadata: createMetadata(context)
  })
}