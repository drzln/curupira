// Popup implementation
class CurupiraPopup {
  constructor() {
    this.stats = {
      console: 0,
      network: 0,
      react: 0
    }
    
    this.isDebugging = false
    this.init()
  }

  async init() {
    await this.loadCurrentTab()
    await this.loadStats()
    await this.checkConnectionStatus()
    this.setupEventListeners()
    this.startStatsUpdater()
  }

  async loadCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tab) {
        document.getElementById('page-url').textContent = tab.url
        await this.detectPageFeatures(tab.id)
        await this.loadDebuggingStatus(tab.id)
      }
    } catch (error) {
      console.error('Failed to load current tab:', error)
    }
  }

  async detectPageFeatures(tabId) {
    try {
      // Try to detect features from injected script
      const results = await chrome.tabs.sendMessage(tabId, { 
        type: 'GET_FEATURES' 
      })
      
      if (results && results.features) {
        this.updateFeatureStatus(results.features)
      }
    } catch (error) {
      // Content script might not be ready
      console.log('Could not detect page features:', error)
    }
  }

  updateFeatureStatus(features) {
    const featureElements = document.querySelectorAll('.feature')
    
    featureElements.forEach(element => {
      const feature = element.dataset.feature
      if (features[feature]) {
        element.classList.add('active')
      } else {
        element.classList.remove('active')
      }
    })
  }

  async loadStats() {
    try {
      const result = await chrome.storage.local.get(['curupira_stats'])
      if (result.curupira_stats) {
        this.stats = { ...this.stats, ...result.curupira_stats }
        this.updateStatsDisplay()
      }
    } catch (error) {
      console.error('Failed to load stats:', error)
    }
  }

  async loadDebuggingStatus(tabId) {
    try {
      const result = await chrome.storage.local.get([`debug_${tabId}`])
      this.isDebugging = !!result[`debug_${tabId}`]
      this.updateDebuggingButton()
    } catch (error) {
      console.error('Failed to load debugging status:', error)
    }
  }

  updateStatsDisplay() {
    document.getElementById('console-count').textContent = this.stats.console || 0
    document.getElementById('network-count').textContent = this.stats.network || 0
    document.getElementById('react-count').textContent = this.stats.react || 0
  }

  updateDebuggingButton() {
    const button = document.getElementById('toggle-debugging')
    const status = document.getElementById('debug-status')
    
    if (this.isDebugging) {
      status.textContent = 'Disable'
      button.style.background = '#dc3545'
      button.style.borderColor = '#dc3545'
      button.style.color = 'white'
    } else {
      status.textContent = 'Enable'
      button.style.background = ''
      button.style.borderColor = ''
      button.style.color = ''
    }
  }

  async checkConnectionStatus() {
    try {
      const response = await chrome.runtime.sendMessage({ 
        type: 'GET_CONNECTION_STATUS' 
      })
      
      if (response) {
        this.updateConnectionStatus(response.connected ? 'connected' : 'disconnected')
        this.updateServerStatus(response.connected ? 'Connected' : 'Disconnected')
        this.updateLastUpdate(response.lastUpdate)
      }
    } catch (error) {
      console.error('Failed to check connection status:', error)
      this.updateConnectionStatus('disconnected')
      this.updateServerStatus('Error')
    }
  }

  updateConnectionStatus(status) {
    const statusElement = document.getElementById('connection-status')
    const dot = statusElement.querySelector('.status-dot')
    const text = statusElement.querySelector('.status-text')

    dot.className = 'status-dot'
    
    switch (status) {
      case 'connected':
        dot.classList.add('connected')
        text.textContent = 'Connected'
        break
      case 'connecting':
        dot.classList.add('connecting')
        text.textContent = 'Connecting...'
        break
      case 'disconnected':
        text.textContent = 'Disconnected'
        break
    }
  }

  updateServerStatus(status) {
    document.getElementById('server-status').textContent = status
  }

  updateLastUpdate(timestamp) {
    const element = document.getElementById('last-update')
    if (timestamp) {
      const date = new Date(timestamp)
      element.textContent = date.toLocaleTimeString()
    } else {
      element.textContent = 'Never'
    }
  }

  setupEventListeners() {
    // Open DevTools
    document.getElementById('open-devtools').addEventListener('click', () => {
      this.openDevTools()
    })

    // Toggle Debugging
    document.getElementById('toggle-debugging').addEventListener('click', () => {
      this.toggleDebugging()
    })

    // Clear Data
    document.getElementById('clear-data').addEventListener('click', () => {
      this.clearData()
    })

    // Reconnect
    document.getElementById('reconnect').addEventListener('click', () => {
      this.reconnect()
    })

    // Test Connection
    document.getElementById('test-connection').addEventListener('click', () => {
      this.testConnection()
    })

    // Help
    document.getElementById('help-link').addEventListener('click', (e) => {
      e.preventDefault()
      this.openHelp()
    })

    // Settings
    document.getElementById('settings-link').addEventListener('click', (e) => {
      e.preventDefault()
      this.openSettings()
    })
  }

  startStatsUpdater() {
    // Update stats every 5 seconds
    setInterval(async () => {
      await this.loadStats()
      await this.checkConnectionStatus()
    }, 5000)
  }

  async openDevTools() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tab) {
        // Open DevTools on the current tab
        await chrome.debugger.attach({ tabId: tab.id }, '1.0')
        await chrome.debugger.sendCommand({ tabId: tab.id }, 'Runtime.enable')
        
        // The DevTools panel should already be registered via manifest
        // Just focus on the DevTools window
        chrome.tabs.create({ 
          url: `chrome-devtools://devtools/bundled/devtools_app.html?ws=localhost:9222/devtools/page/${tab.id}` 
        })
      }
    } catch (error) {
      console.error('Failed to open DevTools:', error)
      // Fallback: just open DevTools normally
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: () => {
              // This will trigger the browser's DevTools
              debugger;
            }
          })
        }
      })
    }
  }

  async toggleDebugging() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tab) {
        this.isDebugging = !this.isDebugging
        
        await chrome.storage.local.set({ 
          [`debug_${tab.id}`]: this.isDebugging 
        })
        
        // Notify background script
        chrome.runtime.sendMessage({
          type: 'TOGGLE_DEBUGGING',
          tabId: tab.id,
          enabled: this.isDebugging
        })
        
        this.updateDebuggingButton()
      }
    } catch (error) {
      console.error('Failed to toggle debugging:', error)
    }
  }

  async clearData() {
    try {
      // Clear stats
      await chrome.storage.local.remove(['curupira_stats'])
      this.stats = { console: 0, network: 0, react: 0 }
      this.updateStatsDisplay()
      
      // Notify background script to clear data
      chrome.runtime.sendMessage({ type: 'CLEAR_DATA' })
      
      console.log('Data cleared')
    } catch (error) {
      console.error('Failed to clear data:', error)
    }
  }

  async reconnect() {
    try {
      this.updateConnectionStatus('connecting')
      this.updateServerStatus('Connecting...')
      
      const response = await chrome.runtime.sendMessage({ type: 'RECONNECT' })
      
      if (response && response.success) {
        this.updateConnectionStatus('connected')
        this.updateServerStatus('Connected')
      } else {
        this.updateConnectionStatus('disconnected')
        this.updateServerStatus('Failed')
      }
    } catch (error) {
      console.error('Failed to reconnect:', error)
      this.updateConnectionStatus('disconnected')
      this.updateServerStatus('Error')
    }
  }

  async testConnection() {
    try {
      const button = document.getElementById('test-connection')
      const originalText = button.textContent
      button.textContent = 'Testing...'
      button.disabled = true
      
      const response = await chrome.runtime.sendMessage({ type: 'TEST_CONNECTION' })
      
      if (response && response.success) {
        button.textContent = 'Success!'
        button.style.background = '#28a745'
        button.style.color = 'white'
        
        setTimeout(() => {
          button.textContent = originalText
          button.style.background = ''
          button.style.color = ''
          button.disabled = false
        }, 2000)
      } else {
        button.textContent = 'Failed'
        button.style.background = '#dc3545'
        button.style.color = 'white'
        
        setTimeout(() => {
          button.textContent = originalText
          button.style.background = ''
          button.style.color = ''
          button.disabled = false
        }, 2000)
      }
    } catch (error) {
      console.error('Failed to test connection:', error)
      
      const button = document.getElementById('test-connection')
      button.textContent = 'Error'
      button.disabled = false
    }
  }

  openHelp() {
    chrome.tabs.create({
      url: 'https://github.com/your-org/curupira#readme'
    })
  }

  openSettings() {
    chrome.runtime.openOptionsPage()
  }
}

// Initialize popup when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new CurupiraPopup()
  })
} else {
  new CurupiraPopup()
}