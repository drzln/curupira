/**
 * Application Container - Infrastructure Layer
 * Main dependency injection container for the application
 */

import { DIContainer } from '../../core/di/container.js';
import type { Container } from '../../core/di/container.js';
import {
  ChromeServiceToken,
  ChromeDiscoveryServiceToken,
  ToolRegistryToken,
  ResourceRegistryToken,
  LoggerToken,
  ValidatorToken,
  ErrorHandlerToken,
  ChromeConfigToken,
  ChromeDiscoveryConfigToken,
  ServerConfigToken
} from '../../core/di/tokens.js';

// Service implementations
import { ChromeService } from '../../chrome/chrome.service.js';
import { ChromeDiscoveryService } from '../../chrome/discovery.service.js';
import { ToolRegistry } from '../../mcp/tools/registry.js';
import { ResourceRegistry } from '../../mcp/resources/registry.js';
import { PinoLoggerAdapter } from '../logger/pino-logger.js';
import { ValidatorService } from '../validation/validator.service.js';
import { ErrorHandler } from '../../core/error-handler.js';
import type { IResourceRegistry } from '../../core/interfaces/resource-registry.interface.js';

// Provider factories
import { CDPToolProviderFactory } from '../../mcp/tools/providers/cdp-tools.factory.js';
import { ChromeToolProviderFactory } from '../../mcp/tools/providers/chrome-tools.factory.js';
import { ReactToolProviderFactory } from '../../mcp/tools/providers/react-tools.factory.js';
import { ConsoleToolProviderFactory } from '../../mcp/tools/providers/console-tools.factory.js';
import { DebuggerToolProviderFactory } from '../../mcp/tools/providers/debugger-tools.factory.js';
import { DOMToolProviderFactory } from '../../mcp/tools/providers/dom-tools.factory.js';
import { NetworkToolProviderFactory } from '../../mcp/tools/providers/network-tools.factory.js';
import { PerformanceToolProviderFactory } from '../../mcp/tools/providers/performance-tools.factory.js';
import { FrameworkToolProviderFactory } from '../../mcp/tools/providers/framework-tools.factory.js';
import { NavigationToolProviderFactory } from '../../mcp/tools/providers/navigation-tools.factory.js';
import { ScreenshotToolProviderFactory } from '../../mcp/tools/providers/screenshot-tools.factory.js';
import { SecurityToolProviderFactory } from '../../mcp/tools/providers/security-tools.factory.js';
import { StorageToolProviderFactory } from '../../mcp/tools/providers/storage-tools.factory.js';

// Resource provider factories
import { createBrowserResourceProvider } from '../../mcp/resources/browser.js';
import { createDOMResourceProvider } from '../../mcp/resources/dom.js';
import { createNetworkResourceProvider } from '../../mcp/resources/network.js';
import { createStateResourceProvider } from '../../mcp/resources/state.js';

export function createApplicationContainer(): Container {
  const container = new DIContainer();

  // Register configuration
  container.register(ChromeConfigToken, () => ({
    host: process.env.CHROME_HOST || 'localhost',
    port: parseInt(process.env.CHROME_PORT || '9222', 10),
    secure: process.env.CHROME_SECURE === 'true',
    defaultTimeout: parseInt(process.env.CHROME_TIMEOUT || '30000', 10)
  }));

  container.register(ChromeDiscoveryConfigToken, () => ({
    enabled: process.env.CHROME_DISCOVERY_ENABLED !== 'false',
    hosts: (process.env.CHROME_DISCOVERY_HOSTS || 'localhost').split(','),
    ports: (process.env.CHROME_DISCOVERY_PORTS || '9222,9223,9224,9225,9226').split(',').map(p => parseInt(p, 10)),
    timeout: parseInt(process.env.CHROME_DISCOVERY_TIMEOUT || '5000', 10),
    autoConnect: process.env.CHROME_DISCOVERY_AUTO_CONNECT === 'true',
    preferredPatterns: (process.env.CHROME_DISCOVERY_PATTERNS || 'localhost,react,vite,next').split(',')
  }));

  container.register(ServerConfigToken, () => ({
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0',
    logLevel: (process.env.LOG_LEVEL || 'info') as any
  }));

  // Register core services
  container.register(LoggerToken, (c) => {
    const config = c.resolve(ServerConfigToken);
    return new PinoLoggerAdapter({ level: config.logLevel });
  });

  container.register(ValidatorToken, (c) => {
    const logger = c.resolve(LoggerToken);
    return new ValidatorService(logger);
  });

  container.register(ErrorHandlerToken, (c) => {
    const logger = c.resolve(LoggerToken);
    return new ErrorHandler(logger);
  });

  // Register Chrome service
  container.register(ChromeServiceToken, (c) => {
    const config = c.resolve(ChromeConfigToken);
    const logger = c.resolve(LoggerToken);
    return new ChromeService(config, logger);
  });

  // Register registries
  container.register(ToolRegistryToken, () => new ToolRegistry());
  container.register(ResourceRegistryToken, () => new ResourceRegistry() as IResourceRegistry);

  return container;
}

/**
 * Register all tool providers in the container
 */
export function registerToolProviders(container: Container): void {
  const toolRegistry = container.resolve(ToolRegistryToken);
  const providerDeps = {
    chromeService: container.resolve(ChromeServiceToken),
    logger: container.resolve(LoggerToken),
    validator: container.resolve(ValidatorToken)
  };

  // Register all tool provider factories
  const factories = [
    new CDPToolProviderFactory(),
    new ChromeToolProviderFactory(),
    new ReactToolProviderFactory(),
    new ConsoleToolProviderFactory(),
    new DebuggerToolProviderFactory(),
    new DOMToolProviderFactory(),
    new NetworkToolProviderFactory(),
    new PerformanceToolProviderFactory(),
    new FrameworkToolProviderFactory(),
    new NavigationToolProviderFactory(),
    new ScreenshotToolProviderFactory(),
    new SecurityToolProviderFactory(),
    new StorageToolProviderFactory()
  ];

  // Create and register each provider
  for (const factory of factories) {
    const provider = factory.create(providerDeps);
    toolRegistry.register(provider);
  }
}

/**
 * Register all resource providers in the container
 */
export function registerResourceProviders(container: Container): void {
  const resourceRegistry = container.resolve(ResourceRegistryToken);
  const providerDeps = {
    chromeService: container.resolve(ChromeServiceToken),
    logger: container.resolve(LoggerToken)
  };

  // Create and register resource providers
  const browserProvider = createBrowserResourceProvider(
    providerDeps.chromeService,
    providerDeps.logger
  );
  
  const domProvider = createDOMResourceProvider(
    providerDeps.chromeService,
    providerDeps.logger
  );
  
  const networkProvider = createNetworkResourceProvider(
    providerDeps.chromeService,
    providerDeps.logger
  );
  
  const stateProvider = createStateResourceProvider(
    providerDeps.chromeService,
    providerDeps.logger
  );

  // Register providers with the registry
  resourceRegistry.register(browserProvider);
  resourceRegistry.register(domProvider);
  resourceRegistry.register(networkProvider);
  resourceRegistry.register(stateProvider);
}