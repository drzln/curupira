/**
 * @fileoverview Core MCP server implementation
 * 
 * This file provides the main server class that integrates transport,
 * protocol, and health check functionality into a complete MCP server.
 */

import { EventEmitter } from 'events'
import * as http from 'http'
import * as https from 'https'
import { AddressInfo } from 'net'
import type {
  Server as ServerInterface,
  ServerConfig,
  ServerState,
  ServerStats,
  ServerEvent,
  ServerHooks,
  ServerPlugin,
  ConnectionInfo,
  HealthCheckResult,
  HealthCheck,
  HealthStatus,
  ShutdownOptions,
  ServerMiddleware,
  RequestContext
} from './types.js'
import {
  createTransport,
  TransportManager,
  type Transport,
  type TransportEvent
} from '@curupira/shared/transport'
import {
  McpProtocol,
  McpServerBuilder,
  ProtocolClient,
  ProtocolClientBuilder
} from '@curupira/shared/protocol'
import {
  createSessionId,
  createTimestamp,
  type SessionId,
  type Timestamp
} from '@curupira/shared/types'
import { 
  createLogger,
  type Logger,
  initializeTelemetry,
  type TelemetryCollector
} from '@curupira/shared/logging'
import { InternalErrors } from '@curupira/shared/errors'
import { loadConfig } from '@curupira/shared/config'

/**
 * Default server configuration
 */
const DEFAULT_CONFIG: Partial<ServerConfig> = {
  host: '0.0.0.0',
  port: 8000,
  healthCheck: true,
  healthCheckPath: '/health',
  healthCheckInterval: 30000,
  shutdownTimeout: 30000,
  environment: 'development',
  logLevel: 'info'
}

/**
 * Core MCP server implementation
 */
export class CurupiraServer extends EventEmitter implements ServerInterface {
  private _state: ServerState = 'stopped'
  private readonly logger: Logger
  private readonly telemetry: TelemetryCollector
  private readonly transportManager = new TransportManager()
  private readonly protocols = new Map<SessionId, ProtocolClient>()
  private readonly _connections = new Map<SessionId, ConnectionInfo>()
  private readonly plugins: ServerPlugin[] = []
  private readonly middlewares: ServerMiddleware[] = []
  private readonly healthChecks = new Map<string, () => Promise<HealthCheck> | HealthCheck>()
  private hooks: ServerHooks = {}
  private httpServer?: http.Server | https.Server
  private healthCheckTimer?: NodeJS.Timeout
  private startTime?: Timestamp
  private _stats: ServerStats

  public readonly config: ServerConfig

  constructor(config: Partial<ServerConfig> = {}) {
    super()
    
    // Merge with defaults
    this.config = { 
      ...DEFAULT_CONFIG, 
      ...config,
      name: config.name || 'curupira-mcp-server',
      version: config.version || '1.0.0'
    } as ServerConfig

    // Initialize logger
    this.logger = createLogger({
      level: this.config.logLevel,
      name: this.config.name
    })

    // Initialize telemetry
    this.telemetry = initializeTelemetry({
      serviceName: this.config.name,
      serviceVersion: this.config.version,
      environment: this.config.environment,
      enableMetrics: true,
      enableTracing: true
    })

    // Initialize stats
    this._stats = this.createInitialStats()

    // Register core health checks
    this.registerCoreHealthChecks()

    this.logger.info({ config: this.config }, 'Server initialized')
  }

  /**
   * Get current server state
   */
  get state(): ServerState {
    return this._state
  }

  /**
   * Get server statistics
   */
  get stats(): ServerStats {
    return {
      ...this._stats,
      activeConnections: this._connections.size,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage().user / 1000000 // Convert to seconds
    }
  }

  /**
   * Get active connections
   */
  get connections(): Map<SessionId, ConnectionInfo> {
    return new Map(this._connections)
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    if (this._state === 'running') {
      this.logger.warn('Server already running')
      return
    }

    if (this._state === 'starting') {
      this.logger.warn('Server already starting')
      return
    }

    this.updateState('starting')
    this.startTime = createTimestamp()

    try {
      // Call beforeStart hook
      await this.hooks.beforeStart?.()

      // Initialize plugins
      await this.initializePlugins()

      // Create HTTP server if needed
      if (this.config.healthCheck || this.config.transports?.http) {
        await this.createHttpServer()
      }

      // Create transports
      await this.createTransports()

      // Start health check timer
      if (this.config.healthCheck) {
        this.startHealthCheckTimer()
      }

      this.updateState('running')
      this._stats.startTime = this.startTime

      // Call afterStart hook
      await this.hooks.afterStart?.()

      this.emitEvent({
        type: 'started',
        timestamp: createTimestamp()
      })

      this.logger.info(
        { 
          host: this.config.host, 
          port: this.config.port,
          transports: Object.keys(this.config.transports || {})
        },
        'Server started'
      )

    } catch (error) {
      this.updateState('error')
      this.logger.error({ error }, 'Failed to start server')
      
      const curupiraError = error instanceof Error 
        ? error 
        : InternalErrors.unexpected('Server start failed')

      this.emitEvent({
        type: 'error',
        timestamp: createTimestamp(),
        error: curupiraError
      })

      // Cleanup
      await this.cleanup()
      
      throw curupiraError
    }
  }

