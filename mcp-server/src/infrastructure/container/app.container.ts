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
  ServerConfigToken,
  ConsoleBufferServiceToken,
  NetworkBufferServiceToken,
  MinIOServiceToken
} from '../../core/di/tokens.js';

// Service implementations
import { ChromeService } from '../../chrome/chrome.service.js';
import { ChromeDiscoveryService } from '../../chrome/discovery.service.js';
import { ConsoleBufferService } from '../../chrome/services/console-buffer.service.js';
import { NetworkBufferService } from '../../chrome/services/network-buffer.service.js';
import { MinIOService } from '../storage/minio.service.js';
import { ToolRegistry } from '../../mcp/tools/registry.js';
import { ResourceRegistry } from '../../mcp/resources/registry.js';
import { PinoLoggerAdapter } from '../logger/pino-logger.js';
import { ValidatorService } from '../validation/validator.service.js';
import { ErrorHandler } from '../../core/error-handler.js';
import type { IResourceRegistry } from '../../core/interfaces/resource-registry.interface.js';

// Provider factories
import { CDPToolProviderFactory } from '../../mcp/tools/providers/cdp-tools.factory.js';
// ChromeToolProviderFactory removed - using chrome-connection provider for Chrome tools
import { ChromeConnectionToolProviderFactory } from '../../mcp/tools/providers/chrome-connection-tools.factory.js';
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

// Configuration loader
import { loadConfig, CurupiraConfig } from '../../config/nexus-config.js';

// Store configuration globally
let globalConfig: CurupiraConfig | null = null;

export async function initializeConfiguration(configPath?: string): Promise<CurupiraConfig> {
  if (configPath) {
    // If a config path is provided, use it
    process.env.CURUPIRA_CONFIG_PATH = configPath;
  }
  globalConfig = await loadConfig();
  return globalConfig;
}

