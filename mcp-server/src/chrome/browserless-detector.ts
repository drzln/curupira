/**
 * Browserless Detection Service - Level 1 (Chrome Core)
 * Detects whether a Chrome instance is Browserless or standard Chrome DevTools
 */

import type { ILogger } from '../core/interfaces/logger.interface.js';

export interface BrowserInfo {
  isBrowserless: boolean;
  version: string;
  webSocketUrl?: string;
  puppeteerVersion?: string;
  features: string[];
}

export interface IBrowserlessDetector {
  detect(host: string, port: number): Promise<BrowserInfo>;
}

export class BrowserlessDetector implements IBrowserlessDetector {
  constructor(private readonly logger: ILogger) {}

  async detect(host: string, port: number): Promise<BrowserInfo> {
    try {
      const versionUrl = `http://${host}:${port}/json/version`;
      const response = await fetch(versionUrl, { 
        signal: AbortSignal.timeout(5000) 
      });

      if (!response.ok) {
        throw new Error(`Failed to get version info: ${response.statusText}`);
      }

      const versionInfo: any = await response.json();
      
      // Detect Browserless by checking for specific fields
      const isBrowserless = this.isBrowserlessResponse(versionInfo);
      
      this.logger.info({ 
        host, 
        port, 
        isBrowserless,
        versionInfo 
      }, 'Browser type detected');

      return {
        isBrowserless,
        version: versionInfo['Browser'] || versionInfo['Browser-Version'] || 'unknown',
        webSocketUrl: versionInfo['webSocketDebuggerUrl'],
        puppeteerVersion: versionInfo['Puppeteer-Version'],
        features: this.detectFeatures(versionInfo)
      };
    } catch (error) {
      this.logger.error({ error, host, port }, 'Failed to detect browser type');
      throw error;
    }
  }

  private isBrowserlessResponse(versionInfo: any): boolean {
    // Browserless specific indicators
    const browserlessIndicators = [
      'Puppeteer-Version',
      'webSocketDebuggerUrl' // Browserless provides this at root level
    ];

    // Check if any Browserless-specific fields are present
    const hasBrowserlessFields = browserlessIndicators.some(field => 
      field in versionInfo
    );

    // Check if the webSocketDebuggerUrl contains typical Browserless patterns
    const wsUrl = versionInfo['webSocketDebuggerUrl'] || '';
    const hasBrowserlessUrl = wsUrl.includes('ws://') && !wsUrl.includes('/devtools/browser/');

    return hasBrowserlessFields || hasBrowserlessUrl;
  }

  private detectFeatures(versionInfo: any): string[] {
    const features: string[] = [];

    if (versionInfo['Puppeteer-Version']) {
      features.push('puppeteer');
    }

    if (versionInfo['Protocol-Version']) {
      features.push(`cdp-${versionInfo['Protocol-Version']}`);
    }

    if (versionInfo['V8-Version']) {
      features.push('v8-debugging');
    }

    // Browserless specific features
    if (this.isBrowserlessResponse(versionInfo)) {
      features.push('browserless');
      features.push('session-management');
      features.push('concurrent-sessions');
    } else {
      features.push('chrome-devtools');
    }

    return features;
  }
}