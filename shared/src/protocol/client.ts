/**
 * @fileoverview Protocol client that connects JSON-RPC/MCP with transports
 * 
 * This file provides the integration between the protocol layer and transport layer,
 * handling message serialization, deserialization, and routing.
 */

import { EventEmitter } from 'events'
import type {
  Transport,
  TransportMessage,
  TransportEvent,
  ConnectionState
} from '../transport/index.js'
import type {
  JsonRpcMessage,
  JsonRpcBatch,
  ProtocolMessage,
  ProtocolConfig,
  JsonRpcRequest,
  JsonRpcResponse
} from './types.js'
import { JsonRpcProtocol } from './jsonrpc.js'
import { McpProtocol } from './mcp.js'
import {
  createRequestId,
  createSessionId,
  createTimestamp,
  createJsonRpcMethod,
  type RequestId,
  type SessionId
} from '../types/index.js'
import { NetworkErrors, ProtocolErrors } from '../errors/index.js'
import type { Logger } from '../logging/index.js'
import { createLogger } from '../logging/index.js'

/**
 * Protocol client configuration
 */
export interface ProtocolClientConfig extends ProtocolConfig {
  /** Transport to use */
  transport: Transport
  /** Session ID */
  sessionId?: SessionId
  /** Enable automatic reconnection handling */
  autoReconnect?: boolean
  /** Message queue size for offline buffering */
  messageQueueSize?: number
}

/**
 * Protocol client that integrates protocol with transport
 */
export class ProtocolClient extends EventEmitter {
  private readonly config: ProtocolClientConfig
  private readonly transport: Transport
  private readonly protocol: JsonRpcProtocol | McpProtocol
  private readonly logger: Logger
  private readonly sessionId: SessionId
  private readonly messageQueue: ProtocolMessage<JsonRpcMessage | JsonRpcBatch>[] = []
  private isConnected = false

  constructor(
    protocol: JsonRpcProtocol | McpProtocol,
    config: ProtocolClientConfig
  ) {
    super()
    this.config = config
    this.transport = config.transport
    this.protocol = protocol
    this.sessionId = config.sessionId || createSessionId(Math.random().toString(36).substring(2, 15))
    this.logger = createLogger({
      level: config.debug ? 'debug' : 'info',
      // SimpleLoggerConfig
    })

    // Set up transport event handlers
    this.setupTransportHandlers()

    // Set up protocol send handler
    this.setupProtocolHandlers()
  }

  /**
   * Get connection state
   */
  get connectionState(): ConnectionState {
    return this.transport.state
  }

  /**
   * Get protocol instance
   */
  get protocolInstance(): JsonRpcProtocol | McpProtocol {
    return this.protocol
  }

  /**
   * Connect to transport
   */
  async connect(): Promise<void> {
    await this.transport.connect()
  }

  /**
   * Disconnect from transport
   */
  async disconnect(reason?: string): Promise<void> {
    await this.transport.disconnect(reason)
  }

  /**
   * Send a request
   */
  async request<TParams = unknown, TResult = unknown>(
    method: string,
    params?: TParams,
    options?: {
      timeout?: number
      signal?: AbortSignal
    }
  ): Promise<TResult> {
    if (!this.isConnected) {
      throw NetworkErrors.notConnected('Protocol client is not connected')
    }

    return this.protocol.request<TParams, TResult>(createJsonRpcMethod(method), params, options)
  }

  /**
   * Send a notification
   */
  async notify<TParams = unknown>(
    method: string,
    params?: TParams
  ): Promise<void> {
    if (!this.isConnected) {
      throw NetworkErrors.notConnected('Protocol client is not connected')
    }

    return this.protocol.notify(createJsonRpcMethod(method), params)
  }

