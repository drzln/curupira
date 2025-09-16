/**
 * Tool Provider Factory - Level 2 (MCP Core)
 * Factory pattern for creating tool providers with dependencies
 */

import type { IChromeService } from '../../core/interfaces/chrome-service.interface.js';
import type { ILogger } from '../../core/interfaces/logger.interface.js';
import type { IValidator } from '../../core/interfaces/validator.interface.js';
import type { ToolProvider } from './registry.js';

export interface ProviderDependencies {
  chromeService: IChromeService;
  logger: ILogger;
  validator: IValidator;
}

export interface IToolProviderFactory {
  /**
   * Create a tool provider instance with injected dependencies
   * @param deps The provider dependencies
   * @returns A configured tool provider instance
   */
  create(deps: ProviderDependencies): ToolProvider;
}

/**
 * Base class for tool provider factories
 * Provides common functionality for all provider factories
 */
export abstract class BaseProviderFactory<T extends ToolProvider = ToolProvider> 
  implements IToolProviderFactory {
  
  abstract create(deps: ProviderDependencies): T;

  /**
   * Helper method to create a child logger for the provider
   * @param deps The provider dependencies
   * @param providerName The name of the provider
   * @returns A child logger with provider context
   */
  protected createProviderLogger(deps: ProviderDependencies, providerName: string): ILogger {
    return deps.logger.child({ provider: providerName });
  }
}