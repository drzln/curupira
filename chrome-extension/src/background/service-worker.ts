import browser from 'webextension-polyfill'
import { 
  ExtensionMessageType, 
  ExtensionStorage, 
  ExtensionMessaging, 
  StorageKey,
  ConnectionStatus,
  DEFAULT_SETTINGS,
  type ExtensionMessage,
  type ExtensionStats,
  type ExtensionSettings
} from '../shared/bridge.js'

// MCP server connection
let mcpSocket: WebSocket | null = null
let connectionStatus: ConnectionStatus = ConnectionStatus.DISCONNECTED
let settings: ExtensionSettings = DEFAULT_SETTINGS

// Connection management
const contentConnections = new Map<number, browser.Runtime.Port>()
const devtoolsConnections = new Map<number, browser.Runtime.Port>()

// Statistics
let stats: ExtensionStats = {
  console: 0,
  network: 0,
  react: 0,
  errors: 0,
  lastUpdate: Date.now()
}

// Initialize extension
browser.runtime.onInstalled.addListener(async () => {
  console.log('Curupira extension installed')
  
  // Load settings and stats
  await loadSettings()
  await loadStats()
  
  // Connect to MCP server
  connectToMCPServer()
})

// Load settings from storage
async function loadSettings() {
  const stored = await ExtensionStorage.get<ExtensionSettings>(StorageKey.SETTINGS)
  if (stored) {
    settings = { ...DEFAULT_SETTINGS, ...stored }
  } else {
    await ExtensionStorage.set(StorageKey.SETTINGS, settings)
  }
}

// Load statistics from storage
async function loadStats() {
  const stored = await ExtensionStorage.get<ExtensionStats>(StorageKey.STATS)
  if (stored) {
    stats = stored
  } else {
    await ExtensionStorage.set(StorageKey.STATS, stats)
  }
}

// Save statistics to storage
async function saveStats() {
  stats.lastUpdate = Date.now()
  await ExtensionStorage.set(StorageKey.STATS, stats)
}

// Connect to MCP server
function connectToMCPServer() {
  if (mcpSocket?.readyState === WebSocket.OPEN) {
    return
  }

  try {
    updateConnectionStatus(ConnectionStatus.CONNECTING)
    mcpSocket = new WebSocket(settings.mcpServerUrl)

    mcpSocket.onopen = () => {
      console.log('Connected to Curupira MCP server')
      updateConnectionStatus(ConnectionStatus.CONNECTED)
    }

    mcpSocket.onclose = () => {
      console.log('Disconnected from MCP server')
      updateConnectionStatus(ConnectionStatus.DISCONNECTED)
      
      // Auto-reconnect if enabled
      if (settings.autoReconnect) {
        setTimeout(connectToMCPServer, 5000)
      }
    }

    mcpSocket.onerror = (error) => {
      console.error('MCP WebSocket error:', error)
      updateConnectionStatus(ConnectionStatus.ERROR)
      stats.errors++
      saveStats()
    }

    mcpSocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        handleMCPMessage(message)
      } catch (error) {
        console.error('Failed to parse MCP message:', error)
        stats.errors++
        saveStats()
      }
    }
  } catch (error) {
    console.error('Failed to connect to MCP server:', error)
    updateConnectionStatus(ConnectionStatus.ERROR)
    
    if (settings.autoReconnect) {
      setTimeout(connectToMCPServer, 5000)
    }
  }
}

// Update connection status
function updateConnectionStatus(status: ConnectionStatus) {
  connectionStatus = status
  
  // Update badge
  switch (status) {
    case ConnectionStatus.CONNECTED:
      browser.action.setBadgeText({ text: '✓' })
      browser.action.setBadgeBackgroundColor({ color: '#4CAF50' })
      break
    case ConnectionStatus.CONNECTING:
      browser.action.setBadgeText({ text: '...' })
      browser.action.setBadgeBackgroundColor({ color: '#FF9800' })
      break
    case ConnectionStatus.DISCONNECTED:
      browser.action.setBadgeText({ text: '✗' })
      browser.action.setBadgeBackgroundColor({ color: '#F44336' })
      break
    case ConnectionStatus.ERROR:
      browser.action.setBadgeText({ text: '!' })
      browser.action.setBadgeBackgroundColor({ color: '#9C27B0' })
      break
  }

  // Notify all connections
  broadcastToAll({
    type: ExtensionMessageType.CONNECTION_STATUS,
    data: { status, timestamp: Date.now() }
  })
}

