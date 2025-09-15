/**
 * Connectivity Troubleshooting Resource Provider
 * Provides comprehensive network connectivity testing and diagnostics
 * 
 * Level 3: Integration Layer (depends on Level 0-2)
 */

import type { SessionId } from '@curupira/shared/types'
import { ChromeManager } from '../../../chrome/manager.js'
import { logger } from '../../../config/logger.js'

export interface ConnectivityTest {
  url: string
  method: string
  status: 'success' | 'failure' | 'timeout'
  statusCode?: number
  responseTime: number
  error?: string
  headers?: Record<string, string>
  corsSupported?: boolean
  redirects?: string[]
}

export interface WebSocketTest {
  url: string
  status: 'connected' | 'failed' | 'timeout'
  connectionTime?: number
  error?: string
  protocols?: string[]
  extensions?: string[]
}

export interface CorsTest {
  url: string
  origin: string
  method: string
  status: 'allowed' | 'blocked' | 'error'
  allowedOrigins?: string[]
  allowedMethods?: string[]
  allowedHeaders?: string[]
  credentials?: boolean
  maxAge?: number
  error?: string
}

export interface NetworkDiagnostic {
  timestamp: number
  tests: {
    http: ConnectivityTest[]
    websocket: WebSocketTest[]
    cors: CorsTest[]
  }
  summary: {
    totalTests: number
    passed: number
    failed: number
    issues: string[]
    recommendations: string[]
  }
}

export interface ConnectivityResourceProvider {
  testHttpConnectivity(sessionId: SessionId, url: string, options?: {
    method?: string
    timeout?: number
    followRedirects?: boolean
  }): Promise<ConnectivityTest>
  
  testWebSocketConnectivity(sessionId: SessionId, url: string, options?: {
    protocols?: string[]
    timeout?: number
  }): Promise<WebSocketTest>
  
  testCorsConfiguration(sessionId: SessionId, url: string, origin: string, options?: {
    method?: string
    headers?: Record<string, string>
  }): Promise<CorsTest>
  
  runComprehensiveDiagnostic(sessionId: SessionId, targets: {
    urls: string[]
    websockets?: string[]
    corsOrigins?: string[]
  }): Promise<NetworkDiagnostic>
  
  testMCPConnectivity(sessionId: SessionId, mcpServerUrl: string): Promise<ConnectivityTest>
  testChromeDevToolsConnectivity(sessionId: SessionId): Promise<ConnectivityTest>
  
  generateTroubleshootingReport(sessionId: SessionId, tests: NetworkDiagnostic): Promise<{
    summary: string
    issues: Array<{
      type: 'error' | 'warning' | 'info'
      title: string
      description: string
      solution: string
    }>
    recommendations: string[]
  }>
}

export class ConnectivityTroubleshootingProvider implements ConnectivityResourceProvider {
  private chromeManager: ChromeManager

  constructor() {
    this.chromeManager = ChromeManager.getInstance()
  }

