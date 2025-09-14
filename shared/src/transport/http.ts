/**
 * @fileoverview HTTP transport implementation
 * 
 * This file provides an HTTP-based transport for request/response communication,
 * with support for retries and long polling for server-sent events.
 */

import { BaseTransport } from './base.js'
import type {
  HttpTransportConfig,
  TransportMessage,
  TransportCapabilities,
  TransportResponse,
  ConnectionOptions
} from './types.js'
import { NetworkErrors, ValidationErrors } from '../errors/index.js'
import { withRetry } from '../errors/index.js'
import {
  createRequestId,
  createTimestamp,
  createDuration
} from '../types/index.js'
import type { Duration } from '../types/index.js'

/**
 * HTTP transport implementation
 */
export class HttpTransport extends BaseTransport<HttpTransportConfig> {
  private abortController?: AbortController
  private activeFetches = new Set<Promise<any>>()

  /**
   * Get transport capabilities
   */
  get capabilities(): TransportCapabilities {
    return {
      bidirectional: false,
      streaming: false,
      batching: true,
      compression: true,
      encryption: true,
      authentication: true,
      qos: false,
      maxMessageSize: this.config.maxMessageSize
    }
  }

  /**
   * Get connection string for logging
   */
  protected getConnectionString(): string {
    return this.config.baseUrl
  }

  /**
   * Perform HTTP connection (validate endpoint)
   */
  protected async doConnect(): Promise<void> {
    try {
      // Validate base URL
      const url = new URL(this.config.baseUrl)
      
      // Perform a health check request
      const response = await this.request('/health', {
        method: 'GET',
        timeout: 5000
      })

      if (!response.data || (response.metadata?.status && response.metadata.status >= 400)) {
        throw new Error(`Health check failed with status ${response.metadata?.status || 'unknown'}`)
      }

      this.logger.info({ baseUrl: this.config.baseUrl }, 'HTTP transport connected')
      
      if (this._connectionInfo) {
        this._connectionInfo.remoteAddress = url.hostname
        this._connectionInfo.metadata = {
          protocol: url.protocol,
          port: url.port || (url.protocol === 'https:' ? '443' : '80')
        }
      }

    } catch (error) {
      throw NetworkErrors.connectionFailed(
        this.config.baseUrl,
        error instanceof Error ? error.message : 'Connection validation failed'
      )
    }
  }

  /**
   * Perform HTTP disconnection
   */
  protected async doDisconnect(reason?: string): Promise<void> {
    // Cancel any active requests
    if (this.abortController) {
      this.abortController.abort(reason)
      this.abortController = undefined
    }

    // Wait for active fetches to complete
    await Promise.allSettled(this.activeFetches)
    this.activeFetches.clear()
  }

  /**
   * Send message via HTTP
   */
  protected async doSend<T>(message: TransportMessage<T>): Promise<void> {
    const response = await this.request('/messages', {
      method: 'POST',
      body: message
    })

    if (!response.data || (response.metadata?.status && response.metadata.status >= 400)) {
      throw NetworkErrors.sendFailed(
        `HTTP request failed with status ${response.metadata?.status || 'unknown'}`
      )
    }
  }

  /**
   * Send keep-alive request
   */
  protected async sendKeepAlive(): Promise<void> {
    try {
      await this.request('/ping', {
        method: 'GET',
        timeout: 5000
      })
    } catch (error) {
      // Keep-alive failures are logged but not fatal
      this.logger.warn({ error }, 'Keep-alive request failed')
    }
  }