export function createApplicationContainer(): Container {
  const container = new DIContainer();

  // Register configuration from loaded YAML config
  container.register(ChromeConfigToken, () => {
    if (!globalConfig) {
      // Fallback to environment variables if config not loaded
      return {
        host: process.env.CHROME_HOST || 'localhost',
        port: parseInt(process.env.CHROME_PORT || '3000', 10),
        secure: process.env.CHROME_SECURE === 'true',
        defaultTimeout: parseInt(process.env.CHROME_TIMEOUT || '30000', 10)
      };
    }
    
    // Parse Chrome service URL if provided
    let host = globalConfig.chrome.serviceUrl;
    let port = 3000;
    let secure = false;
    
    try {
      const url = new URL(globalConfig.chrome.serviceUrl);
      host = url.hostname;
      port = url.port ? parseInt(url.port) : (url.protocol === 'https:' ? 443 : 80);
      secure = url.protocol === 'https:';
    } catch {
      // If not a valid URL, use as host
      host = globalConfig.chrome.serviceUrl;
    }
    
    return {
      host,
      port,
      secure,
      defaultTimeout: globalConfig.chrome.connectTimeout
    };
  });

  container.register(ChromeDiscoveryConfigToken, () => {
    if (!globalConfig) {
      // Fallback to environment variables if config not loaded
      return {
        enabled: process.env.CHROME_DISCOVERY_ENABLED !== 'false',
        hosts: (process.env.CHROME_DISCOVERY_HOSTS || 'localhost').split(','),
        ports: (process.env.CHROME_DISCOVERY_PORTS || '3000').split(',').map(p => parseInt(p, 10)),
        timeout: parseInt(process.env.CHROME_DISCOVERY_TIMEOUT || '5000', 10),
        autoConnect: process.env.CHROME_DISCOVERY_AUTO_CONNECT === 'true',
        preferredPatterns: (process.env.CHROME_DISCOVERY_PATTERNS || 'localhost,react,vite,next').split(',')
      };
    }
    
    return {
      enabled: globalConfig.chrome.discovery.enabled,
      hosts: globalConfig.chrome.discovery.hosts,
      ports: globalConfig.chrome.discovery.ports,
      timeout: globalConfig.chrome.discovery.timeout,
      autoConnect: globalConfig.chrome.discovery.autoConnect,
      preferredPatterns: globalConfig.chrome.discovery.preferredPatterns
    };
  });

  container.register(ServerConfigToken, () => {
    if (!globalConfig) {
      // Fallback to environment variables if config not loaded
      return {
        port: parseInt(process.env.PORT || '3000', 10),
        host: process.env.HOST || '0.0.0.0',
        logLevel: (process.env.LOG_LEVEL || 'info') as any
      };
    }
    
    return {
      port: globalConfig.server.port,
      host: globalConfig.server.host,
      logLevel: globalConfig.logging.level,
      name: globalConfig.server.name,
      version: globalConfig.server.version,
      environment: globalConfig.server.environment,
      healthCheck: globalConfig.healthCheck.enabled,
      healthCheckPath: globalConfig.healthCheck.path,
      healthCheckInterval: globalConfig.healthCheck.interval
    };
  });

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

  // Register Chrome services
  container.register(ChromeServiceToken, (c) => {
    const config = c.resolve(ChromeConfigToken);
    const logger = c.resolve(LoggerToken);
    const consoleBufferService = c.resolve(ConsoleBufferServiceToken);
    const networkBufferService = c.resolve(NetworkBufferServiceToken);
    return new ChromeService(config, logger, consoleBufferService, networkBufferService);
  });

  container.register(ChromeDiscoveryServiceToken, (c) => {
    const config = c.resolve(ChromeDiscoveryConfigToken);
    const logger = c.resolve(LoggerToken);
    return new ChromeDiscoveryService(config, logger);
  });

  // Register console buffer service
  container.register(ConsoleBufferServiceToken, (c) => {
    const logger = c.resolve(LoggerToken);
    return new ConsoleBufferService(logger);
  });

  // Register network buffer service
  container.register(NetworkBufferServiceToken, (c) => {
    const logger = c.resolve(LoggerToken);
    return new NetworkBufferService(logger);
  });

  // Register MinIO service (if enabled)
  container.register(MinIOServiceToken, (c) => {
    const logger = c.resolve(LoggerToken);
    const config = globalConfig;
    
    if (!config || !config.storage?.minio?.enabled) {
      return null;
    }
    
    return new MinIOService(config.storage.minio, logger);
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
  const chromeService = container.resolve(ChromeServiceToken);
  const minioService = container.resolve(MinIOServiceToken);
  const providerDeps = {
    chromeService,
    logger: container.resolve(LoggerToken),
    validator: container.resolve(ValidatorToken),
    consoleBufferService: container.resolve(ConsoleBufferServiceToken),
    networkBufferService: container.resolve(NetworkBufferServiceToken),
    minioService
  };

  // Special deps for Chrome tools that need discovery service
  const chromeProviderDeps = {
    ...providerDeps,
    chromeDiscoveryService: container.resolve(ChromeDiscoveryServiceToken)
  };

  // Register Chrome connection tools (always available)
  const chromeConnectionFactory = new ChromeConnectionToolProviderFactory();
  const chromeConnectionProvider = chromeConnectionFactory.create(chromeProviderDeps);
  toolRegistry.register(chromeConnectionProvider); // Not dynamic

  // WORKAROUND: Register all tools statically due to Claude Code dynamic tool limitation
  // Previously we registered these dynamically on Chrome connection, but Claude Code
  // doesn't update its tool list after the initial MCP connection
  const allToolFactories = [
    new CDPToolProviderFactory(),
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

  // Register all providers statically at startup
  for (const factory of allToolFactories) {
    const provider = factory.create(providerDeps);
    toolRegistry.register(provider); // Static registration - available immediately
  }
  
  // Note: Tools will now check Chrome connection status internally
  // This ensures they're visible in Claude Code from the start
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