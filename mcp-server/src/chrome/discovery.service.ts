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

  private async discoverOnPort(host: string, port: number, timeout: number, preferredPatterns: string[]): Promise<ChromeInstance[]> {
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

      // Filter for page targets and enhance with detection metadata
      return targets
        .filter(target => target.type === 'page')
        .map(target => {
          const instance: ChromeInstance = {
            id: target.id,
            type: target.type,
            url: target.url,
            title: target.title,
            description: target.description,
            webSocketDebuggerUrl: target.webSocketDebuggerUrl,
            faviconUrl: target.faviconUrl,
            host,
            port
          };

          // Enhanced React app detection
          instance.isReactApp = this.detectReactApp(instance, preferredPatterns);
          instance.isDevelopmentApp = this.detectDevelopmentApp(instance);
          instance.confidence = this.calculateConfidence(instance, preferredPatterns);

          return instance;
        });

    } catch (error) {
      this.logger.debug({ host, port, error }, 'No Chrome instance found on port');
      return [];
    }
  }

  private detectReactApp(instance: ChromeInstance, preferredPatterns: string[]): boolean {
    const title = instance.title.toLowerCase();
    const url = instance.url.toLowerCase();
    
    // Check title patterns
    const reactTitlePatterns = ['react', 'vite', 'next', 'webpack', 'development'];
    const titleMatches = reactTitlePatterns.some(pattern => title.includes(pattern));
    
    // Check URL patterns
    const reactUrlPatterns = [
      'localhost', '127.0.0.1', 
      ':3000', ':3001', ':5173', ':8080', ':4173'
    ];
    const urlMatches = reactUrlPatterns.some(pattern => url.includes(pattern));
    
    // Check preferred patterns from config
    const preferredMatches = preferredPatterns.some(pattern => 
      title.includes(pattern.toLowerCase()) || url.includes(pattern.toLowerCase())
    );
    
    return titleMatches || urlMatches || preferredMatches;
  }

  private detectDevelopmentApp(instance: ChromeInstance): boolean {
    const url = instance.url.toLowerCase();
    const title = instance.title.toLowerCase();
    
    const devPatterns = [
      'localhost', '127.0.0.1', 'dev', 'staging', 
      'development', 'local', ':3000', ':8080'
    ];
    
    return devPatterns.some(pattern => 
      url.includes(pattern) || title.includes(pattern)
    );
  }

  private calculateConfidence(instance: ChromeInstance, preferredPatterns: string[]): number {
    let confidence = 0;
    
    // Base confidence for any page
    confidence += 1;
    
    // React app indicators
    if (instance.isReactApp) confidence += 5;
    
    // Development indicators
    if (instance.isDevelopmentApp) confidence += 3;
    
    // Preferred pattern matches
    const title = instance.title.toLowerCase();
    const url = instance.url.toLowerCase();
    preferredPatterns.forEach(pattern => {
      if (title.includes(pattern.toLowerCase()) || url.includes(pattern.toLowerCase())) {
        confidence += 2;
      }
    });
    
    // URL quality indicators
    if (url.includes('localhost') || url.includes('127.0.0.1')) confidence += 2;
    if (url.includes(':3000') || url.includes(':5173')) confidence += 3; // Common React ports
    
    // Title quality indicators
    if (title && title !== 'new tab' && title !== 'about:blank') confidence += 1;
    
    return Math.min(confidence, 10); // Cap at 10
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
    
    // Use enhanced detection metadata
    const reactInstances = instances.filter(i => i.isReactApp);
    const devInstances = instances.filter(i => i.isDevelopmentApp && !i.isReactApp);
    
    if (reactInstances.length > 0) {
      const best = reactInstances[0];
      recommendations.push(`🎯 Detected ${reactInstances.length} potential React/development app(s)`);
      recommendations.push(`🚀 Recommended: Connect to instance '${best.id}' (confidence: ${best.confidence}/10)`);
      recommendations.push(`📱 App: ${best.title} (${best.url})`);
      
      if (reactInstances.length > 1) {
        recommendations.push(`💡 Other options: ${reactInstances.slice(1).map(r => `${r.id} (${r.confidence}/10)`).join(', ')}`);
      }
    } else if (devInstances.length > 0) {
      const best = devInstances[0];
      recommendations.push(`🔧 Found ${devInstances.length} development instance(s)`);
      recommendations.push(`🚀 Try: Connect to instance '${best.id}' (confidence: ${best.confidence}/10)`);
      recommendations.push(`📱 App: ${best.title} (${best.url})`);
    } else {
      const best = instances[0];
      recommendations.push(`🌐 Found ${instances.length} browser instance(s)`);
      recommendations.push(`🚀 Connect to: Instance '${best.id}' (confidence: ${best.confidence}/10)`);
      recommendations.push(`📱 Page: ${best.title} (${best.url})`);
    }
    
    recommendations.push('');
    recommendations.push('🔄 Pro tip: Refresh the page if React DevTools aren\'t detected');
    recommendations.push('🛠️  Check connection status after connecting to verify everything works');

    return recommendations;
  }

  private getTroubleshootingSteps(instances: ChromeInstance[]): string[] {
    const troubleshooting: string[] = [];

    if (instances.length === 0) {
      troubleshooting.push('🔧 Chrome not found troubleshooting:');
      troubleshooting.push('1. Verify Chrome is installed and running');
      troubleshooting.push('2. Check configured ports are accessible');
      troubleshooting.push('3. Ensure Chrome was started with debugging flags');
      troubleshooting.push('4. Check firewall settings');
      troubleshooting.push('5. Try running: ps aux | grep chrome');
    } else if (instances.filter(i => i.isReactApp).length === 0) {
      troubleshooting.push('🎯 React app optimization suggestions:');
      troubleshooting.push('1. Ensure React DevTools extension is installed');
      troubleshooting.push('2. Check if React is running in development mode');
      troubleshooting.push('3. Verify the app is using a supported React version');
      troubleshooting.push('4. Refresh the page to reinitialize React DevTools');
    }

    return troubleshooting;
  }

  async assessConnectionHealth(instance: ChromeInstance): Promise<{ score: number; status: string; issues: string[] }> {
    const issues: string[] = [];
    let score = 100;

    try {
      // Test WebSocket URL availability
      if (!instance.webSocketDebuggerUrl) {
        score -= 30;
        issues.push('No WebSocket debugger URL available');
      }

      // Test if the instance is still accessible
      const response = await fetch(`http://${instance.host}:${instance.port}/json/${instance.id}`, {
        signal: AbortSignal.timeout(this.config.timeout)
      });

      if (!response.ok) {
        score -= 50;
        issues.push('Instance no longer accessible');
      }

      // Check for development indicators
      if (!instance.isDevelopmentApp) {
        score -= 10;
        issues.push('Not detected as development environment');
      }

      // Check for React indicators
      if (!instance.isReactApp && this.config.preferredPatterns.includes('react')) {
        score -= 20;
        issues.push('React not detected (may impact debugging capabilities)');
      }

    } catch (error) {
      score -= 40;
      issues.push(`Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    let status: string;
    if (score >= 80) status = 'excellent';
    else if (score >= 60) status = 'good';
    else if (score >= 40) status = 'fair';
    else if (score >= 20) status = 'poor';
    else status = 'critical';

    return { score, status, issues };
  }
}

/**
 * Chrome Discovery Service Provider for dependency injection
 */
export const chromeDiscoveryServiceProvider = {
  provide: 'ChromeDiscoveryService',
  useFactory: (config: ChromeDiscoveryConfig, logger: ILogger) => {
    return new ChromeDiscoveryService(config, logger);
  },
  inject: ['ChromeDiscoveryConfig', 'Logger'] as const
};