/**
 * ChromeManager Shim - Temporary compatibility layer
 * This file provides backward compatibility for old providers that still use ChromeManager
 * TODO: Remove this file once all providers are migrated to DI
 */

import { logger } from '../config/logger.js';

/**
 * @deprecated Use ChromeService through dependency injection instead
 */
export class ChromeManager {
  private static instance: ChromeManager;
  
  private constructor() {
    logger.warn('ChromeManager singleton is deprecated. Use ChromeService through DI instead.');
  }
  
  static getInstance(): ChromeManager {
    if (!ChromeManager.instance) {
      ChromeManager.instance = new ChromeManager();
    }
    return ChromeManager.instance;
  }
  
  getClient(): any {
    throw new Error('ChromeManager.getClient() is deprecated. Use ChromeService through DI.');
  }
  
  getStatus(): any {
    return {
      connected: false,
      serviceUrl: null,
      activeSessions: 0,
      sessions: []
    };
  }
  
  async connect(): Promise<void> {
    throw new Error('ChromeManager.connect() is deprecated. Use ChromeService through DI.');
  }
  
  async disconnect(): Promise<void> {
    throw new Error('ChromeManager.disconnect() is deprecated. Use ChromeService through DI.');
  }
}