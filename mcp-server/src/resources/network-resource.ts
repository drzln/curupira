/**
 * Network resource provider
 * 
 * Provides network request/response data as MCP resources
 */

import type { NetworkDomain } from '../chrome/domains/network.js'
import type { Network } from '@curupira/shared/types/cdp.js'
import type { Resource, ResourceTemplate } from '@modelcontextprotocol/sdk/types.js'
import { logger } from '../config/logger.js'

export class NetworkResourceProvider {
  private readonly resourcePrefix = 'network'

  constructor(private network: NetworkDomain) {}

  /**
   * List available network resources
   */
  async listResources(): Promise<Resource[]> {
    const resources: Resource[] = [
      {
        uri: `${this.resourcePrefix}://requests`,
        name: 'Network Requests',
        description: 'All network requests made by the page',
        mimeType: 'application/json'
      },
      {
        uri: `${this.resourcePrefix}://requests/recent`,
        name: 'Recent Requests',
        description: 'Recent network requests (last 500)',
        mimeType: 'application/json'
      },
      {
        uri: `${this.resourcePrefix}://requests/failed`,
        name: 'Failed Requests',
        description: 'Network requests that failed',
        mimeType: 'application/json'
      },
      {
        uri: `${this.resourcePrefix}://cookies`,
        name: 'Network Cookies',
        description: 'All cookies from network requests',
        mimeType: 'application/json'
      }
    ]

    // Add request-specific resources for recent requests
    try {
      const recentRequests = this.network.getRecentRequests()
      const significantRequests = recentRequests
        .filter(r => r.type && r.type !== 'Image' && r.type !== 'Font')
        .slice(0, 10)

      for (const request of significantRequests) {
        const url = new URL(request.url)
        resources.push({
          uri: `${this.resourcePrefix}://request/${request.requestId}`,
          name: `Request: ${url.pathname}`,
          description: `${request.method} ${url.hostname}${url.pathname}`,
          mimeType: 'application/json'
        })
      }
    } catch (error) {
      logger.error('Failed to list request resources', error)
    }

    return resources
  }

  /**
   * Get resource templates
   */
  getResourceTemplates(): ResourceTemplate[] {
    return [
      {
        uriTemplate: `${this.resourcePrefix}://request/{requestId}`,
        name: 'Network Request',
        description: 'Details of a specific network request',
        mimeType: 'application/json'
      },
      {
        uriTemplate: `${this.resourcePrefix}://request/{requestId}/response`,
        name: 'Response Body',
        description: 'Response body for a network request',
        mimeType: 'application/json'
      },
      {
        uriTemplate: `${this.resourcePrefix}://requests/filter/{type}`,
        name: 'Requests by Type',
        description: 'Filter requests by resource type',
        mimeType: 'application/json'
      },
      {
        uriTemplate: `${this.resourcePrefix}://requests/domain/{domain}`,
        name: 'Requests by Domain',
        description: 'Filter requests by domain',
        mimeType: 'application/json'
      }
    ]
  }

  /**
   * Read a resource
   */
  async readResource(uri: string): Promise<{ content: string; mimeType: string }> {
    try {
      const url = new URL(uri)
      const path = url.pathname.substring(2) // Remove leading //

      // Static resources
      if (path === 'requests') {
        return this.getAllRequests()
      }

      if (path === 'requests/recent') {
        return this.getRecentRequests()
      }

      if (path === 'requests/failed') {
        return this.getFailedRequests()
      }

      if (path === 'cookies') {
        return this.getCookies()
      }

      // Dynamic request resources
      if (path.startsWith('request/')) {
        const parts = path.split('/')
        const requestId = parts[1]

        if (parts.length === 2) {
          return this.getRequest(requestId)
        }

        if (parts[2] === 'response') {
          return this.getResponseBody(requestId)
        }
      }

      // Filtered resources
      if (path.startsWith('requests/filter/')) {
        const type = path.substring(16)
        return this.getRequestsByType(type as Network.ResourceType)
      }

      if (path.startsWith('requests/domain/')) {
        const domain = decodeURIComponent(path.substring(16))
        return this.getRequestsByDomain(domain)
      }

      throw new Error(`Unknown resource: ${uri}`)
    } catch (error) {
      logger.error('Failed to read network resource', { uri, error })
      throw error
    }
  }

  /**
   * Get all requests
   */
  private async getAllRequests(): Promise<{ content: string; mimeType: string }> {
    const requests = this.network.getRequests()
    
    const summary = {
      total: requests.length,
      byType: this.groupByType(requests),
      byStatus: this.groupByStatus(requests),
      byDomain: this.groupByDomain(requests),
      requests: requests.map(r => this.summarizeRequest(r))
    }

    return {
      content: JSON.stringify(summary, null, 2),
      mimeType: 'application/json'
    }
  }

  /**
   * Get recent requests
   */
  private async getRecentRequests(): Promise<{ content: string; mimeType: string }> {
    const requests = this.network.getRecentRequests()
    
    return {
      content: JSON.stringify({
        total: requests.length,
        requests: requests.map(r => this.summarizeRequest(r))
      }, null, 2),
      mimeType: 'application/json'
    }
  }

  /**
   * Get failed requests
   */
  private async getFailedRequests(): Promise<{ content: string; mimeType: string }> {
    const allRequests = this.network.getRequests()
    const failed = allRequests.filter(r => r.failed || (r.response && r.response.status >= 400))
    
    return {
      content: JSON.stringify({
        total: failed.length,
        requests: failed.map(r => ({
          ...this.summarizeRequest(r),
          error: r.errorText,
          status: r.response?.status
        }))
      }, null, 2),
      mimeType: 'application/json'
    }
  }

