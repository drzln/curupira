/**
 * React Router Tool Provider Factory - Level 2 (MCP Core)
 * Factory implementation for React Router debugging tools
 * Tailored for NovaSkyn's React Router navigation architecture
 */

import type { IToolProviderFactory, ProviderDependencies } from '../provider.factory.js';
import { BaseProviderFactory } from '../provider.factory.js';
import type { BaseToolProviderConfig } from '../base-tool-provider.js';
import { BaseToolProvider } from '../base-tool-provider.js';
import type { Schema } from '../../../core/interfaces/validator.interface.js';
import { withCDPCommand, withScriptExecution } from '../patterns/common-handlers.js';

// Schema definitions for React Router tools
const routerDetectionSchema: Schema<{ sessionId?: string }> = {
  parse: (value) => {
    const obj = (value || {}) as any;
    return {
      sessionId: obj.sessionId
    };
  },
  safeParse: function(value) {
    try {
      const parsed = this.parse(value);
      return { success: true, data: parsed };
    } catch (error) {
      return { success: false, error };
    }
  }
};

const routeInspectSchema: Schema<{ 
  includeParams?: boolean; 
  includeQuery?: boolean; 
  includeState?: boolean;
  sessionId?: string;
}> = {
  parse: (value) => {
    const obj = (value || {}) as any;
    return {
      includeParams: typeof obj.includeParams === 'boolean' ? obj.includeParams : true,
      includeQuery: typeof obj.includeQuery === 'boolean' ? obj.includeQuery : true,
      includeState: typeof obj.includeState === 'boolean' ? obj.includeState : true,
      sessionId: obj.sessionId
    };
  },
  safeParse: function(value) {
    try {
      const parsed = this.parse(value);
      return { success: true, data: parsed };
    } catch (error) {
      return { success: false, error };
    }
  }
};

const navigationSchema: Schema<{ 
  to: string; 
  replace?: boolean; 
  state?: any;
  sessionId?: string;
}> = {
  parse: (value) => {
    if (typeof value !== 'object' || value === null) {
      throw new Error('Expected object');
    }
    const obj = value as any;
    if (typeof obj.to !== 'string') {
      throw new Error('to must be a string');
    }
    return {
      to: obj.to,
      replace: typeof obj.replace === 'boolean' ? obj.replace : false,
      state: obj.state,
      sessionId: obj.sessionId
    };
  },
  safeParse: function(value) {
    try {
      const parsed = this.parse(value);
      return { success: true, data: parsed };
    } catch (error) {
      return { success: false, error };
    }
  }
};

