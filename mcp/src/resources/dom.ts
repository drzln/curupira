/**
 * @fileoverview DOM resource handler
 */

import type {
  ResourceHandler,
  ResourceMetadata,
  ResourceContent,
  DomResource
} from './types.js'
import type { CdpClient } from '@curupira/integration'

/**
 * DOM resource handler
 */
export class DomResourceHandler implements ResourceHandler {
  name = 'dom'
  description = 'DOM elements and structure'
  pattern = /^dom:\/\//

  constructor(
    private readonly cdpClient: CdpClient
  ) {}

  /**
   * List DOM resources
   */
  async list(pattern?: string): Promise<ResourceMetadata[]> {
    const result = await this.cdpClient.send<{ root: any }>({
      method: 'DOM.getDocument',
      params: { depth: 2 }
    })

    if (!result.result?.root) {
      return []
    }

    const resources: ResourceMetadata[] = []
    this.traverseNode(result.result.root, resources, pattern)
    
    return resources
  }

  /**
   * Read DOM resource
   */
  async read(uri: string): Promise<ResourceContent> {
    const nodeId = parseInt(uri.replace('dom://node/', ''), 10)
    
    const [attributes, box, styles] = await Promise.all([
      this.getAttributes(nodeId),
      this.getBoundingBox(nodeId),
      this.getComputedStyles(nodeId)
    ])

    const resource: DomResource = {
      nodeId,
      nodeType: 1, // Element node
      nodeName: attributes.nodeName || 'unknown',
      attributes: attributes.attributes,
      boundingBox: box,
      computedStyles: styles
    }

    return {
      data: resource,
      encoding: 'json',
      contentType: 'application/json'
    }
  }

  /**
   * Traverse DOM node
   */
  private traverseNode(
    node: any,
    resources: ResourceMetadata[],
    pattern?: string
  ): void {
    if (node.nodeType === 1) { // Element node
      const uri = `dom://node/${node.nodeId}`
      
      if (!pattern || uri.includes(pattern)) {
        resources.push({
          uri,
          name: `${node.nodeName}${node.attributes?.id ? `#${node.attributes.id}` : ''}`,
          type: 'dom',
          mimeType: 'application/json',
          metadata: {
            nodeType: node.nodeType,
            nodeName: node.nodeName,
            childrenCount: node.childNodeCount
          }
        })
      }
    }

    if (node.children) {
      for (const child of node.children) {
        this.traverseNode(child, resources, pattern)
      }
    }
  }

  /**
   * Get node attributes
   */
  private async getAttributes(nodeId: number): Promise<any> {
    try {
      const result = await this.cdpClient.send({
        method: 'DOM.getAttributes',
        params: { nodeId }
      })
      
      const attributes: Record<string, string> = {}
      if (result.result?.attributes) {
        const attrs = result.result.attributes as string[]
        for (let i = 0; i < attrs.length; i += 2) {
          attributes[attrs[i]] = attrs[i + 1]
        }
      }
      
      return { attributes }
    } catch {
      return { attributes: {} }
    }
  }

  /**
   * Get bounding box
   */
  private async getBoundingBox(nodeId: number): Promise<any> {
    try {
      const result = await this.cdpClient.send({
        method: 'DOM.getBoxModel',
        params: { nodeId }
      })
      
      if (result.result?.model) {
        const quad = result.result.model.content
        return {
          x: quad[0],
          y: quad[1],
          width: quad[2] - quad[0],
          height: quad[5] - quad[1]
        }
      }
    } catch {
      // Ignore errors
    }
    
    return undefined
  }

  /**
   * Get computed styles
   */
  private async getComputedStyles(nodeId: number): Promise<Record<string, string>> {
    try {
      const result = await this.cdpClient.send({
        method: 'CSS.getComputedStyleForNode',
        params: { nodeId }
      })
      
      const styles: Record<string, string> = {}
      if (result.result?.computedStyle) {
        for (const style of result.result.computedStyle) {
          styles[style.name] = style.value
        }
      }
      
      return styles
    } catch {
      return {}
    }
  }
}