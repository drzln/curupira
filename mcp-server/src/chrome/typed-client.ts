/**
 * Type-Safe Chrome DevTools Protocol Client
 * Wraps the base ChromeClient with fully typed methods
 */

import type { SessionId } from '@curupira/shared/types'
import { ChromeClient } from './client.js'
import type * as CDP from '@curupira/shared/cdp-types'

export class TypedCDPClient {
  constructor(private client: ChromeClient) {}

  // Runtime domain methods
  async evaluate<T = unknown>(
    expression: string,
    params?: Partial<CDP.Runtime.EvaluateParams>,
    sessionId?: SessionId
  ): Promise<CDP.Runtime.EvaluateResult> {
    return this.client.send<CDP.Runtime.EvaluateResult>(
      'Runtime.evaluate',
      { expression, ...params } as Record<string, unknown>,
      sessionId
    )
  }

  async callFunctionOn(
    functionDeclaration: string,
    params?: Partial<CDP.Runtime.CallFunctionOnParams>,
    sessionId?: SessionId
  ): Promise<CDP.Runtime.CallFunctionOnResult> {
    return this.client.send<CDP.Runtime.CallFunctionOnResult>(
      'Runtime.callFunctionOn',
      { functionDeclaration, ...params } as Record<string, unknown>,
      sessionId
    )
  }

  async getProperties(
    objectId: CDP.Runtime.RemoteObjectId,
    params?: Partial<CDP.Runtime.GetPropertiesParams>,
    sessionId?: SessionId
  ): Promise<CDP.Runtime.GetPropertiesResult> {
    return this.client.send<CDP.Runtime.GetPropertiesResult>(
      'Runtime.getProperties',
      { objectId, ...params } as Record<string, unknown>,
      sessionId
    )
  }

  async releaseObject(
    objectId: CDP.Runtime.RemoteObjectId,
    sessionId?: SessionId
  ): Promise<void> {
    await this.client.send(
      'Runtime.releaseObject',
      { objectId } as Record<string, unknown>,
      sessionId
    )
  }

  async releaseObjectGroup(
    objectGroup: string,
    sessionId?: SessionId
  ): Promise<void> {
    await this.client.send(
      'Runtime.releaseObjectGroup',
      { objectGroup } as Record<string, unknown>,
      sessionId
    )
  }

  async compileScript(
    params: CDP.Runtime.CompileScriptParams,
    sessionId?: SessionId
  ): Promise<CDP.Runtime.CompileScriptResult> {
    return this.client.send<CDP.Runtime.CompileScriptResult>(
      'Runtime.compileScript',
      params as unknown as Record<string, unknown>,
      sessionId
    )
  }

  async runScript(
    params: CDP.Runtime.RunScriptParams,
    sessionId?: SessionId
  ): Promise<CDP.Runtime.RunScriptResult> {
    return this.client.send<CDP.Runtime.RunScriptResult>(
      'Runtime.runScript',
      params as unknown as Record<string, unknown>,
      sessionId
    )
  }

  // Page domain methods
  async navigate(
    url: string,
    params?: Partial<CDP.Page.NavigateParams>,
    sessionId?: SessionId
  ): Promise<CDP.Page.NavigateResult> {
    return this.client.send<CDP.Page.NavigateResult>(
      'Page.navigate',
      { url, ...params } as Record<string, unknown>,
      sessionId
    )
  }

  async reload(
    params?: CDP.Page.ReloadParams,
    sessionId?: SessionId
  ): Promise<void> {
    await this.client.send(
      'Page.reload',
      (params || {}) as Record<string, unknown>,
      sessionId
    )
  }

  async getFrameTree(
    sessionId?: SessionId
  ): Promise<CDP.Page.GetFrameTreeResult> {
    return this.client.send<CDP.Page.GetFrameTreeResult>(
      'Page.getFrameTree',
      {} as Record<string, unknown>,
      sessionId
    )
  }

