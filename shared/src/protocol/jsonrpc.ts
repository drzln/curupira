/**
 * @fileoverview JSON-RPC 2.0 protocol implementation
 * 
 * This file provides a complete implementation of the JSON-RPC 2.0 protocol
 * with support for batching, notifications, and error handling.
 */

import { EventEmitter } from 'events'
import type {
  JsonRpcRequest,
  JsonRpcNotification,
  JsonRpcResponse,
  JsonRpcError,
  JsonRpcMessage,
  JsonRpcBatch,
  JsonRpcErrorCode,
  RequestHandler,
  NotificationHandler,
  RequestContext,
  ProtocolConfig,
  ProtocolStats,
  ProtocolMiddleware,
  ProtocolCapabilities,
  ProtocolEvent,
  JSON_RPC_VERSION
} from './types.js'
import {
  createJsonRpcId,
  createRequestId,
  createSessionId,
  createTimestamp,
  isJsonRpcId,
  type JsonRpcId,
  type JsonRpcMethod
} from '../types/index.js'
import { ProtocolErrors, ValidationErrors } from '../errors/index.js'
import type { Logger } from '../logging/index.js'
import { createLogger } from '../logging/index.js'

/**
 * Default protocol configuration
 */
const DEFAULT_CONFIG: ProtocolConfig = {
  version: '2.0',
  requestTimeout: 60000, // 1 minute
  batching: true,
  maxBatchSize: 100,
  cancellation: true,
  progress: true,
  strictMode: true,
  debug: false
}

/**
 * JSON-RPC 2.0 protocol implementation
 */
export class JsonRpcProtocol extends EventEmitter {
  private readonly config: Required<ProtocolConfig>
  private readonly logger: Logger
  private readonly handlers = new Map<string, RequestHandler>()
  private readonly notificationHandlers = new Map<string, NotificationHandler>()
  private readonly pendingRequests = new Map<JsonRpcId, PendingRequest<any>>()
  private readonly middlewares: ProtocolMiddleware[] = []
  private readonly sessionId = createSessionId(Math.random().toString(36).substring(2, 15))
  private _stats: ProtocolStats = {
    requestsSent: 0,
    requestsReceived: 0,
    responsesSent: 0,
    responsesReceived: 0,
    notificationsSent: 0,
    notificationsReceived: 0,
    errors: 0,
    pendingRequests: 0
  }

  constructor(config: ProtocolConfig = {}) {
    super()
    this.config = { ...DEFAULT_CONFIG, ...config } as Required<ProtocolConfig>
    this.logger = createLogger({
      level: config.debug ? 'debug' : 'info',
      // SimpleLoggerConfig
    })
  }

  /**
   * Get protocol capabilities
   */
  get capabilities(): ProtocolCapabilities {
    return {
      batch: this.config.batching,
      notifications: true,
      cancellation: this.config.cancellation,
      progress: this.config.progress,
      maxBatchSize: this.config.maxBatchSize,
      versions: ['2.0']
    }
  }

  /**
   * Get protocol statistics
   */
  get stats(): ProtocolStats {
    return {
      ...this._stats,
      pendingRequests: this.pendingRequests.size
    }
  }

  /**
   * Register a request handler
   */
  registerHandler(method: string, handler: RequestHandler): void {
    if (this.handlers.has(method)) {
      throw ValidationErrors.invalidConfiguration(
        `Handler already registered for method: ${method}`
      )
    }
    this.handlers.set(method, handler)
    this.logger.debug({ method }, 'Registered request handler')
  }

  /**
   * Unregister a request handler
   */
  unregisterHandler(method: string): void {
    this.handlers.delete(method)
    this.logger.debug({ method }, 'Unregistered request handler')
  }

  /**
   * Register a notification handler
   */
  registerNotificationHandler(
    method: string,
    handler: NotificationHandler
  ): void {
    if (this.notificationHandlers.has(method)) {
      throw ValidationErrors.invalidConfiguration(
        `Notification handler already registered for method: ${method}`
      )
    }
    this.notificationHandlers.set(method, handler)
    this.logger.debug({ method }, 'Registered notification handler')
  }

