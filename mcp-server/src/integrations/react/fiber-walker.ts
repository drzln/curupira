/**
 * React Fiber tree walker
 * 
 * Traverses and inspects React Fiber trees
 */

import type { RuntimeDomain } from '../../chrome/domains/runtime.js'
import type { ReactFiberNode, ComponentId } from '@nexus/curupira-shared/types/index.js'
import { generateId } from '@nexus/curupira-shared/utils/index.js'
import { logger } from '../../config/logger.js'

export interface FiberComponent {
  id: ComponentId
  name: string
  type: 'function' | 'class' | 'memo' | 'forward_ref' | 'context' | 'fragment'
  props: Record<string, unknown>
  state: unknown
  hooks?: Array<{
    id: number
    type: string
    value: unknown
  }>
  children: FiberComponent[]
  parentId?: ComponentId
  key?: string | null
  ref?: unknown
  source?: {
    fileName: string
    lineNumber: number
    columnNumber: number
  }
}

export class FiberWalker {
  private componentCache = new Map<string, FiberComponent>()

  constructor(private runtime: RuntimeDomain) {}

  /**
   * Get the complete component tree
   */
  async getComponentTree(): Promise<FiberComponent[]> {
    try {
      // Clear cache for fresh traversal
      this.componentCache.clear()

      const result = await this.runtime.evaluate<any>(`
        (() => {
          const components = []
          const visited = new WeakSet()
          const fiberToId = new WeakMap()
          let idCounter = 0

          function getComponentType(fiber) {
            const type = fiber.elementType || fiber.type
            if (!type) return 'fragment'
            
            if (typeof type === 'string') return 'host' // DOM element
            if (type.$$typeof === Symbol.for('react.memo')) return 'memo'
            if (type.$$typeof === Symbol.for('react.forward_ref')) return 'forward_ref'
            if (type.$$typeof === Symbol.for('react.context')) return 'context'
            if (type.prototype && type.prototype.isReactComponent) return 'class'
            if (typeof type === 'function') return 'function'
            
            return 'fragment'
          }

          function getComponentName(fiber) {
            const type = fiber.elementType || fiber.type
            if (!type) return 'Fragment'
            
            if (typeof type === 'string') return type
            if (type.displayName) return type.displayName
            if (type.name) return type.name
            
            // For memo components
            if (type.type) {
              return getComponentName({ type: type.type })
            }
            
            return 'Unknown'
          }

          function extractHooks(fiber) {
            if (!fiber.memoizedState) return []
            
            const hooks = []
            let hook = fiber.memoizedState
            let id = 0
            
            while (hook) {
              const hookInfo = {
                id: id++,
                type: 'unknown',
                value: null
              }
              
              // Try to identify hook type
              if (hook.queue) {
                if (hook.queue.dispatch) {
                  hookInfo.type = 'state'
                  hookInfo.value = hook.memoizedState
                } else if (hook.queue.lastEffect) {
                  hookInfo.type = 'effect'
                }
              } else if (hook.deps !== undefined) {
                hookInfo.type = hook.deps === null ? 'callback' : 'memo'
                hookInfo.value = hook.memoizedState
              } else if (hook.memoizedState && typeof hook.memoizedState === 'object') {
                if (hook.memoizedState.current !== undefined) {
                  hookInfo.type = 'ref'
                  hookInfo.value = hook.memoizedState.current
                } else {
                  hookInfo.type = 'context'
                  hookInfo.value = hook.memoizedState
                }
              }
              
              hooks.push(hookInfo)
              hook = hook.next
            }
            
            return hooks
          }

          function walkFiber(fiber, parentId = null) {
            if (!fiber || visited.has(fiber)) return null
            visited.add(fiber)

            const type = getComponentType(fiber)
            if (type === 'host') {
              // Skip DOM elements but walk children
              if (fiber.child) walkFiber(fiber.child, parentId)
              if (fiber.sibling) walkFiber(fiber.sibling, parentId)
              return null
            }

            const id = 'component_' + (idCounter++)
            fiberToId.set(fiber, id)

            const component = {
              id,
              name: getComponentName(fiber),
              type,
              props: fiber.memoizedProps || {},
              state: fiber.memoizedState,
              hooks: type === 'function' ? extractHooks(fiber) : undefined,
              children: [],
              parentId,
              key: fiber.key,
              ref: fiber.ref,
              source: fiber._debugSource
            }

            // Walk children
            if (fiber.child) {
              let child = fiber.child
              while (child) {
                const childComponent = walkFiber(child, id)
                if (childComponent) {
                  component.children.push(childComponent)
                }
                child = child.sibling
              }
            }

            return component
          }

          // Find all React roots
          const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__
          if (hook && hook.getFiberRoots) {
            const roots = Array.from(hook.getFiberRoots())
            roots.forEach(root => {
              const rootFiber = root.current || root
              const component = walkFiber(rootFiber)
              if (component) {
                components.push(component)
              }
            })
          } else {
            // Fallback: try to find fiber from DOM
            const rootElement = document.querySelector('#root') || document.body.firstElementChild
            if (rootElement) {
              const keys = Object.keys(rootElement)
              const fiberKey = keys.find(key => key.startsWith('__reactFiber'))
              if (fiberKey) {
                const component = walkFiber(rootElement[fiberKey])
                if (component) {
                  components.push(component)
                }
              }
            }
          }

          return components
        })()
      `)

      if (result.error || !result.value) {
        logger.error('Failed to walk fiber tree', result.error)
        return []
      }

      // Process and cache components
      const components = result.value as FiberComponent[]
      this.processComponents(components)
      
      return components
    } catch (error) {
      logger.error('Fiber tree walking failed', error)
      return []
    }
  }

