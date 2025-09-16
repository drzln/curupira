/**
 * Mock Typed CDP Client - Test Infrastructure
 * Mock implementation of ITypedCDPClient for testing
 */

import type { ITypedCDPClient } from '../../chrome/interfaces.js';
import type {
  EvaluateOptions,
  EvaluateResult,
  NavigateOptions,
  NavigateResult,
  ScreenshotOptions,
  ScreenshotResult,
  Cookie,
  CookieOptions
} from '../../chrome/interfaces.js';
import type { SessionId } from '@curupira/shared/types';

export class MockTypedCDPClient implements ITypedCDPClient {
  private mockResults = new Map<string, any>();

  // Domain enabling
  async enableRuntime(sessionId: SessionId): Promise<void> {}
  async enableDOM(sessionId: SessionId): Promise<void> {}
  async enableNetwork(sessionId: SessionId): Promise<void> {}
  async enablePage(sessionId: SessionId): Promise<void> {}

  // JavaScript execution
  async evaluate(
    expression: string,
    options: EvaluateOptions,
    sessionId: SessionId
  ): Promise<EvaluateResult> {
    const mockKey = `evaluate_${expression}`;
    if (this.mockResults.has(mockKey)) {
      return this.mockResults.get(mockKey);
    }

    return {
      result: {
        type: 'string',
        value: 'mock evaluation result'
      }
    };
  }

  // Navigation
  async navigate(
    url: string,
    options: NavigateOptions,
    sessionId: SessionId
  ): Promise<NavigateResult> {
    return {
      frameId: 'mock-frame-id'
    };
  }

  async reload(options?: { ignoreCache?: boolean }, sessionId?: SessionId): Promise<void> {}

  // Screenshots
  async captureScreenshot(
    options: ScreenshotOptions,
    sessionId: SessionId
  ): Promise<ScreenshotResult> {
    return {
      data: 'mock-base64-image-data'
    };
  }

  // DOM operations
  async getDocument(
    options?: { depth?: number; pierce?: boolean },
    sessionId?: SessionId
  ): Promise<any> {
    return {
      root: {
        nodeId: 1,
        nodeName: 'DOCUMENT'
      }
    };
  }

  async querySelector(
    nodeId: number,
    selector: string,
    sessionId: SessionId
  ): Promise<{ nodeId: number }> {
    return { nodeId: 123 };
  }

  async getBoxModel(
    options: { nodeId: number },
    sessionId: SessionId
  ): Promise<any> {
    return {
      model: {
        content: [0, 0, 100, 100],
        padding: [0, 0, 100, 100],
        border: [0, 0, 100, 100],
        margin: [0, 0, 100, 100]
      }
    };
  }

  // Cookie management
  async getCookies(
    options?: { urls?: string[] },
    sessionId?: SessionId
  ): Promise<{ cookies: Cookie[] }> {
    return {
      cookies: [
        {
          name: 'test-cookie',
          value: 'test-value',
          domain: 'localhost',
          path: '/',
          expires: -1,
          size: 20,
          httpOnly: false,
          secure: false,
          session: true,
          sameSite: 'Lax'
        }
      ]
    };
  }

  async setCookie(
    cookie: CookieOptions,
    sessionId: SessionId
  ): Promise<{ success: boolean }> {
    return { success: true };
  }

  async clearCookies(sessionId?: SessionId): Promise<void> {}

  // Additional DOM methods
  async querySelectorAll(
    nodeId: number,
    selector: string,
    sessionId: SessionId
  ): Promise<{ nodeIds: number[] }> {
    return { nodeIds: [123, 124, 125] };
  }

  async getAttributes(
    nodeId: number,
    sessionId: SessionId
  ): Promise<{ attributes: string[] }> {
    return { attributes: ['class', 'test-class', 'id', 'test-id'] };
  }

  async setAttributeValue(
    nodeId: number,
    name: string,
    value: string,
    sessionId: SessionId
  ): Promise<void> {}

  async removeAttribute(
    nodeId: number,
    name: string,
    sessionId: SessionId
  ): Promise<void> {}

  async getOuterHTML(
    params: { nodeId: number },
    sessionId: SessionId
  ): Promise<{ outerHTML: string }> {
    return { outerHTML: '<div>Mock HTML</div>' };
  }

  async setOuterHTML(
    nodeId: number,
    outerHTML: string,
    sessionId: SessionId
  ): Promise<void> {}

  async focus(params: { nodeId: number }, sessionId: SessionId): Promise<void> {}
  
  async scrollIntoViewIfNeeded(
    params: { nodeId: number },
    sessionId: SessionId
  ): Promise<void> {}

  async describeNode(
    params: { nodeId: number },
    sessionId: SessionId
  ): Promise<any> {
    return {
      node: {
        nodeType: 1,
        nodeName: 'DIV',
        attributes: []
      }
    };
  }

  // Mouse and input events
  async dispatchMouseEvent(params: any, sessionId: SessionId): Promise<void> {}
  async dispatchKeyEvent(params: any, sessionId: SessionId): Promise<void> {}
  async dispatchTouchEvent(params: any, sessionId: SessionId): Promise<void> {}

  // Debugger methods
  async enableDebugger(params?: any, sessionId?: SessionId): Promise<any> {
    return { debuggerId: 'mock-debugger-id' };
  }

  async disableDebugger(sessionId?: SessionId): Promise<void> {}

  async setBreakpointByUrl(
    params: any,
    sessionId: SessionId
  ): Promise<any> {
    return { breakpointId: 'mock-breakpoint-id' };
  }

  async removeBreakpoint(
    breakpointId: string,
    sessionId: SessionId
  ): Promise<void> {}

  async pause(sessionId?: SessionId): Promise<void> {}
  async resume(params?: any, sessionId?: SessionId): Promise<void> {}
  async stepOver(params?: any, sessionId?: SessionId): Promise<void> {}
  async stepInto(params?: any, sessionId?: SessionId): Promise<void> {}
  async stepOut(sessionId?: SessionId): Promise<void> {}

  async evaluateOnCallFrame(params: any, sessionId: SessionId): Promise<any> {
    return {
      result: {
        type: 'string',
        value: 'mock call frame result'
      }
    };
  }

  // Performance methods
  async enablePerformance(params?: any, sessionId?: SessionId): Promise<void> {}
  async disablePerformance(sessionId?: SessionId): Promise<void> {}

  async getMetrics(sessionId?: SessionId): Promise<any> {
    return {
      metrics: [
        { name: 'Timestamp', value: Date.now() },
        { name: 'Documents', value: 1 },
        { name: 'Frames', value: 1 },
        { name: 'JSEventListeners', value: 10 },
        { name: 'Nodes', value: 100 }
      ]
    };
  }

  // Generic send method
  async send<T = unknown>(
    method: string,
    params?: any,
    sessionId?: SessionId
  ): Promise<T> {
    return {} as T;
  }

  // Test helper methods
  setMockResult(key: string, result: any): void {
    this.mockResults.set(key, result);
  }

  reset(): void {
    this.mockResults.clear();
  }
}