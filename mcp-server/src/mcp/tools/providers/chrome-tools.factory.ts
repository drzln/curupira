/**
 * Chrome Tool Provider Factory - Level 2 (MCP Core)
 * Factory implementation for Chrome tool provider
 */

import type { IToolProviderFactory, ProviderDependencies } from '../provider.factory.js';
import { BaseProviderFactory } from '../provider.factory.js';
import type { BaseToolProviderConfig } from '../base-tool-provider.js';
import { BaseToolProvider } from '../base-tool-provider.js';
import type { Schema } from '../../../core/interfaces/validator.interface.js';
import type { ToolResult } from '../registry.js';

// Schema definitions
const discoverSchema: Schema<{ port?: number; maxInstances?: number }> = {
  parse: (value) => {
    const obj = (value || {}) as any;
    return {
      port: typeof obj.port === 'number' ? obj.port : undefined,
      maxInstances: typeof obj.maxInstances === 'number' ? obj.maxInstances : 10
    };
  },
  safeParse: (value) => {
    try {
      return { success: true, data: discoverSchema.parse(value) };
    } catch (error) {
      return { success: false, error };
    }
  }
};

const connectSchema: Schema<{ instanceId: string; host?: string; port?: number }> = {
  parse: (value) => {
    if (typeof value !== 'object' || value === null) {
      throw new Error('Expected object');
    }
    const obj = value as any;
    if (typeof obj.instanceId !== 'string') {
      throw new Error('instanceId must be a string');
    }
    return {
      instanceId: obj.instanceId,
      host: typeof obj.host === 'string' ? obj.host : 'localhost',
      port: typeof obj.port === 'number' ? obj.port : 9222
    };
  },
  safeParse: (value) => {
    try {
      return { success: true, data: connectSchema.parse(value) };
    } catch (error) {
      return { success: false, error };
    }
  }
};

class ChromeToolProvider extends BaseToolProvider {
  protected initializeTools(): void {
    // Register chrome_discover tool
    this.registerTool(
      this.createTool(
        'chrome_discover',
        'Discover available Chrome instances for debugging',
        discoverSchema,
        async (args, context) => {
          // TODO: Implement Chrome discovery logic
          // For now, return a mock result
          return {
            success: true,
            data: {
              instances: [],
              totalFound: 0,
              recommendations: [
                'Launch Chrome with --remote-debugging-port=9222',
                'Ensure no firewall blocks the debugging port'
              ]
            }
          };
        }
      )
    );

    // Register chrome_connect tool
    this.registerTool(
      this.createTool(
        'chrome_connect',
        'Connect to a Chrome instance',
        connectSchema,
        async (args, context) => {
          try {
            // Use the ChromeService to connect
            const client = await this.chromeService.connect({
              host: args.host!,
              port: args.port!
            });

            return {
              success: true,
              data: {
                success: true,
                instanceId: args.instanceId,
                sessionId: 'default',
                message: 'Successfully connected to Chrome',
                capabilities: ['CDP', 'Runtime', 'DOM', 'Network']
              }
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to connect to Chrome'
            };
          }
        }
      )
    );

    // Register chrome_disconnect tool
    this.registerTool({
      name: 'chrome_disconnect',
      description: 'Disconnect from Chrome instance',
      argsSchema: {
        parse: (value) => value || {},
        safeParse: (value) => ({ success: true, data: value || {} })
      },
      handler: async (args, context) => {
        try {
          await this.chromeService.disconnect();
          return {
            success: true,
            data: {
              message: 'Disconnected from Chrome'
            }
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to disconnect'
          };
        }
      }
    });
  }
}

export class ChromeToolProviderFactory extends BaseProviderFactory<ChromeToolProvider> {
  create(deps: ProviderDependencies): ChromeToolProvider {
    const config: BaseToolProviderConfig = {
      name: 'chrome',
      description: 'Chrome discovery and connection management tools'
    };

    return new ChromeToolProvider(
      deps.chromeService,
      this.createProviderLogger(deps, config.name),
      deps.validator,
      config
    );
  }
}