  /**
   * Get a specific component by ID
   */
  async getComponent(componentId: ComponentId): Promise<FiberComponent | null> {
    // Check cache first
    const cached = this.componentCache.get(componentId)
    if (cached) {
      return cached
    }

    // If not in cache, refresh tree
    await this.getComponentTree()
    return this.componentCache.get(componentId) || null
  }

  /**
   * Search components by name
   */
  async searchComponents(query: string): Promise<FiberComponent[]> {
    const tree = await this.getComponentTree()
    const results: FiberComponent[] = []
    const lowerQuery = query.toLowerCase()

    function search(components: FiberComponent[]) {
      for (const component of components) {
        if (component.name.toLowerCase().includes(lowerQuery)) {
          results.push(component)
        }
        if (component.children.length > 0) {
          search(component.children)
        }
      }
    }

    search(tree)
    return results
  }

  /**
   * Get component props
   */
  async getComponentProps(componentId: ComponentId): Promise<Record<string, unknown>> {
    const component = await this.getComponent(componentId)
    return component?.props || {}
  }

  /**
   * Get component state (for class components)
   */
  async getComponentState(componentId: ComponentId): Promise<unknown> {
    const component = await this.getComponent(componentId)
    if (component?.type !== 'class') {
      return null
    }
    return component.state
  }

  /**
   * Get component hooks (for function components)
   */
  async getComponentHooks(componentId: ComponentId): Promise<Array<{
    id: number
    type: string
    value: unknown
  }>> {
    const component = await this.getComponent(componentId)
    if (component?.type !== 'function') {
      return []
    }
    return component.hooks || []
  }

  /**
   * Update component props (triggers re-render)
   */
  async updateComponentProps(
    componentId: ComponentId,
    props: Record<string, unknown>
  ): Promise<boolean> {
    const result = await this.runtime.evaluate<boolean>(`
      (() => {
        const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__
        if (!hook || !hook.getFiberRoots) return false

        // This is a simplified version - full implementation would need
        // to properly handle React's update queue
        console.warn('Component prop updates not fully implemented yet')
        return false
      })()
    `)

    return result.value === true
  }

  /**
   * Highlight component in the DOM
   */
  async highlightComponent(componentId: ComponentId): Promise<void> {
    const component = await this.getComponent(componentId)
    if (!component) return

    await this.runtime.evaluate(`
      (() => {
        // Remove existing highlights
        document.querySelectorAll('.curupira-highlight').forEach(el => {
          el.classList.remove('curupira-highlight')
        })

        // Add highlight styles if not present
        if (!document.getElementById('curupira-styles')) {
          const style = document.createElement('style')
          style.id = 'curupira-styles'
          style.textContent = \`
            .curupira-highlight {
              outline: 2px solid #ff0000 !important;
              outline-offset: 2px !important;
              background-color: rgba(255, 0, 0, 0.1) !important;
            }
          \`
          document.head.appendChild(style)
        }

        // Find DOM element for component
        // This is simplified - real implementation would trace through fiber
        const elements = document.querySelectorAll('*')
        elements.forEach(el => {
          const keys = Object.keys(el)
          const fiberKey = keys.find(key => key.startsWith('__reactFiber'))
          if (fiberKey) {
            // Check if this fiber matches our component
            // Simplified check - would need proper fiber matching
            el.classList.add('curupira-highlight')
          }
        })
      })()
    `)
  }

  /**
   * Process components and build cache
   */
  private processComponents(components: FiberComponent[]): void {
    const process = (comps: FiberComponent[]) => {
      for (const component of comps) {
        this.componentCache.set(component.id, component)
        if (component.children.length > 0) {
          process(component.children)
        }
      }
    }
    process(components)
  }

  /**
   * Get render performance metrics
   */
  async getRenderMetrics(): Promise<{
    renderCount: number
    slowComponents: Array<{
      name: string
      renderTime: number
    }>
  }> {
    const result = await this.runtime.evaluate<any>(`
      (() => {
        // This would integrate with React Profiler API
        // Simplified version for now
        return {
          renderCount: 0,
          slowComponents: []
        }
      })()
    `)

    return result.value || { renderCount: 0, slowComponents: [] }
  }
}