/**
 * Chrome Service - Level 1 (Chrome Core)
 * Service for managing Chrome browser connections with dependency injection
 */

import type { IChromeService } from '../core/interfaces/chrome-service.interface.js';
import type { IChromeClient, ConnectionOptions } from './interfaces.js';
import type { ILogger } from '../core/interfaces/logger.interface.js';
import type { ChromeConfig } from '../core/di/tokens.js';
import type { IConsoleBufferService } from './services/console-buffer.service.js';
import type { INetworkBufferService } from './services/network-buffer.service.js';
import { ChromeClient } from './client.js';
import { BrowserlessDetector } from './browserless-detector.js';
import { EventEmitter } from 'events';

export class ChromeService extends EventEmitter implements IChromeService {
  private client: IChromeClient | null = null;
  private browserlessDetector: BrowserlessDetector;
  private activeSessionHandlers = new Map<string, Function[]>();
  private networkBufferService?: INetworkBufferService;

  constructor(
    private readonly config: ChromeConfig,
    private readonly logger: ILogger,
    private readonly consoleBufferService?: IConsoleBufferService,
    networkBufferService?: INetworkBufferService
  ) {
    super();
    this.browserlessDetector = new BrowserlessDetector(this.logger);
    this.networkBufferService = networkBufferService;
  }

  async connect(options: ConnectionOptions): Promise<IChromeClient> {
    // Disconnect existing client if any
    if (this.client) {
      await this.disconnect();
    }

    // Create new client with injected dependencies
    const connectionOptions: ConnectionOptions = {
      host: options.host ?? this.config.host,
      port: options.port ?? this.config.port,
      secure: options.secure ?? this.config.secure
    };
    
    const client = new ChromeClient(this.logger, this.browserlessDetector, connectionOptions);
    
    await client.connect();
    this.client = client;

    this.logger.info(
      { host: connectionOptions.host, port: connectionOptions.port },
      'Connected to Chrome'
    );

    // Set up session event handling
    this.setupSessionEventHandlers();

    // Emit connection event for dynamic tool registration
    this.emit('connected', { client, options: connectionOptions });

    return client;
  }

  getCurrentClient(): IChromeClient | null {
    return this.client;
  }