  async captureScreenshot(
    params?: CDP.Page.CaptureScreenshotParams,
    sessionId?: SessionId
  ): Promise<CDP.Page.CaptureScreenshotResult> {
    return this.client.send<CDP.Page.CaptureScreenshotResult>(
      'Page.captureScreenshot',
      (params || {}) as Record<string, unknown>,
      sessionId
    )
  }

  async printToPDF(
    params?: CDP.Page.PrintToPDFParams,
    sessionId?: SessionId
  ): Promise<CDP.Page.PrintToPDFResult> {
    return this.client.send<CDP.Page.PrintToPDFResult>(
      'Page.printToPDF',
      (params || {}) as Record<string, unknown>,
      sessionId
    )
  }

  // DOM domain methods
  async getDocument(
    params?: CDP.DOM.GetDocumentParams,
    sessionId?: SessionId
  ): Promise<CDP.DOM.GetDocumentResult> {
    return this.client.send<CDP.DOM.GetDocumentResult>(
      'DOM.getDocument',
      (params || {}) as Record<string, unknown>,
      sessionId
    )
  }

  async querySelector(
    nodeId: CDP.DOM.NodeId,
    selector: string,
    sessionId?: SessionId
  ): Promise<CDP.DOM.QuerySelectorResult> {
    return this.client.send<CDP.DOM.QuerySelectorResult>(
      'DOM.querySelector',
      { nodeId, selector } as Record<string, unknown>,
      sessionId
    )
  }

  async querySelectorAll(
    nodeId: CDP.DOM.NodeId,
    selector: string,
    sessionId?: SessionId
  ): Promise<CDP.DOM.QuerySelectorAllResult> {
    return this.client.send<CDP.DOM.QuerySelectorAllResult>(
      'DOM.querySelectorAll',
      { nodeId, selector } as Record<string, unknown>,
      sessionId
    )
  }

  async getAttributes(
    nodeId: CDP.DOM.NodeId,
    sessionId?: SessionId
  ): Promise<CDP.DOM.GetAttributesResult> {
    return this.client.send<CDP.DOM.GetAttributesResult>(
      'DOM.getAttributes',
      { nodeId } as Record<string, unknown>,
      sessionId
    )
  }

  async setAttributeValue(
    nodeId: CDP.DOM.NodeId,
    name: string,
    value: string,
    sessionId?: SessionId
  ): Promise<void> {
    await this.client.send(
      'DOM.setAttributeValue',
      { nodeId, name, value } as Record<string, unknown>,
      sessionId
    )
  }

  async removeAttribute(
    nodeId: CDP.DOM.NodeId,
    name: string,
    sessionId?: SessionId
  ): Promise<void> {
    await this.client.send(
      'DOM.removeAttribute',
      { nodeId, name } as Record<string, unknown>,
      sessionId
    )
  }

  async getOuterHTML(
    params: CDP.DOM.GetOuterHTMLParams,
    sessionId?: SessionId
  ): Promise<CDP.DOM.GetOuterHTMLResult> {
    return this.client.send<CDP.DOM.GetOuterHTMLResult>(
      'DOM.getOuterHTML',
      params as unknown as Record<string, unknown>,
      sessionId
    )
  }

  async setOuterHTML(
    nodeId: CDP.DOM.NodeId,
    outerHTML: string,
    sessionId?: SessionId
  ): Promise<void> {
    await this.client.send(
      'DOM.setOuterHTML',
      { nodeId, outerHTML } as Record<string, unknown>,
      sessionId
    )
  }

  async getBoxModel(
    params: CDP.DOM.GetBoxModelParams,
    sessionId?: SessionId
  ): Promise<CDP.DOM.GetBoxModelResult> {
    return this.client.send<CDP.DOM.GetBoxModelResult>(
      'DOM.getBoxModel',
      params as unknown as Record<string, unknown>,
      sessionId
    )
  }

  async focus(
    params: CDP.DOM.FocusParams,
    sessionId?: SessionId
  ): Promise<void> {
    await this.client.send(
      'DOM.focus',
      params as unknown as Record<string, unknown>,
      sessionId
    )
  }

