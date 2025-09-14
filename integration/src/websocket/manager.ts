/**
 * @fileoverview WebSocket connection manager
 * 
 * This file provides a high-level WebSocket connection manager with
 * connection pooling, auto-reconnection, message routing, and health checks.
 */

import { EventEmitter } from 'eventemitter3'
import { v4 as uuidv4 } from 'uuid'
import PQueue from 'p-queue'
import type {
  WebSocketConnectionConfig,
  WebSocketConnection,
  WebSocketManagerConfig,
  WebSocketManagerEvents,
  PoolStatistics,
  MessageRoutingConfig,
  ConnectionSelectionStrategy,
  MessageHandler,
  ConnectionFilter,
  HealthCheckFunction,
  ConnectionLifecycleHooks
} from './types.js'
import {
  createWebSocketTransport,
  type TransportMessage,
  type TransportEvent,
  NetworkErrors,
  InternalErrors,
  createLogger,
  type Logger
} from '@curupira/shared'

/**
 * Default manager configuration
 */
const DEFAULT_CONFIG: WebSocketManagerConfig = {
  maxConnections: 10,
  defaultTimeout: 30000,
  defaultReconnect: {
    enabled: true,
    maxAttempts: 5,
    delay: 1000,
    maxDelay: 30000,
    backoffFactor: 2
  },
  messageQueue: {
    enabled: true,
    maxSize: 1000,
    ttl: 300000 // 5 minutes
  },
  healthCheck: {
    enabled: true,
    interval: 30000,
    timeout: 5000
  },
  pooling: {
    enabled: true,
    minConnections: 1,
    maxIdleTime: 300000 // 5 minutes
  }
}

/**
 * WebSocket connection manager
 */
export class WebSocketManager extends EventEmitter<WebSocketManagerEvents> {
  private readonly config: WebSocketManagerConfig
  private readonly connections = new Map<string, WebSocketConnection>()
  private readonly messageHandlers = new Set<MessageHandler>()
  private readonly logger: Logger
  private readonly queue: PQueue
  private readonly startTime = Date.now()
  private healthCheckInterval?: NodeJS.Timeout
  private poolMaintenanceInterval?: NodeJS.Timeout
  private roundRobinIndex = 0
  private lifecycleHooks: ConnectionLifecycleHooks = {}
  private stats = {
    messagesSent: 0,
    messagesReceived: 0,
    totalLatency: 0,
    latencyCount: 0
  }

  constructor(config: Partial<WebSocketManagerConfig> = {}) {
    super()
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.logger = createLogger({ level: 'info' })
    this.queue = new PQueue({ concurrency: this.config.maxConnections })

    // Start health checks
    if (this.config.healthCheck.enabled) {
      this.startHealthChecks()
    }

    // Start pool maintenance
    if (this.config.pooling.enabled) {
      this.startPoolMaintenance()
    }
  }

  /**
   * Set lifecycle hooks
   */
  setLifecycleHooks(hooks: ConnectionLifecycleHooks): void {
    this.lifecycleHooks = hooks
  }

  /**
   * Add a connection
   */
  async addConnection(config: WebSocketConnectionConfig): Promise<WebSocketConnection> {
    if (this.connections.size >= this.config.maxConnections) {
      throw InternalErrors.resourceExhausted(
        `Maximum connections (${this.config.maxConnections}) reached`
      )
    }

    // Call before connect hook
    if (this.lifecycleHooks.beforeConnect) {
      await this.lifecycleHooks.beforeConnect(config)
    }

    const id = config.id || uuidv4()
    
    // Create transport
    const transport = createWebSocketTransport({
      url: config.url,
      protocols: config.protocols,
      headers: config.headers,
      autoReconnect: config.autoReconnect ?? this.config.defaultReconnect.enabled,
      maxReconnectAttempts: config.maxReconnectAttempts ?? this.config.defaultReconnect.maxAttempts,
      reconnectDelay: config.reconnectDelay ?? this.config.defaultReconnect.delay,
      connectionTimeout: config.connectionTimeout ?? this.config.defaultTimeout,
      keepAlive: config.keepAlive,
      keepAliveInterval: config.keepAliveInterval,
      maxMessageSize: 10 * 1024 * 1024 // 10MB
    })

    // Create connection object
    const connection: WebSocketConnection = {
      id,
      transport,
      config,
      state: 'connecting',
      lastActivity: Date.now(),
      messageQueue: [],
      events: new EventEmitter()
    }

    // Set up transport event handlers
    this.setupTransportHandlers(connection)

    // Add to connections
    this.connections.set(id, connection)
    this.emit('connection:added', connection)

    // Connect
    try {
      await transport.connect()
      connection.state = 'connected'
      connection.info = transport.connectionInfo
      connection.lastActivity = Date.now()
      
      // Call after connect hook
      if (this.lifecycleHooks.afterConnect) {
        await this.lifecycleHooks.afterConnect(connection)
      }

      this.emit('connection:state', id, 'connected')
      
      // Process queued messages
      await this.processMessageQueue(connection)
      
      return connection
    } catch (error) {
      connection.state = 'error'
      this.emit('connection:state', id, 'error')
      
      // Call error hook
      if (this.lifecycleHooks.onError) {
        await this.lifecycleHooks.onError(error as Error, connection)
      }
      
      throw error
    }
  }

