/**
 * CDP Tool Provider Factory - Level 2 (MCP Core)
 * Factory implementation for sophisticated CDP tool provider with comprehensive Chrome DevTools Protocol support
 * Extracted and enhanced from archived cdp-tools.ts with modern DI patterns
 */

import type { IToolProviderFactory, ProviderDependencies } from '../provider.factory.js';
import { BaseProviderFactory } from '../provider.factory.js';
import type { BaseToolProviderConfig } from '../base-tool-provider.js';
import { BaseToolProvider } from '../base-tool-provider.js';
import type { Schema } from '../../../core/interfaces/validator.interface.js';
import type { ToolResult } from '../registry.js';
import type { SessionId } from '@curupira/shared/types';
import { withCDPCommand, withScriptExecution, withDOMOperation, withRetry } from '../patterns/common-handlers.js';

// Enhanced schema definitions for all CDP operations
const evaluateSchema: Schema<{ expression: string; sessionId?: string; awaitPromise?: boolean; returnByValue?: boolean }> = {
  parse: (value) => {
    if (typeof value !== 'object' || value === null) {
      throw new Error('Expected object');
    }
    const obj = value as any;
    if (typeof obj.expression !== 'string') {
      throw new Error('expression must be a string');
    }
    return {
      expression: obj.expression,
      sessionId: obj.sessionId,
      awaitPromise: typeof obj.awaitPromise === 'boolean' ? obj.awaitPromise : true,
      returnByValue: typeof obj.returnByValue === 'boolean' ? obj.returnByValue : true
    };
  },
  safeParse: (value) => {
    try {
      return { success: true, data: evaluateSchema.parse(value) };
    } catch (error) {
      return { success: false, error };
    }
  }
};

const navigateSchema: Schema<{ url: string; sessionId?: string; waitUntil?: string }> = {
  parse: (value) => {
    if (typeof value !== 'object' || value === null) {
      throw new Error('Expected object');
    }
    const obj = value as any;
    if (typeof obj.url !== 'string') {
      throw new Error('url must be a string');
    }
    const validWaitConditions = ['load', 'domcontentloaded', 'networkidle0', 'networkidle2'];
    const waitUntil = obj.waitUntil || 'load';
    if (!validWaitConditions.includes(waitUntil)) {
      throw new Error(`waitUntil must be one of: ${validWaitConditions.join(', ')}`);
    }
    return {
      url: obj.url,
      sessionId: obj.sessionId,
      waitUntil
    };
  },
  safeParse: (value) => {
    try {
      return { success: true, data: navigateSchema.parse(value) };
    } catch (error) {
      return { success: false, error };
    }
  }
};

const screenshotSchema: Schema<{ sessionId?: string; fullPage?: boolean; selector?: string; format?: string; quality?: number }> = {
  parse: (value) => {
    const obj = (value || {}) as any;
    return {
      sessionId: obj.sessionId,
      fullPage: typeof obj.fullPage === 'boolean' ? obj.fullPage : false,
      selector: typeof obj.selector === 'string' ? obj.selector : undefined,
      format: obj.format === 'jpeg' ? 'jpeg' : 'png',
      quality: typeof obj.quality === 'number' ? Math.max(0, Math.min(100, obj.quality)) : 90
    };
  },
  safeParse: (value) => {
    try {
      return { success: true, data: screenshotSchema.parse(value) };
    } catch (error) {
      return { success: false, error };
    }
  }
};

