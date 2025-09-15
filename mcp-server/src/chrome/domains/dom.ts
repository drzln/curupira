/**
 * DOM domain wrapper for Chrome DevTools Protocol
 * 
 * Provides typed access to DOM domain methods with proper error handling
 */

import type { ChromeClient } from '../client.js'
import type { DOM } from '@nexus/curupira-shared/types/cdp.js'
import { buildSelector, getNodeAttribute } from '@nexus/curupira-shared/utils/cdp.js'
import { logger } from '../../config/logger.js'

export class DOMDomain {
  private nodeCache: Map<number, DOM.Node> = new Map()
  private documentNode?: DOM.Node

  constructor(
    private client: ChromeClient,
    private sessionId: string
  ) {}

  /**
   * Enable the DOM domain
   */
  async enable(): Promise<void> {
    await this.client.send('DOM.enable', {}, this.sessionId)
  }

  /**
   * Disable the DOM domain
   */
  async disable(): Promise<void> {
    await this.client.send('DOM.disable', {}, this.sessionId)
    this.nodeCache.clear()
    this.documentNode = undefined
  }

  /**
   * Get the document node
   */
  async getDocument(depth = -1, pierce = false): Promise<DOM.Node | null> {
    try {
      const result = await this.client.send<{
        root: DOM.Node
      }>('DOM.getDocument', { depth, pierce }, this.sessionId)

      this.documentNode = result.root
      this.updateNodeCache(result.root)
      return result.root
    } catch (error) {
      logger.error('DOM.getDocument failed', error)
      return null
    }
  }

  /**
   * Query selector on a node
   */
  async querySelector(
    nodeId: number,
    selector: string
  ): Promise<number | null> {
    try {
      const result = await this.client.send<{
        nodeId: number
      }>('DOM.querySelector', {
        nodeId,
        selector
      }, this.sessionId)

      return result.nodeId || null
    } catch (error) {
      logger.error('DOM.querySelector failed', { nodeId, selector, error })
      return null
    }
  }

  /**
   * Query selector all on a node
   */
  async querySelectorAll(
    nodeId: number,
    selector: string
  ): Promise<number[]> {
    try {
      const result = await this.client.send<{
        nodeIds: number[]
      }>('DOM.querySelectorAll', {
        nodeId,
        selector
      }, this.sessionId)

      return result.nodeIds || []
    } catch (error) {
      logger.error('DOM.querySelectorAll failed', { nodeId, selector, error })
      return []
    }
  }

  /**
   * Get attributes of a node
   */
  async getAttributes(nodeId: number): Promise<Record<string, string>> {
    try {
      const result = await this.client.send<{
        attributes: string[]
      }>('DOM.getAttributes', { nodeId }, this.sessionId)

      const attrs: Record<string, string> = {}
      for (let i = 0; i < result.attributes.length; i += 2) {
        attrs[result.attributes[i]] = result.attributes[i + 1]
      }
      return attrs
    } catch (error) {
      logger.error('DOM.getAttributes failed', { nodeId, error })
      return {}
    }
  }

  /**
   * Set attribute value
   */
  async setAttributeValue(
    nodeId: number,
    name: string,
    value: string
  ): Promise<void> {
    try {
      await this.client.send('DOM.setAttributeValue', {
        nodeId,
        name,
        value
      }, this.sessionId)
    } catch (error) {
      logger.error('DOM.setAttributeValue failed', { nodeId, name, value, error })
    }
  }

  /**
   * Remove attribute
   */
  async removeAttribute(nodeId: number, name: string): Promise<void> {
    try {
      await this.client.send('DOM.removeAttribute', {
        nodeId,
        name
      }, this.sessionId)
    } catch (error) {
      logger.error('DOM.removeAttribute failed', { nodeId, name, error })
    }
  }

  /**
   * Get outer HTML of a node
   */
  async getOuterHTML(nodeId: number): Promise<string> {
    try {
      const result = await this.client.send<{
        outerHTML: string
      }>('DOM.getOuterHTML', { nodeId }, this.sessionId)

      return result.outerHTML
    } catch (error) {
      logger.error('DOM.getOuterHTML failed', { nodeId, error })
      return ''
    }
  }

  /**
   * Set outer HTML of a node
   */
  async setOuterHTML(nodeId: number, outerHTML: string): Promise<void> {
    try {
      await this.client.send('DOM.setOuterHTML', {
        nodeId,
        outerHTML
      }, this.sessionId)
    } catch (error) {
      logger.error('DOM.setOuterHTML failed', { nodeId, error })
    }
  }

