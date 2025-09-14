/**
 * Protocol Layer
 * 
 * Provides JSON-RPC 2.0 and MCP (Model Context Protocol) implementations
 * with full support for requests, notifications, batching, and error handling.
 * 
 * # Architecture
 * 
 * The protocol layer provides:
 * - Complete JSON-RPC 2.0 implementation
 * - MCP protocol with resources, tools, and prompts
 * - Protocol client for transport integration
 * - Middleware support for extensibility
 * - Request cancellation and progress updates
 * - Automatic reconnection and message queuing
 * 
 * # Dependencies
 * 
 * - `../types` for core types and branded types
 * - `../errors` for error handling
 * - `../logging` for structured logging
 * - `../transport` for network communication
 * 
 * @module protocol
 */

// Export all protocol types
export * from './types'

// Export JSON-RPC implementation
export { 
  JsonRpcProtocol, 
  createJsonRpcProtocol 
} from './jsonrpc'

// Export MCP implementation
export { 
  McpProtocol, 
  createMcpProtocol,
  McpServerBuilder,
  type McpConfig
} from './mcp'

// Export protocol client
export {
  ProtocolClient,
  createJsonRpcClient,
  createMcpClient,
  ProtocolClientBuilder,
  type ProtocolClientConfig
} from './client'

// Re-export commonly used types
export type {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  JsonRpcError,
  JsonRpcMessage,
  RequestHandler,
  NotificationHandler,
  RequestContext,
  ProtocolConfig,
  ProtocolStats,
  ProtocolCapabilities
} from './types'