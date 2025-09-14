/**
 * @fileoverview XState inspector integration
 */

import { EventEmitter } from 'events'
import { createLogger, type Logger } from '@curupira/shared'

/**
 * XState machine state interface
 */
export interface XStateMachine {
  id: string
  sessionId: string
  definition: {
    id: string
    type: 'machine'
    initial?: string
    states: Record<string, any>
    context?: any
    predictableActionArguments?: boolean
    strict?: boolean
  }
  state: {
    value: string | Record<string, any>
    context: any
    event: any
    meta: Record<string, any>
    tags: string[]
    can: Record<string, boolean>
    changed: boolean
    done: boolean
  }
}

/**
 * XState event interface
 */
export interface XStateEvent {
  sessionId: string
  type: string
  timestamp: number
  event: {
    type: string
    data?: any
  }
  state: {
    value: string | Record<string, any>
    context: any
    changed: boolean
  }
}

/**
 * XState transition interface
 */
export interface XStateTransition {
  sessionId: string
  from: string | Record<string, any>
  to: string | Record<string, any>
  event: {
    type: string
    data?: any
  }
  context: {
    before: any
    after: any
  }
  timestamp: number
}

/**
 * XState inspector events
 */
export interface XStateInspectorEvents {
  'machine.register': (machine: XStateMachine) => void
  'machine.unregister': (sessionId: string) => void
  'machine.update': (machine: XStateMachine) => void
  'event.send': (event: XStateEvent) => void
  'state.transition': (transition: XStateTransition) => void
  'context.change': (sessionId: string, context: any) => void
  'error': (error: Error) => void
}

/**
 * XState inspector configuration
 */
export interface XStateInspectorConfig {
  enableRecording?: boolean
  maxEventHistory?: number
  filterEvents?: (event: XStateEvent) => boolean
  sanitizeContext?: (context: any) => any
  autoConnect?: boolean
  debugMode?: boolean
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: XStateInspectorConfig = {
  enableRecording: true,
  maxEventHistory: 1000,
  filterEvents: () => true,
  sanitizeContext: (context) => context,
  autoConnect: true,
  debugMode: false,
}

/**
 * XState inspector integration
 */
export class XStateInspector extends EventEmitter<XStateInspectorEvents> {
  private readonly logger: Logger
  private readonly config: XStateInspectorConfig
  private readonly machines = new Map<string, XStateMachine>()
  private readonly eventHistory: XStateEvent[] = []
  private isConnected = false
  private inspectorWebSocket?: WebSocket
  private originalInspect?: any

  constructor(config: XStateInspectorConfig = {}) {
    super()
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.logger = createLogger({ 
      level: this.config.debugMode ? 'debug' : 'info' 
    })

    if (this.config.autoConnect) {
      this.connect().catch(error => {
        this.logger.error({ error }, 'Auto-connect failed')
      })
    }
  }

  /**
   * Connect to XState inspector
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      return
    }

    try {
      // Check if XState is available
      const xstate = (globalThis as any).XState || (globalThis as any).__xstate__
      if (!xstate) {
        throw new Error('XState not found in global scope')
      }

      // Hook into XState inspect functionality
      this.setupInspectorHooks(xstate)
      
      // Try to connect to XState inspector WebSocket if available
      await this.connectWebSocket()
      
      this.isConnected = true
      this.logger.info('XState inspector connected')
      
    } catch (error) {
      this.logger.error({ error }, 'Failed to connect to XState inspector')
      this.emit('error', error instanceof Error ? error : new Error(String(error)))
      throw error
    }
  }

  /**
   * Disconnect from XState inspector
   */
  disconnect(): void {
    if (!this.isConnected) {
      return
    }

    this.cleanupHooks()
    this.closeWebSocket()
    this.machines.clear()
    this.eventHistory.length = 0
    this.isConnected = false
    
    this.logger.info('XState inspector disconnected')
  }

  /**
   * Get all registered machines
   */
  getMachines(): XStateMachine[] {
    return Array.from(this.machines.values())
  }

