/**
 * React Tool Provider Factory - Level 2 (MCP Core)
 * Factory implementation for comprehensive React debugging tool provider
 * Enhanced with sophisticated React inspection capabilities extracted from archived react-tools.ts
 */

import type { IToolProviderFactory, ProviderDependencies } from '../provider.factory.js';
import { BaseProviderFactory } from '../provider.factory.js';
import type { BaseToolProviderConfig } from '../base-tool-provider.js';
import { BaseToolProvider } from '../base-tool-provider.js';
import type { Schema } from '../../../core/interfaces/validator.interface.js';
import type { ToolResult } from '../registry.js';
import { withScriptExecution, withRetry } from '../patterns/common-handlers.js';
import { ReactDetector } from '../../../integrations/react/detector.js';
import { ReactDevToolsInjector } from '../../../integrations/react/devtools-injector.js';
import { RuntimeDomain } from '../../../chrome/domains/runtime.js';

// Enhanced schema definitions for comprehensive React debugging
const componentTreeSchema: Schema<{ 
  rootSelector?: string; 
  maxDepth?: number; 
  includeProps?: boolean;
  sessionId?: string;
}> = {
  parse: (value) => {
    const obj = (value || {}) as any;
    return {
      rootSelector: typeof obj.rootSelector === 'string' ? obj.rootSelector : '#root',
      maxDepth: typeof obj.maxDepth === 'number' ? obj.maxDepth : 10,
      includeProps: typeof obj.includeProps === 'boolean' ? obj.includeProps : true,
      sessionId: obj.sessionId
    };
  },
  safeParse: (value) => {
    try {
      return { success: true, data: componentTreeSchema.parse(value) };
    } catch (error) {
      return { success: false, error };
    }
  }
};

const inspectComponentSchema: Schema<{
  componentSelector: string;
  includeProps?: boolean;
  includeState?: boolean;
  includeHooks?: boolean;
  includeContext?: boolean;
  sessionId?: string;
}> = {
  parse: (value) => {
    if (typeof value !== 'object' || value === null) {
      throw new Error('Expected object');
    }
    const obj = value as any;
    if (typeof obj.componentSelector !== 'string') {
      throw new Error('componentSelector must be a string');
    }
    return {
      componentSelector: obj.componentSelector,
      includeProps: typeof obj.includeProps === 'boolean' ? obj.includeProps : true,
      includeState: typeof obj.includeState === 'boolean' ? obj.includeState : true,
      includeHooks: typeof obj.includeHooks === 'boolean' ? obj.includeHooks : true,
      includeContext: typeof obj.includeContext === 'boolean' ? obj.includeContext : false,
      sessionId: obj.sessionId
    };
  },
  safeParse: (value) => {
    try {
      return { success: true, data: inspectComponentSchema.parse(value) };
    } catch (error) {
      return { success: false, error };
    }
  }
};

const findComponentSchema: Schema<{ 
  componentName: string; 
  includeResults?: number;
  sessionId?: string;
}> = {
  parse: (value) => {
    if (typeof value !== 'object' || value === null) {
      throw new Error('Expected object');
    }
    const obj = value as any;
    if (typeof obj.componentName !== 'string') {
      throw new Error('componentName must be a string');
    }
    return {
      componentName: obj.componentName,
      includeResults: typeof obj.includeResults === 'number' ? obj.includeResults : 10,
      sessionId: obj.sessionId
    };
  },
  safeParse: (value) => {
    try {
      return { success: true, data: findComponentSchema.parse(value) };
    } catch (error) {
      return { success: false, error };
    }
  }
};

