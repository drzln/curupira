/**
 * React component inspector
 * 
 * Provides detailed inspection capabilities for React components
 */

import type { RuntimeDomain } from '../../chrome/domains/runtime.js'
import type { DOMDomain } from '../../chrome/domains/dom.js'
import type { ComponentId } from '@nexus/curupira-shared/types/branded.js'
import { FiberWalker, type FiberComponent } from './fiber-walker.js'
import { logger } from '../../config/logger.js'

export interface ComponentInspection {
  component: FiberComponent
  domElement?: {
    nodeId: number
    tagName: string
    attributes: Record<string, string>
    boundingBox?: {
      x: number
      y: number
      width: number
      height: number
    }
  }
  renderInfo?: {
    renderCount: number
    lastRenderTime: number
    averageRenderTime: number
  }
  context?: Record<string, unknown>
  providers?: Array<{
    type: string
    value: unknown
  }>
}

export class ComponentInspector {
  private fiberWalker: FiberWalker

  constructor(
    private runtime: RuntimeDomain,
    private dom: DOMDomain
  ) {
    this.fiberWalker = new FiberWalker(runtime)
  }

  /**
   * Inspect a component in detail
   */
  async inspect(componentId: ComponentId): Promise<ComponentInspection | null> {
    try {
      // Get component from fiber tree
      const component = await this.fiberWalker.getComponent(componentId)
      if (!component) {
        logger.warn('Component not found', { componentId })
        return null
      }

      // Get DOM element if available
      const domElement = await this.getDOMElement(componentId)

      // Get render information
      const renderInfo = await this.getRenderInfo(componentId)

      // Get context values
      const context = await this.getContextValues(componentId)

      // Get provider chain
      const providers = await this.getProviders(componentId)

      return {
        component,
        domElement,
        renderInfo,
        context,
        providers
      }
    } catch (error) {
      logger.error('Component inspection failed', { componentId, error })
      return null
    }
  }

  /**
   * Get DOM element for component
   */
  private async getDOMElement(componentId: ComponentId): Promise<ComponentInspection['domElement']> {
    const result = await this.runtime.evaluate<{
      found: boolean
      tagName?: string
      attributes?: Record<string, string>
      rect?: DOMRect
    }>(`
      (() => {
        // Find DOM node for component
        // This is simplified - real implementation would trace through fiber
        const elements = document.querySelectorAll('*')
        for (const el of elements) {
          const keys = Object.keys(el)
          const fiberKey = keys.find(key => key.startsWith('__reactFiber'))
          if (fiberKey) {
            // Would need to match fiber to componentId
            const rect = el.getBoundingClientRect()
            const attrs = {}
            for (const attr of el.attributes) {
              attrs[attr.name] = attr.value
            }
            
            return {
              found: true,
              tagName: el.tagName.toLowerCase(),
              attributes: attrs,
              rect: {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height
              }
            }
          }
        }
        
        return { found: false }
      })()
    `)

    if (!result.value?.found) {
      return undefined
    }

    const { tagName, attributes, rect } = result.value

    // Get DOM node ID for further operations
    const doc = await this.dom.getDocument()
    if (!doc) return undefined

    // Find matching node (simplified)
    const nodeId = doc.nodeId

    return {
      nodeId,
      tagName: tagName || 'div',
      attributes: attributes || {},
      boundingBox: rect ? {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
      } : undefined
    }
  }

  /**
   * Get render performance info
   */
  private async getRenderInfo(componentId: ComponentId): Promise<ComponentInspection['renderInfo']> {
    const result = await this.runtime.evaluate<any>(`
      (() => {
        // This would integrate with React Profiler
        // Returning mock data for now
        return {
          renderCount: 1,
          lastRenderTime: Date.now(),
          averageRenderTime: 0.5
        }
      })()
    `)

    return result.value
  }

  /**
   * Get context values for component
   */
  private async getContextValues(componentId: ComponentId): Promise<Record<string, unknown>> {
    const result = await this.runtime.evaluate<Record<string, unknown>>(`
      (() => {
        // Would traverse fiber tree to find context consumers
        // Simplified for now
        return {}
      })()
    `)

    return result.value || {}
  }

  /**
   * Get provider chain
   */
  private async getProviders(componentId: ComponentId): Promise<Array<{
    type: string
    value: unknown
  }>> {
    const result = await this.runtime.evaluate<any[]>(`
      (() => {
        // Would traverse up the fiber tree to find providers
        // Simplified for now
        return []
      })()
    `)

    return result.value || []
  }

  /**
   * Get source location for component
   */
  async getSourceLocation(componentId: ComponentId): Promise<{
    fileName: string
    lineNumber: number
    columnNumber: number
  } | null> {
    const component = await this.fiberWalker.getComponent(componentId)
    return component?.source || null
  }

  /**
   * Trigger component update
   */
  async triggerUpdate(componentId: ComponentId): Promise<boolean> {
    const result = await this.runtime.evaluate<boolean>(`
      (() => {
        // Force component update
        // This would use React's forceUpdate or hooks
        const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__
        if (hook && hook.scheduleUpdate) {
          hook.scheduleUpdate()
          return true
        }
        return false
      })()
    `)

    return result.value === true
  }

  /**
   * Log component to console
   */
  async logComponent(componentId: ComponentId): Promise<void> {
    const inspection = await this.inspect(componentId)
    if (!inspection) return

    await this.runtime.evaluate(`
      (() => {
        console.group('🔍 Curupira Component Inspector')
        console.log('Component:', ${JSON.stringify(inspection.component.name)})
        console.log('Type:', ${JSON.stringify(inspection.component.type)})
        console.log('Props:', ${JSON.stringify(inspection.component.props)})
        if (${inspection.component.type === 'class'}) {
          console.log('State:', ${JSON.stringify(inspection.component.state)})
        }
        if (${inspection.component.type === 'function'} && ${!!inspection.component.hooks}) {
          console.log('Hooks:', ${JSON.stringify(inspection.component.hooks)})
        }
        console.groupEnd()
      })()
    `)
  }

  /**
   * Compare two component states
   */
  async compareStates(
    componentId: ComponentId,
    previousState: unknown,
    currentState: unknown
  ): Promise<{
    added: string[]
    removed: string[]
    changed: Array<{
      path: string
      oldValue: unknown
      newValue: unknown
    }>
  }> {
    const result = await this.runtime.evaluate<any>(`
      (() => {
        const prev = ${JSON.stringify(previousState)}
        const curr = ${JSON.stringify(currentState)}
        
        const changes = {
          added: [],
          removed: [],
          changed: []
        }
        
        // Simple diff implementation
        function diff(obj1, obj2, path = '') {
          const keys1 = Object.keys(obj1 || {})
          const keys2 = Object.keys(obj2 || {})
          
          // Find removed keys
          keys1.forEach(key => {
            if (!keys2.includes(key)) {
              changes.removed.push(path + key)
            }
          })
          
          // Find added keys
          keys2.forEach(key => {
            if (!keys1.includes(key)) {
              changes.added.push(path + key)
            }
          })
          
          // Find changed values
          keys1.forEach(key => {
            if (keys2.includes(key)) {
              const val1 = obj1[key]
              const val2 = obj2[key]
              
              if (val1 !== val2) {
                if (typeof val1 === 'object' && typeof val2 === 'object') {
                  diff(val1, val2, path + key + '.')
                } else {
                  changes.changed.push({
                    path: path + key,
                    oldValue: val1,
                    newValue: val2
                  })
                }
              }
            }
          })
        }
        
        diff(prev, curr)
        return changes
      })()
    `)

    return result.value || { added: [], removed: [], changed: [] }
  }
}