/**
 * Tests for Network Tool Provider
 * Level 2: MCP Core tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NetworkToolProvider } from '../../../mcp/tools/providers/network-tools.js'
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

// Mock BaseToolProvider
vi.mock('../../../mcp/tools/providers/base.js', () => ({
  BaseToolProvider: class {
    async getSessionId(argSessionId?: string) {
      return argSessionId || testSessionId
    }
  }
}))

describe('NetworkToolProvider', () => {
  let provider: NetworkToolProvider

  beforeEach(() => {
    resetAllMocks()
    provider = new NetworkToolProvider()
  })

  describe('listTools', () => {
    it('should return all network tools', () => {
      const tools = provider.listTools()
      
      expect(tools).toHaveLength(9)
      
      const toolNames = tools.map(t => t.name)
      expect(toolNames).toContain('network_enable_request_interception')
      expect(toolNames).toContain('network_disable_request_interception')
      expect(toolNames).toContain('network_set_request_interception')
      expect(toolNames).toContain('network_mock_response')
      expect(toolNames).toContain('network_set_throttling')
      expect(toolNames).toContain('network_set_headers')
      expect(toolNames).toContain('network_block_urls')
      expect(toolNames).toContain('network_clear_browser_cache')
      expect(toolNames).toContain('network_clear_browser_cookies')
    })
  })

  describe('network_enable_request_interception', () => {
    const handler = new NetworkToolProvider().getHandler('network_enable_request_interception')!

    it('should enable request interception', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Network.enable
        .mockResolvedValueOnce(undefined) // Fetch.enable
        .mockResolvedValueOnce(undefined) // Network.setRequestInterception

      const result = await handler.execute({})

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Network.enable',
        {},
        testSessionId
      )
      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Fetch.enable',
        { patterns: [{ urlPattern: '*' }] },
        testSessionId
      )
      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Network.setRequestInterception',
        { patterns: [{ urlPattern: '*' }] },
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: { enabled: true },
      })
    })

    it('should enable with specific patterns', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Network.enable
        .mockResolvedValueOnce(undefined) // Fetch.enable
        .mockResolvedValueOnce(undefined) // Network.setRequestInterception

      const patterns = ['*api/*', '*.json']
      const result = await handler.execute({ patterns })

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Fetch.enable',
        { patterns: [{ urlPattern: '*api/*' }, { urlPattern: '*.json' }] },
        testSessionId
      )
      expect(result.success).toBe(true)
    })
  })

  describe('network_disable_request_interception', () => {
    const handler = new NetworkToolProvider().getHandler('network_disable_request_interception')!

    it('should disable request interception', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Fetch.disable
        .mockResolvedValueOnce(undefined) // Network.setRequestInterception

      const result = await handler.execute({})

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Fetch.disable',
        {},
        testSessionId
      )
      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Network.setRequestInterception',
        { patterns: [] },
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: { enabled: false },
      })
    })
  })

  describe('network_set_request_interception', () => {
    const handler = new NetworkToolProvider().getHandler('network_set_request_interception')!

    it('should set request interception rules', async () => {
      const rules = [
        {
          urlPattern: '*api/users*',
          resourceType: 'XHR',
          requestStage: 'Request',
        },
        {
          urlPattern: '*.jpg',
          resourceType: 'Image',
          requestStage: 'HeadersReceived',
        },
      ]
      
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Network.enable
        .mockResolvedValueOnce(undefined) // Network.setRequestInterception

      const result = await handler.execute({ rules })

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Network.setRequestInterception',
        { patterns: rules },
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: { rules },
      })
    })
  })

  describe('network_mock_response', () => {
    const handler = new NetworkToolProvider().getHandler('network_mock_response')!

    it('should mock API response', async () => {
      const mockConfig = {
        url: 'https://api.example.com/users',
        response: {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ users: [{ id: 1, name: 'John' }] }),
        },
      }
      
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(
          createCDPResponse({
            result: {
              value: { mocked: true },
            },
          })
        )

      const result = await handler.execute(mockConfig)

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Runtime.evaluate',
        expect.objectContaining({
          expression: expect.stringContaining('fetch ='),
        }),
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: { mocked: true },
      })
    })

    it('should mock with regex pattern', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(
          createCDPResponse({
            result: {
              value: { mocked: true },
            },
          })
        )

      const result = await handler.execute({
        url: '/api/.*/users',
        regex: true,
        response: {
          status: 404,
          body: JSON.stringify({ error: 'Not found' }),
        },
      })

      expect(result.success).toBe(true)
    })
  })

  describe('network_set_throttling', () => {
    const handler = new NetworkToolProvider().getHandler('network_set_throttling')!

    it('should set network throttling', async () => {
      mockChromeClient.send.mockResolvedValueOnce(undefined) // Network.emulateNetworkConditions

      const result = await handler.execute({
        downloadThroughput: 1.5 * 1024 * 1024, // 1.5 Mbps
        uploadThroughput: 750 * 1024, // 750 Kbps
        latency: 40, // 40ms
      })

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Network.emulateNetworkConditions',
        {
          offline: false,
          downloadThroughput: 1.5 * 1024 * 1024 / 8,
          uploadThroughput: 750 * 1024 / 8,
          latency: 40,
        },
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: {
          downloadThroughput: 1.5 * 1024 * 1024,
          uploadThroughput: 750 * 1024,
          latency: 40,
        },
      })
    })

    it('should use preset profiles', async () => {
      mockChromeClient.send.mockResolvedValueOnce(undefined) // Network.emulateNetworkConditions

      const result = await handler.execute({
        profile: 'Slow 3G',
      })

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Network.emulateNetworkConditions',
        expect.objectContaining({
          downloadThroughput: 50 * 1024 / 8, // 50 KB/s converted to bytes/s
          uploadThroughput: 50 * 1024 / 8,
          latency: 2000,
        }),
        testSessionId
      )
      expect(result.success).toBe(true)
    })

    it('should disable throttling', async () => {
      mockChromeClient.send.mockResolvedValueOnce(undefined) // Network.emulateNetworkConditions

      const result = await handler.execute({
        disabled: true,
      })

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Network.emulateNetworkConditions',
        {
          offline: false,
          downloadThroughput: -1,
          uploadThroughput: -1,
          latency: 0,
        },
        testSessionId
      )
      expect(result.success).toBe(true)
    })
  })

  describe('network_set_headers', () => {
    const handler = new NetworkToolProvider().getHandler('network_set_headers')!

    it('should set extra headers', async () => {
      mockChromeClient.send.mockResolvedValueOnce(undefined) // Network.setExtraHTTPHeaders

      const headers = {
        'Authorization': 'Bearer token123',
        'X-Custom-Header': 'value',
      }
      
      const result = await handler.execute({ headers })

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Network.setExtraHTTPHeaders',
        { headers },
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: { headers },
      })
    })
  })

  describe('network_block_urls', () => {
    const handler = new NetworkToolProvider().getHandler('network_block_urls')!

    it('should block URLs by patterns', async () => {
      mockChromeClient.send.mockResolvedValueOnce(undefined) // Network.setBlockedURLs

      const patterns = [
        '*analytics*',
        '*.tracking.js',
        'https://ads.example.com/*',
      ]
      
      const result = await handler.execute({ patterns })

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Network.setBlockedURLs',
        { urls: patterns },
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: { blocked: patterns },
      })
    })

    it('should clear blocked URLs with empty array', async () => {
      mockChromeClient.send.mockResolvedValueOnce(undefined) // Network.setBlockedURLs

      const result = await handler.execute({ patterns: [] })

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Network.setBlockedURLs',
        { urls: [] },
        testSessionId
      )
      expect(result.data?.blocked).toEqual([])
    })
  })

  describe('network_clear_browser_cache', () => {
    const handler = new NetworkToolProvider().getHandler('network_clear_browser_cache')!

    it('should clear browser cache', async () => {
      mockChromeClient.send.mockResolvedValueOnce(undefined) // Network.clearBrowserCache

      const result = await handler.execute({})

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Network.clearBrowserCache',
        {},
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: { cleared: 'cache' },
      })
    })
  })

  describe('network_clear_browser_cookies', () => {
    const handler = new NetworkToolProvider().getHandler('network_clear_browser_cookies')!

    it('should clear all browser cookies', async () => {
      mockChromeClient.send.mockResolvedValueOnce(undefined) // Network.clearBrowserCookies

      const result = await handler.execute({})

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Network.clearBrowserCookies',
        {},
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: { cleared: 'all cookies' },
      })
    })

    it('should clear cookies for specific domain', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Network.deleteCookies

      const result = await handler.execute({
        domain: 'example.com',
      })

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Network.deleteCookies',
        { domain: 'example.com' },
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: { cleared: 'cookies for domain: example.com' },
      })
    })
  })

  describe('error handling', () => {
    const handler = new NetworkToolProvider().getHandler('network_enable_request_interception')!

    it('should handle CDP errors', async () => {
      mockChromeClient.send.mockRejectedValueOnce(new Error('Network domain not enabled'))

      const result = await handler.execute({})

      expect(result).toEqual({
        success: false,
        error: 'Network domain not enabled',
      })
    })

    it('should handle invalid parameters', async () => {
      mockChromeClient.send.mockRejectedValueOnce(new Error('Invalid pattern'))

      const result = await handler.execute({
        patterns: ['invalid pattern'],
      })

      expect(result).toEqual({
        success: false,
        error: 'Invalid pattern',
      })
    })
  })
})