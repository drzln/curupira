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
      this.logger.debug({ versionUrl }, 'Fetching browser version info');
      
      const response = await fetch(versionUrl, { 
        signal: AbortSignal.timeout(5000) 
      });

      if (!response.ok) {
        this.logger.error({ status: response.status, statusText: response.statusText }, 'Version fetch failed');
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

      // If detection is ambiguous, do additional endpoint check
      let confirmedBrowserless = isBrowserless;
      
      // For ambiguous cases, try Browserless-specific endpoints
      // This happens when we can't definitively determine from version info alone
      if (isBrowserless && !versionInfo['Puppeteer-Version']) {
        // Might be Browserless without clear indicators - double check
        const endpointCheck = await this.checkBrowserlessEndpoint(host, port);
        if (!endpointCheck) {
          // Endpoints say it's not Browserless, override detection
          confirmedBrowserless = false;
        }
      }
      
      return {
        isBrowserless: confirmedBrowserless,
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
    // Multiple detection strategies for robust identification
    
    // 1. Check for Browserless-specific fields
    const browserlessOnlyFields = [
      'Puppeteer-Version',  // Browserless includes this, standard Chrome doesn't
      'HeadlessChrome',     // Some Browserless versions include this
      'browserless'         // Some versions include explicit browserless field
    ];
    
    const hasBrowserlessFields = browserlessOnlyFields.some(field => 
      field in versionInfo
    );
    
    // 2. Check WebSocket URL patterns
    const wsUrl = versionInfo['webSocketDebuggerUrl'] || '';
    
    // Standard Chrome ALWAYS uses /devtools/browser/ pattern
    const hasStandardChromePattern = wsUrl.includes('/devtools/browser/');
    
    // Browserless typically uses root-level WebSocket or different patterns
    const hasBrowserlessUrlPattern = wsUrl !== '' && !hasStandardChromePattern;
    
    // 3. Check Browser field format
    const browserField = versionInfo['Browser'] || '';
    const hasBrowserlessInName = browserField.toLowerCase().includes('browserless') ||
                                  browserField.toLowerCase().includes('headless');
    
    // 4. Check for missing standard Chrome fields
    // Standard Chrome always has WebKit-Version
    const missingChromeFields = !('WebKit-Version' in versionInfo);
    
    // Log detection details for debugging
    this.logger.debug({
      hasBrowserlessFields,
      hasStandardChromePattern,
      hasBrowserlessUrlPattern,
      hasBrowserlessInName,
      missingChromeFields,
      wsUrl,
      browserField,
      fields: Object.keys(versionInfo)
    }, 'Browserless detection analysis');
    
    // Browserless if:
    // - Has Browserless-specific fields OR
    // - Has Browserless URL pattern (no /devtools/browser/) OR  
    // - Has Browserless in browser name OR
    // - Missing standard Chrome fields
    const isBrowserless = hasBrowserlessFields || 
                         hasBrowserlessUrlPattern || 
                         hasBrowserlessInName || 
                         missingChromeFields;
    
    // Double-check: if it has standard Chrome pattern, it's definitely NOT Browserless
    if (hasStandardChromePattern && !hasBrowserlessFields) {
      return false;
    }
    
    return isBrowserless;
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

  private async checkBrowserlessEndpoint(host: string, port: number): Promise<boolean> {
    try {
      // Try to access Browserless-specific endpoints
      const browserlessEndpoints = [
        '/sessions',      // Browserless session management
        '/metrics',       // Browserless metrics endpoint
        '/pressure',      // Browserless pressure API
      ];

      for (const endpoint of browserlessEndpoints) {
        try {
          const response = await fetch(`http://${host}:${port}${endpoint}`, {
            method: 'GET',
            signal: AbortSignal.timeout(1000) // Quick timeout
          });
          
          // If any Browserless endpoint responds with 200, it's Browserless
          if (response.ok) {
            this.logger.debug({ endpoint }, 'Browserless endpoint responded - confirmed Browserless');
            return true;
          }
        } catch {
          // Endpoint not available, continue checking
        }
      }

      // None of the Browserless endpoints responded
      this.logger.debug('No Browserless endpoints responded - likely standard Chrome');
      return false;
    } catch (error) {
      this.logger.warn({ error }, 'Failed to check Browserless endpoints, assuming standard Chrome');
      return false;
    }
  }
}