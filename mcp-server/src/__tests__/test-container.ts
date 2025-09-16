/**
 * Test Container Setup - Test Infrastructure
 * Provides dependency injection container for tests
 */

import { DIContainer } from '../core/di/container.js';
import type { Container } from '../core/di/container.js';
import {
  ChromeServiceToken,
  ChromeClientToken,
  TypedCDPClientToken,
  ToolRegistryToken,
  ResourceRegistryToken,
  LoggerToken,
  ValidatorToken,
  ErrorHandlerToken,
  ChromeConfigToken,
  ServerConfigToken
} from '../core/di/tokens.js';
import { MockChromeService } from './mocks/chrome-service.mock.js';
import { MockChromeClient } from './mocks/chrome-client.mock.js';
import { MockTypedCDPClient } from './mocks/typed-cdp-client.mock.js';
import { MockToolRegistry } from './mocks/tool-registry.mock.js';
import { MockResourceRegistry } from './mocks/resource-registry.mock.js';
import { MockLogger } from './mocks/logger.mock.js';
import { MockValidator } from './mocks/validator.mock.js';
import { ErrorHandler } from '../core/error-handler.js';

export function createTestContainer(): Container {
  const container = new DIContainer();

  // Register test configuration
  container.register(ChromeConfigToken, () => ({
    host: 'localhost',
    port: 9222,
    secure: false,
    defaultTimeout: 5000
  }));

  container.register(ServerConfigToken, () => ({
    port: 3000,
    host: 'localhost',
    logLevel: 'error' as const
  }));

  // Register mock services
  container.register(LoggerToken, () => new MockLogger());
  container.register(ValidatorToken, () => new MockValidator());
  
  container.register(ErrorHandlerToken, (c) => {
    const logger = c.resolve(LoggerToken);
    return new ErrorHandler(logger);
  });

  container.register(ChromeClientToken, () => new MockChromeClient());
  container.register(TypedCDPClientToken, () => new MockTypedCDPClient());
  
  container.register(ChromeServiceToken, (c) => {
    const config = c.resolve(ChromeConfigToken);
    const logger = c.resolve(LoggerToken);
    return new MockChromeService(config, logger);
  });

  container.register(ToolRegistryToken, () => new MockToolRegistry());
  container.register(ResourceRegistryToken, () => new MockResourceRegistry());

  return container;
}

/**
 * Helper to reset all mocks in the container
 */
export function resetTestContainer(container: Container): void {
  // Get all mock services and reset them
  const services = [
    ChromeServiceToken,
    ChromeClientToken,
    TypedCDPClientToken,
    ToolRegistryToken,
    ResourceRegistryToken,
    LoggerToken,
    ValidatorToken
  ];

  services.forEach((token: any) => {
    try {
      const service = container.resolve(token) as any;
      if (service && typeof service.reset === 'function') {
        service.reset();
      }
    } catch {
      // Service might not be registered
    }
  });
}