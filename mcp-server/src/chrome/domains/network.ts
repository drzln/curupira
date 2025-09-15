/**
 * Network domain wrapper for Chrome DevTools Protocol
 * 
 * Provides typed access to Network domain methods with proper error handling
 */

import type { ChromeClient } from '../client.js'
import type { Network } from '@curupira/shared/types/cdp.js'
import type { RequestId, Timestamp } from '@curupira/shared/types/branded.js'
import { CircularBuffer } from '@curupira/shared/utils'
import { logger } from '../../config/logger.js'

export class NetworkDomain {
  private requests: Map<string, Network.Request> = new Map()
  private responses: Map<string, Network.Response> = new Map()
  private requestBuffer: CircularBuffer<Network.Request>

  constructor(
    private client: ChromeClient,
    private sessionId: string,
    bufferSize = 500
  ) {
    this.requestBuffer = new CircularBuffer(bufferSize)
  }

  /**
   * Enable the Network domain
   */
  async enable(options: {
    maxTotalBufferSize?: number
    maxResourceBufferSize?: number
    maxPostDataSize?: number
  } = {}): Promise<void> {
    await this.client.send('Network.enable', options, this.sessionId)
    this.setupEventHandlers()
  }

  /**
   * Disable the Network domain
   */
  async disable(): Promise<void> {
    await this.client.send('Network.disable', {}, this.sessionId)
    this.requests.clear()
    this.responses.clear()
    this.requestBuffer.clear()
  }

  /**
   * Set user agent override
   */
  async setUserAgentOverride(
    userAgent: string,
    options: {
      acceptLanguage?: string
      platform?: string
    } = {}
  ): Promise<void> {
    await this.client.send('Network.setUserAgentOverride', {
      userAgent,
      ...options
    }, this.sessionId)
  }

  /**
   * Set extra HTTP headers
   */
  async setExtraHTTPHeaders(headers: Record<string, string>): Promise<void> {
    await this.client.send('Network.setExtraHTTPHeaders', { headers }, this.sessionId)
  }

  /**
   * Set request interception
   */
  async setRequestInterception(patterns: Array<{
    urlPattern?: string
    resourceType?: Network.ResourceType
    interceptionStage?: 'Request' | 'HeadersReceived'
  }>): Promise<void> {
    await this.client.send('Network.setRequestInterception', { patterns }, this.sessionId)
  }

  /**
   * Continue intercepted request
   */
  async continueInterceptedRequest(
    interceptionId: string,
    options: {
      errorReason?: Network.ErrorReason
      rawResponse?: string
      url?: string
      method?: string
      postData?: string
      headers?: Record<string, string>
    } = {}
  ): Promise<void> {
    await this.client.send('Network.continueInterceptedRequest', {
      interceptionId,
      ...options
    }, this.sessionId)
  }

  /**
   * Get response body
   */
  async getResponseBody(requestId: string): Promise<{
    body: string
    base64Encoded: boolean
  } | null> {
    try {
      const result = await this.client.send<{
        body: string
        base64Encoded: boolean
      }>('Network.getResponseBody', { requestId }, this.sessionId)
      
      return result
    } catch (error) {
      logger.error('Network.getResponseBody failed', { requestId, error })
      return null
    }
  }

  /**
   * Get request post data
   */
  async getRequestPostData(requestId: string): Promise<string | null> {
    try {
      const result = await this.client.send<{
        postData: string
      }>('Network.getRequestPostData', { requestId }, this.sessionId)
      
      return result.postData
    } catch (error) {
      logger.error('Network.getRequestPostData failed', { requestId, error })
      return null
    }
  }

  /**
   * Set cache disabled
   */
  async setCacheDisabled(cacheDisabled: boolean): Promise<void> {
    await this.client.send('Network.setCacheDisabled', { cacheDisabled }, this.sessionId)
  }

  /**
   * Clear browser cache
   */
  async clearBrowserCache(): Promise<void> {
    await this.client.send('Network.clearBrowserCache', {}, this.sessionId)
  }

  /**
   * Clear browser cookies
   */
  async clearBrowserCookies(): Promise<void> {
    await this.client.send('Network.clearBrowserCookies', {}, this.sessionId)
  }

  /**
   * Get all cookies
   */
  async getCookies(urls?: string[]): Promise<Network.Cookie[]> {
    try {
      const result = await this.client.send<{
        cookies: Network.Cookie[]
      }>('Network.getCookies', urls ? { urls } : {}, this.sessionId)
      
      return result.cookies
    } catch (error) {
      logger.error('Network.getCookies failed', error)
      return []
    }
  }

