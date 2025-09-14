/**
 * @fileoverview MCP resource types
 * 
 * This file defines types for MCP resources, which expose
 * read-only browser state and debugging information.
 */

import type { JsonValue } from '@curupira/shared'

/**
 * Resource metadata
 */
export interface ResourceMetadata {
  /** Resource URI */
  uri: string
  /** Resource name */
  name: string
  /** Resource description */
  description?: string
  /** Resource type */
  type: string
  /** MIME type */
  mimeType?: string
  /** Resource size */
  size?: number
  /** Last modified */
  lastModified?: Date
  /** Additional metadata */
  metadata?: Record<string, JsonValue>
}

/**
 * Resource content
 */
export interface ResourceContent {
  /** Content data */
  data: JsonValue
  /** Content encoding */
  encoding?: 'utf8' | 'base64' | 'json'
  /** Content type */
  contentType?: string
  /** Content hash */
  hash?: string
}

/**
 * Resource handler
 */
export interface ResourceHandler {
  /** Handler name */
  name: string
  /** Handler description */
  description?: string
  /** URI pattern */
  pattern: string | RegExp
  /** List resources matching pattern */
  list(pattern?: string): Promise<ResourceMetadata[]>
  /** Read resource content */
  read(uri: string): Promise<ResourceContent>
  /** Subscribe to resource changes */
  subscribe?(uri: string, callback: (content: ResourceContent) => void): () => void
}

/**
 * Resource registry
 */
export interface ResourceRegistry {
  /** Register resource handler */
  register(handler: ResourceHandler): void
  /** Unregister resource handler */
  unregister(name: string): void
  /** Get handler by name */
  getHandler(name: string): ResourceHandler | undefined
  /** Get handler for URI */
  getHandlerForUri(uri: string): ResourceHandler | undefined
  /** List all resources */
  listAll(): Promise<ResourceMetadata[]>
  /** Read resource */
  read(uri: string): Promise<ResourceContent>
}

/**
 * Console resource
 */
export interface ConsoleResource {
  /** Log level */
  level: 'log' | 'debug' | 'info' | 'warn' | 'error'
  /** Message */
  message: string
  /** Arguments */
  args?: JsonValue[]
  /** Timestamp */
  timestamp: number
  /** Source */
  source?: {
    url?: string
    line?: number
    column?: number
  }
  /** Stack trace */
  stackTrace?: string
}

/**
 * Network resource
 */
export interface NetworkResource {
  /** Request ID */
  requestId: string
  /** URL */
  url: string
  /** Method */
  method: string
  /** Status */
  status?: number
  /** Headers */
  headers: Record<string, string>
  /** Request body */
  requestBody?: string
  /** Response body */
  responseBody?: string
  /** Timing */
  timing?: {
    start: number
    end?: number
    duration?: number
  }
  /** Size */
  size?: {
    request: number
    response: number
  }
}

/**
 * DOM resource
 */
export interface DomResource {
  /** Node ID */
  nodeId: number
  /** Node type */
  nodeType: number
  /** Node name */
  nodeName: string
  /** Attributes */
  attributes?: Record<string, string>
  /** Children count */
  childrenCount?: number
  /** Text content */
  textContent?: string
  /** Computed styles */
  computedStyles?: Record<string, string>
  /** Bounding box */
  boundingBox?: {
    x: number
    y: number
    width: number
    height: number
  }
}

/**
 * Storage resource
 */
export interface StorageResource {
  /** Storage type */
  type: 'localStorage' | 'sessionStorage' | 'cookies' | 'indexedDB'
  /** Key */
  key: string
  /** Value */
  value: JsonValue
  /** Size */
  size?: number
  /** Expires */
  expires?: Date
  /** Domain */
  domain?: string
  /** Path */
  path?: string
}

/**
 * State resource
 */
export interface StateResource {
  /** State type */
  type: 'react' | 'redux' | 'xstate' | 'zustand' | 'apollo' | 'custom'
  /** Component/Store name */
  name: string
  /** State value */
  state: JsonValue
  /** Props (for React) */
  props?: JsonValue
  /** Actions (for state managers) */
  actions?: string[]
  /** Path in component tree */
  path?: string[]
  /** Update count */
  updates?: number
}