  /**
   * Stop the server
   */
  async stop(reason?: string): Promise<void> {
    if (this._state === 'stopped') {
      this.logger.warn('Server already stopped')
      return
    }

    if (this._state === 'stopping') {
      this.logger.warn('Server already stopping')
      return
    }

    this.updateState('stopping')

    try {
      // Call beforeStop hook
      await this.hooks.beforeStop?.()

      // Stop health check timer
      this.stopHealthCheckTimer()

      // Gracefully shutdown connections
      await this.shutdownConnections(reason)

      // Stop HTTP server
      if (this.httpServer) {
        await this.stopHttpServer()
      }

      // Stop transports
      await this.transportManager.disconnectAll(reason)
      await this.transportManager.clear()

      // Stop plugins
      await this.stopPlugins()

      this.updateState('stopped')

      // Call afterStop hook
      await this.hooks.afterStop?.()

      this.emitEvent({
        type: 'stopped',
        timestamp: createTimestamp(),
        reason
      })

      this.logger.info({ reason }, 'Server stopped')

    } catch (error) {
      this.logger.error({ error }, 'Error during server shutdown')
      throw error
    }
  }

  /**
   * Restart the server
   */
  async restart(): Promise<void> {
    this.logger.info('Restarting server')
    await this.stop('Restart')
    await this.start()
  }

  /**
   * Get health check result
   */
  async getHealth(): Promise<HealthCheckResult> {
    const checks: HealthCheck[] = []
    const startTime = Date.now()

    // Run all health checks in parallel
    const checkPromises = Array.from(this.healthChecks.entries()).map(
      async ([name, checkFn]) => {
        const checkStart = Date.now()
        try {
          const result = await checkFn()
          return {
            ...result,
            name,
            duration: Date.now() - checkStart
          }
        } catch (error) {
          return {
            name,
            status: 'unhealthy' as HealthStatus,
            message: error instanceof Error ? error.message : 'Check failed',
            duration: Date.now() - checkStart
          }
        }
      }
    )

    checks.push(...await Promise.all(checkPromises))

    // Determine overall status
    const hasUnhealthy = checks.some(c => c.status === 'unhealthy')
    const hasDegraded = checks.some(c => c.status === 'degraded')
    
    const status: HealthStatus = hasUnhealthy 
      ? 'unhealthy' 
      : hasDegraded 
        ? 'degraded' 
        : 'healthy'

    const result: HealthCheckResult = {
      status,
      timestamp: createTimestamp(),
      version: this.config.version,
      uptime: this.startTime ? Date.now() - this.startTime : 0,
      checks,
      metadata: {
        serverName: this.config.name,
        environment: this.config.environment,
        checkDuration: Date.now() - startTime
      }
    }

    this.emitEvent({
      type: 'health_check',
      timestamp: createTimestamp(),
      result
    })

    return result
  }

  /**
   * Register a plugin
   */
  use(plugin: ServerPlugin): void {
    this.plugins.push(plugin)
    this.logger.debug({ plugin: plugin.name }, 'Registered plugin')
  }

  /**
   * Set lifecycle hooks
   */
  setHooks(hooks: ServerHooks): void {
    this.hooks = { ...this.hooks, ...hooks }
  }

  /**
   * Add middleware
   */
  addMiddleware(middleware: ServerMiddleware): void {
    this.middlewares.push(middleware)
    this.logger.debug({ middleware: middleware.name }, 'Added middleware')
  }

  /**
   * Register health check
   */
  registerHealthCheck(
    name: string, 
    check: () => Promise<HealthCheck> | HealthCheck
  ): void {
    this.healthChecks.set(name, check)
    this.logger.debug({ check: name }, 'Registered health check')
  }

  /**
   * Emit server event
   */
  emit(event: ServerEvent): boolean {
    return super.emit(event.type, event)
  }

