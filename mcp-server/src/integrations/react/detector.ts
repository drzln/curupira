/**
 * React framework detector
 * 
 * Detects React presence and version in the target page
 */

import type { RuntimeDomain } from '../../chrome/domains/runtime.js'
import type { ReactDevToolsHook, ReactFiberNode } from '@curupira/shared/types/state.js'
import { logger } from '../../config/logger.js'

export interface ReactInfo {
  detected: boolean
  version?: string
  hasDevTools?: boolean
  hasFiber?: boolean
  rendererVersion?: string
  reactDOMVersion?: string
  isProduction?: boolean
  components?: number
}

export class ReactDetector {
  constructor(private runtime: RuntimeDomain) {}

  /**
   * Detect React in the page
   */
  async detect(): Promise<ReactInfo> {
    try {
      // First check for React DevTools hook
      const devToolsCheck = await this.checkDevToolsHook()
      if (devToolsCheck.detected) {
        return devToolsCheck
      }

      // Fallback to checking window.React
      const windowCheck = await this.checkWindowReact()
      if (windowCheck.detected) {
        return windowCheck
      }

      // Try to detect React in production builds
      const productionCheck = await this.checkProductionReact()
      return productionCheck
    } catch (error) {
      logger.error('React detection failed', error)
      return { detected: false }
    }
  }

  /**
   * Check for React DevTools hook
   */
  private async checkDevToolsHook(): Promise<ReactInfo> {
    const result = await this.runtime.evaluate<{
      detected: boolean
      version?: string
      hasDevTools?: boolean
      renderers?: Array<{ version: string }>
    }>(`
      (() => {
        const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__
        if (!hook) {
          return { detected: false }
        }

        const renderers = Array.from(hook.renderers?.values() || [])
        const reactVersion = window.React?.version
        
        return {
          detected: true,
          version: reactVersion,
          hasDevTools: true,
          renderers: renderers.map(r => ({ version: r.version || 'unknown' }))
        }
      })()
    `)

    if (result.error || !result.value) {
      return { detected: false }
    }

    const info = result.value
    return {
      detected: info.detected,
      version: info.version,
      hasDevTools: info.hasDevTools,
      hasFiber: true, // DevTools hook implies Fiber
      rendererVersion: info.renderers?.[0]?.version
    }
  }

  /**
   * Check window.React
   */
  private async checkWindowReact(): Promise<ReactInfo> {
    const result = await this.runtime.evaluate<{
      detected: boolean
      version?: string
      isProduction?: boolean
    }>(`
      (() => {
        if (!window.React) {
          return { detected: false }
        }

        return {
          detected: true,
          version: window.React.version,
          isProduction: !window.React.createElement.propTypes
        }
      })()
    `)

    if (result.error || !result.value) {
      return { detected: false }
    }

    return result.value
  }

  /**
   * Try to detect React in production builds
   */
  private async checkProductionReact(): Promise<ReactInfo> {
    const result = await this.runtime.evaluate<boolean>(`
      (() => {
        // Look for React's internal properties in DOM
        const allElements = document.querySelectorAll('*')
        for (const element of allElements) {
          const keys = Object.keys(element)
          const hasReactFiber = keys.some(key => 
            key.startsWith('__reactFiber') || 
            key.startsWith('__reactInternalInstance') ||
            key.startsWith('_reactRootContainer')
          )
          if (hasReactFiber) {
            return true
          }
        }
        
        // Check for React root container
        const hasReactRoot = !!document.querySelector('[data-reactroot]') ||
                           !!document.querySelector('#root')?.['_reactRootContainer']
        
        return hasReactRoot
      })()
    `)

    return {
      detected: result.value === true,
      isProduction: true,
      hasFiber: result.value === true
    }
  }

  /**
   * Get React Fiber root
   */
  async getFiberRoot(): Promise<ReactFiberNode | null> {
    const result = await this.runtime.evaluate<any>(`
      (() => {
        // Try multiple methods to find the root
        const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__
        if (hook && hook.getFiberRoots) {
          const roots = Array.from(hook.getFiberRoots())
          if (roots.length > 0) {
            return roots[0]
          }
        }

        // Look for root container
        const rootElement = document.querySelector('#root') || 
                           document.querySelector('[data-reactroot]') ||
                           document.body.firstElementChild
                           
        if (!rootElement) return null

        // Check for Fiber properties
        const keys = Object.keys(rootElement)
        const fiberKey = keys.find(key => key.startsWith('__reactFiber'))
        if (fiberKey) {
          return rootElement[fiberKey]
        }

        const containerKey = keys.find(key => key.startsWith('_reactRootContainer'))
        if (containerKey && rootElement[containerKey]) {
          return rootElement[containerKey]._internalRoot?.current
        }

        return null
      })()
    `)

    if (result.error || !result.value) {
      return null
    }

    return result.value
  }

  /**
   * Install React DevTools hook if not present
   */
  async installDevToolsHook(): Promise<boolean> {
    const result = await this.runtime.evaluate<boolean>(`
      (() => {
        if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
          return true
        }

        // Create minimal hook for inspection
        window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
          renderers: new Map(),
          supportsFiber: true,
          inject: function(renderer) {
            this.renderers.set(this.renderers.size + 1, renderer)
            return this.renderers.size
          },
          onCommitFiberRoot: function(id, root) {
            // Store fiber roots for inspection
            if (!this._fiberRoots) {
              this._fiberRoots = new Set()
            }
            this._fiberRoots.add(root)
          },
          onCommitFiberUnmount: function() {},
          getFiberRoots: function() {
            return this._fiberRoots || new Set()
          }
        }

        // Trigger React to register with our hook
        const event = new Event('ReactDevToolsHookInit')
        window.dispatchEvent(event)

        return true
      })()
    `)

    return result.value === true
  }

  /**
   * Get component statistics
   */
  async getComponentStats(): Promise<{
    totalComponents: number
    functionComponents: number
    classComponents: number
    memoComponents: number
    depth: number
  }> {
    const result = await this.runtime.evaluate<any>(`
      (() => {
        const stats = {
          totalComponents: 0,
          functionComponents: 0,
          classComponents: 0,
          memoComponents: 0,
          depth: 0
        }

        const visited = new WeakSet()
        
        function walkFiber(fiber, depth = 0) {
          if (!fiber || visited.has(fiber)) return
          visited.add(fiber)

          if (fiber.elementType) {
            stats.totalComponents++
            stats.depth = Math.max(stats.depth, depth)

            const type = fiber.elementType
            if (typeof type === 'function') {
              if (type.prototype && type.prototype.isReactComponent) {
                stats.classComponents++
              } else {
                stats.functionComponents++
              }
            }
            
            if (fiber.elementType.$$typeof === Symbol.for('react.memo')) {
              stats.memoComponents++
            }
          }

          if (fiber.child) walkFiber(fiber.child, depth + 1)
          if (fiber.sibling) walkFiber(fiber.sibling, depth)
        }

        // Find root fiber
        const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__
        if (hook && hook.getFiberRoots) {
          const roots = Array.from(hook.getFiberRoots())
          roots.forEach(root => walkFiber(root.current || root))
        }

        return stats
      })()
    `)

    if (result.error || !result.value) {
      return {
        totalComponents: 0,
        functionComponents: 0,
        classComponents: 0,
        memoComponents: 0,
        depth: 0
      }
    }

    return result.value
  }
}