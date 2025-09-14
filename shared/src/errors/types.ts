/**
 * @fileoverview Error types and codes for Curupira
 * 
 * This file defines all error types, codes, and categories used
 * throughout the Curupira system for consistent error handling.
 */

import type { 
  SessionId, 
  RequestId, 
  TabId, 
  ComponentId,
  Timestamp 
} from '../types/branded.js'

/**
 * Error severity levels
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical'

/**
 * Error categories for grouping related errors
 */
export type ErrorCategory = 
  | 'configuration'
  | 'network'
  | 'protocol'
  | 'validation'
  | 'authentication'
  | 'authorization'
  | 'browser'
  | 'extension'
  | 'state'
  | 'performance'
  | 'security'
  | 'internal'

/**
 * Standard error codes used throughout Curupira
 */
export enum CurupiraErrorCode {
  // Configuration errors (1000-1099)
  CONFIG_VALIDATION_FAILED = 1001,
  CONFIG_MISSING_REQUIRED = 1002,
  CONFIG_INVALID_FORMAT = 1003,
  CONFIG_LOAD_FAILED = 1004,

  // Network errors (1100-1199)
  NETWORK_CONNECTION_FAILED = 1101,
  NETWORK_TIMEOUT = 1102,
  NETWORK_UNAVAILABLE = 1103,
  NETWORK_INVALID_RESPONSE = 1104,
  NETWORK_RATE_LIMITED = 1105,
  NETWORK_NOT_CONNECTED = 1106,
  NETWORK_SEND_FAILED = 1107,
  NETWORK_PAYLOAD_TOO_LARGE = 1108,
  NETWORK_REQUEST_FAILED = 1109,

  // Protocol errors (1200-1299)
  PROTOCOL_ERROR = 1200,
  PROTOCOL_INVALID_MESSAGE = 1201,
  PROTOCOL_UNSUPPORTED_VERSION = 1202,
  PROTOCOL_MESSAGE_TOO_LARGE = 1203,
  PROTOCOL_SERIALIZATION_FAILED = 1204,
  PROTOCOL_DESERIALIZATION_FAILED = 1205,
  PROTOCOL_TIMEOUT = 1206,
  PROTOCOL_CANCELLED = 1207,
  PROTOCOL_INVALID_STATE = 1208,
  PROTOCOL_UNSUPPORTED_OPERATION = 1209,
  PROTOCOL_REMOTE_ERROR = 1210,

  // Validation errors (1300-1399)
  VALIDATION_REQUIRED_FIELD = 1301,
  VALIDATION_INVALID_TYPE = 1302,
  VALIDATION_OUT_OF_RANGE = 1303,
  VALIDATION_INVALID_FORMAT = 1304,
  VALIDATION_CONSTRAINT_VIOLATION = 1305,

  // Authentication errors (1400-1499)
  AUTH_TOKEN_MISSING = 1401,
  AUTH_TOKEN_INVALID = 1402,
  AUTH_TOKEN_EXPIRED = 1403,
  AUTH_CREDENTIALS_INVALID = 1404,
  AUTH_SESSION_EXPIRED = 1405,

  // Authorization errors (1500-1599)
  AUTHZ_ACCESS_DENIED = 1501,
  AUTHZ_INSUFFICIENT_PERMISSIONS = 1502,
  AUTHZ_RESOURCE_FORBIDDEN = 1503,
  AUTHZ_OPERATION_NOT_ALLOWED = 1504,

  // Browser errors (1600-1699)
  BROWSER_TAB_NOT_FOUND = 1601,
  BROWSER_CONTEXT_INVALID = 1602,
  BROWSER_SCRIPT_INJECTION_FAILED = 1603,
  BROWSER_PERMISSION_DENIED = 1604,
  BROWSER_UNSUPPORTED_FEATURE = 1605,

  // Extension errors (1700-1799)
  EXTENSION_NOT_INSTALLED = 1701,
  EXTENSION_CONNECTION_LOST = 1702,
  EXTENSION_PERMISSION_MISSING = 1703,
  EXTENSION_CONTENT_SCRIPT_FAILED = 1704,
  EXTENSION_BACKGROUND_SCRIPT_FAILED = 1705,

  // State management errors (1800-1899)
  STATE_STORE_NOT_FOUND = 1801,
  STATE_INVALID_TRANSITION = 1802,
  STATE_SERIALIZATION_FAILED = 1803,
  STATE_DESERIALIZATION_FAILED = 1804,
  STATE_SNAPSHOT_FAILED = 1805,
  STATE_RESTORE_FAILED = 1806,

  // Performance errors (1900-1999)
  PERFORMANCE_TIMEOUT = 1901,
  PERFORMANCE_MEMORY_LIMIT = 1902,
  PERFORMANCE_CPU_LIMIT = 1903,
  PERFORMANCE_OPERATION_TOO_SLOW = 1904,

