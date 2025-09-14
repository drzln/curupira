/**
 * @fileoverview Base transport implementation
 * 
 * This file provides the abstract base class for all transport implementations,
 * handling common functionality like state management, event handling, and statistics.
 */

import { EventEmitter } from 'events'
import type {
  Transport,
  TransportConfig,
  TransportEvent,
  TransportEventHandler,
  TransportMessage,
  TransportMessageHandler,
  TransportErrorHandler,
  TransportStats,
  ConnectionState,
  ConnectionInfo,
  TransportCapabilities,
  TransportMiddleware
} from './types.js'
import type {
  SessionId,
  RequestId,
  Timestamp,
  Duration
} from '../types/index.js'
import {
  createSessionId,
  createTimestamp,
  createDuration
} from '../types/index.js'
import type { CurupiraError } from '../errors/index.js'
import { NetworkErrors } from '../errors/index.js'
import type { Logger } from '../logging/index.js'
import { createLogger } from '../logging/index.js'

/**
 * Default transport configuration
 */
const DEFAULT_CONFIG: Partial<TransportConfig> = {
  autoReconnect: true,
  maxReconnectAttempts: 5,
  reconnectDelay: 1000,
  reconnectBackoffMultiplier: 1.5,
  maxReconnectDelay: 30000,
  connectionTimeout: 30000,
  keepAlive: true,
  keepAliveInterval: 30000,
  compression: false,
  maxMessageSize: 1024 * 1024, // 1MB
  debug: false
}

/**
 * Abstract base transport class
 */
