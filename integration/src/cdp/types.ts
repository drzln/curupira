/**
 * @fileoverview Chrome DevTools Protocol types
 * 
 * This file defines types for Chrome DevTools Protocol integration,
 * including connection configuration, domain interfaces, and events.
 */

import type { EventEmitter } from 'eventemitter3'
import type { SessionId, TabId, Timestamp } from '@curupira/shared'

/**
 * CDP connection configuration
 */
export interface CdpConnectionConfig {
  /** Connection ID */
  id?: string
  /** Chrome DevTools host */
  host?: string
  /** Chrome DevTools port */
  port?: number
  /** Use secure connection */
  secure?: boolean
  /** Target page URL or ID */
  target?: string
  /** Connection timeout */
  timeout?: number
  /** Enable verbose logging */
  verbose?: boolean
  /** Auto-attach to new targets */
  autoAttach?: boolean
  /** Flatten sessions */
  flattenSessions?: boolean
}

/**
 * CDP target info
 */
export interface CdpTargetInfo {
  /** Target ID */
  targetId: string
  /** Target type */
  type: 'page' | 'iframe' | 'worker' | 'service_worker' | 'other'
  /** Target title */
  title: string
  /** Target URL */
  url: string
  /** Parent target ID */
  parentId?: string
  /** Attached state */
  attached: boolean
  /** Can access opener */
  canAccessOpener: boolean
  /** Browser context ID */
  browserContextId?: string
}

/**
 * CDP session info
 */
export interface CdpSessionInfo {
  /** Session ID */
  sessionId: SessionId
  /** Target info */
  target: CdpTargetInfo
  /** Connection state */
  state: 'connecting' | 'connected' | 'disconnected' | 'error'
  /** Created timestamp */
  created: Timestamp
  /** Last activity */
  lastActivity: Timestamp
  /** Active domains */
  domains: Set<string>
}

/**
 * CDP command parameters
 */
export interface CdpCommand<TMethod extends string = string, TParams = unknown> {
  /** Method name */
  method: TMethod
  /** Command parameters */
  params?: TParams
  /** Session ID */
  sessionId?: SessionId
}

/**
 * CDP command result
 */
export interface CdpResult<TResult = unknown> {
  /** Result data */
  result?: TResult
  /** Error info */
  error?: CdpError
  /** Session ID */
  sessionId?: SessionId
}

/**
 * CDP error
 */
export interface CdpError {
  /** Error code */
  code: number
  /** Error message */
  message: string
  /** Error data */
  data?: unknown
}

/**
 * CDP event
 */
export interface CdpEvent<TMethod extends string = string, TParams = unknown> {
  /** Event method */
  method: TMethod
  /** Event parameters */
  params: TParams
  /** Session ID */
  sessionId?: SessionId
  /** Timestamp */
  timestamp: Timestamp
}

/**
 * CDP client configuration
 */
export interface CdpClientConfig {
  /** Connection config */
  connection: CdpConnectionConfig
  /** Event buffer size */
  eventBufferSize?: number
  /** Command timeout */
  commandTimeout?: number
  /** Retry configuration */
  retry?: {
    enabled: boolean
    maxAttempts: number
    delay: number
    backoffFactor: number
  }
  /** Domain configuration */
  domains?: {
    autoEnable?: string[]
    preload?: string[]
  }
}

/**
 * CDP client events
 */
export interface CdpClientEvents {
  /** Target created */
  'target:created': (target: CdpTargetInfo) => void
  /** Target destroyed */
  'target:destroyed': (targetId: string) => void
  /** Session created */
  'session:created': (session: CdpSessionInfo) => void
  /** Session destroyed */
  'session:destroyed': (sessionId: SessionId) => void
  /** Domain event */
  'domain:event': (event: CdpEvent) => void
  /** Connection state changed */
  'connection:state': (state: CdpSessionInfo['state']) => void
  /** Error occurred */
  'error': (error: Error) => void
}

/**
 * CDP domain method
 */
export type CdpDomainMethod<TDomain extends string, TMethod extends string> = 
  `${TDomain}.${TMethod}`

/**
 * CDP event handler
 */
export type CdpEventHandler<TParams = unknown> = (
  params: TParams,
  sessionId?: SessionId
) => void | Promise<void>

/**
 * CDP command handler
 */
export type CdpCommandHandler<TParams = unknown, TResult = unknown> = (
  params: TParams,
  sessionId?: SessionId
) => TResult | Promise<TResult>

/**
 * CDP domain interface
 */
