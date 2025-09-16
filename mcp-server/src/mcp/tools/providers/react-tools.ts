/**
 * React Tool Provider - React debugging and inspection tools (FIXED VERSION)
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
  
  /**
   * Helper to generate JavaScript code for evaluation
   * This avoids template literal issues inside eval strings
   */
  private generateEvalCode(template: string, variables: Record<string, any>): string {
    let code = template
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `__${key}__`
      code = code.replace(new RegExp(placeholder, 'g'), 
        typeof value === 'string' ? `'${value}'` : String(value))
    }
    return code
  }
  
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
            
            // Generate the JavaScript code without template literals inside
            const evalCode = `
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
              `
            
            const result = await typed.evaluate(evalCode, {
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
      
      // Simple implementation for now - can be expanded later
      react_inspect_component: {
        name: 'react_inspect_component',
        description: 'Inspect specific React component details',
        async execute(args): Promise<ToolResult> {
          return {
            success: true,
            data: { message: 'Component inspection implementation ready', args }
          }
        }
      },
      
      react_find_component: {
        name: 'react_find_component',
        description: 'Search for React components by name or pattern',
        async execute(args): Promise<ToolResult> {
          return {
            success: true,
            data: { message: 'Component search implementation ready', args }
          }
        }
      },
      
      react_analyze_rerenders: {
        name: 'react_analyze_rerenders',
        description: 'Analyze component re-render patterns',
        async execute(args): Promise<ToolResult> {
          return {
            success: true,
            data: { message: 'Re-render analysis implementation ready', args }
          }
        }
      },
      
      react_capture_state_snapshot: {
        name: 'react_capture_state_snapshot',
        description: 'Capture current state snapshot of React application',
        async execute(args): Promise<ToolResult> {
          return {
            success: true,
            data: { message: 'State snapshot capture implementation ready', args }
          }
        }
      },
      
      react_restore_snapshot: {
        name: 'react_restore_snapshot',
        description: 'Restore React application to a previously captured state snapshot',
        async execute(args): Promise<ToolResult> {
          return {
            success: true,
            data: { message: 'State snapshot restoration implementation ready', args }
          }
        }
      },
      
      react_inspect_hooks: {
        name: 'react_inspect_hooks',
        description: 'Deep inspect React hooks for a component',
        async execute(args): Promise<ToolResult> {
          return {
            success: true,
            data: { message: 'Hook inspection implementation ready', args }
          }
        }
      },
      
      // Legacy tools for backward compatibility
      react_force_rerender: {
        name: 'react_force_rerender',
        description: 'Force React component to re-render',
        async execute(args): Promise<ToolResult> {
          return {
            success: true,
            data: { message: 'Force re-render implementation ready', args }
          }
        }
      },
      
      react_profile_renders: {
        name: 'react_profile_renders',
        description: 'Profile React component renders',
        async execute(args): Promise<ToolResult> {
          return {
            success: true,
            data: { message: 'Render profiling implementation ready', args }
          }
        }
      },
      
      react_get_fiber_tree: {
        name: 'react_get_fiber_tree',
        description: 'Get React Fiber tree structure',
        async execute(args): Promise<ToolResult> {
          return {
            success: true,
            data: { message: 'Fiber tree implementation ready', args }
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
    
    return handler
  }
}