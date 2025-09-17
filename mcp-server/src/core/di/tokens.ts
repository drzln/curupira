/**
 * Dependency Injection Tokens - Level 0 (Foundation)
 * Central registry of all DI tokens used in the application
 */

import { createToken } from './container.js';
import type { IChromeService } from '../interfaces/chrome-service.interface.js';
import type { IToolRegistry } from '../interfaces/tool-registry.interface.js';
import type { IResourceRegistry } from '../interfaces/resource-registry.interface.js';
import type { ILogger } from '../interfaces/logger.interface.js';
import type { IValidator } from '../interfaces/validator.interface.js';
import type { ITypedCDPClient } from '../../chrome/interfaces.js';
import type { IChromeClient } from '../../chrome/interfaces.js';
import type { ErrorHandler } from '../error-handler.js';
import type { IChromeDiscoveryService } from '../../chrome/discovery.service.js';

// Chrome-related tokens
export const ChromeServiceToken = createToken<IChromeService>('ChromeService');
export const ChromeClientToken = createToken<IChromeClient>('ChromeClient');
export const TypedCDPClientToken = createToken<ITypedCDPClient>('TypedCDPClient');
export const ChromeDiscoveryServiceToken = createToken<IChromeDiscoveryService>('ChromeDiscoveryService');

// MCP-related tokens
export const ToolRegistryToken = createToken<IToolRegistry>('ToolRegistry');
export const ResourceRegistryToken = createToken<IResourceRegistry>('ResourceRegistry');

// Infrastructure tokens
export const LoggerToken = createToken<ILogger>('Logger');
export const ValidatorToken = createToken<IValidator>('Validator');
export const ErrorHandlerToken = createToken<ErrorHandler>('ErrorHandler');

// Configuration tokens
export const ChromeConfigToken = createToken<ChromeConfig>('ChromeConfig');
export const ChromeDiscoveryConfigToken = createToken<ChromeDiscoveryConfig>('ChromeDiscoveryConfig');
export const ServerConfigToken = createToken<ServerConfig>('ServerConfig');

// Interfaces for configuration
export interface ChromeConfig {
  host: string;
  port: number;
  secure: boolean;
  defaultTimeout: number;
}

export interface ChromeDiscoveryConfig {
  enabled: boolean;
  hosts: string[];
  ports: number[];
  timeout: number;
  autoConnect: boolean;
  preferredPatterns: string[];
}

export interface ServerConfig {
  port: number;
  host: string;
  transport?: 'stdio' | 'http' | 'sse';
  logLevel: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  name?: string;
  version?: string;
  environment?: 'development' | 'staging' | 'production';
  healthCheck?: boolean;
  healthCheckPath?: string;
  healthCheckInterval?: number;
  mcp?: {
    websocket?: {
      enabled: boolean;
      path: string;
      enablePing?: boolean;
      pingInterval?: number;
      pongTimeout?: number;
    };
    http?: {
      enabled: boolean;
      httpPath: string;
      ssePath: string;
      sseEnabled: boolean;
      timeout?: number;
      keepAliveInterval?: number;
    };
  };
}