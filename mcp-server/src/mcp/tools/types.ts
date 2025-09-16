/**
 * Common Types for Tool Providers
 * Level 2: MCP Core types
 */

import type { SessionId } from '@curupira/shared/types'

// Base types for tool arguments
export interface BaseToolArgs {
  sessionId?: string
}

// CDP Tool Types
export interface EvaluateArgs extends BaseToolArgs {
  expression: string
}

export interface NavigateArgs extends BaseToolArgs {
  url: string
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2'
}

export interface ScreenshotArgs extends BaseToolArgs {
  fullPage?: boolean
  selector?: string
}

export interface CookieArgs extends BaseToolArgs {
  urls?: string[]
}

export interface SetCookieArgs extends BaseToolArgs {
  name: string
  value: string
  domain?: string
  path?: string
  secure?: boolean
  httpOnly?: boolean
  sameSite?: 'Strict' | 'Lax' | 'None'
}

// DOM Tool Types
export interface DOMSelectorArgs extends BaseToolArgs {
  selector: string
}

export interface DOMNodeArgs extends BaseToolArgs {
  nodeId: number
}

export interface DOMAttributeArgs extends DOMNodeArgs {
  name: string
  value?: string
}

export interface DOMHtmlArgs extends DOMNodeArgs {
  outerHTML?: string
}

// React Tool Types
export interface ReactComponentArgs extends BaseToolArgs {
  componentName?: string
  componentId?: string
}

export interface ReactProfileArgs extends BaseToolArgs {
  duration?: number
  componentName?: string
}

export interface ReactFiberArgs extends BaseToolArgs {
  rootSelector?: string
}

// State Management Types
export interface ZustandStoreArgs extends BaseToolArgs {
  storeName?: string
}

export interface ZustandActionArgs extends BaseToolArgs {
  storeName: string
  action: string
  payload?: unknown
}

export interface XStateActorArgs extends BaseToolArgs {
  actorId: string
}

export interface XStateEventArgs extends BaseToolArgs {
  actorId: string
  event: Record<string, unknown>
}

export interface ApolloQueryArgs extends BaseToolArgs {
  query: string
  variables?: Record<string, unknown>
}

export interface ReduxPathArgs extends BaseToolArgs {
  path?: string
}

export interface ReduxActionArgs extends BaseToolArgs {
  type: string
  payload?: unknown
}

// Performance Tool Types
export interface PerformanceMeasureArgs extends BaseToolArgs {
  componentName?: string
  duration?: number
}

export interface PerformanceTraceArgs extends BaseToolArgs {
  categories?: string[]
}

// Network Tool Types
export interface NetworkMockArgs extends BaseToolArgs {
  urlPattern: string
  method?: string
  response: {
    status: number
    body: unknown
    headers?: Record<string, string>
  }
}

export interface NetworkBlockArgs extends BaseToolArgs {
  urlPatterns: string[]
}

export interface NetworkThrottleArgs extends BaseToolArgs {
  profile: 'offline' | 'slow-3g' | 'fast-3g' | '4g' | 'wifi' | 'online'
  custom?: {
    downloadThroughput: number
    uploadThroughput: number
    latency: number
  }
}

export interface NetworkRequestsArgs extends BaseToolArgs {
  filter?: string
  limit?: number
}

export interface NetworkHeadersArgs extends BaseToolArgs {
  urlPattern: string
  requestHeaders?: Record<string, string>
  responseHeaders?: Record<string, string>
}

export interface NetworkReplayArgs extends BaseToolArgs {
  requestId: string
  modifyBody?: unknown
  modifyHeaders?: Record<string, string>
}

// Debugger Tool Types
export interface DebuggerBreakpointArgs extends BaseToolArgs {
  url: string
  lineNumber: number
  columnNumber?: number
  condition?: string
}

export interface DebuggerRemoveBreakpointArgs extends BaseToolArgs {
  breakpointId: string
}

export interface DebuggerStepArgs extends BaseToolArgs {
  type?: 'into' | 'over' | 'out'
}

export interface DebuggerEvaluateArgs extends BaseToolArgs {
  callFrameId: string
  expression: string
}

export interface DebuggerScopeArgs extends BaseToolArgs {
  callFrameId: string
}

// Console Tool Types
export interface ConsoleExecuteArgs extends BaseToolArgs {
  expression: string
}

export interface ConsoleMessagesArgs extends BaseToolArgs {
  level?: 'verbose' | 'info' | 'warning' | 'error' | 'all'
  limit?: number
}

// Type guards
export function isEvaluateArgs(args: unknown): args is EvaluateArgs {
  return typeof args === 'object' && args !== null && 'expression' in args
}

export function isNavigateArgs(args: unknown): args is NavigateArgs {
  return typeof args === 'object' && args !== null && 'url' in args
}

export function isDOMSelectorArgs(args: unknown): args is DOMSelectorArgs {
  return typeof args === 'object' && args !== null && 'selector' in args
}

export function isDOMNodeArgs(args: unknown): args is DOMNodeArgs {
  return typeof args === 'object' && args !== null && 'nodeId' in args &&
    typeof (args as any).nodeId === 'number'
}

// React result types
export interface ReactComponentSearchResult {
  found: boolean;
  error?: string;
  components?: Array<{
    id: string;
    name: string;
    props?: Record<string, unknown>;
    state?: unknown;
    type?: string;
  }>;
}

export interface ReactComponentInspectResult {
  componentId: string;
  name?: string;
  props?: Record<string, unknown>;
  state?: unknown;
  hooks?: Array<{
    name: string;
    value: unknown;
  }>;
  error?: string;
}

export interface ReactProfileResult {
  profile?: {
    duration: number;
    interactions: Array<{
      name: string;
      timestamp: number;
    }>;
    commits: Array<{
      duration: number;
      timestamp: number;
      phases: string[];
    }>;
  };
  error?: string;
}
