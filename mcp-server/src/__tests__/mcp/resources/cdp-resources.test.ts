/**
 * Tests for CDP Resource Provider
 * Level 2: MCP Core tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ChromeCDPResourceProvider } from '../../../mcp/resources/providers/cdp-resources.js'
import { ChromeManager } from '../../../chrome/manager.js'
import { mockChromeClient, resetAllMocks, createCDPResponse, testSessionId } from '../../setup.js'

// Mock ChromeManager
vi.mock('../../../chrome/manager.js', () => ({
  ChromeManager: {
    getInstance: vi.fn(() => ({
      getClient: () => mockChromeClient,
    })),
  },
}))

describe('ChromeCDPResourceProvider', () => {
  let provider: ChromeCDPResourceProvider

  beforeEach(() => {
    resetAllMocks()
    provider = new ChromeCDPResourceProvider()
  })

  describe('listResources', () => {
    it('should return all CDP resource types', async () => {
      const resources = await provider.listResources()
      
      expect(resources).toHaveLength(11)
      expect(resources[0]).toEqual({
        uri: 'cdp://runtime/properties',
        name: 'Runtime Properties',
        mimeType: 'application/json',
        description: 'JavaScript runtime properties and global object inspection',
      })
      
      // Check that all resource types are present
      const uris = resources.map(r => r.uri)
      expect(uris).toContain('cdp://runtime/properties')
      expect(uris).toContain('cdp://dom/snapshot')
      expect(uris).toContain('cdp://network/requests')
      expect(uris).toContain('cdp://performance/metrics')
      expect(uris).toContain('cdp://page/resources')
      expect(uris).toContain('cdp://console/messages')
      expect(uris).toContain('cdp://debugger/callstack')
      expect(uris).toContain('cdp://css/styles')
      expect(uris).toContain('cdp://storage/cookies')
      expect(uris).toContain('cdp://security/state')
      expect(uris).toContain('cdp://memory/usage')
    })
  })

  describe('readResource', () => {
    describe('runtime properties', () => {
      it('should return runtime properties', async () => {
        mockChromeClient.send.mockResolvedValueOnce(
          createCDPResponse({
            result: {
              type: 'object',
              value: { test: 'value' },
            },
          })
        )

        const result = await provider.readResource('cdp://runtime/properties')
        
        expect(mockChromeClient.send).toHaveBeenCalledWith('Runtime.enable', {}, testSessionId)
        expect(mockChromeClient.send).toHaveBeenCalledWith(
          'Runtime.globalLexicalScopeNames',
          { executionContextId: 0 },
          testSessionId
        )
        expect(result).toEqual({
          type: 'object',
          value: { test: 'value' },
        })
      })

      it('should handle runtime errors', async () => {
        mockChromeClient.send.mockRejectedValueOnce(new Error('Runtime error'))

        const result = await provider.readResource('cdp://runtime/properties')
        
        expect(result).toEqual({
          error: 'Failed to get runtime properties: Runtime error',
        })
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
        
        mockChromeClient.send
          .mockResolvedValueOnce(undefined) // DOM.enable
          .mockResolvedValueOnce(createCDPResponse(mockSnapshot))

        const result = await provider.readResource('cdp://dom/snapshot')
        
        expect(mockChromeClient.send).toHaveBeenCalledWith('DOM.enable', {}, testSessionId)
        expect(mockChromeClient.send).toHaveBeenCalledWith(
          'DOMSnapshot.captureSnapshot',
          { computedStyles: [] },
          testSessionId
        )
        expect(result).toEqual(mockSnapshot)
      })
    })

    describe('network requests', () => {
      it('should return network requests', async () => {
        const mockRequests = [
          {
            requestId: '1',
            url: 'https://example.com',
            method: 'GET',
            status: 200,
          },
        ]
        
        mockChromeClient.send
          .mockResolvedValueOnce(undefined) // Network.enable
          .mockResolvedValueOnce(createCDPResponse({ requests: mockRequests }))

        const result = await provider.readResource('cdp://network/requests')
        
        expect(mockChromeClient.send).toHaveBeenCalledWith('Network.enable', {}, testSessionId)
        expect(result).toEqual({ requests: mockRequests })
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
        
        mockChromeClient.send
          .mockResolvedValueOnce(undefined) // Performance.enable
          .mockResolvedValueOnce(createCDPResponse(mockMetrics))

        const result = await provider.readResource('cdp://performance/metrics')
        
        expect(mockChromeClient.send).toHaveBeenCalledWith('Performance.enable', {}, testSessionId)
        expect(mockChromeClient.send).toHaveBeenCalledWith('Performance.getMetrics', {}, testSessionId)
        expect(result).toEqual(mockMetrics)
      })
    })

    it('should handle unknown resource URI', async () => {
      const result = await provider.readResource('cdp://unknown/resource')
      
      expect(result).toEqual({
        error: 'Unknown CDP resource: cdp://unknown/resource',
      })
    })
  })
})