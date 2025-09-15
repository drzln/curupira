/**
 * Page domain wrapper for Chrome DevTools Protocol
 * 
 * Provides typed access to Page domain methods with proper error handling
 */

import type { ChromeClient } from '../client.js'
import type { Page, Runtime } from '@curupira/shared/types/cdp.js'
import { logger } from '../../config/logger.js'

export class PageDomain {
  constructor(
    private client: ChromeClient,
    private sessionId: string
  ) {}

  /**
   * Enable the Page domain
   */
  async enable(): Promise<void> {
    await this.client.send('Page.enable', {}, this.sessionId)
  }

  /**
   * Disable the Page domain
   */
  async disable(): Promise<void> {
    await this.client.send('Page.disable', {}, this.sessionId)
  }

  /**
   * Navigate to URL
   */
  async navigate(
    url: string,
    options: {
      referrer?: string
      transitionType?: Page.TransitionType
      frameId?: string
    } = {}
  ): Promise<{ frameId: string; loaderId?: string; errorText?: string }> {
    try {
      const result = await this.client.send<{
        frameId: string
        loaderId?: string
        errorText?: string
      }>('Page.navigate', {
        url,
        ...options
      }, this.sessionId)

      return result
    } catch (error) {
      logger.error('Page.navigate failed', { url, error })
      throw error
    }
  }

  /**
   * Reload the page
   */
  async reload(options: {
    ignoreCache?: boolean
    scriptToEvaluateOnLoad?: string
  } = {}): Promise<void> {
    await this.client.send('Page.reload', options, this.sessionId)
  }

  /**
   * Stop loading the page
   */
  async stopLoading(): Promise<void> {
    await this.client.send('Page.stopLoading', {}, this.sessionId)
  }

  /**
   * Navigate history
   */
  async navigateToHistoryEntry(entryId: number): Promise<void> {
    await this.client.send('Page.navigateToHistoryEntry', { entryId }, this.sessionId)
  }

  /**
   * Get navigation history
   */
  async getNavigationHistory(): Promise<{
    currentIndex: number
    entries: Page.NavigationEntry[]
  }> {
    try {
      const result = await this.client.send<{
        currentIndex: number
        entries: Page.NavigationEntry[]
      }>('Page.getNavigationHistory', {}, this.sessionId)

      return result
    } catch (error) {
      logger.error('Page.getNavigationHistory failed', error)
      return { currentIndex: 0, entries: [] }
    }
  }

  /**
   * Capture screenshot
   */
  async captureScreenshot(options: {
    format?: 'jpeg' | 'png' | 'webp'
    quality?: number
    clip?: Page.Viewport
    fromSurface?: boolean
    captureBeyondViewport?: boolean
  } = {}): Promise<string> {
    try {
      const result = await this.client.send<{
        data: string
      }>('Page.captureScreenshot', {
        format: options.format || 'png',
        ...options
      }, this.sessionId)

      return result.data
    } catch (error) {
      logger.error('Page.captureScreenshot failed', error)
      return ''
    }
  }

  /**
   * Print to PDF
   */
  async printToPDF(options: {
    landscape?: boolean
    displayHeaderFooter?: boolean
    printBackground?: boolean
    scale?: number
    paperWidth?: number
    paperHeight?: number
    marginTop?: number
    marginBottom?: number
    marginLeft?: number
    marginRight?: number
    pageRanges?: string
    headerTemplate?: string
    footerTemplate?: string
    preferCSSPageSize?: boolean
  } = {}): Promise<{ data: string; stream?: string }> {
    try {
      const result = await this.client.send<{
        data: string
        stream?: string
      }>('Page.printToPDF', options, this.sessionId)

      return result
    } catch (error) {
      logger.error('Page.printToPDF failed', error)
      return { data: '' }
    }
  }

  /**
   * Get layout metrics
   */
  async getLayoutMetrics(): Promise<{
    layoutViewport: Page.LayoutViewport
    visualViewport: Page.VisualViewport
    contentSize: { x: number; y: number; width: number; height: number }
  }> {
    try {
      const result = await this.client.send<{
        layoutViewport: Page.LayoutViewport
        visualViewport: Page.VisualViewport
        contentSize: { x: number; y: number; width: number; height: number }
      }>('Page.getLayoutMetrics', {}, this.sessionId)

      return result
    } catch (error) {
      logger.error('Page.getLayoutMetrics failed', error)
      return {
        layoutViewport: { pageX: 0, pageY: 0, clientWidth: 0, clientHeight: 0 },
        visualViewport: {
          offsetX: 0,
          offsetY: 0,
          pageX: 0,
          pageY: 0,
          clientWidth: 0,
          clientHeight: 0,
          scale: 1,
          zoom: 1
        },
        contentSize: { x: 0, y: 0, width: 0, height: 0 }
      }
    }
  }

