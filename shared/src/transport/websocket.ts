/**
 * @fileoverview WebSocket transport implementation
 * 
 * This file provides a WebSocket-based transport for real-time bidirectional
 * communication, with support for automatic reconnection and keep-alive.
 */

import type { MessageEvent, CloseEvent, ErrorEvent } from 'ws'
import { WebSocket } from 'ws'
import { BaseTransport } from './base.js'
import type {
  WebSocketTransportConfig,
  TransportMessage,
  TransportCapabilities
} from './types.js'
import { NetworkErrors } from '../errors/index.js'
import {
  createRequestId,
  createTimestamp
} from '../types/index.js'

/**
 * WebSocket transport implementation
 */
export class WebSocketTransport extends BaseTransport<WebSocketTransportConfig> {
  private ws?: WebSocket
  private pingTimer?: NodeJS.Timeout
  private pongTimer?: NodeJS.Timeout
  private lastPongReceived?: number

  /**
   * Get transport capabilities
   */
  get capabilities(): TransportCapabilities {
    return {
      bidirectional: true,
      streaming: true,
      batching: true,
      compression: true,
      encryption: true,
      authentication: true,
      qos: false,
      maxMessageSize: this.config.maxMessageSize
    }
  }

  /**
   * Get connection string for logging
   */
  protected getConnectionString(): string {
    return this.config.url
  }

  /**
   * Perform WebSocket connection
   */
  protected async doConnect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Create WebSocket with options
        const options: any = {
          headers: this.config.headers
        }

        if (this.config.protocols) {
          options.protocols = this.config.protocols
        }

        this.ws = new WebSocket(this.config.url, options)

        if (this.config.binaryType && this.config.binaryType !== 'blob') {
          this.ws.binaryType = this.config.binaryType as 'arraybuffer' | 'nodebuffer' | 'fragments'
        }

        // Set up event handlers
        this.ws.onopen = () => {
          this.logger.info({ url: this.config.url }, 'WebSocket connected')
          
          if (this._connectionInfo) {
            this._connectionInfo.remoteAddress = this.config.url
            this._connectionInfo.protocolVersion = this.ws?.protocol
          }

          // Start ping/pong if enabled
          if (this.config.enablePing) {
            this.startPing()
          }

          resolve()
        }

        this.ws.onerror = (event: ErrorEvent) => {
          const error = NetworkErrors.connectionFailed(
            this.config.url,
            event.message || 'WebSocket error'
          )
          this.logger.error({ error, event }, 'WebSocket error')
          reject(error)
        }

        this.ws.onclose = (event: CloseEvent) => {
          this.logger.info(
            { code: event.code, reason: event.reason },
            'WebSocket closed'
          )
          
          this.stopPing()
          
          // Handle unexpected disconnection
          if (this.state === 'connected' || this.state === 'connecting') {
            this.updateState('disconnected')
            
            this.emitEvent({
              type: 'disconnected',
              timestamp: createTimestamp(),
              reason: event.reason || `WebSocket closed with code ${event.code}`
            })

            // Attempt reconnection if enabled
            if (this.config.autoReconnect && 
                this.reconnectAttempts < this.config.maxReconnectAttempts! &&
                event.code !== 1000) { // 1000 = Normal closure
              this.scheduleReconnect()
            }
          }
        }

        this.ws.onmessage = (event: MessageEvent) => {
          this.handleWebSocketMessage(event.data)
        }

        // Handle ping/pong for keep-alive
        if (this.config.enablePing) {
          this.ws.on('pong', () => {
            this.lastPongReceived = Date.now()
            this.clearPongTimeout()
          })
        }

      } catch (error) {
        reject(
          NetworkErrors.connectionFailed(
            this.config.url,
            error instanceof Error ? error.message : 'Unknown error'
          )
        )
      }
    })
  }

  /**
   * Perform WebSocket disconnection
   */
  protected async doDisconnect(reason?: string): Promise<void> {
    return new Promise((resolve) => {
      if (!this.ws) {
        resolve()
        return
      }

      this.stopPing()

      // Set up close handler
      const closeHandler = () => {
        this.ws = undefined
        resolve()
      }

      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.once('close', closeHandler)
        this.ws.close(1000, reason)
        
        // Fallback timeout in case close doesn't fire
        setTimeout(closeHandler, 5000)
      } else {
        this.ws = undefined
        resolve()
      }
    })
  }

  /**
   * Send message via WebSocket
   */
  protected async doSend<T>(message: TransportMessage<T>): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw NetworkErrors.notConnected('WebSocket is not open')
    }

    return new Promise((resolve, reject) => {
      try {
        const data = JSON.stringify(message)
        
        this.ws!.send(data, (error) => {
          if (error) {
            reject(
              NetworkErrors.sendFailed(
                `Failed to send message: ${error.message}`
              )
            )
          } else {
            resolve()
          }
        })
      } catch (error) {
        reject(
          NetworkErrors.sendFailed(
            error instanceof Error ? error.message : 'Failed to serialize message'
          )
        )
      }
    })
  }

  /**
   * Send keep-alive ping
   */
  protected async sendKeepAlive(): Promise<void> {
    if (this.config.enablePing && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.ping()
    }
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleWebSocketMessage(data: WebSocket.Data): void {
    try {
      let message: TransportMessage

      if (typeof data === 'string') {
        message = JSON.parse(data)
      } else if (data instanceof Buffer) {
        message = JSON.parse(data.toString('utf8'))
      } else if (data instanceof ArrayBuffer) {
        const decoder = new TextDecoder()
        message = JSON.parse(decoder.decode(data))
      } else if (Array.isArray(data)) {
        // Handle fragmented messages
        const combined = Buffer.concat(data as Buffer[])
        message = JSON.parse(combined.toString('utf8'))
      } else {
        throw new Error(`Unsupported message type: ${typeof data}`)
      }

      // Validate message structure
      if (!message.id || !message.timestamp || !message.payload) {
        throw new Error('Invalid message structure')
      }

      this.handleMessage(message)

    } catch (error) {
      this.logger.error({ error, data }, 'Failed to handle WebSocket message')
      
      const curupiraError = NetworkErrors.protocolError(
        error instanceof Error ? error.message : 'Failed to parse message'
      )

      this.emitEvent({
        type: 'error',
        timestamp: createTimestamp(),
        error: curupiraError
      })
    }
  }

  /**
   * Start ping timer
   */
  private startPing(): void {
    if (!this.config.enablePing || this.pingTimer) {
      return
    }

    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping()
        this.setPongTimeout()
      }
    }, this.config.pingInterval || 30000)
  }

  /**
   * Stop ping timer
   */
  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer)
      this.pingTimer = undefined
    }
    this.clearPongTimeout()
  }

  /**
   * Set pong timeout
   */
  private setPongTimeout(): void {
    this.clearPongTimeout()
    
    this.pongTimer = setTimeout(() => {
      this.logger.warn('Pong timeout - connection may be dead')
      
      // Force reconnection
      if (this.ws) {
        this.ws.terminate()
      }
    }, this.config.pongTimeout || 10000)
  }

  /**
   * Clear pong timeout
   */
  private clearPongTimeout(): void {
    if (this.pongTimer) {
      clearTimeout(this.pongTimer)
      this.pongTimer = undefined
    }
  }

  /**
   * Clean up resources
   */
  async destroy(): Promise<void> {
    this.stopPing()
    await super.destroy()
  }
}

/**
 * Create WebSocket transport
 */
export function createWebSocketTransport(
  config: WebSocketTransportConfig
): WebSocketTransport {
  return new WebSocketTransport(config)
}