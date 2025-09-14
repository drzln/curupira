/**
 * @fileoverview React DevTools integration
 */

import { EventEmitter } from 'events'
import { createLogger, type Logger } from '@curupira/shared'

/**
 * React component data interface
 */
export interface ReactComponent {
  id: string
  name: string
  displayName: string
  type: string
  key?: string | number
  props: Record<string, any>
  state?: Record<string, any>
  hooks?: ReactHook[]
  source?: {
    fileName: string
    lineNumber: number
  }
  parent?: string
  children: string[]
  fiber?: {
    tag: number
    type: any
    stateNode: any
    memoizedProps: any
    memoizedState: any
  }
}

/**
 * React hook data interface
 */
export interface ReactHook {
  id: number
  name: string
  value: any
  subHooks?: ReactHook[]
  debugSource?: {
    fileName: string
    lineNumber: number
  }
}

/**
 * React tree update event
 */
export interface ReactTreeUpdate {
  timestamp: number
  type: 'mount' | 'update' | 'unmount'
  components: ReactComponent[]
  rootId: string
}

/**
 * React DevTools integration events
 */
export interface ReactDevToolsEvents {
  'component.mount': (component: ReactComponent) => void
  'component.update': (component: ReactComponent) => void
  'component.unmount': (componentId: string) => void
  'tree.update': (update: ReactTreeUpdate) => void
  'props.change': (componentId: string, props: Record<string, any>) => void
  'state.change': (componentId: string, state: Record<string, any>) => void
  'hooks.change': (componentId: string, hooks: ReactHook[]) => void
  'error': (error: Error) => void
}

/**
 * React DevTools integration configuration
 */
export interface ReactDevToolsConfig {
  enableProfiling?: boolean
  maxTreeSize?: number
  filterComponents?: (component: ReactComponent) => boolean
  sanitizeProps?: (props: any) => any
  trackHooks?: boolean
  debugMode?: boolean
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: ReactDevToolsConfig = {
  enableProfiling: false,
  maxTreeSize: 1000,
  filterComponents: () => true,
  sanitizeProps: (props) => props,
  trackHooks: true,
  debugMode: false,
}

/**
 * React DevTools integration
 */
export class ReactDevTools extends EventEmitter<ReactDevToolsEvents> {
  private readonly logger: Logger
  private readonly config: ReactDevToolsConfig
  private readonly componentTree = new Map<string, ReactComponent>()
  private readonly fiberMap = new Map<any, string>()
  private globalHook?: any
  private rendererID?: number
  private isAttached = false

  constructor(config: ReactDevToolsConfig = {}) {
    super()
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.logger = createLogger({ 
      level: this.config.debugMode ? 'debug' : 'info' 
    })
  }

  /**
   * Attach to React DevTools global hook
   */
  async attach(): Promise<void> {
    if (this.isAttached) {
      return
    }

    try {
      // Get React DevTools global hook
      this.globalHook = (globalThis as any).__REACT_DEVTOOLS_GLOBAL_HOOK__
      
      if (!this.globalHook) {
        throw new Error('React DevTools global hook not found')
      }

      // Hook into React renderer events
      this.setupRendererHooks()
      
      this.isAttached = true
      this.logger.info('React DevTools integration attached')
      
    } catch (error) {
      this.logger.error({ error }, 'Failed to attach React DevTools')
      this.emit('error', error instanceof Error ? error : new Error(String(error)))
      throw error
    }
  }

  /**
   * Detach from React DevTools
   */
  detach(): void {
    if (!this.isAttached) {
      return
    }

    this.cleanupHooks()
    this.componentTree.clear()
    this.fiberMap.clear()
    this.isAttached = false
    
    this.logger.info('React DevTools integration detached')
  }

  /**
   * Get component tree
   */
  getComponentTree(): ReactComponent[] {
    return Array.from(this.componentTree.values())
  }

  /**
   * Get component by ID
   */
  getComponent(id: string): ReactComponent | undefined {
    return this.componentTree.get(id)
  }

  /**
   * Get component by fiber
   */
  getComponentByFiber(fiber: any): ReactComponent | undefined {
    const id = this.fiberMap.get(fiber)
    return id ? this.componentTree.get(id) : undefined
  }

