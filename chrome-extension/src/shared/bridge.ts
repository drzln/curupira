/**
 * @fileoverview Bridge utilities for extension communication
 */

import type { BridgeMessage, McpRequest, McpResponse } from '@curupira/shared'

/**
 * Message types for extension communication
 */
export enum ExtensionMessageType {
  // Content Script -> Background
  PAGE_EVENT = 'PAGE_EVENT',
  MCP_REQUEST = 'MCP_REQUEST',
  
  // Background -> Content Script
  MCP_RESPONSE = 'MCP_RESPONSE',
  COMMAND = 'COMMAND',
  
  // DevTools -> Background
  DEVTOOLS_READY = 'DEVTOOLS_READY',
  TOOL_CALL = 'TOOL_CALL',
  
  // Background -> DevTools
  TOOL_RESULT = 'TOOL_RESULT',
  DATA_UPDATE = 'DATA_UPDATE',
  
  // General
  CONNECTION_STATUS = 'CONNECTION_STATUS',
  GET_CONNECTION_STATUS = 'GET_CONNECTION_STATUS',
  TOGGLE_DEBUGGING = 'TOGGLE_DEBUGGING',
  CLEAR_DATA = 'CLEAR_DATA',
  RECONNECT = 'RECONNECT',
  TEST_CONNECTION = 'TEST_CONNECTION',
}

/**
 * Extension message interface
 */
export interface ExtensionMessage {
  type: ExtensionMessageType
  data?: any
  tabId?: number
  timestamp?: number
  requestId?: string
}

/**
 * Create an extension message
 */
