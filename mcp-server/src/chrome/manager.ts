/**
 * Chrome Manager
 * Singleton manager for Chrome client lifecycle
 */

import { ChromeClient } from './client.js';
import { TypedCDPClient } from './typed-client.js';
import type { CDPConnectionOptions } from '@curupira/shared/types';
import { logger } from '../config/logger.js';

export class ChromeManager {
  private static instance: ChromeManager;
  private client: ChromeClient | null = null;
  private typedClient: TypedCDPClient | null = null;
  private config: CDPConnectionOptions | null = null;
  private activeSessions: Map<string, { sessionId: string; createdAt: Date }> = new Map();

  private constructor() {}

  static getInstance(): ChromeManager {
    if (!ChromeManager.instance) {
      ChromeManager.instance = new ChromeManager();
    }
    return ChromeManager.instance;
  }

  async initialize(config: CDPConnectionOptions): Promise<void> {
    if (this.client && this.client.isConnected()) {
      logger.warn('Chrome client already initialized');
      return;
    }

    this.config = config;
    this.client = new ChromeClient(config);
    this.typedClient = new TypedCDPClient(this.client);

    // Setup event handlers
    this.client.on('connected', (info) => {
      logger.info('Chrome connected', info);
    });

    this.client.on('disconnected', () => {
      logger.warn('Chrome disconnected');
      this.activeSessions.clear();
    });

    this.client.on('error', ({ sessionId, error }) => {
      logger.error('Chrome session error', { sessionId, error });
      this.activeSessions.delete(sessionId);
    });

    this.client.on('sessionClosed', ({ sessionId }) => {
      logger.info('Chrome session closed', { sessionId });
      this.activeSessions.delete(sessionId);
    });

    // Connect to Chrome
    await this.client.connect();
    logger.info('Chrome manager initialized');
  }

  async createSession(): Promise<string> {
    if (!this.client || !this.client.isConnected()) {
      throw new Error('Chrome not connected');
    }

    // Get the first page target or create a new one
    const targets = await this.client.getTargets();
    const pageTarget = targets.find(t => t.type === 'page');
    
    if (!pageTarget) {
      throw new Error('No page target available');
    }
    
    const session = await this.client.createSession(pageTarget.targetId);
    const sessionId = session.sessionId;
    this.activeSessions.set(sessionId, {
      sessionId,
      createdAt: new Date()
    });

    logger.info('Chrome session created', { sessionId });
    return sessionId;
  }

  async closeSession(sessionId: string): Promise<void> {
    // Sessions are auto-closed when WebSocket disconnects
    this.activeSessions.delete(sessionId);
  }

  getClient(): ChromeClient {
    if (!this.client || !this.client.isConnected()) {
      throw new Error('Chrome not connected');
    }
    return this.client;
  }

  getTypedClient(): TypedCDPClient {
    if (!this.typedClient || !this.client || !this.client.isConnected()) {
      throw new Error('Chrome not connected');
    }
    return this.typedClient;
  }

  getStatus(): {
    connected: boolean;
    serviceUrl: string | null;
    activeSessions: number;
    sessions: Array<{ sessionId: string; createdAt: Date }>;
  } {
    return {
      connected: this.client?.isConnected() || false,
      serviceUrl: this.config ? `${this.config.secure ? 'https' : 'http'}://${this.config.host}:${this.config.port}` : null,
      activeSessions: this.activeSessions.size,
      sessions: Array.from(this.activeSessions.values())
    };
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
      this.client = null;
    }
    this.activeSessions.clear();
  }
}