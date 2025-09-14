// Main entry point for @curupira/shared

// Core types - export first to establish base types
export * from './types/index.js'

// Configuration system - skip AuthConfig conflict
export {
  type CurupiraConfig,
  type Environment,
  type LogLevel,
  loadConfig,
  validateConfig,
  mergeConfigs,
  getDefaultConfig
} from './config/index.js'

// Logging and telemetry
export * from './logging/index.js'

// Error handling - export only what's needed
export {
  NetworkErrors,
  ProtocolErrors,
  SecurityErrors,
  ValidationErrors,
  InternalErrors,
  type CurupiraErrorInfo,
  type ErrorSeverity,
  type AsyncResult
} from './errors/index.js'

// Transport layer
export * from './transport/index.js'

// Protocol layer - skip JsonRpc conflicts
export {
  type ProtocolMessage,
  McpProtocol,
  McpServerBuilder,
  ProtocolClient,
  ProtocolClientBuilder
} from './protocol/index.js'

// Security layer - export sanitizeForLogging
export {
  sanitizeForLogging
} from './security/index.js'

// Messages and utilities
export * from './messages/index.js'

// General utilities
export * from './utils/index.js'

// Re-export specific conflicting items with aliases
export { 
  type Result as ErrorResult
} from './errors/index.js'

export {
  type JsonRpcError as ProtocolJsonRpcError,
  type JsonRpcNotification as ProtocolJsonRpcNotification,
  type JsonRpcRequest as ProtocolJsonRpcRequest,
  type JsonRpcResponse as ProtocolJsonRpcResponse
} from './protocol/index.js'

export {
  type AuthConfig as SecurityAuthConfig
} from './security/index.js'