  /**
   * Send a request and wait for response
   */
  async request<TParams = unknown, TResult = unknown>(
    method: JsonRpcMethod,
    params?: TParams,
    options: {
      timeout?: number
      signal?: AbortSignal
    } = {}
  ): Promise<TResult> {
    const id = createJsonRpcId(Date.now().toString())
    const request: JsonRpcRequest<TParams> = {
      jsonrpc: '2.0',
      id,
      method,
      params
    }

    this._stats.requestsSent++

    // Create pending request
    const pending = new PendingRequest<TResult>(
      id,
      options.timeout || this.config.requestTimeout
    )
    this.pendingRequests.set(id, pending)

    // Handle cancellation
    if (options.signal) {
      options.signal.addEventListener('abort', () => {
        this.cancelRequest(id)
      })
    }

    try {
      // Apply middleware and send
      await this.sendMessage(request)
      
      // Wait for response
      const result = await pending.promise
      this._stats.responsesReceived++
      
      return result
    } catch (error) {
      this._stats.errors++
      throw error
    } finally {
      this.pendingRequests.delete(id)
    }
  }

  /**
   * Send a notification (no response expected)
   */
  async notify<TParams = unknown>(
    method: JsonRpcMethod,
    params?: TParams
  ): Promise<void> {
    const notification: JsonRpcNotification<TParams> = {
      jsonrpc: '2.0',
      method,
      params
    }

    this._stats.notificationsSent++
    await this.sendMessage(notification)
  }

  /**
   * Send a batch of requests/notifications
   */
  async batch(
    messages: Array<{
      method: JsonRpcMethod
      params?: unknown
      isNotification?: boolean
    }>
  ): Promise<Array<unknown | void>> {
    if (!this.config.batching) {
      throw ProtocolErrors.unsupportedOperation('Batching is not enabled')
    }

    if (messages.length > this.config.maxBatchSize) {
      throw ValidationErrors.outOfRange(
        'batch size',
        messages.length,
        1,
        this.config.maxBatchSize
      )
    }

    const batch: JsonRpcBatch = []
    const pendingResults: Array<Promise<unknown> | void> = []

    for (const msg of messages) {
      if (msg.isNotification) {
        batch.push({
          jsonrpc: '2.0',
          method: msg.method,
          params: msg.params
        } as JsonRpcNotification)
        pendingResults.push(undefined)
        this._stats.notificationsSent++
      } else {
        const id = createJsonRpcId(Date.now().toString())
        const request: JsonRpcRequest = {
          jsonrpc: '2.0',
          id,
          method: msg.method,
          params: msg.params
        }
        batch.push(request)
        
        const pending = new PendingRequest(id, this.config.requestTimeout)
        this.pendingRequests.set(id, pending)
        pendingResults.push(pending.promise)
        this._stats.requestsSent++
      }
    }

    await this.sendMessage(batch)
    
    // Wait for all responses
    const results = await Promise.allSettled(pendingResults)
    
    return results.map(result => {
      if (result.status === 'fulfilled') {
        return result.value
      } else {
        throw result.reason
      }
    })
  }

  /**
   * Handle incoming message
   */
  async handleMessage(message: JsonRpcMessage | JsonRpcBatch): Promise<void> {
    try {
      if (Array.isArray(message)) {
        await this.handleBatch(message)
      } else if ('method' in message) {
        if ('id' in message) {
          await this.handleRequest(message as JsonRpcRequest)
        } else {
          await this.handleNotification(message as JsonRpcNotification)
        }
      } else {
        await this.handleResponse(message as JsonRpcResponse)
      }
    } catch (error) {
      this._stats.errors++
      this.logger.error({ error, message }, 'Error handling message')
      
      // Send error response if it was a request
      if (!Array.isArray(message) && 'id' in message && message.id) {
        const errorResponse = this.createErrorResponse(
          message.id,
          error instanceof Error ? error : new Error('Unknown error')
        )
        await this.sendMessage(errorResponse)
      }
    }
  }