export function createExtensionMessage(
  type: ExtensionMessageType,
  data?: any,
  tabId?: number
): ExtensionMessage {
  return {
    type,
    data,
    tabId,
    timestamp: Date.now(),
    requestId: `ext_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

/**
 * Page event types
 */
export enum PageEventType {
  CONSOLE_LOG = 'console.log',
  NETWORK_REQUEST = 'network.request',
  NETWORK_ERROR = 'network.error',
  REACT_COMMIT = 'react.commit',
  ZUSTAND_CHANGE = 'zustand.change',
  APOLLO_WRITE = 'apollo.write',
  DOM_MUTATION = 'dom.mutation',
  PERFORMANCE_ENTRY = 'performance.entry',
  ERROR_JS = 'error.js',
  ERROR_PROMISE = 'error.promise',
  HOOKS_READY = 'hooks.ready',
}

/**
 * Page event data interfaces
 */
export interface ConsoleLogEvent {
  level: 'log' | 'warn' | 'error' | 'info' | 'debug'
  message: string
  args: any[]
  timestamp: number
  stackTrace?: string
}

export interface NetworkRequestEvent {
  url: string
  method: string
  status?: number | 'error'
  statusText?: string
  headers?: Record<string, string>
  body?: string
  timing: {
    start: number
    end: number
    duration: number
  }
}

export interface ReactCommitEvent {
  id: number
  timestamp: number
  rootTag?: number
  current?: {
    type: string
    memoizedState: any
    child: boolean
  }
}

export interface ZustandChangeEvent {
  state: any
  prevState: any
  timestamp: number
}

export interface ApolloWriteEvent {
  dataId: string
  result: any
  timestamp: number
}

export interface DomMutationEvent {
  count: number
  timestamp: number
}

export interface PerformanceEntryEvent {
  name: string
  entryType: string
  startTime: number
  duration: number
  timestamp: number
}

export interface ErrorEvent {
  message?: string
  filename?: string
  lineno?: number
  colno?: number
  stack?: string
  reason?: any
  timestamp: number
}

export interface HooksReadyEvent {
  timestamp: number
  features: {
    react: boolean
    zustand: boolean
    apollo: boolean
  }
}

/**
 * Tool action types
 */
export enum ToolActionType {
  NAVIGATE = 'navigate',
  RELOAD = 'reload',
  BACK = 'back',
  FORWARD = 'forward',
  EVALUATE = 'evaluate',
  CLICK = 'click',
  TYPE = 'type',
  SCREENSHOT = 'screenshot',
  SET_BREAKPOINT = 'setBreakpoint',
  CLEAR_CONSOLE = 'clearConsole',
  PAUSE = 'pause',
  RESUME = 'resume',
  GET_STATE = 'getState',
}

/**
 * Tool action data interfaces
 */
export interface NavigateAction {
  url: string
}

export interface EvaluateAction {
  code: string
}

export interface ClickAction {
  selector: string
}

export interface TypeAction {
  selector: string
  text: string
}

export interface SetBreakpointAction {
  lineNumber: number
  url?: string
}

export interface GetStateAction {
  type: 'react' | 'zustand' | 'apollo' | 'dom'
}

/**
 * Connection status
 */
export enum ConnectionStatus {
  CONNECTED = 'connected',
  CONNECTING = 'connecting',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
}

/**
 * Statistics tracking
 */
export interface ExtensionStats {
  console: number
  network: number
  react: number
  errors: number
  lastUpdate: number
}

/**
 * Extension storage keys
 */
export enum StorageKey {
  STATS = 'curupira_stats',
  SETTINGS = 'curupira_settings',
  DEBUG_STATUS = 'debug_status',
  CONNECTION_INFO = 'connection_info',
}

/**
 * Extension settings
 */
export interface ExtensionSettings {
  mcpServerUrl: string
  autoReconnect: boolean
  enableConsoleLogging: boolean
  enableNetworkLogging: boolean
  enableReactTracking: boolean
  maxLogEntries: number
  debugMode: boolean
}

/**
 * Default settings
 */
export const DEFAULT_SETTINGS: ExtensionSettings = {
  mcpServerUrl: 'ws://localhost:8080/mcp',
  autoReconnect: true,
  enableConsoleLogging: true,
  enableNetworkLogging: true,
  enableReactTracking: true,
  maxLogEntries: 1000,
  debugMode: false,
}

/**
 * Storage utilities
 */
export class ExtensionStorage {
  static async get<T>(key: StorageKey): Promise<T | undefined> {
    try {
      const result = await chrome.storage.local.get([key])
      return result[key] as T
    } catch (error) {
      console.error(`Failed to get storage key ${key}:`, error)
      return undefined
    }
  }

  static async set<T>(key: StorageKey, value: T): Promise<void> {
    try {
      await chrome.storage.local.set({ [key]: value })
    } catch (error) {
      console.error(`Failed to set storage key ${key}:`, error)
    }
  }

  static async remove(key: StorageKey): Promise<void> {
    try {
      await chrome.storage.local.remove([key])
    } catch (error) {
      console.error(`Failed to remove storage key ${key}:`, error)
    }
  }

  static async clear(): Promise<void> {
    try {
      await chrome.storage.local.clear()
    } catch (error) {
      console.error('Failed to clear storage:', error)
    }
  }
}

/**
 * Message utilities
 */
export class ExtensionMessaging {
  /**
   * Send message to background script
   */
  static async sendToBackground(message: ExtensionMessage): Promise<any> {
    try {
      return await chrome.runtime.sendMessage(message)
    } catch (error) {
      console.error('Failed to send message to background:', error)
      throw error
    }
  }

  /**
   * Send message to content script
   */
  static async sendToContent(tabId: number, message: ExtensionMessage): Promise<any> {
    try {
      return await chrome.tabs.sendMessage(tabId, message)
    } catch (error) {
      console.error('Failed to send message to content:', error)
      throw error
    }
  }

  /**
   * Send message to DevTools
   */
  static sendToDevTools(port: chrome.runtime.Port, message: ExtensionMessage): void {
    try {
      port.postMessage(message)
    } catch (error) {
      console.error('Failed to send message to DevTools:', error)
    }
  }

  /**
   * Broadcast message to all connections
   */
  static broadcast(connections: Map<number, chrome.runtime.Port>, message: ExtensionMessage): void {
    for (const [tabId, port] of connections) {
      try {
        port.postMessage({ ...message, tabId })
      } catch (error) {
        console.error(`Failed to broadcast to tab ${tabId}:`, error)
        connections.delete(tabId)
      }
    }
  }
}

/**
 * MCP bridge utilities
 */
export class McpBridge {
  /**
   * Convert extension message to MCP request
   */
  static toMcpRequest(message: ExtensionMessage): McpRequest {
    return {
      jsonrpc: '2.0',
      id: message.requestId || 'ext_' + Date.now(),
      method: message.type,
      params: message.data,
    }
  }

  /**
   * Convert MCP response to extension message
   */
  static fromMcpResponse(response: McpResponse, originalType: ExtensionMessageType): ExtensionMessage {
    return {
      type: originalType,
      data: response.result || response.error,
      timestamp: Date.now(),
      requestId: response.id?.toString(),
    }
  }

  /**
   * Create MCP tool call
   */
  static createToolCall(name: string, args: any = {}): McpRequest {
    return {
      jsonrpc: '2.0',
      id: 'tool_' + Date.now(),
      method: 'tools/call',
      params: {
        name,
        arguments: args,
      },
    }
  }

  /**
   * Create MCP resource read
   */
  static createResourceRead(uri: string): McpRequest {
    return {
      jsonrpc: '2.0',
      id: 'resource_' + Date.now(),
      method: 'resources/read',
      params: { uri },
    }
  }
}