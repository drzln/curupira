/**
 * Mock Chrome Client - Test Infrastructure
 * Mock implementation of IChromeClient for testing
 */

import type { IChromeClient } from '../../chrome/interfaces.js';
import { EventEmitter } from 'events';
import { vi } from 'vitest';

export class MockChromeClient extends EventEmitter implements IChromeClient {
  private connected = false;
  private sessions: Map<string, any> = new Map();
  private targets: any[] = [];
  private sendMock = vi.fn();

  async connect(): Promise<void> {
    this.connected = true;
    this.emit('connected', { mock: true });
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.sessions.clear();
    this.emit('disconnected');
  }

  isConnected(): boolean {
    return this.connected;
  }

  async createSession(targetId?: string): Promise<any> {
    const sessionId = `session_${Date.now()}`;
    const session = {
      id: sessionId,
      sessionId,
      targetId: targetId || 'default',
      targetType: 'page' as const
    };
    this.sessions.set(sessionId, session);
    return session;
  }

  getSessions(): any[] {
    return Array.from(this.sessions.values());
  }

  getTargets(): any {
    return this.targets;
  }

  async listTargets(): Promise<any[]> {
    return this.targets;
  }

  async send<T = any>(method: string, params?: any, sessionId?: string): Promise<T> {
    this.sendMock(method, params, sessionId);
    
    // Return mock responses based on method
    if (method === 'Runtime.evaluate') {
      return {
        result: {
          type: 'string',
          value: 'mock result'
        }
      } as any;
    }
    
    if (method === 'Page.navigate') {
      return {
        frameId: 'mock-frame-id'
      } as any;
    }

    return {} as T;
  }

  getState(): string {
    return this.connected ? 'connected' : 'disconnected';
  }

  onSessionEvent(sessionId: string, event: string, handler: (params: any) => void): void {
    // Mock implementation - store handlers for testing
    const key = `${sessionId}:${event}`;
    this.on(key, handler);
  }

  offSessionEvent(sessionId: string, event: string, handler?: (params: any) => void): void {
    // Mock implementation - remove handlers
    const key = `${sessionId}:${event}`;
    if (handler) {
      this.off(key, handler);
    } else {
      this.removeAllListeners(key);
    }
  }

  // Test helper methods
  simulateConnection(): void {
    this.connected = true;
  }

  simulateTargets(targets: any[]): void {
    this.targets = targets;
  }

  simulateSendResult(result: any): void {
    this.sendMock.mockResolvedValueOnce(result);
  }

  simulateSendError(error: Error): void {
    this.sendMock.mockRejectedValueOnce(error);
  }

  getSendMock() {
    return this.sendMock;
  }

  reset(): void {
    this.connected = false;
    this.sessions.clear();
    this.targets = [];
    this.sendMock.mockReset();
    this.removeAllListeners();
  }
}