// Handle messages from MCP server
function handleMCPMessage(message: any) {
  console.log('Received MCP message:', message)

  // Route based on message type
  if (message.method?.startsWith('resources/')) {
    // Resource updates go to DevTools
    broadcastToDevTools({
      type: ExtensionMessageType.DATA_UPDATE,
      data: message
    })
  } else if (message.method?.startsWith('tools/')) {
    // Tool results go to DevTools
    broadcastToDevTools({
      type: ExtensionMessageType.TOOL_RESULT,
      data: message
    })
  } else {
    // General messages go to all connections
    broadcastToAll({
      type: ExtensionMessageType.MCP_RESPONSE,
      data: message
    })
  }
}

// Handle connections from content scripts and DevTools
browser.runtime.onConnect.addListener((port) => {
  const tabId = port.sender?.tab?.id

  if (port.name === 'curupira-content' && tabId) {
    handleContentConnection(port, tabId)
  } else if (port.name === 'curupira-devtools' && tabId) {
    handleDevToolsConnection(port, tabId)
  }
})

// Handle content script connection
function handleContentConnection(port: browser.Runtime.Port, tabId: number) {
  console.log('Content script connected from tab:', tabId)
  contentConnections.set(tabId, port)

  port.onMessage.addListener((message: ExtensionMessage) => {
    console.log('Message from content script:', message)
    handleContentMessage(message, tabId)
  })

  port.onDisconnect.addListener(() => {
    console.log('Content script disconnected from tab:', tabId)
    contentConnections.delete(tabId)
  })

  // Send initial connection status
  port.postMessage({
    type: ExtensionMessageType.CONNECTION_STATUS,
    data: { status: connectionStatus, timestamp: Date.now() }
  })
}

// Handle DevTools connection
function handleDevToolsConnection(port: browser.Runtime.Port, tabId: number) {
  console.log('DevTools connected from tab:', tabId)
  devtoolsConnections.set(tabId, port)

  port.onMessage.addListener((message: ExtensionMessage) => {
    console.log('Message from DevTools:', message)
    handleDevToolsMessage(message, tabId)
  })

  port.onDisconnect.addListener(() => {
    console.log('DevTools disconnected from tab:', tabId)
    devtoolsConnections.delete(tabId)
  })

  // Send initial data
  port.postMessage({
    type: ExtensionMessageType.CONNECTION_STATUS,
    data: { status: connectionStatus, timestamp: Date.now() }
  })
}

// Handle content script messages
function handleContentMessage(message: ExtensionMessage, tabId: number) {
  // Update statistics based on message type
  switch (message.type) {
    case ExtensionMessageType.PAGE_EVENT:
      updateStatsForPageEvent(message.data)
      break
  }

  // Forward to MCP server
  if (mcpSocket?.readyState === WebSocket.OPEN) {
    mcpSocket.send(JSON.stringify(message))
  }

  // Forward to DevTools
  const devToolsPort = devtoolsConnections.get(tabId)
  if (devToolsPort) {
    devToolsPort.postMessage(message)
  }
}

// Handle DevTools messages
function handleDevToolsMessage(message: ExtensionMessage, tabId: number) {
  switch (message.type) {
    case ExtensionMessageType.TOOL_CALL:
      // Forward tool calls to MCP server
      if (mcpSocket?.readyState === WebSocket.OPEN) {
        const mcpMessage = {
          jsonrpc: '2.0',
          id: `tool_${Date.now()}`,
          method: 'tools/call',
          params: {
            name: message.data.action,
            arguments: message.data.data || {}
          }
        }
        mcpSocket.send(JSON.stringify(mcpMessage))
      }
      break
      
    case ExtensionMessageType.GET_CONNECTION_STATUS:
      // Send connection status back
      const devToolsPort = devtoolsConnections.get(tabId)
      if (devToolsPort) {
        devToolsPort.postMessage({
          type: ExtensionMessageType.CONNECTION_STATUS,
          data: { status: connectionStatus, timestamp: Date.now() }
        })
      }
      break
  }
}

