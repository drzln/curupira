/**
 * React DevTools Injector for Production Builds
 * 
 * Injects a minimal React DevTools hook to enable inspection
 * of production React applications
 */

import type { RuntimeDomain } from '../../chrome/domains/runtime.js';
import { logger } from '../../config/logger.js';

export class ReactDevToolsInjector {
  constructor(private runtime: RuntimeDomain) {}

  /**
   * Inject React DevTools hook for production builds
   */
  async inject(): Promise<boolean> {
    try {
      // First check if hook already exists
      const hasHook = await this.checkExistingHook();
      if (hasHook) {
        logger.debug('React DevTools hook already present');
        return true;
      }

      // Inject the hook
      const injected = await this.injectHook();
      if (!injected) {
        logger.warn('Failed to inject React DevTools hook');
        return false;
      }

      // Try to capture existing React instances
      await this.captureExistingReactInstances();

      // Set up mutation observer for new React roots
      await this.setupMutationObserver();

      logger.info('React DevTools hook injected successfully');
      return true;
    } catch (error) {
      logger.error('Error injecting React DevTools hook', error);
      return false;
    }
  }

  private async checkExistingHook(): Promise<boolean> {
    const result = await this.runtime.evaluate<boolean>(`
      !!window.__REACT_DEVTOOLS_GLOBAL_HOOK__
    `);
    return result.value === true;
  }

  private async injectHook(): Promise<boolean> {
    const result = await this.runtime.evaluate<boolean>(`
      (() => {
        try {
          // Create a comprehensive hook that mimics React DevTools
          const hook = {
            renderers: new Map(),
            supportsFiber: true,
            _fiberRoots: new Map(),
            _rootIDCounter: 1,
            
            // Core hook methods
            inject(renderer) {
              const id = this._rootIDCounter++;
              this.renderers.set(id, {
                ...renderer,
                version: renderer.version || '18.0.0', // Assume modern React
                renderer: 'react-dom',
                rendererPackageName: 'react-dom'
              });
              return id;
            },
            
            onCommitFiberRoot(id, root, priorityLevel) {
              if (!root) return;
              
              // Store the fiber root
              this._fiberRoots.set(id, root);
              
              // Emit event for tools
              if (this._listeners && this._listeners.size > 0) {
                this._listeners.forEach(listener => {
                  listener({ type: 'commit', id, root });
                });
              }
            },
            
            onCommitFiberUnmount(id, fiber) {
              // Handle unmounting
              if (this._listeners && this._listeners.size > 0) {
                this._listeners.forEach(listener => {
                  listener({ type: 'unmount', id, fiber });
                });
              }
            },
            
            // DevTools specific methods
            getFiberRoots() {
              return Array.from(this._fiberRoots.values());
            },
            
            hasDetectedReact() {
              return this.renderers.size > 0 || this._fiberRoots.size > 0;
            },
            
            // Event subscription
            _listeners: new Set(),
            sub(listener) {
              this._listeners.add(listener);
              return () => this._listeners.delete(listener);
            },
            
            // Helper methods for inspection
            inspectElement(id, path) {
              const root = this._fiberRoots.get(id);
              if (!root) return null;
              
              let current = root.current || root;
              for (const key of path || []) {
                current = current[key];
                if (!current) return null;
              }
              
              return {
                type: current.type,
                props: current.memoizedProps || current.props,
                state: current.memoizedState || current.state,
                hooks: this._extractHooks(current)
              };
            },
            
            _extractHooks(fiber) {
              if (!fiber.memoizedState) return null;
              
              const hooks = [];
              let hook = fiber.memoizedState;
              
              while (hook) {
                hooks.push({
                  state: hook.memoizedState,
                  next: !!hook.next
                });
                hook = hook.next;
              }
              
              return hooks;
            }
          };
          
          // Install the hook
          Object.defineProperty(window, '__REACT_DEVTOOLS_GLOBAL_HOOK__', {
            value: hook,
            writable: false,
            enumerable: false,
            configurable: false
          });
          
          // Dispatch event to notify React
          window.dispatchEvent(new Event('ReactDevToolsHookInit'));
          
          return true;
        } catch (error) {
          console.error('Failed to inject React DevTools hook:', error);
          return false;
        }
      })()
    `);
    
    return result.value === true;
  }

  private async captureExistingReactInstances(): Promise<void> {
    await this.runtime.evaluate(`
      (() => {
        const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
        if (!hook) return;
        
        // Find all elements with React properties
        const elements = document.querySelectorAll('*');
        const foundRoots = new Set();
        
        for (const element of elements) {
          const keys = Object.keys(element);
          
          // Look for React Fiber
          const fiberKey = keys.find(key => key.startsWith('__reactFiber'));
          if (fiberKey && element[fiberKey]) {
            const fiber = element[fiberKey];
            
            // Walk up to find root
            let current = fiber;
            while (current.return) {
              current = current.return;
            }
            
            // Register the root if not already found
            const rootId = current.stateNode || current;
            if (!foundRoots.has(rootId)) {
              foundRoots.add(rootId);
              hook.onCommitFiberRoot(hook._rootIDCounter++, current);
            }
          }
          
          // Look for React Root Container
          const containerKey = keys.find(key => key.startsWith('_reactRootContainer'));
          if (containerKey && element[containerKey]) {
            const container = element[containerKey];
            const root = container._internalRoot || container;
            
            if (!foundRoots.has(root)) {
              foundRoots.add(root);
              hook.onCommitFiberRoot(hook._rootIDCounter++, root.current || root);
            }
          }
        }
        
        console.log('Captured', foundRoots.size, 'React root(s)');
      })()
    `);
  }

  private async setupMutationObserver(): Promise<void> {
    await this.runtime.evaluate(`
      (() => {
        const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
        if (!hook || hook._mutationObserver) return;
        
        // Set up observer for new React roots
        const observer = new MutationObserver((mutations) => {
          for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
              if (node.nodeType === Node.ELEMENT_NODE) {
                // Check if this element has React properties
                setTimeout(() => {
                  const keys = Object.keys(node);
                  const fiberKey = keys.find(key => key.startsWith('__reactFiber'));
                  
                  if (fiberKey && node[fiberKey]) {
                    // New React element detected
                    console.log('New React element detected:', node);
                  }
                }, 100); // Small delay to let React initialize
              }
            }
          }
        });
        
        observer.observe(document.body, {
          childList: true,
          subtree: true
        });
        
        hook._mutationObserver = observer;
      })()
    `);
  }

  /**
   * Check if injection was successful
   */
  async verify(): Promise<boolean> {
    const result = await this.runtime.evaluate<{
      hasHook: boolean;
      hasReact: boolean;
      rootCount: number;
    }>(`
      (() => {
        const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
        return {
          hasHook: !!hook,
          hasReact: hook ? hook.hasDetectedReact() : false,
          rootCount: hook ? hook._fiberRoots.size : 0
        };
      })()
    `);

    if (result.error || !result.value) {
      return false;
    }

    const { hasHook, hasReact, rootCount } = result.value;
    logger.debug('DevTools injection verification', { hasHook, hasReact, rootCount });
    
    return hasHook && (hasReact || rootCount > 0);
  }
}