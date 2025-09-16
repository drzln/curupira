/**
 * React Framework Resource Provider
 * Provides deep integration with React applications for debugging
 * 
 * Level 3: Integration Layer (depends on Level 0-2)
 */

import type { SessionId } from '@curupira/shared/types'
import { ChromeManager } from '../../../chrome/manager.js'
import { logger } from '../../../config/logger.js'

export interface ReactInfo {
  version: string
  devtools: boolean
  mode: 'development' | 'production'
  features: string[]
}

export interface FiberNode {
  id: string
  type: string
  displayName: string
  props: Record<string, unknown>
  state: Record<string, unknown>
  hooks: Hook[]
  children: FiberNode[]
  parent?: string
  key?: string
  source?: {
    fileName: string
    lineNumber: number
    columnNumber: number
  }
}

export interface Hook {
  id: number
  type: 'useState' | 'useEffect' | 'useContext' | 'useReducer' | 'useMemo' | 'useCallback' | 'useRef' | 'custom'
  name?: string
  value: unknown
  deps?: unknown[]
}

export interface ReactResourceProvider {
  detectReact(sessionId: SessionId): Promise<ReactInfo | null>
  getFiberTree(sessionId: SessionId): Promise<FiberNode[]>
  getComponentHooks(sessionId: SessionId, componentId: string): Promise<Hook[]>
  getComponentProps(sessionId: SessionId, componentId: string): Promise<Record<string, unknown>>
  getComponentState(sessionId: SessionId, componentId: string): Promise<Record<string, unknown>>
  getReactPerformance(sessionId: SessionId): Promise<unknown>
  findComponentsByName(sessionId: SessionId, name: string): Promise<FiberNode[]>
  getContextValues(sessionId: SessionId): Promise<Record<string, unknown>>
}

export class ReactFrameworkProvider implements ReactResourceProvider {
  private chromeManager: ChromeManager

  constructor() {
    this.chromeManager = ChromeManager.getInstance()
  }

  async detectReact(sessionId: SessionId): Promise<ReactInfo | null> {
    const client = this.chromeManager.getClient()
    
    try {
      const result = await client.send('Runtime.evaluate', {
        expression: `
          (() => {
            // Check for React
            if (typeof window.React === 'undefined') {
              return null;
            }
            
            const reactInfo = {
              version: window.React.version || 'unknown',
              devtools: !!(window.__REACT_DEVTOOLS_GLOBAL_HOOK__),
              mode: process.env.NODE_ENV === 'development' ? 'development' : 'production',
              features: []
            };
            
            // Check for React features
            if (window.React.useState) reactInfo.features.push('hooks');
            if (window.React.Suspense) reactInfo.features.push('suspense');
            if (window.React.lazy) reactInfo.features.push('lazy');
            if (window.React.memo) reactInfo.features.push('memo');
            if (window.React.forwardRef) reactInfo.features.push('forwardRef');
            if (window.React.createContext) reactInfo.features.push('context');
            if (window.React.StrictMode) reactInfo.features.push('strictMode');
            if (window.React.Fragment) reactInfo.features.push('fragments');
            
            // Check for concurrent features (React 18+)
            if (window.React.startTransition) reactInfo.features.push('concurrent');
            if (window.React.useDeferredValue) reactInfo.features.push('deferredValue');
            if (window.React.useTransition) reactInfo.features.push('transition');
            if (window.React.useId) reactInfo.features.push('useId');
            
            return reactInfo;
          })()
        `,
        returnByValue: true
      }, sessionId)
      
      if (result && typeof result === 'object' && 'result' in result) {
        const evalResult = result as { result: { value: ReactInfo | null } }
        return evalResult.result.value
      }
      
      return null
    } catch (error) {
      logger.error('Failed to detect React:', error)
      return null
    }
  }