  /**
   * Select component (highlight in DevTools)
   */
  selectComponent(id: string): void {
    const component = this.componentTree.get(id)
    if (!component) {
      throw new Error(`Component not found: ${id}`)
    }

    // Trigger DevTools selection if available
    if (this.globalHook?.selectFiber) {
      this.globalHook.selectFiber(component.fiber)
    }
  }

  /**
   * Update component props (for testing)
   */
  updateComponentProps(id: string, props: Record<string, any>): void {
    const component = this.componentTree.get(id)
    if (!component || !component.fiber) {
      throw new Error(`Component not found: ${id}`)
    }

    // Update fiber props
    component.fiber.memoizedProps = { ...component.fiber.memoizedProps, ...props }
    component.props = this.config.sanitizeProps!(props)
    
    // Force re-render
    if (component.fiber.stateNode?.forceUpdate) {
      component.fiber.stateNode.forceUpdate()
    }

    this.emit('props.change', id, component.props)
  }

  /**
   * Update component state (for testing)
   */
  updateComponentState(id: string, state: Record<string, any>): void {
    const component = this.componentTree.get(id)
    if (!component || !component.fiber) {
      throw new Error(`Component not found: ${id}`)
    }

    // Update fiber state
    if (component.fiber.stateNode?.setState) {
      component.fiber.stateNode.setState(state)
    }

    this.emit('state.change', id, state)
  }

  /**
   * Setup React renderer hooks
   */
  private setupRendererHooks(): void {
    if (!this.globalHook) return

    // Hook into fiber commit events
    const originalOnCommitFiberRoot = this.globalHook.onCommitFiberRoot
    this.globalHook.onCommitFiberRoot = (id: number, root: any, ...args: any[]) => {
      try {
        this.rendererID = id
        this.handleFiberRootCommit(root)
      } catch (error) {
        this.logger.error({ error }, 'Error handling fiber root commit')
      }
      
      return originalOnCommitFiberRoot?.call(this.globalHook, id, root, ...args)
    }

    // Hook into fiber unmount events
    const originalOnCommitFiberUnmount = this.globalHook.onCommitFiberUnmount
    this.globalHook.onCommitFiberUnmount = (id: number, fiber: any, ...args: any[]) => {
      try {
        this.handleFiberUnmount(fiber)
      } catch (error) {
        this.logger.error({ error }, 'Error handling fiber unmount')
      }
      
      return originalOnCommitFiberUnmount?.call(this.globalHook, id, fiber, ...args)
    }

    this.logger.debug('React renderer hooks setup complete')
  }

  /**
   * Handle fiber root commit
   */
  private handleFiberRootCommit(root: any): void {
    if (!root || !root.current) return

    const rootId = this.generateComponentId(root.current)
    const components: ReactComponent[] = []
    
    this.traverseFiber(root.current, null, components)
    
    // Filter components if configured
    const filteredComponents = components.filter(this.config.filterComponents!)
    
    // Limit tree size if configured
    const limitedComponents = filteredComponents.slice(0, this.config.maxTreeSize)
    
    // Update component tree
    for (const component of limitedComponents) {
      const existing = this.componentTree.get(component.id)
      if (existing) {
        // Component update
        this.updateComponent(existing, component)
        this.emit('component.update', component)
      } else {
        // Component mount
        this.componentTree.set(component.id, component)
        this.emit('component.mount', component)
      }
    }

    // Emit tree update event
    this.emit('tree.update', {
      timestamp: Date.now(),
      type: 'update',
      components: limitedComponents,
      rootId
    })
  }

  /**
   * Handle fiber unmount
   */
  private handleFiberUnmount(fiber: any): void {
    const componentId = this.fiberMap.get(fiber)
    if (componentId) {
      this.componentTree.delete(componentId)
      this.fiberMap.delete(fiber)
      this.emit('component.unmount', componentId)
    }
  }

  /**
   * Traverse fiber tree
   */
  private traverseFiber(
    fiber: any, 
    parentId: string | null, 
    components: ReactComponent[]
  ): void {
    if (!fiber) return

    const component = this.fiberToComponent(fiber, parentId)
    if (component) {
      components.push(component)
      
      // Traverse children
      let child = fiber.child
      while (child) {
        this.traverseFiber(child, component.id, components)
        child = child.sibling
      }
    }
  }

