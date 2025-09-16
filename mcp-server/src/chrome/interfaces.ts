/**
 * Chrome Client Interfaces - Unified abstraction
 * Level 1: Chrome Core (clean interfaces for testing and implementation)
 */

import type { SessionId, TargetId, CDPConnectionOptions } from '@curupira/shared/types'

export interface ConnectionStatus {
  connected: boolean
  serviceUrl: string | null
  activeSessions: number
  sessions: Array<{ sessionId: string; createdAt: Date }>
}

export interface SessionInfo {
  sessionId: SessionId
  targetId?: TargetId
  createdAt: Date
}

export interface EvaluateOptions {
  returnByValue?: boolean
  awaitPromise?: boolean
  userGesture?: boolean
  silent?: boolean
}

export interface EvaluateResult {
  result: {
    type: string
    value?: any
    objectId?: string
  }
  exceptionDetails?: {
    text: string
    lineNumber?: number
    columnNumber?: number
    scriptId?: string
  }
}

export interface NavigateOptions {
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2'
  timeout?: number
}

export interface NavigateResult {
  frameId: string
  loaderId?: string
  errorText?: string
}

export interface ScreenshotOptions {
  fullPage?: boolean
  captureBeyondViewport?: boolean
  selector?: string
  clip?: {
    x: number
    y: number
    width: number
    height: number
  }
}

export interface ScreenshotResult {
  data: string // base64 encoded image
}

export interface CookieOptions {
  name: string
  value: string
  domain?: string
  path?: string
  secure?: boolean
  httpOnly?: boolean
  sameSite?: 'Strict' | 'Lax' | 'None'
  expires?: number
}

export interface Cookie {
  name: string
  value: string
  domain: string
  path: string
  expires: number
  size: number
  httpOnly: boolean
  secure: boolean
  session: boolean
  sameSite: 'Strict' | 'Lax' | 'None'
}

/**
 * Core Chrome Client interface - what tests expect
 */
export interface IChromeClient {
  // Connection management
  connect(): Promise<void>
  disconnect(): Promise<void>
  isConnected(): boolean
  
  // Session management - flexible to work with existing implementation
  createSession(targetId?: string): Promise<any>
  getSessions(): any[]
  getTargets(): any
  
  // Direct CDP communication (for legacy compatibility)
  send<T = any>(method: string, params?: any, sessionId?: string): Promise<T>
  
  // Event handling
  on(event: string, handler: (...args: any[]) => void): void
  off(event: string, handler: (...args: any[]) => void): void
  
  // Status
  getState(): string
}

/**
 * Typed CDP Client interface - high-level operations
 */
export interface ITypedCDPClient {
  // Domain enabling
  enableRuntime(sessionId: SessionId): Promise<void>
  enableDOM(sessionId: SessionId): Promise<void>
  enableNetwork(sessionId: SessionId): Promise<void>
  enablePage(sessionId: SessionId): Promise<void>
  
  // JavaScript execution
  evaluate(expression: string, options: EvaluateOptions, sessionId: SessionId): Promise<EvaluateResult>
  
  // Navigation
  navigate(url: string, options: NavigateOptions, sessionId: SessionId): Promise<NavigateResult>
  reload(options?: { ignoreCache?: boolean }, sessionId?: SessionId): Promise<void>
  
  // Screenshots
  captureScreenshot(options: ScreenshotOptions, sessionId: SessionId): Promise<ScreenshotResult>
  
  // DOM operations
  getDocument(options?: { depth?: number; pierce?: boolean }, sessionId?: SessionId): Promise<any>
  querySelector(nodeId: number, selector: string, sessionId: SessionId): Promise<{ nodeId: number }>
  getBoxModel(options: { nodeId: number }, sessionId: SessionId): Promise<any>
  
  // Cookie management
  getCookies(options?: { urls?: string[] }, sessionId?: SessionId): Promise<{ cookies: Cookie[] }>
  setCookie(cookie: CookieOptions, sessionId: SessionId): Promise<{ success: boolean }>
  clearCookies(sessionId?: SessionId): Promise<void>
  
  // Additional DOM methods
  querySelectorAll(nodeId: number, selector: string, sessionId: SessionId): Promise<{ nodeIds: number[] }>
  getAttributes(nodeId: number, sessionId: SessionId): Promise<{ attributes: string[] }>
  setAttributeValue(nodeId: number, name: string, value: string, sessionId: SessionId): Promise<void>
  removeAttribute(nodeId: number, name: string, sessionId: SessionId): Promise<void>
  getOuterHTML(params: { nodeId: number }, sessionId: SessionId): Promise<{ outerHTML: string }>
  setOuterHTML(nodeId: number, outerHTML: string, sessionId: SessionId): Promise<void>
  focus(params: { nodeId: number }, sessionId: SessionId): Promise<void>
  scrollIntoViewIfNeeded(params: { nodeId: number }, sessionId: SessionId): Promise<void>
  describeNode(params: { nodeId: number }, sessionId: SessionId): Promise<any>
  
  // Mouse and input events
  dispatchMouseEvent(params: any, sessionId: SessionId): Promise<void>
  dispatchKeyEvent(params: any, sessionId: SessionId): Promise<void>
  dispatchTouchEvent(params: any, sessionId: SessionId): Promise<void>
  
  // Debugger methods
  enableDebugger(params?: any, sessionId?: SessionId): Promise<any>
  disableDebugger(sessionId?: SessionId): Promise<void>
  setBreakpointByUrl(params: any, sessionId: SessionId): Promise<any>
  removeBreakpoint(breakpointId: string, sessionId: SessionId): Promise<void>
  pause(sessionId?: SessionId): Promise<void>
  resume(params?: any, sessionId?: SessionId): Promise<void>
  stepOver(params?: any, sessionId?: SessionId): Promise<void>
  stepInto(params?: any, sessionId?: SessionId): Promise<void>
  stepOut(sessionId?: SessionId): Promise<void>
  evaluateOnCallFrame(params: any, sessionId: SessionId): Promise<any>
  
  // Performance methods
  enablePerformance(params?: any, sessionId?: SessionId): Promise<void>
  disablePerformance(sessionId?: SessionId): Promise<void>
  getMetrics(sessionId?: SessionId): Promise<any>
  
  // Generic send method for compatibility
  send<T = unknown>(method: string, params?: any, sessionId?: SessionId): Promise<T>
}

/**
 * Chrome Manager interface - what tool providers use
 */
export interface IChromeManager {
  // Initialization
  initialize(config: CDPConnectionOptions): Promise<void>
  
  // Session management
  createSession(): Promise<string>
  closeSession(sessionId: string): Promise<void>
  
  // Client access
  getClient(): IChromeClient
  getTypedClient(): ITypedCDPClient
  
  // Status
  getStatus(): ConnectionStatus
  
  // Cleanup
  disconnect(): Promise<void>
}

/**
 * Target information from Chrome
 */
export interface ChromeTarget {
  id: string
  type: string
  title: string
  url: string
  webSocketDebuggerUrl?: string
  faviconUrl?: string
}