  async getFiberTree(sessionId: SessionId): Promise<FiberNode[]> {
    const client = this.chromeManager.getClient()
    
    try {
      const result = await client.send('Runtime.evaluate', {
        expression: `
          (() => {
            if (!window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
              return [];
            }
            
            const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
            const renderers = hook.renderers;
            
            if (!renderers || renderers.size === 0) {
              return [];
            }
            
            // Get the first renderer (usually the main one)
            const renderer = Array.from(renderers.values())[0];
            const fiberRoot = renderer.getCurrentFiber ? renderer.getCurrentFiber() : null;
            
            if (!fiberRoot) {
              return [];
            }
            
            function traverseFiber(fiber, depth = 0) {
              if (!fiber || depth > 50) return null; // Prevent infinite recursion
              
              const node = {
                id: fiber._debugID || Math.random().toString(36),
                type: typeof fiber.type === 'string' ? fiber.type :
                      typeof fiber.type === 'function' ? fiber.type.name || 'Component' :
                      fiber.elementType?.name || 'Unknown',
                displayName: fiber._debugSource?.fileName ? 
                  fiber.type?.displayName || fiber.type?.name || 'Component' : 
                  'Anonymous',
                props: {},
                state: {},
                hooks: [],
                children: [],
                key: fiber.key,
                source: fiber._debugSource ? {
                  fileName: fiber._debugSource.fileName,
                  lineNumber: fiber._debugSource.lineNumber,
                  columnNumber: fiber._debugSource.columnNumber
                } : undefined
              };
              
              // Extract props (be careful with circular references)
              if (fiber.memoizedProps) {
                try {
                  node.props = JSON.parse(JSON.stringify(fiber.memoizedProps, (key, value) => {
                    if (typeof value === 'function') return '[Function]';
                    if (typeof value === 'object' && value !== null) {
                      if (value.$$typeof) return '[React Element]';
                      if (value._owner) return '[React Component]';
                    }
                    return value;
                  }));
                } catch (e) {
                  node.props = { _error: 'Could not serialize props' };
                }
              }
              
              // Extract state
              if (fiber.memoizedState) {
                try {
                  node.state = JSON.parse(JSON.stringify(fiber.memoizedState, (key, value) => {
                    if (typeof value === 'function') return '[Function]';
                    return value;
                  }));
                } catch (e) {
                  node.state = { _error: 'Could not serialize state' };
                }
              }
              
              // Extract hooks (for function components)
              if (fiber.memoizedState && typeof fiber.type === 'function') {
                let hookIndex = 0;
                let currentHook = fiber.memoizedState;
                
                while (currentHook && hookIndex < 20) { // Limit hook traversal
                  try {
                    node.hooks.push({
                      id: hookIndex,
                      type: 'unknown',
                      value: currentHook.memoizedState
                    });
                  } catch (e) {
                    node.hooks.push({
                      id: hookIndex,
                      type: 'error',
                      value: 'Could not access hook'
                    });
                  }
                  
                  currentHook = currentHook.next;
                  hookIndex++;
                }
              }
              
              // Traverse children
              let child = fiber.child;
              while (child && node.children.length < 50) { // Limit children
                const childNode = traverseFiber(child, depth + 1);
                if (childNode) {
                  node.children.push(childNode);
                }
                child = child.sibling;
              }
              
              return node;
            }
            
            return [traverseFiber(fiberRoot)].filter(Boolean);
          })()
        `,
        returnByValue: true
      }, sessionId)
      
      if (result && typeof result === 'object' && 'result' in result) {
        const evalResult = result as { result: { value: FiberNode[] } }
        return evalResult.result.value || []
      }
      
      return []
    } catch (error) {
      logger.error('Failed to get Fiber tree:', error)
      return []
    }
  }

  async getComponentHooks(sessionId: SessionId, componentId: string): Promise<Hook[]> {
    const client = this.chromeManager.getClient()
    
    try {
      const result = await client.send('Runtime.evaluate', {
        expression: `
          (() => {
            // This would require more sophisticated fiber traversal
            // to find specific component by ID and extract hooks
            return [];
          })()
        `,
        returnByValue: true
      }, sessionId)
      
      // For now, return empty array - would need more sophisticated implementation
      return []
    } catch (error) {
      logger.error('Failed to get component hooks:', error)
      return []
    }
  }

  async getComponentProps(sessionId: SessionId, componentId: string): Promise<Record<string, unknown>> {
    const client = this.chromeManager.getClient()
    
    try {
      // This would require finding the specific component in the fiber tree
      return {}
    } catch (error) {
      logger.error('Failed to get component props:', error)
      return {}
    }
  }

  async getComponentState(sessionId: SessionId, componentId: string): Promise<Record<string, unknown>> {
    const client = this.chromeManager.getClient()
    
    try {
      // This would require finding the specific component in the fiber tree
      return {}
    } catch (error) {
      logger.error('Failed to get component state:', error)
      return {}
    }
  }

  async getReactPerformance(sessionId: SessionId): Promise<unknown> {
    const client = this.chromeManager.getClient()
    
    try {
      const result = await client.send('Runtime.evaluate', {
        expression: `
          (() => {
            if (!window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
              return { error: 'React DevTools not available' };
            }
            
            // Try to get performance information
            const performance = {
              renders: [],
              commits: [],
              measurements: []
            };
            
            // Check if React profiler is available
            if (window.React && window.React.Profiler) {
              performance.profilerAvailable = true;
            }
            
            // Get render timing from React DevTools hook if available
            const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
            if (hook.onCommitFiberRoot) {
              performance.devtoolsIntegration = true;
            }
            
            return performance;
          })()
        `,
        returnByValue: true
      }, sessionId)
      
      if (result && typeof result === 'object' && 'result' in result) {
        const evalResult = result as { result: { value: unknown } }
        return evalResult.result.value
      }
      
      return { error: 'Could not get React performance data' }
    } catch (error) {
      logger.error('Failed to get React performance:', error)
      return { error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  async findComponentsByName(sessionId: SessionId, name: string): Promise<FiberNode[]> {
    const fiberTree = await this.getFiberTree(sessionId)
    
    function findByName(nodes: FiberNode[], targetName: string): FiberNode[] {
      const results: FiberNode[] = []
      
      for (const node of nodes) {
        if (node.displayName?.toLowerCase().includes(targetName.toLowerCase()) ||
            node.type?.toLowerCase().includes(targetName.toLowerCase())) {
          results.push(node)
        }
        
        results.push(...findByName(node.children, targetName))
      }
      
      return results
    }
    
    return findByName(fiberTree, name)
  }

  async getContextValues(sessionId: SessionId): Promise<Record<string, unknown>> {
    const client = this.chromeManager.getClient()
    
    try {
      const result = await client.send('Runtime.evaluate', {
        expression: `
          (() => {
            const contexts = {};
            
            // Try to find React contexts in the global scope
            if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
              const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
              
              // This would require deep integration with React DevTools
              // to extract context values from the fiber tree
            }
            
            return contexts;
          })()
        `,
        returnByValue: true
      }, sessionId)
      
      if (result && typeof result === 'object' && 'result' in result) {
        const evalResult = result as { result: { value: Record<string, unknown> } }
        return evalResult.result.value || {}
      }
      
      return {}
    } catch (error) {
      logger.error('Failed to get context values:', error)
      return {}
    }
  }
}