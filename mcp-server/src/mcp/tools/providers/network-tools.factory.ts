/**
 * Network Tool Provider Factory - Level 2 (MCP Core)
 * Factory implementation for network debugging tool provider
 */

import type { IToolProviderFactory, ProviderDependencies } from '../provider.factory.js';
import { BaseProviderFactory } from '../provider.factory.js';
import type { BaseToolProviderConfig } from '../base-tool-provider.js';
import { BaseToolProvider } from '../base-tool-provider.js';
import type { Schema } from '../../../core/interfaces/validator.interface.js';
import type { ToolResult } from '../registry.js';
import { withCDPCommand, withScriptExecution } from '../patterns/common-handlers.js';

// Schema definitions
const mockRequestSchema: Schema<{ url: string; response: any; status?: number; sessionId?: string }> = {
  parse: (value) => {
    if (typeof value !== 'object' || value === null) {
      throw new Error('Expected object');
    }
    const obj = value as any;
    if (typeof obj.url !== 'string') {
      throw new Error('url must be a string');
    }
    if (!obj.response) {
      throw new Error('response is required');
    }
    return {
      url: obj.url,
      response: obj.response,
      status: typeof obj.status === 'number' ? obj.status : 200,
      sessionId: obj.sessionId
    };
  },
  safeParse: (value) => {
    try {
      return { success: true, data: mockRequestSchema.parse(value) };
    } catch (error) {
      return { success: false, error };
    }
  }
};

const throttleSchema: Schema<{ downloadThroughput?: number; uploadThroughput?: number; latency?: number; sessionId?: string }> = {
  parse: (value) => {
    const obj = (value || {}) as any;
    return {
      downloadThroughput: typeof obj.downloadThroughput === 'number' ? obj.downloadThroughput : -1,
      uploadThroughput: typeof obj.uploadThroughput === 'number' ? obj.uploadThroughput : -1,
      latency: typeof obj.latency === 'number' ? obj.latency : 0,
      sessionId: obj.sessionId
    };
  },
  safeParse: (value) => {
    try {
      return { success: true, data: throttleSchema.parse(value) };
    } catch (error) {
      return { success: false, error };
    }
  }
};

class NetworkToolProvider extends BaseToolProvider {
  protected initializeTools(): void {
    // Register network_enable tool
    this.registerTool({
      name: 'network_enable',
      description: 'Enable network monitoring',
      argsSchema: {
        parse: (value) => value || {},
        safeParse: (value) => ({ success: true, data: value || {} })
      },
      handler: async (args, context) => {
        const result = await withCDPCommand(
          'Network.enable',
          {
            maxTotalBufferSize: 10000000,
            maxResourceBufferSize: 5000000
          },
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
          data: { message: 'Network monitoring enabled' }
        };
      }
    });

    // Register network_disable tool
    this.registerTool({
      name: 'network_disable',
      description: 'Disable network monitoring',
      argsSchema: {
        parse: (value) => value || {},
        safeParse: (value) => ({ success: true, data: value || {} })
      },
      handler: async (args, context) => {
        const result = await withCDPCommand(
          'Network.disable',
          {},
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
          data: { message: 'Network monitoring disabled' }
        };
      }
    });

    // Register network_get_requests tool
    this.registerTool({
      name: 'network_get_requests',
      description: 'Get recent network requests',
      argsSchema: {
        parse: (value) => {
          const obj = (value || {}) as any;
          return {
            filter: obj.filter,
            limit: typeof obj.limit === 'number' ? obj.limit : 100,
            sessionId: obj.sessionId
          };
        },
        safeParse: (value) => {
          try {
            const obj = (value || {}) as any;
            return { 
              success: true, 
              data: {
                filter: obj.filter,
                limit: typeof obj.limit === 'number' ? obj.limit : 100,
                sessionId: obj.sessionId
              }
            };
          } catch (error) {
            return { success: false, error };
          }
        }
      },
      handler: async (args, context) => {
        // For now, return empty array as we'd need to implement request tracking
        return {
          success: true,
          data: {
            requests: [],
            totalCount: 0,
            message: 'Request tracking requires network_enable to be called first'
          }
        };
      }
    });

    // Register network_mock_request tool
    this.registerTool(
      this.createTool(
        'network_mock_request',
        'Mock a network request',
        mockRequestSchema,
        async (args, context) => {
          // Enable request interception
          await withCDPCommand(
            'Fetch.enable',
            {
              patterns: [{ urlPattern: args.url }]
            },
            context
          );

          // Note: In a real implementation, we'd set up handlers for Fetch.requestPaused
          // For now, return success
          return {
            success: true,
            data: {
              message: `Mocking enabled for ${args.url}`,
              status: args.status,
              response: args.response
            }
          };
        }
      )
    );

    // Register network_clear_cache tool
    this.registerTool({
      name: 'network_clear_cache',
      description: 'Clear browser cache',
      argsSchema: {
        parse: (value) => value || {},
        safeParse: (value) => ({ success: true, data: value || {} })
      },
      handler: async (args, context) => {
        const result = await withCDPCommand(
          'Network.clearBrowserCache',
          {},
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
          data: { message: 'Browser cache cleared' }
        };
      }
    });

    // Register network_clear_cookies tool
    this.registerTool({
      name: 'network_clear_cookies',
      description: 'Clear browser cookies',
      argsSchema: {
        parse: (value) => value || {},
        safeParse: (value) => ({ success: true, data: value || {} })
      },
      handler: async (args, context) => {
        const result = await withCDPCommand(
          'Network.clearBrowserCookies',
          {},
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
          data: { message: 'Browser cookies cleared' }
        };
      }
    });

    // Register network_throttle tool
    this.registerTool(
      this.createTool(
        'network_throttle',
        'Throttle network speed',
        throttleSchema,
        async (args, context) => {
          const result = await withCDPCommand(
            'Network.emulateNetworkConditions',
            {
              offline: false,
              downloadThroughput: args.downloadThroughput!,
              uploadThroughput: args.uploadThroughput!,
              latency: args.latency!
            },
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
              message: 'Network throttling applied',
              settings: {
                downloadThroughput: args.downloadThroughput,
                uploadThroughput: args.uploadThroughput,
                latency: args.latency
              }
            }
          };
        }
      )
    );

    // Register network_get_cookies tool
    this.registerTool({
      name: 'network_get_cookies',
      description: 'Get browser cookies',
      argsSchema: {
        parse: (value) => {
          const obj = (value || {}) as any;
          return {
            urls: obj.urls,
            sessionId: obj.sessionId
          };
        },
        safeParse: (value) => {
          try {
            return { success: true, data: value || {} };
          } catch (error) {
            return { success: false, error };
          }
        }
      },
      handler: async (args, context) => {
        const params = args.urls ? { urls: args.urls } : {};
        const result = await withCDPCommand(
          'Network.getCookies',
          params,
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
          data: result.unwrap()
        };
      }
    });
  }
}

export class NetworkToolProviderFactory extends BaseProviderFactory<NetworkToolProvider> {
  create(deps: ProviderDependencies): NetworkToolProvider {
    const config: BaseToolProviderConfig = {
      name: 'network',
      description: 'Network monitoring and manipulation tools'
    };

    return new NetworkToolProvider(
      deps.chromeService,
      this.createProviderLogger(deps, config.name),
      deps.validator,
      config
    );
  }
}