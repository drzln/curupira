/**
 * Framework Tool Provider Factory - Level 2 (MCP Core)
 * Factory implementation for Framework detection and interaction tools
 */

import type { IToolProviderFactory, ProviderDependencies } from '../provider.factory.js';
import { BaseProviderFactory } from '../provider.factory.js';
import type { BaseToolProviderConfig } from '../base-tool-provider.js';
import { BaseToolProvider } from '../base-tool-provider.js';
import type { Schema } from '../../../core/interfaces/validator.interface.js';
import { withCDPCommand } from '../patterns/common-handlers.js';

// Schema definitions
const detectFrameworksSchema: Schema<{ sessionId?: string }> = {
  parse: (value) => {
    const obj = (value || {}) as any;
    return {
      sessionId: obj.sessionId
    };
  },
  safeParse: (value) => {
    try {
      return { success: true, data: detectFrameworksSchema.parse(value) };
    } catch (error) {
      return { success: false, error };
    }
  }
};

const getFrameworkVersionSchema: Schema<{ framework: string; sessionId?: string }> = {
  parse: (value) => {
    if (typeof value !== 'object' || value === null) {
      throw new Error('Expected object');
    }
    const obj = value as any;
    if (typeof obj.framework !== 'string') {
      throw new Error('framework must be a string');
    }
    return {
      framework: obj.framework,
      sessionId: obj.sessionId
    };
  },
  safeParse: (value) => {
    try {
      return { success: true, data: getFrameworkVersionSchema.parse(value) };
    } catch (error) {
      return { success: false, error };
    }
  }
};

