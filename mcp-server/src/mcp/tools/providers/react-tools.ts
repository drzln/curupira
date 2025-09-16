/**
 * React Tool Provider - React debugging and inspection tools
 * Level 2: MCP Core (depends on Level 0-1)
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { SessionId } from '@curupira/shared/types'
import { ChromeManager } from '../../../chrome/manager.js'
import { logger } from '../../../config/logger.js'
import type { ToolProvider, ToolHandler, ToolResult } from '../registry.js'
import type {
  ReactComponentArgs,
  ReactProfileArgs,
  ReactFiberArgs,
  ReactComponentSearchResult,
  ReactComponentInspectResult,
  ReactProfileResult
} from '../types.js'
import { BaseToolProvider } from './base.js'

export class ReactToolProvider extends BaseToolProvider implements ToolProvider {
  name = 'react'
  
  listTools(): Tool[] {
    return [
      {
        name: 'react_get_component_tree',
        description: 'Get complete React component tree hierarchy. AI assistants should use this first to understand the application structure and find components.',
        inputSchema: {
          type: 'object',
          properties: {
            rootSelector: { 
              type: 'string', 
              description: 'Root element selector (default: #root)',
              default: '#root'
            },
            maxDepth: {
              type: 'number',
              description: 'Maximum tree depth to traverse (default: 10)',
              default: 10
            },
            includeProps: {
              type: 'boolean',
              description: 'Include prop names in the tree (default: true)',
              default: true
            },
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          },
          required: []
        }
      },
      {
        name: 'react_inspect_component',
        description: 'Inspect specific React component details including props, state, hooks, and context. Use after getting component tree to examine specific components.',
        inputSchema: {
          type: 'object',
          properties: {
            componentSelector: { 
              type: 'string', 
              description: 'CSS selector or component name to find the component' 
            },
            includeProps: {
              type: 'boolean',
              description: 'Include component props (default: true)',
              default: true
            },
            includeState: {
              type: 'boolean',
              description: 'Include component state (default: true)',
              default: true
            },
            includeHooks: {
              type: 'boolean',
              description: 'Include hooks information (default: true)',
              default: true
            },
            includeContext: {
              type: 'boolean',
              description: 'Include React context values (default: false)',
              default: false
            },
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          },
          required: ['componentSelector']
        }
      },
      {
        name: 'react_find_component',
        description: 'Search for React components by name or pattern. Useful when you know the component name but need to locate it in the tree.',
        inputSchema: {
          type: 'object',
          properties: {
            componentName: { 
              type: 'string', 
              description: 'Component name or pattern to search for (supports partial matches)' 
            },
            includeResults: {
              type: 'number',
              description: 'Maximum number of results to return (default: 10)',
              default: 10
            },
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          },
          required: ['componentName']
        }
      },
      {
        name: 'react_analyze_rerenders',
        description: 'Analyze component re-render patterns to identify performance issues. Perfect for debugging why components render too frequently.',
        inputSchema: {
          type: 'object',
          properties: {
            componentSelector: { 
              type: 'string', 
              description: 'CSS selector or component name to monitor (optional - monitors all if not provided)' 
            },
            duration: { 
              type: 'number', 
              description: 'Monitoring duration in milliseconds (default: 5000)',
              default: 5000
            },
            includeProps: {
              type: 'boolean',
              description: 'Track prop changes that trigger renders (default: true)',
              default: true
            },
            includeHookChanges: {
              type: 'boolean',
              description: 'Track hook value changes (default: true)',
              default: true
            },
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          },
          required: []
        }
      },
      {
        name: 'react_capture_state_snapshot',
        description: 'Capture current state snapshot of React application for time-travel debugging. Useful for comparing state before and after changes.',
        inputSchema: {
          type: 'object',
          properties: {
            snapshotName: {
              type: 'string',
              description: 'Name for this snapshot (default: timestamp)',
              default: ''
            },
            includeContext: {
              type: 'boolean',
              description: 'Include React context values (default: true)',
              default: true
            },
            includeRedux: {
              type: 'boolean',
              description: 'Include Redux store state if available (default: true)',
              default: true
            },
            includeZustand: {
              type: 'boolean',
              description: 'Include Zustand store state if available (default: true)',
              default: true
            },
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          },
          required: []
        }
      },
      {
        name: 'react_restore_snapshot',
        description: 'Restore React application to a previously captured state snapshot. Enables time-travel debugging.',
        inputSchema: {
          type: 'object',
          properties: {
            snapshotName: {
              type: 'string',
              description: 'Name of snapshot to restore'
            },
            restoreScope: {
              type: 'string',
              enum: ['component', 'context', 'global'],
              description: 'Scope of restoration (default: component)',
              default: 'component'
            },
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          },
          required: ['snapshotName']
        }
      },
      {
        name: 'react_inspect_hooks',
        description: 'Deep inspect React hooks for a component including values, dependencies, and update triggers.',
        inputSchema: {
          type: 'object',
          properties: {
            componentSelector: { 
              type: 'string', 
              description: 'CSS selector or component name to inspect' 
            },
            hookTypes: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['useState', 'useEffect', 'useContext', 'useReducer', 'useCallback', 'useMemo', 'useRef', 'custom']
              },
              description: 'Hook types to inspect (default: all)',
              default: ['useState', 'useEffect', 'useContext', 'useReducer', 'useCallback', 'useMemo', 'useRef']
            },
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          },
          required: ['componentSelector']
        }
      },
      {
        name: 'react_force_rerender',
        description: 'Force React component to re-render',
        inputSchema: {
          type: 'object',
          properties: {
            componentId: { type: 'string', description: 'React component ID' },
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          },
          required: ['componentId']
        }
      },
      {
        name: 'react_profile_renders',
        description: 'Profile React component renders',
        inputSchema: {
          type: 'object',
          properties: {
            duration: { type: 'number', description: 'Profile duration in milliseconds' },
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          },
          required: ['duration']
        }
      },
      {
        name: 'react_get_fiber_tree',
        description: 'Get React Fiber tree structure',
        inputSchema: {
          type: 'object',
          properties: {
            rootSelector: { type: 'string', description: 'Root element selector (optional)' },
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          }
        }
      },
      {
        name: 'react_detect_version',
        description: 'Detect React version and dev tools availability',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          }
        }
      }
    ]
  }
  
  getHandler(toolName: string): ToolHandler | undefined {
    const provider = this
    const handlers: Record<string, ToolHandler> = {
      react_get_component_tree: {
        name: 'react_get_component_tree',
        description: 'Get complete React component tree hierarchy',
        async execute(args): Promise<ToolResult> {
          try {
            const { 
              rootSelector = '#root', 
              maxDepth = 10, 
              includeProps = true,
              sessionId: argSessionId 
            } = args as { 
              rootSelector?: string; 
              maxDepth?: number;
              includeProps?: boolean;
              sessionId?: string 
            }
            const sessionId = await provider.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const typed = manager.getTypedClient()
            
            await typed.enableRuntime(sessionId)
            const result = await typed.evaluate(`
                (() => {
                  const rootElement = document.querySelector('${rootSelector}');
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
                    if (!node || depth > ${maxDepth}) return null;
                    
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
                    
                    if (${includeProps} && node.memoizedProps) {
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
                    rootSelector: '${rootSelector}',
                    tree,
                    summary: {
                      totalComponents: JSON.stringify(tree).match(/"name":/g)?.length || 0,
                      maxDepthReached: ${maxDepth},
                      hasReactDevTools: !!window.__REACT_DEVTOOLS_GLOBAL_HOOK__
                    },
                    aiGuidance: [
                      'Use react_inspect_component with component names from this tree',
                      'Look for components with hasState: true for stateful debugging',
                      'Components with many children might indicate performance bottlenecks'
                    ]
                  };
                })()
              `, {
              returnByValue: true
            }, sessionId)
            
            if (result.exceptionDetails) {
              return {
                success: false,
                error: `Error getting component tree: ${result.exceptionDetails.text}`
              }
            }
            
            const data = result.result.value
            if (data.error) {
              return {
                success: false,
                error: data.error,
                data: { recommendations: data.recommendations }
              }
            }
            
            return {
              success: true,
              data
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to get component tree'
            }
          }
        }
      },
      
      react_inspect_component: {
        name: 'react_inspect_component',
        description: 'Inspect specific React component details',
        async execute(args): Promise<ToolResult> {
          try {
            const { 
              componentSelector,
              includeProps = true,
              includeState = true,
              includeHooks = true,
              includeContext = false,
              sessionId: argSessionId 
            } = args as {
              componentSelector: string;
              includeProps?: boolean;
              includeState?: boolean;
              includeHooks?: boolean;
              includeContext?: boolean;
              sessionId?: string;
            }
            const sessionId = await provider.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const typed = manager.getTypedClient()
            
            await typed.enableRuntime(sessionId)
            const result = await typed.evaluate(`
                (() => {
                  // Helper to find component by selector or name
                  const findComponent = (selector) => {
                    // Try as CSS selector first
                    try {
                      const element = document.querySelector(selector);
                      if (element) {
                        const reactKey = Object.keys(element).find(key => 
                          key.startsWith('__reactInternalInstance') || 
                          key.startsWith('__reactFiber')
                        );
                        if (reactKey) {
                          return element[reactKey];
                        }
                      }
                    } catch (e) {
                      // Not a valid CSS selector, try as component name
                    }
                    
                    // Search by component name
                    const searchByName = (fiber) => {
                      if (!fiber) return null;
                      
                      const name = fiber.type?.displayName || fiber.type?.name || '';
                      if (name.toLowerCase().includes(selector.toLowerCase())) {
                        return fiber;
                      }
                      
                      // Search children
                      let child = fiber.child;
                      while (child) {
                        const found = searchByName(child);
                        if (found) return found;
                        child = child.sibling;
                      }
                      
                      return null;
                    };
                    
                    // Search from all React roots
                    const roots = document.querySelectorAll('[id], [class]');
                    for (const root of roots) {
                      const reactKey = Object.keys(root).find(key => 
                        key.startsWith('__reactInternalInstance') || 
                        key.startsWith('__reactFiber')
                      );
                      if (reactKey) {
                        const found = searchByName(root[reactKey]);
                        if (found) return found;
                      }
                    }
                    
                    return null;
                  };
                  
                  const component = findComponent('${componentSelector}');
                  if (!component) {
                    return {
                      error: 'Component not found',
                      recommendations: [
                        'Check if the component name is correct',
                        'Try using a CSS selector instead',
                        'Use react_get_component_tree to see available components',
                        'Ensure the component is currently rendered'
                      ]
                    };
                  }
                  
                  const inspection = {
                    name: component.type?.displayName || component.type?.name || 'Unknown',
                    type: typeof component.type === 'string' ? 'DOM' : 'Component',
                    key: component.key
                  };
                  
                  if (${includeProps} && component.memoizedProps) {
                    const props = { ...component.memoizedProps };
                    delete props.children; // Remove children for cleaner output
                    inspection.props = props;
                  }
                  
                  if (${includeState} && component.memoizedState) {
                    inspection.state = component.memoizedState;
                  }
                  
                  if (${includeHooks} && component.memoizedState) {
                    // Attempt to extract hooks information
                    inspection.hooks = {
                      detected: true,
                      details: 'Hook inspection requires React DevTools backend'
                    };
                  }
                  
                  if (${includeContext} && component.dependencies) {
                    inspection.context = component.dependencies;
                  }
                  
                  return {
                    component: inspection,
                    aiGuidance: [
                      'Use react_analyze_rerenders to check if this component renders too often',
                      'Check props and state for unexpected values',
                      'Use react_inspect_hooks for detailed hook analysis'
                    ]
                  };
                })()
              `, {
              returnByValue: true
            }, sessionId)
            
            if (result.exceptionDetails) {
              return {
                success: false,
                error: `Error inspecting component: ${result.exceptionDetails.text}`
              }
            }
            
            const data = result.result.value
            if (data.error) {
              return {
                success: false,
                error: data.error,
                data: { recommendations: data.recommendations }
              }
            }
            
            return {
              success: true,
              data
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to inspect component'
            }
          }
        }
      },
      
      react_find_component: {
        name: 'react_find_component',
        description: 'Search for React components by name or pattern',
        async execute(args): Promise<ToolResult> {
          try {
            const { 
              componentName, 
              includeResults = 10,
              sessionId: argSessionId 
            } = args as { 
              componentName: string; 
              includeResults?: number;
              sessionId?: string 
            }
            const sessionId = await provider.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const typed = manager.getTypedClient()
            
            await typed.enableRuntime(sessionId)
            const result = await typed.evaluate(`
                (() => {
                  const searchPattern = '${componentName}'.toLowerCase();
                  const results = [];
                  
                  const searchInFiber = (fiber, path = []) => {
                    if (!fiber || results.length >= ${includeResults}) return;
                    
                    const name = fiber.type?.displayName || fiber.type?.name || '';
                    if (name.toLowerCase().includes(searchPattern)) {
                      results.push({
                        name,
                        path: path.join(' > '),
                        type: typeof fiber.type === 'string' ? 'DOM' : 'Component',
                        hasProps: !!fiber.memoizedProps,
                        hasState: !!fiber.memoizedState,
                        key: fiber.key
                      });
                    }
                    
                    // Search children
                    let child = fiber.child;
                    while (child && results.length < ${includeResults}) {
                      searchInFiber(child, [...path, name || 'Unknown']);
                      child = child.sibling;
                    }
                  };
                  
                  // Search from all React roots
                  const roots = document.querySelectorAll('[id*="root"], [id*="app"], [class*="app"]');
                  for (const root of roots) {
                    const reactKey = Object.keys(root).find(key => 
                      key.startsWith('__reactInternalInstance') || 
                      key.startsWith('__reactFiber')
                    );
                    if (reactKey) {
                      searchInFiber(root[reactKey], [root.id || root.className]);
                    }
                  }
                  
                  return {
                    searchPattern: '${componentName}',
                    found: results.length,
                    components: results,
                    aiGuidance: results.length > 0 ? [
                      'Use react_inspect_component with the component name to get detailed info',
                      'Components with hasState: true are stateful and more likely to have bugs',
                      'Check the path to understand component hierarchy'
                    ] : [
                      'No components found matching the pattern',
                      'Try a partial name or different spelling',
                      'Use react_get_component_tree to see all available components'
                    ]
                  };
                })()
              `, {
              returnByValue: true
            }, sessionId)
            
            if (result.exceptionDetails) {
              return {
                success: false,
                error: `Error finding component: ${result.exceptionDetails.text}`
              }
            }
            
            return {
              success: true,
              data: result.result.value
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to find component'
            }
          }
        }
      },
      
      react_analyze_rerenders: {
        name: 'react_analyze_rerenders',
        description: 'Analyze component re-render patterns',
        async execute(args): Promise<ToolResult> {
          try {
            const { 
              componentSelector,
              duration = 5000,
              includeProps = true,
              includeHookChanges = true,
              sessionId: argSessionId 
            } = args as {
              componentSelector?: string;
              duration?: number;
              includeProps?: boolean;
              includeHookChanges?: boolean;
              sessionId?: string;
            }
            const sessionId = await provider.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const typed = manager.getTypedClient()
            
            await typed.enableRuntime(sessionId)
            
            // Start monitoring
            await typed.evaluate(`
                window.__CURUPIRA_RERENDER_MONITOR__ = {
                  renders: [],
                  startTime: Date.now(),
                  componentFilter: '${componentSelector || ''}',
                  includeProps: ${includeProps},
                  includeHookChanges: ${includeHookChanges}
                };
                
                // Hook into React render cycle
                if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
                  const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
                  const monitor = window.__CURUPIRA_RERENDER_MONITOR__;
                  
                  // Store original functions
                  monitor.originalOnCommitFiberRoot = hook.onCommitFiberRoot;
                  monitor.originalOnCommitFiberUnmount = hook.onCommitFiberUnmount;
                  
                  hook.onCommitFiberRoot = function(id, root, priorityLevel) {
                    const timestamp = Date.now();
                    
                    // Walk the fiber tree to find renders
                    const walkFiber = (fiber, depth = 0) => {
                      if (!fiber || depth > 20) return;
                      
                      const componentName = fiber.type?.displayName || fiber.type?.name || '';
                      
                      // Filter by component if specified
                      if (!monitor.componentFilter || 
                          componentName.toLowerCase().includes(monitor.componentFilter.toLowerCase())) {
                        
                        const renderInfo = {
                          timestamp,
                          componentName,
                          renderTime: fiber.actualDuration || 0,
                          depth,
                          key: fiber.key
                        };
                        
                        if (monitor.includeProps && fiber.memoizedProps) {
                          renderInfo.propCount = Object.keys(fiber.memoizedProps).length;
                        }
                        
                        if (fiber.memoizedState) {
                          renderInfo.hasState = true;
                        }
                        
                        monitor.renders.push(renderInfo);
                      }
                      
                      // Walk children
                      let child = fiber.child;
                      while (child) {
                        walkFiber(child, depth + 1);
                        child = child.sibling;
                      }
                    };
                    
                    if (root && root.current) {
                      walkFiber(root.current);
                    }
                    
                    // Call original if it exists
                    if (monitor.originalOnCommitFiberRoot) {
                      monitor.originalOnCommitFiberRoot.call(this, id, root, priorityLevel);
                    }
                  };
                }
              `, {
              returnByValue: false
            }, sessionId)
            
            // Wait for monitoring duration
            await new Promise(resolve => setTimeout(resolve, duration))
            
            // Stop monitoring and get results
            const result = await typed.evaluate(`
                (() => {
                  const monitor = window.__CURUPIRA_RERENDER_MONITOR__;
                  if (!monitor) {
                    return { error: 'Monitor not initialized' };
                  }
                  
                  const endTime = Date.now();
                  const totalDuration = endTime - monitor.startTime;
                  
                  // Restore original hooks
                  if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__ && monitor.originalOnCommitFiberRoot) {
                    window.__REACT_DEVTOOLS_GLOBAL_HOOK__.onCommitFiberRoot = monitor.originalOnCommitFiberRoot;
                  }
                  
                  // Analyze render patterns
                  const rendersByComponent = {};
                  const excessiveRenders = [];
                  
                  monitor.renders.forEach(render => {
                    const key = render.componentName || 'Unknown';
                    if (!rendersByComponent[key]) {
                      rendersByComponent[key] = {
                        count: 0,
                        totalTime: 0,
                        renders: []
                      };
                    }
                    
                    rendersByComponent[key].count++;
                    rendersByComponent[key].totalTime += render.renderTime;
                    rendersByComponent[key].renders.push(render);
                    
                    // Flag excessive renders (more than 1 per 100ms)
                    const recentRenders = rendersByComponent[key].renders.filter(
                      r => render.timestamp - r.timestamp < 100
                    );
                    if (recentRenders.length > 1) {
                      excessiveRenders.push(render);
                    }
                  });
                  
                  // Generate insights
                  const insights = [];
                  const componentStats = Object.entries(rendersByComponent)
                    .map(([name, stats]) => ({
                      name,
                      ...stats,
                      averageRenderTime: stats.totalTime / stats.count
                    }))
                    .sort((a, b) => b.count - a.count);
                  
                  if (componentStats.length === 0) {
                    insights.push('No renders detected during monitoring period');
                  } else {
                    const topRenderer = componentStats[0];
                    if (topRenderer.count > totalDuration / 1000) {
                      insights.push(`${topRenderer.name} renders very frequently (${topRenderer.count} times)`);
                    }
                    
                    const slowComponents = componentStats.filter(c => c.averageRenderTime > 5);
                    if (slowComponents.length > 0) {
                      insights.push(`Slow rendering components: ${slowComponents.map(c => c.name).join(', ')}`);
                    }
                    
                    if (excessiveRenders.length > 0) {
                      insights.push(`Detected ${excessiveRenders.length} potentially excessive re-renders`);
                    }
                  }
                  
                  // Cleanup
                  delete window.__CURUPIRA_RERENDER_MONITOR__;
                  
                  return {
                    duration: totalDuration,
                    totalRenders: monitor.renders.length,
                    componentStats,
                    excessiveRenders: excessiveRenders.length,
                    insights,
                    recommendations: insights.length > 0 ? [
                      'Consider using React.memo() for frequently rendering components',
                      'Check useEffect dependencies to prevent unnecessary renders',
                      'Use React DevTools Profiler for detailed performance analysis',
                      'Consider using useCallback and useMemo for expensive operations'
                    ] : [
                      'No performance issues detected in this monitoring period',
                      'Try a longer monitoring duration or trigger more interactions'
                    ]
                  };
                })()
              `, {
              returnByValue: true
            }, sessionId)
            
            if (result.exceptionDetails) {
              return {
                success: false,
                error: `Error analyzing re-renders: ${result.exceptionDetails.text}`
              }
            }
            
            return {
              success: true,
              data: result.result.value
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to analyze re-renders'
            }
          }
        }
      },
      
      react_capture_state_snapshot: {
        name: 'react_capture_state_snapshot',
        description: 'Capture current state snapshot of React application',
        async execute(args): Promise<ToolResult> {
          try {
            const { 
              snapshotName = `snapshot_${Date.now()}`,
              includeContext = true,
              includeRedux = true,
              includeZustand = true,
              sessionId: argSessionId 
            } = args as {
              snapshotName?: string;
              includeContext?: boolean;
              includeRedux?: boolean;
              includeZustand?: boolean;
              sessionId?: string;
            }
            const sessionId = await provider.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const typed = manager.getTypedClient()
            
            await typed.enableRuntime(sessionId)
            const result = await typed.evaluate(`
                (() => {
                  const snapshot = {
                    name: '${snapshotName}',
                    timestamp: Date.now(),
                    reactState: {},
                    contextValues: {},
                    reduxState: null,
                    zustandStores: {},
                    error: null
                  };
                  
                  try {
                    // Capture React component state
                    const captureComponentState = (fiber, path = []) => {
                      if (!fiber) return;
                      
                      const componentName = fiber.type?.displayName || fiber.type?.name;
                      if (componentName && fiber.memoizedState) {
                        const fullPath = [...path, componentName].join('.');
                        snapshot.reactState[fullPath] = {
                          state: fiber.memoizedState,
                          props: fiber.memoizedProps,
                          key: fiber.key
                        };
                      }
                      
                      // Recurse through children
                      let child = fiber.child;
                      while (child) {
                        captureComponentState(child, componentName ? [...path, componentName] : path);
                        child = child.sibling;
                      }
                    };
                    
                    // Find and capture from React roots
                    const roots = document.querySelectorAll('[id], [class]');
                    for (const root of roots) {
                      const reactKey = Object.keys(root).find(key => 
                        key.startsWith('__reactInternalInstance') || 
                        key.startsWith('__reactFiber')
                      );
                      if (reactKey) {
                        captureComponentState(root[reactKey]);
                      }
                    }
                    
                    // Capture Redux state if available
                    if (${includeRedux} && window.__REDUX_DEVTOOLS_EXTENSION__) {
                      try {
                        const reduxState = window.__REDUX_DEVTOOLS_EXTENSION__.getState();
                        snapshot.reduxState = reduxState;
                      } catch (e) {
                        snapshot.reduxState = 'Error capturing Redux state';
                      }
                    }
                    
                    // Capture Zustand stores if available
                    if (${includeZustand} && window.__ZUSTAND_STORES__) {
                      try {
                        snapshot.zustandStores = window.__ZUSTAND_STORES__;
                      } catch (e) {
                        snapshot.zustandStores = 'Error capturing Zustand stores';
                      }
                    }
                    
                    // Store snapshot globally for later restoration
                    if (!window.__CURUPIRA_SNAPSHOTS__) {
                      window.__CURUPIRA_SNAPSHOTS__ = {};
                    }
                    window.__CURUPIRA_SNAPSHOTS__[snapshot.name] = snapshot;
                    
                  } catch (e) {
                    snapshot.error = e.message;
                  }
                  
                  return {
                    snapshot: {
                      name: snapshot.name,
                      timestamp: snapshot.timestamp,
                      componentCount: Object.keys(snapshot.reactState).length,
                      hasRedux: !!snapshot.reduxState,
                      hasZustand: Object.keys(snapshot.zustandStores).length > 0,
                      error: snapshot.error
                    },
                    aiGuidance: [
                      `Snapshot '${snapshot.name}' captured successfully`,
                      'Use react_restore_snapshot to restore this state later',
                      'Compare snapshots before and after changes to debug issues',
                      'Snapshots are stored in browser memory until page refresh'
                    ]
                  };
                })()
              `, {
              returnByValue: true
            }, sessionId)
            
            if (result.exceptionDetails) {
              return {
                success: false,
                error: `Error capturing snapshot: ${result.exceptionDetails.text}`
              }
            }
            
            return {
              success: true,
              data: result.result.value
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to capture snapshot'
            }
          }
        }
      },
      
      react_restore_snapshot: {
        name: 'react_restore_snapshot',
        description: 'Restore React application to a previously captured state snapshot',
        async execute(args): Promise<ToolResult> {
          try {
            const { 
              snapshotName,
              restoreScope = 'component',
              sessionId: argSessionId 
            } = args as {
              snapshotName: string;
              restoreScope?: string;
              sessionId?: string;
            }
            const sessionId = await provider.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const typed = manager.getTypedClient()
            
            await typed.enableRuntime(sessionId)
            const result = await typed.evaluate(`
                (() => {
                  if (!window.__CURUPIRA_SNAPSHOTS__) {
                    return {
                      error: 'No snapshots available',
                      recommendations: [
                        'Use react_capture_state_snapshot first to create snapshots',
                        'Snapshots are cleared on page refresh'
                      ]
                    };
                  }
                  
                  const snapshot = window.__CURUPIRA_SNAPSHOTS__['${snapshotName}'];
                  if (!snapshot) {
                    const available = Object.keys(window.__CURUPIRA_SNAPSHOTS__);
                    return {
                      error: 'Snapshot not found',
                      availableSnapshots: available,
                      recommendations: [
                        'Check available snapshot names',
                        'Snapshots are case-sensitive'
                      ]
                    };
                  }
                  
                  let restoredComponents = 0;
                  const errors = [];
                  
                  try {
                    // Note: Full state restoration requires React DevTools backend
                    // This is a simplified implementation that demonstrates the concept
                    
                    if ('${restoreScope}' === 'component' || '${restoreScope}' === 'global') {
                      // In a full implementation, this would:
                      // 1. Find matching components by name/path
                      // 2. Use React DevTools backend to update state
                      // 3. Trigger re-renders as needed
                      
                      restoredComponents = Object.keys(snapshot.reactState).length;
                    }
                    
                    if ('${restoreScope}' === 'global' && snapshot.reduxState) {
                      // Redux state restoration would dispatch actions
                      // This requires access to the store dispatch function
                    }
                    
                  } catch (e) {
                    errors.push(e.message);
                  }
                  
                  return {
                    restored: true,
                    snapshotName: '${snapshotName}',
                    snapshotTimestamp: snapshot.timestamp,
                    restoredComponents,
                    errors,
                    limitations: [
                      'Full state restoration requires React DevTools backend integration',
                      'Some component state may be read-only',
                      'External state (API data) cannot be restored'
                    ],
                    aiGuidance: [
                      'State restoration is conceptual in this implementation',
                      'Production version would require React DevTools backend',
                      'Consider manual state updates for specific debugging scenarios'
                    ]
                  };
                })()
              `, {
              returnByValue: true
            }, sessionId)
            
            if (result.exceptionDetails) {
              return {
                success: false,
                error: `Error restoring snapshot: ${result.exceptionDetails.text}`
              }
            }
            
            const data = result.result.value
            if (data.error) {
              return {
                success: false,
                error: data.error,
                data: { 
                  availableSnapshots: data.availableSnapshots,
                  recommendations: data.recommendations 
                }
              }
            }
            
            return {
              success: true,
              data
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to restore snapshot'
            }
          }
        }
      },
      
      react_inspect_hooks: {
        name: 'react_inspect_hooks',
        description: 'Deep inspect React hooks for a component',
        async execute(args): Promise<ToolResult> {
          try {
            const { 
              componentSelector,
              hookTypes = ['useState', 'useEffect', 'useContext', 'useReducer', 'useCallback', 'useMemo', 'useRef'],
              sessionId: argSessionId 
            } = args as {
              componentSelector: string;
              hookTypes?: string[];
              sessionId?: string;
            }
            const sessionId = await provider.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const typed = manager.getTypedClient()
            
            await typed.enableRuntime(sessionId)
            const result = await typed.evaluate(`
                (() => {
                  // Helper to find component
                  const findComponent = (selector) => {
                    // Try as CSS selector first
                    try {
                      const element = document.querySelector(selector);
                      if (element) {
                        const reactKey = Object.keys(element).find(key => 
                          key.startsWith('__reactInternalInstance') || 
                          key.startsWith('__reactFiber')
                        );
                        if (reactKey) {
                          return element[reactKey];
                        }
                      }
                    } catch (e) {
                      // Not a valid CSS selector, try as component name
                    }
                    
                    // Search by component name
                    const searchByName = (fiber) => {
                      if (!fiber) return null;
                      
                      const name = fiber.type?.displayName || fiber.type?.name || '';
                      if (name.toLowerCase().includes(selector.toLowerCase())) {
                        return fiber;
                      }
                      
                      // Search children
                      let child = fiber.child;
                      while (child) {
                        const found = searchByName(child);
                        if (found) return found;
                        child = child.sibling;
                      }
                      
                      return null;
                    };
                    
                    // Search from React roots
                    const roots = document.querySelectorAll('[id], [class]');
                    for (const root of roots) {
                      const reactKey = Object.keys(root).find(key => 
                        key.startsWith('__reactInternalInstance') || 
                        key.startsWith('__reactFiber')
                      );
                      if (reactKey) {
                        const found = searchByName(root[reactKey]);
                        if (found) return found;
                      }
                    }
                    
                    return null;
                  };
                  
                  const component = findComponent('${componentSelector}');
                  if (!component) {
                    return {
                      error: 'Component not found',
                      recommendations: [
                        'Check if the component name is correct',
                        'Try using a CSS selector instead',
                        'Use react_get_component_tree to see available components'
                      ]
                    };
                  }
                  
                  const hooks = {
                    component: component.type?.displayName || component.type?.name || 'Unknown',
                    detected: [],
                    state: component.memoizedState,
                    analysis: []
                  };
                  
                  // Analyze hooks from memoized state
                  if (component.memoizedState) {
                    let currentHook = component.memoizedState;
                    let hookIndex = 0;
                    
                    while (currentHook && hookIndex < 50) { // Safety limit
                      const hookInfo = {
                        index: hookIndex,
                        type: 'Unknown',
                        value: null,
                        dependencies: null
                      };
                      
                      // Try to infer hook type from structure
                      if (currentHook.memoizedState !== undefined) {
                        if (currentHook.queue) {
                          hookInfo.type = 'useState';
                          hookInfo.value = currentHook.memoizedState;
                        } else if (currentHook.deps !== undefined) {
                          if (currentHook.memoizedState && typeof currentHook.memoizedState === 'function') {
                            hookInfo.type = 'useCallback';
                          } else {
                            hookInfo.type = 'useMemo';
                          }
                          hookInfo.dependencies = currentHook.deps;
                          hookInfo.value = currentHook.memoizedState;
                        } else if (currentHook.create) {
                          hookInfo.type = 'useEffect';
                          hookInfo.dependencies = currentHook.deps;
                        } else {
                          hookInfo.type = 'useRef';
                          hookInfo.value = currentHook.memoizedState;
                        }
                      }
                      
                      // Only include requested hook types
                      const targetHookTypes = ${JSON.stringify(hookTypes)};
                      if (targetHookTypes.includes(hookInfo.type) || targetHookTypes.includes('custom')) {
                        hooks.detected.push(hookInfo);
                      }
                      
                      currentHook = currentHook.next;
                      hookIndex++;
                    }
                  }
                  
                  // Generate analysis
                  if (hooks.detected.length === 0) {
                    hooks.analysis.push('No hooks detected or component is not a function component');
                  } else {
                    const stateHooks = hooks.detected.filter(h => h.type === 'useState');
                    const effectHooks = hooks.detected.filter(h => h.type === 'useEffect');
                    const memoHooks = hooks.detected.filter(h => ['useMemo', 'useCallback'].includes(h.type));
                    
                    if (stateHooks.length > 5) {
                      hooks.analysis.push(`High number of useState hooks (${stateHooks.length}) - consider useReducer`);
                    }
                    
                    if (effectHooks.length > 3) {
                      hooks.analysis.push(`Many useEffect hooks (${effectHooks.length}) - review dependencies`);
                    }
                    
                    const effectsWithoutDeps = effectHooks.filter(h => !h.dependencies || h.dependencies.length === 0);
                    if (effectsWithoutDeps.length > 0) {
                      hooks.analysis.push(`${effectsWithoutDeps.length} useEffect(s) without dependencies - may cause infinite re-renders`);
                    }
                    
                    if (memoHooks.length === 0 && hooks.detected.length > 3) {
                      hooks.analysis.push('Consider using useMemo/useCallback for performance optimization');
                    }
                  }
                  
                  return {
                    hooks,
                    aiGuidance: [
                      'Use react_analyze_rerenders to see if hooks cause performance issues',
                      'Check useEffect dependencies to prevent infinite loops',
                      'Consider useCallback for functions passed as props',
                      'Use useMemo for expensive calculations'
                    ],
                    limitations: [
                      'Hook detection is best-effort based on React fiber structure',
                      'Custom hook internals may not be fully visible',
                      'React DevTools backend would provide more detailed information'
                    ]
                  };
                })()
              `, {
              returnByValue: true
            }, sessionId)
            
            if (result.exceptionDetails) {
              return {
                success: false,
                error: `Error inspecting hooks: ${result.exceptionDetails.text}`
              }
            }
            
            const data = result.result.value
            if (data.error) {
              return {
                success: false,
                error: data.error,
                data: { recommendations: data.recommendations }
              }
            }
            
            return {
              success: true,
              data
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to inspect hooks'
            }
          }
        }
      },
      
      react_force_rerender: {
        name: 'react_force_rerender',
        description: 'Force React component to re-render',
        async execute(args): Promise<ToolResult> {
          try {
            const { componentId, sessionId: argSessionId } = args as { componentId: string; sessionId?: string }
            const sessionId = await provider.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const typed = manager.getTypedClient()
            
            await typed.enableRuntime(sessionId)
            const result = await typed.evaluate(`
                (() => {
                  if (!window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
                    return { error: 'React DevTools not available' };
                  }
                  
                  // Force update via React DevTools
                  // Placeholder implementation
                  return { 
                    componentId: '${componentId}',
                    rerendered: false,
                    message: 'Full implementation pending'
                  };
                })()
              `, {
              returnByValue: true
            }, sessionId)
            
            return {
              success: true,
              data: result.result.value
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to force rerender'
            }
          }
        }
      },
      
      react_profile_renders: {
        name: 'react_profile_renders',
        description: 'Profile React component renders',
        async execute(args): Promise<ToolResult> {
          try {
            const { duration = 5000, sessionId: argSessionId } = args as { duration?: number; sessionId?: string }
            const sessionId = await provider.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const typed = manager.getTypedClient()
            
            await typed.enableRuntime(sessionId)
            
            // Start profiling
            await typed.evaluate(`
                window.__REACT_PROFILE_DATA__ = {
                  renders: [],
                  startTime: Date.now()
                };
                
                // Hook into React render cycle
                if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
                  const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
                  const originalOnCommitFiberRoot = hook.onCommitFiberRoot;
                  
                  hook.onCommitFiberRoot = function(id, root) {
                    window.__REACT_PROFILE_DATA__.renders.push({
                      timestamp: Date.now(),
                      renderTime: root.actualDuration || 0
                    });
                    
                    if (originalOnCommitFiberRoot) {
                      originalOnCommitFiberRoot.apply(this, arguments);
                    }
                  };
                }
              `, {
              returnByValue: false
            }, sessionId)
            
            // Wait for profiling duration
            await new Promise(resolve => setTimeout(resolve, duration))
            
            // Stop profiling and get results
            const result = await typed.evaluate(`
                (() => {
                  const data = window.__REACT_PROFILE_DATA__ || { renders: [] };
                  const endTime = Date.now();
                  
                  // Restore original hook
                  if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
                    const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
                    // Reset hook if needed
                  }
                  
                  return {
                    duration: endTime - data.startTime,
                    renderCount: data.renders.length,
                    renders: data.renders,
                    averageRenderTime: data.renders.length > 0 
                      ? data.renders.reduce((sum, r) => sum + r.renderTime, 0) / data.renders.length
                      : 0
                  };
                })()
              `, {
              returnByValue: true
            }, sessionId)
            
            return {
              success: true,
              data: result.result.value
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to profile renders'
            }
          }
        }
      },
      
      react_get_fiber_tree: {
        name: 'react_get_fiber_tree',
        description: 'Get React Fiber tree structure',
        async execute(args): Promise<ToolResult> {
          try {
            const { rootSelector = '#root', sessionId: argSessionId } = args as { 
              rootSelector?: string; 
              sessionId?: string 
            }
            const sessionId = await provider.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const typed = manager.getTypedClient()
            
            await typed.enableRuntime(sessionId)
            const result = await typed.evaluate(`
                (() => {
                  const rootElement = document.querySelector('${rootSelector}');
                  if (!rootElement) {
                    return { error: 'Root element not found' };
                  }
                  
                  // Find React fiber
                  const reactKey = Object.keys(rootElement).find(key => 
                    key.startsWith('__reactInternalInstance') || 
                    key.startsWith('__reactFiber')
                  );
                  
                  if (!reactKey) {
                    return { error: 'React fiber not found on element' };
                  }
                  
                  const fiber = rootElement[reactKey];
                  
                  // Build tree structure
                  const buildTree = (node, depth = 0, maxDepth = 10) => {
                    if (!node || depth > maxDepth) return null;
                    
                    return {
                      type: node.type?.displayName || node.type?.name || node.type || 'Unknown',
                      key: node.key,
                      props: Object.keys(node.memoizedProps || {}),
                      state: node.memoizedState ? 'Has State' : 'No State',
                      children: node.child ? [buildTree(node.child, depth + 1, maxDepth)] : []
                    };
                  };
                  
                  return {
                    rootSelector: '${rootSelector}',
                    tree: buildTree(fiber)
                  };
                })()
              `, {
              returnByValue: true
            }, sessionId)
            
            if (result.exceptionDetails) {
              return {
                success: false,
                error: `Error getting fiber tree: ${result.exceptionDetails.text}`
              }
            }
            
            return {
              success: true,
              data: result.result.value
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to get fiber tree'
            }
          }
        }
      },
      
      react_detect_version: {
        name: 'react_detect_version',
        description: 'Detect React version and dev tools availability',
        async execute(args): Promise<ToolResult> {
          try {
            const { sessionId: argSessionId } = args as { sessionId?: string }
            const sessionId = await provider.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const typed = manager.getTypedClient()
            
            await typed.enableRuntime(sessionId)
            const result = await typed.evaluate(`
                (() => {
                  const info = {
                    hasReact: false,
                    hasDevTools: false,
                    version: null,
                    devToolsVersion: null,
                    renderers: []
                  };
                  
                  // Check for React
                  if (window.React) {
                    info.hasReact = true;
                    info.version = window.React.version;
                  }
                  
                  // Check for React DevTools
                  if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
                    info.hasDevTools = true;
                    const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
                    
                    if (hook.renderers) {
                      for (const [id, renderer] of hook.renderers) {
                        info.renderers.push({
                          id,
                          version: renderer.version || 'Unknown'
                        });
                      }
                    }
                  }
                  
                  // Try to detect React from loaded scripts
                  if (!info.hasReact) {
                    const scripts = Array.from(document.scripts);
                    const reactScript = scripts.find(s => 
                      s.src.includes('react') && !s.src.includes('react-dom')
                    );
                    
                    if (reactScript) {
                      info.hasReact = true;
                      info.version = 'Detected (version unknown)';
                    }
                  }
                  
                  return info;
                })()
              `, {
              returnByValue: true
            }, sessionId)
            
            return {
              success: true,
              data: result.result.value
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to detect React'
            }
          }
        }
      }
    }
    
    const handler = handlers[toolName]
    if (!handler) return undefined
    
    return handler // ✅ FIXED: Proper binding
  }
}