export abstract class BaseTransport<TConfig extends TransportConfig = TransportConfig> 
  extends EventEmitter 
  implements Transport<TConfig> {
  
  protected readonly logger: Logger
  protected _state: ConnectionState = 'disconnected'
  protected _connectionInfo: ConnectionInfo | null = null
  protected _stats: TransportStats
  protected reconnectAttempts = 0
  protected reconnectTimer?: NodeJS.Timeout
  protected keepAliveTimer?: NodeJS.Timeout
  protected connectionStartTime?: number
  protected readonly middlewares: TransportMiddleware[] = []
  
  public readonly config: TConfig

  constructor(config: TConfig) {
    super()
    this.config = { ...DEFAULT_CONFIG, ...config } as TConfig
    this.logger = createLogger({
      level: config.debug ? 'debug' : 'info',
      name: `transport:${config.type}`
    })
    
    this._stats = {
      messagesSent: 0,
      messagesReceived: 0,
      bytesSent: 0,
      bytesReceived: 0,
      errors: 0,
      reconnectAttempts: 0,
      lastActivityAt: undefined
    }
  }

  /**
   * Get current connection state
   */
  get state(): ConnectionState {
    return this._state
  }

  /**
   * Get connection information
   */
  get connectionInfo(): ConnectionInfo | null {
    return this._connectionInfo
  }

  /**
   * Get transport statistics
   */
  get stats(): TransportStats {
    const stats = { ...this._stats }
    
    if (this.connectionStartTime && this.isConnected()) {
      stats.connectionDuration = createDuration(Date.now() - this.connectionStartTime)
    }
    
    return stats
  }

  /**
   * Get transport capabilities
   */
  abstract get capabilities(): TransportCapabilities

  /**
   * Connect to the transport
   */
  async connect(): Promise<void> {
    if (this.isConnected()) {
      this.logger.warn('Already connected')
      return
    }

    if (this._state === 'connecting') {
      this.logger.warn('Connection already in progress')
      return
    }

    this.updateState('connecting')
    this.connectionStartTime = Date.now()

    try {
      // Set connection timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(NetworkErrors.timeout('Connection timeout', this.config.connectionTimeout))
        }, this.config.connectionTimeout!)
      })

      // Race between connection and timeout
      await Promise.race([
        this.doConnect(),
        timeoutPromise
      ])

      this._connectionInfo = {
        sessionId: createSessionId(Math.random().toString(36).substring(2, 15)),
        transport: this.config.type,
        state: 'connected',
        connectedAt: createTimestamp()
      }

      this.updateState('connected')
      this.reconnectAttempts = 0
      
      // Start keep-alive if enabled
      if (this.config.keepAlive) {
        this.startKeepAlive()
      }

      this.emitEvent({
        type: 'connected',
        timestamp: createTimestamp()
      })

    } catch (error) {
      this._stats.errors++
      this.updateState('error')
      
      const curupiraError = error instanceof Error 
        ? NetworkErrors.connectionFailed(this.getConnectionString(), error.message)
        : NetworkErrors.connectionFailed(this.getConnectionString())

      this.emitEvent({
        type: 'error',
        timestamp: createTimestamp(),
        error: curupiraError
      })

      // Attempt reconnection if enabled
      if (this.config.autoReconnect && this.reconnectAttempts < this.config.maxReconnectAttempts!) {
        this.scheduleReconnect()
      } else {
        this.updateState('disconnected')
      }

      throw curupiraError
    }
  }

  /**
   * Disconnect from the transport
   */
  async disconnect(reason?: string): Promise<void> {
    if (!this.isConnected() && this._state !== 'connecting') {
      this.logger.warn('Not connected')
      return
    }

    this.updateState('closing')
    this.stopKeepAlive()
    this.cancelReconnect()

    try {
      await this.doDisconnect(reason)

      if (this._connectionInfo) {
        this._connectionInfo.disconnectedAt = createTimestamp()
      }

      this.updateState('closed')
      
      this.emitEvent({
        type: 'disconnected',
        timestamp: createTimestamp(),
        reason
      })

    } catch (error) {
      this._stats.errors++
      this.logger.error({ error }, 'Error during disconnect')
      this.updateState('error')
      throw error
    }
  }

  /**
   * Send a message
   */
  async send<T = unknown>(message: TransportMessage<T>): Promise<void> {
    if (!this.isConnected()) {
      throw NetworkErrors.notConnected('Transport is not connected')
    }

    try {
      // Apply outgoing middleware
      await this.applyMiddleware('outgoing', message)

      // Validate message size
      const messageSize = this.getMessageSize(message)
      if (messageSize > this.config.maxMessageSize!) {
        throw NetworkErrors.payloadTooLarge(
          `Message size ${messageSize} exceeds maximum ${this.config.maxMessageSize}`
        )
      }

      await this.doSend(message)

      this._stats.messagesSent++
      this._stats.bytesSent += messageSize
      this._stats.lastActivityAt = createTimestamp()

    } catch (error) {
      this._stats.errors++
      throw error
    }
  }

  /**
   * Check if transport is connected
   */
  isConnected(): boolean {
    return this._state === 'connected'
  }

  /**
   * Add event handler
   */
  on(event: string, handler: TransportEventHandler): this {
    super.on(event, handler)
    return this
  }

  /**
   * Remove event handler
   */
  off(event: string, handler: TransportEventHandler): this {
    super.off(event, handler)
    return this
  }

  /**
   * Add message handler
   */
  onMessage<T = unknown>(handler: TransportMessageHandler<T>): void {
    const wrappedHandler = (event: TransportEvent) => {
      if (event.type === 'message') {
        handler(event.data as TransportMessage<T>)
      }
    }
    // Store reference for removal
    (handler as any)._wrapped = wrappedHandler
    this.on('message', wrappedHandler)
  }

  /**
   * Remove message handler
   */
  offMessage<T = unknown>(handler: TransportMessageHandler<T>): void {
    const wrappedHandler = (handler as any)._wrapped
    if (wrappedHandler) {
      this.off('message', wrappedHandler)
    }
  }

  /**
   * Add error handler
   */
  onError(handler: TransportErrorHandler): void {
    const wrappedHandler = (event: TransportEvent) => {
      if (event.type === 'error') {
        handler(event.error)
      }
    }
    // Store reference for removal
    (handler as any)._wrapped = wrappedHandler
    this.on('error', wrappedHandler)
  }

  /**
   * Remove error handler
   */
  offError(handler: TransportErrorHandler): void {
    const wrappedHandler = (handler as any)._wrapped
    if (wrappedHandler) {
      this.off('error', wrappedHandler)
    }
  }

  /**
   * Reset transport statistics
   */
  resetStats(): void {
    this._stats = {
      messagesSent: 0,
      messagesReceived: 0,
      bytesSent: 0,
      bytesReceived: 0,
      errors: 0,
      reconnectAttempts: 0,
      lastActivityAt: undefined
    }
  }

  /**
   * Destroy the transport
   */
  async destroy(): Promise<void> {
    await this.disconnect('Transport destroyed')
    this.removeAllListeners()
    this.middlewares.length = 0
  }

  /**
   * Add middleware
   */
  use(middleware: TransportMiddleware): void {
    this.middlewares.push(middleware)
  }

  /**
   * Handle incoming message
   */
  protected async handleMessage<T = unknown>(message: TransportMessage<T>): Promise<void> {
    try {
      // Apply incoming middleware
      await this.applyMiddleware('incoming', message)

      this._stats.messagesReceived++
      this._stats.bytesReceived += this.getMessageSize(message)
      this._stats.lastActivityAt = createTimestamp()

      this.emitEvent({
        type: 'message',
        timestamp: createTimestamp(),
        data: message
      })

    } catch (error) {
      this._stats.errors++
      this.logger.error({ error, message }, 'Error handling message')
      
      const curupiraError = error instanceof Error
        ? NetworkErrors.protocolError(error.message)
        : NetworkErrors.protocolError('Unknown error handling message')

      this.emitEvent({
        type: 'error',
        timestamp: createTimestamp(),
        error: curupiraError
      })
    }
  }

  /**
   * Update connection state
   */
  protected updateState(newState: ConnectionState): void {
    const oldState = this._state
    this._state = newState

    if (oldState !== newState) {
      this.logger.debug({ from: oldState, to: newState }, 'State changed')
      
      this.emitEvent({
        type: 'state_changed',
        timestamp: createTimestamp(),
        from: oldState,
        to: newState
      })
    }
  }

  /**
   * Emit transport event
   */
  protected emitEvent(event: TransportEvent): void {
    this.emit(event.type, event)
  }

  /**
   * Schedule reconnection attempt
   */
  protected scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return
    }

    this.reconnectAttempts++
    this._stats.reconnectAttempts++
    
    const delay = Math.min(
      this.config.reconnectDelay! * Math.pow(this.config.reconnectBackoffMultiplier!, this.reconnectAttempts - 1),
      this.config.maxReconnectDelay!
    )

    this.updateState('reconnecting')
    
    this.emitEvent({
      type: 'reconnecting',
      timestamp: createTimestamp(),
      attempt: this.reconnectAttempts
    })

    this.logger.info(
      { attempt: this.reconnectAttempts, delay },
      'Scheduling reconnection'
    )

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined
      this.connect().catch(error => {
        this.logger.error({ error }, 'Reconnection failed')
      })
    }, delay)
  }

  /**
   * Cancel pending reconnection
   */
  protected cancelReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = undefined
    }
  }

  /**
   * Start keep-alive timer
   */
  protected startKeepAlive(): void {
    if (!this.config.keepAlive || this.keepAliveTimer) {
      return
    }

    this.keepAliveTimer = setInterval(() => {
      if (this.isConnected()) {
        this.sendKeepAlive().catch(error => {
          this.logger.error({ error }, 'Keep-alive failed')
        })
      }
    }, this.config.keepAliveInterval!)
  }

  /**
   * Stop keep-alive timer
   */
  protected stopKeepAlive(): void {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer)
      this.keepAliveTimer = undefined
    }
  }

  /**
   * Apply middleware chain
   */
  protected async applyMiddleware(
    direction: 'incoming' | 'outgoing',
    message: TransportMessage
  ): Promise<void> {
    const middlewares = [...this.middlewares]
    if (direction === 'incoming') {
      middlewares.reverse()
    }

    let index = 0
    const next = async (): Promise<void> => {
      if (index >= middlewares.length) {
        return
      }

      const middleware = middlewares[index++]
      const handler = direction === 'outgoing' ? middleware.outgoing : middleware.incoming

      if (handler) {
        await handler(message, next)
      } else {
        await next()
      }
    }

    await next()
  }

  /**
   * Get message size in bytes
   */
  protected getMessageSize(message: TransportMessage): number {
    // Simple JSON size estimation
    return JSON.stringify(message).length
  }

  /**
   * Get connection string for logging
   */
  protected abstract getConnectionString(): string

  /**
   * Perform actual connection
   */
  protected abstract doConnect(): Promise<void>

  /**
   * Perform actual disconnection
   */
  protected abstract doDisconnect(reason?: string): Promise<void>

  /**
   * Perform actual message send
   */
  protected abstract doSend<T>(message: TransportMessage<T>): Promise<void>

  /**
   * Send keep-alive message
   */
  protected abstract sendKeepAlive(): Promise<void>
}