  // Security errors (2000-2099)
  SECURITY_UNAUTHORIZED = 2001,
  SECURITY_FORBIDDEN = 2002,
  SECURITY_RATE_LIMITED = 2003,
  SECURITY_INVALID_TOKEN = 2004,
  SECURITY_CORS_VIOLATION = 2005,

  // Internal errors (2100-2199)
  INTERNAL_UNEXPECTED_ERROR = 2101,
  INTERNAL_ASSERTION_FAILED = 2102,
  INTERNAL_RESOURCE_EXHAUSTED = 2103,
  INTERNAL_DEPENDENCY_FAILED = 2104,
  INTERNAL_INVARIANT_VIOLATION = 2105
}

/**
 * Error details for additional context
 */
export interface ErrorDetails {
  /** Technical details for debugging */
  technical?: Record<string, unknown>
  /** User-friendly context */
  context?: Record<string, string>
  /** Related resource identifiers */
  resources?: string[]
  /** Suggested actions for resolution */
  suggestions?: string[]
  /** Documentation links */
  documentation?: string[]
}

/**
 * Error metadata for tracking and analysis
 */
export interface ErrorMetadata {
  /** When the error occurred */
  timestamp: Timestamp
  /** Session where error occurred */
  sessionId?: SessionId
  /** Request that caused the error */
  requestId?: RequestId
  /** Browser tab context */
  tabId?: TabId
  /** Component that reported the error */
  componentId?: ComponentId
  /** User ID if available */
  userId?: string
  /** Stack trace if available */
  stackTrace?: string
  /** User agent information */
  userAgent?: string
  /** Application version */
  version?: string
  /** Additional tracking data */
  tags?: Record<string, string>
}

/**
 * Base interface for all Curupira errors
 */
export interface CurupiraErrorInfo {
  /** Unique error code */
  code: CurupiraErrorCode
  /** Error category for grouping */
  category: ErrorCategory
  /** Severity level */
  severity: ErrorSeverity
  /** Human-readable message */
  message: string
  /** Additional error details */
  details?: ErrorDetails
  /** Error metadata */
  metadata?: ErrorMetadata
  /** Underlying cause if this is a wrapped error */
  cause?: Error | CurupiraErrorInfo
  /** Whether this error is recoverable */
  recoverable: boolean
  /** Whether this error should be retried */
  retryable: boolean
  /** Suggested retry delay in milliseconds */
  retryDelay?: number
}

/**
 * Configuration-related errors
 */
export interface ConfigurationError extends CurupiraErrorInfo {
  category: 'configuration'
  code: CurupiraErrorCode.CONFIG_VALIDATION_FAILED 
      | CurupiraErrorCode.CONFIG_MISSING_REQUIRED
      | CurupiraErrorCode.CONFIG_INVALID_FORMAT
      | CurupiraErrorCode.CONFIG_LOAD_FAILED
}

/**
 * Network-related errors
 */
export interface NetworkError extends CurupiraErrorInfo {
  category: 'network'
  code: CurupiraErrorCode.NETWORK_CONNECTION_FAILED
      | CurupiraErrorCode.NETWORK_TIMEOUT
      | CurupiraErrorCode.NETWORK_UNAVAILABLE
      | CurupiraErrorCode.NETWORK_INVALID_RESPONSE
      | CurupiraErrorCode.NETWORK_RATE_LIMITED
      | CurupiraErrorCode.NETWORK_NOT_CONNECTED
      | CurupiraErrorCode.NETWORK_SEND_FAILED
      | CurupiraErrorCode.NETWORK_PAYLOAD_TOO_LARGE
      | CurupiraErrorCode.NETWORK_REQUEST_FAILED
  retryable: true
}

/**
 * Protocol-related errors
 */
export interface ProtocolError extends CurupiraErrorInfo {
  category: 'protocol'
  code: CurupiraErrorCode.PROTOCOL_ERROR
      | CurupiraErrorCode.PROTOCOL_INVALID_MESSAGE
      | CurupiraErrorCode.PROTOCOL_UNSUPPORTED_VERSION
      | CurupiraErrorCode.PROTOCOL_MESSAGE_TOO_LARGE
      | CurupiraErrorCode.PROTOCOL_SERIALIZATION_FAILED
      | CurupiraErrorCode.PROTOCOL_DESERIALIZATION_FAILED
}

/**
 * Validation-related errors
 */
export interface ValidationError extends CurupiraErrorInfo {
  category: 'validation'
  code: CurupiraErrorCode.VALIDATION_REQUIRED_FIELD
      | CurupiraErrorCode.VALIDATION_INVALID_TYPE
      | CurupiraErrorCode.VALIDATION_OUT_OF_RANGE
      | CurupiraErrorCode.VALIDATION_INVALID_FORMAT
      | CurupiraErrorCode.VALIDATION_CONSTRAINT_VIOLATION
  recoverable: false
}