  /**
   * Set up transport event handlers
   */
  private setupTransportHandlers(): void {
    // Handle connection events
    this.transport.on('connected', () => {
      this.isConnected = true
      this.logger.info('Transport connected')
      this.emit('connected')
      
      // Flush message queue
      this.flushMessageQueue()
    })

    this.transport.on('disconnected', (event: TransportEvent) => {
      this.isConnected = false
      this.logger.info({ event }, 'Transport disconnected')
      this.emit('disconnected', event)
    })

    this.transport.on('error', (event: TransportEvent) => {
      if (event.type === 'error') {
        this.logger.error({ error: event.error }, 'Transport error')
        this.emit('error', event.error)
      }
    })

    // Handle incoming messages
    this.transport.onMessage(async (transportMessage: TransportMessage) => {
      try {
        await this.handleIncomingMessage(transportMessage)
      } catch (error) {
        this.logger.error(
          { error, transportMessage },
          'Error handling incoming message'
        )
      }
    })
  }

  /**
   * Set up protocol send handler
   */
  private setupProtocolHandlers(): void {
    // Override protocol's sendMessage to use transport
    (this.protocol as any).sendMessage = async (
      message: JsonRpcMessage | JsonRpcBatch
    ): Promise<void> => {
      await this.sendProtocolMessage(message)
    }
  }

  /**
   * Handle incoming transport message
   */
  private async handleIncomingMessage(
    transportMessage: TransportMessage
  ): Promise<void> {
    try {
      // Extract protocol message
      const protocolMessage = transportMessage.payload as ProtocolMessage

      // Validate protocol message
      if (!protocolMessage?.payload) {
        throw ProtocolErrors.invalidMessage(
          'Invalid protocol message structure',
          transportMessage
        )
      }

      // Handle the JSON-RPC message
      await this.protocol.handleMessage(protocolMessage.payload)

    } catch (error) {
      this.logger.error(
        { error, transportMessage },
        'Failed to process incoming message'
      )
      
      // Try to send error response if it was a request
      if (transportMessage.payload &&
          typeof transportMessage.payload === 'object' &&
          'id' in transportMessage.payload) {
        const errorResponse: JsonRpcResponse = {
          jsonrpc: '2.0',
          id: (transportMessage.payload as any).id,
          error: {
            code: -32700,
            message: 'Parse error',
            data: error instanceof Error ? error.message : 'Unknown error'
          }
        }
        
        await this.sendProtocolMessage(errorResponse).catch(err => {
          this.logger.error({ err }, 'Failed to send error response')
        })
      }
    }
  }

  /**
   * Send protocol message via transport
   */
  private async sendProtocolMessage(
    message: JsonRpcMessage | JsonRpcBatch
  ): Promise<void> {
    const protocolMessage: ProtocolMessage<JsonRpcMessage | JsonRpcBatch> = {
      id: createRequestId(Date.now().toString() + '-' + Math.random().toString(36).substring(2, 9)),
      sessionId: this.sessionId,
      timestamp: createTimestamp(),
      version: this.config.version || '2.0',
      payload: message,
      metadata: {}
    }

    const transportMessage: TransportMessage<ProtocolMessage<JsonRpcMessage | JsonRpcBatch>> = {
      id: protocolMessage.id,
      timestamp: protocolMessage.timestamp,
      payload: protocolMessage,
      metadata: {
        sessionId: this.sessionId
      }
    }

    if (this.isConnected) {
      try {
        await this.transport.send(transportMessage)
      } catch (error) {
        this.logger.error({ error, message }, 'Failed to send message')
        
        // Queue message if configured
        if (this.config.autoReconnect && this.config.messageQueueSize) {
          this.queueMessage(protocolMessage)
        }
        
        throw error
      }
    } else if (this.config.autoReconnect && this.config.messageQueueSize) {
      // Queue message for later delivery
      this.queueMessage(protocolMessage)
    } else {
      throw NetworkErrors.notConnected('Transport is not connected')
    }
  }

