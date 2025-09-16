/**
 * Chrome Discovery Service - Level 1 (Chrome Core)
 * Service for discovering available Chrome browsers with debugging enabled
 * Extracts sophisticated discovery logic from archived chrome-tools.ts
 */

import type { ILogger } from '../core/interfaces/logger.interface.js';

export interface ChromeInstance {
  id: string;
  type: string;
  url: string;
  title: string;
  description?: string;
  webSocketDebuggerUrl?: string;
  faviconUrl?: string;
  host: string;
  port: number;
  // Enhanced metadata for smart recommendations
  isReactApp?: boolean;
  isDevelopmentApp?: boolean;
  confidence?: number;
}

export interface ChromeDiscoveryResult {
  instances: ChromeInstance[];
  totalFound: number;
  recommendations: string[];
  troubleshooting?: string[];
}

export interface DiscoveryOptions {
  hosts?: string[];
  ports?: number[];
  timeout?: number;
  preferredPatterns?: string[];
}

export interface ChromeDiscoveryConfig {
  enabled: boolean;
  hosts: string[];
  ports: number[];
  timeout: number;
  autoConnect: boolean;
  preferredPatterns: string[];
}

export interface IChromeDiscoveryService {
  discoverInstances(options?: DiscoveryOptions): Promise<ChromeDiscoveryResult>;
  isPortAvailable(host: string, port: number): Promise<boolean>;
  getRecommendations(instances: ChromeInstance[]): string[];
  assessConnectionHealth(instance: ChromeInstance): Promise<{ score: number; status: string; issues: string[] }>;
}

export class ChromeDiscoveryService implements IChromeDiscoveryService {
  constructor(
    private readonly config: ChromeDiscoveryConfig,
    private readonly logger: ILogger
  ) {}