export interface CdpDomain {
  /** Domain name */
  name: string
  /** Enable domain */
  enable(sessionId?: SessionId): Promise<void>
  /** Disable domain */
  disable(sessionId?: SessionId): Promise<void>
  /** Check if enabled */
  isEnabled(sessionId?: SessionId): boolean
}

/**
 * CDP domain registry
 */
export interface CdpDomainRegistry {
  /** Register domain */
  register(domain: CdpDomain): void
  /** Get domain */
  get(name: string): CdpDomain | undefined
  /** Get all domains */
  getAll(): CdpDomain[]
  /** Enable domains */
  enableDomains(names: string[], sessionId?: SessionId): Promise<void>
  /** Disable domains */
  disableDomains(names: string[], sessionId?: SessionId): Promise<void>
}

/**
 * CDP evaluation result
 */
export interface CdpEvaluationResult<T = unknown> {
  /** Result value */
  value?: T
  /** Exception details */
  exceptionDetails?: {
    text: string
    lineNumber: number
    columnNumber: number
    scriptId?: string
    stackTrace?: CdpStackTrace
  }
  /** Object ID for complex types */
  objectId?: string
  /** Result type */
  type: string
  /** Subtype for objects */
  subtype?: string
}

/**
 * CDP stack trace
 */
export interface CdpStackTrace {
  /** Call frames */
  callFrames: CdpCallFrame[]
  /** Parent stack */
  parent?: CdpStackTrace
  /** Description */
  description?: string
}

/**
 * CDP call frame
 */
export interface CdpCallFrame {
  /** Function name */
  functionName: string
  /** Script ID */
  scriptId: string
  /** URL */
  url: string
  /** Line number */
  lineNumber: number
  /** Column number */
  columnNumber: number
}

/**
 * CDP console message
 */
export interface CdpConsoleMessage {
  /** Message source */
  source: 'xml' | 'javascript' | 'network' | 'console-api' | 'storage' | 'appcache' | 
    'rendering' | 'security' | 'other' | 'deprecation' | 'worker'
  /** Message level */
  level: 'log' | 'warning' | 'error' | 'debug' | 'info'
  /** Message text */
  text: string
  /** URL */
  url?: string
  /** Line number */
  line?: number
  /** Column number */
  column?: number
  /** Stack trace */
  stackTrace?: CdpStackTrace
  /** Timestamp */
  timestamp: Timestamp
}

/**
 * CDP network request
 */
export interface CdpNetworkRequest {
  /** Request ID */
  requestId: string
  /** Document URL */
  documentURL: string
  /** Request URL */
  url: string
  /** Request method */
  method: string
  /** Request headers */
  headers: Record<string, string>
  /** Post data */
  postData?: string
  /** Resource type */
  resourceType: string
  /** Timestamp */
  timestamp: Timestamp
  /** Wall time */
  wallTime: number
  /** Initiator */
  initiator?: {
    type: 'parser' | 'script' | 'other'
    url?: string
    lineNumber?: number
    columnNumber?: number
    stackTrace?: CdpStackTrace
  }
}

/**
 * CDP network response
 */
export interface CdpNetworkResponse {
  /** Request ID */
  requestId: string
  /** Response URL */
  url: string
  /** Status code */
  status: number
  /** Status text */
  statusText: string
  /** Response headers */
  headers: Record<string, string>
  /** MIME type */
  mimeType: string
  /** Connection ID */
  connectionId?: string
  /** Remote IP address */
  remoteIPAddress?: string
  /** Remote port */
  remotePort?: number
  /** From disk cache */
  fromDiskCache?: boolean
  /** From service worker */
  fromServiceWorker?: boolean
  /** Encoded data length */
  encodedDataLength: number
  /** Timing */
  timing?: CdpNetworkTiming
  /** Protocol */
  protocol?: string
  /** Security state */
  securityState?: 'unknown' | 'neutral' | 'insecure' | 'secure' | 'info'
}

/**
 * CDP network timing
 */
export interface CdpNetworkTiming {
  /** Request time */
  requestTime: number
  /** Proxy start */
  proxyStart: number
  /** Proxy end */
  proxyEnd: number
  /** DNS start */
  dnsStart: number
  /** DNS end */
  dnsEnd: number
  /** Connect start */
  connectStart: number
  /** Connect end */
  connectEnd: number
  /** SSL start */
  sslStart: number
  /** SSL end */
  sslEnd: number
  /** Worker start */
  workerStart: number
  /** Worker ready */
  workerReady: number
  /** Send start */
  sendStart: number
  /** Send end */
  sendEnd: number
  /** Push start */
  pushStart: number
  /** Push end */
  pushEnd: number
  /** Receive headers end */
  receiveHeadersEnd: number
}