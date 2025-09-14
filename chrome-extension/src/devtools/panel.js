// DevTools panel implementation
class CurupiraPanel {
  constructor() {
    this.backgroundConnection = null
    this.consoleEntries = []
    this.networkEntries = []
    this.currentTab = 'console'
    
    this.init()
  }

  init() {
    this.setupEventListeners()
    this.connectToBackground()
    this.setupTabSwitching()
  }

  setupEventListeners() {
    // Console
    document.getElementById('clear-console').addEventListener('click', () => {
      this.clearConsole()
    })

    document.getElementById('console-filter').addEventListener('input', (e) => {
      this.filterConsole(e.target.value)
    })

    // Network
    document.getElementById('clear-network').addEventListener('click', () => {
      this.clearNetwork()
    })

    document.getElementById('network-filter').addEventListener('input', (e) => {
      this.filterNetwork(e.target.value)
    })

    // State
    document.getElementById('refresh-state').addEventListener('click', () => {
      this.refreshState()
    })

    document.getElementById('state-type').addEventListener('change', (e) => {
      this.refreshState(e.target.value)
    })

    // Tools
    document.getElementById('navigate-btn').addEventListener('click', () => {
      const url = document.getElementById('navigate-url').value
      this.navigate(url)
    })

    document.getElementById('reload-btn').addEventListener('click', () => {
      this.reload()
    })

    document.getElementById('back-btn').addEventListener('click', () => {
      this.goBack()
    })

    document.getElementById('forward-btn').addEventListener('click', () => {
      this.goForward()
    })

    document.getElementById('eval-btn').addEventListener('click', () => {
      const code = document.getElementById('eval-code').value
      this.evaluate(code)
    })

    document.getElementById('click-btn').addEventListener('click', () => {
      const selector = document.getElementById('click-selector').value
      this.clickElement(selector)
    })

    document.getElementById('type-btn').addEventListener('click', () => {
      const selector = document.getElementById('type-selector').value
      const text = document.getElementById('type-text').value
      this.typeText(selector, text)
    })

    document.getElementById('screenshot-btn').addEventListener('click', () => {
      this.takeScreenshot()
    })
  }

  setupTabSwitching() {
    const navButtons = document.querySelectorAll('.nav-button')
    const tabContents = document.querySelectorAll('.tab-content')

    navButtons.forEach(button => {
      button.addEventListener('click', () => {
        const tabName = button.dataset.tab
        
        // Update active button
        navButtons.forEach(b => b.classList.remove('active'))
        button.classList.add('active')
        
        // Update active tab
        tabContents.forEach(tab => tab.classList.remove('active'))
        document.getElementById(`${tabName}-tab`).classList.add('active')
        
        this.currentTab = tabName
      })
    })
  }

  connectToBackground() {
    // Connect to background script
    this.backgroundConnection = chrome.runtime.connect({
      name: 'curupira-devtools'
    })

    this.backgroundConnection.onMessage.addListener((message) => {
      this.handleMessage(message)
    })

    this.backgroundConnection.onDisconnect.addListener(() => {
      console.log('DevTools disconnected from background')
      this.updateConnectionStatus('disconnected')
    })

    // Check initial connection status
    this.checkConnectionStatus()
  }

  handleMessage(message) {
    console.log('DevTools received message:', message)

    switch (message.type) {
      case 'console.log':
        this.addConsoleEntry(message.data)
        break
      case 'network.request':
        this.addNetworkEntry(message.data)
        break
      case 'network.error':
        this.addNetworkEntry({ ...message.data, status: 'error' })
        break
      case 'state.update':
        this.updateStateTree(message.data)
        break
      case 'connection.status':
        this.updateConnectionStatus(message.data.status)
        break
      case 'tool.result':
        this.displayToolResult(message.data)
        break
    }
  }