  /**
   * Set cookie
   */
  async setCookie(cookie: Network.CookieParam): Promise<boolean> {
    try {
      const result = await this.client.send<{
        success: boolean
      }>('Network.setCookie', cookie as unknown as Record<string, unknown>, this.sessionId)
      
      return result.success
    } catch (error) {
      logger.error('Network.setCookie failed', { cookie, error })
      return false
    }
  }

  /**
   * Delete cookies
   */
  async deleteCookies(
    name: string,
    options: {
      url?: string
      domain?: string
      path?: string
    } = {}
  ): Promise<void> {
    await this.client.send('Network.deleteCookies', {
      name,
      ...options
    }, this.sessionId)
  }

  /**
   * Get all network requests
   */
  getRequests(): Network.Request[] {
    return Array.from(this.requests.values())
  }

  /**
   * Get request by ID
   */
  getRequest(requestId: string): Network.Request | undefined {
    return this.requests.get(requestId)
  }

  /**
   * Get response by request ID
   */
  getResponse(requestId: string): Network.Response | undefined {
    return this.responses.get(requestId)
  }

  /**
   * Get recent requests from buffer
   */
  getRecentRequests(): Network.Request[] {
    return this.requestBuffer.getAll()
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Request will be sent
    this.client.onSessionEvent(this.sessionId, 'Network.requestWillBeSent', (params: {
      requestId: string
      loaderId: string
      documentURL: string
      request: Network.Request
      timestamp: number
      wallTime: number
      initiator: Network.Initiator
      type?: Network.ResourceType
      frameId?: string
    }) => {
      const request: Network.Request = {
        ...params.request,
        requestId: params.requestId as RequestId,
        timestamp: params.timestamp as Timestamp,
        type: params.type
      }
      
      this.requests.set(params.requestId, request)
      this.requestBuffer.push(request)
    })

    // Response received
    this.client.onSessionEvent(this.sessionId, 'Network.responseReceived', (params: {
      requestId: string
      loaderId: string
      timestamp: number
      type: Network.ResourceType
      response: Network.Response
      frameId?: string
    }) => {
      this.responses.set(params.requestId, params.response)
      
      // Update request with response info
      const request = this.requests.get(params.requestId)
      if (request) {
        request.response = params.response
      }
    })

    // Loading finished
    this.client.onSessionEvent(this.sessionId, 'Network.loadingFinished', (params: {
      requestId: string
      timestamp: number
      encodedDataLength: number
      shouldReportCorbBlocking?: boolean
    }) => {
      const request = this.requests.get(params.requestId)
      if (request) {
        request.encodedDataLength = params.encodedDataLength
        request.finished = true
      }
    })

    // Loading failed
    this.client.onSessionEvent(this.sessionId, 'Network.loadingFailed', (params: {
      requestId: string
      timestamp: number
      type: Network.ResourceType
      errorText: string
      canceled?: boolean
      blockedReason?: Network.BlockedReason
    }) => {
      const request = this.requests.get(params.requestId)
      if (request) {
        request.failed = true
        request.errorText = params.errorText
      }
    })
  }

  /**
   * Set up request intercepted event listener
   */
  onRequestIntercepted(
    handler: (params: {
      interceptionId: string
      request: Network.Request
      frameId: string
      resourceType: Network.ResourceType
      isNavigationRequest: boolean
    }) => void
  ): void {
    this.client.onSessionEvent(this.sessionId, 'Network.requestIntercepted', handler)
  }

  /**
   * Set up request will be sent event listener
   */
  onRequestWillBeSent(
    handler: (params: {
      requestId: string
      request: Network.Request
      timestamp: number
      initiator: Network.Initiator
    }) => void
  ): void {
    this.client.onSessionEvent(this.sessionId, 'Network.requestWillBeSent', handler)
  }

  /**
   * Set up response received event listener
   */
  onResponseReceived(
    handler: (params: {
      requestId: string
      response: Network.Response
      timestamp: number
    }) => void
  ): void {
    this.client.onSessionEvent(this.sessionId, 'Network.responseReceived', handler)
  }

  /**
   * Set up data received event listener
   */
  onDataReceived(
    handler: (params: {
      requestId: string
      timestamp: number
      dataLength: number
      encodedDataLength: number
    }) => void
  ): void {
    this.client.onSessionEvent(this.sessionId, 'Network.dataReceived', handler)
  }

  /**
   * Set up loading finished event listener
   */
  onLoadingFinished(
    handler: (params: {
      requestId: string
      timestamp: number
      encodedDataLength: number
    }) => void
  ): void {
    this.client.onSessionEvent(this.sessionId, 'Network.loadingFinished', handler)
  }

  /**
   * Set up loading failed event listener
   */
  onLoadingFailed(
    handler: (params: {
      requestId: string
      timestamp: number
      errorText: string
      canceled?: boolean
    }) => void
  ): void {
    this.client.onSessionEvent(this.sessionId, 'Network.loadingFailed', handler)
  }
}