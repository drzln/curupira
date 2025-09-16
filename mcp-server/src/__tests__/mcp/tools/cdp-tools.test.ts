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
      getTypedClient: () => mockTypedClient,
    })),
  },
}))

// Make mockTypedClient available in tests
let mockTypedClient: any

describe('CDPToolProvider', () => {
  let provider: CDPToolProvider

  beforeEach(() => {
    resetAllMocks()
    vi.clearAllMocks()
    
    // Reset mockTypedClient
    mockTypedClient = {
      enableRuntime: vi.fn().mockResolvedValue(undefined),
      enableDOM: vi.fn().mockResolvedValue(undefined),
      enableNetwork: vi.fn().mockResolvedValue(undefined),
      enablePage: vi.fn().mockResolvedValue(undefined),
      evaluate: vi.fn(),
      navigate: vi.fn(),
      captureScreenshot: vi.fn(),
      getCookies: vi.fn(),
      setCookie: vi.fn(),
      clearCookies: vi.fn().mockResolvedValue(undefined),
      reload: vi.fn().mockResolvedValue(undefined),
      getDocument: vi.fn(),
      querySelector: vi.fn(),
      getBoxModel: vi.fn()
    }
    
    provider = new CDPToolProvider()
  })

  describe('listTools', () => {
    it('should return all CDP tools', () => {
      const tools = provider.listTools()
      
      expect(tools).toHaveLength(7)
      
      const toolNames = tools.map(t => t.name)
      expect(toolNames).toContain('cdp_evaluate')
      expect(toolNames).toContain('cdp_navigate')
      expect(toolNames).toContain('cdp_screenshot')
      expect(toolNames).toContain('cdp_get_cookies')
      expect(toolNames).toContain('cdp_set_cookie')
      expect(toolNames).toContain('cdp_clear_cookies')
      expect(toolNames).toContain('cdp_reload')
    })
  })

  describe('cdp_evaluate', () => {
    it('should evaluate JavaScript expression', async () => {
      mockTypedClient.evaluate.mockResolvedValueOnce({
        result: {
          type: 'string',
          value: 'test result'
        }
      })

      const handler = provider.getHandler('cdp_evaluate')!
      const result = await handler.execute({
        expression: 'document.title',
      })

      expect(mockTypedClient.enableRuntime).toHaveBeenCalledWith(testSessionId)
      expect(mockTypedClient.evaluate).toHaveBeenCalledWith(
        'document.title',
        {
          returnByValue: true,
          awaitPromise: true
        },
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: 'test result',
      })
    })

    it('should handle evaluation errors', async () => {
      mockTypedClient.evaluate.mockResolvedValueOnce({
        result: {
          type: 'undefined'
        },
        exceptionDetails: {
          text: 'ReferenceError: foo is not defined'
        }
      })

      const handler = provider.getHandler('cdp_evaluate')!
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
    it('should navigate to URL', async () => {
      mockTypedClient.navigate.mockResolvedValueOnce({
        frameId: 'frame-123',
        loaderId: 'loader-456'
      })

      const handler = provider.getHandler('cdp_navigate')!
      const result = await handler.execute({
        url: 'https://example.com',
      })

      expect(mockTypedClient.navigate).toHaveBeenCalledWith(
        'https://example.com',
        { waitUntil: 'load' },
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: { frameId: 'frame-123', loaderId: 'loader-456' },
      })
    })

    it('should handle navigation errors', async () => {
      mockTypedClient.navigate.mockRejectedValueOnce(new Error('Navigation failed'))

      const handler = provider.getHandler('cdp_navigate')!
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
    it('should take a screenshot', async () => {
      const mockScreenshot = 'base64-encoded-image-data'
      
      mockTypedClient.captureScreenshot.mockResolvedValueOnce({
        data: mockScreenshot
      })

      const handler = provider.getHandler('cdp_screenshot')!
      const result = await handler.execute({})

      expect(mockTypedClient.captureScreenshot).toHaveBeenCalledWith(
        {
          fullPage: false,
          captureBeyondViewport: false
        },
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: mockScreenshot,
      })
    })

    it('should take a full page screenshot', async () => {
      const mockScreenshot = 'full-page-screenshot-data'
      
      mockTypedClient.captureScreenshot.mockResolvedValueOnce({
        data: mockScreenshot
      })

      const handler = provider.getHandler('cdp_screenshot')!
      const result = await handler.execute({
        fullPage: true,
      })

      expect(mockTypedClient.captureScreenshot).toHaveBeenCalledWith(
        {
          fullPage: true,
          captureBeyondViewport: true
        },
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: mockScreenshot,
      })
    })
  })

  describe('cdp_get_cookies', () => {
    it('should get all cookies', async () => {
      const mockCookies = [
        { name: 'session', value: 'abc123', domain: 'example.com' },
        { name: 'prefs', value: 'dark-mode', domain: 'example.com' },
      ]
      
      mockTypedClient.getCookies.mockResolvedValueOnce({
        cookies: mockCookies
      })

      const handler = provider.getHandler('cdp_get_cookies')!
      const result = await handler.execute({})

      expect(mockTypedClient.enableNetwork).toHaveBeenCalledWith(testSessionId)
      expect(mockTypedClient.getCookies).toHaveBeenCalledWith({ urls: undefined }, testSessionId)
      expect(result).toEqual({
        success: true,
        data: mockCookies,
      })
    })

    it('should filter cookies by URL', async () => {
      const mockCookies = [
        { name: 'session', value: 'abc123', domain: 'example.com' },
      ]
      
      mockTypedClient.getCookies.mockResolvedValueOnce({
        cookies: mockCookies
      })

      const handler = provider.getHandler('cdp_get_cookies')!
      const result = await handler.execute({
        urls: ['https://example.com'],
      })

      expect(mockTypedClient.getCookies).toHaveBeenCalledWith(
        { urls: ['https://example.com'] },
        testSessionId
      )
    })
  })

  describe('cdp_set_cookie', () => {
    it('should set a cookie', async () => {
      mockTypedClient.setCookie.mockResolvedValueOnce({
        success: true
      })

      const handler = provider.getHandler('cdp_set_cookie')!
      const result = await handler.execute({
        name: 'test-cookie',
        value: 'test-value',
        domain: 'example.com',
      })

      expect(mockTypedClient.enableNetwork).toHaveBeenCalledWith(testSessionId)
      expect(mockTypedClient.setCookie).toHaveBeenCalledWith(
        {
          name: 'test-cookie',
          value: 'test-value',
          domain: 'example.com',
          path: '/',
          secure: false,
          httpOnly: false,
          sameSite: 'Lax'
        },
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: { name: 'test-cookie', value: 'test-value' },
      })
    })
  })

  describe('cdp_clear_cookies', () => {
    it('should clear all cookies', async () => {
      const handler = provider.getHandler('cdp_clear_cookies')!
      const result = await handler.execute({})

      expect(mockTypedClient.enableNetwork).toHaveBeenCalledWith(testSessionId)
      expect(mockTypedClient.clearCookies).toHaveBeenCalledWith(testSessionId)
      expect(result).toEqual({
        success: true,
        data: { message: 'Cookies cleared' },
      })
    })
  })
})