  /**
   * Make HTTP request with retries
   */
  async request<T = any>(
    endpoint: string,
    options: ConnectionOptions & {
      method?: string
      body?: any
      query?: Record<string, string>
    } = {}
  ): Promise<TransportResponse<T>> {
    const url = this.buildUrl(endpoint, options.query)
    const method = options.method || this.config.method || 'POST'
    
    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...this.config.headers,
        ...options.headers
      },
      credentials: this.config.credentials,
      mode: this.config.mode,
      cache: this.config.cache,
      signal: options.signal || this.createAbortSignal(options.timeout)
    }

    if (options.body) {
      fetchOptions.body = JSON.stringify(options.body)
    }

    const startTime = Date.now()

    const performRequest = async (): Promise<Response> => {
      const fetchPromise = fetch(url, fetchOptions)
      this.activeFetches.add(fetchPromise)

      try {
        return await fetchPromise
      } finally {
        this.activeFetches.delete(fetchPromise)
      }
    }

    try {
      let response: Response

      if (this.config.retry?.enabled) {
        response = await withRetry(
          performRequest,
          {
            maxAttempts: options.retry?.maxAttempts || this.config.retry.maxAttempts,
            baseDelay: this.config.retry.delay,
            backoffMultiplier: this.config.retry.backoffMultiplier,
            shouldRetry: (error) => {
              // Don't retry on client errors (4xx)
              if (error instanceof Response && error.status >= 400 && error.status < 500) {
                return false
              }
              return true
            }
          }
        )
      } else {
        response = await performRequest()
      }

      const rtt = Date.now() - startTime

      // Parse response
      let data: T
      const contentType = response.headers.get('content-type')
      
      if (contentType?.includes('application/json')) {
        data = await response.json()
      } else {
        data = await response.text() as any
      }

      // Handle incoming messages for long polling
      if (endpoint === '/messages' && method === 'GET' && Array.isArray(data)) {
        for (const message of data as any[]) {
          this.handleMessage(message)
        }
      }

      return {
        data,
        metadata: {
          requestId: createRequestId(Date.now().toString() + '-' + Math.random().toString(36).substring(2, 9)),
          timestamp: createTimestamp(),
          rtt: createDuration(rtt),
          headers: {},
          status: response.status
        }
      }

    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw NetworkErrors.timeout('Request aborted', options.timeout)
        }
        throw NetworkErrors.requestFailed(url, error.message)
      }
      throw error
    }
  }

  /**
   * Start long polling for server-sent events
   */
  async startLongPolling(
    onMessage: (message: TransportMessage) => void,
    options: ConnectionOptions = {}
  ): Promise<() => void> {
    let active = true
    const abortController = new AbortController()

    const poll = async () => {
      while (active && this.isConnected()) {
        try {
          const response = await this.request<TransportMessage[]>('/messages', {
            method: 'GET',
            timeout: 60000, // 1 minute timeout for long polling
            signal: abortController.signal
          })

          if (response.data && Array.isArray(response.data)) {
            for (const message of response.data) {
              onMessage(message)
              this.handleMessage(message)
            }
          }

        } catch (error) {
          if (!active || error instanceof Error && error.name === 'AbortError') {
            break
          }

          this.logger.error({ error }, 'Long polling error')
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 5000))
        }
      }
    }

    // Start polling in background
    poll().catch(error => {
      this.logger.error({ error }, 'Long polling failed')
    })

    // Return stop function
    return () => {
      active = false
      abortController.abort()
    }
  }

  /**
   * Build full URL with query parameters
   */
  private buildUrl(endpoint: string, query?: Record<string, string>): string {
    const url = new URL(endpoint, this.config.baseUrl)
    
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        url.searchParams.append(key, value)
      })
    }

    return url.toString()
  }

  /**
   * Create abort signal with timeout
   */
  private createAbortSignal(timeout?: number): AbortSignal {
    if (!this.abortController) {
      this.abortController = new AbortController()
    }

    const signal = this.abortController.signal

    if (timeout) {
      const timeoutId = setTimeout(() => {
        this.abortController?.abort()
      }, timeout)

      // Clean up timeout when signal is aborted
      signal.addEventListener('abort', () => {
        clearTimeout(timeoutId)
      })
    }

    return signal
  }
}

/**
 * Create HTTP transport
 */
export function createHttpTransport(
  config: HttpTransportConfig
): HttpTransport {
  return new HttpTransport(config)
}