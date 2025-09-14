/**
 * @fileoverview Performance Profiler
 * 
 * Comprehensive performance monitoring and profiling for React applications.
 * Tracks renders, state updates, network requests, and resource usage.
 */

import { EventEmitter } from 'events'
import { createLogger, type Logger } from '@curupira/shared'

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  timestamp: number
  // Rendering metrics
  render: {
    totalRenders: number
    slowRenders: number
    averageRenderTime: number
    longestRender: number
    rendersByComponent: Record<string, number>
    wastedRenders: number
  }
  // Memory metrics
  memory: {
    usedJSHeapSize: number
    totalJSHeapSize: number
    jsHeapSizeLimit: number
    memoryGrowth: number
    memoryLeaks: MemoryLeak[]
  }
  // Network metrics
  network: {
    requestCount: number
    totalTransferSize: number
    averageLatency: number
    slowRequests: number
    failedRequests: number
    cacheHitRatio: number
  }
  // Core Web Vitals
  vitals: {
    fcp: number | null // First Contentful Paint
    lcp: number | null // Largest Contentful Paint
    fid: number | null // First Input Delay
    cls: number | null // Cumulative Layout Shift
    ttfb: number | null // Time to First Byte
  }
  // Custom metrics
  custom: Record<string, number>
}

/**
 * Performance issue
 */
export interface PerformanceIssue {
  id: string
  type: 'render' | 'memory' | 'network' | 'layout' | 'script'
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  description: string
  component?: string
  timestamp: number
  metrics: Record<string, number>
  suggestions: string[]
  stackTrace?: string
}

/**
 * Memory leak detection
 */
export interface MemoryLeak {
  id: string
  type: 'listener' | 'closure' | 'detached-dom' | 'component'
  component?: string
  size: number
  growth: number
  detected: number
  references: string[]
}

/**
 * Render profile
 */
export interface RenderProfile {
  id: string
  component: string
  startTime: number
  endTime: number
  duration: number
  phase: 'mount' | 'update' | 'unmount'
  props: Record<string, any>
  state?: Record<string, any>
  hooks?: Array<{ name: string; value: any }>
  children: string[]
  isWasted: boolean
  reason: string[]
}

/**
 * Network request profile
 */
export interface NetworkProfile {
  id: string
  url: string
  method: string
  startTime: number
  endTime: number
  duration: number
  size: number
  status: number
  cached: boolean
  priority: string
  initiator: string
  timing: {
    dns: number
    connect: number
    request: number
    response: number
  }
}

/**
 * Performance profiler events
 */
export interface PerformanceProfilerEvents {
  'metrics.update': (metrics: PerformanceMetrics) => void
  'issue.detected': (issue: PerformanceIssue) => void
  'render.profile': (profile: RenderProfile) => void
  'network.profile': (profile: NetworkProfile) => void
  'memory.leak': (leak: MemoryLeak) => void
  'vitals.update': (vitals: PerformanceMetrics['vitals']) => void
  'profiling.start': () => void
  'profiling.stop': () => void
  'error': (error: Error) => void
}

/**
 * Profiler configuration
 */
export interface PerformanceProfilerConfig {
  enableRenderProfiling?: boolean
  enableMemoryProfiling?: boolean
  enableNetworkProfiling?: boolean
  enableVitalsProfiling?: boolean
  slowRenderThreshold?: number // ms
  memoryLeakThreshold?: number // bytes
  slowNetworkThreshold?: number // ms
  profilingInterval?: number // ms
  maxProfiles?: number
  detectWastedRenders?: boolean
  trackComponentUpdates?: boolean
  debugMode?: boolean
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: PerformanceProfilerConfig = {
  enableRenderProfiling: true,
  enableMemoryProfiling: true,
  enableNetworkProfiling: true,
  enableVitalsProfiling: true,
  slowRenderThreshold: 16, // 60fps threshold
  memoryLeakThreshold: 1024 * 1024, // 1MB
  slowNetworkThreshold: 1000, // 1 second
  profilingInterval: 1000, // 1 second
  maxProfiles: 1000,
  detectWastedRenders: true,
  trackComponentUpdates: true,
  debugMode: false,
}

/**
 * Performance Profiler
 */
export class PerformanceProfiler extends EventEmitter<PerformanceProfilerEvents> {
  private readonly logger: Logger
  private readonly config: PerformanceProfilerConfig
  private isActive = false
  private metrics: PerformanceMetrics
  private renderProfiles: RenderProfile[] = []
  private networkProfiles: NetworkProfile[] = []
  private issues: PerformanceIssue[] = []
  private memoryBaseline?: number
  private observer?: PerformanceObserver
  private metricsTimer?: NodeJS.Timeout

