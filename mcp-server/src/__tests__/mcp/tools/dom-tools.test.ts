/**
 * Tests for DOM Tool Provider
 * Level 2: MCP Core tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DOMToolProvider } from '../../../mcp/tools/providers/dom-tools.js'
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

// Mock BaseToolProvider to avoid complexity
vi.mock('../../../mcp/tools/providers/base.js', () => ({
  BaseToolProvider: class {
    async getSessionId(argSessionId?: string) {
      return argSessionId || testSessionId
    }
  }
}))

describe('DOMToolProvider', () => {
  let provider: DOMToolProvider

  beforeEach(() => {
    resetAllMocks()
    provider = new DOMToolProvider()
  })

  describe('listTools', () => {
    it('should return all DOM tools', () => {
      const tools = provider.listTools()
      
      expect(tools).toHaveLength(10)
      
      const toolNames = tools.map(t => t.name)
      expect(toolNames).toContain('dom_query_selector')
      expect(toolNames).toContain('dom_query_selector_all')
      expect(toolNames).toContain('dom_get_attributes')
      expect(toolNames).toContain('dom_set_attribute')
      expect(toolNames).toContain('dom_remove_attribute')
      expect(toolNames).toContain('dom_get_outer_html')
      expect(toolNames).toContain('dom_set_outer_html')
      expect(toolNames).toContain('dom_click_element')
      expect(toolNames).toContain('dom_focus_element')
      expect(toolNames).toContain('dom_scroll_into_view')
    })
  })

  describe('dom_query_selector', () => {
    const handler = new DOMToolProvider().getHandler('dom_query_selector')!

    it('should find DOM element by selector', async () => {
      const mockNode = {
        nodeId: 123,
        nodeName: 'DIV',
        attributes: ['class', 'container'],
      }
      
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // DOM.enable
        .mockResolvedValueOnce(createCDPResponse({ root: { nodeId: 1 } })) // getDocument
        .mockResolvedValueOnce(createCDPResponse({ nodeId: 123 })) // querySelector
        .mockResolvedValueOnce(createCDPResponse({ node: mockNode })) // describeNode

      const result = await handler.execute({
        selector: '.container',
      })

      expect(mockChromeClient.send).toHaveBeenCalledWith('DOM.enable', {}, testSessionId)
      expect(mockChromeClient.send).toHaveBeenCalledWith('DOM.getDocument', {}, testSessionId)
      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'DOM.querySelector',
        { nodeId: 1, selector: '.container' },
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: { nodeId: 123, node: mockNode },
      })
    })

    it('should handle element not found', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // DOM.enable
        .mockResolvedValueOnce(createCDPResponse({ root: { nodeId: 1 } })) // getDocument
        .mockResolvedValueOnce(createCDPResponse({ nodeId: 0 })) // No element found

      const result = await handler.execute({
        selector: '.nonexistent',
      })

      expect(result).toEqual({
        success: false,
        error: 'No element found for selector: .nonexistent',
      })
    })
  })

  describe('dom_query_selector_all', () => {
    const handler = new DOMToolProvider().getHandler('dom_query_selector_all')!

    it('should find all matching elements', async () => {
      const mockNodes = [
        { nodeId: 123, nodeName: 'DIV' },
        { nodeId: 124, nodeName: 'DIV' },
      ]
      
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // DOM.enable
        .mockResolvedValueOnce(createCDPResponse({ root: { nodeId: 1 } })) // getDocument
        .mockResolvedValueOnce(createCDPResponse({ nodeIds: [123, 124] })) // querySelectorAll
        .mockResolvedValueOnce(createCDPResponse({ node: mockNodes[0] })) // describeNode
        .mockResolvedValueOnce(createCDPResponse({ node: mockNodes[1] })) // describeNode

      const result = await handler.execute({
        selector: 'div',
      })

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'DOM.querySelectorAll',
        { nodeId: 1, selector: 'div' },
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: {
          count: 2,
          nodes: [
            { nodeId: 123, node: mockNodes[0] },
            { nodeId: 124, node: mockNodes[1] },
          ],
        },
      })
    })
  })

  describe('dom_get_attributes', () => {
    const handler = new DOMToolProvider().getHandler('dom_get_attributes')!

    it('should get element attributes', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // DOM.enable
        .mockResolvedValueOnce(
          createCDPResponse({
            attributes: ['class', 'container', 'id', 'main', 'data-test', 'true'],
          })
        )

      const result = await handler.execute({
        nodeId: 123,
      })

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'DOM.getAttributes',
        { nodeId: 123 },
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: {
          class: 'container',
          id: 'main',
          'data-test': 'true',
        },
      })
    })
  })

  describe('dom_set_attribute', () => {
    const handler = new DOMToolProvider().getHandler('dom_set_attribute')!

    it('should set element attribute', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // DOM.enable
        .mockResolvedValueOnce(undefined) // setAttributeValue

      const result = await handler.execute({
        nodeId: 123,
        name: 'data-active',
        value: 'true',
      })

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'DOM.setAttributeValue',
        { nodeId: 123, name: 'data-active', value: 'true' },
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: { nodeId: 123, name: 'data-active', value: 'true' },
      })
    })
  })

  describe('dom_remove_attribute', () => {
    const handler = new DOMToolProvider().getHandler('dom_remove_attribute')!

    it('should remove element attribute', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // DOM.enable
        .mockResolvedValueOnce(undefined) // removeAttribute

      const result = await handler.execute({
        nodeId: 123,
        name: 'data-test',
      })

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'DOM.removeAttribute',
        { nodeId: 123, name: 'data-test' },
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: { nodeId: 123, name: 'data-test' },
      })
    })
  })

  describe('dom_get_outer_html', () => {
    const handler = new DOMToolProvider().getHandler('dom_get_outer_html')!

    it('should get element outer HTML', async () => {
      const mockHtml = '<div class="container">Hello World</div>'
      
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // DOM.enable
        .mockResolvedValueOnce(createCDPResponse({ outerHTML: mockHtml }))

      const result = await handler.execute({
        nodeId: 123,
      })

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'DOM.getOuterHTML',
        { nodeId: 123 },
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: { nodeId: 123, outerHTML: mockHtml },
      })
    })
  })

  describe('dom_set_outer_html', () => {
    const handler = new DOMToolProvider().getHandler('dom_set_outer_html')!

    it('should set element outer HTML', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // DOM.enable
        .mockResolvedValueOnce(undefined) // setOuterHTML

      const result = await handler.execute({
        nodeId: 123,
        outerHTML: '<div class="updated">New Content</div>',
      })

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'DOM.setOuterHTML',
        { nodeId: 123, outerHTML: '<div class="updated">New Content</div>' },
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: { nodeId: 123 },
      })
    })
  })

  describe('dom_click_element', () => {
    const handler = new DOMToolProvider().getHandler('dom_click_element')!

    it('should click element', async () => {
      const mockBoxModel = {
        content: [100, 100, 200, 100, 200, 150, 100, 150], // Rectangle coordinates
        width: 100,
        height: 50,
      }
      
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // DOM.enable
        .mockResolvedValueOnce(createCDPResponse({ model: mockBoxModel })) // getBoxModel
        .mockResolvedValueOnce(undefined) // mousePressed
        .mockResolvedValueOnce(undefined) // mouseReleased

      const result = await handler.execute({
        nodeId: 123,
      })

      // Should click at center of element
      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'Input.dispatchMouseEvent',
        {
          type: 'mousePressed',
          x: 150, // center X
          y: 125, // center Y
          button: 'left',
          clickCount: 1,
        },
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: { nodeId: 123, x: 150, y: 125 },
      })
    })
  })

  describe('dom_focus_element', () => {
    const handler = new DOMToolProvider().getHandler('dom_focus_element')!

    it('should focus element', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // DOM.enable
        .mockResolvedValueOnce(undefined) // focus

      const result = await handler.execute({
        nodeId: 123,
      })

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'DOM.focus',
        { nodeId: 123 },
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: { nodeId: 123 },
      })
    })
  })

  describe('dom_scroll_into_view', () => {
    const handler = new DOMToolProvider().getHandler('dom_scroll_into_view')!

    it('should scroll element into view', async () => {
      mockChromeClient.send
        .mockResolvedValueOnce(undefined) // DOM.enable
        .mockResolvedValueOnce(undefined) // scrollIntoViewIfNeeded

      const result = await handler.execute({
        nodeId: 123,
      })

      expect(mockChromeClient.send).toHaveBeenCalledWith(
        'DOM.scrollIntoViewIfNeeded',
        { nodeId: 123 },
        testSessionId
      )
      expect(result).toEqual({
        success: true,
        data: { nodeId: 123 },
      })
    })
  })

  describe('error handling', () => {
    const handler = new DOMToolProvider().getHandler('dom_query_selector')!

    it('should handle CDP errors', async () => {
      mockChromeClient.send.mockRejectedValueOnce(new Error('DOM not enabled'))

      const result = await handler.execute({
        selector: '.container',
      })

      expect(result).toEqual({
        success: false,
        error: 'DOM not enabled',
      })
    })
  })
})