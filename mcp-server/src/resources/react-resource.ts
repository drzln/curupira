/**
 * React resource provider
 * 
 * Provides React component tree and state as MCP resources
 */

import type { ReactIntegration } from '../integrations/react/index.js'
import type { Resource, ResourceTemplate } from '@modelcontextprotocol/sdk/types.js'
import { logger } from '../config/logger.js'

export class ReactResourceProvider {
  private readonly resourcePrefix = 'react'

  constructor(private react: ReactIntegration) {}

  /**
   * List available React resources
   */
  async listResources(): Promise<Resource[]> {
    if (!this.react.isReactDetected()) {
      return []
    }

    const resources: Resource[] = [
      {
        uri: `${this.resourcePrefix}://info`,
        name: 'React Info',
        description: 'React version and detection information',
        mimeType: 'application/json'
      },
      {
        uri: `${this.resourcePrefix}://components/tree`,
        name: 'Component Tree',
        description: 'Full React component tree hierarchy',
        mimeType: 'application/json'
      },
      {
        uri: `${this.resourcePrefix}://components/search`,
        name: 'Component Search',
        description: 'Search for components by name',
        mimeType: 'application/json'
      },
      {
        uri: `${this.resourcePrefix}://performance/metrics`,
        name: 'React Performance',
        description: 'React render performance metrics',
        mimeType: 'application/json'
      }
    ]

    // Add dynamic component resources
    try {
      const components = await this.react.getComponentTree()
      const topLevelComponents = components.slice(0, 10) // Limit to top 10
      
      for (const component of topLevelComponents) {
        resources.push({
          uri: `${this.resourcePrefix}://component/${component.id}`,
          name: `Component: ${component.name}`,
          description: `Inspect ${component.name} component (${component.type})`,
          mimeType: 'application/json'
        })
      }
    } catch (error) {
      logger.error('Failed to list component resources', error)
    }

    return resources
  }

  /**
   * Get resource templates
   */
  getResourceTemplates(): ResourceTemplate[] {
    return [
      {
        uriTemplate: `${this.resourcePrefix}://component/{componentId}`,
        name: 'Component by ID',
        description: 'Inspect a specific React component by ID',
        mimeType: 'application/json'
      },
      {
        uriTemplate: `${this.resourcePrefix}://components/search/{query}`,
        name: 'Search Components',
        description: 'Search for components by name pattern',
        mimeType: 'application/json'
      },
      {
        uriTemplate: `${this.resourcePrefix}://component/{componentId}/props`,
        name: 'Component Props',
        description: 'Get props for a specific component',
        mimeType: 'application/json'
      },
      {
        uriTemplate: `${this.resourcePrefix}://component/{componentId}/state`,
        name: 'Component State',
        description: 'Get state for a class component',
        mimeType: 'application/json'
      },
      {
        uriTemplate: `${this.resourcePrefix}://component/{componentId}/hooks`,
        name: 'Component Hooks',
        description: 'Get hooks for a function component',
        mimeType: 'application/json'
      }
    ]
  }

  /**
   * Read a resource
   */
  async readResource(uri: string): Promise<{ content: string; mimeType: string }> {
    if (!this.react.isReactDetected()) {
      throw new Error('React not detected on page')
    }

    try {
      const url = new URL(uri)
      const path = url.pathname.substring(2) // Remove leading //
      
      // Static resources
      if (path === 'info') {
        return this.getReactInfo()
      }
      
      if (path === 'components/tree') {
        return this.getComponentTree()
      }
      
      if (path === 'components/search') {
        return this.getAllComponents()
      }
      
      if (path === 'performance/metrics') {
        return this.getPerformanceMetrics()
      }
      
      // Dynamic component resources
      if (path.startsWith('component/')) {
        const parts = path.split('/')
        const componentId = parts[1]
        
        if (parts.length === 2) {
          return this.getComponent(componentId)
        }
        
        if (parts[2] === 'props') {
          return this.getComponentProps(componentId)
        }
        
        if (parts[2] === 'state') {
          return this.getComponentState(componentId)
        }
        
        if (parts[2] === 'hooks') {
          return this.getComponentHooks(componentId)
        }
      }
      
      // Search with query
      if (path.startsWith('components/search/')) {
        const query = decodeURIComponent(path.substring(18))
        return this.searchComponents(query)
      }
      
      throw new Error(`Unknown resource: ${uri}`)
    } catch (error) {
      logger.error('Failed to read React resource', { uri, error })
      throw error
    }
  }

