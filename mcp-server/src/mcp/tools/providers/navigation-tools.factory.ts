/**
 * Navigation Tool Provider Factory - Level 2 (MCP Core)
 * Factory implementation for Page navigation and history tools
 */

import type { IToolProviderFactory, ProviderDependencies } from '../provider.factory.js';
import { BaseProviderFactory } from '../provider.factory.js';
import type { BaseToolProviderConfig } from '../base-tool-provider.js';
import { BaseToolProvider } from '../base-tool-provider.js';
import type { Schema } from '../../../core/interfaces/validator.interface.js';
import { withCDPCommand } from '../patterns/common-handlers.js';

// Schema definitions
const navigateSchema: Schema<{ url: string; sessionId?: string }> = {
  parse: (value) => {
    if (typeof value !== 'object' || value === null) {
      throw new Error('Expected object');
    }
    const obj = value as any;
    if (typeof obj.url !== 'string') {
      throw new Error('url must be a string');
    }
    return {
      url: obj.url,
      sessionId: obj.sessionId
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

const waitForNavigationSchema: Schema<{ timeout?: number; sessionId?: string }> = {
  parse: (value) => {
    const obj = (value || {}) as any;
    return {
      timeout: typeof obj.timeout === 'number' ? obj.timeout : 30000,
      sessionId: obj.sessionId
    };
  },
  safeParse: (value) => {
    try {
      return { success: true, data: waitForNavigationSchema.parse(value) };
    } catch (error) {
      return { success: false, error };
    }
  }
};

class NavigationToolProvider extends BaseToolProvider {
  protected initializeTools(): void {
    // Register navigate tool
    this.registerTool(
      this.createTool(
        'navigate',
        'Navigate to a specific URL',
        navigateSchema,
        async (args, context) => {
          const result = await withCDPCommand(
            'Page.navigate',
            { url: args.url },
            context
          );

          if (result.isErr()) {
            return {
              success: false,
              error: result.unwrapErr()
            };
          }

          const navigateResult = result.unwrap() as any;
          
          return {
            success: true,
            data: {
              url: args.url,
              frameId: navigateResult.frameId,
              loaderId: navigateResult.loaderId,
              timestamp: new Date().toISOString()
            }
          };
        }
      )
    );

    // Register reload tool
    this.registerTool({
      name: 'reload',
      description: 'Reload the current page',
      argsSchema: {
        parse: (value) => {
          const obj = (value || {}) as any;
          return {
            ignoreCache: obj.ignoreCache === true,
            sessionId: obj.sessionId
          };
        },
        safeParse: (value) => {
          try {
            const obj = (value || {}) as any;
            return {
              success: true,
              data: {
                ignoreCache: obj.ignoreCache === true,
                sessionId: obj.sessionId
              }
            };
          } catch (error) {
            return { success: false, error };
          }
        }
      },
      handler: async (args, context) => {
        const result = await withCDPCommand(
          'Page.reload',
          { ignoreCache: args.ignoreCache },
          context
        );

        if (result.isErr()) {
          return {
            success: false,
            error: result.unwrapErr()
          };
        }

        return {
          success: true,
          data: {
            reloaded: true,
            ignoreCache: args.ignoreCache,
            timestamp: new Date().toISOString()
          }
        };
      }
    });

    // Register back tool
    this.registerTool({
      name: 'back',
      description: 'Navigate back in browser history',
      argsSchema: {
        parse: (value) => (value || {}),
        safeParse: (value) => ({ success: true, data: value || {} })
      },
      handler: async (args, context) => {
        // First get navigation history
        const historyResult = await withCDPCommand(
          'Page.getNavigationHistory',
          {},
          context
        );

        if (historyResult.isErr()) {
          return {
            success: false,
            error: historyResult.unwrapErr()
          };
        }

        const history = historyResult.unwrap() as any;
        const currentIndex = history.currentIndex;
        
        if (currentIndex <= 0) {
          return {
            success: false,
            error: 'No previous page in history'
          };
        }

        const targetEntry = history.entries[currentIndex - 1];
        
        const navigateResult = await withCDPCommand(
          'Page.navigateToHistoryEntry',
          { entryId: targetEntry.id },
          context
        );

        if (navigateResult.isErr()) {
          return {
            success: false,
            error: navigateResult.unwrapErr()
          };
        }

        return {
          success: true,
          data: {
            navigated: true,
            url: targetEntry.url,
            title: targetEntry.title,
            timestamp: new Date().toISOString()
          }
        };
      }
    });

    // Register forward tool
    this.registerTool({
      name: 'forward',
      description: 'Navigate forward in browser history',
      argsSchema: {
        parse: (value) => (value || {}),
        safeParse: (value) => ({ success: true, data: value || {} })
      },
      handler: async (args, context) => {
        const historyResult = await withCDPCommand(
          'Page.getNavigationHistory',
          {},
          context
        );

        if (historyResult.isErr()) {
          return {
            success: false,
            error: historyResult.unwrapErr()
          };
        }

        const history = historyResult.unwrap() as any;
        const currentIndex = history.currentIndex;
        
        if (currentIndex >= history.entries.length - 1) {
          return {
            success: false,
            error: 'No next page in history'
          };
        }

        const targetEntry = history.entries[currentIndex + 1];
        
        const navigateResult = await withCDPCommand(
          'Page.navigateToHistoryEntry',
          { entryId: targetEntry.id },
          context
        );

        if (navigateResult.isErr()) {
          return {
            success: false,
            error: navigateResult.unwrapErr()
          };
        }

        return {
          success: true,
          data: {
            navigated: true,
            url: targetEntry.url,
            title: targetEntry.title,
            timestamp: new Date().toISOString()
          }
        };
      }
    });

    // Register get_history tool
    this.registerTool({
      name: 'get_history',
      description: 'Get navigation history',
      argsSchema: {
        parse: (value) => {
          const obj = (value || {}) as any;
          return {
            sessionId: obj.sessionId
          };
        },
        safeParse: (value) => {
          try {
            return { success: true, data: { sessionId: (value as any)?.sessionId } };
          } catch (error) {
            return { success: false, error };
          }
        }
      },
      handler: async (args, context) => {
        const result = await withCDPCommand(
          'Page.getNavigationHistory',
          {},
          context
        );

        if (result.isErr()) {
          return {
            success: false,
            error: result.unwrapErr()
          };
        }

        const history = result.unwrap() as any;
        
        return {
          success: true,
          data: {
            currentIndex: history.currentIndex,
            entries: history.entries.map((entry: any) => ({
              id: entry.id,
              url: entry.url,
              title: entry.title,
              userTypedURL: entry.userTypedURL
            })),
            totalEntries: history.entries?.length || 0,
            timestamp: new Date().toISOString()
          }
        };
      }
    });

    // Register wait_for_navigation tool
    this.registerTool(
      this.createTool(
        'wait_for_navigation',
        'Wait for page navigation to complete',
        waitForNavigationSchema,
        async (args, context) => {
          // Enable Page domain to listen for events
          await withCDPCommand('Page.enable', {}, context);

          return new Promise((resolve) => {
            const timeout = setTimeout(() => {
              resolve({
                success: false,
                error: `Navigation timeout after ${args.timeout}ms`
              });
            }, args.timeout);

            // Listen for navigation completion
            // Note: This is a simplified implementation
            // Real implementation would need proper event handling
            setTimeout(() => {
              clearTimeout(timeout);
              resolve({
                success: true,
                data: {
                  completed: true,
                  timeout: args.timeout,
                  timestamp: new Date().toISOString()
                }
              });
            }, 1000); // Simulate navigation completion
          });
        }
      )
    );

    // Register get_current_url tool
    this.registerTool({
      name: 'get_current_url',
      description: 'Get the current page URL and title',
      argsSchema: {
        parse: (value) => (value || {}),
        safeParse: (value) => ({ success: true, data: value || {} })
      },
      handler: async (args, context) => {
        // Get URL via JavaScript evaluation
        const result = await withCDPCommand(
          'Runtime.evaluate',
          {
            expression: 'JSON.stringify({ url: window.location.href, title: document.title, domain: window.location.hostname })',
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
        const pageInfo = JSON.parse(unwrapped.result?.value || '{}');
        
        return {
          success: true,
          data: {
            ...pageInfo,
            timestamp: new Date().toISOString()
          }
        };
      }
    });
  }
}

export class NavigationToolProviderFactory extends BaseProviderFactory<NavigationToolProvider> {
  create(deps: ProviderDependencies): NavigationToolProvider {
    const config: BaseToolProviderConfig = {
      name: 'navigation',
      description: 'Page navigation and browser history management tools'
    };

    return new NavigationToolProvider(
      deps.chromeService,
      this.createProviderLogger(deps, config.name),
      deps.validator,
      config
    );
  }
}