  constructor(config: PerformanceProfilerConfig = {}) {
    super()
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.logger = createLogger({ 
      level: this.config.debugMode ? 'debug' : 'info' 
    })
    
    this.metrics = this.initializeMetrics()
  }

  /**
   * Start profiling
   */
  async start(): Promise<void> {
    if (this.isActive) {
      return
    }

    try {
      // Setup performance observers
      this.setupObservers()
      
      // Start metrics collection
      this.startMetricsCollection()
      
      // Setup React profiling if available
      if (this.config.enableRenderProfiling) {
        this.setupReactProfiling()
      }
      
      // Setup network profiling
      if (this.config.enableNetworkProfiling) {
        this.setupNetworkProfiling()
      }
      
      // Setup memory profiling
      if (this.config.enableMemoryProfiling) {
        this.setupMemoryProfiling()
      }

      this.isActive = true
      this.emit('profiling.start')
      this.logger.info('Performance profiling started')
      
    } catch (error) {
      this.logger.error({ error }, 'Failed to start profiling')
      this.emit('error', error instanceof Error ? error : new Error(String(error)))
      throw error
    }
  }

  /**
   * Stop profiling
   */
  stop(): void {
    if (!this.isActive) {
      return
    }

    this.cleanup()
    this.isActive = false
    this.emit('profiling.stop')
    this.logger.info('Performance profiling stopped')
  }

  /**
   * Get current metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics }
  }

  /**
   * Get render profiles
   */
  getRenderProfiles(): RenderProfile[] {
    return [...this.renderProfiles]
  }

  /**
   * Get network profiles
   */
  getNetworkProfiles(): NetworkProfile[] {
    return [...this.networkProfiles]
  }

  /**
   * Get performance issues
   */
  getIssues(): PerformanceIssue[] {
    return [...this.issues]
  }

  /**
   * Clear all profiles and data
   */
  clear(): void {
    this.renderProfiles = []
    this.networkProfiles = []
    this.issues = []
    this.metrics = this.initializeMetrics()
  }

  /**
   * Mark custom performance metric
   */
  mark(name: string): void {
    performance.mark(name)
  }

  /**
   * Measure custom performance metric
   */
  measure(name: string, startMark?: string, endMark?: string): number {
    const entry = performance.measure(name, startMark, endMark)
    this.metrics.custom[name] = entry.duration
    return entry.duration
  }

  /**
   * Initialize metrics structure
   */
  private initializeMetrics(): PerformanceMetrics {
    return {
      timestamp: Date.now(),
      render: {
        totalRenders: 0,
        slowRenders: 0,
        averageRenderTime: 0,
        longestRender: 0,
        rendersByComponent: {},
        wastedRenders: 0
      },
      memory: {
        usedJSHeapSize: 0,
        totalJSHeapSize: 0,
        jsHeapSizeLimit: 0,
        memoryGrowth: 0,
        memoryLeaks: []
      },
      network: {
        requestCount: 0,
        totalTransferSize: 0,
        averageLatency: 0,
        slowRequests: 0,
        failedRequests: 0,
        cacheHitRatio: 0
      },
      vitals: {
        fcp: null,
        lcp: null,
        fid: null,
        cls: null,
        ttfb: null
      },
      custom: {}
    }
  }

  /**
   * Setup performance observers
   */
  private setupObservers(): void {
    if (!window.PerformanceObserver) {
      this.logger.warn('PerformanceObserver not supported')
      return
    }

    try {
      this.observer = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        this.processPerformanceEntries(entries)
      })