  /**
   * Get React info
   */
  private async getReactInfo(): Promise<{ content: string; mimeType: string }> {
    const info = await this.react.detect()
    
    return {
      content: JSON.stringify(info, null, 2),
      mimeType: 'application/json'
    }
  }

  /**
   * Get component tree
   */
  private async getComponentTree(): Promise<{ content: string; mimeType: string }> {
    const tree = await this.react.getComponentTree()
    
    // Add summary information
    const content = {
      totalComponents: tree.length,
      tree,
      summary: {
        byType: tree.reduce((acc, comp) => {
          acc[comp.type] = (acc[comp.type] || 0) + 1
          return acc
        }, {} as Record<string, number>),
        maxDepth: this.calculateMaxDepth(tree)
      }
    }
    
    return {
      content: JSON.stringify(content, null, 2),
      mimeType: 'application/json'
    }
  }

  /**
   * Get all components (flat list)
   */
  private async getAllComponents(): Promise<{ content: string; mimeType: string }> {
    const tree = await this.react.getComponentTree()
    const flatList = this.flattenTree(tree)
    
    return {
      content: JSON.stringify({
        total: flatList.length,
        components: flatList
      }, null, 2),
      mimeType: 'application/json'
    }
  }

  /**
   * Search components
   */
  private async searchComponents(query: string): Promise<{ content: string; mimeType: string }> {
    const results = await this.react.searchComponents(query)
    
    return {
      content: JSON.stringify({
        query,
        resultCount: results.length,
        results
      }, null, 2),
      mimeType: 'application/json'
    }
  }

  /**
   * Get specific component
   */
  private async getComponent(componentId: string): Promise<{ content: string; mimeType: string }> {
    const component = await this.react.getComponent(componentId)
    
    if (!component) {
      throw new Error(`Component not found: ${componentId}`)
    }
    
    const inspection = await this.react.inspectComponent(componentId)
    
    return {
      content: JSON.stringify({
        component,
        inspection
      }, null, 2),
      mimeType: 'application/json'
    }
  }

  /**
   * Get component props
   */
  private async getComponentProps(componentId: string): Promise<{ content: string; mimeType: string }> {
    const props = await this.react.getComponentProps(componentId)
    
    return {
      content: JSON.stringify({
        componentId,
        props
      }, null, 2),
      mimeType: 'application/json'
    }
  }

  /**
   * Get component state
   */
  private async getComponentState(componentId: string): Promise<{ content: string; mimeType: string }> {
    const state = await this.react.getComponentState(componentId)
    
    return {
      content: JSON.stringify({
        componentId,
        state
      }, null, 2),
      mimeType: 'application/json'
    }
  }

  /**
   * Get component hooks
   */
  private async getComponentHooks(componentId: string): Promise<{ content: string; mimeType: string }> {
    const hooks = await this.react.getComponentHooks(componentId)
    
    return {
      content: JSON.stringify({
        componentId,
        hookCount: hooks.length,
        hooks
      }, null, 2),
      mimeType: 'application/json'
    }
  }

  /**
   * Get performance metrics
   */
  private async getPerformanceMetrics(): Promise<{ content: string; mimeType: string }> {
    const metrics = await this.react.getRenderMetrics()
    
    return {
      content: JSON.stringify(metrics, null, 2),
      mimeType: 'application/json'
    }
  }

  /**
   * Calculate max depth of component tree
   */
  private calculateMaxDepth(components: any[], depth = 0): number {
    if (components.length === 0) return depth
    
    return Math.max(
      ...components.map(comp => 
        this.calculateMaxDepth(comp.children || [], depth + 1)
      )
    )
  }

  /**
   * Flatten component tree
   */
  private flattenTree(components: any[]): any[] {
    const result: any[] = []
    
    const traverse = (comps: any[]) => {
      for (const comp of comps) {
        result.push({
          id: comp.id,
          name: comp.name,
          type: comp.type,
          parentId: comp.parentId,
          hasChildren: comp.children && comp.children.length > 0
        })
        
        if (comp.children) {
          traverse(comp.children)
        }
      }
    }
    
    traverse(components)
    return result
  }
}