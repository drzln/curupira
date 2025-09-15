/**
 * Network control tool
 * 
 * Provides MCP tools for network interception and control
 */

import type { NetworkDomain } from '../chrome/domains/network.js'
import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { logger } from '../config/logger.js'

// Tool parameter schemas
const setCacheDisabledSchema = z.object({
  disabled: z.boolean().describe('Whether to disable cache')
})

const setUserAgentSchema = z.object({
  userAgent: z.string().describe('User agent string to use'),
  acceptLanguage: z.string().optional().describe('Accept-Language header value'),
  platform: z.string().optional().describe('Platform to report')
})

const setExtraHeadersSchema = z.object({
  headers: z.record(z.string()).describe('Extra HTTP headers to send')
})

const blockRequestsSchema = z.object({
  patterns: z.array(z.string()).describe('URL patterns to block (supports wildcards)')
})

const throttleNetworkSchema = z.object({
  downloadThroughput: z.number().describe('Download speed in bytes/sec (-1 for no limit)'),
  uploadThroughput: z.number().describe('Upload speed in bytes/sec (-1 for no limit)'),
  latency: z.number().describe('Additional latency in ms')
})

const clearDataSchema = z.object({
  cookies: z.boolean().optional().describe('Clear cookies (default: true)'),
  cache: z.boolean().optional().describe('Clear cache (default: true)')
})

const setCookieSchema = z.object({
  name: z.string().describe('Cookie name'),
  value: z.string().describe('Cookie value'),
  domain: z.string().optional().describe('Cookie domain'),
  path: z.string().optional().describe('Cookie path'),
  secure: z.boolean().optional().describe('Secure cookie'),
  httpOnly: z.boolean().optional().describe('HTTP only cookie'),
  sameSite: z.enum(['Strict', 'Lax', 'None']).optional().describe('SameSite attribute'),
  expires: z.number().optional().describe('Expiration timestamp')
})

const deleteCookiesSchema = z.object({
  name: z.string().describe('Cookie name to delete'),
  domain: z.string().optional().describe('Cookie domain'),
  path: z.string().optional().describe('Cookie path')
})

export class NetworkTool {
  private readonly toolPrefix = 'network'
  private blockedPatterns: string[] = []

  constructor(private network: NetworkDomain) {}

  /**
   * List available network tools
   */
  listTools(): Tool[] {
    return [
      {
        name: `${this.toolPrefix}/setCacheDisabled`,
        description: 'Enable or disable browser cache',
        inputSchema: setCacheDisabledSchema as any
      },
      {
        name: `${this.toolPrefix}/setUserAgent`,
        description: 'Override user agent string',
        inputSchema: setUserAgentSchema as any
      },
      {
        name: `${this.toolPrefix}/setExtraHeaders`,
        description: 'Set extra HTTP headers for all requests',
        inputSchema: setExtraHeadersSchema as any
      },
      {
        name: `${this.toolPrefix}/blockRequests`,
        description: 'Block network requests matching patterns',
        inputSchema: blockRequestsSchema as any
      },
      {
        name: `${this.toolPrefix}/throttleNetwork`,
        description: 'Simulate slow network conditions',
        inputSchema: throttleNetworkSchema as any
      },
      {
        name: `${this.toolPrefix}/clearData`,
        description: 'Clear cookies and/or cache',
        inputSchema: clearDataSchema as any
      },
      {
        name: `${this.toolPrefix}/setCookie`,
        description: 'Set a cookie',
        inputSchema: setCookieSchema as any
      },
      {
        name: `${this.toolPrefix}/deleteCookies`,
        description: 'Delete cookies',
        inputSchema: deleteCookiesSchema as any
      }
    ]
  }

  /**
   * Call a tool
   */
  async callTool(name: string, args: unknown): Promise<any> {
    const toolName = name.replace(`${this.toolPrefix}/`, '')

    try {
      switch (toolName) {
        case 'setCacheDisabled':
          return this.setCacheDisabled(setCacheDisabledSchema.parse(args))
        
        case 'setUserAgent':
          return this.setUserAgent(setUserAgentSchema.parse(args))
        
        case 'setExtraHeaders':
          return this.setExtraHeaders(setExtraHeadersSchema.parse(args))
        
        case 'blockRequests':
          return this.blockRequests(blockRequestsSchema.parse(args))
        
        case 'throttleNetwork':
          return this.throttleNetwork(throttleNetworkSchema.parse(args))
        
        case 'clearData':
          return this.clearData(clearDataSchema.parse(args))
        
        case 'setCookie':
          return this.setCookie(setCookieSchema.parse(args))
        
        case 'deleteCookies':
          return this.deleteCookies(deleteCookiesSchema.parse(args))
        
        default:
          throw new Error(`Unknown tool: ${name}`)
      }
    } catch (error) {
      logger.error('Network tool execution failed', { name, args, error })
      throw error
    }
  }

