/**
 * React Tool Provider Factory - Level 2 (MCP Core)
 * Factory implementation for React debugging tool provider
 */

import type { IToolProviderFactory, ProviderDependencies } from '../provider.factory.js';
import { BaseProviderFactory } from '../provider.factory.js';
import type { BaseToolProviderConfig } from '../base-tool-provider.js';
import { BaseToolProvider } from '../base-tool-provider.js';
import type { Schema } from '../../../core/interfaces/validator.interface.js';
import type { ToolResult } from '../registry.js';
import { withScriptExecution } from '../patterns/common-handlers.js';

// Schema definitions
const componentTreeSchema: Schema<{ depth?: number; sessionId?: string }> = {
  parse: (value) => {
    const obj = (value || {}) as any;
    return {
      depth: typeof obj.depth === 'number' ? obj.depth : 3,
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

const findComponentSchema: Schema<{ name: string; sessionId?: string }> = {
  parse: (value) => {
    if (typeof value !== 'object' || value === null) {
      throw new Error('Expected object');
    }
    const obj = value as any;
    if (typeof obj.name !== 'string') {
      throw new Error('name must be a string');
    }
    return {
      name: obj.name,
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

class ReactToolProvider extends BaseToolProvider {
  protected initializeTools(): void {
    // Register react_detect tool
    this.registerTool({
      name: 'react_detect',
      description: 'Detect React presence and version',
      argsSchema: {
        parse: (value) => value || {},
        safeParse: (value) => ({ success: true, data: value || {} })
      },
      handler: async (args, context) => {
        const detectScript = `
          (() => {
            // Check for React in various locations
            const react = window.React || 
              (window.__REACT_DEVTOOLS_GLOBAL_HOOK__?.renderers?.size > 0) ||
              document.querySelector('[data-reactroot]') ||
              document.querySelector('[data-react-root]');
            
            if (!react) return { detected: false };
            
            // Try to get version
            let version = 'unknown';
            if (window.React?.version) {
              version = window.React.version;
            } else if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
              const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
              for (const [id, renderer] of hook.renderers || []) {
                if (renderer.version) {
                  version = renderer.version;
                  break;
                }
              }
            }
            
            return {
              detected: true,
              version,
              devToolsAvailable: !!window.__REACT_DEVTOOLS_GLOBAL_HOOK__
            };
          })()
        `;

        const result = await withScriptExecution(detectScript, context);

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

    // Register react_component_tree tool
    this.registerTool(
      this.createTool(
        'react_component_tree',
        'Get React component tree',
        componentTreeSchema,
        async (args, context) => {
          const treeScript = `
            (() => {
              const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
              if (!hook) return { error: 'React DevTools not available' };
              
              const fiber = hook.getFiberRoots?.(1)?.values().next().value;
              if (!fiber) return { error: 'No React fiber root found' };
              
              function buildTree(node, depth = 0, maxDepth = ${args.depth}) {
                if (!node || depth > maxDepth) return null;
                
                const element = {
                  type: node.type?.name || node.type || 'Unknown',
                  key: node.key,
                  props: Object.keys(node.memoizedProps || {}).slice(0, 5),
                  children: []
                };
                
                let child = node.child;
                while (child) {
                  const childElement = buildTree(child, depth + 1, maxDepth);
                  if (childElement) element.children.push(childElement);
                  child = child.sibling;
                }
                
                return element;
              }
              
              return buildTree(fiber.current);
            })()
          `;

          const result = await withScriptExecution(treeScript, context);

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
      )
    );

    // Register react_find_component tool
    this.registerTool(
      this.createTool(
        'react_find_component',
        'Find React components by name',
        findComponentSchema,
        async (args, context) => {
          const findScript = `
            (() => {
              const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
              if (!hook) return { error: 'React DevTools not available' };
              
              const results = [];
              const componentName = '${args.name}';
              
              function findComponents(node, path = []) {
                if (!node) return;
                
                const nodeName = node.type?.name || node.type?.displayName || '';
                if (nodeName.includes(componentName)) {
                  results.push({
                    name: nodeName,
                    path: path.join(' > '),
                    props: Object.keys(node.memoizedProps || {}),
                    state: node.memoizedState ? 'Has state' : 'No state'
                  });
                }
                
                const newPath = [...path, nodeName || 'Unknown'];
                
                let child = node.child;
                while (child) {
                  findComponents(child, newPath);
                  child = child.sibling;
                }
              }
              
              const fiber = hook.getFiberRoots?.(1)?.values().next().value;
              if (fiber) {
                findComponents(fiber.current);
              }
              
              return { 
                found: results.length,
                components: results.slice(0, 10) 
              };
            })()
          `;

          const result = await withScriptExecution(findScript, context);

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
      )
    );

    // Register react_profiler tool
    this.registerTool({
      name: 'react_profiler',
      description: 'Enable/disable React profiler',
      argsSchema: {
        parse: (value) => {
          const obj = (value || {}) as any;
          return {
            enabled: obj.enabled !== false,
            sessionId: obj.sessionId
          };
        },
        safeParse: (value) => {
          try {
            return { 
              success: true, 
              data: {
                enabled: (value as any)?.enabled !== false,
                sessionId: (value as any)?.sessionId
              }
            };
          } catch (error) {
            return { success: false, error };
          }
        }
      },
      handler: async (args, context) => {
        const profilerScript = `
          (() => {
            const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
            if (!hook) return { error: 'React DevTools not available' };
            
            try {
              if (${args.enabled}) {
                hook.startProfiling?.(true);
                return { message: 'React profiler enabled' };
              } else {
                const profilingData = hook.stopProfiling?.();
                return { 
                  message: 'React profiler disabled',
                  data: profilingData ? 'Profiling data available' : 'No profiling data'
                };
              }
            } catch (error) {
              return { error: error.message };
            }
          })()
        `;

        const result = await withScriptExecution(profilerScript, context);

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

export class ReactToolProviderFactory extends BaseProviderFactory<ReactToolProvider> {
  create(deps: ProviderDependencies): ReactToolProvider {
    const config: BaseToolProviderConfig = {
      name: 'react',
      description: 'React debugging and inspection tools'
    };

    return new ReactToolProvider(
      deps.chromeService,
      this.createProviderLogger(deps, config.name),
      deps.validator,
      config
    );
  }
}