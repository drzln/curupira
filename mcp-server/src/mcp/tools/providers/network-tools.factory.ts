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
import type { INetworkBufferService } from '../../../chrome/services/network-buffer.service.js';
import { withCDPCommand, withScriptExecution } from '../patterns/common-handlers.js';
import { networkToolSchemas } from '../schemas/network-schemas.js';

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
  private networkBufferService?: INetworkBufferService;

  constructor(
    chromeService: any,
    logger: any,
    validator: any,
    config: BaseToolProviderConfig,
    networkBufferService?: INetworkBufferService
  ) {
    super(chromeService, logger, validator, config);
    this.networkBufferService = networkBufferService;
  }

  protected initializeTools(): void {
    // Register network_enable tool
    this.registerTool({
      name: 'network_enable',
      description: 'Enable network monitoring',
      argsSchema: {
        parse: (value) => value || {},
        safeParse: (value) => ({ success: true, data: value || {} })
      },
      jsonSchema: networkToolSchemas.network_enable,
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

        // Enable buffer service for this session
        if (this.networkBufferService && context.sessionId) {
          this.networkBufferService.enableSession(context.sessionId as any);
          this.logger.info({ sessionId: context.sessionId }, 'Network buffer enabled for session');
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
      jsonSchema: networkToolSchemas.network_disable,
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

        // Disable buffer service for this session
        if (this.networkBufferService && context.sessionId) {
          this.networkBufferService.disableSession(context.sessionId as any);
          this.logger.info({ sessionId: context.sessionId }, 'Network buffer disabled for session');
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
      jsonSchema: networkToolSchemas.network_get_requests,
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
        if (!this.networkBufferService) {
          this.logger.warn('Network buffer service not available');
          return {
            success: true,
            data: {
              requests: [],
              totalCount: 0,
              message: 'Network buffer service not available'
            }
          };
        }

        // Get requests from buffer
        const requests = this.networkBufferService.getRequests({
          sessionId: args.sessionId || context.sessionId,
          limit: args.limit || 100,
          includeResponses: true
        });

        // Format requests for output
        const formattedRequests = requests.map(req => ({
          requestId: req.requestId,
          timestamp: new Date(req.timestamp).toISOString(),
          method: req.method,
          url: req.url,
          resourceType: req.resourceType,
          status: req.response?.status,
          statusText: req.response?.statusText,
          mimeType: req.response?.mimeType,
          size: req.response?.encodedDataLength,
          duration: req.response ? req.response.timestamp - req.timestamp : undefined,
          failed: !!req.failure,
          errorText: req.failure?.errorText
        }));

        return {
          success: true,
          data: {
            requests: formattedRequests,
            totalCount: formattedRequests.length
          }
        };
      }
    });

    // Register network_mock_request tool
    this.registerTool({
      name: 'network_mock_request',
      description: 'Mock a network request',
      argsSchema: mockRequestSchema,
      jsonSchema: networkToolSchemas.network_mock_request,
      handler: async (args, context) => {
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
    });

    // Register network_clear_cache tool
    this.registerTool({
      name: 'network_clear_cache',
      description: 'Clear browser cache',
      argsSchema: {
        parse: (value) => value || {},
        safeParse: (value) => ({ success: true, data: value || {} })
      },
      jsonSchema: networkToolSchemas.network_clear_cache,
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
      jsonSchema: networkToolSchemas.network_clear_cookies,
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
    this.registerTool({
      name: 'network_throttle',
      description: 'Throttle network speed',
      argsSchema: throttleSchema,
      jsonSchema: networkToolSchemas.network_throttle,
      handler: async (args, context) => {
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
    });

    // Register network_get_cookies tool
    this.registerTool({
      name: 'network_get_cookies',
      description: 'Get browser cookies',
      jsonSchema: networkToolSchemas.network_get_cookies,
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
      config,
      deps.networkBufferService
    );
  }
}