  async scrollIntoViewIfNeeded(
    params: CDP.DOM.ScrollIntoViewIfNeededParams,
    sessionId?: SessionId
  ): Promise<void> {
    await this.client.send(
      'DOM.scrollIntoViewIfNeeded',
      params as unknown as Record<string, unknown>,
      sessionId
    )
  }

  async describeNode(
    params: CDP.DOM.DescribeNodeParams,
    sessionId?: SessionId
  ): Promise<CDP.DOM.DescribeNodeResult> {
    return this.client.send<CDP.DOM.DescribeNodeResult>(
      'DOM.describeNode',
      params as unknown as Record<string, unknown>,
      sessionId
    )
  }

  // Network domain methods
  async setCookie(
    params: CDP.Network.SetCookieParams,
    sessionId?: SessionId
  ): Promise<CDP.Network.SetCookieResult> {
    return this.client.send<CDP.Network.SetCookieResult>(
      'Network.setCookie',
      params as unknown as Record<string, unknown>,
      sessionId
    )
  }

  async getCookies(
    params?: CDP.Network.GetCookiesParams,
    sessionId?: SessionId
  ): Promise<CDP.Network.GetCookiesResult> {
    return this.client.send<CDP.Network.GetCookiesResult>(
      'Network.getCookies',
      (params || {}) as Record<string, unknown>,
      sessionId
    )
  }

  async deleteCookies(
    params: CDP.Network.DeleteCookiesParams,
    sessionId?: SessionId
  ): Promise<void> {
    await this.client.send(
      'Network.deleteCookies',
      params as unknown as Record<string, unknown>,
      sessionId
    )
  }

  async getResponseBody(
    requestId: CDP.Network.RequestId,
    sessionId?: SessionId
  ): Promise<CDP.Network.GetResponseBodyResult> {
    return this.client.send<CDP.Network.GetResponseBodyResult>(
      'Network.getResponseBody',
      { requestId } as Record<string, unknown>,
      sessionId
    )
  }

  // Debugger domain methods
  async setBreakpointByUrl(
    params: CDP.Debugger.SetBreakpointByUrlParams,
    sessionId?: SessionId
  ): Promise<CDP.Debugger.SetBreakpointByUrlResult> {
    return this.client.send<CDP.Debugger.SetBreakpointByUrlResult>(
      'Debugger.setBreakpointByUrl',
      params as unknown as Record<string, unknown>,
      sessionId
    )
  }

  async removeBreakpoint(
    breakpointId: CDP.Debugger.BreakpointId,
    sessionId?: SessionId
  ): Promise<void> {
    await this.client.send(
      'Debugger.removeBreakpoint',
      { breakpointId } as Record<string, unknown>,
      sessionId
    )
  }

  async evaluateOnCallFrame(
    params: CDP.Debugger.EvaluateOnCallFrameParams,
    sessionId?: SessionId
  ): Promise<CDP.Debugger.EvaluateOnCallFrameResult> {
    return this.client.send<CDP.Debugger.EvaluateOnCallFrameResult>(
      'Debugger.evaluateOnCallFrame',
      params as unknown as Record<string, unknown>,
      sessionId
    )
  }

  async pause(sessionId?: SessionId): Promise<void> {
    await this.client.send('Debugger.pause', {}, sessionId)
  }

  async resume(
    params?: CDP.Debugger.ResumeParams,
    sessionId?: SessionId
  ): Promise<void> {
    await this.client.send('Debugger.resume', (params || {}) as Record<string, unknown>, sessionId)
  }

  async stepOver(
    params?: CDP.Debugger.StepOverParams,
    sessionId?: SessionId
  ): Promise<void> {
    await this.client.send('Debugger.stepOver', (params || {}) as Record<string, unknown>, sessionId)
  }

  async stepInto(
    params?: CDP.Debugger.StepIntoParams,
    sessionId?: SessionId
  ): Promise<void> {
    await this.client.send('Debugger.stepInto', (params || {}) as Record<string, unknown>, sessionId)
  }