/**
 * Authentication-related errors
 */
export interface AuthenticationError extends CurupiraErrorInfo {
  category: 'authentication'
  code: CurupiraErrorCode.AUTH_TOKEN_MISSING
      | CurupiraErrorCode.AUTH_TOKEN_INVALID
      | CurupiraErrorCode.AUTH_TOKEN_EXPIRED
      | CurupiraErrorCode.AUTH_CREDENTIALS_INVALID
      | CurupiraErrorCode.AUTH_SESSION_EXPIRED
}

/**
 * Authorization-related errors
 */
export interface AuthorizationError extends CurupiraErrorInfo {
  category: 'authorization'
  code: CurupiraErrorCode.AUTHZ_ACCESS_DENIED
      | CurupiraErrorCode.AUTHZ_INSUFFICIENT_PERMISSIONS
      | CurupiraErrorCode.AUTHZ_RESOURCE_FORBIDDEN
      | CurupiraErrorCode.AUTHZ_OPERATION_NOT_ALLOWED
  recoverable: false
}

/**
 * Browser-related errors
 */
export interface BrowserError extends CurupiraErrorInfo {
  category: 'browser'
  code: CurupiraErrorCode.BROWSER_TAB_NOT_FOUND
      | CurupiraErrorCode.BROWSER_CONTEXT_INVALID
      | CurupiraErrorCode.BROWSER_SCRIPT_INJECTION_FAILED
      | CurupiraErrorCode.BROWSER_PERMISSION_DENIED
      | CurupiraErrorCode.BROWSER_UNSUPPORTED_FEATURE
}

/**
 * Extension-related errors
 */
export interface ExtensionError extends CurupiraErrorInfo {
  category: 'extension'
  code: CurupiraErrorCode.EXTENSION_NOT_INSTALLED
      | CurupiraErrorCode.EXTENSION_CONNECTION_LOST
      | CurupiraErrorCode.EXTENSION_PERMISSION_MISSING
      | CurupiraErrorCode.EXTENSION_CONTENT_SCRIPT_FAILED
      | CurupiraErrorCode.EXTENSION_BACKGROUND_SCRIPT_FAILED
}

/**
 * State management-related errors
 */
export interface StateError extends CurupiraErrorInfo {
  category: 'state'
  code: CurupiraErrorCode.STATE_STORE_NOT_FOUND
      | CurupiraErrorCode.STATE_INVALID_TRANSITION
      | CurupiraErrorCode.STATE_SERIALIZATION_FAILED
      | CurupiraErrorCode.STATE_DESERIALIZATION_FAILED
      | CurupiraErrorCode.STATE_SNAPSHOT_FAILED
      | CurupiraErrorCode.STATE_RESTORE_FAILED
}

/**
 * Performance-related errors
 */
export interface PerformanceError extends CurupiraErrorInfo {
  category: 'performance'
  code: CurupiraErrorCode.PERFORMANCE_TIMEOUT
      | CurupiraErrorCode.PERFORMANCE_MEMORY_LIMIT
      | CurupiraErrorCode.PERFORMANCE_CPU_LIMIT
      | CurupiraErrorCode.PERFORMANCE_OPERATION_TOO_SLOW
}

/**
 * Internal system errors
 */
export interface InternalError extends CurupiraErrorInfo {
  category: 'internal'
  severity: 'critical'
  code: CurupiraErrorCode.INTERNAL_UNEXPECTED_ERROR
      | CurupiraErrorCode.INTERNAL_ASSERTION_FAILED
      | CurupiraErrorCode.INTERNAL_RESOURCE_EXHAUSTED
      | CurupiraErrorCode.INTERNAL_DEPENDENCY_FAILED
      | CurupiraErrorCode.INTERNAL_INVARIANT_VIOLATION
}

/**
 * Union of all specific error types
 */
export type CurupiraErrorType = 
  | ConfigurationError
  | NetworkError
  | ProtocolError
  | ValidationError
  | AuthenticationError
  | AuthorizationError
  | BrowserError
  | ExtensionError
  | StateError
  | PerformanceError
  | InternalError

/**
 * Error classification utility type
 */
export interface ErrorClassification {
  isRecoverable: boolean
  isRetryable: boolean
  requiresUserAction: boolean
  canBeSafelyIgnored: boolean
  shouldReportToTelemetry: boolean
}

/**
 * Result type for operations that can fail
 */
export type Result<T, E extends CurupiraErrorInfo = CurupiraErrorInfo> = 
  | { success: true; data: T }
  | { success: false; error: E }

/**
 * Async result type
 */
export type AsyncResult<T, E extends CurupiraErrorInfo = CurupiraErrorInfo> = 
  Promise<Result<T, E>>