import browser from 'webextension-polyfill'
import { createBridgeMessage, createEvent } from '@curupira/shared'

// Connect to background script
const port = browser.runtime.connect({ name: 'curupira-content' })

// Inject page script
function injectPageScript() {
  const script = document.createElement('script')
  script.src = browser.runtime.getURL('src/injected/hooks.js')
  script.onload = () => script.remove()
  ;(document.head || document.documentElement).appendChild(script)
}

// Setup message bridge
window.addEventListener('message', (event) => {
  // Only accept messages from same origin
  if (event.source !== window) return
  
  // Check for Curupira messages
  if (event.data?.source === 'curupira-page') {
    console.log('Message from page:', event.data)
    port.postMessage(event.data)
  }
})

// Forward messages from background to page
port.onMessage.addListener((message) => {
  console.log('Message from background:', message)
  window.postMessage({ ...message, source: 'curupira-extension' }, '*')
})

// Intercept console methods
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  info: console.info,
  debug: console.debug,
}

function interceptConsole() {
  const methods = ['log', 'warn', 'error', 'info', 'debug'] as const

  methods.forEach((method) => {
    console[method] = (...args: any[]) => {
      // Call original
      originalConsole[method](...args)

      // Send to MCP
      const event = createEvent('page', 'console.log', {
        level: method,
        message: args[0]?.toString() || '',
        args: args.map((arg) => {
          try {
            return JSON.parse(JSON.stringify(arg))
          } catch {
            return String(arg)
          }
        }),
        timestamp: Date.now(),
        stackTrace: new Error().stack,
      })

      port.postMessage(event)
    }
  })
}

// Monitor network requests
function interceptFetch() {
  const originalFetch = window.fetch

  window.fetch = async function (...args) {
    const [input, init] = args
    const url = typeof input === 'string' ? input : input.url
    const method = init?.method || 'GET'
    const startTime = Date.now()

    try {
      const response = await originalFetch(...args)
      const duration = Date.now() - startTime

      // Clone response to read body
      const clone = response.clone()
      const body = await clone.text()

      // Send to MCP
      const event = createEvent('page', 'network.request', {
        url,
        method,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: body.substring(0, 1000), // Limit body size
        timing: {
          start: startTime,
          end: Date.now(),
          duration,
        },
      })

      port.postMessage(event)

      return response
    } catch (error) {
      // Log failed requests
      const event = createEvent('page', 'network.error', {
        url,
        method,
        error: String(error),
        timing: {
          start: startTime,
          end: Date.now(),
          duration: Date.now() - startTime,
        },
      })

      port.postMessage(event)
      throw error
    }
  }
}

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    injectPageScript()
    interceptConsole()
    interceptFetch()
  })
} else {
  injectPageScript()
  interceptConsole()
  interceptFetch()
}

// Notify that content script is ready
console.log('Curupira content script loaded')

// Export for page access
declare global {
  interface Window {
    __CURUPIRA_BRIDGE__: {
      init: (config: any) => void
      registerZustandStores: (stores: any) => void
      registerApolloClient: (client: any) => void
    }
  }
}

window.__CURUPIRA_BRIDGE__ = {
  init: (config) => {
    console.log('Curupira initialized with config:', config)
    port.postMessage(createEvent('page', 'init', config))
  },
  
  registerZustandStores: (stores) => {
    console.log('Registering Zustand stores:', stores)
    port.postMessage(createEvent('page', 'register.zustand', { stores }))
  },
  
  registerApolloClient: (client) => {
    console.log('Registering Apollo client')
    port.postMessage(createEvent('page', 'register.apollo', { hasClient: true }))
  },
}