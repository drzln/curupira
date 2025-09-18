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
    
    // Also set up network monitoring for default target
    this.setupDefaultTargetNetworkMonitoring();

    // Set up console monitoring for existing sessions
    const sessions = this.client.getSessions();
    this.logger.info({ sessionCount: sessions.length }, 'Setting up monitoring for existing sessions');
    for (const session of sessions) {
      this.logger.debug({ sessionId: session.sessionId, targetType: session.targetType }, 'Setting up monitoring for session');
      this.setupConsoleMonitoring(session.sessionId);
      this.setupNetworkMonitoring(session.sessionId);
    }
    
    // Also set up monitoring for the default target (page)
    // This handles cases where commands are executed on the default target
    this.setupDefaultTargetConsoleMonitoring();
  }

  private async setupDefaultTargetConsoleMonitoring(): Promise<void> {
    if (!this.client) return;

    try {
      // Create a session for the main page target to ensure WebSocket connection
      const targets = await this.client.getTargets();
      const mainPageTarget = targets.find((t: any) => t.type === 'page');
      
      if (mainPageTarget) {
        this.logger.info({ targetId: mainPageTarget.targetId }, 'Setting up console monitoring for main page target');
        
        // Check if we already have a session for this target
        const existingSessions = this.client.getSessions();
        const existingSession = existingSessions.find((s: any) => s.targetId === mainPageTarget.targetId);
        
        if (existingSession) {
          this.logger.info({ sessionId: existingSession.sessionId }, 'Using existing session for console monitoring');
          // Set up console monitoring for existing session
          await this.setupConsoleMonitoring(existingSession.sessionId);
        } else {
          // Create session which will establish WebSocket connection for standard Chrome
          const session = await this.client.createSession(mainPageTarget.targetId);
          
          // Set up console monitoring for this session
          await this.setupConsoleMonitoring(session.sessionId);
          
          this.logger.info({ sessionId: session.sessionId }, 'Console monitoring enabled for new main page session');
        }
        
        // Also enable console buffer for 'default' sessionId for backward compatibility
        if (this.consoleBufferService) {
          this.consoleBufferService.enableSession('default' as any);
        }
      } else {
        this.logger.warn('No page target found for console monitoring setup');
      }
    } catch (error) {
      this.logger.error({ error }, 'Failed to set up console monitoring for default target');
    }
  }

  private cleanupSessionEventHandlers(): void {
    if (!this.client) return;

    // Clean up all session handlers
    for (const [sessionId, handlers] of this.activeSessionHandlers) {
      for (const handler of handlers) {
        this.client.offSessionEvent(sessionId, 'Runtime.consoleAPICalled', handler as any);
        this.client.offSessionEvent(sessionId, 'Console.messageAdded', handler as any);
        this.client.offSessionEvent(sessionId, 'Runtime.exceptionThrown', handler as any);
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
  
  private async setupDefaultTargetNetworkMonitoring(): Promise<void> {
    if (!this.client || !this.networkBufferService) return;
    
    try {
      // Create a session for the main page target to ensure WebSocket connection
      const targets = await this.client.getTargets();
      const mainPageTarget = targets.find((t: any) => t.type === 'page');
      
      if (mainPageTarget) {
        this.logger.info({ targetId: mainPageTarget.targetId }, 'Setting up network monitoring for main page target');
        
        // Check if we already have a session for this target
        const existingSessions = this.client.getSessions();
        const existingSession = existingSessions.find((s: any) => s.targetId === mainPageTarget.targetId);
        
        if (existingSession) {
          this.logger.info({ sessionId: existingSession.sessionId }, 'Using existing session for network monitoring');
          // Set up network monitoring for existing session
          await this.setupNetworkMonitoring(existingSession.sessionId);
        } else {
          // Create session which will establish WebSocket connection for standard Chrome
          const session = await this.client.createSession(mainPageTarget.targetId);
          
          // Set up network monitoring for this session
          await this.setupNetworkMonitoring(session.sessionId);
          
          this.logger.info({ sessionId: session.sessionId }, 'Network monitoring enabled for new main page session');
        }
        
        // Also enable network buffer for 'default' sessionId for backward compatibility
        if (this.networkBufferService) {
          this.networkBufferService.enableSession('default' as any);
        }
      } else {
        this.logger.warn('No page target found for network monitoring setup');
      }
    } catch (error) {
      this.logger.error({ error }, 'Failed to set up network monitoring for default target');
    }
  }

  /**
   * Enable console monitoring for a session (public interface)
   */
  async enableConsoleMonitoring(sessionId: string): Promise<void> {
    return this.setupConsoleMonitoring(sessionId);
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

      // Handler for Runtime.exceptionThrown events (CRITICAL for JavaScript errors)
      const exceptionThrownHandler = (params: any) => {
        this.logger.debug({ sessionId, exception: params.exceptionDetails }, 'Runtime exception thrown');
        
        const exception = params.exceptionDetails;
        const errorText = exception?.exception?.description || exception?.text || 'Unknown error';
        const url = exception?.url || '';
        const lineNumber = exception?.lineNumber;
        const columnNumber = exception?.columnNumber;
        
        // Add exception as error-level message
        this.consoleBufferService?.addMessage({
          level: 'error',
          text: errorText,
          timestamp: exception?.timestamp || Date.now(),
          source: 'exception',
          sessionId: sessionId as any,
          url,
          lineNumber,
          columnNumber,
          stackTrace: exception?.stackTrace,
        });
      };

      // Register handlers
      this.client.onSessionEvent(sessionId, 'Runtime.consoleAPICalled', consoleAPIHandler);
      this.client.onSessionEvent(sessionId, 'Console.messageAdded', messageAddedHandler);
      this.client.onSessionEvent(sessionId, 'Runtime.exceptionThrown', exceptionThrownHandler);

      // Track handlers for cleanup
      const handlers = this.activeSessionHandlers.get(sessionId) || [];
      handlers.push(consoleAPIHandler, messageAddedHandler, exceptionThrownHandler);
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

  /**
   * Get the default session ID for Chrome operations
   */
  async getDefaultSessionId(): Promise<string | null> {
    if (!this.client) {
      return null;
    }
    
    try {
      // Get the first available session or create a new one
      const targets = await this.client.listTargets();
      const pageTarget = targets.find((t: any) => t.type === 'page');
      
      if (pageTarget) {
        return pageTarget.id;
      }
      
      // If no page target found, return null
      return null;
    } catch (error) {
      this.logger.error({ error }, 'Failed to get default session ID');
      return null;
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