  /**
   * Get machine by session ID
   */
  getMachine(sessionId: string): XStateMachine | undefined {
    return this.machines.get(sessionId)
  }

  /**
   * Send event to machine
   */
  sendEvent(sessionId: string, event: { type: string; data?: any }): void {
    const machine = this.machines.get(sessionId)
    if (!machine) {
      throw new Error(`Machine not found: ${sessionId}`)
    }

    // Create event object
    const xstateEvent: XStateEvent = {
      sessionId,
      type: 'event.send',
      timestamp: Date.now(),
      event,
      state: machine.state
    }

    // Send via WebSocket if connected
    if (this.inspectorWebSocket?.readyState === WebSocket.OPEN) {
      this.inspectorWebSocket.send(JSON.stringify({
        type: 'xstate.event',
        sessionId,
        event
      }))
    }

    this.emit('event.send', xstateEvent)
  }

  /**
   * Get event history
   */
  getEventHistory(sessionId?: string): XStateEvent[] {
    if (sessionId) {
      return this.eventHistory.filter(event => event.sessionId === sessionId)
    }
    return [...this.eventHistory]
  }

  /**
   * Clear event history
   */
  clearEventHistory(): void {
    this.eventHistory.length = 0
  }

  /**
   * Setup XState inspector hooks
   */
  private setupInspectorHooks(xstate: any): void {
    // Hook into XState's inspect functionality
    this.originalInspect = xstate.inspect
    
    xstate.inspect = (options: any = {}) => {
      const originalReceiver = options.receive
      
      options.receive = (event: any) => {
        try {
          this.handleInspectorEvent(event)
        } catch (error) {
          this.logger.error({ error }, 'Error handling inspector event')
        }
        
        // Call original receiver if it exists
        if (originalReceiver) {
          originalReceiver(event)
        }
      }

      // Call original inspect if it exists
      if (this.originalInspect) {
        return this.originalInspect(options)
      }
      
      return {
        disconnect: () => {
          // Cleanup
        }
      }
    }

    this.logger.debug('XState inspector hooks setup complete')
  }

  /**
   * Handle inspector event
   */
  private handleInspectorEvent(event: any): void {
    switch (event.type) {
      case '@xstate.register':
        this.handleMachineRegister(event)
        break
        
      case '@xstate.unregister':
        this.handleMachineUnregister(event)
        break
        
      case '@xstate.state':
        this.handleStateChange(event)
        break
        
      case '@xstate.event':
        this.handleEventSend(event)
        break
        
      default:
        this.logger.debug({ event }, 'Unknown inspector event')
    }
  }

  /**
   * Handle machine registration
   */
  private handleMachineRegister(event: any): void {
    const machine: XStateMachine = {
      id: event.machine.id || event.sessionId,
      sessionId: event.sessionId,
      definition: {
        id: event.machine.id,
        type: 'machine',
        initial: event.machine.initial,
        states: event.machine.states || {},
        context: event.machine.context,
        predictableActionArguments: event.machine.predictableActionArguments,
        strict: event.machine.strict
      },
      state: {
        value: event.state?.value || event.machine.initial,
        context: this.config.sanitizeContext!(event.state?.context || event.machine.context || {}),
        event: event.state?.event,
        meta: event.state?.meta || {},
        tags: event.state?.tags || [],
        can: event.state?.can || {},
        changed: event.state?.changed || false,
        done: event.state?.done || false
      }
    }

    this.machines.set(event.sessionId, machine)
    this.emit('machine.register', machine)
    
    this.logger.debug({ sessionId: event.sessionId, machineId: machine.id }, 'Machine registered')
  }

  /**
   * Handle machine unregistration
   */
  private handleMachineUnregister(event: any): void {
    this.machines.delete(event.sessionId)
    this.emit('machine.unregister', event.sessionId)
    
    this.logger.debug({ sessionId: event.sessionId }, 'Machine unregistered')
  }

