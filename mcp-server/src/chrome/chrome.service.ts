/**
 * Chrome Service - Level 1 (Chrome Core)
 * Service for managing Chrome browser connections with dependency injection
 */

import type { IChromeService } from '../core/interfaces/chrome-service.interface.js';
import type { IChromeClient, ConnectionOptions } from './interfaces.js';
import type { ILogger } from '../core/interfaces/logger.interface.js';
import type { ChromeConfig } from '../core/di/tokens.js';
import { ChromeClient } from './client.js';

export class ChromeService implements IChromeService {
  private client: IChromeClient | null = null;

  constructor(
    private readonly config: ChromeConfig,
    private readonly logger: ILogger
  ) {}

  async connect(options: ConnectionOptions): Promise<IChromeClient> {
    // Disconnect existing client if any
    if (this.client) {
      await this.disconnect();
    }

    // Create new client with injected dependencies
    const client = new ChromeClient(this.logger);
    
    // Merge options with config defaults
    const connectionOptions: ConnectionOptions = {
      host: options.host ?? this.config.host,
      port: options.port ?? this.config.port,
      secure: options.secure ?? this.config.secure
    };

    await client.connect(connectionOptions);
    this.client = client;

    this.logger.info(
      { host: connectionOptions.host, port: connectionOptions.port },
      'Connected to Chrome'
    );

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
      await this.client.disconnect();
      this.client = null;
      this.logger.info('Disconnected from Chrome');
    }
  }
}

/**
 * Chrome Service Provider for dependency injection
 */
export const chromeServiceProvider = {
  provide: 'ChromeService',
  useFactory: (config: ChromeConfig, logger: ILogger) => {
    return new ChromeService(config, logger);
  },
  inject: ['ChromeConfig', 'Logger'] as const
};