  /**
   * Get specific request
   */
  private async getRequest(requestId: string): Promise<{ content: string; mimeType: string }> {
    const request = this.network.getRequest(requestId)
    if (!request) {
      throw new Error(`Request not found: ${requestId}`)
    }

    const response = this.network.getResponse(requestId)
    
    return {
      content: JSON.stringify({
        request: this.detailRequest(request),
        response: response ? this.detailResponse(response) : null
      }, null, 2),
      mimeType: 'application/json'
    }
  }

  /**
   * Get response body
   */
  private async getResponseBody(requestId: string): Promise<{ content: string; mimeType: string }> {
    const body = await this.network.getResponseBody(requestId)
    if (!body) {
      throw new Error(`Response body not available for request: ${requestId}`)
    }

    // Try to parse JSON if possible
    let content: any = body.body
    if (!body.base64Encoded) {
      try {
        content = JSON.parse(body.body)
      } catch {
        // Not JSON, keep as string
      }
    }

    return {
      content: JSON.stringify({
        requestId,
        base64Encoded: body.base64Encoded,
        body: content,
        size: body.body.length
      }, null, 2),
      mimeType: 'application/json'
    }
  }

  /**
   * Get requests by type
   */
  private async getRequestsByType(type: Network.ResourceType): Promise<{ content: string; mimeType: string }> {
    const allRequests = this.network.getRequests()
    const filtered = allRequests.filter(r => r.type === type)
    
    return {
      content: JSON.stringify({
        type,
        total: filtered.length,
        requests: filtered.map(r => this.summarizeRequest(r))
      }, null, 2),
      mimeType: 'application/json'
    }
  }

  /**
   * Get requests by domain
   */
  private async getRequestsByDomain(domain: string): Promise<{ content: string; mimeType: string }> {
    const allRequests = this.network.getRequests()
    const filtered = allRequests.filter(r => {
      try {
        const url = new URL(r.url)
        return url.hostname.includes(domain)
      } catch {
        return false
      }
    })
    
    return {
      content: JSON.stringify({
        domain,
        total: filtered.length,
        requests: filtered.map(r => this.summarizeRequest(r))
      }, null, 2),
      mimeType: 'application/json'
    }
  }

  /**
   * Get cookies
   */
  private async getCookies(): Promise<{ content: string; mimeType: string }> {
    const cookies = await this.network.getCookies()
    
    return {
      content: JSON.stringify({
        total: cookies.length,
        cookies: cookies.map(c => ({
          name: c.name,
          value: c.value.substring(0, 50) + (c.value.length > 50 ? '...' : ''),
          domain: c.domain,
          path: c.path,
          expires: c.expires,
          httpOnly: c.httpOnly,
          secure: c.secure,
          sameSite: c.sameSite
        }))
      }, null, 2),
      mimeType: 'application/json'
    }
  }

  /**
   * Summarize request for listing
   */
  private summarizeRequest(request: Network.Request): any {
    const url = new URL(request.url)
    return {
      requestId: request.requestId,
      method: request.method,
      url: request.url,
      path: url.pathname,
      domain: url.hostname,
      type: request.type,
      timestamp: request.timestamp,
      status: request.response?.status,
      size: request.response?.encodedDataLength,
      duration: request.response ? 
        (request.response.timestamp || 0) - (request.timestamp || 0) : null,
      failed: request.failed
    }
  }

  /**
   * Detail request
   */
  private detailRequest(request: Network.Request): any {
    return {
      ...request,
      headersCount: Object.keys(request.headers || {}).length,
      hasPostData: !!request.postData
    }
  }

  /**
   * Detail response
   */
  private detailResponse(response: Network.Response): any {
    return {
      ...response,
      headersCount: Object.keys(response.headers || {}).length,
      mimeType: response.mimeType,
      fromCache: response.fromDiskCache || response.fromServiceWorker,
      encodedSize: response.encodedDataLength
    }
  }

  /**
   * Group requests by type
   */
  private groupByType(requests: Network.Request[]): Record<string, number> {
    return requests.reduce((acc, req) => {
      const type = req.type || 'Other'
      acc[type] = (acc[type] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  }

  /**
   * Group requests by status
   */
  private groupByStatus(requests: Network.Request[]): Record<string, number> {
    return requests.reduce((acc, req) => {
      const status = req.response?.status || (req.failed ? 'Failed' : 'Pending')
      const category = this.getStatusCategory(status)
      acc[category] = (acc[category] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  }

  /**
   * Group requests by domain
   */
  private groupByDomain(requests: Network.Request[]): Record<string, number> {
    return requests.reduce((acc, req) => {
      try {
        const url = new URL(req.url)
        acc[url.hostname] = (acc[url.hostname] || 0) + 1
      } catch {
        acc['invalid'] = (acc['invalid'] || 0) + 1
      }
      return acc
    }, {} as Record<string, number>)
  }

  /**
   * Get status category
   */
  private getStatusCategory(status: number | string): string {
    if (typeof status === 'string') return status
    if (status >= 200 && status < 300) return '2xx Success'
    if (status >= 300 && status < 400) return '3xx Redirect'
    if (status >= 400 && status < 500) return '4xx Client Error'
    if (status >= 500) return '5xx Server Error'
    return 'Other'
  }
}