class FrameworkToolProvider extends BaseToolProvider {
  protected initializeTools(): void {
    // Register framework_detect tool
    this.registerTool(
      this.createTool(
        'framework_detect',
        'Detect JavaScript frameworks present on the page',
        detectFrameworksSchema,
        async (args, context) => {
          const detectionScript = `
            (function() {
              const frameworks = [];
              
              // React detection
              if (window.React || document.querySelector('[data-reactroot]') || 
                  window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
                frameworks.push({
                  name: 'React',
                  version: window.React?.version || 'unknown',
                  devtools: !!window.__REACT_DEVTOOLS_GLOBAL_HOOK__
                });
              }
              
              // Vue detection
              if (window.Vue || document.querySelector('[data-v-]') ||
                  window.__VUE__) {
                frameworks.push({
                  name: 'Vue',
                  version: window.Vue?.version || 'unknown',
                  devtools: !!window.__VUE_DEVTOOLS_GLOBAL_HOOK__
                });
              }
              
              // Angular detection
              if (window.ng || window.angular || document.querySelector('[ng-app]') ||
                  document.querySelector('[data-ng-app]')) {
                frameworks.push({
                  name: 'Angular',
                  version: window.ng?.version?.full || window.angular?.version?.full || 'unknown',
                  devtools: !!window.ng?.probe
                });
              }
              
              // Svelte detection
              if (window.__svelte || document.querySelector('[data-svelte-h]')) {
                frameworks.push({
                  name: 'Svelte',
                  version: 'unknown',
                  devtools: false
                });
              }
              
              // jQuery detection
              if (window.jQuery || window.$) {
                frameworks.push({
                  name: 'jQuery',
                  version: window.jQuery?.fn?.jquery || window.$?.fn?.jquery || 'unknown',
                  devtools: false
                });
              }
              
              return {
                frameworks,
                count: frameworks.length,
                timestamp: new Date().toISOString()
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
            data: unwrapped.result?.value || { frameworks: [], count: 0 }
          };
        }
      )
    );

    // Register framework_version tool
    this.registerTool(
      this.createTool(
        'framework_version',
        'Get detailed version information for a specific framework',
        getFrameworkVersionSchema,
        async (args, context) => {
          const versionScript = `
            (function() {
              const framework = '${args.framework.toLowerCase()}';
              let result = { framework: '${args.framework}', found: false };
              
              switch(framework) {
                case 'react':
                  // Enhanced React detection (works even when React is not global)
                  let reactVersion = null;
                  let hasReact = false;
                  
                  // Method 1: Check global React
                  if (window.React?.version) {
                    reactVersion = window.React.version;
                    hasReact = true;
                  }
                  
                  // Method 2: Check DevTools hook for version
                  if (!hasReact && window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
                    const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
                    if (hook.renderers && hook.renderers.size > 0) {
                      for (const [id, renderer] of hook.renderers) {
                        if (renderer.version) {
                          reactVersion = renderer.version;
                          hasReact = true;
                          break;
                        }
                      }
                    }
                  }
                  
                  // Method 3: Check for React in DOM
                  if (!hasReact) {
                    const reactElements = document.querySelectorAll('[data-reactroot], [data-react-checksum]');
                    if (reactElements.length > 0) {
                      hasReact = true;
                      reactVersion = 'detected (version unknown)';
                    }
                  }
                  
                  // Method 4: Check for React fiber properties
                  if (!hasReact) {
                    const allElements = document.querySelectorAll('*');
                    for (const element of allElements) {
                      const keys = Object.keys(element);
                      if (keys.some(key => key.startsWith('__reactFiber') || key.startsWith('_reactInternalFiber'))) {
                        hasReact = true;
                        reactVersion = 'detected (version unknown)';
                        break;
                      }
                    }
                  }
                  
                  if (hasReact) {
                    result = {
                      framework: 'React',
                      found: true,
                      version: reactVersion || 'unknown',
                      details: {
                        devtools: !!window.__REACT_DEVTOOLS_GLOBAL_HOOK__,
                        strictMode: !!document.querySelector('[data-react-strict-mode]'),
                        concurrent: !!(window.React?.unstable_createRoot || window.React?.createRoot),
                        fiberDetected: !!document.querySelector('*[class*="__reactFiber"], *[class*="_reactInternalFiber"]'),
                        globalReact: !!window.React,
                        rendererCount: window.__REACT_DEVTOOLS_GLOBAL_HOOK__?.renderers?.size || 0
                      }
                    };
                  }
                  break;
                case 'vue':
                  if (window.Vue) {
                    result = {
                      framework: 'Vue',
                      found: true,
                      version: window.Vue.version,
                      details: {
                        devtools: !!window.__VUE_DEVTOOLS_GLOBAL_HOOK__,
                        composition: !!window.Vue.ref,
                        router: !!window.VueRouter
                      }
                    };
                  }
                  break;
                case 'angular':
                  if (window.ng) {
                    result = {
                      framework: 'Angular',
                      found: true,
                      version: window.ng.version?.full || 'unknown',
                      details: {
                        devtools: !!window.ng.probe,
                        ivy: !!window.ng.enableIvy,
                        zone: !!window.Zone
                      }
                    };
                  }
                  break;
                default:
                  result.error = 'Framework not supported for detailed version check';
              }
              
              return result;
            })()
          `;

          const result = await withCDPCommand(
            'Runtime.evaluate',
            {
              expression: versionScript,
              returnByValue: true
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
            data: unwrapped.result?.value || { framework: args.framework, found: false }
          };
        }
      )
    );

    // Register framework_devtools tool
    this.registerTool({
      name: 'framework_devtools',
      description: 'Check if framework devtools are available and inject if missing',
      argsSchema: {
        parse: (value) => {
          const obj = (value || {}) as any;
          return {
            framework: obj.framework || 'react',
            action: obj.action || 'check', // 'check' or 'inject'
            sessionId: obj.sessionId
          };
        },
        safeParse: (value) => {
          try {
            const obj = (value || {}) as any;
            return {
              success: true,
              data: {
                framework: obj.framework || 'react',
                action: obj.action || 'check',
                sessionId: obj.sessionId
              }
            };
          } catch (error) {
            return { success: false, error };
          }
        }
      },
      handler: async (args, context) => {
        const framework = args.framework.toLowerCase();
        
        if (args.action === 'check') {
          const checkScript = `
            (function() {
              switch('${framework}') {
                case 'react':
                  return {
                    framework: 'React',
                    available: !!window.__REACT_DEVTOOLS_GLOBAL_HOOK__,
                    hook: !!window.__REACT_DEVTOOLS_GLOBAL_HOOK__?.renderers?.size
                  };
                case 'vue':
                  return {
                    framework: 'Vue',
                    available: !!window.__VUE_DEVTOOLS_GLOBAL_HOOK__,
                    hook: !!window.__VUE_DEVTOOLS_GLOBAL_HOOK__?.apps?.length
                  };
                default:
                  return { framework: '${framework}', available: false, error: 'Unsupported framework' };
              }
            })()
          `;

          const result = await withCDPCommand(
            'Runtime.evaluate',
            { expression: checkScript, returnByValue: true },
            context
          );

          if (result.isErr()) {
            return { success: false, error: result.unwrapErr() };
          }

          const unwrapped = result.unwrap() as any;
          return {
            success: true,
            data: unwrapped.result?.value || { available: false }
          };
        }

        return {
          success: false,
          error: 'Devtools injection not implemented yet'
        };
      }
    });
  }
}

export class FrameworkToolProviderFactory extends BaseProviderFactory<FrameworkToolProvider> {
  create(deps: ProviderDependencies): FrameworkToolProvider {
    const config: BaseToolProviderConfig = {
      name: 'framework',
      description: 'JavaScript framework detection and interaction tools'
    };

    return new FrameworkToolProvider(
      deps.chromeService,
      this.createProviderLogger(deps, config.name),
      deps.validator,
      config
    );
  }
}