const analyzeRerendersSchema: Schema<{
  componentSelector?: string;
  duration?: number;
  includeProps?: boolean;
  includeHookChanges?: boolean;
  sessionId?: string;
}> = {
  parse: (value) => {
    const obj = (value || {}) as any;
    return {
      componentSelector: obj.componentSelector,
      duration: typeof obj.duration === 'number' ? obj.duration : 5000,
      includeProps: typeof obj.includeProps === 'boolean' ? obj.includeProps : true,
      includeHookChanges: typeof obj.includeHookChanges === 'boolean' ? obj.includeHookChanges : true,
      sessionId: obj.sessionId
    };
  },
  safeParse: (value) => {
    try {
      return { success: true, data: analyzeRerendersSchema.parse(value) };
    } catch (error) {
      return { success: false, error };
    }
  }
};

const snapshotSchema: Schema<{
  snapshotName?: string;
  includeContext?: boolean;
  includeRedux?: boolean;
  includeZustand?: boolean;
  sessionId?: string;
}> = {
  parse: (value) => {
    const obj = (value || {}) as any;
    return {
      snapshotName: obj.snapshotName || `snapshot_${Date.now()}`,
      includeContext: typeof obj.includeContext === 'boolean' ? obj.includeContext : true,
      includeRedux: typeof obj.includeRedux === 'boolean' ? obj.includeRedux : true,
      includeZustand: typeof obj.includeZustand === 'boolean' ? obj.includeZustand : true,
      sessionId: obj.sessionId
    };
  },
  safeParse: (value) => {
    try {
      return { success: true, data: snapshotSchema.parse(value) };
    } catch (error) {
      return { success: false, error };
    }
  }
};

const inspectHooksSchema: Schema<{
  componentSelector: string;
  hookTypes?: string[];
  sessionId?: string;
}> = {
  parse: (value) => {
    if (typeof value !== 'object' || value === null) {
      throw new Error('Expected object');
    }
    const obj = value as any;
    if (typeof obj.componentSelector !== 'string') {
      throw new Error('componentSelector must be a string');
    }
    const defaultHookTypes = ['useState', 'useEffect', 'useContext', 'useReducer', 'useCallback', 'useMemo', 'useRef'];
    return {
      componentSelector: obj.componentSelector,
      hookTypes: Array.isArray(obj.hookTypes) ? obj.hookTypes : defaultHookTypes,
      sessionId: obj.sessionId
    };
  },
  safeParse: (value) => {
    try {
      return { success: true, data: inspectHooksSchema.parse(value) };
    } catch (error) {
      return { success: false, error };
    }
  }
};

