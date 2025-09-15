/**
 * Test Setup Configuration
 * Configures the test environment for integration tests
 */

import { beforeAll, afterAll } from 'vitest'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

// Global test setup
beforeAll(async () => {
  console.log('🚀 Setting up integration test environment...')
  
  // Check if Chrome is available for testing
  try {
    await execAsync('which google-chrome || which chromium-browser || which chrome')
    console.log('✅ Chrome browser found for testing')
  } catch (error) {
    console.warn('⚠️ Chrome browser not found. Some integration tests may fail.')
    console.warn('Please install Chrome or Chromium for full test coverage.')
  }
  
  // Set environment variables for testing
  process.env.NODE_ENV = 'test'
  process.env.CURUPIRA_LOG_LEVEL = 'error' // Reduce noise in tests
  
  console.log('✅ Test environment configured')
}, 30000)

// Global test cleanup
afterAll(async () => {
  console.log('🧹 Cleaning up test environment...')
  
  // Kill any hanging Chrome processes from tests
  try {
    if (process.platform === 'darwin') {
      await execAsync('pkill -f "Chrome.*--remote-debugging-port"').catch(() => {})
    } else {
      await execAsync('pkill -f "chrome.*--remote-debugging-port"').catch(() => {})
      await execAsync('pkill -f "chromium.*--remote-debugging-port"').catch(() => {})
    }
  } catch (error) {
    // Ignore errors - processes might not exist
  }
  
  console.log('✅ Test cleanup complete')
}, 10000)

// Mock Chrome setup utilities for tests that don't need real Chrome
export class MockChromeManager {
  private connected = false
  private sessions = new Map<string, any>()

  async connect(options: any) {
    this.connected = true
    return true
  }

  async disconnect() {
    this.connected = false
    this.sessions.clear()
  }

  async createSession(): Promise<string> {
    if (!this.connected) {
      throw new Error('Not connected to Chrome')
    }
    
    const sessionId = `mock-session-${Date.now()}-${Math.random()}`
    this.sessions.set(sessionId, { id: sessionId, created: Date.now() })
    return sessionId
  }

  async closeSession(sessionId: string) {
    this.sessions.delete(sessionId)
  }

  getClient() {
    return {
      send: async (method: string, params: any, sessionId?: string) => {
        // Mock CDP responses based on method
        switch (method) {
          case 'Runtime.evaluate':
            if (params.expression === 'window') {
              return {
                result: {
                  type: 'object',
                  objectId: 'mock-object-id',
                  preview: {
                    type: 'object',
                    description: 'Window'
                  }
                }
              }
            }
            return {
              result: {
                type: 'number',
                value: 4,
                description: '4'
              }
            }
          
          case 'Page.navigate':
            return { frameId: 'mock-frame-id' }
          
          case 'Page.captureScreenshot':
            return { data: 'mock-base64-image-data' }
          
          case 'DOM.getDocument':
            return {
              root: {
                nodeId: 1,
                nodeName: 'HTML',
                nodeType: 1,
                children: [
                  {
                    nodeId: 2,
                    nodeName: 'BODY',
                    nodeType: 1
                  }
                ]
              }
            }
          
          case 'Runtime.getProperties':
            return {
              result: [
                {
                  name: 'console',
                  value: { type: 'object', description: 'console' }
                },
                {
                  name: 'document',
                  value: { type: 'object', description: 'document' }
                }
              ]
            }
          
          default:
            return { success: true, method, params }
        }
      }
    }
  }

  isConnected() {
    return this.connected
  }

  getSessions() {
    return Array.from(this.sessions.values())
  }
}

// Export for use in tests
export const createMockChromeManager = () => new MockChromeManager()

// Chrome debugging utilities
export const startChromeForTesting = async (port = 9222) => {
  const isWindows = process.platform === 'win32'
  const isMac = process.platform === 'darwin'
  
  let chromeCmd: string
  
  if (isWindows) {
    chromeCmd = `start chrome --remote-debugging-port=${port} --no-sandbox --disable-web-security --disable-features=VizDisplayCompositor --headless`
  } else if (isMac) {
    chromeCmd = `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=${port} --no-sandbox --disable-web-security --disable-features=VizDisplayCompositor --headless &`
  } else {
    // Linux
    chromeCmd = `google-chrome --remote-debugging-port=${port} --no-sandbox --disable-web-security --disable-features=VizDisplayCompositor --headless || chromium-browser --remote-debugging-port=${port} --no-sandbox --disable-web-security --disable-features=VizDisplayCompositor --headless &`
  }
  
  try {
    await execAsync(chromeCmd)
    // Wait for Chrome to start
    await new Promise(resolve => setTimeout(resolve, 3000))
    console.log(`✅ Chrome started on port ${port} for testing`)
    return true
  } catch (error) {
    console.error(`❌ Failed to start Chrome: ${error}`)
    return false
  }
}

// Test data generators
export const generateTestHTML = (options: {
  title?: string
  body?: string
  includeReact?: boolean
  includeZustand?: boolean
  includeXState?: boolean
} = {}) => {
  const {
    title = 'Test Page',
    body = '<h1>Test Content</h1>',
    includeReact = false,
    includeZustand = false,
    includeXState = false
  } = options

  let scripts = ''
  
  if (includeReact) {
    scripts += `
      <script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
      <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
      <script>window.React = React; window.ReactDOM = ReactDOM;</script>
    `
  }
  
  if (includeZustand) {
    scripts += `
      <script src="https://unpkg.com/zustand@4/index.umd.js"></script>
      <script>window.zustand = zustand;</script>
    `
  }
  
  if (includeXState) {
    scripts += `
      <script src="https://unpkg.com/xstate@4/dist/xstate.web.js"></script>
      <script>window.XState = XState;</script>
    `
  }

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        ${scripts}
      </head>
      <body>
        ${body}
      </body>
    </html>
  `
}

// Test assertions helpers
export const waitForCondition = async (
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 100
) => {
  const start = Date.now()
  
  while (Date.now() - start < timeout) {
    if (await condition()) {
      return true
    }
    await new Promise(resolve => setTimeout(resolve, interval))
  }
  
  throw new Error(`Condition not met within ${timeout}ms`)
}

export const waitForElement = async (
  sessionId: string,
  selector: string,
  chromeManager: any,
  timeout = 5000
) => {
  const client = chromeManager.getClient()
  
  return waitForCondition(async () => {
    try {
      const doc = await client.send('DOM.getDocument', { depth: -1 }, sessionId)
      const result = await client.send('DOM.querySelectorAll', {
        nodeId: doc.root.nodeId,
        selector
      }, sessionId)
      return result.nodeIds.length > 0
    } catch {
      return false
    }
  }, timeout)
}