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
    const result = await this.runtime.evaluate<{
      detected: boolean
      version?: string
      hasFiber?: boolean
      strategy?: string
    }>(`
      (() => {
        const detectionResult = {
          detected: false,
          hasFiber: false,
          strategy: 'none'
        };

        // Strategy 1: Look for React's internal properties in DOM
        const allElements = document.querySelectorAll('*');
        let reactPropCount = 0;
        
        for (const element of allElements) {
          const keys = Object.keys(element);
          const hasReactFiber = keys.some(key => 
            key.startsWith('__reactFiber') || 
            key.startsWith('__reactInternalInstance') ||
            key.startsWith('__reactProps') ||
            key.startsWith('_reactRootContainer')
          );
          
          if (hasReactFiber) {
            reactPropCount++;
            if (reactPropCount >= 3) { // Multiple React elements found
              detectionResult.detected = true;
              detectionResult.hasFiber = true;
              detectionResult.strategy = 'fiber-props';
              break;
            }
          }
        }
        
        // Strategy 2: Check for React event handlers
        if (!detectionResult.detected) {
          const hasReactEvents = Array.from(allElements).some(element => {
            const attrs = Array.from(element.attributes || []);
            return attrs.some(attr => 
              attr.name.startsWith('data-reactid') ||
              (element.onclick && element.onclick.toString().includes('react'))
            );
          });
          
          if (hasReactEvents) {
            detectionResult.detected = true;
            detectionResult.strategy = 'react-events';
          }
        }
        
        // Strategy 3: Check for React root container patterns
        if (!detectionResult.detected) {
          const rootSelectors = [
            '#root',
            '#app',
            '[data-reactroot]',
            '.react-root',
            '[id*="react"]',
            '[class*="react-app"]'
          ];
          
          for (const selector of rootSelectors) {
            const element = document.querySelector(selector);
            if (element) {
              const keys = Object.keys(element);
              const hasReactProp = keys.some(key => 
                key.includes('react') || key.includes('React')
              );
              
              if (hasReactProp || element['_reactRootContainer']) {
                detectionResult.detected = true;
                detectionResult.hasFiber = true;
                detectionResult.strategy = 'root-container';
                break;
              }
            }
          }
        }
        
        // Strategy 4: Check for React in bundled code
        if (!detectionResult.detected) {
          const scripts = Array.from(document.scripts);
          const hasReactCode = scripts.some(script => {
            const content = script.textContent || '';
            return content.includes('createElement') && 
                   content.includes('useState') &&
                   (content.includes('ReactDOM') || content.includes('react-dom'));
          });
          
          if (hasReactCode) {
            detectionResult.detected = true;
            detectionResult.strategy = 'bundled-code';
          }
        }
        
        // Strategy 5: Check for common React patterns in DOM structure
        if (!detectionResult.detected) {
          const hasReactPatterns = 
            document.querySelector('div > div > div > div > div') && // Deep nesting common in React
            document.querySelectorAll('div[class]').length > 10 && // Many divs with classes
            !document.querySelector('ng-app') && // Not Angular
            !document.querySelector('[v-cloak]'); // Not Vue
          
          if (hasReactPatterns) {
            // Additional check for React-like class names
            const classNames = Array.from(document.querySelectorAll('[class]'))
              .map(el => el.className)
              .join(' ');
            
            const hasReactClassPatterns = 
              classNames.includes('container') ||
              classNames.includes('wrapper') ||
              classNames.includes('component') ||
              /[A-Z][a-z]+[A-Z]/.test(classNames); // CamelCase pattern
            
            if (hasReactClassPatterns) {
              detectionResult.detected = true;
              detectionResult.strategy = 'dom-patterns';
            }
          }
        }
        
        return detectionResult;
      })()
    `);

    if (result.error || !result.value) {
      return { detected: false, isProduction: true };
    }

    const info = result.value;
    logger.debug('Production React detection', { strategy: info.strategy });
    
    return {
      detected: info.detected,
      isProduction: true,
      hasFiber: info.hasFiber || false,
      version: info.version
    };
  }

  /**
   * Get React Fiber root
   */
  async getFiberRoot(): Promise<ReactFiberNode | null> {
    const result = await this.runtime.evaluate<any>(`
      (() => {
        // Try multiple methods to find the root
        const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
        if (hook && hook.getFiberRoots) {
          const roots = Array.from(hook.getFiberRoots());
          if (roots.length > 0) {
            return roots[0];
          }
        }

        // Enhanced root container search
        const rootSelectors = [
          '#root',
          '#app',
          '[data-reactroot]',
          '.react-root',
          'body > div:first-child',
          'main',
          '[id*="react"]',
          '[class*="app"]'
        ];
        
        for (const selector of rootSelectors) {
          const elements = document.querySelectorAll(selector);
          
          for (const element of elements) {
            const keys = Object.keys(element);
            
            // Check for Fiber properties
            const fiberKey = keys.find(key => key.startsWith('__reactFiber'));
            if (fiberKey) {
              return element[fiberKey];
            }

            // Check for container properties
            const containerKey = keys.find(key => key.startsWith('_reactRootContainer'));
            if (containerKey && element[containerKey]) {
              const root = element[containerKey]._internalRoot?.current || 
                          element[containerKey].current;
              if (root) return root;
            }
            
            // Check for alternate property names (different React versions)
            const altFiberKey = keys.find(key => 
              key.includes('reactFiber') || 
              key.includes('reactInternalInstance')
            );
            if (altFiberKey) {
              return element[altFiberKey];
            }
          }
        }

        // Last resort: scan all elements for React properties
        const allElements = document.querySelectorAll('*');
        for (const element of allElements) {
          const keys = Object.keys(element);
          const reactKey = keys.find(key => 
            key.startsWith('__reactFiber') || 
            key.startsWith('__reactInternalInstance')
          );
          
          if (reactKey && element[reactKey]) {
            // Walk up to find root
            let current = element[reactKey];
            while (current.return) {
              current = current.return;
            }
            return current;
          }
        }

        return null;
      })()
    `);

    if (result.error || !result.value) {
      logger.debug('Could not find React Fiber root');
      return null;
    }

    return result.value;
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