/**
 * Type-Safe Chrome DevTools Protocol Client
 * Wraps the base ChromeClient with fully typed methods
 */

import type { SessionId } from '@curupira/shared/types'
import { ChromeClient } from './client.js'
import type * as CDP from '@curupira/shared/cdp-types'
import type { ITypedCDPClient, EvaluateOptions, EvaluateResult, NavigateOptions, NavigateResult, ScreenshotOptions, ScreenshotResult, CookieOptions, Cookie } from './interfaces.js'

export class TypedCDPClient implements ITypedCDPClient {
  constructor(private client: ChromeClient) {}

  // Runtime domain methods
  async evaluate(
    expression: string,
    options: EvaluateOptions,
    sessionId: SessionId
  ): Promise<EvaluateResult> {
    const result = await this.client.send<CDP.Runtime.EvaluateResult>(
      'Runtime.evaluate',
      { 
        expression, 
        returnByValue: options.returnByValue ?? true,
        awaitPromise: options.awaitPromise ?? true,
        userGesture: options.userGesture,
        silent: options.silent
      },
      sessionId
    );
    
    return {
      result: {
        type: result.result.type,
        value: result.result.value,
        objectId: result.result.objectId
      },
      exceptionDetails: result.exceptionDetails ? {
        text: result.exceptionDetails.text || result.exceptionDetails.exception?.description || 'Unknown error',
        lineNumber: result.exceptionDetails.lineNumber,
        columnNumber: result.exceptionDetails.columnNumber,
        scriptId: result.exceptionDetails.scriptId
      } : undefined
    };
  }

  // Page domain methods
  async navigate(
    url: string,
    options: NavigateOptions,
    sessionId: SessionId
  ): Promise<NavigateResult> {
    const result = await this.client.send<CDP.Page.NavigateResult>(
      'Page.navigate',
      { url },
      sessionId
    );
    
    // Wait for load if specified
    if (options.waitUntil) {
      // Implementation would wait for appropriate event
      // For now, just return the result
    }
    
    return {
      frameId: result.frameId,
      loaderId: result.loaderId,
      errorText: result.errorText
    };
  }

  async reload(
    options?: { ignoreCache?: boolean },
    sessionId?: SessionId
  ): Promise<void> {
    await this.client.send(
      'Page.reload',
      {
        ignoreCache: options?.ignoreCache
      },
      sessionId
    )
  }

  async captureScreenshot(
    options: ScreenshotOptions,
    sessionId: SessionId
  ): Promise<ScreenshotResult> {
    const result = await this.client.send<CDP.Page.CaptureScreenshotResult>(
      'Page.captureScreenshot',
      {
        format: 'png',
        captureBeyondViewport: options.fullPage || options.captureBeyondViewport,
        clip: options.clip
      },
      sessionId
    );
    
    return {
      data: result.data
    };
  }

  // DOM domain methods
  async getDocument(
    options?: { depth?: number; pierce?: boolean },
    sessionId?: SessionId
  ): Promise<any> {
    return this.client.send<CDP.DOM.GetDocumentResult>(
      'DOM.getDocument',
      {
        depth: options?.depth,
        pierce: options?.pierce
      },
      sessionId
    )
  }

  async querySelector(
    nodeId: number,
    selector: string,
    sessionId: SessionId
  ): Promise<{ nodeId: number }> {
    const result = await this.client.send<CDP.DOM.QuerySelectorResult>(
      'DOM.querySelector',
      { nodeId, selector },
      sessionId
    );
    
    return {
      nodeId: result.nodeId
    };
  }

  async querySelectorAll(
    nodeId: number,
    selector: string,
    sessionId: SessionId
  ): Promise<{ nodeIds: number[] }> {
    const result = await this.client.send<CDP.DOM.QuerySelectorAllResult>(
      'DOM.querySelectorAll',
      { nodeId, selector },
      sessionId
    )
    return { nodeIds: result.nodeIds }
  }

