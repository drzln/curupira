/**
 * Chrome Client with proper CDP session management - Level 1 (Chrome Core)
 * Implements browser-level WebSocket for Browserless compatibility
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import type { 
  SessionId,
  TargetId,
  CDPConnectionOptions
} from '@curupira/shared/types';
import type { IChromeClient } from './interfaces.js';
import type { ILogger } from '../core/interfaces/logger.interface.js';
import type { IBrowserlessDetector, BrowserInfo } from './browserless-detector.js';
import { LRUCache } from '../core/utils/lru-cache.js';
import { retryWithBackoff } from '../core/utils/retry.js';

// CDP Types inline for now
type CDPConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

interface CDPSession {
  id: string;
  sessionId: string;
  targetId: string;
  targetType: 'page' | 'iframe' | 'worker' | 'service_worker' | 'other';
}

interface CDPTarget {
  targetId: string;
  type: string;
  title: string;
  url: string;
  attached: boolean;
  canAccessOpener: boolean;
  webSocketDebuggerUrl?: string;
  devtoolsFrontendUrl?: string;
}

interface MessageHandler {
  resolve: (result: any) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

interface SessionInfo {
  sessionId: string;
  targetId: string;
  targetType: string;
}

export class ChromeClient implements IChromeClient {
  private config: CDPConnectionOptions;
  
  // Browser-level WebSocket for Browserless
  private browserWs: WebSocket | null = null;
  private browserMessageId: number = 1;
  private browserMessageHandlers: Map<number, MessageHandler> = new Map();
  
  // Session management
  private sessions: Map<string, SessionInfo> = new Map();
  private state: CDPConnectionState = 'disconnected';
  private targets: Map<string, CDPTarget> = new Map();
  
  // Caching
  private responseCache: LRUCache<string, any> = new LRUCache(100);
  private eventCache: Map<string, any[]> = new Map();
  
  private browserInfo: BrowserInfo | null = null;
  private eventEmitter = new EventEmitter();

  constructor(
    private readonly logger: ILogger,
    private readonly browserlessDetector: IBrowserlessDetector,
    config?: CDPConnectionOptions
  ) {
    this.config = config || { host: 'localhost', port: 3000, timeout: 30000 };
  }

  async connect(): Promise<void> {
    if (this.state === 'connected') {
      this.logger.warn('Already connected to Chrome');
      return;
    }

    this.logger.info('Starting Chrome connection process');
    this.state = 'connecting';
    this.eventEmitter.emit('stateChange', this.state);

    try {
      // Detect browser type
      this.browserInfo = await this.browserlessDetector.detect(this.config.host, this.config.port);
      this.logger.info({ browserInfo: this.browserInfo }, 'Browser detected');

      // Connect browser-level WebSocket for Browserless
      if (this.browserInfo?.isBrowserless) {
        await this.connectBrowserWebSocket();
      }

      // Discover available targets
      await this.updateTargets();

      this.state = 'connected';
      this.eventEmitter.emit('stateChange', this.state);
      this.eventEmitter.emit('connected', { 
        browserInfo: this.browserInfo 
      });
    } catch (error) {
      this.state = 'error';
      this.eventEmitter.emit('stateChange', this.state);
      
      this.logger.error({ 
        error,
        config: this.config,
        state: this.state 
      }, 'Failed to connect to Chrome');
      
      throw error;
    }
  }

  private async connectBrowserWebSocket(): Promise<void> {
    const protocol = this.config.secure ? 'wss' : 'ws';
    const wsUrl = `${protocol}://${this.config.host}:${this.config.port}/`;
    
    this.logger.info({ wsUrl }, 'Connecting to Browserless root WebSocket');
    
    return new Promise((resolve, reject) => {
      this.browserWs = new WebSocket(wsUrl);
      this.logger.debug('WebSocket instance created, waiting for connection...');
      
      const timeout = setTimeout(() => {
        if (this.browserWs) {
          this.browserWs.close();
        }
        reject(new Error('Browser WebSocket connection timeout'));
      }, this.config.timeout || 30000);
      
      this.browserWs.on('open', () => {
        clearTimeout(timeout);
        this.logger.info('Browser WebSocket connected successfully');
        this.logger.debug({ readyState: this.browserWs?.readyState }, 'WebSocket ready state');
        
        // Ensure WebSocket is truly ready by testing a simple command
        this.sendBrowserCommand('Target.getVersion')
          .then((version) => {
            this.logger.info({ version }, 'Browser WebSocket verified with version check');
            resolve();
          })
          .catch((error) => {
            this.logger.error({ error }, 'Browser WebSocket verification failed');
            if (this.browserWs) {
              this.browserWs.close();
            }
            reject(new Error('Browser WebSocket verification failed'));
          });
      });
      
      this.browserWs.on('message', (data) => {
        this.handleBrowserMessage(data.toString());
      });
      
      this.browserWs.on('error', (error) => {
        clearTimeout(timeout);
        this.logger.error({ error }, 'Browser WebSocket error');
        reject(error);
      });
      
      this.browserWs.on('close', () => {
        this.logger.info('Browser WebSocket closed');
        this.browserWs = null;
        // Clean up all sessions if browser connection lost
        this.sessions.clear();
      });
    });
  }

  private handleBrowserMessage(data: string): void {
    try {
      const message = JSON.parse(data);
      
      // Handle responses to commands
      if ('id' in message) {
        const handler = this.browserMessageHandlers.get(message.id);
        if (handler) {
          clearTimeout(handler.timeout);
          if (message.error) {
            handler.reject(new Error(message.error.message));
          } else {
            handler.resolve(message.result);
          }
          this.browserMessageHandlers.delete(message.id);
        }
        return;
      }
      
      // Handle events
      if ('method' in message) {
        // Session-specific event
        if (message.sessionId) {
          const session = this.sessions.get(message.sessionId);
          if (session) {
            // Cache event data
            const cacheKey = `session:${message.sessionId}:${message.method}`;
            if (!this.eventCache.has(cacheKey)) {
              this.eventCache.set(cacheKey, []);
            }
            this.eventCache.get(cacheKey)!.push({ 
              timestamp: Date.now(), 
              params: message.params 
            });
            
            // Emit event
            this.eventEmitter.emit(message.method, { 
              sessionId: message.sessionId, 
              ...message.params 
            });
          }
        } else {
          // Browser-level event
          this.eventEmitter.emit(message.method, message.params);
        }
      }
    } catch (error) {
      this.logger.error({ error }, 'Failed to parse browser message');
    }
  }

  async createSession(targetId?: string): Promise<CDPSession> {
    this.logger.info({ targetId, state: this.state }, 'Creating Chrome session');
    
    if (this.state !== 'connected') {
      this.logger.error({ state: this.state }, 'Cannot create session - not connected');
      throw new Error('Not connected to Chrome');
    }

    // Find target
    let target: CDPTarget | undefined;
    if (targetId) {
      target = this.targets.get(targetId);
      if (!target) {
        throw new Error(`Target ${targetId} not found`);
      }
    } else {
      // Find first available page target
      const targets = Array.from(this.targets.values());
      target = targets.find(t => t.type === 'page');
      
      if (!target) {
        if (this.browserInfo?.isBrowserless && targets.length > 0) {
          // Use first available target for Browserless
          target = targets[0];
          this.logger.info({ targetId: target.targetId }, 'Using existing Browserless target');
        } else {
          throw new Error('No page target available');
        }
      }
    }

    // For Browserless, use Target.attachToTarget
    if (this.browserInfo?.isBrowserless && this.browserWs) {
      try {
        this.logger.info({ 
          targetId: target.targetId,
          browserWsState: this.browserWs.readyState,
          browserWsReady: this.browserWs.readyState === WebSocket.OPEN
        }, 'Attaching to Browserless target via CDP');
        
        const result = await this.sendBrowserCommand<{ sessionId: string }>('Target.attachToTarget', {
          targetId: target.targetId,
          flatten: true // Important for Browserless
        });
        
        this.logger.info({ sessionId: result.sessionId }, 'Target attached successfully');
        
        const sessionInfo: SessionInfo = {
          sessionId: result.sessionId,
          targetId: target.targetId,
          targetType: target.type
        };
        
        this.sessions.set(result.sessionId, sessionInfo);
        
        // Enable necessary domains
        this.logger.debug({ sessionId: result.sessionId }, 'Enabling Runtime and Page domains');
        await this.send('Runtime.enable', {}, result.sessionId);
        await this.send('Page.enable', {}, result.sessionId);
        this.logger.info({ sessionId: result.sessionId }, 'Session fully initialized');
        
        return {
          id: result.sessionId,
          sessionId: result.sessionId,
          targetId: target.targetId,
          targetType: target.type as any
        };
      } catch (error) {
        this.logger.error({ error, targetId: target.targetId }, 'Failed to attach to target');
        throw error;
      }
    }
    
    // For standard Chrome, fall back to direct WebSocket (not implemented in this version)
    throw new Error('Standard Chrome direct WebSocket not implemented - use Browserless');
  }

  private async sendBrowserCommand<T>(method: string, params?: any): Promise<T> {
    if (!this.browserWs || this.browserWs.readyState !== WebSocket.OPEN) {
      this.logger.error({ 
        browserWs: !!this.browserWs,
        readyState: this.browserWs?.readyState,
        expected: WebSocket.OPEN
      }, 'Browser WebSocket not ready');
      throw new Error('Browser WebSocket not connected');
    }
    
    const id = this.browserMessageId++;
    const message = { id, method, params: params || {} };
    
    this.logger.debug({ id, method, params }, 'Sending browser command');
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.browserMessageHandlers.delete(id);
        reject(new Error(`Browser command timeout: ${method}`));
      }, this.config.timeout || 30000);
      
      this.browserMessageHandlers.set(id, {
        resolve: (result: T) => {
          resolve(result);
        },
        reject: (error: Error) => {
          reject(error);
        },
        timeout
      });
      
      this.browserWs!.send(JSON.stringify(message));
    });
  }

  async send<T = unknown>(
    method: string,
    params?: Record<string, unknown>,
    sessionId?: string
  ): Promise<T> {
    if (!sessionId) {
      // Browser-level command via HTTP
      return this.sendHttpCommand<T>(method, params);
    }

    // Session-level command via WebSocket
    if (!this.browserWs || this.browserWs.readyState !== WebSocket.OPEN) {
      throw new Error('Browser WebSocket not connected');
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const id = this.browserMessageId++;
    const message = { 
      id, 
      method, 
      params: params || {},
      sessionId // Include sessionId for target-specific commands
    };
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.browserMessageHandlers.delete(id);
        reject(new Error(`Command timeout: ${method}`));
      }, this.config.timeout || 30000);
      
      this.browserMessageHandlers.set(id, {
        resolve: (result: T) => {
          resolve(result);
        },
        reject: (error: Error) => {
          reject(error);
        },
        timeout
      });
      
      this.browserWs!.send(JSON.stringify(message));
    });
  }

  private async sendHttpCommand<T>(method: string, params?: any): Promise<T> {
    const protocol = this.config.secure ? 'https' : 'http';
    const baseUrl = `${protocol}://${this.config.host}:${this.config.port}`;
    
    const response = await fetch(`${baseUrl}/json/runtime/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params || {})
    });

    if (!response.ok) {
      throw new Error(`HTTP command failed: ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  async updateTargets(): Promise<void> {
    this.logger.debug({ state: this.state }, 'Updating targets');
    
    if (this.state !== 'connected' && this.state !== 'connecting') {
      this.logger.error({ state: this.state }, 'Cannot update targets - invalid state');
      throw new Error('Not connected to Chrome');
    }

    try {
      const protocol = this.config.secure ? 'https' : 'http';
      const baseUrl = `${protocol}://${this.config.host}:${this.config.port}`;
      const targetsUrl = `${baseUrl}/json`;
      
      const response = await fetch(targetsUrl);
      if (!response.ok) {
        throw new Error(`Failed to get targets: ${response.statusText}`);
      }
      
      const targets = await response.json() as Array<{
        id?: string;
        targetId?: string;
        type: string;
        title: string;
        url: string;
        webSocketDebuggerUrl?: string;
        devtoolsFrontendUrl?: string;
      }>;

      // Update targets map
      this.targets.clear();
      for (const target of targets) {
        let targetId: string;
        
        if (target.targetId) {
          // Extract ID from Browserless path format
          if (target.targetId.startsWith('/devtools/')) {
            targetId = target.targetId.split('/').pop() || target.targetId;
          } else {
            targetId = target.targetId;
          }
        } else if (target.id) {
          targetId = target.id;
        } else {
          targetId = `target_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        }
        
        this.targets.set(targetId, {
          targetId: targetId,
          type: target.type,
          title: target.title,
          url: target.url,
          attached: false,
          canAccessOpener: false,
          webSocketDebuggerUrl: target.webSocketDebuggerUrl,
          devtoolsFrontendUrl: target.devtoolsFrontendUrl
        });
      }

      const targetList = Array.from(this.targets.values());
      this.logger.info({ targetCount: targetList.length }, 'Targets updated');
      this.eventEmitter.emit('targetsUpdated', targetList);
    } catch (error) {
      this.logger.error({ error }, 'Failed to update targets');
      throw error;
    }
  }

  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    try {
      // Detach from target
      if (this.browserWs) {
        await this.sendBrowserCommand('Target.detachFromTarget', { 
          sessionId 
        });
      }
      
      this.sessions.delete(sessionId);
      this.eventEmitter.emit('sessionClosed', { sessionId });
    } catch (error) {
      this.logger.error({ sessionId, error }, 'Failed to close session');
    }
  }

  async disconnect(): Promise<void> {
    if (this.state === 'disconnected') {
      return;
    }

    this.state = 'disconnected';
    this.eventEmitter.emit('stateChange', this.state);

    // Close all sessions
    const sessionIds = Array.from(this.sessions.keys());
    await Promise.all(sessionIds.map(id => this.closeSession(id)));

    // Close browser WebSocket
    if (this.browserWs) {
      this.browserWs.close();
      this.browserWs = null;
    }

    // Clear all state
    this.targets.clear();
    this.responseCache.clear();
    this.eventCache.clear();
    this.browserMessageHandlers.clear();
    this.browserMessageId = 1;

    this.eventEmitter.emit('disconnected');
  }

  // Navigation helpers
  async navigate(sessionId: string, url: string): Promise<void> {
    await this.send('Page.navigate', { url }, sessionId);
  }

  async evaluate<T = unknown>(
    sessionId: string,
    expression: string,
    awaitPromise = true
  ): Promise<T> {
    const result = await this.send<{
      result: { value?: T; unserializableValue?: string };
      exceptionDetails?: any;
    }>('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise
    }, sessionId);

    if (result.exceptionDetails) {
      throw new Error(`Evaluation failed: ${result.exceptionDetails.text}`);
    }

    return result.result.value as T;
  }

  // State and info getters
  isConnected(): boolean {
    const connected = this.state === 'connected';
    this.logger.debug({ state: this.state, connected }, 'isConnected check');
    return connected;
  }

  getState(): CDPConnectionState {
    return this.state;
  }

  getTargets(): any {
    return Array.from(this.targets.values());
  }

  getTarget(targetId: string): CDPTarget | undefined {
    return this.targets.get(targetId);
  }

  getSessions(): any[] {
    return Array.from(this.sessions.entries()).map(([sessionId, info]) => ({
      id: sessionId,
      sessionId: sessionId,
      targetId: info.targetId,
      targetType: info.targetType as any
    }));
  }

  getSession(sessionId: string): any {
    const info = this.sessions.get(sessionId);
    if (!info) return undefined;
    
    return {
      id: sessionId,
      sessionId: sessionId,
      targetId: info.targetId,
      targetType: info.targetType as any
    };
  }

  // Event handling
  on(event: string, handler: (params: any) => void): void {
    this.eventEmitter.on(event, handler);
  }

  off(event: string, handler?: (params: any) => void): void {
    if (handler) {
      this.eventEmitter.removeListener(event, handler);
    } else {
      this.eventEmitter.removeAllListeners(event);
    }
  }

  once<T = unknown>(event: string, handler: (params: T) => void): void {
    this.eventEmitter.once(event, handler);
  }

  // Compatibility methods
  emit(event: string, ...args: any[]): boolean {
    return this.eventEmitter.emit(event, ...args);
  }

  removeListener(event: string, listener: (...args: any[]) => void): this {
    this.eventEmitter.removeListener(event, listener);
    return this;
  }

  removeAllListeners(event?: string): this {
    this.eventEmitter.removeAllListeners(event);
    return this;
  }

  async attachToTarget(targetId: string): Promise<void> {
    await this.createSession(targetId);
  }

  async detachFromTarget(sessionId: string): Promise<void> {
    await this.closeSession(sessionId);
  }

  async waitForTarget(
    predicate: (target: CDPTarget) => boolean,
    timeout: number = 30000
  ): Promise<CDPTarget> {
    const existingTarget = Array.from(this.targets.values()).find(predicate);
    if (existingTarget) {
      return existingTarget;
    }

    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.off('targetsUpdated', checkTargets);
        reject(new Error('Timeout waiting for target'));
      }, timeout);

      const checkTargets = (targets: CDPTarget[]) => {
        const target = targets.find(predicate);
        if (target) {
          clearTimeout(timeoutHandle);
          this.off('targetsUpdated', checkTargets);
          resolve(target);
        }
      };

      this.on('targetsUpdated', checkTargets);
    });
  }

  getConnectionState(): CDPConnectionState {
    return this.state;
  }

  getSessionCount(): number {
    return this.sessions.size;
  }

  onSessionEvent(
    sessionId: string,
    event: string,
    handler: (params: any) => void
  ): void {
    // For Browserless, all events come through the main WebSocket
    const eventKey = `${event}:${sessionId}`;
    this.eventEmitter.on(eventKey, handler);
  }

  offSessionEvent(
    sessionId: string,
    event: string,
    handler?: (params: any) => void
  ): void {
    const eventKey = `${event}:${sessionId}`;
    if (handler) {
      this.eventEmitter.removeListener(eventKey, handler);
    } else {
      this.eventEmitter.removeAllListeners(eventKey);
    }
  }

  getSessionEvents(sessionId: string, event: string): any[] {
    const cacheKey = `session:${sessionId}:${event}`;
    return this.eventCache.get(cacheKey) || [];
  }
}