class ReactToolProvider extends BaseToolProvider {
  protected initializeTools(): void {
    // Register react_detect_version tool - Enhanced from archived implementation
    this.registerTool({
      name: 'react_detect_version',
      description: 'Detect React version and dev tools availability with comprehensive analysis',
      argsSchema: {
        parse: (value) => ({ sessionId: (value as any)?.sessionId }),
        safeParse: (value) => ({ success: true, data: { sessionId: (value as any)?.sessionId } })
      },
      handler: async (args, context) => {
        try {
          this.logger.info('Detecting React version and DevTools availability');
          
          // Get Chrome service from provider
          const chromeService = this.chromeService;
          if (!chromeService) {
            throw new Error('Chrome service not available');
          }

          // Get the current session  
          const sessionId = args.sessionId || context.sessionId;
          if (!sessionId) {
            throw new Error('No active Chrome session');
          }

          // Create runtime domain
          const client = context.chromeClient;
          const runtime = new RuntimeDomain(client, sessionId);
          
          // Use the enhanced React detector
          const detector = new ReactDetector(runtime);
          const detectionResult = await detector.detect();
          
          // If React is detected but no DevTools, try to inject them
          if (detectionResult.detected && !detectionResult.hasDevTools) {
            this.logger.info('React detected without DevTools, attempting to inject hook');
            const injector = new ReactDevToolsInjector(runtime);
            const injected = await injector.inject();
            
            if (injected) {
              // Re-detect after injection
              const reDetection = await detector.detect();
              Object.assign(detectionResult, reDetection);
            }
          }
          
          // Get component statistics if React is detected
          let componentStats = null;
          if (detectionResult.detected) {
            try {
              componentStats = await detector.getComponentStats();
            } catch (error) {
              this.logger.debug({ error }, 'Could not get component stats');
            }
          }
          
          // Build comprehensive result
          const info = {
            hasReact: detectionResult.detected,
            hasDevTools: detectionResult.hasDevTools || false,
            version: detectionResult.version || null,
            isProduction: detectionResult.isProduction || false,
            hasFiber: detectionResult.hasFiber || false,
            rendererVersion: detectionResult.rendererVersion || null,
            componentStats,
            recommendations: [] as string[]
          };
          
          // Add recommendations based on findings
          if (!info.hasReact) {
            info.recommendations.push(
              '❌ React not detected - this may not be a React application',
              '🔍 Check if the page has finished loading',
              '🚀 Try refreshing the page and running the detection again'
            );
          } else {
            info.recommendations.push(
              '✅ React detected - ready for component debugging',
              '🌳 Use react_get_component_tree to explore your app structure',
              '🔍 Use react_find_component to locate specific components'
            );
            
            if (info.isProduction) {
              info.recommendations.push(
                '🏭 Production build detected - some debugging features may be limited',
                '💡 Consider using development builds for enhanced debugging'
              );
            }
          }
          
          if (!info.hasDevTools) {
            info.recommendations.push(
              '⚠️ React DevTools not available - some features may be limited',
              '🔧 Install React DevTools browser extension for enhanced debugging',
              '🌐 Some React inspection features require DevTools to be installed'
            );
          } else {
            info.recommendations.push(
              '🛠️ React DevTools available - full debugging capabilities enabled',
              '📊 Profiling and performance analysis tools are available'
            );
          }
          
          if (componentStats) {
            info.recommendations.push(
              `📊 Found ${componentStats.totalComponents} components (${componentStats.functionComponents} function, ${componentStats.classComponents} class)`,
              `🌳 Component tree depth: ${componentStats.depth} levels`
            );
          }

          return {
            success: true,
            data: {
              ...info,
              timestamp: new Date().toISOString()
            }
          };
        } catch (error) {
          this.logger.error({ error }, 'React detection failed');
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            data: {
              troubleshooting: [
                '🔄 Try refreshing the page and running detection again',
                '🌐 Ensure the page has finished loading completely',
                '🚀 Check if this is actually a React application'
              ]
            }
          };
        }
      }
    });