  async stepOut(sessionId?: SessionId): Promise<void> {
    await this.client.send('Debugger.stepOut', {}, sessionId)
  }

  // Input domain methods
  async dispatchMouseEvent(
    params: CDP.Input.DispatchMouseEventParams,
    sessionId?: SessionId
  ): Promise<void> {
    await this.client.send('Input.dispatchMouseEvent', params as unknown as Record<string, unknown>, sessionId)
  }

  async dispatchKeyEvent(
    params: CDP.Input.DispatchKeyEventParams,
    sessionId?: SessionId
  ): Promise<void> {
    await this.client.send('Input.dispatchKeyEvent', params as unknown as Record<string, unknown>, sessionId)
  }

  async dispatchTouchEvent(
    params: CDP.Input.DispatchTouchEventParams,
    sessionId?: SessionId
  ): Promise<void> {
    await this.client.send('Input.dispatchTouchEvent', params as unknown as Record<string, unknown>, sessionId)
  }

  // Performance domain methods
  async getMetrics(
    sessionId?: SessionId
  ): Promise<CDP.Performance.GetMetricsResult> {
    return this.client.send<CDP.Performance.GetMetricsResult>(
      'Performance.getMetrics',
      {} as Record<string, unknown>,
      sessionId
    )
  }

  // Domain enable/disable methods
  async enableRuntime(sessionId?: SessionId): Promise<void> {
    await this.client.send('Runtime.enable', {}, sessionId)
  }

  async disableRuntime(sessionId?: SessionId): Promise<void> {
    await this.client.send('Runtime.disable', {}, sessionId)
  }

  async enablePage(sessionId?: SessionId): Promise<void> {
    await this.client.send('Page.enable', {}, sessionId)
  }

  async disablePage(sessionId?: SessionId): Promise<void> {
    await this.client.send('Page.disable', {}, sessionId)
  }

  async enableDOM(sessionId?: SessionId): Promise<void> {
    await this.client.send('DOM.enable', {}, sessionId)
  }

  async disableDOM(sessionId?: SessionId): Promise<void> {
    await this.client.send('DOM.disable', {}, sessionId)
  }

  async enableNetwork(
    params?: CDP.Network.EnableParams,
    sessionId?: SessionId
  ): Promise<void> {
    await this.client.send('Network.enable', (params || {}) as Record<string, unknown>, sessionId)
  }

  async disableNetwork(sessionId?: SessionId): Promise<void> {
    await this.client.send('Network.disable', {}, sessionId)
  }

  async enableDebugger(
    params?: CDP.Debugger.EnableParams,
    sessionId?: SessionId
  ): Promise<CDP.Debugger.EnableResult> {
    return this.client.send<CDP.Debugger.EnableResult>(
      'Debugger.enable',
      (params || {}) as Record<string, unknown>,
      sessionId
    )
  }

  async disableDebugger(sessionId?: SessionId): Promise<void> {
    await this.client.send('Debugger.disable', {}, sessionId)
  }

  async enableConsole(sessionId?: SessionId): Promise<void> {
    await this.client.send('Console.enable', {}, sessionId)
  }

  async disableConsole(sessionId?: SessionId): Promise<void> {
    await this.client.send('Console.disable', {}, sessionId)
  }

  async enablePerformance(
    params?: CDP.Performance.EnableParams,
    sessionId?: SessionId
  ): Promise<void> {
    await this.client.send('Performance.enable', (params || {}) as Record<string, unknown>, sessionId)
  }

  async disablePerformance(sessionId?: SessionId): Promise<void> {
    await this.client.send('Performance.disable', {}, sessionId)
  }

  // Generic send method for any other CDP commands
  async send<T = unknown>(
    method: string,
    params?: Record<string, unknown>,
    sessionId?: SessionId
  ): Promise<T> {
    return this.client.send<T>(method, params, sessionId)
  }
}