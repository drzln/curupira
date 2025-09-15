/**
 * @fileoverview Public API exports for Curupira shared types
 * 
 * This is the main entry point for all shared types used across
 * Curupira components. All types are re-exported here for easy access.
 */

// Re-export all branded types and utilities
export type {
  Branded,
  SessionId,
  UserId,
  TabId,
  RequestId,
  ActorId,
  ComponentId,
  StoreId,
  ResourceUri,
  ToolName,
  PromptName,
  Timestamp,
  Duration,
  JsonRpcId,
  JsonRpcMethod
} from './branded.js'

export {
  createSessionId,
  createUserId,
  createTabId,
  createRequestId,
  createActorId,
  createComponentId,
  createStoreId,
  createResourceUri,
  createToolName,
  createPromptName,
  createTimestamp,
  createDuration,
  createJsonRpcId,
  createJsonRpcMethod,
  isSessionId,
  isUserId,
  isTabId,
  isTimestamp,
  isDuration,
  isJsonRpcId,
  unwrap,
  generateId as generateRequestId,  // Renamed to avoid conflict
  generateSessionId
} from './branded.js'

// Re-export all core domain types
export type {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcError,
  JsonRpcNotification,
  Resource,
  ResourceContents,
  Tool,
  ToolCall,
  ToolResult,
  ToolContent,
  Prompt,
  PromptArgument,
  PromptMessage,
  PromptContent,
  BrowserTab,
  ConsoleMessage,
  NetworkRequest,
  DOMElement,
  ComponentInfo,
  HookInfo,
  StateSnapshot,
  StateDiff,
  StateEvent,
  ActorInfo,
  StoreInfo,
  QueryInfo,
  MutationInfo,
  SubscriptionInfo,
  PerformanceMetrics,
  DebugSession
} from './core.js'

// Re-export all message types
export type {
  BaseMessage,
  MessageType,
  ContentScriptMessage,
  ContentScriptPayload,
  BackgroundMessage,
  BackgroundPayload,
  MCPMessage,
  MCPRequestMessage,
  MCPResponseMessage,
  MCPNotificationMessage,
  DevToolsMessage,
  DevToolsPayload,
  ConsoleLogFilter,
  NetworkRequestFilter,
  InjectedScriptMessage,
  InjectedScriptPayload,
  WebSocketMessage
} from './messages.js'

export {
  MessageValidationError,
  isValidMessage,
  isContentScriptMessage,
  isBackgroundMessage,
  isMCPMessage,
  isDevToolsMessage,
  isInjectedScriptMessage,
  createContentScriptMessage,
  createBackgroundMessage,
  createMCPRequestMessage,
  createMCPResponseMessage
} from './messages.js'

// Re-export all CDP types
export type {
  CDPConnectionState,
  CDPSession,
  CDPTarget,
  CDPConnectionOptions,
  CDPEventListener,
  CDPCommandResult,
  CDPClient,
  CDPDomains
} from './cdp.js'

export {
  CDPError,
  CDPConnectionError,
  CDPTimeoutError,
  CDPProtocolError
} from './cdp.js'

// Note: CDP namespaces are available through their containing types
// Use Runtime.RemoteObject, DOM.Node, etc. directly from imported types

// Re-export all state management types
export type {
  ReactFiberNode,
  ReactDevToolsHook,
  ReactDevToolsBackend,
  ReactRenderInfo,
  XStateActor,
  XStateMachine,
  XStateState,
  XStateTransition,
  XStateAction,
  XStateGuard,
  XStateInvocation,
  XStateObserver,
  XStateSnapshot,
  XStateEvent,
  XStateInspectionEvent,
  ZustandStore,
  ZustandStoreApi,
  ZustandDevtoolsConfig,
  ZustandPersistConfig,
  ZustandStorage,
  ZustandImmerConfig,
  ZustandStoreInfo,
  ZustandStateChange,
  ApolloClient,
  ApolloCache,
  ApolloLink,
  ApolloQueryManager,
  ApolloOperation,
  ApolloQueryInfo,
  ApolloCacheStore,
  ApolloNetworkStatus,
  StateInspectionContext,
  StateInspector
} from './state.js'

// Re-export LogLevel from config
export type { LogLevel } from '../config/schema.js'

// Version information
export const CURUPIRA_VERSION = '1.0.0'
export const SUPPORTED_MCP_VERSION = '2024-11-05'

/**
 * Type utility to ensure exhaustive type checking
 */
export const assertNever = (value: never): never => {
  throw new Error(`Unexpected value: ${value}`)
}

/**
 * Type predicate to check if value is not null or undefined
 */
export const isNotNull = <T>(value: T | null | undefined): value is T => {
  return value !== null && value !== undefined
}

/**
 * Type utility for partial deep updates
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

/**
 * Type utility for making specific keys required
 */
export type RequireFields<T, K extends keyof T> = T & Required<Pick<T, K>>

/**
 * Type utility for making specific keys optional
 */
export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

/**
 * Type for JSON-serializable values
 */
export type JsonValue = 
  | string 
  | number 
  | boolean 
  | null 
  | JsonValue[] 
  | { [key: string]: JsonValue }

/**
 * Type for function that can be called with any arguments
 */
export type AnyFunction = (...args: any[]) => any

/**
 * Type for objects with string keys
 */
export type StringRecord = Record<string, unknown>

/**
 * Common result type for operations that can fail
 */
export type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E }