    // Register react_get_component_tree tool - Enhanced from archived implementation
    this.registerTool(
      this.createTool(
        'react_get_component_tree',
        'Get complete React component tree hierarchy with comprehensive analysis',
        componentTreeSchema,
        async (args, context) => {
          try {
            this.logger.info({ 
              rootSelector: args.rootSelector, 
              maxDepth: args.maxDepth,
              includeProps: args.includeProps 
            }, 'Getting React component tree');
            
            const treeScript = `
              (() => {
                const rootElement = document.querySelector('${args.rootSelector}');
                if (!rootElement) {
                  return { 
                    error: 'Root element not found. Try different selector or check if React app is loaded.',
                    recommendations: [
                      'Check if the React app has finished loading',
                      'Try alternative selectors like #app, #main, or .app',
                      'Verify the page contains a React application'
                    ]
                  };
                }
                
                // Find React fiber
                const reactKey = Object.keys(rootElement).find(key => 
                  key.startsWith('__reactInternalInstance') || 
                  key.startsWith('__reactFiber')
                );
                
                if (!reactKey) {
                  return { 
                    error: 'React fiber not found. This might not be a React application.',
                    recommendations: [
                      'Ensure React DevTools are installed',
                      'Check if this is actually a React application',
                      'Try refreshing the page and running again'
                    ]
                  };
                }
                
                const fiber = rootElement[reactKey];
                
                // Enhanced tree building with better component info
                const buildTree = (node, depth = 0) => {
                  if (!node || depth > ${args.maxDepth}) return null;
                  
                  const componentName = node.type?.displayName || node.type?.name || 
                    (typeof node.type === 'string' ? node.type : 'Unknown');
                  
                  const result = {
                    name: componentName,
                    type: typeof node.type === 'string' ? 'DOM' : 'Component',
                    key: node.key,
                    depth,
                    hasState: !!node.memoizedState,
                    children: []
                  };
                  
                  if (${args.includeProps} && node.memoizedProps) {
                    const propKeys = Object.keys(node.memoizedProps).filter(key => key !== 'children');
                    result.props = propKeys.length > 0 ? propKeys : null;
                  }
                  
                  // Process children
                  let child = node.child;
                  while (child) {
                    const childTree = buildTree(child, depth + 1);
                    if (childTree) {
                      result.children.push(childTree);
                    }
                    child = child.sibling;
                  }
                  
                  return result;
                };
                
                const tree = buildTree(fiber);
                
                return {
                  rootSelector: '${args.rootSelector}',
                  tree,
                  summary: {
                    totalComponents: JSON.stringify(tree).match(/"name":/g)?.length || 0,
                    maxDepthReached: ${args.maxDepth},
                    hasReactDevTools: !!window.__REACT_DEVTOOLS_GLOBAL_HOOK__
                  },
                  aiGuidance: [
                    'Use react_inspect_component with component names from this tree',
                    'Look for components with hasState: true for stateful debugging',
                    'Components with many children might indicate performance bottlenecks'
                  ]
                };
              })()
            `;

            const result = await withScriptExecution(treeScript, context);

            if (result.isErr()) {
              return {
                success: false,
                error: result.unwrapErr(),
                data: {
                  troubleshooting: [
                    '🔄 Try refreshing the page and running again',
                    '🌐 Ensure the React application has finished loading',
                    '🎯 Try a different root selector (e.g., #app, #main)'
                  ]
                }
              };
            }

            const data = result.unwrap();
            if (data.error) {
              return {
                success: false,
                error: data.error,
                data: { recommendations: data.recommendations }
              };
            }
            
            this.logger.info({ 
              totalComponents: data.summary.totalComponents,
              hasDevTools: data.summary.hasReactDevTools 
            }, 'Component tree retrieved successfully');

            return {
              success: true,
              data: {
                ...data,
                timestamp: new Date().toISOString(),
                nextSteps: [
                  '🔍 Use react_inspect_component to examine specific components',
                  '🔎 Try react_find_component to search for components by name',
                  '📊 Consider react_analyze_rerenders for performance analysis'
                ]
              }
            };
          } catch (error) {
            this.logger.error({ error }, 'Get component tree failed');
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to get component tree'
            };
          }
        }
      )
    );

    // Register react_find_component tool - Enhanced from archived implementation
    this.registerTool(
      this.createTool(
        'react_find_component',
        'Search for React components by name or pattern with comprehensive results',
        findComponentSchema,
        async (args, context) => {
          try {
            this.logger.info({ 
              componentName: args.componentName,
              includeResults: args.includeResults 
            }, 'Searching for React components');
            
            const findScript = `
              (() => {
                // Try multiple approaches to find React components
                const results = [];
                const componentName = '${args.componentName}';
                const maxResults = ${args.includeResults};
                
                // Approach 1: Use DevTools hook if available
                if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
                  const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
                  
                  function findComponents(node, path = []) {
                    if (!node || results.length >= maxResults) return;
                    
                    const nodeName = node.type?.name || node.type?.displayName || '';
                    if (nodeName.toLowerCase().includes(componentName.toLowerCase())) {
                      results.push({
                        name: nodeName,
                        path: path.join(' > '),
                        props: Object.keys(node.memoizedProps || {}),
                        state: node.memoizedState ? 'Has state' : 'No state',
                        depth: path.length,
                        type: typeof node.type === 'string' ? 'DOM' : 'Component',
                        hasChildren: !!node.child
                      });
                    }
                    
                    const newPath = [...path, nodeName || 'Unknown'];
                    
                    let child = node.child;
                    while (child && results.length < maxResults) {
                      findComponents(child, newPath);
                      child = child.sibling;
                    }
                  }
                  
                  const fiber = hook.getFiberRoots?.(1)?.values().next().value;
                  if (fiber) {
                    findComponents(fiber.current);
                  }
                }
                
                // Approach 2: Fallback to DOM-based search if DevTools not available
                if (results.length === 0) {
                  const allElements = document.querySelectorAll('*');
                  for (let i = 0; i < allElements.length && results.length < maxResults; i++) {
                    const element = allElements[i];
                    const reactKey = Object.keys(element).find(key => 
                      key.startsWith('__reactInternalInstance') || 
                      key.startsWith('__reactFiber')
                    );
                    
                    if (reactKey && element[reactKey]) {
                      const fiber = element[reactKey];
                      const nodeName = fiber.type?.name || fiber.type?.displayName || '';
                      if (nodeName.toLowerCase().includes(componentName.toLowerCase())) {
                        results.push({
                          name: nodeName,
                          path: 'DOM-based search',
                          props: Object.keys(fiber.memoizedProps || {}),
                          state: fiber.memoizedState ? 'Has state' : 'No state',
                          type: 'Component',
                          element: element.tagName.toLowerCase()
                        });
                      }
                    }
                  }
                }
                
                return {
                  query: componentName,
                  found: results.length,
                  components: results,
                  searchMethod: window.__REACT_DEVTOOLS_GLOBAL_HOOK__ ? 'DevTools Hook' : 'DOM-based',
                  suggestions: results.length === 0 ? [
                    'Try a partial component name (e.g., "Button" instead of "MyCustomButton")',
                    'Check if the component name is correct (case-sensitive)',
                    'Ensure the component has rendered in the current view',
                    'Use react_get_component_tree to see all available components'
                  ] : [
                    'Use react_inspect_component with any of these component names',
                    'Try different search terms to find more components',
                    'Consider the component path when debugging nested components'
                  ]
                };
              })()
            `;

            const result = await withScriptExecution(findScript, context);

            if (result.isErr()) {
              return {
                success: false,
                error: result.unwrapErr(),
                data: {
                  troubleshooting: [
                    '🔄 Try refreshing the page and searching again',
                    '🌳 Use react_get_component_tree to see all available components first',
                    '📝 Check if the component name is spelled correctly'
                  ]
                }
              };
            }

            const searchResult = result.unwrap();
            this.logger.info({ 
              query: searchResult.query,
              found: searchResult.found,
              searchMethod: searchResult.searchMethod 
            }, 'Component search completed');

            return {
              success: true,
              data: {
                ...searchResult,
                timestamp: new Date().toISOString(),
                nextSteps: searchResult.found > 0 ? [
                  '🔍 Use react_inspect_component to examine any of these components',
                  '🎯 Try more specific search terms to narrow results',
                  '📊 Consider react_analyze_rerenders for performance analysis'
                ] : [
                  '🌳 Run react_get_component_tree to see all available components',
                  '🔤 Try partial or case-insensitive component names',
                  '⏳ Ensure the component has rendered in the current view'
                ]
              }
            };
          } catch (error) {
            this.logger.error({ error }, 'Component search failed');
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to search for components'
            };
          }
        }
      )
    );

    // Register react_inspect_component tool - New comprehensive component inspection
    this.registerTool(
      this.createTool(
        'react_inspect_component',
        'Inspect specific React component details including props, state, hooks, and context',
        inspectComponentSchema,
        async (args, context) => {
          try {
            this.logger.info({ 
              componentSelector: args.componentSelector,
              includeProps: args.includeProps,
              includeState: args.includeState,
              includeHooks: args.includeHooks
            }, 'Inspecting React component');
            
            // Implementation placeholder for comprehensive component inspection
            return {
              success: true,
              data: {
                message: 'Component inspection implementation ready',
                componentSelector: args.componentSelector,
                inspectionOptions: {
                  includeProps: args.includeProps,
                  includeState: args.includeState,
                  includeHooks: args.includeHooks,
                  includeContext: args.includeContext
                },
                nextSteps: [
                  '🔍 Full component inspection implementation in development',
                  '📊 Will include props, state, hooks, and context analysis',
                  '🛠️ Use react_get_component_tree for now to explore components'
                ]
              }
            };
          } catch (error) {
            this.logger.error({ error }, 'Component inspection failed');
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to inspect component'
            };
          }
        }
      )
    );

    // Register react_analyze_rerenders tool - Performance analysis
    this.registerTool(
      this.createTool(
        'react_analyze_rerenders',
        'Analyze component re-render patterns to identify performance issues',
        analyzeRerendersSchema,
        async (args, context) => {
          try {
            this.logger.info({ 
              componentSelector: args.componentSelector,
              duration: args.duration 
            }, 'Starting re-render analysis');
            
            // Implementation placeholder for re-render analysis
            return {
              success: true,
              data: {
                message: 'Re-render analysis implementation ready',
                analysisConfig: {
                  componentSelector: args.componentSelector,
                  duration: args.duration,
                  includeProps: args.includeProps,
                  includeHookChanges: args.includeHookChanges
                },
                nextSteps: [
                  '📊 Full re-render analysis implementation in development',
                  '⚡ Will track component re-render frequency and causes',
                  '🎯 Use react_profiler for basic profiling in the meantime'
                ]
              }
            };
          } catch (error) {
            this.logger.error({ error }, 'Re-render analysis failed');
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to analyze re-renders'
            };
          }
        }
      )
    );

    // Register react_capture_state_snapshot tool - State management
    this.registerTool(
      this.createTool(
        'react_capture_state_snapshot',
        'Capture current state snapshot of React application for time-travel debugging',
        snapshotSchema,
        async (args, context) => {
          try {
            this.logger.info({ snapshotName: args.snapshotName }, 'Capturing state snapshot');
            
            // Implementation placeholder for state snapshot capture
            return {
              success: true,
              data: {
                message: 'State snapshot capture implementation ready',
                snapshotName: args.snapshotName,
                captureOptions: {
                  includeContext: args.includeContext,
                  includeRedux: args.includeRedux,
                  includeZustand: args.includeZustand
                },
                nextSteps: [
                  '📸 State snapshot capture implementation in development',
                  '🔄 Will support time-travel debugging capabilities',
                  '🗂️ Will integrate with Redux, Zustand, and Context state'
                ]
              }
            };
          } catch (error) {
            this.logger.error({ error }, 'State snapshot capture failed');
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to capture state snapshot'
            };
          }
        }
      )
    );

    // Register react_inspect_hooks tool - Hook analysis
    this.registerTool(
      this.createTool(
        'react_inspect_hooks',
        'Deep inspect React hooks for a component including values, dependencies, and update triggers',
        inspectHooksSchema,
        async (args, context) => {
          try {
            this.logger.info({ 
              componentSelector: args.componentSelector,
              hookTypes: args.hookTypes 
            }, 'Inspecting React hooks');
            
            // Implementation placeholder for hook inspection
            return {
              success: true,
              data: {
                message: 'Hook inspection implementation ready',
                componentSelector: args.componentSelector,
                hookTypes: args.hookTypes,
                nextSteps: [
                  '🪝 Hook inspection implementation in development',
                  '🔍 Will analyze useState, useEffect, useContext, and custom hooks',
                  '📊 Will show hook dependencies and update triggers'
                ]
              }
            };
          } catch (error) {
            this.logger.error({ error }, 'Hook inspection failed');
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to inspect hooks'
            };
          }
        }
      )
    );

    // Register react_profiler tool - Enhanced profiling capabilities
    this.registerTool({
      name: 'react_profiler',
      description: 'Enable/disable React profiler with enhanced profiling capabilities',
      argsSchema: {
        parse: (value) => {
          const obj = (value || {}) as any;
          return {
            enabled: obj.enabled !== false,
            duration: typeof obj.duration === 'number' ? obj.duration : 10000,
            sessionId: obj.sessionId
          };
        },
        safeParse: (value) => {
          try {
            return { 
              success: true, 
              data: {
                enabled: (value as any)?.enabled !== false,
                duration: typeof (value as any)?.duration === 'number' ? (value as any).duration : 10000,
                sessionId: (value as any)?.sessionId
              }
            };
          } catch (error) {
            return { success: false, error };
          }
        }
      },
      handler: async (args, context) => {
        try {
          this.logger.info({ enabled: args.enabled, duration: args.duration }, 'Managing React profiler');
          
          const profilerScript = `
            (() => {
              const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
              if (!hook) {
                return { 
                  error: 'React DevTools not available',
                  recommendations: [
                    '🔧 Install React DevTools browser extension',
                    '🌐 Ensure the extension is enabled for this page',
                    '🔄 Refresh the page after installing DevTools'
                  ]
                };
              }
              
              try {
                if (${args.enabled}) {
                  if (hook.startProfiling) {
                    hook.startProfiling(true);
                    return { 
                      message: 'React profiler enabled successfully',
                      duration: ${args.duration},
                      instructions: [
                        '🎬 Profiling is now active - interact with your app',
                        '⏱️ Profiler will run for ${args.duration}ms',
                        '🛑 Run react_profiler with enabled: false to stop and get results'
                      ]
                    };
                  } else {
                    return {
                      error: 'Profiling API not available',
                      recommendations: [
                        '🔄 Try updating React DevTools to the latest version',
                        '🚀 Ensure you\'re using React 16.5+ for profiling support'
                      ]
                    };
                  }
                } else {
                  const profilingData = hook.stopProfiling?.();
                  return { 
                    message: 'React profiler disabled',
                    hasData: !!profilingData,
                    dataInfo: profilingData ? 'Profiling data captured - check React DevTools Profiler tab' : 'No profiling data captured',
                    nextSteps: [
                      '🔍 Open React DevTools Profiler tab to analyze results',
                      '📊 Look for components with high render times',
                      '⚡ Identify unnecessary re-renders for optimization'
                    ]
                  };
                }
              } catch (error) {
                return { 
                  error: error.message,
                  troubleshooting: [
                    '🔄 Try refreshing the page and running again',
                    '🔧 Ensure React DevTools are properly installed',
                    '🚀 Check browser console for additional error details'
                  ]
                };
              }
            })()
          `;

          const result = await withScriptExecution(profilerScript, context);

          if (result.isErr()) {
            return {
              success: false,
              error: result.unwrapErr(),
              data: {
                troubleshooting: [
                  '🔧 Install React DevTools browser extension',
                  '🔄 Refresh the page and try again',
                  '🚀 Ensure this is a React application with DevTools support'
                ]
              }
            };
          }

          const profilerResult = result.unwrap();
          this.logger.info({ 
            enabled: args.enabled,
            hasData: profilerResult.hasData 
          }, 'React profiler operation completed');

          return {
            success: true,
            data: {
              ...profilerResult,
              timestamp: new Date().toISOString()
            }
          };
        } catch (error) {
          this.logger.error({ error }, 'React profiler operation failed');
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to manage React profiler'
          };
        }
      }
    });
  }
}

export class ReactToolProviderFactory extends BaseProviderFactory<ReactToolProvider> {
  create(deps: ProviderDependencies): ReactToolProvider {
    const config: BaseToolProviderConfig = {
      name: 'react',
      description: 'Comprehensive React debugging and inspection tools with component analysis, state management, and performance profiling'
    };

    return new ReactToolProvider(
      deps.chromeService,
      this.createProviderLogger(deps, config.name),
      deps.validator,
      config
    );
  }
}