// Update statistics for page events
function updateStatsForPageEvent(eventData: any) {
  if (!eventData || !eventData.type) return

  const eventType = eventData.type
  
  if (eventType.startsWith('console.')) {
    stats.console++
  } else if (eventType.startsWith('network.')) {
    stats.network++
  } else if (eventType.startsWith('react.')) {
    stats.react++
  } else if (eventType.startsWith('error.')) {
    stats.errors++
  }

  // Save stats periodically
  saveStats()
}

// Handle runtime messages from popup and other components
browser.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  switch (message.type) {
    case ExtensionMessageType.GET_CONNECTION_STATUS:
      sendResponse({
        connected: connectionStatus === ConnectionStatus.CONNECTED,
        status: connectionStatus,
        lastUpdate: stats.lastUpdate
      })
      break

    case ExtensionMessageType.RECONNECT:
      connectToMCPServer()
      sendResponse({ success: true })
      break

    case ExtensionMessageType.TEST_CONNECTION:
      testConnection().then(success => {
        sendResponse({ success })
      })
      break

    case ExtensionMessageType.CLEAR_DATA:
      clearData()
      sendResponse({ success: true })
      break

    case ExtensionMessageType.TOGGLE_DEBUGGING:
      toggleDebugging(message.tabId!, message.data.enabled)
      sendResponse({ success: true })
      break
  }
  
  // Return true for async responses
  return true
})

// Test connection to MCP server
async function testConnection(): Promise<boolean> {
  try {
    if (mcpSocket?.readyState === WebSocket.OPEN) {
      // Send a ping message
      const testMessage = {
        jsonrpc: '2.0',
        id: 'test_' + Date.now(),
        method: 'resources/list',
        params: {}
      }
      
      mcpSocket.send(JSON.stringify(testMessage))
      return true
    }
    return false
  } catch (error) {
    console.error('Connection test failed:', error)
    return false
  }
}

// Clear extension data
async function clearData() {
  // Reset stats
  stats = {
    console: 0,
    network: 0,
    react: 0,
    errors: 0,
    lastUpdate: Date.now()
  }
  
  await saveStats()
  
  // Notify all connections
  broadcastToAll({
    type: ExtensionMessageType.CLEAR_DATA,
    data: { timestamp: Date.now() }
  })
}

// Toggle debugging for a tab
async function toggleDebugging(tabId: number, enabled: boolean) {
  await ExtensionStorage.set(
    StorageKey.DEBUG_STATUS, 
    { [tabId]: enabled }
  )

  // Notify content script
  const contentPort = contentConnections.get(tabId)
  if (contentPort) {
    contentPort.postMessage({
      type: ExtensionMessageType.TOGGLE_DEBUGGING,
      data: { enabled }
    })
  }
}

// Broadcast to all connections
function broadcastToAll(message: ExtensionMessage) {
  // Broadcast to content scripts
  for (const [tabId, port] of contentConnections) {
    try {
      port.postMessage({ ...message, tabId })
    } catch (error) {
      console.error(`Failed to send to content script in tab ${tabId}:`, error)
      contentConnections.delete(tabId)
    }
  }

  // Broadcast to DevTools
  broadcastToDevTools(message)
}

// Broadcast to DevTools connections
function broadcastToDevTools(message: ExtensionMessage) {
  for (const [tabId, port] of devtoolsConnections) {
    try {
      port.postMessage({ ...message, tabId })
    } catch (error) {
      console.error(`Failed to send to DevTools in tab ${tabId}:`, error)
      devtoolsConnections.delete(tabId)
    }
  }
}

// Export for external access (for debugging)
;(globalThis as any).curupira = {
  isConnected: () => connectionStatus === ConnectionStatus.CONNECTED,
  reconnect: () => connectToMCPServer(),
  getStats: () => stats,
  getConnections: () => ({
    content: contentConnections.size,
    devtools: devtoolsConnections.size
  })
}