  /**
   * Set cache disabled
   */
  private async setCacheDisabled(args: z.infer<typeof setCacheDisabledSchema>) {
    await this.network.setCacheDisabled(args.disabled)

    return {
      cacheDisabled: args.disabled,
      success: true
    }
  }

  /**
   * Set user agent
   */
  private async setUserAgent(args: z.infer<typeof setUserAgentSchema>) {
    await this.network.setUserAgentOverride(args.userAgent, {
      acceptLanguage: args.acceptLanguage,
      platform: args.platform
    })

    return {
      userAgent: args.userAgent,
      acceptLanguage: args.acceptLanguage,
      platform: args.platform,
      success: true
    }
  }

  /**
   * Set extra headers
   */
  private async setExtraHeaders(args: z.infer<typeof setExtraHeadersSchema>) {
    await this.network.setExtraHTTPHeaders(args.headers)

    return {
      headers: args.headers,
      headerCount: Object.keys(args.headers).length,
      success: true
    }
  }

  /**
   * Block requests
   */
  private async blockRequests(args: z.infer<typeof blockRequestsSchema>) {
    this.blockedPatterns = args.patterns

    // Set up request interception
    const patterns = args.patterns.map(pattern => ({
      urlPattern: pattern
    }))

    await this.network.setRequestInterception(patterns)

    // Set up handler
    this.network.onRequestIntercepted((params) => {
      const shouldBlock = this.blockedPatterns.some(pattern => {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'))
        return regex.test(params.request.url)
      })

      if (shouldBlock) {
        this.network.continueInterceptedRequest(params.interceptionId, {
          errorReason: 'BlockedByInspector' as any
        })
      } else {
        this.network.continueInterceptedRequest(params.interceptionId)
      }
    })

    return {
      patterns: args.patterns,
      patternCount: args.patterns.length,
      success: true
    }
  }

  /**
   * Throttle network
   */
  private async throttleNetwork(args: z.infer<typeof throttleNetworkSchema>) {
    // This would require Emulation domain which we haven't implemented yet
    // For now, we'll return a placeholder
    logger.warn('Network throttling not fully implemented yet')

    return {
      downloadThroughput: args.downloadThroughput,
      uploadThroughput: args.uploadThroughput,
      latency: args.latency,
      success: false,
      reason: 'Network throttling requires Emulation domain (not implemented)'
    }
  }

  /**
   * Clear data
   */
  private async clearData(args: z.infer<typeof clearDataSchema>) {
    const results = {
      cookiesCleared: false,
      cacheCleared: false
    }

    if (args.cookies !== false) {
      await this.network.clearBrowserCookies()
      results.cookiesCleared = true
    }

    if (args.cache !== false) {
      await this.network.clearBrowserCache()
      results.cacheCleared = true
    }

    return {
      ...results,
      success: true
    }
  }

  /**
   * Set cookie
   */
  private async setCookie(args: z.infer<typeof setCookieSchema>) {
    const success = await this.network.setCookie({
      name: args.name,
      value: args.value,
      domain: args.domain,
      path: args.path || '/',
      secure: args.secure,
      httpOnly: args.httpOnly,
      sameSite: args.sameSite,
      expires: args.expires
    })

    return {
      cookie: {
        name: args.name,
        value: args.value,
        domain: args.domain,
        path: args.path
      },
      success
    }
  }

  /**
   * Delete cookies
   */
  private async deleteCookies(args: z.infer<typeof deleteCookiesSchema>) {
    await this.network.deleteCookies(args.name, {
      domain: args.domain,
      path: args.path
    })

    return {
      name: args.name,
      domain: args.domain,
      path: args.path,
      success: true
    }
  }

  /**
   * Get network statistics
   */
  async getNetworkStats() {
    const requests = this.network.getRequests()
    
    const stats = {
      totalRequests: requests.length,
      failedRequests: requests.filter(r => r.failed).length,
      cachedRequests: requests.filter(r => r.response?.fromDiskCache || r.response?.fromServiceWorker).length,
      totalBytes: requests.reduce((sum, r) => sum + (r.response?.encodedDataLength || 0), 0),
      averageResponseTime: 0,
      requestsByType: {} as Record<string, number>,
      requestsByDomain: {} as Record<string, number>
    }

    // Calculate average response time
    const responseTimes = requests
      .filter(r => r.response && r.timestamp)
      .map(r => (r.response!.timestamp || 0) - (r.timestamp || 0))
      .filter(t => t > 0)
    
    if (responseTimes.length > 0) {
      stats.averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    }

    // Group by type
    requests.forEach(r => {
      const type = r.type || 'Other'
      stats.requestsByType[type] = (stats.requestsByType[type] || 0) + 1
    })

    // Group by domain
    requests.forEach(r => {
      try {
        const url = new URL(r.url)
        stats.requestsByDomain[url.hostname] = (stats.requestsByDomain[url.hostname] || 0) + 1
      } catch {
        stats.requestsByDomain['invalid'] = (stats.requestsByDomain['invalid'] || 0) + 1
      }
    })

    return stats
  }
}