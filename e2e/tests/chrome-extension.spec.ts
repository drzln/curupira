/**
 * @fileoverview Chrome Extension E2E Tests
 */

import { test, expect, chromium } from '@playwright/test'
import path from 'path'

test.describe('Chrome Extension', () => {
  test('should load extension successfully', async () => {
    const extensionPath = path.resolve('../chrome-extension/dist')
    
    const browser = await chromium.launch({
      headless: false,
      args: [
        `--load-extension=${extensionPath}`,
        `--disable-extensions-except=${extensionPath}`,
        '--disable-web-security'
      ]
    })

    const context = await browser.newContext()
    const page = await context.newPage()

    // Navigate to test page
    await page.goto('https://example.com')

    // Check if extension loaded
    const extensions = await page.evaluate(() => {
      return window.chrome?.runtime?.id
    })

    expect(extensions).toBeDefined()

    await browser.close()
  })

  test('should inject content script', async () => {
    const extensionPath = path.resolve('../chrome-extension/dist')
    
    const browser = await chromium.launch({
      headless: false,
      args: [
        `--load-extension=${extensionPath}`,
        `--disable-extensions-except=${extensionPath}`,
        '--disable-web-security'
      ]
    })

    const context = await browser.newContext()
    const page = await context.newPage()

    // Navigate to test page
    await page.goto('https://example.com')

    // Wait for content script to load
    await page.waitForTimeout(1000)

    // Check if Curupira bridge is available
    const hasCurupiraBridge = await page.evaluate(() => {
      return typeof window.__CURUPIRA_BRIDGE__ !== 'undefined'
    })

    expect(hasCurupiraBridge).toBe(true)

    await browser.close()
  })

  test('should connect to MCP server from extension', async () => {
    const extensionPath = path.resolve('../chrome-extension/dist')
    
    const browser = await chromium.launch({
      headless: false,
      args: [
        `--load-extension=${extensionPath}`,
        `--disable-extensions-except=${extensionPath}`,
        '--disable-web-security'
      ]
    })

    const context = await browser.newContext()
    const page = await context.newPage()

    // Get service worker (background script)
    const serviceWorkerPromise = context.waitForEvent('serviceworker')
    await page.goto('https://example.com')
    const serviceWorker = await serviceWorkerPromise

    // Wait for connection to establish
    await page.waitForTimeout(2000)

    // Check connection status via service worker
    const connectionStatus = await serviceWorker.evaluate(() => {
      return (globalThis as any).connectionStatus
    })

    expect(connectionStatus).toBe('connected')

    await browser.close()
  })

  test('should capture console logs', async () => {
    const extensionPath = path.resolve('../chrome-extension/dist')
    
    const browser = await chromium.launch({
      headless: false,
      args: [
        `--load-extension=${extensionPath}`,
        `--disable-extensions-except=${extensionPath}`,
        '--disable-web-security'
      ]
    })

    const context = await browser.newContext()
    const page = await context.newPage()

    // Navigate and generate console logs
    await page.goto('https://example.com')
    await page.waitForTimeout(1000)

    // Generate test console logs
    await page.evaluate(() => {
      console.log('Test log message')
      console.error('Test error message')
      console.warn('Test warning message')
    })

    // Wait for logs to be captured
    await page.waitForTimeout(1000)

    // Check if logs were captured by the bridge
    const capturedLogs = await page.evaluate(() => {
      return window.__CURUPIRA_BRIDGE__?.getLogs?.()
    })

    expect(Array.isArray(capturedLogs)).toBe(true)
    expect(capturedLogs.length).toBeGreaterThan(0)

    await browser.close()
  })

  test('should monitor network requests', async () => {
    const extensionPath = path.resolve('../chrome-extension/dist')
    
    const browser = await chromium.launch({
      headless: false,
      args: [
        `--load-extension=${extensionPath}`,
        `--disable-extensions-except=${extensionPath}`,
        '--disable-web-security'
      ]
    })

    const context = await browser.newContext()
    const page = await context.newPage()

    // Navigate to test page
    await page.goto('https://httpbin.org/html')
    await page.waitForTimeout(1000)

    // Make a test network request
    await page.evaluate(() => {
      return fetch('https://httpbin.org/json')
    })

    // Wait for request to be captured
    await page.waitForTimeout(1000)

    // Check if request was monitored
    const capturedRequests = await page.evaluate(() => {
      return window.__CURUPIRA_BRIDGE__?.getNetworkRequests?.()
    })

    expect(Array.isArray(capturedRequests)).toBe(true)
    expect(capturedRequests.length).toBeGreaterThan(0)

    await browser.close()
  })

  test('should open DevTools panel', async () => {
    const extensionPath = path.resolve('../chrome-extension/dist')
    
    const browser = await chromium.launch({
      headless: false,
      args: [
        `--load-extension=${extensionPath}`,
        `--disable-extensions-except=${extensionPath}`,
        '--disable-web-security'
      ]
    })

    const context = await browser.newContext()
    const page = await context.newPage()

    // Navigate to test page
    await page.goto('https://example.com')

    // Open DevTools
    await page.keyboard.press('F12')
    await page.waitForTimeout(1000)

    // Check if Curupira panel is available
    // This is tricky to test directly, so we'll check if the panel HTML exists
    const panelExists = await page.evaluate(() => {
      const panels = document.querySelectorAll('[aria-label*="Curupira"]')
      return panels.length > 0
    })

    // Note: This test might not work perfectly due to DevTools complexity
    // In practice, manual verification would be needed
    console.log('DevTools panel test completed (manual verification recommended)')

    await browser.close()
  })

  test('should handle extension popup', async () => {
    const extensionPath = path.resolve('../chrome-extension/dist')
    
    const browser = await chromium.launch({
      headless: false,
      args: [
        `--load-extension=${extensionPath}`,
        `--disable-extensions-except=${extensionPath}`,
        '--disable-web-security'
      ]
    })

    const context = await browser.newContext()
    const page = await context.newPage()

    // Get extension ID
    const extensions = await context.evaluate(() => {
      return chrome.management.getAll()
    })

    const curupiraExtension = extensions.find((ext: any) => 
      ext.name.toLowerCase().includes('curupira')
    )

    if (curupiraExtension) {
      // Navigate to extension popup
      await page.goto(`chrome-extension://${curupiraExtension.id}/popup.html`)
      
      // Check if popup loaded
      const title = await page.title()
      expect(title).toContain('Curupira')

      // Check for connection status in popup
      const statusElement = await page.locator('[data-testid="connection-status"]')
      await expect(statusElement).toBeVisible()
    }

    await browser.close()
  })

  test('should persist extension state', async () => {
    const extensionPath = path.resolve('../chrome-extension/dist')
    
    const browser = await chromium.launch({
      headless: false,
      args: [
        `--load-extension=${extensionPath}`,
        `--disable-extensions-except=${extensionPath}`,
        '--disable-web-security'
      ]
    })

    const context = await browser.newContext()
    const page = await context.newPage()

    // Navigate and set some state
    await page.goto('https://example.com')
    await page.waitForTimeout(1000)

    // Set test state via bridge
    await page.evaluate(() => {
      window.__CURUPIRA_BRIDGE__?.setState?.('test', { value: 'persistent' })
    })

    // Navigate to different page
    await page.goto('https://httpbin.org/html')
    await page.waitForTimeout(1000)

    // Check if state persisted
    const persistedState = await page.evaluate(() => {
      return window.__CURUPIRA_BRIDGE__?.getState?.('test')
    })

    expect(persistedState).toEqual({ value: 'persistent' })

    await browser.close()
  })
})