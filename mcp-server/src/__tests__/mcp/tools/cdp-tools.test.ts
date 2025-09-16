/**
 * Tests for CDP Tool Provider
 * Level 2: MCP Core tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CDPToolProvider } from '../../../mcp/tools/providers/cdp-tools.js'
import { ChromeManager } from '../../../chrome/manager.js'
import { mockChromeClient, resetAllMocks, createCDPResponse, createCDPError, testSessionId } from '../../setup.js'

// Mock ChromeManager
vi.mock('../../../chrome/manager.js', () => ({
  ChromeManager: {
    getInstance: vi.fn(() => ({
      getClient: () => mockChromeClient,
    })),
  },
}))

describe('CDPToolProvider', () => {
  let provider: CDPToolProvider

  beforeEach(() => {
    resetAllMocks()
    provider = new CDPToolProvider()
  })

  describe('listTools', () => {
    it('should return all CDP tools', () => {
      const tools = provider.listTools()
      
      expect(tools).toHaveLength(6)
      
      const toolNames = tools.map(t => t.name)
      expect(toolNames).toContain('cdp_evaluate')
      expect(toolNames).toContain('cdp_navigate')
      expect(toolNames).toContain('cdp_screenshot')
      expect(toolNames).toContain('cdp_get_cookies')
      expect(toolNames).toContain('cdp_set_cookie')
      expect(toolNames).toContain('cdp_clear_cookies')
    })
  })

  describe('cdp_evaluate', () => {
    const handler = new CDPToolProvider().getHandler('cdp_evaluate')!

    it('should evaluate JavaScript expression', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPResponse({
          result: { type: 'string', value: 'test result' },
        }))

      const result = await handler.execute({
        expression: 'document.title',
      })

      expect(mockChromeClient.send).toHaveBeenCalledWith('Runtime.enable', {}, testSessionId)
      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Runtime.evaluate',
        {
          expression: 'document.title',
          returnByValue: true,
          awaitPromise: true,
        },
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: 'test result',
      })
    })

    it('should handle evaluation errors', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPError('ReferenceError: foo is not defined'))

      const result = await handler.execute({
        expression: 'foo.bar',
      })

      expect(result).toEqual({
        success: false,
        error: 'Evaluation error: ReferenceError: foo is not defined',
        data: expect.objectContaining({
          text: 'ReferenceError: foo is not defined',
        }),
      })
    })
  })

  describe('cdp_navigate', () => {
    const handler = new CDPToolProvider().getHandler('cdp_navigate')!

    it('should navigate to URL', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Page.enable
        .mockResolvedValueOnce(createCDPResponse({ frameId: 'frame-123' }))
        .mockResolvedValueOnce(undefined) // Page.waitForLoadEvent

      const result = await handler.execute({
        url: 'https://example.com',
      })

      expect(mockChromeClient.send).toHaveBeenCalledWith('Page.enable', {}, testSessionId)
      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Page.navigate',
        { url: 'https://example.com' },
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: { frameId: 'frame-123', url: 'https://example.com' },
      })
    })

    it('should handle navigation errors', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Page.enable
        .mockRejectedValueOnce(new Error('Navigation failed'))

      const result = await handler.execute({
        url: 'https://invalid-url',
      })

      expect(result).toEqual({
        success: false,
        error: 'Navigation failed',
      })
    })
  })

  describe('cdp_screenshot', () => {
    const handler = new CDPToolProvider().getHandler('cdp_screenshot')!

    it('should take a screenshot', async () => {
      const mockScreenshot = 'base64-encoded-image-data'
      
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Page.enable
        .mockResolvedValueOnce(createCDPResponse({ data: mockScreenshot }))

      const result = await handler.execute({})

      expect(mockChromeClient.send).toHaveBeenCalledWith('Page.enable', {}, testSessionId)
      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Page.captureScreenshot',
        {
          format: 'png',
          captureBeyondViewport: false,
          clip: undefined,
        },
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: {
          screenshot: `data:image/png;base64,${mockScreenshot}`,
          fullPage: false,
          selector: undefined,
        },
      })
    })

    it('should take a full page screenshot', async () => {
      const mockScreenshot = 'full-page-screenshot-data'
      
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Page.enable
        .mockResolvedValueOnce(createCDPResponse({ data: mockScreenshot }))

      const result = await handler.execute({
        fullPage: true,
      })

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Page.captureScreenshot',
        {
          format: 'png',
          captureBeyondViewport: true,
          clip: undefined,
        },
        testSessionId
      )
      expect(result.data.fullPage).toBe(true)
    })
  })

  describe('cdp_get_cookies', () => {
    const handler = new CDPToolProvider().getHandler('cdp_get_cookies')!

    it('should get all cookies', async () => {
      const mockCookies = [
        { name: 'session', value: 'abc123', domain: 'example.com' },
        { name: 'prefs', value: 'dark-mode', domain: 'example.com' },
      ]
      
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Network.enable
        .mockResolvedValueOnce(createCDPResponse({ cookies: mockCookies }))

      const result = await handler.execute({})

      expect(mockChromeClient.send).toHaveBeenCalledWith('Network.enable', {}, testSessionId)
      expect(mockChromeClient.send).toHaveBeenCalledWith('Network.getCookies', {}, testSessionId)
      expect(result).toEqual({
        success: true,
        data: mockCookies,
      })
    })

    it('should filter cookies by URL', async () => {
      const mockCookies = [
        { name: 'session', value: 'abc123', domain: 'example.com' },
      ]
      
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Network.enable
        .mockResolvedValueOnce(createCDPResponse({ cookies: mockCookies }))

      const result = await handler.execute({
        urls: ['https://example.com'],
      })

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Network.getCookies',
        { urls: ['https://example.com'] },
        testSessionId
      )
    })
  })

  describe('cdp_set_cookie', () => {
    const handler = new CDPToolProvider().getHandler('cdp_set_cookie')!

    it('should set a cookie', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Network.enable
        .mockResolvedValueOnce(createCDPResponse({ success: true }))

      const result = await handler.execute({
        name: 'test-cookie',
        value: 'test-value',
        domain: 'example.com',
      })

      expect(mockChromeClient.send).toHaveBeenCalledWith('Network.enable', {}, testSessionId)
      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Network.setCookie',
        {
          name: 'test-cookie',
          value: 'test-value',
          domain: 'example.com',
        },
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: { success: true },
      })
    })
  })

  describe('cdp_clear_cookies', () => {
    const handler = new CDPToolProvider().getHandler('cdp_clear_cookies')!

    it('should clear all cookies', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Network.enable
        .mockResolvedValueOnce(undefined) // Network.clearBrowserCookies

      const result = await handler.execute({})

      expect(mockChromeClient.send).toHaveBeenCalledWith('Network.enable', {}, testSessionId)
      expect(mockChromeClient.send).toHaveBeenCalledWith('Network.clearBrowserCookies', {}, testSessionId)
      expect(result).toEqual({
        success: true,
        data: { message: 'Cookies cleared' },
      })
    })
  })
})