class ReactRouterToolProvider extends BaseToolProvider {
  protected initializeTools(): void {
    // Register react_router_detect tool
    this.registerTool(
      this.createTool(
        'react_router_detect',
        'Detect React Router version and configuration',
        routerDetectionSchema,
        async (args, context) => {
          const detectionScript = `
            (function() {
              const routerInfo = {
                detected: false,
                version: null,
                router: null,
                routes: [],
                hooks: []
              };
              
              // Method 1: Check for React Router in global scope
              if (window.ReactRouter || window.ReactRouterDOM) {
                routerInfo.detected = true;
                const router = window.ReactRouter || window.ReactRouterDOM;
                routerInfo.version = router.version || router.VERSION || 'unknown';
                routerInfo.router = router;
              }
              
              // Method 2: Check for useNavigate, useLocation hooks
              const possibleHooks = [
                'useNavigate', 'useLocation', 'useParams', 'useSearchParams',
                'useRoutes', 'useNavigationType', 'useResolvedPath'
              ];
              
              possibleHooks.forEach(hookName => {
                if (window[hookName] || window.React?.[hookName]) {
                  routerInfo.hooks.push(hookName);
                  routerInfo.detected = true;
                }
              });
              
              // Method 3: Check for Router components in React DevTools
              if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
                try {
                  const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
                  
                  // Look for Router components
                  const routerComponents = [];
                  const checkFiber = (fiber) => {
                    if (!fiber) return;
                    
                    const componentName = fiber.type?.name || fiber.elementType?.name;
                    if (componentName && (
                      componentName.includes('Router') ||
                      componentName.includes('Route') ||
                      componentName === 'Switch' ||
                      componentName === 'Routes'
                    )) {
                      routerComponents.push({
                        name: componentName,
                        props: fiber.memoizedProps || {},
                        key: fiber.key
                      });
                      routerInfo.detected = true;
                    }
                    
                    // Recursively check children
                    if (fiber.child) checkFiber(fiber.child);
                    if (fiber.sibling) checkFiber(fiber.sibling);
                  };
                  
                  // Check all React roots
                  const containers = document.querySelectorAll('[data-reactroot], #root, .react-root');
                  containers.forEach(container => {
                    const fiberRoot = container._reactInternalFiber || 
                                    container._reactInternalInstance ||
                                    container.__reactInternalInstance ||
                                    container._reactRootContainer?._internalRoot;
                    
                    if (fiberRoot) {
                      checkFiber(fiberRoot.current || fiberRoot);
                    }
                  });
                  
                  routerInfo.routerComponents = routerComponents;
                } catch (error) {
                  routerInfo.devtoolsError = error.message;
                }
              }
              
              // Method 4: Check current location and history
              if (routerInfo.detected) {
                try {
                  routerInfo.currentLocation = {
                    pathname: window.location.pathname,
                    search: window.location.search,
                    hash: window.location.hash,
                    state: window.history.state
                  };
                  
                  // Try to get React Router location if available
                  if (window.__reactRouterLocation) {
                    routerInfo.reactRouterLocation = window.__reactRouterLocation;
                  }
                } catch (error) {
                  routerInfo.locationError = error.message;
                }
              }
              
              // Method 5: Check for route configuration
              if (window.__REACT_ROUTER_ROUTES__ || window.routes) {
                routerInfo.routeConfig = window.__REACT_ROUTER_ROUTES__ || window.routes;
                routerInfo.detected = true;
              }
              
              // Method 6: Analyze URL patterns and route matching
              if (routerInfo.detected) {
                const pathname = window.location.pathname;
                const segments = pathname.split('/').filter(Boolean);
                
                routerInfo.routeAnalysis = {
                  segments,
                  segmentCount: segments.length,
                  hasParams: segments.some(segment => segment.startsWith(':')),
                  hasWildcard: pathname.includes('*'),
                  isRoot: pathname === '/',
                  pathPattern: pathname.replace(/\/[^\/]*\d+[^\/]*\//g, '/:id/')
                };
              }
              
              // Method 7: Check for navigation history
              try {
                routerInfo.historyLength = window.history.length;
                routerInfo.canGoBack = window.history.length > 1;
                routerInfo.historyState = window.history.state;
              } catch (error) {
                routerInfo.historyError = error.message;
              }
              
              return {
                ...routerInfo,
                timestamp: new Date().toISOString(),
                summary: {
                  detected: routerInfo.detected,
                  version: routerInfo.version || 'unknown',
                  hooksDetected: routerInfo.hooks.length,
                  routerComponents: routerInfo.routerComponents?.length || 0,
                  currentPath: window.location.pathname,
                  confidence: routerInfo.routerComponents?.length > 0 ? 'high' :
                            routerInfo.hooks.length > 0 ? 'medium' :
                            routerInfo.detected ? 'low' : 'none'
                }
              };
            })()
          `;

          const result = await withCDPCommand(
            'Runtime.evaluate',
            {
              expression: detectionScript,
              returnByValue: true,
              generatePreview: false
            },
            context
          );

          if (result.isErr()) {
            return {
              success: false,
              error: result.unwrapErr()
            };
          }

          const unwrapped = result.unwrap() as any;
          return {
            success: true,
            data: unwrapped.result?.value || { detected: false }
          };
        },
        {
          type: 'object',
          properties: {
            sessionId: { 
              type: 'string', 
              description: 'Optional Chrome session ID'
            }
          },
          required: []
        }
      )
    );

    // Register react_router_current_route tool
    this.registerTool(
      this.createTool(
        'react_router_current_route',
        'Get current route information including params, query, and state',
        routeInspectSchema,
        async (args, context) => {
          const routeInspectionScript = `
            (function() {
              const routeInfo = {
                found: false,
                location: null,
                params: {},
                searchParams: {},
                state: null
              };
              
              const includeParams = ${args.includeParams !== false};
              const includeQuery = ${args.includeQuery !== false};
              const includeState = ${args.includeState !== false};
              
              // Get browser location
              routeInfo.location = {
                pathname: window.location.pathname,
                search: window.location.search,
                hash: window.location.hash,
                href: window.location.href
              };
              
              // Try to get React Router specific location
              const possibleRouterLocations = [
                'window.__reactRouterLocation',
                'window.useLocation',
                'window.location'
              ];
              
              // Method 1: Check for useLocation hook data
              if (window.React && window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
                try {
                  // Look for components using useLocation
                  const locationComponents = [];
                  
                  const searchForLocationHook = (fiber) => {
                    if (!fiber) return;
                    
                    // Check if component uses useLocation
                    if (fiber.memoizedState) {
                      const hooks = fiber.memoizedState;
                      let current = hooks;
                      while (current) {
                        if (current.queue && current.memoizedState) {
                          // This might be a location from useLocation
                          const state = current.memoizedState;
                          if (state && typeof state === 'object' && 
                              state.pathname && state.search !== undefined) {
                            locationComponents.push({
                              component: fiber.type?.name || 'Unknown',
                              location: state,
                              key: fiber.key
                            });
                          }
                        }
                        current = current.next;
                      }
                    }
                    
                    if (fiber.child) searchForLocationHook(fiber.child);
                    if (fiber.sibling) searchForLocationHook(fiber.sibling);
                  };
                  
                  // Search React fiber tree
                  const containers = document.querySelectorAll('[data-reactroot], #root, .react-root');
                  containers.forEach(container => {
                    const fiberRoot = container._reactInternalFiber || 
                                    container._reactInternalInstance ||
                                    container.__reactInternalInstance ||
                                    container._reactRootContainer?._internalRoot;
                    
                    if (fiberRoot) {
                      searchForLocationHook(fiberRoot.current || fiberRoot);
                    }
                  });
                  
                  if (locationComponents.length > 0) {
                    routeInfo.reactRouterLocation = locationComponents[0].location;
                    routeInfo.found = true;
                  }
                } catch (error) {
                  routeInfo.hookError = error.message;
                }
              }
              
              // Method 2: Parse URL params manually
              if (includeParams) {
                try {
                  const pathname = window.location.pathname;
                  const segments = pathname.split('/').filter(Boolean);
                  
                  // Try to detect common parameter patterns
                  const paramPatterns = [
                    /^[0-9]+$/, // Numeric IDs
                    /^[a-f0-9-]{36}$/, // UUIDs
                    /^[a-zA-Z0-9-_]+$/ // Slug patterns
                  ];
                  
                  segments.forEach((segment, index) => {
                    paramPatterns.forEach((pattern, patternIndex) => {
                      if (pattern.test(segment)) {
                        const paramName = ['id', 'uuid', 'slug'][patternIndex] + (index > 0 ? index : '');
                        routeInfo.params[paramName] = segment;
                      }
                    });
                  });
                  
                  // Common route patterns
                  if (segments.length >= 2 && /^[0-9]+$/.test(segments[1])) {
                    routeInfo.params[segments[0] + 'Id'] = segments[1];
                  }
                } catch (error) {
                  routeInfo.paramsError = error.message;
                }
              }
              
              // Method 3: Parse search params
              if (includeQuery) {
                try {
                  const urlParams = new URLSearchParams(window.location.search);
                  urlParams.forEach((value, key) => {
                    routeInfo.searchParams[key] = value;
                  });
                } catch (error) {
                  routeInfo.searchError = error.message;
                }
              }
              
              // Method 4: Get history state
              if (includeState) {
                try {
                  routeInfo.state = window.history.state;
                  routeInfo.historyLength = window.history.length;
                } catch (error) {
                  routeInfo.stateError = error.message;
                }
              }
              
              // Method 5: Check for route matching
              try {
                const pathname = window.location.pathname;
                routeInfo.routePattern = {
                  exact: pathname,
                  normalized: pathname.toLowerCase(),
                  segments: pathname.split('/').filter(Boolean),
                  hasTrailingSlash: pathname.endsWith('/') && pathname.length > 1,
                  isRoot: pathname === '/',
                  depth: pathname.split('/').filter(Boolean).length
                };
              } catch (error) {
                routeInfo.patternError = error.message;
              }
              
              return {
                ...routeInfo,
                found: true, // Always return current browser location
                summary: {
                  pathname: window.location.pathname,
                  hasParams: Object.keys(routeInfo.params).length > 0,
                  hasQuery: Object.keys(routeInfo.searchParams).length > 0,
                  hasState: !!routeInfo.state,
                  routeDepth: routeInfo.routePattern?.depth || 0
                }
              };
            })()
          `;

          const result = await withScriptExecution(routeInspectionScript, context);

          if (result.isErr()) {
            return {
              success: false,
              error: result.unwrapErr()
            };
          }

          return {
            success: true,
            data: result.unwrap()
          };
        },
        {
          type: 'object',
          properties: {
            includeParams: { 
              type: 'boolean', 
              description: 'Include route parameters in output',
              default: true
            },
            includeQuery: { 
              type: 'boolean', 
              description: 'Include query parameters in output',
              default: true
            },
            includeState: { 
              type: 'boolean', 
              description: 'Include history state in output',
              default: true
            },
            sessionId: { 
              type: 'string', 
              description: 'Optional Chrome session ID'
            }
          },
          required: []
        }
      )
    );

    // Register react_router_navigate tool
    this.registerTool(
      this.createTool(
        'react_router_navigate',
        'Navigate to a new route programmatically',
        navigationSchema,
        async (args, context) => {
          const navigationScript = `
            (function() {
              const to = '${args.to}';
              const replace = ${args.replace === true};
              const state = ${JSON.stringify(args.state || null)};
              
              const result = {
                navigated: false,
                method: null,
                from: window.location.pathname,
                to: to,
                error: null
              };
              
              try {
                // Method 1: Try React Router navigate function
                if (window.navigate || window.useNavigate) {
                  const navigate = window.navigate || window.useNavigate;
                  if (typeof navigate === 'function') {
                    navigate(to, { replace, state });
                    result.navigated = true;
                    result.method = 'react-router-navigate';
                    return result;
                  }
                }
                
                // Method 2: Look for navigate function in React components
                if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
                  const searchForNavigate = (fiber) => {
                    if (!fiber) return null;
                    
                    // Check component props for navigate function
                    if (fiber.memoizedProps && fiber.memoizedProps.navigate) {
                      return fiber.memoizedProps.navigate;
                    }
                    
                    // Check hooks for useNavigate
                    if (fiber.memoizedState) {
                      let current = fiber.memoizedState;
                      while (current) {
                        if (current.memoizedState && typeof current.memoizedState === 'function') {
                          // This might be navigate from useNavigate
                          try {
                            current.memoizedState(to, { replace, state });
                            return current.memoizedState;
                          } catch (e) {
                            // Not the navigate function
                          }
                        }
                        current = current.next;
                      }
                    }
                    
                    // Search children
                    const childResult = searchForNavigate(fiber.child);
                    if (childResult) return childResult;
                    
                    return searchForNavigate(fiber.sibling);
                  };
                  
                  const containers = document.querySelectorAll('[data-reactroot], #root, .react-root');
                  for (const container of containers) {
                    const fiberRoot = container._reactInternalFiber || 
                                    container._reactInternalInstance ||
                                    container.__reactInternalInstance ||
                                    container._reactRootContainer?._internalRoot;
                    
                    if (fiberRoot) {
                      const navigate = searchForNavigate(fiberRoot.current || fiberRoot);
                      if (navigate) {
                        result.navigated = true;
                        result.method = 'react-router-hook';
                        return result;
                      }
                    }
                  }
                }
                
                // Method 3: Use browser history API
                if (replace) {
                  window.history.replaceState(state, '', to);
                } else {
                  window.history.pushState(state, '', to);
                }
                
                // Dispatch popstate event to trigger React Router
                window.dispatchEvent(new PopStateEvent('popstate', { state }));
                
                result.navigated = true;
                result.method = 'history-api';
                
              } catch (error) {
                result.error = error.message;
                result.navigated = false;
              }
              
              return result;
            })()
          `;

          const result = await withScriptExecution(navigationScript, context);

          if (result.isErr()) {
            return {
              success: false,
              error: result.unwrapErr()
            };
          }

          return {
            success: true,
            data: result.unwrap()
          };
        },
        {
          type: 'object',
          properties: {
            to: { 
              type: 'string', 
              description: 'Target route path to navigate to'
            },
            replace: { 
              type: 'boolean', 
              description: 'Replace current history entry instead of pushing new one',
              default: false
            },
            state: { 
              description: 'State object to pass with navigation'
            },
            sessionId: { 
              type: 'string', 
              description: 'Optional Chrome session ID'
            }
          },
          required: ['to']
        }
      )
    );

    // Register react_router_history_inspect tool
    this.registerTool({
      name: 'react_router_history_inspect',
      description: 'Inspect browser history and navigation state',
      argsSchema: {
        parse: (value) => {
          const obj = (value || {}) as any;
          return {
            includeEntries: typeof obj.includeEntries === 'boolean' ? obj.includeEntries : false,
            sessionId: obj.sessionId
          };
        },
        safeParse: function(value) {
          try {
            const parsed = this.parse(value);
            return { success: true, data: parsed };
          } catch (error) {
            return { success: false, error };
          }
        }
      },
      jsonSchema: {
        type: 'object',
        properties: {
          includeEntries: { 
            type: 'boolean', 
            description: 'Include detailed history entries (limited by browser security)',
            default: false
          },
          sessionId: { 
            type: 'string', 
            description: 'Optional Chrome session ID'
          }
        },
        required: []
      },
      handler: async (args, context) => {
        const historyInspectionScript = `
          (function() {
            const historyInfo = {
              length: 0,
              state: null,
              canGoBack: false,
              canGoForward: false,
              currentIndex: -1
            };
            
            const includeEntries = ${args.includeEntries === true};
            
            try {
              // Basic history information
              historyInfo.length = window.history.length;
              historyInfo.state = window.history.state;
              historyInfo.canGoBack = window.history.length > 1;
              
              // Current location information
              historyInfo.currentLocation = {
                pathname: window.location.pathname,
                search: window.location.search,
                hash: window.location.hash,
                href: window.location.href,
                origin: window.location.origin
              };
              
              // Navigation timing information
              if (window.performance && window.performance.navigation) {
                historyInfo.navigationType = {
                  type: window.performance.navigation.type,
                  typeString: ['navigate', 'reload', 'back_forward', 'reserved'][window.performance.navigation.type] || 'unknown',
                  redirectCount: window.performance.navigation.redirectCount
                };
              }
              
              // Performance navigation entries
              if (window.performance && window.performance.getEntriesByType) {
                const navigationEntries = window.performance.getEntriesByType('navigation');
                if (navigationEntries.length > 0) {
                  const entry = navigationEntries[0];
                  historyInfo.timing = {
                    domContentLoaded: entry.domContentLoadedEventEnd - entry.navigationStart,
                    loadComplete: entry.loadEventEnd - entry.navigationStart,
                    responseTime: entry.responseEnd - entry.requestStart,
                    domInteractive: entry.domInteractive - entry.navigationStart
                  };
                }
              }
              
              // Check for React Router specific history tracking
              if (window.__REACT_ROUTER_HISTORY__ || window.routerHistory) {
                const routerHistory = window.__REACT_ROUTER_HISTORY__ || window.routerHistory;
                historyInfo.reactRouterHistory = {
                  length: routerHistory.length || 'unknown',
                  index: routerHistory.index || -1,
                  action: routerHistory.action || 'unknown',
                  location: routerHistory.location || null
                };
              }
              
              // Session storage and local storage related to routing
              historyInfo.storageKeys = {
                sessionStorage: [],
                localStorage: []
              };
              
              try {
                // Check for router-related storage keys
                const routerKeys = ['router', 'route', 'navigation', 'history'];
                
                for (let i = 0; i < sessionStorage.length; i++) {
                  const key = sessionStorage.key(i);
                  if (routerKeys.some(routerKey => key.toLowerCase().includes(routerKey))) {
                    historyInfo.storageKeys.sessionStorage.push({
                      key,
                      valueLength: sessionStorage.getItem(key)?.length || 0
                    });
                  }
                }
                
                for (let i = 0; i < localStorage.length; i++) {
                  const key = localStorage.key(i);
                  if (routerKeys.some(routerKey => key.toLowerCase().includes(routerKey))) {
                    historyInfo.storageKeys.localStorage.push({
                      key,
                      valueLength: localStorage.getItem(key)?.length || 0
                    });
                  }
                }
              } catch (error) {
                historyInfo.storageError = error.message;
              }
              
              // Referrer information
              if (document.referrer) {
                historyInfo.referrer = {
                  url: document.referrer,
                  origin: new URL(document.referrer).origin,
                  isExternal: new URL(document.referrer).origin !== window.location.origin
                };
              }
              
              // Browser capabilities
              historyInfo.capabilities = {
                pushState: !!(window.history && window.history.pushState),
                replaceState: !!(window.history && window.history.replaceState),
                hashChange: 'onhashchange' in window,
                popState: 'onpopstate' in window
              };
              
            } catch (error) {
              historyInfo.error = error.message;
            }
            
            return {
              ...historyInfo,
              summary: {
                totalEntries: historyInfo.length,
                currentPath: window.location.pathname,
                navigationType: historyInfo.navigationType?.typeString || 'unknown',
                hasReactRouter: !!(window.__REACT_ROUTER_HISTORY__ || window.routerHistory),
                hasStorageData: (historyInfo.storageKeys?.sessionStorage?.length || 0) + 
                               (historyInfo.storageKeys?.localStorage?.length || 0) > 0
              }
            };
          })()
        `;

        const result = await withScriptExecution(historyInspectionScript, context);

        if (result.isErr()) {
          return {
            success: false,
            error: result.unwrapErr()
          };
        }

        return {
          success: true,
          data: result.unwrap()
        };
      }
    });
  }
}

export class ReactRouterToolProviderFactory extends BaseProviderFactory<ReactRouterToolProvider> {
  create(deps: ProviderDependencies): ReactRouterToolProvider {
    const config: BaseToolProviderConfig = {
      name: 'react-router',
      description: 'React Router navigation and routing debugging tools'
    };

    return new ReactRouterToolProvider(
      deps.chromeService,
      this.createProviderLogger(deps, config.name),
      deps.validator,
      config
    );
  }
}