/**
 * @fileoverview Chrome DevTools Protocol session
 * 
 * This file provides session management for CDP connections,
 * handling per-target communication and domain management.
 */

import { EventEmitter } from 'eventemitter3'
import type {
  CdpTargetInfo,
  CdpCommand,
  CdpResult,
  CdpEvent,
  CdpEventHandler
} from './types.js'
import type { SessionId, Timestamp } from '@curupira/shared'
import { createLogger, type Logger } from '@curupira/shared'

/**
 * CDP session events
 */
export interface CdpSessionEvents {
  /** Event received */
  'event': (event: CdpEvent) => void
  /** Session destroyed */
  'destroyed': () => void
}

/**
 * CDP session
 */
export class CdpSession extends EventEmitter<CdpSessionEvents> {
  private readonly sessionId: SessionId
  private readonly client: any // CdpClient to avoid circular dep
  private readonly target: CdpTargetInfo
  private readonly logger: Logger
  private readonly eventHandlers = new Map<string, Set<CdpEventHandler>>()
  private readonly enabledDomains = new Set<string>()
  private destroyed = false
  private lastActivity: Timestamp = Date.now() as Timestamp

  constructor(
    sessionId: SessionId,
    client: any,
    target: CdpTargetInfo
  ) {
    super()
    this.sessionId = sessionId
    this.client = client
    this.target = target
    this.logger = createLogger({ 
      level: 'info',
      context: { sessionId } 
    })
  }

  /**
   * Get session ID
   */
  getId(): SessionId {
    return this.sessionId
  }

  /**
   * Get target info
   */
  getTargetInfo(): CdpTargetInfo {
    return this.target
  }

  /**
   * Get enabled domains
   */
  getEnabledDomains(): ReadonlySet<string> {
    return new Set(this.enabledDomains)
  }

  /**
   * Get last activity timestamp
   */
  getLastActivity(): Timestamp {
    return this.lastActivity
  }

  /**
   * Check if session is destroyed
   */
  isDestroyed(): boolean {
    return this.destroyed
  }

  /**
   * Send command
   */
  async send<TParams = unknown, TResult = unknown>(
    command: CdpCommand<string, TParams>
  ): Promise<CdpResult<TResult>> {
    if (this.destroyed) {
      throw new Error('Session is destroyed')
    }

    this.lastActivity = Date.now() as Timestamp

    // Forward to client with session ID
    return this.client.send({
      ...command,
      sessionId: this.sessionId
    })
  }

  /**
   * Enable domain
   */
  async enableDomain(domain: string): Promise<void> {
    if (this.enabledDomains.has(domain)) {
      return
    }

    await this.send({ method: `${domain}.enable` })
    this.enabledDomains.add(domain)
    
    this.logger.debug({ domain }, 'Domain enabled')
  }

  /**
   * Disable domain
   */
  async disableDomain(domain: string): Promise<void> {
    if (!this.enabledDomains.has(domain)) {
      return
    }

    await this.send({ method: `${domain}.disable` })
    this.enabledDomains.delete(domain)
    
    this.logger.debug({ domain }, 'Domain disabled')
  }

  /**
   * Subscribe to event
   */
  on(event: string, handler: CdpEventHandler): this {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set())
    }
    
    this.eventHandlers.get(event)!.add(handler)
    return this
  }

  /**
   * Unsubscribe from event
   */
  off(event: string, handler: CdpEventHandler): this {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      handlers.delete(handler)
      if (handlers.size === 0) {
        this.eventHandlers.delete(event)
      }
    }
    
    return this
  }

  /**
   * Handle incoming event
   */
  handleEvent(event: CdpEvent): void {
    if (this.destroyed) {
      return
    }

    this.lastActivity = Date.now() as Timestamp
    
    // Emit generic event
    this.emit('event', event)
    
    // Call specific handlers
    const handlers = this.eventHandlers.get(event.method)
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(event.params, this.sessionId)
        } catch (error) {
          this.logger.error({ error, event }, 'Event handler error')
        }
      }
    }
  }

  /**
   * Evaluate expression
   */
  async evaluate<T = unknown>(
    expression: string,
    options?: {
      awaitPromise?: boolean
      returnByValue?: boolean
      userGesture?: boolean
      includeCommandLineAPI?: boolean
    }
  ): Promise<T> {
    const result = await this.send<any, any>({
      method: 'Runtime.evaluate',
      params: {
        expression,
        ...options
      }
    })

    if (result.error) {
      throw new Error(result.error.message)
    }

    if (result.result?.exceptionDetails) {
      throw new Error(result.result.exceptionDetails.text)
    }

    return result.result?.result?.value as T
  }

  /**
   * Navigate to URL
   */
  async navigate(url: string): Promise<void> {
    await this.send({
      method: 'Page.navigate',
      params: { url }
    })
  }

  /**
   * Take screenshot
   */
  async screenshot(options?: {
    format?: 'jpeg' | 'png' | 'webp'
    quality?: number
    clip?: {
      x: number
      y: number
      width: number
      height: number
    }
    fullPage?: boolean
  }): Promise<string> {
    const result = await this.send<any, { data: string }>({
      method: 'Page.captureScreenshot',
      params: options
    })

    if (!result.result?.data) {
      throw new Error('No screenshot data returned')
    }

    return result.result.data
  }

  /**
   * Get cookies
   */
  async getCookies(urls?: string[]): Promise<any[]> {
    const result = await this.send<any, { cookies: any[] }>({
      method: 'Network.getCookies',
      params: { urls }
    })

    return result.result?.cookies || []
  }

  /**
   * Set cookie
   */
  async setCookie(cookie: {
    name: string
    value: string
    url?: string
    domain?: string
    path?: string
    secure?: boolean
    httpOnly?: boolean
    sameSite?: 'Strict' | 'Lax' | 'None'
    expires?: number
  }): Promise<void> {
    await this.send({
      method: 'Network.setCookie',
      params: cookie
    })
  }

  /**
   * Clear cookies
   */
  async clearCookies(): Promise<void> {
    await this.send({
      method: 'Network.clearBrowserCookies'
    })
  }

  /**
   * Get local storage
   */
  async getLocalStorage(): Promise<Record<string, string>> {
    const result = await this.evaluate<Array<[string, string]>>(`
      Object.entries(localStorage)
    `, { returnByValue: true })

    return Object.fromEntries(result)
  }

  /**
   * Set local storage item
   */
  async setLocalStorageItem(key: string, value: string): Promise<void> {
    await this.evaluate(`
      localStorage.setItem(${JSON.stringify(key)}, ${JSON.stringify(value)})
    `)
  }

  /**
   * Clear local storage
   */
  async clearLocalStorage(): Promise<void> {
    await this.evaluate('localStorage.clear()')
  }

  /**
   * Destroy session
   */
  async destroy(): Promise<void> {
    if (this.destroyed) {
      return
    }

    this.destroyed = true
    
    // Clear handlers
    this.eventHandlers.clear()
    
    // Emit destroyed event
    this.emit('destroyed')
    
    // Remove all listeners
    this.removeAllListeners()
    
    this.logger.debug('Session destroyed')
  }
}