  /**
   * Queue message for later delivery
   */
  private queueMessage(message: ProtocolMessage<JsonRpcMessage | JsonRpcBatch>): void {
    if (this.messageQueue.length >= (this.config.messageQueueSize || 100)) {
      // Remove oldest message
      this.messageQueue.shift()
    }
    
    this.messageQueue.push(message)
    this.logger.debug(
      { queueSize: this.messageQueue.length },
      'Message queued for delivery'
    )
  }

  /**
   * Flush queued messages
   */
  private async flushMessageQueue(): Promise<void> {
    if (this.messageQueue.length === 0) {
      return
    }

    this.logger.info(
      { count: this.messageQueue.length },
      'Flushing message queue'
    )

    const messages = [...this.messageQueue]
    this.messageQueue.length = 0

    for (const message of messages) {
      try {
        const transportMessage: TransportMessage<ProtocolMessage<JsonRpcMessage | JsonRpcBatch>> = {
          id: message.id,
          timestamp: message.timestamp,
          payload: message,
          metadata: {
            sessionId: this.sessionId
          }
        }

        await this.transport.send(transportMessage)
      } catch (error) {
        this.logger.error(
          { error, message },
          'Failed to send queued message'
        )
      }
    }
  }

  /**
   * Destroy the client
   */
  async destroy(): Promise<void> {
    await this.disconnect('Client destroyed')
    this.removeAllListeners()
    this.protocol.clear()
  }
}

/**
 * Create a protocol client for JSON-RPC
 */
export function createJsonRpcClient(
  config: ProtocolClientConfig
): ProtocolClient {
  const protocol = new JsonRpcProtocol(config)
  return new ProtocolClient(protocol, config)
}

/**
 * Create a protocol client for MCP
 */
export function createMcpClient(
  name: string,
  version: string,
  config: ProtocolClientConfig
): ProtocolClient {
  const protocol = new McpProtocol({
    ...config,
    name,
    version
  })
  return new ProtocolClient(protocol, config)
}

/**
 * Protocol client builder for convenient setup
 */
export class ProtocolClientBuilder {
  private config: Partial<ProtocolClientConfig> = {
    autoReconnect: true,
    messageQueueSize: 100
  }
  private protocolType: 'jsonrpc' | 'mcp' = 'jsonrpc'
  private mcpName?: string
  private mcpVersion?: string

  /**
   * Use JSON-RPC protocol
   */
  useJsonRpc(): this {
    this.protocolType = 'jsonrpc'
    return this
  }

  /**
   * Use MCP protocol
   */
  useMcp(name: string, version: string): this {
    this.protocolType = 'mcp'
    this.mcpName = name
    this.mcpVersion = version
    return this
  }

  /**
   * Set transport
   */
  withTransport(transport: Transport): this {
    this.config.transport = transport
    return this
  }

  /**
   * Set session ID
   */
  withSessionId(sessionId: SessionId): this {
    this.config.sessionId = sessionId
    return this
  }

  /**
   * Enable/disable auto-reconnect
   */
  withAutoReconnect(enabled: boolean, queueSize?: number): this {
    this.config.autoReconnect = enabled
    if (queueSize !== undefined) {
      this.config.messageQueueSize = queueSize
    }
    return this
  }

  /**
   * Set protocol configuration
   */
  withProtocolConfig(config: Partial<ProtocolConfig>): this {
    Object.assign(this.config, config)
    return this
  }

  /**
   * Build protocol client
   */
  build(): ProtocolClient {
    if (!this.config.transport) {
      throw new Error('Transport is required')
    }

    const fullConfig = this.config as ProtocolClientConfig

    if (this.protocolType === 'mcp') {
      if (!this.mcpName || !this.mcpVersion) {
        throw new Error('MCP name and version are required')
      }
      return createMcpClient(this.mcpName, this.mcpVersion, fullConfig)
    }

    return createJsonRpcClient(fullConfig)
  }
}