  /**
   * Update server state
   */
  private updateState(newState: ServerState): void {
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
   * Emit server event
   */
  private emitEvent(event: ServerEvent): void {
    this.emit(event)
  }

  /**
   * Create initial stats
   */
  private createInitialStats(): ServerStats {
    return {
      startTime: 0 as Timestamp,
      totalConnections: 0,
      activeConnections: 0,
      totalRequests: 0,
      totalErrors: 0,
      memoryUsage: process.memoryUsage(),
      cpuUsage: 0
    }
  }

  /**
   * Register core health checks
   */
  private registerCoreHealthChecks(): void {
    // Server health check
    this.registerHealthCheck('server', async () => ({
      name: 'server',
      status: this._state === 'running' ? 'healthy' : 'unhealthy',
      message: `Server is ${this._state}`,
      details: {
        state: this._state,
        uptime: this.startTime ? Date.now() - this.startTime : 0
      }
    }))

    // Memory health check
    this.registerHealthCheck('memory', async () => {
      const usage = process.memoryUsage()
      const heapUsedPercent = (usage.heapUsed / usage.heapTotal) * 100
      
      return {
        name: 'memory',
        status: heapUsedPercent > 90 ? 'unhealthy' : heapUsedPercent > 70 ? 'degraded' : 'healthy',
        message: `Heap usage: ${heapUsedPercent.toFixed(1)}%`,
        details: {
          heapUsed: usage.heapUsed,
          heapTotal: usage.heapTotal,
          rss: usage.rss,
          external: usage.external
        }
      }
    })

    // Transport health check
    this.registerHealthCheck('transports', async () => {
      const transports = this.transportManager.all()
      const connected = transports.filter(t => t.isConnected()).length
      
      return {
        name: 'transports',
        status: connected === transports.length ? 'healthy' : connected > 0 ? 'degraded' : 'unhealthy',
        message: `${connected}/${transports.length} transports connected`,
        details: {
          total: transports.length,
          connected
        }
      }
    })
  }

  /**
   * Initialize plugins
   */
  private async initializePlugins(): Promise<void> {
    for (const plugin of this.plugins) {
      try {
        this.logger.debug({ plugin: plugin.name }, 'Initializing plugin')
        await plugin.initialize?.(this)
        
        // Register plugin health check if available
        if (plugin.healthCheck) {
          this.registerHealthCheck(
            `plugin:${plugin.name}`,
            plugin.healthCheck.bind(plugin)
          )
        }
      } catch (error) {
        this.logger.error(
          { error, plugin: plugin.name },
          'Failed to initialize plugin'
        )
        throw error
      }
    }

    // Start plugins
    for (const plugin of this.plugins) {
      if (plugin.start) {
        await plugin.start()
      }
    }
  }

  /**
   * Stop plugins
   */
  private async stopPlugins(): Promise<void> {
    // Stop in reverse order
    const reversed = [...this.plugins].reverse()
    
    for (const plugin of reversed) {
      if (plugin.stop) {
        try {
          await plugin.stop()
        } catch (error) {
          this.logger.error(
            { error, plugin: plugin.name },
            'Error stopping plugin'
          )
        }
      }
    }
  }

  /**
   * Create HTTP server
   */
  private async createHttpServer(): Promise<void> {
    const requestHandler = this.createRequestHandler()

    if (this.config.ssl) {
      this.httpServer = https.createServer(
        this.config.ssl,
        requestHandler
      )
    } else {
      this.httpServer = http.createServer(requestHandler)
    }

    return new Promise((resolve, reject) => {
      this.httpServer!.on('error', reject)
      
      this.httpServer!.listen(
        this.config.port,
        this.config.host,
        () => {
          const address = this.httpServer!.address() as AddressInfo
          this.logger.info(
            { host: address.address, port: address.port },
            'HTTP server listening'
          )
          resolve()
        }
      )
    })
  }

  /**
   * Create HTTP request handler
   */
  private createRequestHandler(): http.RequestListener {
    return async (req, res) => {
      // Health check endpoint
      if (req.url === this.config.healthCheckPath && req.method === 'GET') {
        try {
          const health = await this.getHealth()
          
          res.writeHead(health.status === 'healthy' ? 200 : 503, {
            'Content-Type': 'application/json'
          })
          res.end(JSON.stringify(health, null, 2))
        } catch (error) {
          res.writeHead(500)
          res.end('Health check failed')
        }
        return
      }

      // Other endpoints can be added here
      res.writeHead(404)
      res.end('Not found')
    }
  }

  /**
   * Stop HTTP server
   */
  private async stopHttpServer(): Promise<void> {
    if (!this.httpServer) return

    return new Promise((resolve, reject) => {
      this.httpServer!.close((error) => {
        if (error) {
          reject(error)
        } else {
          this.httpServer = undefined
          resolve()
        }
      })

      // Force close after timeout
      setTimeout(() => {
        this.httpServer?.closeAllConnections?.()
        resolve()
      }, 5000)
    })
  }

  /**
   * Create transports
   */
  private async createTransports(): Promise<void> {
    const transports = this.config.transports || {}

    // Create WebSocket transport
    if (transports.websocket) {
      const wsConfig = {
        type: 'websocket' as const,
        url: `ws://${this.config.host}:${this.config.port}/mcp`,
        ...transports.websocket
      }

      const wsTransport = await this.transportManager.add('websocket', wsConfig)
      this.setupTransportHandlers(wsTransport)
      await wsTransport.connect()
    }

    // Create HTTP transport
    if (transports.http) {
      const httpConfig = {
        type: 'http' as const,
        baseUrl: `http://${this.config.host}:${this.config.port}`,
        ...transports.http
      }

      const httpTransport = await this.transportManager.add('http', httpConfig)
      this.setupTransportHandlers(httpTransport)
      await httpTransport.connect()
    }
  }

  /**
   * Setup transport event handlers
   */
  private setupTransportHandlers(transport: Transport): void {
    transport.on('connected', () => {
      this.logger.info({ transport: transport.config.type }, 'Transport connected')
    })

    transport.on('error', (event: TransportEvent) => {
      if (event.type === 'error') {
        this._stats.totalErrors++
        this.logger.error(
          { error: event.error, transport: transport.config.type },
          'Transport error'
        )
      }
    })

    // Handle new connections
    transport.onMessage(async (message) => {
      const sessionId = message.metadata?.sessionId as SessionId
      
      if (!sessionId) {
        this.logger.warn('Received message without session ID')
        return
      }

      // Create protocol client for new session
      if (!this.protocols.has(sessionId)) {
        await this.createProtocolClient(sessionId, transport)
      }
    })
  }

  /**
   * Create protocol client for session
   */
  private async createProtocolClient(
    sessionId: SessionId,
    transport: Transport
  ): Promise<void> {
    const connectionInfo: ConnectionInfo = {
      sessionId,
      transport: transport.config.type as 'websocket' | 'http',
      connectedAt: createTimestamp(),
      metadata: {}
    }

    // Create MCP protocol
    const protocol = new McpServerBuilder(this.config.name, this.config.version)
      .withCapabilities(this.config.mcp?.capabilities || {})
      .withProtocolConfig(this.config.mcp || {})
      .build()

    // Create protocol client
    const client = new ProtocolClientBuilder()
      .useMcp(this.config.name, this.config.version)
      .withTransport(transport)
      .withSessionId(sessionId)
      .withAutoReconnect(true)
      .build()

    // Track connection
    this._connections.set(sessionId, connectionInfo)
    this.protocols.set(sessionId, client)
    this._stats.totalConnections++

    // Call connection hook
    await this.hooks.onConnection?.(connectionInfo)

    this.emitEvent({
      type: 'connection',
      timestamp: createTimestamp(),
      sessionId
    })

    // Handle disconnection
    client.on('disconnected', async () => {
      this._connections.delete(sessionId)
      this.protocols.delete(sessionId)
      
      await this.hooks.onDisconnection?.(connectionInfo, 'Transport disconnected')

      this.emitEvent({
        type: 'disconnection',
        timestamp: createTimestamp(),
        sessionId,
        reason: 'Transport disconnected'
      })
    })

    // Connect client
    await client.connect()
  }

  /**
   * Shutdown connections gracefully
   */
  private async shutdownConnections(reason?: string): Promise<void> {
    const shutdownPromises: Promise<void>[] = []

    for (const [sessionId, client] of this.protocols) {
      shutdownPromises.push(
        client.disconnect(reason || 'Server shutting down')
          .catch(error => {
            this.logger.error(
              { error, sessionId },
              'Error disconnecting client'
            )
          })
      )
    }

    await Promise.all(shutdownPromises)
    
    this._connections.clear()
    this.protocols.clear()
  }

  /**
   * Start health check timer
   */
  private startHealthCheckTimer(): void {
    if (!this.config.healthCheckInterval) return

    this.healthCheckTimer = setInterval(async () => {
      try {
        await this.getHealth()
      } catch (error) {
        this.logger.error({ error }, 'Health check failed')
      }
    }, this.config.healthCheckInterval)
  }

  /**
   * Stop health check timer
   */
  private stopHealthCheckTimer(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
      this.healthCheckTimer = undefined
    }
  }

  /**
   * Cleanup resources
   */
  private async cleanup(): Promise<void> {
    this.stopHealthCheckTimer()
    await this.transportManager.clear()
    await this.stopHttpServer()
    this._connections.clear()
    this.protocols.clear()
  }
}

/**
 * Create MCP server instance
 */
export function createServer(config?: Partial<ServerConfig>): CurupiraServer {
  return new CurupiraServer(config)
}