  async getBoxModel(
    options: { nodeId: number },
    sessionId: SessionId
  ): Promise<any> {
    return this.client.send<CDP.DOM.GetBoxModelResult>(
      'DOM.getBoxModel',
      { nodeId: options.nodeId },
      sessionId
    )
  }

  async getAttributes(
    nodeId: number,
    sessionId: SessionId
  ): Promise<{ attributes: string[] }> {
    const result = await this.client.send<CDP.DOM.GetAttributesResult>(
      'DOM.getAttributes',
      { nodeId },
      sessionId
    )
    return { attributes: result.attributes }
  }

  async setAttributeValue(
    nodeId: number,
    name: string,
    value: string,
    sessionId: SessionId
  ): Promise<void> {
    await this.client.send(
      'DOM.setAttributeValue',
      { nodeId, name, value },
      sessionId
    )
  }

  async removeAttribute(
    nodeId: number,
    name: string,
    sessionId: SessionId
  ): Promise<void> {
    await this.client.send(
      'DOM.removeAttribute',
      { nodeId, name },
      sessionId
    )
  }

  async getOuterHTML(
    params: { nodeId: number },
    sessionId: SessionId
  ): Promise<{ outerHTML: string }> {
    const result = await this.client.send<CDP.DOM.GetOuterHTMLResult>(
      'DOM.getOuterHTML',
      params,
      sessionId
    )
    return { outerHTML: result.outerHTML }
  }

  async setOuterHTML(
    nodeId: number,
    outerHTML: string,
    sessionId: SessionId
  ): Promise<void> {
    await this.client.send(
      'DOM.setOuterHTML',
      { nodeId, outerHTML },
      sessionId
    )
  }

  async focus(
    params: { nodeId: number },
    sessionId: SessionId
  ): Promise<void> {
    await this.client.send(
      'DOM.focus',
      params,
      sessionId
    )
  }

  async scrollIntoViewIfNeeded(
    params: { nodeId: number },
    sessionId: SessionId
  ): Promise<void> {
    await this.client.send(
      'DOM.scrollIntoViewIfNeeded',
      params,
      sessionId
    )
  }

  async describeNode(
    params: { nodeId: number },
    sessionId: SessionId
  ): Promise<any> {
    return this.client.send<CDP.DOM.DescribeNodeResult>(
      'DOM.describeNode',
      params,
      sessionId
    )
  }

  // Network domain methods
  async setCookie(
    cookie: CookieOptions,
    sessionId: SessionId
  ): Promise<{ success: boolean }> {
    const result = await this.client.send<CDP.Network.SetCookieResult>(
      'Network.setCookie',
      {
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path,
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
        sameSite: cookie.sameSite,
        expires: cookie.expires
      },
      sessionId
    );
    
    return {
      success: result.success
    };
  }

  async getCookies(
    options?: { urls?: string[] },
    sessionId?: SessionId
  ): Promise<{ cookies: Cookie[] }> {
    const result = await this.client.send<CDP.Network.GetCookiesResult>(
      'Network.getCookies',
      options || {},
      sessionId
    );
    
    return {
      cookies: result.cookies.map(cookie => ({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path,
        expires: cookie.expires,
        size: cookie.size,
        httpOnly: cookie.httpOnly,
        secure: cookie.secure,
        session: cookie.session,
        sameSite: cookie.sameSite as 'Strict' | 'Lax' | 'None'
      }))
    };
  }

  async clearCookies(sessionId?: SessionId): Promise<void> {
    await this.client.send('Network.clearBrowserCookies', {}, sessionId)
  }

  // Mouse and input events
  async dispatchMouseEvent(
    params: any,
    sessionId: SessionId
  ): Promise<void> {
    await this.client.send('Input.dispatchMouseEvent', params, sessionId)
  }

  async dispatchKeyEvent(
    params: any,
    sessionId: SessionId
  ): Promise<void> {
    await this.client.send('Input.dispatchKeyEvent', params, sessionId)
  }