  /**
   * Handle state change
   */
  private handleStateChange(event: any): void {
    const machine = this.machines.get(event.sessionId)
    if (!machine) return

    const previousValue = machine.state.value
    const previousContext = machine.state.context

    // Update machine state
    machine.state = {
      value: event.state.value,
      context: this.config.sanitizeContext!(event.state.context),
      event: event.state.event,
      meta: event.state.meta || {},
      tags: event.state.tags || [],
      can: event.state.can || {},
      changed: event.state.changed !== false,
      done: event.state.done || false
    }

    // Create transition event
    const transition: XStateTransition = {
      sessionId: event.sessionId,
      from: previousValue,
      to: machine.state.value,
      event: event.state.event,
      context: {
        before: previousContext,
        after: machine.state.context
      },
      timestamp: Date.now()
    }

    this.emit('machine.update', machine)
    this.emit('state.transition', transition)

    // Check for context changes
    if (JSON.stringify(previousContext) !== JSON.stringify(machine.state.context)) {
      this.emit('context.change', event.sessionId, machine.state.context)
    }
  }

  /**
   * Handle event send
   */
  private handleEventSend(event: any): void {
    const xstateEvent: XStateEvent = {
      sessionId: event.sessionId,
      type: 'event.send',
      timestamp: Date.now(),
      event: event.event,
      state: {
        value: event.state?.value,
        context: this.config.sanitizeContext!(event.state?.context),
        changed: event.state?.changed !== false
      }
    }

    // Add to history if recording is enabled
    if (this.config.enableRecording) {
      this.eventHistory.push(xstateEvent)
      
      // Limit history size
      if (this.eventHistory.length > this.config.maxEventHistory!) {
        this.eventHistory.splice(0, this.eventHistory.length - this.config.maxEventHistory!)
      }
    }

    // Filter events if configured
    if (this.config.filterEvents!(xstateEvent)) {
      this.emit('event.send', xstateEvent)
    }
  }

  /**
   * Connect to XState inspector WebSocket
   */
  private async connectWebSocket(): Promise<void> {
    try {
      // Try to connect to XState inspector server
      const websocketUrl = 'ws://localhost:8080/xstate' // Default XState inspector port
      
      this.inspectorWebSocket = new WebSocket(websocketUrl)
      
      this.inspectorWebSocket.onopen = () => {
        this.logger.debug('XState inspector WebSocket connected')
      }
      
      this.inspectorWebSocket.onclose = () => {
        this.logger.debug('XState inspector WebSocket disconnected')
      }
      
      this.inspectorWebSocket.onerror = (error) => {
        this.logger.debug({ error }, 'XState inspector WebSocket error')
      }
      
      this.inspectorWebSocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          this.handleWebSocketMessage(data)
        } catch (error) {
          this.logger.error({ error }, 'Failed to parse WebSocket message')
        }
      }
      
    } catch (error) {
      this.logger.debug({ error }, 'Failed to connect to XState inspector WebSocket')
      // Don't throw - WebSocket is optional
    }
  }

  /**
   * Handle WebSocket message
   */
  private handleWebSocketMessage(message: any): void {
    switch (message.type) {
      case 'xstate.event':
        // Handle external events from inspector
        if (message.sessionId && message.event) {
          this.sendEvent(message.sessionId, message.event)
        }
        break
        
      default:
        this.logger.debug({ message }, 'Unknown WebSocket message')
    }
  }

  /**
   * Close WebSocket connection
   */
  private closeWebSocket(): void {
    if (this.inspectorWebSocket) {
      this.inspectorWebSocket.close()
      this.inspectorWebSocket = undefined
    }
  }

  /**
   * Cleanup hooks
   */
  private cleanupHooks(): void {
    // Restore original inspect if we have it
    const xstate = (globalThis as any).XState || (globalThis as any).__xstate__
    if (xstate && this.originalInspect) {
      xstate.inspect = this.originalInspect
    }
  }
}