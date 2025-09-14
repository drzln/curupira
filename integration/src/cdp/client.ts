/**
 * @fileoverview Chrome DevTools Protocol client
 * 
 * This file provides a high-level client for interacting with
 * Chrome DevTools Protocol, managing connections, sessions, and commands.
 */

import { EventEmitter } from 'eventemitter3'
import CDP from 'chrome-remote-interface'
import type {
  CdpClientConfig,
  CdpClientEvents,
  CdpConnectionConfig,
  CdpTargetInfo,
  CdpSessionInfo,
  CdpCommand,
  CdpResult,
  CdpEvent,
  CdpError,
  CdpDomainRegistry
} from './types.js'
import {
  createLogger,
  type Logger,
  type SessionId,
  type Timestamp,
  createSessionId,
  ProtocolErrors,
  NetworkErrors
} from '@curupira/shared'
import { CdpDomainRegistryImpl } from './domains/registry.js'
import { CdpSession } from './session.js'

/**
 * CDP client implementation
 */
export class CdpClient extends EventEmitter<CdpClientEvents> {
  private readonly config: CdpClientConfig
  private readonly logger: Logger
  private readonly domains: CdpDomainRegistry
  private readonly sessions = new Map<SessionId, CdpSession>()
  private readonly eventBuffer: CdpEvent[] = []
  private client?: CDP.Client
  private connectionState: CdpSessionInfo['state'] = 'disconnected'
  private reconnectTimer?: NodeJS.Timeout
  private reconnectAttempts = 0

  constructor(config: CdpClientConfig) {
    super()
    this.config = {
      eventBufferSize: 1000,
      commandTimeout: 30000,
      retry: {
        enabled: true,
        maxAttempts: 3,
        delay: 1000,
        backoffFactor: 2
      },
      ...config
    }
    this.logger = createLogger({ 
      level: config.connection.verbose ? 'debug' : 'info' 
    })
    this.domains = new CdpDomainRegistryImpl(this)
  }

  /**
   * Connect to Chrome
   */
  async connect(): Promise<void> {
    if (this.connectionState === 'connected') {
      return
    }

    this.setConnectionState('connecting')

    try {
      const options: CDP.Options = {
        host: this.config.connection.host || 'localhost',
        port: this.config.connection.port || 9222,
        secure: this.config.connection.secure || false,
        target: this.config.connection.target
      }

      this.client = await CDP(options)
      this.setupEventHandlers()
      
      // Enable auto-attach if configured
      if (this.config.connection.autoAttach) {
        await this.send({
          method: 'Target.setAutoAttach',
          params: {
            autoAttach: true,
            waitForDebuggerOnStart: false,
            flatten: this.config.connection.flattenSessions
          }
        })
      }

      // Enable preload domains
      if (this.config.domains?.preload) {
        await this.domains.enableDomains(this.config.domains.preload)
      }

      this.setConnectionState('connected')
      this.reconnectAttempts = 0
      
      this.logger.info({ options }, 'Connected to Chrome DevTools Protocol')
    } catch (error) {
      this.setConnectionState('error')
      this.logger.error({ error }, 'Failed to connect to Chrome')
      
      if (this.config.retry?.enabled && 
          this.reconnectAttempts < this.config.retry.maxAttempts) {
        await this.scheduleReconnect()
      } else {
        throw NetworkErrors.connectionFailed(
          `Chrome DevTools at ${this.config.connection.host}:${this.config.connection.port}`,
          error instanceof Error ? error.message : String(error)
        )
      }
    }
  }

