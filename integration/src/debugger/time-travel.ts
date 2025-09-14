/**
 * @fileoverview Time-Travel Debugger
 * 
 * Provides the ability to record, replay, and debug application state changes over time.
 * This is the core feature of Curupira that allows developers to "trace backwards" 
 * through problems just like the mythological creature's backwards-facing feet.
 */

import { EventEmitter } from 'events'
import { createLogger, type Logger } from '@curupira/shared'

/**
 * Snapshot of application state at a point in time
 */
export interface StateSnapshot {
  id: string
  timestamp: number
  label?: string
  state: {
    react?: any
    zustand?: Record<string, any>
    apollo?: any
    dom?: {
      url: string
      title: string
      scrollPosition: { x: number; y: number }
      focusedElement?: string
    }
    network?: {
      pendingRequests: number
      lastRequest?: any
    }
    console?: {
      logCount: number
      errorCount: number
      lastEntry?: any
    }
  }
  actions: TimelineAction[]
  metadata: {
    userAgent: string
    viewport: { width: number; height: number }
    performance: {
      memory?: any
      timing?: any
    }
    triggers: string[]
  }
}

/**
 * Action that can be replayed
 */
export interface TimelineAction {
  id: string
  timestamp: number
  type: 'user' | 'state' | 'network' | 'dom' | 'console'
  category: string
  description: string
  payload: any
  reversible: boolean
  dependencies: string[]
  effects: {
    stateBefore: any
    stateAfter: any
    sideEffects: string[]
  }
}

/**
 * Time travel session
 */
export interface TimeTravelSession {
  id: string
  name: string
  createdAt: number
  snapshots: StateSnapshot[]
  currentSnapshot: string | null
  isRecording: boolean
  isReplaying: boolean
  config: TimeTravelConfig
}

/**
 * Time travel debugger events
 */
export interface TimeTravelEvents {
  'session.start': (session: TimeTravelSession) => void
  'session.stop': (sessionId: string) => void
  'session.clear': (sessionId: string) => void
  'snapshot.create': (snapshot: StateSnapshot) => void
  'snapshot.restore': (snapshot: StateSnapshot) => void
  'action.record': (action: TimelineAction) => void
  'action.replay': (action: TimelineAction) => void
  'replay.start': (sessionId: string, fromSnapshot: string) => void
  'replay.stop': (sessionId: string) => void
  'replay.step': (sessionId: string, snapshot: StateSnapshot) => void
  'error': (error: Error) => void
}

/**
 * Time travel configuration
 */
export interface TimeTravelConfig {
  maxSnapshots?: number
  snapshotInterval?: number
  enableAutoSnapshot?: boolean
  captureUserActions?: boolean
  captureStateChanges?: boolean
  captureNetworkRequests?: boolean
  captureDOMChanges?: boolean
  captureConsoleOutput?: boolean
  enableReversibleActions?: boolean
  compressionLevel?: 'none' | 'basic' | 'aggressive'
  storageBackend?: 'memory' | 'indexeddb' | 'localstorage'
  debugMode?: boolean
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: TimeTravelConfig = {
  maxSnapshots: 100,
  snapshotInterval: 1000, // 1 second
  enableAutoSnapshot: true,
  captureUserActions: true,
  captureStateChanges: true,
  captureNetworkRequests: true,
  captureDOMChanges: false, // Can be expensive
  captureConsoleOutput: true,
  enableReversibleActions: true,
  compressionLevel: 'basic',
  storageBackend: 'memory',
  debugMode: false,
}

/**
 * Time-Travel Debugger
 * 
 * The heart of Curupira - allows developers to record and replay
 * application state over time to debug complex issues.
 */
export class TimeTravelDebugger extends EventEmitter<TimeTravelEvents> {
  private readonly logger: Logger
  private readonly config: TimeTravelConfig
  private readonly sessions = new Map<string, TimeTravelSession>()
  private currentSessionId: string | null = null
  private snapshotTimer?: NodeJS.Timeout
  private actionQueue: TimelineAction[] = []
  private stateProviders = new Map<string, () => Promise<any>>()
  private stateRestorers = new Map<string, (state: any) => Promise<void>>()

  constructor(config: TimeTravelConfig = {}) {
    super()
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.logger = createLogger({ 
      level: this.config.debugMode ? 'debug' : 'info' 
    })
  }

  /**
   * Start a new time travel session
   */
  async startSession(name: string = `Session_${Date.now()}`): Promise<string> {
    const sessionId = this.generateSessionId()
    
    const session: TimeTravelSession = {
      id: sessionId,
      name,
      createdAt: Date.now(),
      snapshots: [],
      currentSnapshot: null,
      isRecording: true,
      isReplaying: false,
      config: { ...this.config }
    }

    this.sessions.set(sessionId, session)
    this.currentSessionId = sessionId

    // Create initial snapshot
    const initialSnapshot = await this.createSnapshot('Initial State')
    session.snapshots.push(initialSnapshot)
    session.currentSnapshot = initialSnapshot.id

    // Start auto-snapshot timer if enabled
    if (this.config.enableAutoSnapshot) {
      this.startSnapshotTimer()
    }

    this.emit('session.start', session)
    this.logger.info({ sessionId, name }, 'Time travel session started')
    
    return sessionId
  }