  /**
   * Remove a connection
   */
  async removeConnection(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId)
    if (!connection) {
      return
    }

    // Call before disconnect hook
    if (this.lifecycleHooks.beforeDisconnect) {
      await this.lifecycleHooks.beforeDisconnect(connection)
    }

    // Disconnect transport
    try {
      await connection.transport.disconnect('Connection removed')
    } catch (error) {
      this.logger.error({ error, connectionId }, 'Error disconnecting transport')
    }

    // Remove from connections
    this.connections.delete(connectionId)
    this.emit('connection:removed', connectionId)

    // Call after disconnect hook
    if (this.lifecycleHooks.afterDisconnect) {
      await this.lifecycleHooks.afterDisconnect(connectionId)
    }
  }

  /**
   * Get a connection by ID
   */
  getConnection(connectionId: string): WebSocketConnection | undefined {
    return this.connections.get(connectionId)
  }

  /**
   * Get all connections
   */
  getAllConnections(): WebSocketConnection[] {
    return Array.from(this.connections.values())
  }

  /**
   * Get connections by filter
   */
  getConnectionsByFilter(filter: ConnectionFilter): WebSocketConnection[] {
    return this.getAllConnections().filter(filter)
  }

  /**
   * Select a connection using strategy
   */
  selectConnection(
    strategy: ConnectionSelectionStrategy = 'round-robin',
    filter?: ConnectionFilter
  ): WebSocketConnection | null {
    const connections = filter 
      ? this.getConnectionsByFilter(filter)
      : this.getAllConnections().filter(c => c.state === 'connected')

    if (connections.length === 0) {
      return null
    }

    if (typeof strategy === 'function') {
      return strategy(connections)
    }

    switch (strategy) {
      case 'round-robin':
        const connection = connections[this.roundRobinIndex % connections.length]
        this.roundRobinIndex++
        return connection

      case 'least-loaded':
        return connections.reduce((least, current) => 
          current.messageQueue.length < least.messageQueue.length ? current : least
        )

      case 'random':
        return connections[Math.floor(Math.random() * connections.length)]

      case 'first-available':
      default:
        return connections[0]
    }
  }

  /**
   * Send a message
   */
  async send(
    message: TransportMessage,
    routing?: MessageRoutingConfig
  ): Promise<void> {
    // Determine target connections
    let connections: WebSocketConnection[]

    if (routing?.connectionId) {
      const connection = this.getConnection(routing.connectionId)
      connections = connection ? [connection] : []
    } else if (routing?.broadcast) {
      connections = this.getAllConnections().filter(c => c.state === 'connected')
    } else if (routing?.predicate) {
      connections = this.getAllConnections().filter(c => 
        c.state === 'connected' && routing.predicate!(message)
      )
    } else {
      // Use selection strategy
      const connection = this.selectConnection(
        routing?.roundRobin ? 'round-robin' : 'first-available'
      )
      connections = connection ? [connection] : []
    }

    if (connections.length === 0) {
      throw NetworkErrors.notConnected('No available connections for message')
    }

    // Send to selected connections
    const sendPromises = connections.map(async connection => {
      try {
        if (connection.state === 'connected') {
          const startTime = Date.now()
          await connection.transport.send(message)
          
          // Update stats
          this.stats.messagesSent++
          this.stats.totalLatency += Date.now() - startTime
          this.stats.latencyCount++
          
          connection.lastActivity = Date.now()
          this.emit('message:sent', connection.id, message)
        } else if (this.config.messageQueue.enabled) {
          // Queue message
          this.queueMessage(connection, message)
        }
      } catch (error) {
        this.logger.error({ error, connectionId: connection.id }, 'Failed to send message')
        throw error
      }
    })

    await Promise.all(sendPromises)
  }

  /**
   * Add a message handler
   */
  addMessageHandler(handler: MessageHandler): void {
    this.messageHandlers.add(handler)
  }

  /**
   * Remove a message handler
   */
  removeMessageHandler(handler: MessageHandler): void {
    this.messageHandlers.delete(handler)
  }

  /**
   * Get pool statistics
   */
  getPoolStatistics(): PoolStatistics {
    const connections = this.getAllConnections()
    
    return {
      total: connections.length,
      active: connections.filter(c => c.state === 'connected').length,
      idle: connections.filter(c => 
        c.state === 'connected' && 
        Date.now() - c.lastActivity > 60000
      ).length,
      failed: connections.filter(c => c.state === 'error').length,
      messagesSent: this.stats.messagesSent,
      messagesReceived: this.stats.messagesReceived,
      averageLatency: this.stats.latencyCount > 0 
        ? this.stats.totalLatency / this.stats.latencyCount 
        : 0,
      uptime: Date.now() - this.startTime
    }
  }

  /**
   * Perform health check
   */
  async healthCheck(
    connectionId?: string,
    checkFunction?: HealthCheckFunction
  ): Promise<boolean> {
    const connections = connectionId 
      ? [this.getConnection(connectionId)].filter(Boolean) as WebSocketConnection[]
      : this.getAllConnections()

    const results = await Promise.all(
      connections.map(async connection => {
        try {
          if (checkFunction) {
            return await checkFunction(connection)
          }
          
          // Default health check - send ping
          if (connection.state === 'connected') {
            const health = await connection.transport.getHealth()
            return health.status === 'healthy'
          }
          
          return false
        } catch {
          return false
        }
      })
    )

    return results.every(result => result)
  }

  /**
   * Close all connections
   */
  async closeAll(): Promise<void> {
    const connections = this.getAllConnections()
    
    await Promise.all(
      connections.map(connection => 
        this.removeConnection(connection.id)
      )
    )
  }

  /**
   * Destroy the manager
   */
  async destroy(): Promise<void> {
    // Stop intervals
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
    }
    if (this.poolMaintenanceInterval) {
      clearInterval(this.poolMaintenanceInterval)
    }

    // Close all connections
    await this.closeAll()

    // Clear handlers
    this.messageHandlers.clear()
    this.removeAllListeners()
  }

  /**
   * Set up transport event handlers
   */
  private setupTransportHandlers(connection: WebSocketConnection): void {
    const { transport } = connection

    // Connection events
    transport.on('connected', () => {
      connection.state = 'connected'
      connection.info = transport.connectionInfo
      connection.lastActivity = Date.now()
      this.emit('connection:state', connection.id, 'connected')
    })

    transport.on('disconnected', (event: TransportEvent) => {
      connection.state = 'disconnected'
      this.emit('connection:state', connection.id, 'disconnected')
    })

    transport.on('error', (event: TransportEvent) => {
      if (event.type === 'error' && event.error) {
        connection.state = 'error'
        this.emit('error', event.error, connection.id)
        
        if (this.lifecycleHooks.onError) {
          this.lifecycleHooks.onError(event.error, connection)
        }
      }
    })

    // Message handling
    transport.onMessage(async (message: TransportMessage) => {
      connection.lastActivity = Date.now()
      this.stats.messagesReceived++
      
      this.emit('message:received', connection.id, message)
      
      // Call all handlers
      for (const handler of this.messageHandlers) {
        try {
          await handler(message, connection)
        } catch (error) {
          this.logger.error({ error, connectionId: connection.id }, 'Message handler error')
        }
      }
    })
  }

  /**
   * Queue a message
   */
  private queueMessage(connection: WebSocketConnection, message: TransportMessage): void {
    if (connection.messageQueue.length >= this.config.messageQueue.maxSize) {
      // Remove oldest message
      connection.messageQueue.shift()
    }
    
    connection.messageQueue.push(message)
  }

  /**
   * Process message queue
   */
  private async processMessageQueue(connection: WebSocketConnection): Promise<void> {
    if (connection.messageQueue.length === 0) {
      return
    }

    const messages = [...connection.messageQueue]
    connection.messageQueue.length = 0

    for (const message of messages) {
      try {
        // Check message TTL
        const age = Date.now() - message.timestamp
        if (age < this.config.messageQueue.ttl) {
          await connection.transport.send(message)
          this.emit('message:sent', connection.id, message)
        }
      } catch (error) {
        this.logger.error({ error, connectionId: connection.id }, 'Failed to send queued message')
      }
    }
  }

  /**
   * Start health checks
   */
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      const connections = this.getAllConnections()
      
      for (const connection of connections) {
        if (connection.state === 'connected') {
          const healthy = await this.healthCheck(connection.id)
          
          if (!healthy) {
            this.logger.warn({ connectionId: connection.id }, 'Connection failed health check')
            connection.state = 'error'
            this.emit('connection:state', connection.id, 'error')
          }
        }
      }
      
      // Emit pool statistics
      this.emit('pool:stats', this.getPoolStatistics())
    }, this.config.healthCheck.interval)
  }

  /**
   * Start pool maintenance
   */
  private startPoolMaintenance(): void {
    this.poolMaintenanceInterval = setInterval(() => {
      const now = Date.now()
      const connections = this.getAllConnections()
      
      // Remove idle connections
      for (const connection of connections) {
        if (
          connection.state === 'connected' &&
          connections.length > this.config.pooling.minConnections &&
          now - connection.lastActivity > this.config.pooling.maxIdleTime
        ) {
          this.logger.info({ connectionId: connection.id }, 'Removing idle connection')
          this.removeConnection(connection.id)
        }
      }
    }, 60000) // Every minute
  }
}

/**
 * Create WebSocket manager
 */
export function createWebSocketManager(
  config?: Partial<WebSocketManagerConfig>
): WebSocketManager {
  return new WebSocketManager(config)
}