      this.observer.observe({
        entryTypes: ['measure', 'navigation', 'resource', 'paint', 'largest-contentful-paint']
      })

    } catch (error) {
      this.logger.error({ error }, 'Failed to setup performance observer')
    }
  }

  /**
   * Process performance entries
   */
  private processPerformanceEntries(entries: PerformanceEntry[]): void {
    for (const entry of entries) {
      switch (entry.entryType) {
        case 'navigation':
          this.processNavigationEntry(entry as PerformanceNavigationTiming)
          break
        case 'resource':
          this.processResourceEntry(entry as PerformanceResourceTiming)
          break
        case 'paint':
          this.processPaintEntry(entry as PerformancePaintTiming)
          break
        case 'largest-contentful-paint':
          this.processLCPEntry(entry as any)
          break
        case 'measure':
          this.processMeasureEntry(entry)
          break
      }
    }
  }

  /**
   * Process navigation timing
   */
  private processNavigationEntry(entry: PerformanceNavigationTiming): void {
    this.metrics.vitals.ttfb = entry.responseStart - entry.requestStart
    
    // Check for slow navigation
    if (entry.loadEventEnd - entry.navigationStart > 3000) {
      this.reportIssue({
        type: 'network',
        severity: 'medium',
        title: 'Slow Page Load',
        description: `Page took ${Math.round(entry.loadEventEnd - entry.navigationStart)}ms to load`,
        metrics: { loadTime: entry.loadEventEnd - entry.navigationStart },
        suggestions: [
          'Optimize critical resources',
          'Reduce bundle size',
          'Enable server-side rendering'
        ]
      })
    }
  }

  /**
   * Process resource timing
   */
  private processResourceEntry(entry: PerformanceResourceTiming): void {
    const profile: NetworkProfile = {
      id: this.generateId(),
      url: entry.name,
      method: 'GET', // Not available in Resource Timing
      startTime: entry.startTime,
      endTime: entry.responseEnd,
      duration: entry.duration,
      size: entry.transferSize || 0,
      status: 200, // Not available in Resource Timing
      cached: entry.transferSize === 0,
      priority: 'unknown',
      initiator: entry.initiatorType,
      timing: {
        dns: entry.domainLookupEnd - entry.domainLookupStart,
        connect: entry.connectEnd - entry.connectStart,
        request: entry.responseStart - entry.requestStart,
        response: entry.responseEnd - entry.responseStart
      }
    }

    this.addNetworkProfile(profile)
  }

  /**
   * Process paint timing
   */
  private processPaintEntry(entry: PerformancePaintTiming): void {
    if (entry.name === 'first-contentful-paint') {
      this.metrics.vitals.fcp = entry.startTime
    }
  }

  /**
   * Process LCP entry
   */
  private processLCPEntry(entry: any): void {
    this.metrics.vitals.lcp = entry.startTime
    
    // Check for poor LCP
    if (entry.startTime > 2500) {
      this.reportIssue({
        type: 'render',
        severity: entry.startTime > 4000 ? 'high' : 'medium',
        title: 'Poor Largest Contentful Paint',
        description: `LCP is ${Math.round(entry.startTime)}ms (should be < 2.5s)`,
        metrics: { lcp: entry.startTime },
        suggestions: [
          'Optimize large images',
          'Preload critical resources',
          'Remove render-blocking resources'
        ]
      })
    }
  }

  /**
   * Process measure entry
   */
  private processMeasureEntry(entry: PerformanceEntry): void {
    if (entry.name.startsWith('⚛️')) {
      // React measure
      this.processReactMeasure(entry)
    } else {
      // Custom measure
      this.metrics.custom[entry.name] = entry.duration
    }
  }

  /**
   * Process React measure
   */
  private processReactMeasure(entry: PerformanceEntry): void {
    const isCommit = entry.name.includes('(Commit)')
    const isRender = entry.name.includes('(Render)')

    if (isCommit || isRender) {
      this.metrics.render.totalRenders++
      
      if (entry.duration > this.config.slowRenderThreshold!) {
        this.metrics.render.slowRenders++
        
        this.reportIssue({
          type: 'render',
          severity: entry.duration > 50 ? 'high' : 'medium',
          title: 'Slow Render',
          description: `${isCommit ? 'Commit' : 'Render'} took ${Math.round(entry.duration)}ms`,
          metrics: { renderTime: entry.duration },
          suggestions: [
            'Use React.memo() for expensive components',
            'Optimize useEffect dependencies',
            'Consider code splitting'
          ]
        })
      }

      // Update render metrics
      this.metrics.render.longestRender = Math.max(this.metrics.render.longestRender, entry.duration)
      this.metrics.render.averageRenderTime = 
        (this.metrics.render.averageRenderTime * (this.metrics.render.totalRenders - 1) + entry.duration) 
        / this.metrics.render.totalRenders
    }
  }

  /**
   * Setup React profiling
   */
  private setupReactProfiling(): void {
    // Hook into React DevTools Profiler
    const reactDevTools = (globalThis as any).__REACT_DEVTOOLS_GLOBAL_HOOK__
    if (reactDevTools) {
      const originalOnCommitFiberRoot = reactDevTools.onCommitFiberRoot
      reactDevTools.onCommitFiberRoot = (...args: any[]) => {
        this.handleReactCommit(args)
        return originalOnCommitFiberRoot?.apply(reactDevTools, args)
      }
    }
  }

  /**
   * Handle React commit
   */
  private handleReactCommit(args: any[]): void {
    // This would analyze the React fiber tree for wasted renders
    // Simplified implementation
    this.metrics.render.totalRenders++
  }

  /**
   * Setup network profiling
   */
  private setupNetworkProfiling(): void {
    // Hook into fetch
    const originalFetch = window.fetch
    window.fetch = async (...args) => {
      const startTime = performance.now()
      const url = typeof args[0] === 'string' ? args[0] : args[0].url
      
      try {
        const response = await originalFetch(...args)
        const endTime = performance.now()
        
        const profile: NetworkProfile = {
          id: this.generateId(),
          url,
          method: args[1]?.method || 'GET',
          startTime,
          endTime,
          duration: endTime - startTime,
          size: parseInt(response.headers.get('content-length') || '0'),
          status: response.status,
          cached: response.headers.get('x-cache') === 'HIT',
          priority: 'high',
          initiator: 'fetch',
          timing: {
            dns: 0,
            connect: 0,
            request: 0,
            response: endTime - startTime
          }
        }
        
        this.addNetworkProfile(profile)
        return response
        
      } catch (error) {
        this.metrics.network.failedRequests++
        throw error
      }
    }
  }

  /**
   * Setup memory profiling
   */
  private setupMemoryProfiling(): void {
    // Set memory baseline
    if ((performance as any).memory) {
      this.memoryBaseline = (performance as any).memory.usedJSHeapSize
    }
  }

  /**
   * Start metrics collection timer
   */
  private startMetricsCollection(): void {
    this.metricsTimer = setInterval(() => {
      this.collectMetrics()
    }, this.config.profilingInterval!)
  }

  /**
   * Collect current metrics
   */
  private collectMetrics(): void {
    this.metrics.timestamp = Date.now()
    
    // Update memory metrics if available
    if ((performance as any).memory) {
      const memory = (performance as any).memory
      this.metrics.memory.usedJSHeapSize = memory.usedJSHeapSize
      this.metrics.memory.totalJSHeapSize = memory.totalJSHeapSize
      this.metrics.memory.jsHeapSizeLimit = memory.jsHeapSizeLimit
      
      if (this.memoryBaseline) {
        this.metrics.memory.memoryGrowth = memory.usedJSHeapSize - this.memoryBaseline
        
        // Check for memory leaks
        if (this.metrics.memory.memoryGrowth > this.config.memoryLeakThreshold!) {
          this.reportIssue({
            type: 'memory',
            severity: 'high',
            title: 'Potential Memory Leak',
            description: `Memory usage increased by ${Math.round(this.metrics.memory.memoryGrowth / 1024 / 1024)}MB`,
            metrics: { memoryGrowth: this.metrics.memory.memoryGrowth },
            suggestions: [
              'Check for uncleaned event listeners',
              'Verify component cleanup in useEffect',
              'Look for circular references'
            ]
          })
        }
      }
    }

    // Update network metrics
    this.updateNetworkMetrics()

    this.emit('metrics.update', this.metrics)
  }

  /**
   * Update network metrics
   */
  private updateNetworkMetrics(): void {
    this.metrics.network.requestCount = this.networkProfiles.length
    
    if (this.networkProfiles.length > 0) {
      this.metrics.network.totalTransferSize = this.networkProfiles.reduce((sum, p) => sum + p.size, 0)
      this.metrics.network.averageLatency = this.networkProfiles.reduce((sum, p) => sum + p.duration, 0) / this.networkProfiles.length
      this.metrics.network.slowRequests = this.networkProfiles.filter(p => p.duration > this.config.slowNetworkThreshold!).length
      this.metrics.network.cacheHitRatio = this.networkProfiles.filter(p => p.cached).length / this.networkProfiles.length
    }
  }

  /**
   * Add network profile
   */
  private addNetworkProfile(profile: NetworkProfile): void {
    this.networkProfiles.push(profile)
    
    // Limit profiles
    if (this.networkProfiles.length > this.config.maxProfiles!) {
      this.networkProfiles.shift()
    }
    
    // Check for slow requests
    if (profile.duration > this.config.slowNetworkThreshold!) {
      this.reportIssue({
        type: 'network',
        severity: 'medium',
        title: 'Slow Network Request',
        description: `Request to ${profile.url} took ${Math.round(profile.duration)}ms`,
        metrics: { duration: profile.duration },
        suggestions: [
          'Optimize API response size',
          'Add request caching',
          'Use CDN for static resources'
        ]
      })
    }
    
    this.emit('network.profile', profile)
  }

  /**
   * Report performance issue
   */
  private reportIssue(issue: Omit<PerformanceIssue, 'id' | 'timestamp'>): void {
    const fullIssue: PerformanceIssue = {
      id: this.generateId(),
      timestamp: Date.now(),
      ...issue
    }
    
    this.issues.push(fullIssue)
    this.emit('issue.detected', fullIssue)
    
    this.logger.debug({ issueId: fullIssue.id, type: fullIssue.type }, 'Performance issue detected')
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `perf_${Date.now()}_${Math.random().toString(36).substring(2)}`
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    if (this.observer) {
      this.observer.disconnect()
      this.observer = undefined
    }
    
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer)
      this.metricsTimer = undefined
    }
  }
}