/**
 * Chrome Connection Tool Provider Factory - Level 2 (MCP Core)
 * Tools for discovering and connecting to Chrome without requiring pre-connection
 */

import type { IToolProviderFactory, ProviderDependencies } from '../provider.factory.js';
import { BaseProviderFactory } from '../provider.factory.js';
import type { BaseToolProviderConfig } from '../base-tool-provider.js';
import { ChromeIndependentToolProvider } from '../chrome-independent-tool-provider.js';
import type { Schema } from '../../../core/interfaces/validator.interface.js';
import type { ToolResult } from '../registry.js';
import type { IChromeDiscoveryService } from '../../../chrome/discovery.service.js';

// Schema definitions
const discoverSchema: Schema<{ hosts?: string[]; ports?: number[]; timeout?: number }> = {
  parse: (value) => {
    const obj = (value || {}) as any;
    return {
      hosts: Array.isArray(obj.hosts) ? obj.hosts.filter((h: any) => typeof h === 'string') : undefined,
      ports: Array.isArray(obj.ports) ? obj.ports.filter((p: any) => typeof p === 'number') : undefined,
      timeout: typeof obj.timeout === 'number' ? obj.timeout : undefined
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

const connectSchema: Schema<{ host: string; port?: number; secure?: boolean }> = {
  parse: (value) => {
    if (typeof value !== 'object' || value === null) {
      throw new Error('Expected object');
    }
    const obj = value as any;
    if (typeof obj.host !== 'string') {
      throw new Error('host must be a string');
    }
    return {
      host: obj.host,
      port: typeof obj.port === 'number' ? obj.port : 3000,
      secure: typeof obj.secure === 'boolean' ? obj.secure : false
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

class ChromeConnectionToolProvider extends ChromeIndependentToolProvider {
  private discoveryService: IChromeDiscoveryService;

  constructor(
    chromeService: any,
    logger: any,
    validator: any,
    config: any,
    discoveryService: IChromeDiscoveryService
  ) {
    super(chromeService, logger, validator, config);
    this.discoveryService = discoveryService;
  }

  protected initializeTools(): void {
    // Register chrome_discover tool - works without Chrome connection
    this.registerTool(
      this.createTool(
        'chrome_discover',
        'Discover available Chrome instances with smart React app detection',
        discoverSchema,
        async (args, context) => {
          try {
            context.logger.info({ args }, 'Discovering Chrome instances');
            
            const result = await this.discoveryService.discoverInstances({
              hosts: args.hosts,
              ports: args.ports,
              timeout: args.timeout
            });

            context.logger.info({
              totalFound: result.totalFound,
              reactApps: result.instances.filter(i => i.isReactApp).length,
              devApps: result.instances.filter(i => i.isDevelopmentApp).length
            }, 'Chrome discovery completed');

            return {
              success: true,
              data: {
                ...result,
                timestamp: new Date().toISOString(),
                discoveryMethod: 'enhanced-multi-port',
                confidence: result.instances.length > 0 ? 'high' : 'none',
                nextSteps: result.instances.length > 0 ? [
                  '🚀 Use chrome_connect to connect to an instance',
                  `📍 Example: chrome_connect(host: "${result.instances[0].host}", port: ${result.instances[0].port})`
                ] : [
                  '❌ No Chrome instances found',
                  '🔧 Start Browserless or Chrome with: --remote-debugging-port=3000'
                ]
              }
            };
          } catch (error) {
            context.logger.error({ error }, 'Chrome discovery failed');
            const errorMessage = error instanceof Error ? error.message : 'Chrome discovery failed';
            const errorStack = error instanceof Error ? error.stack : undefined;
            
            return {
              success: false,
              error: errorMessage,
              data: {
                errorDetails: {
                  message: errorMessage,
                  type: error instanceof Error ? error.constructor.name : typeof error,
                  stack: errorStack,
                  timestamp: new Date().toISOString()
                },
                discoveryAttempt: {
                  hosts: args.hosts || ['chrome-headless.shared-services.svc.cluster.local'],
                  ports: args.ports || [3000],
                  timeout: args.timeout || 5000
                },
                troubleshooting: [
                  '🔧 Ensure Chrome/Browserless is running with debugging enabled',
                  '🌐 Check if the service is accessible on the network',
                  '🔄 Try restarting Chrome with debugging enabled',
                  '⚡ Verify the correct ports are being used',
                  '🔍 Check service logs for connectivity issues'
                ],
                recommendations: [
                  'For Browserless: ensure service is running on port 3000',
                  'For standard Chrome: google-chrome --remote-debugging-port=3000',
                  'For Browserless: ensure service is running on port 3000',
                  'Test connectivity: curl http://host:port/json'
                ]
              }
            };
          }
        }
      )
    );

    // Register chrome_connect tool - establishes Chrome connection
    this.registerTool(
      this.createTool(
        'chrome_connect',
        'Connect to a Chrome instance',
        connectSchema,
        async (args, context) => {
          try {
            context.logger.info({ host: args.host, port: args.port }, 'Connecting to Chrome');

            const client = await this.chromeService.connect({
              host: args.host,
              port: args.port!,
              secure: args.secure
            });

            context.logger.info('Chrome connection successful');

            return {
              success: true,
              data: {
                message: '🚀 Successfully connected to Chrome!',
                connectionInfo: {
                  host: args.host,
                  port: args.port,
                  secure: args.secure,
                  timestamp: new Date().toISOString()
                },
                availableTools: [
                  '⚛️ React debugging tools are now available',
                  '🔍 DOM inspection and manipulation tools',
                  '🌐 Network monitoring and interception',
                  '📸 Screenshot and visual debugging',
                  '⚡ Performance profiling tools'
                ],
                nextSteps: [
                  '🔍 Use chrome_status to check connection health',
                  '🌳 Run react_detect_version to verify React',
                  '🎯 Navigate to your app with navigate tool'
                ]
              }
            };
          } catch (error) {
            context.logger.error({ error }, 'Chrome connection failed');
            const errorMessage = error instanceof Error ? error.message : 'Failed to connect to Chrome';
            const errorStack = error instanceof Error ? error.stack : undefined;
            
            return {
              success: false,
              error: errorMessage,
              data: {
                errorDetails: {
                  message: errorMessage,
                  type: error instanceof Error ? error.constructor.name : typeof error,
                  stack: errorStack,
                  timestamp: new Date().toISOString()
                },
                connectionAttempt: {
                  host: args.host,
                  port: args.port,
                  secure: args.secure
                },
                troubleshooting: [
                  '❌ Connection failed',
                  `🔍 Attempted connection to: ${args.host}:${args.port}`,
                  '🔧 Verify Chrome/Browserless is running on the specified host/port',
                  '🌐 Check network connectivity and firewall rules',
                  '🔍 Run chrome_discover to find available instances',
                  '⚡ For Browserless: ensure service is accessible on the specified port',
                  '🐛 Check server logs for additional error details'
                ],
                nextSteps: [
                  'Verify the service is running and accessible',
                  'Check if the port is correct (3000 for all Chrome services)',
                  'Test connectivity with: curl http://host:port/json'
                ]
              }
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
              message: '✅ Disconnected from Chrome',
              timestamp: new Date().toISOString(),
              note: 'Chrome-dependent tools are no longer available'
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

    // Register chrome_status tool - checks connection without requiring it
    this.registerTool({
      name: 'chrome_status',
      description: 'Get Chrome connection status',
      argsSchema: {
        parse: (value) => value || {},
        safeParse: (value) => ({ success: true, data: value || {} })
      },
      handler: async (args, context) => {
        try {
          const isConnected = this.chromeService.isConnected();
          const client = this.chromeService.getCurrentClient();
          
          const statusData: any = {
            connected: isConnected,
            timestamp: new Date().toISOString(),
            health: isConnected ? '✅ Connected' : '❌ Not connected'
          };

          if (isConnected && client) {
            statusData.connectionDetails = {
              active: true,
              capabilities: [
                'React debugging',
                'DOM inspection',
                'Network monitoring',
                'Performance profiling',
                'Screenshot capture'
              ]
            };
            statusData.nextActions = [
              '🌳 Explore React components',
              '🔍 Inspect DOM elements',
              '📊 Monitor network activity'
            ];
          } else {
            statusData.nextActions = [
              '🔍 Run chrome_discover to find Chrome instances',
              '🚀 Use chrome_connect to establish connection'
            ];
          }

          return {
            success: true,
            data: statusData
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get Chrome status'
          };
        }
      }
    });
  }
}

// Extended provider dependencies to include discovery service
interface ChromeConnectionProviderDependencies extends ProviderDependencies {
  chromeDiscoveryService: IChromeDiscoveryService;
}

export class ChromeConnectionToolProviderFactory extends BaseProviderFactory<ChromeConnectionToolProvider> {
  create(deps: ChromeConnectionProviderDependencies): ChromeConnectionToolProvider {
    const config: BaseToolProviderConfig = {
      name: 'chrome-connection',
      description: 'Chrome discovery and connection management tools'
    };

    return new ChromeConnectionToolProvider(
      deps.chromeService,
      this.createProviderLogger(deps, config.name),
      deps.validator,
      config,
      deps.chromeDiscoveryService
    );
  }
}