  /**
   * Remove a node
   */
  async removeNode(nodeId: number): Promise<void> {
    try {
      await this.client.send('DOM.removeNode', { nodeId }, this.sessionId)
      this.nodeCache.delete(nodeId)
    } catch (error) {
      logger.error('DOM.removeNode failed', { nodeId, error })
    }
  }

  /**
   * Get box model for a node
   */
  async getBoxModel(nodeId: number): Promise<DOM.BoxModel | null> {
    try {
      const result = await this.client.send<{
        model: DOM.BoxModel
      }>('DOM.getBoxModel', { nodeId }, this.sessionId)

      return result.model
    } catch (error) {
      logger.error('DOM.getBoxModel failed', { nodeId, error })
      return null
    }
  }

  /**
   * Focus a node
   */
  async focus(nodeId: number): Promise<void> {
    try {
      await this.client.send('DOM.focus', { nodeId }, this.sessionId)
    } catch (error) {
      logger.error('DOM.focus failed', { nodeId, error })
    }
  }

  /**
   * Scroll into view if needed
   */
  async scrollIntoViewIfNeeded(nodeId: number): Promise<void> {
    try {
      await this.client.send('DOM.scrollIntoViewIfNeeded', { nodeId }, this.sessionId)
    } catch (error) {
      logger.error('DOM.scrollIntoViewIfNeeded failed', { nodeId, error })
    }
  }

  /**
   * Get node by ID from cache
   */
  getNode(nodeId: number): DOM.Node | undefined {
    return this.nodeCache.get(nodeId)
  }

  /**
   * Get CSS selector for a node
   */
  getSelector(nodeId: number): string {
    const node = this.nodeCache.get(nodeId)
    if (!node) return ''
    return buildSelector(node, this.nodeCache)
  }

  /**
   * Request child nodes
   */
  async requestChildNodes(nodeId: number, depth = -1): Promise<void> {
    try {
      await this.client.send('DOM.requestChildNodes', {
        nodeId,
        depth
      }, this.sessionId)
    } catch (error) {
      logger.error('DOM.requestChildNodes failed', { nodeId, error })
    }
  }

  /**
   * Describe a node
   */
  async describeNode(
    nodeId?: number,
    objectId?: string
  ): Promise<DOM.Node | null> {
    try {
      const result = await this.client.send<{
        node: DOM.Node
      }>('DOM.describeNode', {
        nodeId,
        objectId
      }, this.sessionId)

      if (result.node) {
        this.updateNodeCache(result.node)
      }
      return result.node
    } catch (error) {
      logger.error('DOM.describeNode failed', { nodeId, objectId, error })
      return null
    }
  }

  /**
   * Update node cache recursively
   */
  private updateNodeCache(node: DOM.Node): void {
    this.nodeCache.set(node.nodeId, node)
    
    if (node.children) {
      for (const child of node.children) {
        this.updateNodeCache(child)
      }
    }
  }

  /**
   * Set up document updated event listener
   */
  onDocumentUpdated(handler: () => void): void {
    this.client.onSessionEvent(this.sessionId, 'DOM.documentUpdated', handler)
  }

  /**
   * Set up attribute modified event listener
   */
  onAttributeModified(
    handler: (params: {
      nodeId: number
      name: string
      value: string
    }) => void
  ): void {
    this.client.onSessionEvent(this.sessionId, 'DOM.attributeModified', handler)
  }

  /**
   * Set up attribute removed event listener
   */
  onAttributeRemoved(
    handler: (params: {
      nodeId: number
      name: string
    }) => void
  ): void {
    this.client.onSessionEvent(this.sessionId, 'DOM.attributeRemoved', handler)
  }

  /**
   * Set up child node inserted event listener
   */
  onChildNodeInserted(
    handler: (params: {
      parentNodeId: number
      previousNodeId: number
      node: DOM.Node
    }) => void
  ): void {
    this.client.onSessionEvent(this.sessionId, 'DOM.childNodeInserted', (params) => {
      if (params.node) {
        this.updateNodeCache(params.node)
      }
      handler(params)
    })
  }

  /**
   * Set up child node removed event listener
   */
  onChildNodeRemoved(
    handler: (params: {
      parentNodeId: number
      nodeId: number
    }) => void
  ): void {
    this.client.onSessionEvent(this.sessionId, 'DOM.childNodeRemoved', (params) => {
      this.nodeCache.delete(params.nodeId)
      handler(params)
    })
  }

  /**
   * Set up set child nodes event listener
   */
  onSetChildNodes(
    handler: (params: {
      parentId: number
      nodes: DOM.Node[]
    }) => void
  ): void {
    this.client.onSessionEvent(this.sessionId, 'DOM.setChildNodes', (params) => {
      if (params.nodes) {
        for (const node of params.nodes) {
          this.updateNodeCache(node)
        }
      }
      handler(params)
    })
  }
}