  async testHttpConnectivity(sessionId: SessionId, url: string, options: {
    method?: string
    timeout?: number
    followRedirects?: boolean
  } = {}): Promise<ConnectivityTest> {
    const { method = 'GET', timeout = 10000, followRedirects = true } = options
    const client = this.chromeManager.getClient()
    
    try {
      const startTime = Date.now()
      
      const result = await client.send('Runtime.evaluate', {
        expression: `
          (async () => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), ${timeout});
            
            try {
              const response = await fetch('${url}', {
                method: '${method}',
                signal: controller.signal,
                redirect: '${followRedirects ? 'follow' : 'manual'}'
              });
              
              clearTimeout(timeoutId);
              
              const headers = {};
              for (const [key, value] of response.headers.entries()) {
                headers[key] = value;
              }
              
              // Test CORS headers
              const corsSupported = response.headers.has('access-control-allow-origin');
              
              return {
                status: 'success',
                statusCode: response.status,
                headers: headers,
                corsSupported: corsSupported,
                redirected: response.redirected,
                url: response.url
              };
            } catch (error) {
              clearTimeout(timeoutId);
              return {
                status: 'failure',
                error: error.message
              };
            }
          })()
        `,
        awaitPromise: true,
        returnByValue: true
      }, sessionId)
      
      const responseTime = Date.now() - startTime
      const testResult = (result as any).result?.value
      
      return {
        url,
        method,
        status: testResult?.status || 'failure',
        statusCode: testResult?.statusCode,
        responseTime,
        error: testResult?.error,
        headers: testResult?.headers,
        corsSupported: testResult?.corsSupported,
        redirects: testResult?.redirected ? [testResult.url] : undefined
      }
    } catch (error) {
      return {
        url,
        method,
        status: 'failure',
        responseTime: timeout,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async testWebSocketConnectivity(sessionId: SessionId, url: string, options: {
    protocols?: string[]
    timeout?: number
  } = {}): Promise<WebSocketTest> {
    const { protocols = [], timeout = 10000 } = options
    const client = this.chromeManager.getClient()
    
    try {
      const startTime = Date.now()
      
      const result = await client.send('Runtime.evaluate', {
        expression: `
          (async () => {
            return new Promise((resolve) => {
              const startTime = Date.now();
              const ws = new WebSocket('${url}'${protocols.length ? `, ${JSON.stringify(protocols)}` : ''});
              
              const timeout = setTimeout(() => {
                ws.close();
                resolve({
                  status: 'timeout',
                  connectionTime: Date.now() - startTime
                });
              }, ${timeout});
              
              ws.onopen = () => {
                clearTimeout(timeout);
                resolve({
                  status: 'connected',
                  connectionTime: Date.now() - startTime,
                  protocol: ws.protocol,
                  extensions: ws.extensions
                });
                ws.close();
              };
              
              ws.onerror = (error) => {
                clearTimeout(timeout);
                resolve({
                  status: 'failed',
                  connectionTime: Date.now() - startTime,
                  error: 'WebSocket connection failed'
                });
              };
            });
          })()
        `,
        awaitPromise: true,
        returnByValue: true
      }, sessionId)
      
      const testResult = (result as any).result?.value
      
      return {
        url,
        status: testResult?.status || 'failed',
        connectionTime: testResult?.connectionTime,
        error: testResult?.error,
        protocols: testResult?.protocol ? [testResult.protocol] : undefined,
        extensions: testResult?.extensions ? [testResult.extensions] : undefined
      }
    } catch (error) {
      return {
        url,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async testCorsConfiguration(sessionId: SessionId, url: string, origin: string, options: {
    method?: string
    headers?: Record<string, string>
  } = {}): Promise<CorsTest> {
    const { method = 'GET', headers = {} } = options
    const client = this.chromeManager.getClient()
    
    try {
      const result = await client.send('Runtime.evaluate', {
        expression: `
          (async () => {
            try {
              // First, try an OPTIONS preflight request
              const preflightResponse = await fetch('${url}', {
                method: 'OPTIONS',
                headers: {
                  'Origin': '${origin}',
                  'Access-Control-Request-Method': '${method}',
                  'Access-Control-Request-Headers': '${Object.keys(headers).join(', ')}'
                }
              });
              
              const corsHeaders = {};
              for (const [key, value] of preflightResponse.headers.entries()) {
                if (key.toLowerCase().startsWith('access-control-')) {
                  corsHeaders[key] = value;
                }
              }
              
              const allowedOrigins = corsHeaders['access-control-allow-origin']?.split(',').map(s => s.trim()) || [];
              const allowedMethods = corsHeaders['access-control-allow-methods']?.split(',').map(s => s.trim()) || [];
              const allowedHeaders = corsHeaders['access-control-allow-headers']?.split(',').map(s => s.trim()) || [];
              const credentials = corsHeaders['access-control-allow-credentials'] === 'true';
              const maxAge = corsHeaders['access-control-max-age'] ? parseInt(corsHeaders['access-control-max-age']) : undefined;
              
              // Check if origin is allowed
              const originAllowed = allowedOrigins.includes('*') || allowedOrigins.includes('${origin}');
              const methodAllowed = allowedMethods.includes('*') || allowedMethods.includes('${method}');
              
              return {
                status: originAllowed && methodAllowed ? 'allowed' : 'blocked',
                allowedOrigins: allowedOrigins,
                allowedMethods: allowedMethods,
                allowedHeaders: allowedHeaders,
                credentials: credentials,
                maxAge: maxAge
              };
            } catch (error) {
              return {
                status: 'error',
                error: error.message
              };
            }
          })()
        `,
        awaitPromise: true,
        returnByValue: true
      }, sessionId)
      
      const testResult = (result as any).result?.value
      
      return {
        url,
        origin,
        method,
        status: testResult?.status || 'error',
        allowedOrigins: testResult?.allowedOrigins,
        allowedMethods: testResult?.allowedMethods,
        allowedHeaders: testResult?.allowedHeaders,
        credentials: testResult?.credentials,
        maxAge: testResult?.maxAge,
        error: testResult?.error
      }
    } catch (error) {
      return {
        url,
        origin,
        method,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async runComprehensiveDiagnostic(sessionId: SessionId, targets: {
    urls: string[]
    websockets?: string[]
    corsOrigins?: string[]
  }): Promise<NetworkDiagnostic> {
    const diagnostic: NetworkDiagnostic = {
      timestamp: Date.now(),
      tests: {
        http: [],
        websocket: [],
        cors: []
      },
      summary: {
        totalTests: 0,
        passed: 0,
        failed: 0,
        issues: [],
        recommendations: []
      }
    }
    
    // Test HTTP connectivity
    for (const url of targets.urls) {
      const test = await this.testHttpConnectivity(sessionId, url)
      diagnostic.tests.http.push(test)
      diagnostic.summary.totalTests++
      
      if (test.status === 'success') {
        diagnostic.summary.passed++
      } else {
        diagnostic.summary.failed++
        diagnostic.summary.issues.push(`HTTP connectivity failed for ${url}: ${test.error}`)
      }
    }
    
    // Test WebSocket connectivity
    if (targets.websockets) {
      for (const url of targets.websockets) {
        const test = await this.testWebSocketConnectivity(sessionId, url)
        diagnostic.tests.websocket.push(test)
        diagnostic.summary.totalTests++
        
        if (test.status === 'connected') {
          diagnostic.summary.passed++
        } else {
          diagnostic.summary.failed++
          diagnostic.summary.issues.push(`WebSocket connectivity failed for ${url}: ${test.error}`)
        }
      }
    }
    
    // Test CORS configuration
    if (targets.corsOrigins) {
      for (const url of targets.urls) {
        for (const origin of targets.corsOrigins) {
          const test = await this.testCorsConfiguration(sessionId, url, origin)
          diagnostic.tests.cors.push(test)
          diagnostic.summary.totalTests++
          
          if (test.status === 'allowed') {
            diagnostic.summary.passed++
          } else {
            diagnostic.summary.failed++
            diagnostic.summary.issues.push(`CORS blocked for ${url} from origin ${origin}`)
          }
        }
      }
    }
    
    // Generate recommendations
    if (diagnostic.summary.failed > 0) {
      diagnostic.summary.recommendations.push('Check network connectivity and firewall settings')
      
      if (diagnostic.tests.cors.some(test => test.status === 'blocked')) {
        diagnostic.summary.recommendations.push('Configure CORS headers on the server')
      }
      
      if (diagnostic.tests.websocket.some(test => test.status === 'failed')) {
        diagnostic.summary.recommendations.push('Verify WebSocket server is running and accessible')
      }
    }
    
    return diagnostic
  }

  async testMCPConnectivity(sessionId: SessionId, mcpServerUrl: string): Promise<ConnectivityTest> {
    // Test MCP server connectivity (WebSocket or HTTP)
    if (mcpServerUrl.startsWith('ws://') || mcpServerUrl.startsWith('wss://')) {
      const wsTest = await this.testWebSocketConnectivity(sessionId, mcpServerUrl)
      return {
        url: mcpServerUrl,
        method: 'WebSocket',
        status: wsTest.status === 'connected' ? 'success' : 'failure',
        responseTime: wsTest.connectionTime || 0,
        error: wsTest.error
      }
    } else {
      return await this.testHttpConnectivity(sessionId, mcpServerUrl, { method: 'GET' })
    }
  }

  async testChromeDevToolsConnectivity(sessionId: SessionId): Promise<ConnectivityTest> {
    // Test Chrome DevTools Protocol connectivity
    try {
      const client = this.chromeManager.getClient()
      const startTime = Date.now()
      
      // Try a simple CDP command
      await client.send('Runtime.evaluate', {
        expression: '1 + 1',
        returnByValue: true
      }, sessionId)
      
      const responseTime = Date.now() - startTime
      
      return {
        url: 'chrome-devtools-protocol',
        method: 'CDP',
        status: 'success',
        responseTime,
        statusCode: 200
      }
    } catch (error) {
      return {
        url: 'chrome-devtools-protocol',
        method: 'CDP',
        status: 'failure',
        responseTime: 0,
        error: error instanceof Error ? error.message : 'CDP connection failed'
      }
    }
  }

  async generateTroubleshootingReport(sessionId: SessionId, tests: NetworkDiagnostic) {
    const issues = []
    const recommendations = []
    
    // Analyze HTTP tests
    for (const test of tests.tests.http) {
      if (test.status === 'failure') {
        if (test.error?.includes('CORS')) {
          issues.push({
            type: 'error' as const,
            title: 'CORS Policy Error',
            description: `Request to ${test.url} blocked by CORS policy`,
            solution: 'Configure Access-Control-Allow-Origin header on the server or use a proxy'
          })
        } else if (test.error?.includes('timeout')) {
          issues.push({
            type: 'warning' as const,
            title: 'Network Timeout',
            description: `Request to ${test.url} timed out`,
            solution: 'Check network connectivity and server response time'
          })
        } else {
          issues.push({
            type: 'error' as const,
            title: 'Network Error',
            description: `Failed to connect to ${test.url}: ${test.error}`,
            solution: 'Verify the URL is correct and the server is running'
          })
        }
      }
    }
    
    // Analyze WebSocket tests
    for (const test of tests.tests.websocket) {
      if (test.status === 'failed') {
        issues.push({
          type: 'error' as const,
          title: 'WebSocket Connection Failed',
          description: `WebSocket connection to ${test.url} failed: ${test.error}`,
          solution: 'Check if WebSocket server is running and firewall allows WebSocket connections'
        })
      }
    }
    
    // Analyze CORS tests
    for (const test of tests.tests.cors) {
      if (test.status === 'blocked') {
        issues.push({
          type: 'warning' as const,
          title: 'CORS Configuration Issue',
          description: `CORS blocks requests from ${test.origin} to ${test.url}`,
          solution: 'Add the origin to Access-Control-Allow-Origin header or use wildcard (*)'
        })
      }
    }
    
    // Generate general recommendations
    if (tests.summary.failed > tests.summary.passed) {
      recommendations.push('Multiple connectivity issues detected - check network configuration')
    }
    
    if (issues.some(issue => issue.title.includes('CORS'))) {
      recommendations.push('Consider using a development proxy to handle CORS during development')
    }
    
    if (issues.some(issue => issue.title.includes('WebSocket'))) {
      recommendations.push('Ensure WebSocket server supports the required protocols and extensions')
    }
    
    const summary = `Connectivity Report: ${tests.summary.passed}/${tests.summary.totalTests} tests passed. ` +
                   `${issues.length} issues found requiring attention.`
    
    return {
      summary,
      issues,
      recommendations
    }
  }
}