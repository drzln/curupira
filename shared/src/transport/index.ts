/**
 * Transport Layer
 * 
 * Provides abstraction for different communication protocols including
 * WebSocket, HTTP, IPC, and STDIO. Features automatic reconnection,
 * keep-alive, middleware support, and comprehensive error handling.
 * 
 * # Architecture
 * 
 * The transport layer provides:
 * - Protocol-agnostic message passing
 * - Automatic reconnection with exponential backoff
 * - Connection state management
 * - Message batching and streaming support
 * - Middleware for message transformation
 * - Transport statistics and monitoring
 * 
 * # Dependencies
 * 
 * - `../types` for branded types and core interfaces
 * - `../errors` for error handling
 * - `../logging` for structured logging
 * 
 * @module transport
 */

// Export all transport types
export * from './types.js'

// Export base transport class
export { BaseTransport } from './base.js'

// Export transport implementations
export { WebSocketTransport, createWebSocketTransport } from './websocket.js'
export { HttpTransport, createHttpTransport } from './http.js'

// Export registry and factory
export {
  transportRegistry,
  createTransport,
  registerTransport,
  getAvailableTransports,
  TransportManager
} from './registry.js'

// Re-export commonly used types for convenience
export type {
  Transport,
  TransportConfig,
  TransportType,
  ConnectionState,
  TransportEvent,
  TransportMessage,
  TransportStats,
  TransportCapabilities,
  WebSocketTransportConfig,
  HttpTransportConfig
} from './types.js'