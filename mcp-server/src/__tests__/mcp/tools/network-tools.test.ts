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
      
      expect(tools).toHaveLength(7)
      
      const toolNames = tools.map(t => t.name)
      expect(toolNames).toContain('network_mock_request')
      expect(toolNames).toContain('network_block_urls')
      expect(toolNames).toContain('network_throttle')
      expect(toolNames).toContain('network_clear_cache')
      expect(toolNames).toContain('network_get_requests')
      expect(toolNames).toContain('network_modify_headers')
      expect(toolNames).toContain('network_replay_request')
    })
  })

  describe('network_mock_request', () => {

    it('should mock network request', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Fetch.enable
        .mockResolvedValueOnce(undefined) // Runtime.evaluate

      const handler = provider.getHandler('network_mock_request')!

      const result = await handler.execute({
        urlPattern: 'https://api.example.com/users',
        response: {
          status: 200,
          body: { users: [{ id: 1, name: 'John' }] }
        }
      })

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Fetch.enable',
        expect.objectContaining({
          patterns: expect.arrayContaining([
            expect.objectContaining({
              urlPattern: 'https://api.example.com/users',
              requestStage: 'Response'
            })
          ])
        }),
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: {
          urlPattern: 'https://api.example.com/users',
          method: '*',
          mockActive: true,
          response: {
            status: 200,
            body: { users: [{ id: 1, name: 'John' }] }
          }
        }
      })
    })

    it('should handle method-specific mocking', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Fetch.enable
        .mockResolvedValueOnce(undefined) // Runtime.evaluate

      const handler = provider.getHandler('network_mock_request')!

      const result = await handler.execute({
        urlPattern: '/api/users',
        method: 'POST',
        response: {
          status: 201,
          body: { id: 2, name: 'Jane' },
          headers: { 'Content-Type': 'application/json' }
        }
      })

      expect(result.success).toBe(true)
      expect(result.data?.method).toBe('POST')
    })
  })

  describe('network_block_urls', () => {

    it('should block URLs by patterns', async () => {
      mockChromeClient.send.mockResolvedValueOnce(undefined) // Fetch.enable

      const patterns = [
        '*analytics*',
        '*.tracking.js',
        'https://ads.example.com/*'
      ]
      
      const handler = provider.getHandler('network_block_urls')!

      const result = await handler.execute({ urlPatterns: patterns })

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Fetch.enable',
        expect.objectContaining({
          patterns: expect.arrayContaining([
            expect.objectContaining({
              urlPattern: '*analytics*',
              requestStage: 'Request'
            }),
            expect.objectContaining({
              urlPattern: '*.tracking.js',
              requestStage: 'Request'
            }),
            expect.objectContaining({
              urlPattern: 'https://ads.example.com/*',
              requestStage: 'Request'
            })
          ])
        }),
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: {
          blockedPatterns: patterns,
          status: 'active'
        }
      })
    })
  })

  describe('network_throttle', () => {

    it('should throttle network with profile', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Network.enable
        .mockResolvedValueOnce(undefined) // Network.emulateNetworkConditions

      const handler = provider.getHandler('network_throttle')!

      const result = await handler.execute({
        profile: 'slow-3g'
      })

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Network.emulateNetworkConditions',
        expect.objectContaining({
          offline: false,
          downloadThroughput: 50 * 1024,
          uploadThroughput: 50 * 1024,
          latency: 2000
        }),
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: {
          profile: 'slow-3g',
          conditions: {
            offline: false,
            downloadThroughput: 50 * 1024,
            uploadThroughput: 50 * 1024,
            latency: 2000
          },
          status: 'active'
        }
      })
    })

    it('should support custom throttling', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Network.enable
        .mockResolvedValueOnce(undefined) // Network.emulateNetworkConditions

      const handler = provider.getHandler('network_throttle')!

      const custom = {
        downloadThroughput: 1024 * 1024,  // 1 MB/s
        uploadThroughput: 512 * 1024,     // 512 KB/s
        latency: 100
      }

      const result = await handler.execute({
        profile: 'custom',
        custom
      })

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Network.emulateNetworkConditions',
        custom,
        testSessionId
      )
      expect(result.success).toBe(true)
      expect(result.data?.conditions).toEqual(custom)
    })

    it('should disable throttling with online profile', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Network.enable
        .mockResolvedValueOnce(undefined) // Network.emulateNetworkConditions

      const handler = provider.getHandler('network_throttle')!

      const result = await handler.execute({
        profile: 'online'
      })

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Network.emulateNetworkConditions',
        {
          offline: false,
          downloadThroughput: -1,
          uploadThroughput: -1,
          latency: 0
        },
        testSessionId
      )
      expect(result.success).toBe(true)
    })
  })

  describe('network_clear_cache', () => {

    it('should clear browser cache and cookies', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Network.enable
        .mockResolvedValueOnce(undefined) // Network.clearBrowserCache
        .mockResolvedValueOnce(undefined) // Network.clearBrowserCookies

      const handler = provider.getHandler('network_clear_cache')!

      const result = await handler.execute({})

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Network.enable',
        {},
        testSessionId
      )
      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Network.clearBrowserCache',
        {},
        testSessionId
      )
      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Network.clearBrowserCookies',
        {},
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: {
          cleared: true,
          timestamp: expect.any(String)
        }
      })
    })
  })

  describe('network_get_requests', () => {

    it('should get recent network requests', async () => {
      const mockRequests = {
        requests: [
          {
            url: 'https://example.com/',
            method: 'GET',
            startTime: 123.45,
            duration: 234.56,
            transferSize: 1024,
            type: 'navigation'
          },
          {
            url: 'https://example.com/api/data',
            startTime: 456.78,
            duration: 123.45,
            transferSize: 512,
            type: 'resource'
          }
        ],
        total: 2
      }
      
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(createCDPResponse(mockRequests)) // Runtime.evaluate returns result.value directly

      const handler = provider.getHandler('network_get_requests')!

      const result = await handler.execute({})

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Runtime.evaluate',
        expect.objectContaining({
          expression: expect.stringContaining('performance.getEntriesByType'),
          returnByValue: true
        }),
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: mockRequests
      })
    })

    it('should filter requests by pattern', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(
          createCDPResponse({
            requests: [],
            total: 0
          })
        )

      const handler = provider.getHandler('network_get_requests')!

      const result = await handler.execute({
        filter: 'api',
        limit: 10
      })

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Runtime.evaluate',
        expect.objectContaining({
          expression: expect.stringContaining('api')
        }),
        testSessionId
      )
      expect(result.success).toBe(true)
    })
  })

  describe('network_modify_headers', () => {

    it('should modify request headers', async () => {
      mockChromeClient.send.mockResolvedValueOnce(undefined) // Fetch.enable

      const requestHeaders = {
        'Authorization': 'Bearer token123',
        'X-Custom-Header': 'value'
      }
      
      const handler = provider.getHandler('network_modify_headers')!

      const result = await handler.execute({
        urlPattern: '*api/*',
        requestHeaders
      })

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Fetch.enable',
        expect.objectContaining({
          patterns: [{
            urlPattern: '*api/*',
            requestStage: 'Request'
          }]
        }),
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: {
          urlPattern: '*api/*',
          requestHeaders,
          responseHeaders: undefined,
          status: 'active'
        }
      })
    })

    it('should modify response headers', async () => {
      mockChromeClient.send.mockResolvedValueOnce(undefined) // Fetch.enable

      const responseHeaders = {
        'X-Custom-Response': 'value',
        'Cache-Control': 'no-cache'
      }
      
      const handler = provider.getHandler('network_modify_headers')!

      const result = await handler.execute({
        urlPattern: '*.json',
        responseHeaders
      })

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Fetch.enable',
        expect.objectContaining({
          patterns: [{
            urlPattern: '*.json',
            requestStage: 'Response'
          }]
        }),
        testSessionId
      )
      expect(result.data?.responseHeaders).toEqual(responseHeaders)
    })
  })

  describe('network_replay_request', () => {

    it('should return placeholder for replay request', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce(
          createCDPResponse({
            message: 'Request replay requires request history tracking',
            requestId: 'req-123',
            note: 'Enable Network domain events to capture requests for replay'
          })
        )

      const handler = provider.getHandler('network_replay_request')!

      const result = await handler.execute({
        requestId: 'req-123'
      })

      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        message: 'Request replay requires request history tracking',
        requestId: 'req-123',
        note: 'Enable Network domain events to capture requests for replay'
      })
      expect(result.warnings).toContain('Full request replay requires request history tracking')
    })
  })

  describe('error handling', () => {

    it('should handle CDP errors', async () => {
      mockChromeClient.send.mockRejectedValueOnce(new Error('Network domain not enabled'))

      const handler = provider.getHandler('network_mock_request')!
      const result = await handler.execute({
        urlPattern: '/api/*',
        response: {
          status: 200,
          body: {}
        }
      })

      expect(result).toEqual({
        success: false,
        error: 'Network domain not enabled'
      })
    })

    it('should handle invalid parameters', async () => {
      mockChromeClient.send.mockRejectedValueOnce(new Error('Invalid pattern'))

      const handler = provider.getHandler('network_block_urls')!
      const result = await handler.execute({
        urlPatterns: ['[invalid regex']
      })

      expect(result).toEqual({
        success: false,
        error: 'Invalid pattern'
      })
    })
  })
})