const setCookieSchema: Schema<{
  sessionId?: string;
  name: string;
  value: string;
  domain?: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: string;
}> = {
  parse: (value) => {
    if (typeof value !== 'object' || value === null) {
      throw new Error('Expected object');
    }
    const obj = value as any;
    if (typeof obj.name !== 'string') {
      throw new Error('name must be a string');
    }
    if (typeof obj.value !== 'string') {
      throw new Error('value must be a string');
    }
    const validSameSite = ['Strict', 'Lax', 'None'];
    const sameSite = obj.sameSite || 'Lax';
    if (!validSameSite.includes(sameSite)) {
      throw new Error(`sameSite must be one of: ${validSameSite.join(', ')}`);
    }
    return {
      sessionId: obj.sessionId,
      name: obj.name,
      value: obj.value,
      domain: obj.domain,
      path: obj.path || '/',
      secure: typeof obj.secure === 'boolean' ? obj.secure : false,
      httpOnly: typeof obj.httpOnly === 'boolean' ? obj.httpOnly : false,
      sameSite
    };
  },
  safeParse: (value) => {
    try {
      return { success: true, data: setCookieSchema.parse(value) };
    } catch (error) {
      return { success: false, error };
    }
  }
};

const getCookiesSchema: Schema<{ sessionId?: string; urls?: string[] }> = {
  parse: (value) => {
    const obj = (value || {}) as any;
    return {
      sessionId: obj.sessionId,
      urls: Array.isArray(obj.urls) ? obj.urls.filter((url: any) => typeof url === 'string') : undefined
    };
  },
  safeParse: (value) => {
    try {
      return { success: true, data: getCookiesSchema.parse(value) };
    } catch (error) {
      return { success: false, error };
    }
  }
};

const reloadSchema: Schema<{ sessionId?: string; ignoreCache?: boolean }> = {
  parse: (value) => {
    const obj = (value || {}) as any;
    return {
      sessionId: obj.sessionId,
      ignoreCache: typeof obj.ignoreCache === 'boolean' ? obj.ignoreCache : false
    };
  },
  safeParse: (value) => {
    try {
      return { success: true, data: reloadSchema.parse(value) };
    } catch (error) {
      return { success: false, error };
    }
  }
};

class CDPToolProvider extends BaseToolProvider {
  protected initializeTools(): void {
    // Register cdp_evaluate tool - Enhanced from archived implementation
    this.registerTool(
      this.createTool(
        'cdp_evaluate',
        'Evaluate JavaScript expression in the browser context with comprehensive error handling',
        evaluateSchema,
        async (args, context) => {
          try {
            this.logger.info({ expression: args.expression.substring(0, 100) }, 'Evaluating JavaScript expression');
            
            const result = await withScriptExecution(
              args.expression,
              context,
              {
                awaitPromise: args.awaitPromise,
                returnByValue: args.returnByValue,
                includeCommandLineAPI: false
              }
            );

            if (result.isErr()) {
              this.logger.error({ error: result.unwrapErr() }, 'Script evaluation failed');
              return {
                success: false,
                error: result.unwrapErr(),
                data: {
                  troubleshooting: [
                    '🔧 Check if the JavaScript expression is valid',
                    '🌐 Ensure the page has finished loading',
                    '🔄 Try wrapping async operations in promises',
                    '📝 Check browser console for additional errors'
                  ],
                  examples: [
                    'Simple: document.title',
                    'Async: await fetch("/api/data").then(r => r.json())',
                    'DOM query: document.querySelector("#app").innerHTML'
                  ]
                }
              };
            }

            const evaluationResult = result.unwrap();
            this.logger.info({ resultType: typeof evaluationResult }, 'Script evaluation completed successfully');

            return {
              success: true,
              data: {
                result: evaluationResult,
                type: typeof evaluationResult,
                timestamp: new Date().toISOString(),
                expressionLength: args.expression.length
              }
            };
          } catch (error) {
            this.logger.error({ error }, 'CDP evaluation failed');
            return {
              success: false,
              error: error instanceof Error ? error.message : 'JavaScript evaluation failed',
              data: {
                errorType: 'execution_failure',
                troubleshooting: [
                  'Verify Chrome connection is active',
                  'Check if Runtime domain is enabled',
                  'Ensure page context is available'
                ]
              }
            };
          }
        }
      )
    );

    // Register cdp_navigate tool - Enhanced with wait conditions
    this.registerTool(
      this.createTool(
        'cdp_navigate', 
        'Navigate to a URL with configurable wait conditions',
        navigateSchema,
        async (args, context) => {
          try {
            this.logger.info({ url: args.url, waitUntil: args.waitUntil }, 'Navigating to URL');
            
            const navigateResult = await withCDPCommand(
              'Page.navigate',
              { url: args.url },
              context
            );

            if (navigateResult.isErr()) {
              return {
                success: false,
                error: navigateResult.unwrapErr(),
                data: {
                  troubleshooting: [
                    '🌐 Check if the URL is valid and accessible',
                    '🔒 Verify SSL certificates for HTTPS URLs',
                    '🚫 Check if the site blocks automated access',
                    '🔄 Try a different wait condition'
                  ]
                }
              };
            }

            const navData = navigateResult.unwrap() as { frameId: string; loaderId: string };
            
            // Enhanced wait logic based on waitUntil parameter
            if (args.waitUntil !== 'load') {
              this.logger.info(`Implementing enhanced wait for: ${args.waitUntil}`);
              
              if (args.waitUntil === 'domcontentloaded') {
                await this.waitForDOMContentLoaded(context);
              } else if (args.waitUntil === 'networkidle0' || args.waitUntil === 'networkidle2') {
                await this.waitForNetworkIdle(context, args.waitUntil === 'networkidle0' ? 0 : 2);
              }
            }

            this.logger.info({ frameId: navData.frameId }, 'Navigation completed successfully');

            return {
              success: true,
              data: {
                frameId: navData.frameId,
                loaderId: navData.loaderId,
                url: args.url,
                waitCondition: args.waitUntil,
                timestamp: new Date().toISOString(),
                navigationId: navData.loaderId
              }
            };
          } catch (error) {
            this.logger.error({ error, url: args.url }, 'Navigation failed');
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Navigation failed'
            };
          }
        }
      )
    );

