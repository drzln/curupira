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
        name: 'react_find_component',
        description: 'Find React component by name',
        inputSchema: {
          type: 'object',
          properties: {
            componentName: { type: 'string', description: 'Component name to search for' },
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          },
          required: ['componentName']
        }
      },
      {
        name: 'react_inspect_props',
        description: 'Inspect React component props',
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
        name: 'react_inspect_state',
        description: 'Inspect React component state',
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
        name: 'react_inspect_hooks',
        description: 'Inspect React component hooks',
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
      react_find_component: {
        name: 'react_find_component',
        description: 'Find React component by name',
        async execute(args): Promise<ToolResult> {
          try {
            const { componentName, sessionId: argSessionId } = args as { componentName: string; sessionId?: string }
            const sessionId = await provider.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const typed = manager.getTypedClient()
            
            await typed.enableRuntime(sessionId)
            const result = await typed.evaluate(`
                (() => {
                  if (!window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
                    return { error: 'React DevTools not available' };
                  }
                  
                  const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
                  const renderers = hook.renderers || new Map();
                  const components = [];
                  
                  for (const [id, renderer] of renderers) {
                    const fiber = renderer.getFiberRoots ? renderer.getFiberRoots() : [];
                    // Walk fiber tree to find matching components
                    const walk = (node) => {
                      if (!node) return;
                      
                      const name = node.type?.displayName || node.type?.name || '';
                      if (name.includes('${componentName}')) {
                        components.push({
                          id: node._debugID || node.stateNode?._reactInternalFiber?._debugID,
                          name,
                          props: node.memoizedProps,
                          state: node.memoizedState
                        });
                      }
                      
                      if (node.child) walk(node.child);
                      if (node.sibling) walk(node.sibling);
                    };
                    
                    fiber.forEach(root => walk(root.current));
                  }
                  
                  return { components, found: components.length };
                })()
              `, {
              returnByValue: true,
              awaitPromise: true
            }, sessionId)
            
            if (result.exceptionDetails) {
              return {
                success: false,
                error: `Error finding component: ${result.exceptionDetails.text}`
              }
            }
            
            const data = result.result.value as ReactComponentSearchResult
            if (data.error) {
              return {
                success: false,
                error: data.error
              }
            }
            
            return {
              success: true,
              data
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to find component'
            }
          }
        }
      },
      
      react_inspect_props: {
        name: 'react_inspect_props',
        description: 'Inspect React component props',
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
                  
                  // Placeholder - real implementation would use React DevTools API
                  return { 
                    componentId: '${componentId}',
                    props: {},
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
              error: error instanceof Error ? error.message : 'Failed to inspect props'
            }
          }
        }
      },
      
      react_inspect_state: {
        name: 'react_inspect_state',
        description: 'Inspect React component state',
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
                  
                  // Placeholder - real implementation would use React DevTools API
                  return { 
                    componentId: '${componentId}',
                    state: {},
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
              error: error instanceof Error ? error.message : 'Failed to inspect state'
            }
          }
        }
      },
      
      react_inspect_hooks: {
        name: 'react_inspect_hooks',
        description: 'Inspect React component hooks',
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
                  
                  // Placeholder - real implementation would inspect hooks
                  return { 
                    componentId: '${componentId}',
                    hooks: [],
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
