/**
 * Chrome Tool Provider Factory - Level 2 (MCP Core)
 * Factory implementation for Chrome tool provider
 */

import type { IToolProviderFactory, ProviderDependencies } from '../provider.factory.js';
import { BaseProviderFactory } from '../provider.factory.js';
import type { BaseToolProviderConfig } from '../base-tool-provider.js';
import { BaseToolProvider } from '../base-tool-provider.js';
import type { Schema } from '../../../core/interfaces/validator.interface.js';
import type { ToolResult } from '../registry.js';
import type { IChromeDiscoveryService } from '../../../chrome/discovery.service.js';

// Schema definitions - Enhanced from archived chrome-tools.ts
const discoverSchema: Schema<{ hosts?: string[]; ports?: number[]; timeout?: number }> = {
  parse: (value) => {
    const obj = (value || {}) as any;
    return {
      hosts: Array.isArray(obj.hosts) ? obj.hosts.filter((h: any) => typeof h === 'string') : undefined,
      ports: Array.isArray(obj.ports) ? obj.ports.filter((p: any) => typeof p === 'number') : undefined,
      timeout: typeof obj.timeout === 'number' ? obj.timeout : undefined
    };
  },
  safeParse: (value) => {
    try {
      return { success: true, data: discoverSchema.parse(value) };
    } catch (error) {
      return { success: false, error };
    }
  }
};

const connectSchema: Schema<{ instanceId: string; host?: string; port?: number }> = {
  parse: (value) => {
    if (typeof value !== 'object' || value === null) {
      throw new Error('Expected object');
    }
    const obj = value as any;
    if (typeof obj.instanceId !== 'string') {
      throw new Error('instanceId must be a string');
    }
    return {
      instanceId: obj.instanceId,
      host: typeof obj.host === 'string' ? obj.host : 'localhost',
      port: typeof obj.port === 'number' ? obj.port : 9222
    };
  },
  safeParse: (value) => {
    try {
      return { success: true, data: connectSchema.parse(value) };
    } catch (error) {
      return { success: false, error };
    }
  }
};

class ChromeToolProvider extends BaseToolProvider {
  private discoveryService: IChromeDiscoveryService;

  constructor(
    chromeService: any,
    logger: any,
    validator: any,
    config: any,
    discoveryService: IChromeDiscoveryService
  ) {
    super(chromeService, logger, validator, config);
    this.discoveryService = discoveryService;
  }

  protected initializeTools(): void {
    // Note: Chrome connection tools (chrome_discover, chrome_connect, chrome_disconnect, chrome_status)
    // are provided by chrome-connection provider to avoid conflicts and session creation issues.
    // This provider focuses on Chrome operations that require an active connection.
    
    // TODO: Add Chrome operation tools here that require an active connection
    // Examples: chrome_evaluate, chrome_navigate, chrome_screenshot, etc.
  }
}

// Extended provider dependencies to include discovery service
interface ChromeProviderDependencies extends ProviderDependencies {
  chromeDiscoveryService: IChromeDiscoveryService;
}

export class ChromeToolProviderFactory extends BaseProviderFactory<ChromeToolProvider> {
  create(deps: ChromeProviderDependencies): ChromeToolProvider {
    const config: BaseToolProviderConfig = {
      name: 'chrome',
      description: 'Chrome discovery and connection management tools with enhanced React app detection'
    };

    return new ChromeToolProvider(
      deps.chromeService,
      this.createProviderLogger(deps, config.name),
      deps.validator,
      config,
      deps.chromeDiscoveryService
    );
  }
}