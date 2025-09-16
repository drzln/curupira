/**
 * Tests for CDP Resource Provider
 * Level 2: MCP Core tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CDPResourceProviderImpl } from '../../../mcp/resources/providers/cdp-resources.js'
import { ChromeCDPResourceProvider } from '../../../mcp/resources/providers/cdp.js'
import { ChromeManager } from '../../../chrome/manager.js'
import { mockChromeClient, resetAllMocks, createCDPResponse, testSessionId } from '../../setup.js'

// Mock ChromeCDPResourceProvider
vi.mock('../../../mcp/resources/providers/cdp.js', () => ({
  ChromeCDPResourceProvider: vi.fn().mockImplementation(() => ({
    getConsoleHistory: vi.fn(),
    getDOMNodes: vi.fn(),
    getDOMSnapshot: vi.fn(),
    getNetworkRequests: vi.fn(),
    getPerformanceMetrics: vi.fn(),
    getPerformanceTimeline: vi.fn(),
    getPageFrameTree: vi.fn(),
    getPageMetrics: vi.fn(),
    getRuntimeProperties: vi.fn(),
  }))
}))

// Mock ChromeManager
vi.mock('../../../chrome/manager.js', () => ({
  ChromeManager: {
    getInstance: vi.fn(() => ({
      getClient: () => ({
        getSessions: vi.fn(() => [{ sessionId: testSessionId }]),
        ...mockChromeClient
      }),
    })),
  },
}))

describe('CDPResourceProviderImpl', () => {
  let provider: CDPResourceProviderImpl

  beforeEach(() => {
    resetAllMocks()
    provider = new CDPResourceProviderImpl()
  })

  describe('listResources', () => {
    it('should return all CDP resource types', async () => {
      const resources = await provider.listResources()
      
      expect(resources.length).toBeGreaterThan(10)
      
      // Check first resource
      expect(resources[0]).toMatchObject({
        uri: 'cdp/runtime/console',
        name: 'Console Logs',
        mimeType: 'application/json'
      })
      
      // Check that all resource types are present
      const uris = resources.map(r => r.uri)
      expect(uris).toContain('cdp/runtime/console')
      expect(uris).toContain('cdp/runtime/evaluate')
      expect(uris).toContain('cdp/dom/tree')
      expect(uris).toContain('cdp/dom/snapshot')
      expect(uris).toContain('cdp/network/requests')
      expect(uris).toContain('cdp/network/websockets')
      expect(uris).toContain('cdp/performance/metrics')
      expect(uris).toContain('cdp/performance/timeline')
      expect(uris).toContain('cdp/page/info')
      expect(uris).toContain('cdp/page/resources')
      expect(uris).toContain('cdp/debugger/scripts')
      expect(uris).toContain('cdp/debugger/breakpoints')
      expect(uris).toContain('cdp/css/stylesheets')
      expect(uris).toContain('cdp/css/computed')
      expect(uris).toContain('cdp/storage/cookies')
      expect(uris).toContain('cdp/storage/local')
      expect(uris).toContain('cdp/storage/session')
    })
  })

  describe('readResource', () => {
    describe('runtime console', () => {
      it('should return console history', async () => {
        const mockConsoleData = {
          messages: [
            { type: 'log', text: 'Hello', timestamp: Date.now() }
          ]
        }
        
        // Access the mocked ChromeCDPResourceProvider
        const mockCdpProvider = (provider as any).cdpProvider
        mockCdpProvider.getConsoleHistory.mockResolvedValue(mockConsoleData)

        const result = await provider.readResource('cdp/runtime/console')
        
        expect(mockCdpProvider.getConsoleHistory).toHaveBeenCalledWith(testSessionId)
        expect(result).toEqual(mockConsoleData)
      })

      it('should handle runtime errors', async () => {
        const mockCdpProvider = (provider as any).cdpProvider
        mockCdpProvider.getConsoleHistory.mockRejectedValue(new Error('Runtime error'))

        await expect(provider.readResource('cdp/runtime/console')).rejects.toThrow('Runtime error')
      })
    })

    describe('DOM snapshot', () => {
      it('should return DOM snapshot', async () => {
        const mockSnapshot = {
          documents: [{
            nodes: {
              nodeIndex: [0, 1, 2],
              nodeType: [9, 1, 3],
              nodeName: ['#document', 'HTML', '#text'],
              nodeValue: ['', '', 'Test content'],
            },
          }],
        }
        
        const mockCdpProvider = (provider as any).cdpProvider
        mockCdpProvider.getDOMSnapshot.mockResolvedValue(mockSnapshot)

        const result = await provider.readResource('cdp/dom/snapshot')
        
        expect(mockCdpProvider.getDOMSnapshot).toHaveBeenCalledWith(testSessionId)
        expect(result).toEqual(mockSnapshot)
      })
    })

    describe('network requests', () => {
      it('should return network requests', async () => {
        const mockRequests = {
          requests: [
            {
              requestId: '1',
              url: 'https://example.com',
              method: 'GET',
              status: 200,
            },
          ]
        }
        
        const mockCdpProvider = (provider as any).cdpProvider
        mockCdpProvider.getNetworkRequests.mockResolvedValue(mockRequests)

        const result = await provider.readResource('cdp/network/requests')
        
        expect(mockCdpProvider.getNetworkRequests).toHaveBeenCalledWith(testSessionId)
        expect(result).toEqual(mockRequests)
      })
    })

    describe('performance metrics', () => {
      it('should return performance metrics', async () => {
        const mockMetrics = {
          metrics: [
            { name: 'Timestamp', value: 123456789 },
            { name: 'JSHeapUsedSize', value: 1000000 },
          ],
        }
        
        const mockCdpProvider = (provider as any).cdpProvider
        mockCdpProvider.getPerformanceMetrics.mockResolvedValue(mockMetrics)

        const result = await provider.readResource('cdp/performance/metrics')
        
        expect(mockCdpProvider.getPerformanceMetrics).toHaveBeenCalledWith(testSessionId)
        expect(result).toEqual(mockMetrics)
      })
    })

    it('should handle unknown resource URI', async () => {
      await expect(provider.readResource('cdp/unknown/resource')).rejects.toThrow('Unknown CDP resource: cdp/unknown/resource')
    })
  })
})