  /**
   * Cancel a pending request
   */
  cancelRequest(id: JsonRpcId): void {
    const pending = this.pendingRequests.get(id)
    if (pending) {
      pending.cancel()
      this.pendingRequests.delete(id)
      
      this.emit('protocol:event', {
        type: 'cancelled',
        requestId: id
      } as ProtocolEvent)
    }
  }

  /**
   * Use middleware
   */
  use(middleware: ProtocolMiddleware): void {
    this.middlewares.push(middleware)
  }

  /**
   * Clear all handlers
   */
  clear(): void {
    this.handlers.clear()
    this.notificationHandlers.clear()
    
    // Cancel all pending requests
    for (const [id, pending] of this.pendingRequests) {
      pending.cancel()
    }
    this.pendingRequests.clear()
  }

  /**
   * Handle incoming request
   */
  private async handleRequest(request: JsonRpcRequest): Promise<void> {
    this._stats.requestsReceived++
    
    const context: RequestContext = {
      requestId: request.id,
      sessionId: this.sessionId,
      method: request.method,
      metadata: {}
    }

    this.emit('protocol:event', {
      type: 'request',
      request,
      context
    } as ProtocolEvent)

    try {
      // Check if handler exists
      const handler = this.handlers.get(request.method)
      if (!handler) {
        if (this.config.strictMode) {
          throw this.createJsonRpcError(
            -32601,
            `Method not found: ${request.method}`
          )
        }
        return
      }

      // Apply middleware and execute handler
      const result = await this.executeHandler(handler, request, context)
      
      // Send success response
      const response: JsonRpcResponse = {
        jsonrpc: '2.0',
        id: request.id,
        result
      }
      
      await this.sendMessage(response)
      this._stats.responsesSent++

    } catch (error) {
      // Send error response
      const errorResponse = this.createErrorResponse(request.id, error)
      await this.sendMessage(errorResponse)
      this._stats.responsesSent++
      this._stats.errors++
    }
  }

  /**
   * Handle incoming notification
   */
  private async handleNotification(
    notification: JsonRpcNotification
  ): Promise<void> {
    this._stats.notificationsReceived++
    
    const context: RequestContext = {
      requestId: createJsonRpcId(Date.now().toString()), // Dummy ID for notifications
      sessionId: this.sessionId,
      method: notification.method,
      metadata: {}
    }

    this.emit('protocol:event', {
      type: 'notification',
      notification,
      context
    } as ProtocolEvent)

    try {
      const handler = this.notificationHandlers.get(notification.method)
      if (handler) {
        await this.executeNotificationHandler(handler, notification, context)
      } else if (this.config.strictMode) {
        this.logger.warn(
          { method: notification.method },
          'No handler for notification'
        )
      }
    } catch (error) {
      this._stats.errors++
      this.logger.error(
        { error, notification },
        'Error handling notification'
      )
    }
  }

  /**
   * Handle incoming response
   */
  private async handleResponse(response: JsonRpcResponse): Promise<void> {
    if (!response.id) {
      this.logger.warn('Received response without ID')
      return
    }

    const pending = this.pendingRequests.get(response.id)
    if (!pending) {
      this.logger.warn(
        { id: response.id },
        'Received response for unknown request'
      )
      return
    }

    this.emit('protocol:event', {
      type: 'response',
      response,
      requestId: response.id
    } as ProtocolEvent)

    if ('error' in response) {
      pending.reject(
        ProtocolErrors.remoteError(
          response.error.message,
          response.error.code,
          response.error.data
        )
      )
    } else {
      pending.resolve(response.result)
    }
  }

