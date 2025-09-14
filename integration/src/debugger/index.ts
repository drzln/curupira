/**
 * @fileoverview Debugger and profiler integrations
 */

// Time-travel debugger
export * from './time-travel.js'

// Re-export from profiler
export * from '../profiler/performance.js'

/**
 * Advanced debugging configuration
 */
export interface AdvancedDebuggingConfig {
  timeTravel?: {
    enabled: boolean
    maxSnapshots?: number
    autoSnapshot?: boolean
  }
  profiling?: {
    enabled: boolean
    trackRenders?: boolean
    trackMemory?: boolean
    trackNetwork?: boolean
  }
  analytics?: {
    enabled: boolean
    trackUserActions?: boolean
    trackErrors?: boolean
  }
}

/**
 * Advanced debugging manager
 */
export class AdvancedDebuggingManager {
  private timeTravelDebugger?: any
  private performanceProfiler?: any
  
  constructor(private config: AdvancedDebuggingConfig = {}) {}
  
  /**
   * Initialize all debugging tools
   */
  async initialize(): Promise<void> {
    if (this.config.timeTravel?.enabled) {
      const { TimeTravelDebugger } = await import('./time-travel.js')
      this.timeTravelDebugger = new TimeTravelDebugger(this.config.timeTravel)
    }
    
    if (this.config.profiling?.enabled) {
      const { PerformanceProfiler } = await import('../profiler/performance.js')
      this.performanceProfiler = new PerformanceProfiler(this.config.profiling)
      await this.performanceProfiler.start()
    }
  }
  
  /**
   * Start time travel session
   */
  async startTimeTravelSession(name?: string): Promise<string | undefined> {
    if (this.timeTravelDebugger) {
      return await this.timeTravelDebugger.startSession(name)
    }
    return undefined
  }
  
  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    return this.performanceProfiler?.getMetrics()
  }
  
  /**
   * Cleanup all debugging tools
   */
  cleanup(): void {
    if (this.timeTravelDebugger) {
      this.timeTravelDebugger.stopSession()
    }
    
    if (this.performanceProfiler) {
      this.performanceProfiler.stop()
    }
  }
}