  /**
   * Stop current session
   */
  stopSession(sessionId?: string): void {
    const targetSessionId = sessionId || this.currentSessionId
    if (!targetSessionId) return

    const session = this.sessions.get(targetSessionId)
    if (!session) return

    session.isRecording = false
    session.isReplaying = false

    if (targetSessionId === this.currentSessionId) {
      this.currentSessionId = null
      this.stopSnapshotTimer()
    }

    this.emit('session.stop', targetSessionId)
    this.logger.info({ sessionId: targetSessionId }, 'Time travel session stopped')
  }

  /**
   * Clear session data
   */
  clearSession(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) return

    this.sessions.delete(sessionId)
    
    if (sessionId === this.currentSessionId) {
      this.currentSessionId = null
      this.stopSnapshotTimer()
    }

    this.emit('session.clear', sessionId)
    this.logger.info({ sessionId }, 'Time travel session cleared')
  }

  /**
   * Get all sessions
   */
  getSessions(): TimeTravelSession[] {
    return Array.from(this.sessions.values())
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): TimeTravelSession | undefined {
    return this.sessions.get(sessionId)
  }

  /**
   * Create a manual snapshot
   */
  async createSnapshot(label?: string): Promise<StateSnapshot> {
    const snapshot: StateSnapshot = {
      id: this.generateSnapshotId(),
      timestamp: Date.now(),
      label,
      state: await this.captureCurrentState(),
      actions: [...this.actionQueue],
      metadata: await this.captureMetadata()
    }

    // Clear action queue after capturing
    this.actionQueue = []

    // Add to current session if recording
    if (this.currentSessionId) {
      const session = this.sessions.get(this.currentSessionId)
      if (session && session.isRecording) {
        session.snapshots.push(snapshot)
        
        // Limit snapshots if configured
        if (this.config.maxSnapshots && session.snapshots.length > this.config.maxSnapshots) {
          session.snapshots.shift()
        }
      }
    }

    this.emit('snapshot.create', snapshot)
    this.logger.debug({ snapshotId: snapshot.id, label }, 'Snapshot created')
    
    return snapshot
  }

  /**
   * Restore to a specific snapshot
   */
  async restoreToSnapshot(sessionId: string, snapshotId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    const snapshot = session.snapshots.find(s => s.id === snapshotId)
    if (!snapshot) {
      throw new Error(`Snapshot not found: ${snapshotId}`)
    }

    try {
      // Stop any ongoing operations
      session.isRecording = false
      session.isReplaying = true

      // Restore state from snapshot
      await this.restoreState(snapshot.state)
      
      // Update current snapshot
      session.currentSnapshot = snapshotId

      this.emit('snapshot.restore', snapshot)
      this.logger.info({ sessionId, snapshotId }, 'Restored to snapshot')

    } catch (error) {
      session.isReplaying = false
      this.logger.error({ error, sessionId, snapshotId }, 'Failed to restore snapshot')
      throw error
    } finally {
      session.isReplaying = false
    }
  }

  /**
   * Step through time (replay actions step by step)
   */
  async stepForward(sessionId: string, steps: number = 1): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    const currentIndex = session.currentSnapshot ? 
      session.snapshots.findIndex(s => s.id === session.currentSnapshot) : -1
    
    const targetIndex = Math.min(currentIndex + steps, session.snapshots.length - 1)
    if (targetIndex <= currentIndex) return

    const targetSnapshot = session.snapshots[targetIndex]
    await this.restoreToSnapshot(sessionId, targetSnapshot.id)