  /**
   * Handle batch of messages
   */
  private async handleBatch(batch: JsonRpcBatch): Promise<void> {
    this.emit('protocol:event', {
      type: 'batch',
      messages: batch
    } as ProtocolEvent)

    const responses: JsonRpcMessage[] = []

    for (const message of batch) {
      if ('method' in message) {
        if ('id' in message) {
          // Request - collect response
          try {
            await this.handleRequest(message as JsonRpcRequest)
          } catch (error) {
            responses.push(
              this.createErrorResponse(
                (message as JsonRpcRequest).id,
                error
              )
            )
          }
        } else {
          // Notification - no response
          await this.handleNotification(message as JsonRpcNotification)
        }
      } else {
        // Response
        await this.handleResponse(message as JsonRpcResponse)
      }
    }

    // Send batch response if there are any
    if (responses.length > 0) {
      await this.sendMessage(responses as JsonRpcBatch)
    }
  }

  /**
   * Execute request handler with middleware
   */
  private async executeHandler(
    handler: RequestHandler,
    request: JsonRpcRequest,
    context: RequestContext
  ): Promise<unknown> {
    let index = 0
    const middlewares = [...this.middlewares]

    const next = async (): Promise<unknown> => {
      if (index >= middlewares.length) {
        return handler(request.params, context)
      }

      const middleware = middlewares[index++]
      if (middleware.handleRequest) {
        return middleware.handleRequest(request, context, next)
      }
      return next()
    }

    return next()
  }

  /**
   * Execute notification handler
   */
  private async executeNotificationHandler(
    handler: NotificationHandler,
    notification: JsonRpcNotification,
    context: RequestContext
  ): Promise<void> {
    await handler(notification.params, context)
  }

  /**
   * Create error response
   */
  private createErrorResponse(
    id: JsonRpcId | null,
    error: unknown
  ): JsonRpcResponse {
    let jsonRpcError: JsonRpcError

    if (this.config.errorTransformer) {
      jsonRpcError = this.config.errorTransformer(error)
    } else if (error instanceof Error && 'code' in error) {
      jsonRpcError = {
        code: (error as any).code || -32603,
        message: error.message,
        data: (error as any).data
      }
    } else if (error instanceof Error) {
      jsonRpcError = {
        code: -32603,
        message: error.message
      }
    } else {
      jsonRpcError = {
        code: -32603,
        message: 'Internal error'
      }
    }

    return {
      jsonrpc: '2.0',
      id,
      error: jsonRpcError
    }
  }

  /**
   * Create JSON-RPC error
   */
  private createJsonRpcError(
    code: JsonRpcErrorCode | number,
    message: string,
    data?: unknown
  ): Error {
    const error = new Error(message) as any
    error.code = code
    error.data = data
    return error
  }

  /**
   * Send message (to be implemented by subclasses)
   */
  protected async sendMessage(
    message: JsonRpcMessage | JsonRpcBatch
  ): Promise<void> {
    // This method should be overridden by transport-specific implementations
    this.emit('send', message)
  }
}

/**
 * Pending request tracker
 */
class PendingRequest<T = unknown> {
  public promise: Promise<T>
  private resolveFunc!: (value: T) => void
  private rejectFunc!: (error: Error) => void
  private timeout?: NodeJS.Timeout

  constructor(
    public readonly id: JsonRpcId,
    timeoutMs: number
  ) {
    this.promise = new Promise((resolve, reject) => {
      this.resolveFunc = resolve
      this.rejectFunc = reject
    })

    // Set timeout
    this.timeout = setTimeout(() => {
      this.rejectFunc(
        ProtocolErrors.timeout(`Request ${id} timed out after ${timeoutMs}ms`)
      )
    }, timeoutMs)
  }

  cancel(): void {
    if (this.timeout) {
      clearTimeout(this.timeout)
    }
    this.rejectFunc(
      ProtocolErrors.cancelled(`Request ${this.id} was cancelled`)
    )
  }

  resolve(value: T): void {
    if (this.timeout) {
      clearTimeout(this.timeout)
    }
    this.resolveFunc(value)
  }

  reject(error: Error): void {
    if (this.timeout) {
      clearTimeout(this.timeout)
    }
    this.rejectFunc(error)
  }
}

/**
 * Create JSON-RPC protocol instance
 */
export function createJsonRpcProtocol(
  config?: ProtocolConfig
): JsonRpcProtocol {
  return new JsonRpcProtocol(config)
}