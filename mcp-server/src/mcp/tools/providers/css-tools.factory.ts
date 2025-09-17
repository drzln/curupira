/**
 * CSS Inspection Tools Factory - Level 2 (MCP Core)
 * Provides comprehensive CSS debugging and inspection capabilities
 */

import type { IToolProviderFactory, ProviderDependencies } from '../provider.factory.js';
import { BaseProviderFactory } from '../provider.factory.js';
import type { BaseToolProviderConfig } from '../base-tool-provider.js';
import { BaseToolProvider } from '../base-tool-provider.js';
import type { Schema } from '../../../core/interfaces/validator.interface.js';
import type { ToolResult } from '../registry.js';
import type { ExecutionContext } from '../base-tool-provider.js';
import { withCDPCommand, withScriptExecution } from '../patterns/common-handlers.js';

// Schema definitions
const cssSelectorSchema: Schema<{ 
  selector: string; 
  properties?: string[];
  sessionId?: string 
}> = {
  parse: (value) => {
    if (typeof value !== 'object' || value === null) {
      throw new Error('Expected object');
    }
    const obj = value as any;
    if (typeof obj.selector !== 'string') {
      throw new Error('selector must be a string');
    }
    return {
      selector: obj.selector,
      properties: Array.isArray(obj.properties) ? obj.properties : undefined,
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

const cssInjectSchema: Schema<{
  css: string;
  id?: string;
  sessionId?: string;
}> = {
  parse: (value) => {
    if (typeof value !== 'object' || value === null) {
      throw new Error('Expected object');
    }
    const obj = value as any;
    if (typeof obj.css !== 'string') {
      throw new Error('css must be a string');
    }
    return {
      css: obj.css,
      id: obj.id || 'curupira-injected-styles',
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

const basicSchema: Schema<{ sessionId?: string }> = {
  parse: (value) => {
    const obj = (value || {}) as any;
    return { sessionId: obj.sessionId };
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

class CSSToolProvider extends BaseToolProvider {
  constructor(config: BaseToolProviderConfig & ProviderDependencies) {
    super(config.chromeService, config.logger, config.validator, {
      name: config.name,
      description: config.description
    });
  }
  protected initializeTools(): void {
    // Register css_get_computed_styles tool
    this.registerTool({
      name: 'css_get_computed_styles',
      description: 'Get computed styles for elements matching a CSS selector',
      argsSchema: cssSelectorSchema,
      handler: async (args: any, context: ExecutionContext): Promise<ToolResult> => {
        const script = `
          (() => {
            const elements = document.querySelectorAll('${args.selector}');
            const results = [];
            
            for (const el of elements) {
              const computed = window.getComputedStyle(el);
              const styles = {};
              
              ${args.properties ? 
                `// Get specific properties
                const properties = ${JSON.stringify(args.properties)};
                for (const prop of properties) {
                  styles[prop] = computed.getPropertyValue(prop);
                }` :
                `// Get all styles
                for (let i = 0; i < computed.length; i++) {
                  const prop = computed[i];
                  styles[prop] = computed.getPropertyValue(prop);
                }`
              }
              
              results.push({
                element: {
                  tagName: el.tagName.toLowerCase(),
                  id: el.id || null,
                  className: el.className || null,
                  textContent: el.textContent?.slice(0, 100) || null
                },
                styles
              });
            }
            
            return {
              selector: '${args.selector}',
              matchCount: results.length,
              elements: results
            };
          })()
        `;

        const result = await withScriptExecution(script, context);

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

    // Register css_get_stylesheets tool
    this.registerTool({
      name: 'css_get_stylesheets',
      description: 'List all stylesheets and their rules',
      argsSchema: basicSchema,
      handler: async (args: any, context: ExecutionContext): Promise<ToolResult> => {
        const script = `
          (() => {
            const stylesheets = [];
            
            for (const sheet of document.styleSheets) {
              try {
                const rules = Array.from(sheet.cssRules || sheet.rules || []);
                stylesheets.push({
                  href: sheet.href,
                  title: sheet.title,
                  media: sheet.media.mediaText,
                  disabled: sheet.disabled,
                  ruleCount: rules.length,
                  rules: rules.slice(0, 50).map(r => ({ // Limit to first 50 rules
                    type: r.type,
                    selectorText: r.selectorText,
                    cssText: r.cssText?.slice(0, 200) // Truncate long rules
                  }))
                });
              } catch (e) {
                // Cross-origin stylesheet
                stylesheets.push({
                  href: sheet.href,
                  title: sheet.title,
                  media: sheet.media.mediaText,
                  disabled: sheet.disabled,
                  error: 'Cross-origin stylesheet - unable to access rules'
                });
              }
            }
            
            return {
              totalSheets: stylesheets.length,
              stylesheets
            };
          })()
        `;

        const result = await withScriptExecution(script, context);

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

    // Register css_get_animations tool
    this.registerTool({
      name: 'css_get_animations',
      description: 'Get active CSS animations and transitions',
      argsSchema: basicSchema,
      handler: async (args: any, context: ExecutionContext): Promise<ToolResult> => {
        const script = `
          (() => {
            const animations = document.getAnimations ? document.getAnimations() : [];
            
            return {
              totalAnimations: animations.length,
              animations: animations.map(anim => ({
                id: anim.id,
                playState: anim.playState,
                startTime: anim.startTime,
                currentTime: anim.currentTime,
                playbackRate: anim.playbackRate,
                animationType: anim.constructor.name,
                target: anim.effect?.target ? {
                  tagName: anim.effect.target.tagName.toLowerCase(),
                  id: anim.effect.target.id || null,
                  className: anim.effect.target.className || null
                } : null,
                timing: anim.effect?.getTiming ? anim.effect.getTiming() : null,
                keyframes: anim.effect?.getKeyframes ? 
                  anim.effect.getKeyframes().slice(0, 10) : null // Limit keyframes
              }))
            };
          })()
        `;

        const result = await withScriptExecution(script, context);

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

    // Register css_inject_styles tool
    this.registerTool({
      name: 'css_inject_styles',
      description: 'Inject temporary CSS for testing purposes',
      argsSchema: cssInjectSchema,
      handler: async (args: any, context: ExecutionContext): Promise<ToolResult> => {
        const script = `
          (() => {
            let style = document.getElementById('${args.id}');
            if (!style) {
              style = document.createElement('style');
              style.id = '${args.id}';
              document.head.appendChild(style);
            }
            style.textContent = ${JSON.stringify(args.css)};
            
            return {
              injected: true,
              id: '${args.id}',
              cssLength: ${args.css.length},
              timestamp: Date.now()
            };
          })()
        `;

        const result = await withScriptExecution(script, context);

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

    // Register css_get_css_variables tool
    this.registerTool({
      name: 'css_get_css_variables',
      description: 'Get CSS custom properties (variables) from root and elements',
      argsSchema: cssSelectorSchema,
      handler: async (args: any, context: ExecutionContext): Promise<ToolResult> => {
        const script = `
          (() => {
            const selector = '${args.selector}' || ':root';
            const elements = document.querySelectorAll(selector);
            const results = [];
            
            for (const el of elements) {
              const computed = window.getComputedStyle(el);
              const cssVariables = {};
              
              // Extract CSS custom properties (variables)
              for (let i = 0; i < computed.length; i++) {
                const prop = computed[i];
                if (prop.startsWith('--')) {
                  cssVariables[prop] = computed.getPropertyValue(prop);
                }
              }
              
              results.push({
                element: {
                  tagName: el.tagName.toLowerCase(),
                  id: el.id || null,
                  className: el.className || null
                },
                variables: cssVariables,
                variableCount: Object.keys(cssVariables).length
              });
            }
            
            return {
              selector,
              matchCount: results.length,
              elements: results
            };
          })()
        `;

        const result = await withScriptExecution(script, context);

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

    // Register css_get_media_queries tool
    this.registerTool({
      name: 'css_get_media_queries',
      description: 'Get active media queries and their match status',
      argsSchema: basicSchema,
      handler: async (args: any, context: ExecutionContext): Promise<ToolResult> => {
        const script = `
          (() => {
            const mediaQueries = [];
            
            // Common media queries to check
            const commonQueries = [
              '(max-width: 768px)',
              '(max-width: 1024px)',
              '(max-width: 1200px)',
              '(min-width: 769px)',
              '(min-width: 1025px)',
              '(prefers-color-scheme: dark)',
              '(prefers-color-scheme: light)',
              '(prefers-reduced-motion: reduce)',
              '(orientation: portrait)',
              '(orientation: landscape)',
              '(hover: hover)',
              '(pointer: coarse)',
              '(pointer: fine)'
            ];
            
            for (const query of commonQueries) {
              try {
                const mq = window.matchMedia(query);
                mediaQueries.push({
                  query,
                  matches: mq.matches,
                  media: mq.media
                });
              } catch (e) {
                mediaQueries.push({
                  query,
                  matches: false,
                  error: e.message
                });
              }
            }
            
            // Get viewport info
            const viewport = {
              width: window.innerWidth,
              height: window.innerHeight,
              devicePixelRatio: window.devicePixelRatio,
              orientation: window.screen?.orientation?.type || 'unknown'
            };
            
            return {
              viewport,
              mediaQueries,
              activeQueries: mediaQueries.filter(mq => mq.matches)
            };
          })()
        `;

        const result = await withScriptExecution(script, context);

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

export class CSSToolsFactory extends BaseProviderFactory implements IToolProviderFactory {
  name = 'css' as const;

  create(dependencies: ProviderDependencies): CSSToolProvider {
    const config: BaseToolProviderConfig & ProviderDependencies = {
      name: this.name,
      description: 'CSS inspection and manipulation tools',
      ...dependencies
    };
    
    return new CSSToolProvider(config);
  }
}