  /**
   * Disconnect from Chrome
   */
  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = undefined
    }

    if (this.client) {
      try {
        await this.client.close()
      } catch (error) {
        this.logger.error({ error }, 'Error closing CDP client')
      }
      this.client = undefined
    }

    // Clean up sessions
    for (const session of this.sessions.values()) {
      await session.destroy()
    }
    this.sessions.clear()

    this.setConnectionState('disconnected')
    this.logger.info('Disconnected from Chrome DevTools Protocol')
  }

  /**
   * Send a command
   */
  async send<TParams = unknown, TResult = unknown>(
    command: CdpCommand<string, TParams>
  ): Promise<CdpResult<TResult>> {
    if (!this.client) {
      throw NetworkErrors.notConnected('CDP client not connected')
    }

    const startTime = Date.now()
    
    try {
      // Route to session if specified
      if (command.sessionId) {
        const session = this.sessions.get(command.sessionId)
        if (!session) {
          throw ProtocolErrors.invalidSession(command.sessionId)
        }
        return await session.send(command)
      }

      // Send to main connection
      const result = await this.client.send(
        command.method,
        command.params,
        command.sessionId
      )

      const duration = Date.now() - startTime
      this.logger.debug({ command, result, duration }, 'Command executed')

      return { result: result as TResult }
    } catch (error) {
      const duration = Date.now() - startTime
      this.logger.error({ command, error, duration }, 'Command failed')

      if (this.isCdpError(error)) {
        return { error: error as CdpError }
      }

      throw ProtocolErrors.commandFailed(
        command.method,
        error instanceof Error ? error.message : String(error)
      )
    }
  }

  /**
   * Create a new session
   */
  async createSession(targetId: string): Promise<CdpSession> {
    const result = await this.send<{ sessionId: string }>({
      method: 'Target.attachToTarget',
      params: { targetId, flatten: this.config.connection.flattenSessions }
    })

    if (!result.result?.sessionId) {
      throw ProtocolErrors.commandFailed(
        'Target.attachToTarget',
        'No session ID returned'
      )
    }

    const sessionId = createSessionId(result.result.sessionId)
    const session = new CdpSession(
      sessionId,
      this,
      { targetId } as CdpTargetInfo
    )

    this.sessions.set(sessionId, session)
    
    const sessionInfo: CdpSessionInfo = {
      sessionId,
      target: session.getTargetInfo(),
      state: 'connected',
      created: Date.now() as Timestamp,
      lastActivity: Date.now() as Timestamp,
      domains: new Set()
    }

    this.emit('session:created', sessionInfo)
    
    return session
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: SessionId): CdpSession | undefined {
    return this.sessions.get(sessionId)
  }

  /**
   * Get all sessions
   */
  getAllSessions(): CdpSession[] {
    return Array.from(this.sessions.values())
  }

  /**
   * Get targets
   */
  async getTargets(): Promise<CdpTargetInfo[]> {
    const result = await this.send<{ targetInfos: CdpTargetInfo[] }>({
      method: 'Target.getTargets'
    })

    return result.result?.targetInfos || []
  }

  /**
   * Get domain registry
   */
  getDomains(): CdpDomainRegistry {
    return this.domains
  }

  /**
   * Get connection state
   */
  getConnectionState(): CdpSessionInfo['state'] {
    return this.connectionState
  }

  /**
   * Get event buffer
   */
  getEventBuffer(): ReadonlyArray<CdpEvent> {
    return [...this.eventBuffer]
  }

  /**
   * Clear event buffer
   */
  clearEventBuffer(): void {
    this.eventBuffer.length = 0
  }

  /**
   * Set up event handlers
   */
  private setupEventHandlers(): void {
    if (!this.client) return

    // Handle all events
    this.client.on('event', (event: any) => {
      const cdpEvent: CdpEvent = {
        method: event.method,
        params: event.params,
        sessionId: event.sessionId ? createSessionId(event.sessionId) : undefined,
        timestamp: Date.now() as Timestamp
      }

      // Add to buffer
      this.addToEventBuffer(cdpEvent)

      // Emit domain event
      this.emit('domain:event', cdpEvent)

      // Route to session if applicable
      if (cdpEvent.sessionId) {
        const session = this.sessions.get(cdpEvent.sessionId)
        session?.handleEvent(cdpEvent)
      }

      // Handle specific events
      this.handleSpecificEvent(cdpEvent)
    })

    // Handle disconnect
    this.client.on('disconnect', () => {
      this.logger.warn('CDP client disconnected')
      this.handleDisconnect()
    })
  }

  /**
   * Handle specific events
   */
  private handleSpecificEvent(event: CdpEvent): void {
    switch (event.method) {
      case 'Target.targetCreated':
        this.emit('target:created', event.params as CdpTargetInfo)
        break
      
      case 'Target.targetDestroyed':
        this.emit('target:destroyed', (event.params as any).targetId)
        break
      
      case 'Target.attachedToTarget':
        // Handle session creation from auto-attach
        if ((event.params as any).sessionId) {
          const sessionId = createSessionId((event.params as any).sessionId)
          const targetInfo = (event.params as any).targetInfo as CdpTargetInfo
          
          if (!this.sessions.has(sessionId)) {
            const session = new CdpSession(sessionId, this, targetInfo)
            this.sessions.set(sessionId, session)
            
            const sessionInfo: CdpSessionInfo = {
              sessionId,
              target: targetInfo,
              state: 'connected',
              created: Date.now() as Timestamp,
              lastActivity: Date.now() as Timestamp,
              domains: new Set()
            }
            
            this.emit('session:created', sessionInfo)
          }
        }
        break
      
      case 'Target.detachedFromTarget':
        if ((event.params as any).sessionId) {
          const sessionId = createSessionId((event.params as any).sessionId)
          const session = this.sessions.get(sessionId)
          
          if (session) {
            this.sessions.delete(sessionId)
            session.destroy()
            this.emit('session:destroyed', sessionId)
          }
        }
        break
    }
  }

  /**
   * Add event to buffer
   */
  private addToEventBuffer(event: CdpEvent): void {
    this.eventBuffer.push(event)
    
    // Trim buffer if needed
    if (this.eventBuffer.length > this.config.eventBufferSize!) {
      this.eventBuffer.shift()
    }
  }

  /**
   * Set connection state
   */
  private setConnectionState(state: CdpSessionInfo['state']): void {
    if (this.connectionState !== state) {
      this.connectionState = state
      this.emit('connection:state', state)
    }
  }

  /**
   * Handle disconnect
   */
  private handleDisconnect(): void {
    this.setConnectionState('disconnected')
    
    if (this.config.retry?.enabled && 
        this.reconnectAttempts < this.config.retry.maxAttempts) {
      this.scheduleReconnect()
    }
  }

  /**
   * Schedule reconnect
   */
  private async scheduleReconnect(): Promise<void> {
    const delay = this.config.retry!.delay * 
      Math.pow(this.config.retry!.backoffFactor, this.reconnectAttempts)
    
    this.logger.info({ 
      attempt: this.reconnectAttempts + 1,
      maxAttempts: this.config.retry!.maxAttempts,
      delay 
    }, 'Scheduling reconnect')
    
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectAttempts++
      try {
        await this.connect()
      } catch (error) {
        this.logger.error({ error }, 'Reconnect failed')
      }
    }, delay)
  }

  /**
   * Check if error is CDP error
   */
  private isCdpError(error: unknown): error is CdpError {
    return typeof error === 'object' && 
           error !== null && 
           'code' in error && 
           'message' in error
  }
}

/**
 * Create CDP client
 */
export function createCdpClient(config: CdpClientConfig): CdpClient {
  return new CdpClient(config)
}