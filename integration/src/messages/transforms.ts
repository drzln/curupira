/**
 * @fileoverview Message transformers
 */

import type {
  Message,
  MessageTransformer,
  McpRequestMessage,
  CdpCommandMessage,
  CdpEventMessage,
  McpResponseMessage
} from './types.js'
import { createMessage } from './router.js'

/**
 * Transform MCP request to CDP command
 */
export const mcpToCdpTransform: MessageTransformer<McpRequestMessage, CdpCommandMessage> = 
  async (message) => {
    const { method, params } = message.payload

    // Map MCP methods to CDP commands
    const mapping: Record<string, string> = {
      'debug/evaluate': 'Runtime.evaluate',
      'debug/setBreakpoint': 'Debugger.setBreakpoint',
      'page/navigate': 'Page.navigate',
      'page/screenshot': 'Page.captureScreenshot',
      'network/getRequests': 'Network.getResponseBody',
      'console/getLogs': 'Console.enable'
    }

    const cdpMethod = mapping[method]
    if (!cdpMethod) {
      return null // No mapping, filter out
    }

    return createMessage('cdp-command', message.source, {
      method: cdpMethod,
      params,
      sessionId: message.sessionId
    }, {
      sessionId: message.sessionId,
      metadata: {
        originalId: message.payload.id,
        originalMethod: method
      }
    }) as CdpCommandMessage
  }

/**
 * Transform CDP event to MCP notification
 */
export const cdpToMcpTransform: MessageTransformer<CdpEventMessage, McpResponseMessage> = 
  async (message) => {
    const { method, params } = message.payload

    // Map CDP events to MCP notifications
    const mapping: Record<string, string> = {
      'Console.messageAdded': 'console/message',
      'Network.requestWillBeSent': 'network/request',
      'Network.responseReceived': 'network/response',
      'Runtime.consoleAPICalled': 'console/api',
      'Debugger.paused': 'debug/paused',
      'Page.loadEventFired': 'page/loaded'
    }

    const mcpMethod = mapping[method]
    if (!mcpMethod) {
      return null // No mapping, filter out
    }

    return createMessage('mcp-response', 'browser', {
      jsonrpc: '2.0',
      method: mcpMethod,
      params
    }, {
      sessionId: message.sessionId,
      metadata: {
        cdpMethod: method,
        timestamp: message.timestamp
      }
    }) as McpResponseMessage
  }

/**
 * Create filter transform
 */
export function createFilterTransform<T extends Message = Message>(
  predicate: (message: T) => boolean
): MessageTransformer<T, T> {
  return async (message) => {
    return predicate(message) ? message : null
  }
}

/**
 * Create mapping transform
 */
export function createMappingTransform<TIn extends Message = Message, TOut extends Message = Message>(
  mapper: (message: TIn) => TOut | null
): MessageTransformer<TIn, TOut> {
  return async (message) => {
    return mapper(message)
  }
}

/**
 * Create enrichment transform
 */
export function createEnrichmentTransform<T extends Message = Message>(
  enricher: (message: T) => Partial<T> | Promise<Partial<T>>
): MessageTransformer<T, T> {
  return async (message) => {
    const enrichment = await enricher(message)
    
    return {
      ...message,
      ...enrichment,
      metadata: {
        ...message.metadata,
        ...enrichment.metadata
      }
    }
  }
}

/**
 * Create batching transform
 */
export function createBatchingTransform<T extends Message = Message>(
  batchSize: number,
  timeout: number
): MessageTransformer<T, T> {
  const batch: T[] = []
  let timer: NodeJS.Timeout | null = null
  
  return async (message) => {
    batch.push(message)
    
    // Clear existing timer
    if (timer) {
      clearTimeout(timer)
    }
    
    // Check if batch is full
    if (batch.length >= batchSize) {
      const messages = [...batch]
      batch.length = 0
      
      // Return aggregated message
      return createMessage('internal', 'internal', {
        type: 'batch',
        messages
      }, {
        priority: 'high'
      }) as T
    }
    
    // Set timeout for partial batch
    timer = setTimeout(() => {
      if (batch.length > 0) {
        const messages = [...batch]
        batch.length = 0
        
        // Process partial batch
        // Note: This is async and won't return through transform
      }
    }, timeout)
    
    // Don't emit individual messages
    return null
  }
}

/**
 * Create rate limiting transform
 */
export function createRateLimitTransform<T extends Message = Message>(
  maxPerSecond: number
): MessageTransformer<T, T> {
  const timestamps: number[] = []
  const window = 1000 // 1 second
  
  return async (message) => {
    const now = Date.now()
    
    // Remove old timestamps
    while (timestamps.length > 0 && timestamps[0] < now - window) {
      timestamps.shift()
    }
    
    // Check rate limit
    if (timestamps.length >= maxPerSecond) {
      return null // Drop message
    }
    
    timestamps.push(now)
    return message
  }
}