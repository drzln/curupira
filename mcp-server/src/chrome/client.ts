/**
 * Chrome DevTools Protocol Client
 * Manages connection to browserless Chrome instance
 */

import { WebSocket } from 'ws';
import { EventEmitter } from 'events';
import { logger } from '../config/logger.js';

export interface ChromeConfig {
  serviceUrl: string;
  connectTimeout?: number;
  pageTimeout?: number;
  defaultViewport?: {
    width: number;
    height: number;
  };
}

export interface CDPSession {
  id: string;
  ws: WebSocket;
  pageId?: string;
  targetId?: string;
}

export class ChromeClient extends EventEmitter {
  private config: ChromeConfig;
  private sessions: Map<string, CDPSession> = new Map();
  private connected: boolean = false;
  private messageId: number = 1;

  constructor(config: ChromeConfig) {
    super();
    this.config = {
      connectTimeout: 5000,
      pageTimeout: 30000,
      defaultViewport: { width: 1920, height: 1080 },
      ...config
    };
  }

  async connect(): Promise<void> {
    try {
      logger.info('Connecting to Chrome service', { url: this.config.serviceUrl });
      
      // Test HTTP endpoint first
      const versionUrl = `${this.config.serviceUrl}/json/version`;
      const response = await fetch(versionUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to connect to Chrome: ${response.statusText}`);
      }
      
      const versionInfo = await response.json();
      logger.info('Chrome version info', versionInfo);
      
      this.connected = true;
      this.emit('connected', versionInfo);
    } catch (error) {
      logger.error('Failed to connect to Chrome', error);
      throw error;
    }
  }

  async createPage(): Promise<string> {
    if (!this.connected) {
      throw new Error('Not connected to Chrome');
    }

    try {
      // Connect to browserless WebSocket
      const wsUrl = this.config.serviceUrl.replace('http://', 'ws://');
      const ws = new WebSocket(wsUrl);
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('WebSocket connection timeout'));
        }, this.config.connectTimeout);

        ws.on('open', () => {
          clearTimeout(timeout);
          const sessionId = `session_${Date.now()}`;
          
          this.sessions.set(sessionId, {
            id: sessionId,
            ws
          });

          ws.on('message', (data) => {
            this.handleMessage(sessionId, data.toString());
          });

          ws.on('close', () => {
            this.sessions.delete(sessionId);
            this.emit('sessionClosed', sessionId);
          });

          ws.on('error', (error) => {
            logger.error('WebSocket error', { sessionId, error });
            this.emit('error', { sessionId, error });
          });

          resolve(sessionId);
        });

        ws.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    } catch (error) {
      logger.error('Failed to create page', error);
      throw error;
    }
  }

  async navigate(sessionId: string, url: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    return this.sendCommand(sessionId, 'Page.navigate', { url });
  }

  async evaluate(sessionId: string, expression: string): Promise<any> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const result = await this.sendCommand(sessionId, 'Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });

    return result.result?.value;
  }

  async getTargets(): Promise<any[]> {
    const response = await fetch(`${this.config.serviceUrl}/json`);
    if (!response.ok) {
      throw new Error(`Failed to get targets: ${response.statusText}`);
    }
    const data = await response.json();
    return data as any[];
  }

  async screenshot(sessionId: string, options: { fullPage?: boolean } = {}): Promise<{ data: string; width: number; height: number }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const result = await this.sendCommand(sessionId, 'Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: options.fullPage
    });

    // Return with metadata
    return {
      data: result.data,
      width: 1920, // Default width
      height: 1080  // Default height
    };
  }

  // Public method for sending arbitrary CDP commands
  async send(sessionId: string, method: string, params: any = {}): Promise<any> {
    return this.sendCommand(sessionId, method, params);
  }

  private async sendCommand(sessionId: string, method: string, params: any = {}): Promise<any> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const id = this.messageId++;
    const message = {
      id,
      method,
      params
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Command timeout: ${method}`));
      }, this.config.pageTimeout);

      const handler = (data: string) => {
        try {
          const response = JSON.parse(data);
          if (response.id === id) {
            clearTimeout(timeout);
            session.ws.off('message', handler);
            
            if (response.error) {
              reject(new Error(response.error.message));
            } else {
              resolve(response.result);
            }
          }
        } catch (error) {
          // Ignore non-JSON messages
        }
      };

      session.ws.on('message', handler);
      session.ws.send(JSON.stringify(message));
    });
  }

  private handleMessage(sessionId: string, data: string): void {
    try {
      const message = JSON.parse(data);
      this.emit('message', { sessionId, message });
    } catch (error) {
      // Ignore non-JSON messages
    }
  }

  async disconnect(): Promise<void> {
    for (const [sessionId, session] of this.sessions) {
      session.ws.close();
    }
    this.sessions.clear();
    this.connected = false;
    this.emit('disconnected');
  }

  isConnected(): boolean {
    return this.connected;
  }

  getSessionCount(): number {
    return this.sessions.size;
  }
}