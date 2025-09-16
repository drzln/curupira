/**
 * Chrome DevTools Protocol Client
 * Manages connection to browserless Chrome instance
 */

import { WebSocket } from 'ws';
import { EventEmitter } from 'events';
import type { ILogger } from '../core/interfaces/logger.interface.js';
import type {
  CDPClient,
  CDPConnectionOptions,
  CDPConnectionState,
  CDPSession,
  CDPTarget
} from '@curupira/shared/types';
import type { IChromeClient, SessionInfo } from './interfaces.js';
import { LRUCache, ExpiringCache } from '@curupira/shared/utils';
import { waitForCondition, retryWithBackoff } from '@curupira/shared/utils';

// Local event map type
type CDPEventMap = {
  stateChange: CDPConnectionState;
  connected: any;
  disconnected: void;
  targetsUpdated: CDPTarget[];
  sessionError: { sessionId: string; error: Error };
  sessionClosed: { sessionId: string };
  [key: string]: any;
};

interface InternalSession extends CDPSession {
  ws: WebSocket;
  messageHandlers: Map<number, {
    resolve: (result: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>;
  eventHandlers: Map<string, Set<(...args: any[]) => void>>;
}

export class ChromeClient implements CDPClient, IChromeClient {
  private config: CDPConnectionOptions = { 
    host: 'localhost',
    port: 9222,
    timeout: 30000
  };
  private sessions: Map<string, InternalSession> = new Map();
  private state: CDPConnectionState = 'disconnected';
  private messageId: number = 1;
  private targets: Map<string, CDPTarget> = new Map();
  private responseCache: LRUCache<string, any> = new LRUCache(100);
  private eventCache: ExpiringCache<string, any[]> = new ExpiringCache(60000); // 1 minute

  private eventEmitter = new EventEmitter();

  constructor(private readonly logger: ILogger) {}

  async connect(options?: CDPConnectionOptions): Promise<void> {
    if (this.state === 'connected') {
      this.logger.warn('Already connected to Chrome');
      return;
    }

    if (options) {
      this.config = { ...this.config, ...options };
    }

    this.state = 'connecting';
    this.eventEmitter.emit('stateChange', this.state);

    try {
      const protocol = this.config.secure ? 'https' : 'http';
      const baseUrl = `${protocol}://${this.config.host}:${this.config.port}`;
      
      // Test HTTP endpoint first
      const versionUrl = `${baseUrl}/json/version`;
      const response = await retryWithBackoff(
        () => fetch(versionUrl),
        3,
        1000
      );
      
      if (!response.ok) {
        throw new Error(`Failed to connect to Chrome: ${response.statusText}`);
      }
      
      const versionInfo = await response.json();
      this.logger.info({ versionInfo }, 'Chrome version info');
      
      // Discover available targets
      await this.updateTargets();
      
      this.state = 'connected';
      this.eventEmitter.emit('stateChange', this.state);
      this.eventEmitter.emit('connected', versionInfo);
    } catch (error) {
      this.state = 'error';
      this.eventEmitter.emit('stateChange', this.state);
      this.logger.error({ error }, 'Failed to connect to Chrome');
      throw error;
    }
  }

  async createSession(targetId?: string): Promise<CDPSession> {
    if (this.state !== 'connected') {
      throw new Error('Not connected to Chrome');
    }

    let target: CDPTarget | undefined;
    let actualTargetId: string;
    
    if (targetId) {
      target = this.targets.get(targetId);
      if (!target) {
        throw new Error(`Target ${targetId} not found`);
      }
      actualTargetId = targetId;
    } else {
      // Find first available page target
      const targets = Array.from(this.targets.values());
      target = targets.find(t => t.type === 'page');
      if (!target) {
        throw new Error('No page target available');
      }
      actualTargetId = target.targetId;
    }

    try {
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const wsUrl = target.webSocketDebuggerUrl;
      
      if (!wsUrl) {
        throw new Error('Target does not have a WebSocket debugger URL');
      }

      const ws = new WebSocket(wsUrl);
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('WebSocket connection timeout'));
        }, this.config.timeout || 30000);

        ws.on('open', () => {
          clearTimeout(timeout);
          
          const session: InternalSession = {
            id: sessionId,
            sessionId: sessionId,
            targetId: actualTargetId,
            targetType: target.type as 'page' | 'iframe' | 'worker' | 'service_worker' | 'other',
            ws,
            messageHandlers: new Map(),
            eventHandlers: new Map()
          };
          
          this.sessions.set(sessionId, session);

          ws.on('message', (data) => {
            this.handleMessage(sessionId, data.toString());
          });

          ws.on('close', () => {
            this.cleanupSession(sessionId);
          });

          ws.on('error', (error) => {
            this.logger.error({ sessionId, error }, 'WebSocket error');
            this.eventEmitter.emit('sessionError', { sessionId, error });
          });

          // Enable necessary domains
          this.send('Runtime.enable', {}, sessionId);
          this.send('Page.enable', {}, sessionId);

          const sessionInfo = {
            id: sessionId,
            sessionId: sessionId,
            targetId: actualTargetId,
            targetType: target.type as 'page' | 'iframe' | 'worker' | 'service_worker' | 'other'
          };
          
          // Always return CDPSession for compatibility
          resolve(sessionInfo);
        });

        ws.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    } catch (error) {
      this.logger.error({ error }, 'Failed to create session');
      throw error;
    }
  }

  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return; // Already closed
    }

    try {
      session.ws.close();
      this.cleanupSession(sessionId);
    } catch (error) {
      this.logger.error({ sessionId, error }, 'Failed to close session');
    }
  }

  private cleanupSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Clear all pending handlers
    for (const [, handler] of session.messageHandlers) {
      clearTimeout(handler.timeout);
      handler.reject(new Error('Session closed'));
    }
    session.messageHandlers.clear();
    session.eventHandlers.clear();

    this.sessions.delete(sessionId);
    this.eventCache.delete(`session:${sessionId}`);
    this.eventEmitter.emit('sessionClosed', { sessionId });
  }

  async updateTargets(): Promise<void> {
    if (this.state !== 'connected') {
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
        id: string;
        type: string;
        title: string;
        url: string;
        webSocketDebuggerUrl?: string;
        devtoolsFrontendUrl?: string;
      }>;

      // Update targets map
      this.targets.clear();
      for (const target of targets) {
        this.targets.set(target.id, {
          targetId: target.id,
          type: target.type,
          title: target.title,
          url: target.url,
          attached: false,
          canAccessOpener: false,
          webSocketDebuggerUrl: target.webSocketDebuggerUrl,
          devtoolsFrontendUrl: target.devtoolsFrontendUrl
        });
      }

      this.eventEmitter.emit('targetsUpdated', Array.from(this.targets.values()));
    } catch (error) {
      this.logger.error({ error }, 'Failed to update targets');
      throw error;
    }
  }

  async send<T = unknown>(
    method: string,
    params?: Record<string, unknown>,
    sessionId?: string
  ): Promise<T> {
    if (!sessionId) {
      // Browser-level command
      return this.sendBrowserCommand<T>(method, params);
    }

    // Session-level command
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const cacheKey = `${method}:${JSON.stringify(params || {})}`;
    const cached = this.responseCache.get(cacheKey);
    if (cached && this.isCacheable(method)) {
      return cached as T;
    }

    const result = await this.sendCommand<T>(sessionId, method, params);
    
    if (this.isCacheable(method)) {
      this.responseCache.set(cacheKey, result);
    }

    return result;
  }

  on<K extends keyof CDPEventMap>(
    event: K,
    handler: (params: CDPEventMap[K]) => void
  ): void;
  on(event: string, handler: (params: any) => void): void {
    this.eventEmitter.on(event, handler);
  }

  off<K extends keyof CDPEventMap>(
    event: K,
    handler?: (params: CDPEventMap[K]) => void
  ): void;
  off(event: string, handler?: (params: any) => void): void {
    if (handler) {
      this.eventEmitter.removeListener(event, handler);
    } else {
      this.eventEmitter.removeAllListeners(event);
    }
  }

  async getTargets(): Promise<CDPTarget[]> {
    return Array.from(this.targets.values());
  }
  

  getTarget(targetId: string): CDPTarget | undefined {
    return this.targets.get(targetId);
  }

  getSessions(): CDPSession[] {
    return Array.from(this.sessions.values()).map(session => ({
      id: session.id,
      sessionId: session.sessionId,
      targetId: session.targetId,
      targetType: session.targetType
    }));
  }
  

  getSession(sessionId: string): CDPSession | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;
    
    return {
      id: session.id,
      sessionId: session.sessionId,
      targetId: session.targetId,
      targetType: session.targetType
    };
  }

  getState(): CDPConnectionState {
    return this.state;
  }

  getConnectionState(): CDPConnectionState {
    return this.state;
  }

  async attachToTarget(targetId: string): Promise<void> {
    // For browserless, creating a session is the same as attaching
    await this.createSession(targetId);
  }

  async detachFromTarget(sessionId: string): Promise<void> {
    await this.closeSession(sessionId);
  }

  once<T = unknown>(event: string, handler: (params: T) => void): void {
    this.eventEmitter.once(event, handler);
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

  private async sendBrowserCommand<T>(
    method: string,
    params?: Record<string, unknown>
  ): Promise<T> {
    const protocol = this.config.secure ? 'https' : 'http';
    const baseUrl = `${protocol}://${this.config.host}:${this.config.port}`;
    
    // Browser-level commands via HTTP
    const response = await fetch(`${baseUrl}/json/runtime/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params || {})
    });

    if (!response.ok) {
      throw new Error(`Browser command failed: ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  private isCacheable(method: string): boolean {
    // Cache read-only methods
    const cacheableMethods = [
      'DOM.getDocument',
      'DOM.describeNode',
      'CSS.getComputedStyleForNode',
      'CSS.getMatchedStylesForNode',
      'Runtime.getProperties'
    ];
    return cacheableMethods.includes(method);
  }

  private async sendCommand<T>(
    sessionId: string,
    method: string,
    params?: Record<string, unknown>
  ): Promise<T> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const id = this.messageId++;
    const message = {
      id,
      method,
      params: params || {}
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        session.messageHandlers.delete(id);
        reject(new Error(`Command timeout: ${method}`));
      }, this.config.timeout || 30000);

      session.messageHandlers.set(id, {
        resolve: (result: T) => {
          clearTimeout(timeout);
          session.messageHandlers.delete(id);
          resolve(result);
        },
        reject: (error: Error) => {
          clearTimeout(timeout);
          session.messageHandlers.delete(id);
          reject(error);
        },
        timeout
      });

      try {
        session.ws.send(JSON.stringify(message));
      } catch (error) {
        session.messageHandlers.delete(id);
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  private handleMessage(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    try {
      const message = JSON.parse(data);
      
      // Handle responses to commands
      if ('id' in message) {
        const handler = session.messageHandlers.get(message.id);
        if (handler) {
          if (message.error) {
            handler.reject(new Error(message.error.message));
          } else {
            handler.resolve(message.result);
          }
        }
        return;
      }

      // Handle events
      if ('method' in message) {
        const event = message.method;
        const params = message.params || {};

        // Cache event data
        const cacheKey = `session:${sessionId}:${event}`;
        let eventHistory = this.eventCache.get(cacheKey) || [];
        eventHistory.push({ timestamp: Date.now(), params });
        if (eventHistory.length > 100) {
          eventHistory = eventHistory.slice(-100); // Keep last 100
        }
        this.eventCache.set(cacheKey, eventHistory);

        // Emit to session-specific handlers
        const handlers = session.eventHandlers.get(event);
        if (handlers) {
          for (const handler of handlers) {
            try {
              handler(params);
            } catch (error) {
              this.logger.error({ sessionId, event, error }, 'Event handler error');
            }
          }
        }

        // Emit global event
        this.eventEmitter.emit(event, { sessionId, ...params });
      }
    } catch (error) {
      this.logger.error({ sessionId, error }, 'Failed to parse CDP message');
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

    // Clear all state
    this.targets.clear();
    this.responseCache.clear();
    this.eventCache.clear();
    this.messageId = 1;

    this.eventEmitter.emit('disconnected');
  }

  isConnected(): boolean {
    return this.state === 'connected';
  }

  getSessionCount(): number {
    return this.sessions.size;
  }

  // EventEmitter interface implementation
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

  // Session-specific event handling
  onSessionEvent(
    sessionId: string,
    event: string,
    handler: (params: any) => void
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (!session.eventHandlers.has(event)) {
      session.eventHandlers.set(event, new Set());
    }
    session.eventHandlers.get(event)!.add(handler);
  }

  offSessionEvent(
    sessionId: string,
    event: string,
    handler?: (params: any) => void
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    if (handler) {
      session.eventHandlers.get(event)?.delete(handler);
    } else {
      session.eventHandlers.delete(event);
    }
  }

  // Get cached events for a session
  getSessionEvents(sessionId: string, event: string): any[] {
    const cacheKey = `session:${sessionId}:${event}`;
    return this.eventCache.get(cacheKey) || [];
  }

  // Utility methods for common CDP operations
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

  async screenshot(
    sessionId: string,
    options: { fullPage?: boolean; quality?: number } = {}
  ): Promise<{ data: string; width?: number; height?: number }> {
    const result = await this.send<{
      data: string;
    }>('Page.captureScreenshot', {
      format: 'png',
      quality: options.quality,
      captureBeyondViewport: options.fullPage
    }, sessionId);

    return {
      data: result.data
    };
  }
}