  /**
   * Convert fiber to component
   */
  private fiberToComponent(fiber: any, parentId: string | null): ReactComponent | null {
    if (!this.shouldIncludeFiber(fiber)) {
      return null
    }

    const id = this.generateComponentId(fiber)
    this.fiberMap.set(fiber, id)

    const component: ReactComponent = {
      id,
      name: this.getFiberName(fiber),
      displayName: this.getFiberDisplayName(fiber),
      type: this.getFiberType(fiber),
      key: fiber.key,
      props: this.config.sanitizeProps!(fiber.memoizedProps || {}),
      state: this.extractState(fiber),
      hooks: this.config.trackHooks ? this.extractHooks(fiber) : undefined,
      source: this.extractSource(fiber),
      parent: parentId || undefined,
      children: [],
      fiber
    }

    return component
  }

  /**
   * Check if fiber should be included
   */
  private shouldIncludeFiber(fiber: any): boolean {
    // Skip fragments and other non-component fibers
    if (!fiber.type) return false
    
    // Skip internal React components
    const name = this.getFiberName(fiber)
    if (name.startsWith('React.') || name.startsWith('_')) return false
    
    return true
  }

  /**
   * Get fiber name
   */
  private getFiberName(fiber: any): string {
    if (!fiber.type) return 'Unknown'
    
    if (typeof fiber.type === 'string') {
      return fiber.type
    }
    
    if (typeof fiber.type === 'function') {
      return fiber.type.displayName || fiber.type.name || 'Anonymous'
    }
    
    return 'Component'
  }

  /**
   * Get fiber display name
   */
  private getFiberDisplayName(fiber: any): string {
    return fiber.type?.displayName || this.getFiberName(fiber)
  }

  /**
   * Get fiber type
   */
  private getFiberType(fiber: any): string {
    switch (fiber.tag) {
      case 0: return 'FunctionComponent'
      case 1: return 'ClassComponent' 
      case 5: return 'HostComponent'
      case 6: return 'HostText'
      case 7: return 'Fragment'
      case 11: return 'ForwardRef'
      case 14: return 'MemoComponent'
      case 15: return 'SimpleMemoComponent'
      default: return 'Unknown'
    }
  }

  /**
   * Extract component state
   */
  private extractState(fiber: any): Record<string, any> | undefined {
    if (!fiber.stateNode) return undefined
    
    // Class component state
    if (fiber.stateNode.state) {
      return fiber.stateNode.state
    }
    
    return undefined
  }

  /**
   * Extract hooks (simplified)
   */
  private extractHooks(fiber: any): ReactHook[] | undefined {
    if (!fiber.memoizedState) return undefined
    
    const hooks: ReactHook[] = []
    let current = fiber.memoizedState
    let id = 0
    
    while (current && id < 20) { // Limit to prevent infinite loops
      hooks.push({
        id,
        name: this.guessHookName(current),
        value: this.sanitizeHookValue(current.memoizedState)
      })
      
      current = current.next
      id++
    }
    
    return hooks.length > 0 ? hooks : undefined
  }

  /**
   * Guess hook name from hook data
   */
  private guessHookName(hook: any): string {
    // This is a simplified implementation
    // Real React DevTools uses more sophisticated hook detection
    if (hook.queue) return 'useState'
    if (hook.create) return 'useEffect'
    if (hook.deps) return 'useMemo'
    return 'useCustom'
  }

  /**
   * Sanitize hook value for serialization
   */
  private sanitizeHookValue(value: any): any {
    if (value === null || value === undefined) return value
    if (typeof value === 'function') return '[Function]'
    if (typeof value === 'symbol') return '[Symbol]'
    
    try {
      JSON.stringify(value)
      return value
    } catch {
      return '[Unserializable]'
    }
  }

  /**
   * Extract source location
   */
  private extractSource(fiber: any): ReactComponent['source'] | undefined {
    // This would require source map integration in a real implementation
    return undefined
  }

  /**
   * Generate component ID
   */
  private generateComponentId(fiber: any): string {
    return `react_${fiber._debugID || Math.random().toString(36).substring(2)}`
  }

  /**
   * Update existing component
   */
  private updateComponent(existing: ReactComponent, updated: ReactComponent): void {
    existing.props = updated.props
    existing.state = updated.state
    existing.hooks = updated.hooks
    existing.fiber = updated.fiber
  }

  /**
   * Cleanup hooks
   */
  private cleanupHooks(): void {
    if (this.globalHook) {
      // Restore original methods if we stored them
      // This would be more complete in a real implementation
    }
  }
}