  checkConnectionStatus() {
    // Check if background script is connected to MCP server
    chrome.runtime.sendMessage({ type: 'GET_CONNECTION_STATUS' }, (response) => {
      if (response) {
        this.updateConnectionStatus(response.connected ? 'connected' : 'disconnected')
      }
    })
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

  addConsoleEntry(data) {
    const entry = {
      ...data,
      id: Date.now() + Math.random()
    }
    
    this.consoleEntries.push(entry)
    this.renderConsoleEntries()
  }

  renderConsoleEntries(filter = '') {
    const container = document.getElementById('console-logs')
    container.innerHTML = ''

    const filtered = this.consoleEntries.filter(entry => 
      !filter || entry.message.toLowerCase().includes(filter.toLowerCase())
    )

    filtered.forEach(entry => {
      const div = document.createElement('div')
      div.className = 'console-entry'
      
      const timestamp = new Date(entry.timestamp).toLocaleTimeString()
      
      div.innerHTML = `
        <span class="console-level ${entry.level}">${entry.level[0].toUpperCase()}</span>
        <span class="console-timestamp">${timestamp}</span>
        <span class="console-message">${this.escapeHtml(entry.message)}</span>
      `
      
      container.appendChild(div)
    })

    // Scroll to bottom
    container.scrollTop = container.scrollHeight
  }

  clearConsole() {
    this.consoleEntries = []
    this.renderConsoleEntries()
  }

  filterConsole(filter) {
    this.renderConsoleEntries(filter)
  }

  addNetworkEntry(data) {
    const entry = {
      ...data,
      id: Date.now() + Math.random()
    }
    
    this.networkEntries.push(entry)
    this.renderNetworkEntries()
  }

  renderNetworkEntries(filter = '') {
    const container = document.getElementById('network-requests')
    container.innerHTML = ''

    const filtered = this.networkEntries.filter(entry => 
      !filter || entry.url.toLowerCase().includes(filter.toLowerCase())
    )

    filtered.forEach(entry => {
      const div = document.createElement('div')
      div.className = 'network-entry'
      
      const status = entry.status === 'error' ? 'ERR' : entry.status
      const statusClass = entry.status >= 200 && entry.status < 300 ? 'success' : 'error'
      
      div.innerHTML = `
        <span class="network-method ${entry.method}">${entry.method}</span>
        <span class="network-url" title="${entry.url}">${this.truncateUrl(entry.url)}</span>
        <span class="network-status ${statusClass}">${status}</span>
        <span class="network-size">-</span>
        <span class="network-duration">${entry.timing?.duration || 0}ms</span>
      `
      
      container.appendChild(div)
    })
  }

  clearNetwork() {
    this.networkEntries = []
    this.renderNetworkEntries()
  }

  filterNetwork(filter) {
    this.renderNetworkEntries(filter)
  }

  refreshState(type = 'react') {
    this.sendToolMessage('get_state', { type })
  }

  updateStateTree(data) {
    const container = document.getElementById('state-tree')
    container.innerHTML = this.renderStateObject(data, 0)
  }

  renderStateObject(obj, depth) {
    if (typeof obj !== 'object' || obj === null) {
      return `<span class="state-value">${JSON.stringify(obj)}</span>`
    }

    let html = '<span class="state-object">{</span><br>'
    
    for (const [key, value] of Object.entries(obj)) {
      const indent = '  '.repeat(depth + 1)
      html += `${indent}<span class="state-key">"${key}"</span>: `
      
      if (typeof value === 'object' && value !== null) {
        html += this.renderStateObject(value, depth + 1)
      } else {
        html += `<span class="state-value">${JSON.stringify(value)}</span>`
      }
      
      html += ',<br>'
    }
    
    html += '  '.repeat(depth) + '<span class="state-object">}</span>'
    return html
  }

  // Tool methods
  navigate(url) {
    this.sendToolMessage('navigate', { url })
  }

  reload() {
    this.sendToolMessage('reload')
  }

  goBack() {
    this.sendToolMessage('back')
  }

  goForward() {
    this.sendToolMessage('forward')
  }

  evaluate(code) {
    this.sendToolMessage('evaluate', { code })
  }

  clickElement(selector) {
    this.sendToolMessage('click', { selector })
  }

  typeText(selector, text) {
    this.sendToolMessage('type', { selector, text })
  }

  takeScreenshot() {
    this.sendToolMessage('screenshot')
  }

  sendToolMessage(action, data = {}) {
    const message = {
      type: 'TOOL_CALL',
      action,
      data,
      tabId: chrome.devtools.inspectedWindow.tabId
    }
    
    this.backgroundConnection.postMessage(message)
  }

  displayToolResult(result) {
    if (this.currentTab === 'tools') {
      const resultElement = document.getElementById('eval-result')
      if (resultElement) {
        resultElement.textContent = JSON.stringify(result, null, 2)
      }
    }
  }

  // Utility methods
  escapeHtml(text) {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  truncateUrl(url, maxLength = 60) {
    if (url.length <= maxLength) return url
    return url.substring(0, maxLength - 3) + '...'
  }
}

// Initialize panel
const panel = new CurupiraPanel()

// Expose for debugging
window.__CURUPIRA_PANEL__ = panel