  isConnected(): boolean {
    return this.client !== null && this.client.isConnected();
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      // Clean up session event handlers
      this.cleanupSessionEventHandlers();
      
      await this.client.disconnect();
      this.client = null;
      this.logger.info('Disconnected from Chrome');
      
      // Emit disconnection event for dynamic tool unregistration
      this.emit('disconnected');
    }
  }

  private setupSessionEventHandlers(): void {
    if (!this.client) return;

    // Listen for new sessions being created
    this.client.on('sessionCreated', (sessionInfo: any) => {
      this.logger.debug({ sessionId: sessionInfo.sessionId }, 'Session created, setting up monitoring');
      this.setupConsoleMonitoring(sessionInfo.sessionId);
      this.setupNetworkMonitoring(sessionInfo.sessionId);
    });

    // Set up console monitoring for existing sessions
    const sessions = this.client.getSessions();
    for (const session of sessions) {
      this.setupConsoleMonitoring(session.sessionId);
      this.setupNetworkMonitoring(session.sessionId);
    }
  }

  private cleanupSessionEventHandlers(): void {
    if (!this.client) return;

    // Clean up all session handlers
    for (const [sessionId, handlers] of this.activeSessionHandlers) {
      for (const handler of handlers) {
        this.client.offSessionEvent(sessionId, 'Runtime.consoleAPICalled', handler as any);
        this.client.offSessionEvent(sessionId, 'Console.messageAdded', handler as any);
      }
    }
    this.activeSessionHandlers.clear();

    // Disable all console buffer sessions
    if (this.consoleBufferService) {
      const sessions = this.client.getSessions();
      for (const session of sessions) {
        this.consoleBufferService.disableSession(session.sessionId as any);  // Session ID type conversion
      }
    }
    
    // Disable all network buffer sessions
    if (this.networkBufferService) {
      const sessions = this.client.getSessions();
      for (const session of sessions) {
        this.networkBufferService.disableSession(session.sessionId as any);  // Session ID type conversion
      }
    }
  }

  private async setupConsoleMonitoring(sessionId: string): Promise<void> {
    if (!this.client || !this.consoleBufferService) return;

    try {
      // Enable console buffer for this session
      this.consoleBufferService.enableSession(sessionId as any);  // Session ID type conversion

      // Enable Runtime and Console domains
      await this.client.send('Runtime.enable', {}, sessionId);
      await this.client.send('Console.enable', {}, sessionId).catch(() => {
        // Console domain might not be available in all targets
      });

      // Handler for Runtime.consoleAPICalled events
      const consoleAPIHandler = (params: any) => {
        this.logger.debug({ sessionId, type: params.type }, 'Console API called');
        
        // Extract message text from args
        const text = params.args?.map((arg: any) => {
          if (arg.type === 'string') return arg.value;
          if (arg.type === 'number') return String(arg.value);
          if (arg.type === 'boolean') return String(arg.value);
          if (arg.description) return arg.description;
          return JSON.stringify(arg);
        }).join(' ') || '';

        // Add to buffer
        this.consoleBufferService?.addMessage({
          level: params.type as any || 'log',
          text,
          timestamp: params.timestamp || Date.now(),
          source: 'console',
          sessionId: sessionId as any,  // Session ID type conversion
          args: params.args,
          stackTrace: params.stackTrace,
        });
      };

      // Handler for Console.messageAdded events (alternative)
      const messageAddedHandler = (params: any) => {
        this.logger.debug({ sessionId, level: params.message?.level }, 'Console message added');
        
        this.consoleBufferService?.addMessage({
          level: params.message?.level || 'log',
          text: params.message?.text || '',
          timestamp: params.message?.timestamp || Date.now(),
          source: params.message?.source || 'console',
          sessionId: sessionId as any,  // Session ID type conversion
          url: params.message?.url,
          lineNumber: params.message?.line,
          columnNumber: params.message?.column,
        });
      };

      // Register handlers
      this.client.onSessionEvent(sessionId, 'Runtime.consoleAPICalled', consoleAPIHandler);
      this.client.onSessionEvent(sessionId, 'Console.messageAdded', messageAddedHandler);

      // Track handlers for cleanup
      const handlers = this.activeSessionHandlers.get(sessionId) || [];
      handlers.push(consoleAPIHandler, messageAddedHandler);
      this.activeSessionHandlers.set(sessionId, handlers);

      this.logger.info({ sessionId }, 'Console monitoring enabled for session');
    } catch (error) {
      this.logger.error({ sessionId, error }, 'Failed to set up console monitoring');
    }
  }

  private async setupNetworkMonitoring(sessionId: string): Promise<void> {
    if (!this.client || !this.networkBufferService) return;

    try {
      // Enable network buffer for this session
      this.networkBufferService.enableSession(sessionId as any);

      // Enable Network domain
      await this.client.send('Network.enable', {}, sessionId);

      // Handler for Network.requestWillBeSent events
      const requestHandler = (params: any) => {
        this.logger.debug({ sessionId, requestId: params.requestId }, 'Network request will be sent');
        
        this.networkBufferService?.addRequest({
          requestId: params.requestId,
          sessionId: sessionId as any,
          timestamp: params.timestamp ? params.timestamp * 1000 : Date.now(),
          method: params.request?.method || 'GET',
          url: params.request?.url || '',
          headers: params.request?.headers || {},
          postData: params.request?.postData,
          resourceType: params.type,
          priority: params.priority,
          referrerPolicy: params.referrerPolicy
        });
      };

      // Handler for Network.responseReceived events
      const responseHandler = (params: any) => {
        this.logger.debug({ sessionId, requestId: params.requestId }, 'Network response received');
        
        this.networkBufferService?.addResponse({
          requestId: params.requestId,
          sessionId: sessionId as any,
          timestamp: params.timestamp ? params.timestamp * 1000 : Date.now(),
          status: params.response?.status || 0,
          statusText: params.response?.statusText || '',
          headers: params.response?.headers || {},
          mimeType: params.response?.mimeType,
          remoteIPAddress: params.response?.remoteIPAddress,
          remotePort: params.response?.remotePort,
          fromDiskCache: params.response?.fromDiskCache,
          fromServiceWorker: params.response?.fromServiceWorker,
          encodedDataLength: params.response?.encodedDataLength,
          timing: params.response?.timing
        });
      };

      // Handler for Network.loadingFailed events
      const failureHandler = (params: any) => {
        this.logger.debug({ sessionId, requestId: params.requestId }, 'Network loading failed');
        
        this.networkBufferService?.addFailure({
          requestId: params.requestId,
          sessionId: sessionId as any,
          timestamp: params.timestamp ? params.timestamp * 1000 : Date.now(),
          errorText: params.errorText || 'Unknown error',
          canceled: params.canceled || false
        });
      };

      // Register handlers
      this.client.onSessionEvent(sessionId, 'Network.requestWillBeSent', requestHandler);
      this.client.onSessionEvent(sessionId, 'Network.responseReceived', responseHandler);
      this.client.onSessionEvent(sessionId, 'Network.loadingFailed', failureHandler);

      // Track handlers for cleanup
      const handlers = this.activeSessionHandlers.get(sessionId) || [];
      handlers.push(requestHandler, responseHandler, failureHandler);
      this.activeSessionHandlers.set(sessionId, handlers);

      this.logger.info({ sessionId }, 'Network monitoring enabled for session');
    } catch (error) {
      this.logger.error({ sessionId, error }, 'Failed to set up network monitoring');
    }
  }
}

/**
 * Chrome Service Provider for dependency injection
 */
export const chromeServiceProvider = {
  provide: 'ChromeService',
  useFactory: (config: ChromeConfig, logger: ILogger, consoleBufferService?: IConsoleBufferService, networkBufferService?: INetworkBufferService) => {
    return new ChromeService(config, logger, consoleBufferService, networkBufferService);
  },
  inject: ['ChromeConfig', 'Logger', 'ConsoleBufferService', 'NetworkBufferService'] as const
};