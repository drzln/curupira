/**
 * @fileoverview Main entry point for Curupira MCP server
 * 
 * This file exports the public API for the MCP server package.
 */

// Re-export server module
export * from './server.js'

// Re-export shared types that consumers might need
export type {
  // Transport types
  Transport,
  TransportConfig,
  TransportEvent,
  TransportMessage,
  ConnectionState,
  
  // Protocol types
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  JsonRpcError,
  
  // Common types
  SessionId,
  RequestId,
  Timestamp,
  TabId,
  ComponentId,
  Resource,
  Tool,
  Prompt,
  
  // Logging types
  Logger,
  LogLevel,
  
  // Error types
  CurupiraErrorInfo,
  ErrorSeverity
} from '@curupira/shared'