  async dispatchTouchEvent(
    params: any,
    sessionId: SessionId
  ): Promise<void> {
    await this.client.send('Input.dispatchTouchEvent', params, sessionId)
  }

  // Debugger methods
  async enableDebugger(
    params?: any,
    sessionId?: SessionId
  ): Promise<any> {
    return this.client.send('Debugger.enable', params || {}, sessionId)
  }

  async disableDebugger(sessionId?: SessionId): Promise<void> {
    await this.client.send('Debugger.disable', {}, sessionId)
  }

  async setBreakpointByUrl(
    params: any,
    sessionId: SessionId
  ): Promise<any> {
    return this.client.send('Debugger.setBreakpointByUrl', params, sessionId)
  }

  async removeBreakpoint(
    breakpointId: string,
    sessionId: SessionId
  ): Promise<void> {
    await this.client.send('Debugger.removeBreakpoint', { breakpointId }, sessionId)
  }

  async pause(sessionId?: SessionId): Promise<void> {
    await this.client.send('Debugger.pause', {}, sessionId)
  }

  async resume(
    params?: any,
    sessionId?: SessionId
  ): Promise<void> {
    await this.client.send('Debugger.resume', params || {}, sessionId)
  }

  async stepOver(
    params?: any,
    sessionId?: SessionId
  ): Promise<void> {
    await this.client.send('Debugger.stepOver', params || {}, sessionId)
  }

  async stepInto(
    params?: any,
    sessionId?: SessionId
  ): Promise<void> {
    await this.client.send('Debugger.stepInto', params || {}, sessionId)
  }

  async stepOut(sessionId?: SessionId): Promise<void> {
    await this.client.send('Debugger.stepOut', {}, sessionId)
  }

  async evaluateOnCallFrame(
    params: any,
    sessionId: SessionId
  ): Promise<any> {
    return this.client.send('Debugger.evaluateOnCallFrame', params, sessionId)
  }

  // Domain enable/disable methods
  async enableRuntime(sessionId: SessionId): Promise<void> {
    await this.client.send('Runtime.enable', {}, sessionId)
  }

  async disableRuntime(sessionId?: SessionId): Promise<void> {
    await this.client.send('Runtime.disable', {}, sessionId)
  }

  async enablePage(sessionId: SessionId): Promise<void> {
    await this.client.send('Page.enable', {}, sessionId)
  }

  async disablePage(sessionId?: SessionId): Promise<void> {
    await this.client.send('Page.disable', {}, sessionId)
  }

  async enableDOM(sessionId: SessionId): Promise<void> {
    await this.client.send('DOM.enable', {}, sessionId)
  }

  async disableDOM(sessionId?: SessionId): Promise<void> {
    await this.client.send('DOM.disable', {}, sessionId)
  }

  async enableNetwork(sessionId: SessionId): Promise<void> {
    await this.client.send('Network.enable', {}, sessionId)
  }

  async disableNetwork(sessionId?: SessionId): Promise<void> {
    await this.client.send('Network.disable', {}, sessionId)
  }

  async enableConsole(sessionId?: SessionId): Promise<void> {
    await this.client.send('Console.enable', {}, sessionId)
  }

  async disableConsole(sessionId?: SessionId): Promise<void> {
    await this.client.send('Console.disable', {}, sessionId)
  }

  // Performance methods
  async enablePerformance(
    params?: any,
    sessionId?: SessionId
  ): Promise<void> {
    await this.client.send('Performance.enable', params || {}, sessionId)
  }

  async disablePerformance(sessionId?: SessionId): Promise<void> {
    await this.client.send('Performance.disable', {}, sessionId)
  }

  async getMetrics(sessionId?: SessionId): Promise<any> {
    return this.client.send('Performance.getMetrics', {}, sessionId)
  }
  
  // Generic send method for any other CDP commands
  async send<T = unknown>(
    method: string,
    params?: any,
    sessionId?: SessionId
  ): Promise<T> {
    return this.client.send<T>(method, params, sessionId)
  }
}