    this.emit('replay.step', sessionId, targetSnapshot)
  }

  /**
   * Step backward in time
   */
  async stepBackward(sessionId: string, steps: number = 1): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    const currentIndex = session.currentSnapshot ? 
      session.snapshots.findIndex(s => s.id === session.currentSnapshot) : -1
    
    const targetIndex = Math.max(currentIndex - steps, 0)
    if (targetIndex >= currentIndex) return

    const targetSnapshot = session.snapshots[targetIndex]
    await this.restoreToSnapshot(sessionId, targetSnapshot.id)

    this.emit('replay.step', sessionId, targetSnapshot)
  }

  /**
   * Record an action
   */
  recordAction(action: Omit<TimelineAction, 'id' | 'timestamp'>): void {
    if (!this.currentSessionId) return

    const session = this.sessions.get(this.currentSessionId)
    if (!session || !session.isRecording) return

    const fullAction: TimelineAction = {
      id: this.generateActionId(),
      timestamp: Date.now(),
      ...action
    }

    this.actionQueue.push(fullAction)
    this.emit('action.record', fullAction)
    
    this.logger.debug({ actionId: fullAction.id, type: fullAction.type }, 'Action recorded')
  }

  /**
   * Register state provider
   */
  registerStateProvider(key: string, provider: () => Promise<any>): void {
    this.stateProviders.set(key, provider)
    this.logger.debug({ key }, 'State provider registered')
  }

  /**
   * Register state restorer
   */
  registerStateRestorer(key: string, restorer: (state: any) => Promise<void>): void {
    this.stateRestorers.set(key, restorer)
    this.logger.debug({ key }, 'State restorer registered')
  }

  /**
   * Start automatic snapshot timer
   */
  private startSnapshotTimer(): void {
    if (this.snapshotTimer) return

    this.snapshotTimer = setInterval(async () => {
      try {
        await this.createSnapshot('Auto')
      } catch (error) {
        this.logger.error({ error }, 'Auto-snapshot failed')
      }
    }, this.config.snapshotInterval!)
  }

  /**
   * Stop automatic snapshot timer
   */
  private stopSnapshotTimer(): void {
    if (this.snapshotTimer) {
      clearInterval(this.snapshotTimer)
      this.snapshotTimer = undefined
    }
  }

  /**
   * Capture current application state
   */
  private async captureCurrentState(): Promise<StateSnapshot['state']> {
    const state: StateSnapshot['state'] = {}

    // Capture state from all registered providers
    for (const [key, provider] of this.stateProviders) {
      try {
        state[key as keyof StateSnapshot['state']] = await provider()
      } catch (error) {
        this.logger.warn({ key, error }, 'Failed to capture state')
      }
    }

    // Capture DOM state if enabled
    if (this.config.captureDOMChanges) {
      state.dom = {
        url: window.location.href,
        title: document.title,
        scrollPosition: {
          x: window.scrollX,
          y: window.scrollY
        },
        focusedElement: document.activeElement?.tagName
      }
    }

    return state
  }

  /**
   * Restore application state
   */
  private async restoreState(state: StateSnapshot['state']): Promise<void> {
    // Restore state using registered restorers
    for (const [key, restorer] of this.stateRestorers) {
      if (state[key as keyof StateSnapshot['state']]) {
        try {
          await restorer(state[key as keyof StateSnapshot['state']])
        } catch (error) {
          this.logger.warn({ key, error }, 'Failed to restore state')
        }
      }
    }

    // Restore DOM state if available
    if (state.dom && this.config.captureDOMChanges) {
      if (state.dom.url !== window.location.href) {
        window.history.pushState({}, '', state.dom.url)
      }
      
      if (state.dom.title !== document.title) {
        document.title = state.dom.title
      }
      
      window.scrollTo(state.dom.scrollPosition.x, state.dom.scrollPosition.y)
    }
  }

  /**
   * Capture metadata
   */
  private async captureMetadata(): Promise<StateSnapshot['metadata']> {
    return {
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      performance: {
        memory: (performance as any).memory,
        timing: performance.timing
      },
      triggers: [] // Would be populated by specific triggers
    }
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2)}`
  }

  /**
   * Generate unique snapshot ID
   */
  private generateSnapshotId(): string {
    return `snapshot_${Date.now()}_${Math.random().toString(36).substring(2)}`
  }

  /**
   * Generate unique action ID
   */
  private generateActionId(): string {
    return `action_${Date.now()}_${Math.random().toString(36).substring(2)}`
  }
}

/**
 * Time travel utility functions
 */
export class TimeTravelUtils {
  /**
   * Diff two snapshots to show changes
   */
  static diffSnapshots(before: StateSnapshot, after: StateSnapshot): any {
    return {
      timeDelta: after.timestamp - before.timestamp,
      stateChanges: this.deepDiff(before.state, after.state),
      actionCount: after.actions.length - before.actions.length
    }
  }

  /**
   * Deep diff two objects
   */
  private static deepDiff(obj1: any, obj2: any): any {
    const changes: any = {}
    
    // This would be a full deep diff implementation
    // Simplified for demonstration
    for (const key in obj2) {
      if (JSON.stringify(obj1[key]) !== JSON.stringify(obj2[key])) {
        changes[key] = {
          before: obj1[key],
          after: obj2[key]
        }
      }
    }
    
    return changes
  }

  /**
   * Export session to JSON
   */
  static exportSession(session: TimeTravelSession): string {
    return JSON.stringify(session, null, 2)
  }

  /**
   * Import session from JSON
   */
  static importSession(json: string): TimeTravelSession {
    return JSON.parse(json)
  }

  /**
   * Compress snapshot data
   */
  static compressSnapshot(snapshot: StateSnapshot): StateSnapshot {
    // Implement compression logic based on config.compressionLevel
    return { ...snapshot } // Simplified
  }
}