  /**
   * Set viewport
   */
  async setViewport(viewport: {
    width: number
    height: number
    deviceScaleFactor?: number
    mobile?: boolean
    scale?: number
    screenWidth?: number
    screenHeight?: number
    positionX?: number
    positionY?: number
    hasTouch?: boolean
    isLandscape?: boolean
  }): Promise<void> {
    // First set device metrics override
    await this.client.send('Emulation.setDeviceMetricsOverride', {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: viewport.deviceScaleFactor || 1,
      mobile: viewport.mobile || false,
      scale: viewport.scale || 1,
      screenWidth: viewport.screenWidth || viewport.width,
      screenHeight: viewport.screenHeight || viewport.height,
      positionX: viewport.positionX || 0,
      positionY: viewport.positionY || 0
    }, this.sessionId)

    // Set touch emulation if needed
    if (viewport.hasTouch !== undefined) {
      await this.client.send('Emulation.setTouchEmulationEnabled', {
        enabled: viewport.hasTouch
      }, this.sessionId)
    }
  }

  /**
   * Create isolated world
   */
  async createIsolatedWorld(
    frameId: string,
    options: {
      worldName?: string
      grantUniveralAccess?: boolean
    } = {}
  ): Promise<number> {
    try {
      const result = await this.client.send<{
        executionContextId: number
      }>('Page.createIsolatedWorld', {
        frameId,
        ...options
      }, this.sessionId)

      return result.executionContextId
    } catch (error) {
      logger.error('Page.createIsolatedWorld failed', { frameId, error })
      return -1
    }
  }

  /**
   * Add script to evaluate on new document
   */
  async addScriptToEvaluateOnNewDocument(
    source: string,
    worldName?: string
  ): Promise<string> {
    try {
      const result = await this.client.send<{
        identifier: string
      }>('Page.addScriptToEvaluateOnNewDocument', {
        source,
        worldName
      }, this.sessionId)

      return result.identifier
    } catch (error) {
      logger.error('Page.addScriptToEvaluateOnNewDocument failed', error)
      return ''
    }
  }

  /**
   * Remove script to evaluate on new document
   */
  async removeScriptToEvaluateOnNewDocument(identifier: string): Promise<void> {
    await this.client.send('Page.removeScriptToEvaluateOnNewDocument', {
      identifier
    }, this.sessionId)
  }

  /**
   * Get frame tree
   */
  async getFrameTree(): Promise<Page.FrameTree | null> {
    try {
      const result = await this.client.send<{
        frameTree: Page.FrameTree
      }>('Page.getFrameTree', {}, this.sessionId)

      return result.frameTree
    } catch (error) {
      logger.error('Page.getFrameTree failed', error)
      return null
    }
  }

  /**
   * Set up frame attached event listener
   */
  onFrameAttached(
    handler: (params: {
      frameId: string
      parentFrameId: string
      stack?: Runtime.StackTrace
    }) => void
  ): void {
    this.client.onSessionEvent(this.sessionId, 'Page.frameAttached', handler)
  }

  /**
   * Set up frame navigated event listener
   */
  onFrameNavigated(
    handler: (params: {
      frame: Page.Frame
    }) => void
  ): void {
    this.client.onSessionEvent(this.sessionId, 'Page.frameNavigated', handler)
  }

  /**
   * Set up frame detached event listener
   */
  onFrameDetached(
    handler: (params: {
      frameId: string
    }) => void
  ): void {
    this.client.onSessionEvent(this.sessionId, 'Page.frameDetached', handler)
  }

  /**
   * Set up load event fired listener
   */
  onLoadEventFired(
    handler: (params: {
      timestamp: number
    }) => void
  ): void {
    this.client.onSessionEvent(this.sessionId, 'Page.loadEventFired', handler)
  }

  /**
   * Set up DOM content loaded event listener
   */
  onDomContentEventFired(
    handler: (params: {
      timestamp: number
    }) => void
  ): void {
    this.client.onSessionEvent(this.sessionId, 'Page.domContentEventFired', handler)
  }

  /**
   * Set up lifecycle event listener
   */
  onLifecycleEvent(
    handler: (params: {
      frameId: string
      loaderId: string
      name: string
      timestamp: number
    }) => void
  ): void {
    this.client.onSessionEvent(this.sessionId, 'Page.lifecycleEvent', handler)
  }

  /**
   * Set up JavaScript dialog opening event listener
   */
  onJavascriptDialogOpening(
    handler: (params: {
      url: string
      message: string
      type: 'alert' | 'confirm' | 'prompt' | 'beforeunload'
      hasBrowserHandler: boolean
      defaultPrompt?: string
    }) => void
  ): void {
    this.client.onSessionEvent(this.sessionId, 'Page.javascriptDialogOpening', handler)
  }

  /**
   * Handle JavaScript dialog
   */
  async handleJavaScriptDialog(
    accept: boolean,
    promptText?: string
  ): Promise<void> {
    await this.client.send('Page.handleJavaScriptDialog', {
      accept,
      promptText
    }, this.sessionId)
  }
}