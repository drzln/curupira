/**
 * Integration Tests for Enhanced Resource Providers
 * Tests the comprehensive resource providers against a real Chrome instance
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { ChromeManager } from '../../src/chrome/manager.js'
import { ChromeCDPResourceProvider } from '../../src/mcp/resources/providers/cdp.js'
import { ReactFrameworkProvider } from '../../src/mcp/resources/providers/react.js'
import { StateManagementResourceProvider } from '../../src/mcp/resources/providers/state.js'
import { ConnectivityTroubleshootingProvider } from '../../src/mcp/resources/providers/connectivity.js'
import { CurupiraDiscoveryService } from '../../src/mcp/discovery/index.js'
import type { SessionId } from '@curupira/shared/types'

// Test fixtures and utilities
class TestChromeSetup {
  private chromeManager: ChromeManager
  private sessionId: SessionId | null = null

  constructor() {
    this.chromeManager = ChromeManager.getInstance()
  }

  async setup(): Promise<SessionId> {
    // Start Chrome in headless mode for testing
    await this.chromeManager.initialize({
      host: 'localhost',
      port: 9222,
      secure: false
    })

    // Create a new tab session
    this.sessionId = await this.chromeManager.createSession()
    return this.sessionId
  }

  async navigate(url: string): Promise<void> {
    if (!this.sessionId) {
      throw new Error('Chrome session not initialized')
    }

    const client = this.chromeManager.getClient()
    await client.send('Page.navigate', { url }, this.sessionId)
    
    // Wait for navigation to complete
    await new Promise(resolve => setTimeout(resolve, 2000))
  }

  async cleanup(): Promise<void> {
    if (this.sessionId) {
      await this.chromeManager.closeSession(this.sessionId)
    }
    await this.chromeManager.disconnect()
  }

  getSessionId(): SessionId {
    if (!this.sessionId) {
      throw new Error('Chrome session not initialized')
    }
    return this.sessionId
  }
}

describe('Enhanced Resource Providers Integration', () => {
  let chromeSetup: TestChromeSetup
  let sessionId: SessionId
  let cdpProvider: ChromeCDPResourceProvider
  let reactProvider: ReactFrameworkProvider
  let stateProvider: StateManagementResourceProvider
  let connectivityProvider: ConnectivityTroubleshootingProvider
  let discoveryService: CurupiraDiscoveryService

  beforeAll(async () => {
    chromeSetup = new TestChromeSetup()
    sessionId = await chromeSetup.setup()
    
    // Initialize all providers
    cdpProvider = new ChromeCDPResourceProvider()
    reactProvider = new ReactFrameworkProvider()
    stateProvider = new StateManagementResourceProvider()
    connectivityProvider = new ConnectivityTroubleshootingProvider()
    discoveryService = new CurupiraDiscoveryService()
  }, 30000) // 30 second timeout for Chrome startup

  afterAll(async () => {
    await chromeSetup.cleanup()
  })

  beforeEach(async () => {
    // Navigate to a simple test page for each test
    await chromeSetup.navigate('data:text/html,<html><head><title>Test Page</title></head><body><h1>Test</h1></body></html>')
  })

  describe('ChromeCDPResourceProvider', () => {
    test('should get runtime properties', async () => {
      const properties = await cdpProvider.getRuntimeProperties(sessionId)
      
      expect(properties).toBeDefined()
      expect(typeof properties).toBe('object')
    })

    test('should get global object with important globals', async () => {
      const globalObj = await cdpProvider.getGlobalObject(sessionId)
      
      expect(globalObj).toBeDefined()
      expect(globalObj).toHaveProperty('result')
      expect(globalObj).toHaveProperty('value')
      
      const result = (globalObj as any).result?.value
      expect(result).toHaveProperty('console')
      expect(result).toHaveProperty('document')
      expect(result).toHaveProperty('window')
      expect(result).toHaveProperty('_totalGlobals')
      expect(typeof result._totalGlobals).toBe('number')
    })

    test('should get DOM snapshot', async () => {
      const snapshot = await cdpProvider.getDOMSnapshot(sessionId)
      
      expect(snapshot).toBeDefined()
      expect(snapshot).toHaveProperty('documents')
    })

    test('should get DOM nodes', async () => {
      const nodes = await cdpProvider.getDOMNodes(sessionId)
      
      expect(nodes).toBeDefined()
      expect(nodes).toHaveProperty('root')
      expect((nodes as any).root).toHaveProperty('nodeId')
      expect((nodes as any).root).toHaveProperty('nodeName')
    })

    test('should find specific DOM elements', async () => {
      // Navigate to a page with known elements
      await chromeSetup.navigate('data:text/html,<html><body><h1 id="test">Test Header</h1><p class="content">Test content</p></body></html>')
      
      const elements = await cdpProvider.getDOMNodes(sessionId, 'h1')
      
      expect(elements).toBeDefined()
      expect(elements).toHaveProperty('nodeIds')
      expect(Array.isArray((elements as any).nodeIds)).toBe(true)
    })

    test('should get page frame tree', async () => {
      const frameTree = await cdpProvider.getPageFrameTree(sessionId)
      
      expect(frameTree).toBeDefined()
      expect(frameTree).toHaveProperty('frameTree')
      expect((frameTree as any).frameTree).toHaveProperty('frame')
    })

    test('should get page metrics', async () => {
      const metrics = await cdpProvider.getPageMetrics(sessionId)
      
      expect(metrics).toBeDefined()
      expect(metrics).toHaveProperty('layout')
      expect(metrics).toHaveProperty('timestamp')
    })

    test('should get performance metrics', async () => {
      const metrics = await cdpProvider.getPerformanceMetrics(sessionId)
      
      expect(metrics).toBeDefined()
      expect(metrics).toHaveProperty('metrics')
      expect(Array.isArray((metrics as any).metrics)).toBe(true)
    })

    test('should get console history', async () => {
      // Generate some console messages
      await chromeSetup.navigate('data:text/html,<html><body><script>console.log("Test message");</script></body></html>')
      
      const history = await cdpProvider.getConsoleHistory(sessionId)
      
      expect(history).toBeDefined()
      expect(history).toHaveProperty('messages')
      expect(history).toHaveProperty('count')
      expect(Array.isArray((history as any).messages)).toBe(true)
    })
  })

  describe('ReactFrameworkProvider', () => {
    test('should detect React when not present', async () => {
      const reactInfo = await reactProvider.detectReact(sessionId)
      
      expect(reactInfo).toBeNull()
    })

    test('should detect React when present', async () => {
      // Navigate to a page with React
      const reactPageHtml = `
        <html>
          <head>
            <script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
            <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
          </head>
          <body>
            <div id="root"></div>
            <script>
              window.React = React;
              window.ReactDOM = ReactDOM;
            </script>
          </body>
        </html>
      `
      
      await chromeSetup.navigate(`data:text/html,${encodeURIComponent(reactPageHtml)}`)
      
      // Wait for React to load
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      const reactInfo = await reactProvider.detectReact(sessionId)
      
      expect(reactInfo).toBeDefined()
      expect(reactInfo).toHaveProperty('hasReact')
      expect(reactInfo?.hasReact).toBe(true)
    })

    test('should get React components when available', async () => {
      const components = await reactProvider.getReactComponents(sessionId)
      
      expect(components).toBeDefined()
      expect(Array.isArray(components)).toBe(true)
    })
  })

  describe('StateManagementResourceProvider', () => {
    test('should detect XState when not present', async () => {
      const hasXState = await stateProvider.detectXState(sessionId)
      
      expect(hasXState).toBe(false)
    })

    test('should detect Zustand when not present', async () => {
      const hasZustand = await stateProvider.detectZustand(sessionId)
      
      expect(hasZustand).toBe(false)
    })

    test('should detect Apollo when not present', async () => {
      const hasApollo = await stateProvider.detectApollo(sessionId)
      
      expect(hasApollo).toBe(false)
    })

    test('should get empty state management info', async () => {
      const stateInfo = await stateProvider.getStateManagementInfo(sessionId)
      
      expect(stateInfo).toBeDefined()
      expect(stateInfo).toHaveProperty('xstate')
      expect(stateInfo).toHaveProperty('zustand')
      expect(stateInfo).toHaveProperty('apollo')
      expect(stateInfo.xstate.detected).toBe(false)
      expect(stateInfo.zustand.detected).toBe(false)
      expect(stateInfo.apollo.detected).toBe(false)
    })
  })

  describe('ConnectivityTroubleshootingProvider', () => {
    test('should test HTTP connectivity to valid URL', async () => {
      const result = await connectivityProvider.testHttpConnectivity(
        sessionId,
        'https://httpbin.org/get'
      )
      
      expect(result).toBeDefined()
      expect(result.status).toBe('success')
      expect(result.statusCode).toBe(200)
      expect(result.responseTime).toBeGreaterThan(0)
      expect(result.url).toBe('https://httpbin.org/get')
    })

    test('should test HTTP connectivity to invalid URL', async () => {
      const result = await connectivityProvider.testHttpConnectivity(
        sessionId,
        'https://invalid-domain-that-does-not-exist.com'
      )
      
      expect(result).toBeDefined()
      expect(result.status).toBe('failure')
      expect(result.error).toBeDefined()
    })

    test('should test WebSocket connectivity to valid endpoint', async () => {
      const result = await connectivityProvider.testWebSocketConnectivity(
        sessionId,
        'wss://echo.websocket.org'
      )
      
      expect(result).toBeDefined()
      expect(result.url).toBe('wss://echo.websocket.org')
      // Note: Status might be 'connected' or 'failed' depending on network
      expect(['connected', 'failed', 'timeout']).toContain(result.status)
    })

    test('should test CORS configuration', async () => {
      const result = await connectivityProvider.testCorsConfiguration(
        sessionId,
        'https://httpbin.org/get',
        'https://example.com'
      )
      
      expect(result).toBeDefined()
      expect(result.url).toBe('https://httpbin.org/get')
      expect(result.origin).toBe('https://example.com')
      expect(['allowed', 'blocked', 'error']).toContain(result.status)
    })

    test('should run comprehensive diagnostic', async () => {
      const result = await connectivityProvider.runComprehensiveDiagnostic(sessionId, {
        urls: ['https://httpbin.org/get', 'https://httpbin.org/post'],
        websockets: ['wss://echo.websocket.org'],
        corsOrigins: ['https://example.com']
      })
      
      expect(result).toBeDefined()
      expect(result).toHaveProperty('timestamp')
      expect(result).toHaveProperty('tests')
      expect(result).toHaveProperty('summary')
      expect(result.tests).toHaveProperty('http')
      expect(result.tests).toHaveProperty('websocket')
      expect(result.tests).toHaveProperty('cors')
      expect(Array.isArray(result.tests.http)).toBe(true)
      expect(Array.isArray(result.tests.websocket)).toBe(true)
      expect(Array.isArray(result.tests.cors)).toBe(true)
      expect(result.summary).toHaveProperty('totalTests')
      expect(result.summary).toHaveProperty('passed')
      expect(result.summary).toHaveProperty('failed')
    })

    test('should test Chrome DevTools connectivity', async () => {
      const result = await connectivityProvider.testChromeDevToolsConnectivity(sessionId)
      
      expect(result).toBeDefined()
      expect(result.url).toBe('chrome-devtools-protocol')
      expect(result.method).toBe('CDP')
      expect(result.status).toBe('success')
      expect(result.statusCode).toBe(200)
      expect(result.responseTime).toBeGreaterThan(0)
    })

    test('should generate troubleshooting report', async () => {
      // First run a diagnostic
      const diagnostic = await connectivityProvider.runComprehensiveDiagnostic(sessionId, {
        urls: ['https://httpbin.org/get'],
        websockets: ['wss://echo.websocket.org'],
        corsOrigins: ['https://example.com']
      })
      
      const report = await connectivityProvider.generateTroubleshootingReport(sessionId, diagnostic)
      
      expect(report).toBeDefined()
      expect(report).toHaveProperty('summary')
      expect(report).toHaveProperty('issues')
      expect(report).toHaveProperty('recommendations')
      expect(typeof report.summary).toBe('string')
      expect(Array.isArray(report.issues)).toBe(true)
      expect(Array.isArray(report.recommendations)).toBe(true)
    })
  })

  describe('CurupiraDiscoveryService', () => {
    test('should discover environment information', async () => {
      const environment = await discoveryService.discoverEnvironment(sessionId)
      
      expect(environment).toBeDefined()
      expect(environment).toHaveProperty('runtime')
      expect(environment).toHaveProperty('development')
      expect(environment).toHaveProperty('typescript')
      expect(environment).toHaveProperty('sourceMap')
      expect(environment).toHaveProperty('hotReload')
      expect(environment.runtime).toBe('browser')
    })

    test('should discover frameworks', async () => {
      const frameworks = await discoveryService.discoverFrameworks(sessionId)
      
      expect(frameworks).toBeDefined()
      expect(Array.isArray(frameworks)).toBe(true)
      // Should be empty for basic HTML page
      expect(frameworks.length).toBe(0)
    })

    test('should discover libraries', async () => {
      const libraries = await discoveryService.discoverLibraries(sessionId)
      
      expect(libraries).toBeDefined()
      expect(Array.isArray(libraries)).toBe(true)
      // Basic page might not have any detected libraries
    })

    test('should generate comprehensive report', async () => {
      const report = await discoveryService.generateReport(sessionId)
      
      expect(report).toBeDefined()
      expect(report).toHaveProperty('timestamp')
      expect(report).toHaveProperty('sessionId')
      expect(report).toHaveProperty('environment')
      expect(report).toHaveProperty('frameworks')
      expect(report).toHaveProperty('libraries')
      expect(report).toHaveProperty('capabilities')
      expect(report).toHaveProperty('recommendations')
      expect(report).toHaveProperty('registeredResources')
      expect(report).toHaveProperty('registeredTools')
      expect(report.sessionId).toBe(sessionId)
      expect(typeof report.timestamp).toBe('number')
      expect(Array.isArray(report.frameworks)).toBe(true)
      expect(Array.isArray(report.libraries)).toBe(true)
      expect(Array.isArray(report.recommendations)).toBe(true)
    })

    test('should register dynamic resources', async () => {
      const frameworks = await discoveryService.discoverFrameworks(sessionId)
      const resources = await discoveryService.registerDynamicResources(sessionId, frameworks)
      
      expect(resources).toBeDefined()
      expect(Array.isArray(resources)).toBe(true)
      // Should be empty for no frameworks detected
      expect(resources.length).toBe(0)
    })

    test('should register dynamic tools', async () => {
      const frameworks = await discoveryService.discoverFrameworks(sessionId)
      const tools = await discoveryService.registerDynamicTools(sessionId, frameworks)
      
      expect(tools).toBeDefined()
      expect(Array.isArray(tools)).toBe(true)
      // Should be empty for no frameworks detected
      expect(tools.length).toBe(0)
    })

    test('should provide recommendations', async () => {
      const report = await discoveryService.generateReport(sessionId)
      const recommendations = discoveryService.getRecommendations(report)
      
      expect(recommendations).toBeDefined()
      expect(Array.isArray(recommendations)).toBe(true)
      // Should have some basic recommendations
      expect(recommendations.length).toBeGreaterThan(0)
    })
  })

  describe('Error Handling', () => {
    test('should handle invalid session IDs gracefully', async () => {
      const invalidSessionId = 'invalid-session-id' as SessionId
      
      await expect(async () => {
        await cdpProvider.getRuntimeProperties(invalidSessionId)
      }).rejects.toThrow()
    })

    test('should handle network timeouts', async () => {
      const result = await connectivityProvider.testHttpConnectivity(
        sessionId,
        'https://httpbin.org/delay/15',
        { timeout: 1000 } // 1 second timeout
      )
      
      expect(result).toBeDefined()
      expect(result.status).toBe('failure')
      expect(result.error).toContain('timeout')
    })

    test('should handle malformed URLs', async () => {
      const result = await connectivityProvider.testHttpConnectivity(
        sessionId,
        'not-a-valid-url'
      )
      
      expect(result).toBeDefined()
      expect(result.status).toBe('failure')
      expect(result.error).toBeDefined()
    })
  })
})