    // Register cdp_screenshot tool - Enhanced from archived implementation
    this.registerTool(
      this.createTool(
        'cdp_screenshot',
        'Take a screenshot with advanced options (full page, element selection, quality control)',
        screenshotSchema,
        async (args, context) => {
          try {
            this.logger.info({ 
              fullPage: args.fullPage, 
              selector: args.selector, 
              format: args.format 
            }, 'Taking screenshot');

            const screenshotOptions: any = {
              format: args.format,
              quality: args.format === 'jpeg' ? args.quality : undefined,
              captureBeyondViewport: args.fullPage
            };

            // Handle element-specific screenshots
            if (args.selector) {
              const clipResult = await this.getElementClipRect(args.selector, context);
              if (clipResult.isErr()) {
                return {
                  success: false,
                  error: clipResult.unwrapErr(),
                  data: {
                    troubleshooting: [
                      `🎯 Element not found: ${args.selector}`,
                      '🔍 Check if the selector is correct',
                      '⏱️ Ensure the element is visible and loaded',
                      '📏 Verify the element has dimensions'
                    ]
                  }
                };
              }
              
              screenshotOptions.clip = clipResult.unwrap();
            }

            const screenshotResult = await withCDPCommand(
              'Page.captureScreenshot',
              screenshotOptions,
              context
            );

            if (screenshotResult.isErr()) {
              return {
                success: false,
                error: screenshotResult.unwrapErr()
              };
            }

            const screenshot = screenshotResult.unwrap() as { data: string };
            this.logger.info({ dataLength: screenshot.data.length }, 'Screenshot captured successfully');

            return {
              success: true,
              data: {
                data: screenshot.data,
                format: args.format,
                fullPage: args.fullPage,
                selector: args.selector,
                timestamp: new Date().toISOString(),
                size: screenshot.data.length
              }
            };
          } catch (error) {
            this.logger.error({ error }, 'Screenshot failed');
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Screenshot failed'
            };
          }
        }
      )
    );

    // Register cdp_set_cookie tool - Enhanced from archived implementation
    this.registerTool(
      this.createTool(
        'cdp_set_cookie',
        'Set browser cookies with comprehensive options',
        setCookieSchema,
        async (args, context) => {
          try {
            this.logger.info({ name: args.name, domain: args.domain }, 'Setting cookie');

            // Enable Network domain for cookie operations
            const enableResult = await withCDPCommand('Network.enable', {}, context);
            if (enableResult.isErr()) {
              return {
                success: false,
                error: `Failed to enable Network domain: ${enableResult.unwrapErr()}`
              };
            }

            const cookieResult = await withCDPCommand(
              'Network.setCookie',
              {
                name: args.name,
                value: args.value,
                domain: args.domain,
                path: args.path,
                secure: args.secure,
                httpOnly: args.httpOnly,
                sameSite: args.sameSite
              },
              context
            );

            if (cookieResult.isErr()) {
              return {
                success: false,
                error: cookieResult.unwrapErr(),
                data: {
                  troubleshooting: [
                    '🍪 Check if the domain is valid for the current page',
                    '🔒 Verify secure flag matches the protocol (HTTPS for secure cookies)',
                    '🌐 Ensure the path is accessible',
                    '📝 Check SameSite policy compatibility'
                  ]
                }
              };
            }

            const result = cookieResult.unwrap() as { success: boolean };
            this.logger.info({ success: result.success }, 'Cookie operation completed');

            return {
              success: result.success,
              data: {
                name: args.name,
                value: args.value,
                domain: args.domain,
                path: args.path,
                secure: args.secure,
                httpOnly: args.httpOnly,
                sameSite: args.sameSite,
                timestamp: new Date().toISOString()
              }
            };
          } catch (error) {
            this.logger.error({ error }, 'Set cookie failed');
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to set cookie'
            };
          }
        }
      )
    );

    // Register cdp_get_cookies tool - Enhanced from archived implementation
    this.registerTool(
      this.createTool(
        'cdp_get_cookies',
        'Get browser cookies with optional URL filtering',
        getCookiesSchema,
        async (args, context) => {
          try {
            this.logger.info({ urls: args.urls }, 'Getting cookies');

            // Enable Network domain
            const enableResult = await withCDPCommand('Network.enable', {}, context);
            if (enableResult.isErr()) {
              return {
                success: false,
                error: `Failed to enable Network domain: ${enableResult.unwrapErr()}`
              };
            }

            const cookiesResult = await withCDPCommand(
              'Network.getCookies',
              { urls: args.urls },
              context
            );

            if (cookiesResult.isErr()) {
              return {
                success: false,
                error: cookiesResult.unwrapErr()
              };
            }

            const result = cookiesResult.unwrap() as { cookies: any[] };
            this.logger.info({ cookieCount: result.cookies.length }, 'Cookies retrieved successfully');

            return {
              success: true,
              data: {
                cookies: result.cookies,
                count: result.cookies.length,
                filteredUrls: args.urls,
                timestamp: new Date().toISOString()
              }
            };
          } catch (error) {
            this.logger.error({ error }, 'Get cookies failed');
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to get cookies'
            };
          }
        }
      )
    );

    // Register cdp_clear_cookies tool
    this.registerTool({
      name: 'cdp_clear_cookies',
      description: 'Clear all browser cookies',
      argsSchema: {
        parse: (value) => ({ sessionId: (value as any)?.sessionId }),
        safeParse: (value) => ({ success: true, data: { sessionId: (value as any)?.sessionId } })
      },
      handler: async (args, context) => {
        try {
          this.logger.info('Clearing all cookies');

          // Enable Network domain
          const enableResult = await withCDPCommand('Network.enable', {}, context);
          if (enableResult.isErr()) {
            return {
              success: false,
              error: `Failed to enable Network domain: ${enableResult.unwrapErr()}`
            };
          }

          const clearResult = await withCDPCommand('Network.clearBrowserCookies', {}, context);
          
          if (clearResult.isErr()) {
            return {
              success: false,
              error: clearResult.unwrapErr()
            };
          }

          this.logger.info('Cookies cleared successfully');

          return {
            success: true,
            data: {
              message: 'All cookies cleared successfully',
              timestamp: new Date().toISOString()
            }
          };
        } catch (error) {
          this.logger.error({ error }, 'Clear cookies failed');
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to clear cookies'
          };
        }
      }
    });

    // Register cdp_reload tool - Enhanced from archived implementation
    this.registerTool(
      this.createTool(
        'cdp_reload',
        'Reload the current page with cache control options',
        reloadSchema,
        async (args, context) => {
          try {
            this.logger.info({ ignoreCache: args.ignoreCache }, 'Reloading page');

            const reloadResult = await withCDPCommand(
              'Page.reload',
              { ignoreCache: args.ignoreCache },
              context
            );

            if (reloadResult.isErr()) {
              return {
                success: false,
                error: reloadResult.unwrapErr()
              };
            }

            this.logger.info('Page reloaded successfully');

            return {
              success: true,
              data: {
                reloaded: true,
                ignoreCache: args.ignoreCache,
                timestamp: new Date().toISOString()
              }
            };
          } catch (error) {
            this.logger.error({ error }, 'Page reload failed');
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to reload page'
            };
          }
        }
      )
    );
  }

  // Helper methods extracted from archived implementation
  private async waitForDOMContentLoaded(context: any): Promise<void> {
    // Implementation for DOM content loaded wait
    const script = `
      new Promise((resolve) => {
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', resolve);
        } else {
          resolve();
        }
      })
    `;
    
    await withScriptExecution(script, context);
  }

  private async waitForNetworkIdle(context: any, maxConnections: number): Promise<void> {
    // Implementation for network idle wait (simplified)
    await new Promise(resolve => setTimeout(resolve, 1000));
    this.logger.info({ maxConnections }, 'Network idle wait completed (simplified implementation)');
  }

  private async getElementClipRect(selector: string, context: any): Promise<import('../../../core/result.js').Result<any, string>> {
    return withDOMOperation(async () => {
      // Enable DOM domain
      const enableResult = await withCDPCommand('DOM.enable', {}, context);
      if (enableResult.isErr()) {
        throw new Error(enableResult.unwrapErr());
      }

      // Get document
      const docResult = await withCDPCommand('DOM.getDocument', {}, context);
      if (docResult.isErr()) {
        throw new Error(docResult.unwrapErr());
      }

      // Query selector
      const queryResult = await withCDPCommand(
        'DOM.querySelector',
        { nodeId: (docResult.unwrap() as any).root.nodeId, selector },
        context
      );
      
      if (queryResult.isErr()) {
        throw new Error(queryResult.unwrapErr());
      }

      const nodeId = (queryResult.unwrap() as any).nodeId;
      if (!nodeId) {
        throw new Error(`Element not found: ${selector}`);
      }

      // Get box model
      const boxResult = await withCDPCommand(
        'DOM.getBoxModel',
        { nodeId },
        context
      );
      
      if (boxResult.isErr()) {
        throw new Error(boxResult.unwrapErr());
      }

      const model = (boxResult.unwrap() as any).model;
      return {
        x: model.content[0],
        y: model.content[1],
        width: model.content[2] - model.content[0],
        height: model.content[5] - model.content[1]
      };
    }, context);
  }
}

export class CDPToolProviderFactory extends BaseProviderFactory<CDPToolProvider> {
  create(deps: ProviderDependencies): CDPToolProvider {
    const config: BaseToolProviderConfig = {
      name: 'cdp',
      description: 'Chrome DevTools Protocol tools with comprehensive browser automation capabilities'
    };

    return new CDPToolProvider(
      deps.chromeService,
      this.createProviderLogger(deps, config.name),
      deps.validator,
      config
    );
  }
}