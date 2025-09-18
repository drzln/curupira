/**
 * Mock Chrome Service - Test Infrastructure
 * Mock implementation of IChromeService for testing
 */

import type { IChromeService } from '../../core/interfaces/chrome-service.interface.js';
import type { IChromeClient, ConnectionOptions } from '../../chrome/interfaces.js';
import type { ILogger } from '../../core/interfaces/logger.interface.js';
import type { ChromeConfig } from '../../core/di/tokens.js';
import { MockChromeClient } from './chrome-client.mock.js';

export class MockChromeService implements IChromeService {
  private mockClient: MockChromeClient;
  private connected = false;

  constructor(
    private readonly config: ChromeConfig,
    private readonly logger: ILogger
  ) {
    this.mockClient = new MockChromeClient();
  }

  async connect(options: ConnectionOptions): Promise<IChromeClient> {
    this.connected = true;
    this.logger.info({ options }, 'Mock Chrome connected');
    
    // Simulate connection
    await this.mockClient.connect();
    
    return this.mockClient;
  }

  getCurrentClient(): IChromeClient | null {
    return this.connected ? this.mockClient : null;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    await this.mockClient.disconnect();
    this.logger.info('Mock Chrome disconnected');
  }

  async enableConsoleMonitoring(sessionId: string): Promise<void> {
    this.logger.info({ sessionId }, 'Mock console monitoring enabled');
  }

  async getDefaultSessionId(): Promise<string | null> {
    return this.connected ? 'mock-session-id' : null;
  }

  // Test helper methods
  simulateConnection(): void {
    this.connected = true;
    this.mockClient.simulateConnection();
  }

  simulateDisconnection(): void {
    this.connected = false;
  }

  getMockClient(): MockChromeClient {
    return this.mockClient;
  }

  reset(): void {
    this.connected = false;
    this.mockClient.reset();
  }
}