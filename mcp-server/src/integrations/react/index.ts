/**
 * React integration index
 * 
 * Main entry point for React DevTools integration
 */

import type { RuntimeDomain } from '../../chrome/domains/runtime.js'
import type { DOMDomain } from '../../chrome/domains/dom.js'
import type { ReactRenderInfo, ReactFiberNode } from '@curupira/shared/types/state.js'
import { ReactDetector, type ReactInfo } from './detector.js'
import { FiberWalker, type FiberComponent } from './fiber-walker.js'
import { ComponentInspector, type ComponentInspection } from './component-inspector.js'
import { logger } from '../../config/logger.js'

export interface ReactIntegration {
  // Detection
  detect(): Promise<ReactInfo>
  isReactDetected(): boolean
  getReactVersion(): string | undefined

  // Component tree
  getComponentTree(): Promise<FiberComponent[]>
  getComponent(componentId: string): Promise<FiberComponent | null>
  searchComponents(query: string): Promise<FiberComponent[]>

  // Inspection
  inspectComponent(componentId: string): Promise<ComponentInspection | null>
  getComponentProps(componentId: string): Promise<Record<string, unknown>>
  getComponentState(componentId: string): Promise<unknown>
  getComponentHooks(componentId: string): Promise<Array<{ id: number; type: string; value: unknown }>>

  // Actions
  highlightComponent(componentId: string): Promise<void>
  logComponent(componentId: string): Promise<void>
  triggerUpdate(componentId: string): Promise<boolean>

  // Performance
  getRenderMetrics(): Promise<{
    renderCount: number
    slowComponents: Array<{ name: string; renderTime: number }>
  }>
}

export class ReactIntegrationImpl implements ReactIntegration {
  private detector: ReactDetector
  private walker: FiberWalker
  private inspector: ComponentInspector
  private reactInfo?: ReactInfo

  constructor(
    private runtime: RuntimeDomain,
    private dom: DOMDomain
  ) {
    this.detector = new ReactDetector(runtime)
    this.walker = new FiberWalker(runtime)
    this.inspector = new ComponentInspector(runtime, dom)
  }

  /**
   * Initialize the integration
   */
  async initialize(): Promise<void> {
    try {
      // Detect React
      this.reactInfo = await this.detector.detect()
      
      if (this.reactInfo.detected) {
        logger.info('React detected', {
          version: this.reactInfo.version,
          hasDevTools: this.reactInfo.hasDevTools,
          isProduction: this.reactInfo.isProduction
        })

        // Install DevTools hook if needed
        if (!this.reactInfo.hasDevTools) {
          const installed = await this.detector.installDevToolsHook()
          if (installed) {
            logger.info('React DevTools hook installed')
            // Re-detect with hook installed
            this.reactInfo = await this.detector.detect()
          }
        }

        // Get initial component stats
        const stats = await this.detector.getComponentStats()
        logger.info('React component stats', stats)
      } else {
        logger.info('React not detected on page')
      }
    } catch (error) {
      logger.error('React integration initialization failed', error)
    }
  }

  // Detection methods
  async detect(): Promise<ReactInfo> {
    this.reactInfo = await this.detector.detect()
    return this.reactInfo
  }

  isReactDetected(): boolean {
    return this.reactInfo?.detected || false
  }

  getReactVersion(): string | undefined {
    return this.reactInfo?.version
  }

  // Component tree methods
  async getComponentTree(): Promise<FiberComponent[]> {
    if (!this.isReactDetected()) {
      logger.warn('React not detected, cannot get component tree')
      return []
    }
    return this.walker.getComponentTree()
  }

  async getComponent(componentId: string): Promise<FiberComponent | null> {
    if (!this.isReactDetected()) {
      return null
    }
    return this.walker.getComponent(componentId as any)
  }

  async searchComponents(query: string): Promise<FiberComponent[]> {
    if (!this.isReactDetected()) {
      return []
    }
    return this.walker.searchComponents(query)
  }

  // Inspection methods
  async inspectComponent(componentId: string): Promise<ComponentInspection | null> {
    if (!this.isReactDetected()) {
      return null
    }
    return this.inspector.inspect(componentId as any)
  }

  async getComponentProps(componentId: string): Promise<Record<string, unknown>> {
    if (!this.isReactDetected()) {
      return {}
    }
    return this.walker.getComponentProps(componentId as any)
  }

  async getComponentState(componentId: string): Promise<unknown> {
    if (!this.isReactDetected()) {
      return null
    }
    return this.walker.getComponentState(componentId as any)
  }

  async getComponentHooks(componentId: string): Promise<Array<{
    id: number
    type: string
    value: unknown
  }>> {
    if (!this.isReactDetected()) {
      return []
    }
    return this.walker.getComponentHooks(componentId as any)
  }

  // Action methods
  async highlightComponent(componentId: string): Promise<void> {
    if (!this.isReactDetected()) {
      return
    }
    await this.walker.highlightComponent(componentId as any)
  }

  async logComponent(componentId: string): Promise<void> {
    if (!this.isReactDetected()) {
      return
    }
    await this.inspector.logComponent(componentId as any)
  }

  async triggerUpdate(componentId: string): Promise<boolean> {
    if (!this.isReactDetected()) {
      return false
    }
    return this.inspector.triggerUpdate(componentId as any)
  }

  // Performance methods
  async getRenderMetrics(): Promise<{
    renderCount: number
    slowComponents: Array<{ name: string; renderTime: number }>
  }> {
    if (!this.isReactDetected()) {
      return { renderCount: 0, slowComponents: [] }
    }
    return this.walker.getRenderMetrics()
  }

  /**
   * Set up React performance monitoring
   */
  async enablePerformanceMonitoring(): Promise<void> {
    if (!this.isReactDetected()) {
      return
    }

    await this.runtime.evaluate(`
      (() => {
        // Hook into React's profiler
        const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__
        if (!hook) return

        // Track render times
        const renderTimes = new Map()
        
        const originalCommit = hook.onCommitFiberRoot
        hook.onCommitFiberRoot = function(id, root, priorityLevel) {
          const start = performance.now()
          
          if (originalCommit) {
            originalCommit.call(this, id, root, priorityLevel)
          }
          
          const duration = performance.now() - start
          
          // Store render time
          if (!renderTimes.has(id)) {
            renderTimes.set(id, [])
          }
          renderTimes.get(id).push(duration)
          
          // Emit custom event for monitoring
          window.dispatchEvent(new CustomEvent('curupira:react:render', {
            detail: { id, duration, timestamp: Date.now() }
          }))
        }
        
        // Make render times accessible
        window.__CURUPIRA_REACT_METRICS__ = {
          getRenderTimes: () => renderTimes,
          clearMetrics: () => renderTimes.clear()
        }
      })()
    `)
  }

  /**
   * Disable performance monitoring
   */
  async disablePerformanceMonitoring(): Promise<void> {
    await this.runtime.evaluate(`
      (() => {
        delete window.__CURUPIRA_REACT_METRICS__
      })()
    `)
  }
}

// Factory function
export function createReactIntegration(
  runtime: RuntimeDomain,
  dom: DOMDomain
): ReactIntegration {
  const integration = new ReactIntegrationImpl(runtime, dom)
  // Auto-initialize on creation
  integration.initialize().catch(error => {
    logger.error('Failed to initialize React integration', error)
  })
  return integration
}