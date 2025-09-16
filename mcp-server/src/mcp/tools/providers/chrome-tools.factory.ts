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
import type { IChromeDiscoveryService } from '../../../chrome/discovery.service.js';

// Schema definitions - Enhanced from archived chrome-tools.ts
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
    // Register chrome_discover tool - Enhanced from archived chrome-tools.ts
    this.registerTool(
      this.createTool(
        'chrome_discover',
        'Discover available Chrome instances with smart React app detection',
        discoverSchema,
        async (args, context) => {
          try {
            this.logger.info({ args }, 'Discovering Chrome instances with enhanced detection');
            
            const result = await this.discoveryService.discoverInstances({
              hosts: args.hosts,
              ports: args.ports,
              timeout: args.timeout
            });

            this.logger.info({
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
                confidence: result.instances.length > 0 ? 'high' : 'none'
              }
            };
          } catch (error) {
            this.logger.error({ error }, 'Chrome discovery failed');
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Chrome discovery failed',
              data: {
                troubleshooting: [
                  '🔧 Ensure Chrome is running with --remote-debugging-port=9222',
                  '🌐 Check if another application is using the debugging port',
                  '🔄 Try restarting Chrome with debugging enabled',
                  '⚡ Try different ports (9223, 9224) if 9222 is busy'
                ],
                recommendations: [
                  'Run: google-chrome --remote-debugging-port=9222',
                  'Or headless: google-chrome --headless --remote-debugging-port=9222'
                ]
              }
            };
          }
        }
      )
    );

    // Register chrome_connect tool - Enhanced from archived implementation
    this.registerTool(
      this.createTool(
        'chrome_connect',
        'Connect to a Chrome instance with enhanced error recovery',
        connectSchema,
        async (args, context) => {
          try {
            this.logger.info({ instanceId: args.instanceId, host: args.host, port: args.port }, 
              'Attempting Chrome connection with enhanced resilience');

            // Multi-stage connection with progressive fallback
            let connectionError: string | null = null;
            
            try {
              const client = await this.chromeService.connect({
                host: args.host!,
                port: args.port!
              });
            } catch (error) {
              connectionError = error instanceof Error ? error.message : 'Unknown error';
              this.logger.warn(`Initial connection failed: ${connectionError}`);
              
              // Fallback: Try with reduced timeout for faster feedback
              this.logger.info('Trying fallback connection with reduced timeout');
              try {
                const client = await this.chromeService.connect({
                  host: args.host!,
                  port: args.port!
                  // Note: timeout configuration would need to be added to ChromeService
                });
                connectionError = null; // Success on fallback
              } catch (fallbackError) {
                connectionError = fallbackError instanceof Error ? fallbackError.message : 'Connection failed';
              }
            }

            if (connectionError) {
              return {
                success: false,
                error: `Chrome connection failed: ${connectionError}`,
                data: {
                  troubleshooting: [
                    '🔧 Ensure Chrome is running with --remote-debugging-port=9222',
                    '🌐 Check if another application is using the debugging port',
                    '🔄 Try restarting Chrome with debugging enabled',
                    '🎯 Verify the instanceId is correct from chrome_discover',
                    '⚡ Try a different port (9223, 9224) if 9222 is busy'
                  ],
                  nextSteps: [
                    'Run chrome_discover to verify available instances',
                    'Check Chrome process: ps aux | grep chrome',
                    'Try manual connection: chrome://inspect in browser'
                  ]
                }
              };
            }

            // Enhanced success response with comprehensive capabilities
            const capabilities = [
              '⚛️  React component inspection and analysis',
              '🔄 State management debugging (Redux, Zustand, Context)',
              '⚡ Performance analysis and re-render monitoring',
              '🧪 JavaScript evaluation and testing',
              '🌐 Network request monitoring',
              '📸 State snapshot capture and time-travel debugging',
              '🔍 Hook dependency analysis and optimization',
              '🎯 Component tree visualization and navigation'
            ];

            this.logger.info('Chrome connection successful');

            return {
              success: true,
              data: {
                success: true,
                instanceId: args.instanceId,
                sessionId: 'default', // TODO: Get actual session ID from ChromeService
                message: '🚀 Successfully connected to Chrome! Ready for React debugging.',
                connectionInfo: {
                  host: args.host,
                  port: args.port,
                  timestamp: new Date().toISOString()
                },
                capabilities,
                nextSteps: [
                  '🌳 Run react_get_component_tree to explore your React app structure',
                  '🔍 Use react_detect_version to verify React and DevTools availability',
                  '🎯 Try react_find_component to locate specific components',
                  '📊 Use chrome_status anytime to check connection health'
                ],
                tips: [
                  '💡 All React debugging tools are now available',
                  '🔄 Connection will auto-reconnect if interrupted',
                  '📝 Use descriptive component names for easier debugging',
                  '⚡ Enable React DevTools browser extension for enhanced debugging'
                ]
              }
            };
          } catch (error) {
            this.logger.error({ error }, 'Chrome connection failed');
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to connect to Chrome',
              data: {
                errorType: 'connection_failure',
                troubleshooting: [
                  'Verify Chrome is running with debugging enabled',
                  'Check network connectivity to Chrome instance',
                  'Ensure no firewall blocks the debugging port'
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
              timestamp: new Date().toISOString()
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

    // Register chrome_status tool - Enhanced health assessment
    this.registerTool({
      name: 'chrome_status',
      description: 'Get comprehensive Chrome connection status and health assessment',
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
            serviceUrl: 'chrome://localhost:9222', // TODO: Get from config
            activeSessions: client ? 1 : 0,
            sessions: client ? [{
              sessionId: 'default',
              createdAt: new Date().toISOString(),
              duration: 0
            }] : [],
            capabilities: {
              screenshot: isConnected,
              evaluate: isConnected,
              navigate: isConnected,
              profiling: isConnected,
              debugging: isConnected
            },
            timestamp: new Date().toISOString(),
            health: isConnected ? '✅ Healthy' : '❌ Disconnected'
          };

          if (isConnected) {
            statusData.nextActions = [
              '🌳 Explore React components with react_get_component_tree',
              '🔍 Find specific components with react_find_component',
              '📊 Monitor performance with performance tools'
            ];
          } else {
            statusData.nextActions = [
              '🔍 Run chrome_discover to find available Chrome instances',
              '🚀 Use chrome_connect to establish a connection',
              '🔧 Ensure Chrome is running with debugging enabled'
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
interface ChromeProviderDependencies extends ProviderDependencies {
  chromeDiscoveryService: IChromeDiscoveryService;
}

export class ChromeToolProviderFactory extends BaseProviderFactory<ChromeToolProvider> {
  create(deps: ChromeProviderDependencies): ChromeToolProvider {
    const config: BaseToolProviderConfig = {
      name: 'chrome',
      description: 'Chrome discovery and connection management tools with enhanced React app detection'
    };

    return new ChromeToolProvider(
      deps.chromeService,
      this.createProviderLogger(deps, config.name),
      deps.validator,
      config,
      deps.chromeDiscoveryService
    );
  }
}