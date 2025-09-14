/**
 * @fileoverview Core domain types for Curupira MCP debugging tool
 * 
 * This file contains the fundamental types that represent the core
 * concepts in Curupira's domain model.
 */

import type {
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

import type { Environment, LogLevel } from '../config/index.js'

/**
 * MCP Protocol types
 */
export interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: JsonRpcId
  method: JsonRpcMethod
  params?: Record<string, unknown>
}

export interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: JsonRpcId | null
  result?: unknown
  error?: JsonRpcError
}

export interface JsonRpcError {
  code: number
  message: string
  data?: unknown
}

export interface JsonRpcNotification {
  jsonrpc: '2.0'
  method: JsonRpcMethod
  params?: Record<string, unknown>
}

/**
 * MCP Resource types
 */
export interface Resource {
  uri: ResourceUri
  name: string
  description?: string
  mimeType?: string
}

export interface ResourceContents {
  uri: ResourceUri
  contents: Array<{
    type: 'text' | 'blob'
    text?: string
    blob?: Uint8Array
    mimeType?: string
  }>
  metadata?: Record<string, unknown>
}

/**
 * MCP Tool types
 */
export interface Tool {
  name: ToolName
  description: string
  inputSchema: Record<string, unknown>
}

export interface ToolCall {
  name: ToolName
  arguments: Record<string, unknown>
}

export interface ToolResult {
  content: ToolContent[]
  isError?: boolean
}

export interface ToolContent {
  type: 'text' | 'image'
  text?: string
  data?: string
  mimeType?: string
}

/**
 * MCP Prompt types
 */
export interface Prompt {
  name: PromptName
  description: string
  arguments?: PromptArgument[]
}

export interface PromptArgument {
  name: string
  description: string
  required?: boolean
}

export interface PromptMessage {
  role: 'user' | 'assistant'
  content: PromptContent
}

export interface PromptContent {
  type: 'text' | 'image' | 'resource'
  text?: string
  data?: string
  mimeType?: string
  uri?: ResourceUri
}

/**
 * Browser integration types
 */
export interface BrowserTab {
  id: TabId
  url: string
  title: string
  active: boolean
}

export interface ConsoleMessage {
  id: RequestId
  timestamp: Timestamp
  level: 'log' | 'info' | 'warn' | 'error' | 'debug' | 'trace'
  text: string
  url?: string
  lineNumber?: number
  columnNumber?: number
  stackTrace?: string
  args?: unknown[]
}

export interface NetworkRequest {
  id: RequestId
  timestamp: Timestamp
  method: string
  url: string
  status?: number
  statusText?: string
  requestHeaders?: Record<string, string>
  responseHeaders?: Record<string, string>
  requestBody?: string
  responseBody?: string
  duration?: Duration
  size?: number
}

export interface DOMElement {
  selector: string
  tagName: string
  id?: string
  className?: string
  attributes: Record<string, string>
  computedStyle?: Record<string, string>
  boundingRect?: {
    x: number
    y: number
    width: number
    height: number
  }
}

/**
 * State management types
 */
export interface ComponentInfo {
  id: ComponentId
  name: string
  type: string
  props: Record<string, unknown>
  state: Record<string, unknown>
  hooks: HookInfo[]
  parent?: ComponentId
  children: ComponentId[]
}

export interface HookInfo {
  index: number
  type: string
  value: unknown
  deps?: unknown[]
}

export interface StateSnapshot {
  id: RequestId
  timestamp: Timestamp
  source: 'react' | 'xstate' | 'zustand' | 'apollo'
  data: Record<string, unknown>
  diff?: StateDiff
}

export interface StateDiff {
  added: Record<string, unknown>
  modified: Record<string, { from: unknown; to: unknown }>
  removed: Record<string, unknown>
}

export interface StateEvent {
  id: RequestId
  timestamp: Timestamp
  type: 'action' | 'effect' | 'external'
  source: 'user' | 'system' | 'network'
  payload: unknown
  stackTrace?: string
}

/**
 * XState integration types
 */
export interface ActorInfo {
  id: ActorId
  sessionId: SessionId
  type: string
  state: unknown
  context: unknown
  parent?: ActorId
  children: ActorId[]
}

/**
 * Zustand integration types
 */
export interface StoreInfo {
  id: StoreId
  name: string
  state: Record<string, unknown>
  actions: string[]
  persist: boolean
  devtools: boolean
}

/**
 * Apollo integration types
 */
export interface QueryInfo {
  queryId: RequestId
  query: string
  variables: Record<string, unknown>
  data?: unknown
  error?: unknown
  loading: boolean
  networkStatus: number
}

export interface MutationInfo {
  mutationId: RequestId
  mutation: string
  variables: Record<string, unknown>
  data?: unknown
  error?: unknown
  loading: boolean
}

export interface SubscriptionInfo {
  subscriptionId: RequestId
  subscription: string
  variables: Record<string, unknown>
  data?: unknown
  error?: unknown
  loading: boolean
}

/**
 * Performance and debugging types
 */
export interface PerformanceMetrics {
  timestamp: Timestamp
  memoryUsage: {
    used: number
    total: number
    limit: number
  }
  renderTimes: {
    component: ComponentId
    duration: Duration
  }[]
  networkTiming: {
    dns: Duration
    connect: Duration
    request: Duration
    response: Duration
    total: Duration
  }
}

export interface DebugSession {
  id: SessionId
  userId?: UserId
  tabId: TabId
  startTime: Timestamp
  endTime?: Timestamp
  events: StateEvent[]
  snapshots: StateSnapshot[]
  metrics: PerformanceMetrics[]
}

// Configuration types are now exported from the config module