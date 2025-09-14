// Browser-safe exports for @curupira/shared
// This file excludes Node.js-specific modules like config loaders

// Core types - safe for browser
export * from './types/index.js'

// Messages and utilities - safe for browser
export * from './messages/index.js'

// General utilities - need to check if browser-safe
export * from './utils/index.js'

// Error handling - should be browser-safe
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

// Re-export specific conflicting items with aliases
export { 
  type Result as ErrorResult
} from './errors/index.js'