  async discoverInstances(options: DiscoveryOptions = {}): Promise<ChromeDiscoveryResult> {
    const hosts = options.hosts || this.config.hosts;
    const ports = options.ports || this.config.ports;
    const timeout = options.timeout || this.config.timeout;
    const preferredPatterns = options.preferredPatterns || this.config.preferredPatterns;

    this.logger.info({ hosts, ports }, 'Discovering Chrome instances with enhanced detection');

    const instances: ChromeInstance[] = [];
    const discoveryPromises: Promise<ChromeInstance[]>[] = [];
    
    // Multi-host, multi-port discovery
    for (const host of hosts) {
      for (const port of ports) {
        discoveryPromises.push(this.discoverOnPort(host, port, timeout, preferredPatterns));
      }
    }
    
    const results = await Promise.allSettled(discoveryPromises);
    
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        instances.push(...result.value);
      }
    }

    // Sort instances by confidence (React apps first, dev apps second)
    instances.sort((a, b) => {
      const aScore = (a.confidence || 0) + (a.isReactApp ? 10 : 0) + (a.isDevelopmentApp ? 5 : 0);
      const bScore = (b.confidence || 0) + (b.isReactApp ? 10 : 0) + (b.isDevelopmentApp ? 5 : 0);
      return bScore - aScore;
    });

    const recommendations = this.getRecommendations(instances);
    const troubleshooting = this.getTroubleshootingSteps(instances);

    return {
      instances,
      totalFound: instances.length,
      recommendations,
      troubleshooting
    };
  }

  async isPortAvailable(host: string, port: number): Promise<boolean> {
    try {
      const response = await fetch(`http://${host}:${port}/json/version`, {
        signal: AbortSignal.timeout(this.defaultTimeout)
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  private async discoverOnPort(host: string, port: number, timeout: number): Promise<ChromeInstance[]> {
    try {
      const baseUrl = `http://${host}:${port}`;
      
      // First check if the port responds
      const versionResponse = await fetch(`${baseUrl}/json/version`, {
        signal: AbortSignal.timeout(timeout)
      });
      
      if (!versionResponse.ok) {
        return [];
      }

      // Get list of targets/tabs
      const targetsResponse = await fetch(`${baseUrl}/json`, {
        signal: AbortSignal.timeout(timeout)
      });

      if (!targetsResponse.ok) {
        return [];
      }

      const targets = await targetsResponse.json() as Array<{
        id: string;
        type: string;
        title: string;
        url: string;
        description?: string;
        webSocketDebuggerUrl?: string;
        faviconUrl?: string;
      }>;

      // Filter for page targets only
      return targets
        .filter(target => target.type === 'page')
        .map(target => ({
          id: target.id,
          type: target.type,
          url: target.url,
          title: target.title,
          description: target.description,
          webSocketDebuggerUrl: target.webSocketDebuggerUrl,
          faviconUrl: target.faviconUrl,
          host,
          port
        }));

    } catch (error) {
      this.logger.debug({ host, port, error }, 'No Chrome instance found on port');
      return [];
    }
  }

  getRecommendations(instances: ChromeInstance[]): string[] {
    const recommendations: string[] = [];

    if (instances.length === 0) {
      recommendations.push('🔍 No Chrome instances found. Let me help you start Chrome properly:');
      recommendations.push('');
      recommendations.push('📋 Option 1 - Basic Chrome with debugging:');
      recommendations.push('  google-chrome --remote-debugging-port=9222 --disable-features=VizDisplayCompositor');
      recommendations.push('');
      recommendations.push('📋 Option 2 - Chrome for development (recommended):');
      recommendations.push('  google-chrome --remote-debugging-port=9222 --disable-web-security --disable-features=VizDisplayCompositor --user-data-dir=/tmp/chrome-debug');
      recommendations.push('');
      recommendations.push('📋 Option 3 - Headless Chrome:');
      recommendations.push('  google-chrome --headless --remote-debugging-port=9222 --disable-gpu --no-sandbox');
      recommendations.push('');
      recommendations.push('💡 After starting Chrome, try connecting again');
      recommendations.push('⚠️  If issues persist, try different ports: 9223, 9224, or 9225');
      return recommendations;
    }

    recommendations.push(`✅ Found ${instances.length} Chrome instance(s) ready for debugging`);
    
    // Enhanced React app detection
    const reactInstances = instances.filter(i => {
      const title = i.title.toLowerCase();
      const url = i.url.toLowerCase();
      
      return title.includes('react') || 
             title.includes('vite') ||
             title.includes('next') ||
             title.includes('webpack') ||
             url.includes('localhost') ||
             url.includes('127.0.0.1') ||
             url.includes(':3000') ||
             url.includes(':3001') ||
             url.includes(':5173') ||
             url.includes(':8080');
    });
    
    const devInstances = instances.filter(i => {
      const url = i.url.toLowerCase();
      return url.includes('localhost') || url.includes('127.0.0.1') || url.includes('dev');
    });
    
    if (reactInstances.length > 0) {
      recommendations.push(`🎯 Detected ${reactInstances.length} potential React/development app(s)`);
      recommendations.push(`🚀 Recommended: Connect to instance '${reactInstances[0].id}'`);
      recommendations.push(`📱 App: ${reactInstances[0].title} (${reactInstances[0].url})`);
      
      if (reactInstances.length > 1) {
        recommendations.push(`💡 Other options: ${reactInstances.slice(1).map(r => r.id).join(', ')}`);
      }
    } else if (devInstances.length > 0) {
      recommendations.push(`🔧 Found ${devInstances.length} development instance(s)`);
      recommendations.push(`🚀 Try: Connect to instance '${devInstances[0].id}'`);
    } else {
      recommendations.push(`🌐 Found ${instances.length} browser instance(s)`);
      recommendations.push(`🚀 Connect to: Instance '${instances[0].id}'`);
    }
    
    recommendations.push('');
    recommendations.push('🔄 Pro tip: Refresh the page if React DevTools aren\'t detected');
    recommendations.push('🛠️  Check connection status after connecting to verify everything works');

    return recommendations;
  }
}

/**
 * Chrome Discovery Service Provider for dependency injection
 */
export const chromeDiscoveryServiceProvider = {
  provide: 'ChromeDiscoveryService',
  useFactory: (logger: ILogger) => {
    return new ChromeDiscoveryService(logger);
  },
  inject: ['Logger'] as const
};