/**
 * Console Buffer Service - Level 1 (Chrome Core)
 * Service for buffering and managing console messages from Chrome DevTools Protocol
 */

import type { ILogger } from '../../core/interfaces/logger.interface.js';
import type { SessionId } from '@curupira/shared/types';

export interface ConsoleMessage {
  level: 'log' | 'info' | 'warn' | 'error' | 'debug';
  text: string;
  timestamp: number;
  source: string;
  sessionId: SessionId;
  args?: any[];
  stackTrace?: any;
  url?: string;
  lineNumber?: number;
  columnNumber?: number;
}

export interface IConsoleBufferService {
  /**
   * Add a console message to the buffer
   */
  addMessage(message: ConsoleMessage): void;

  /**
   * Get messages from the buffer
   */
  getMessages(options?: {
    sessionId?: SessionId;
    level?: ConsoleMessage['level'];
    limit?: number;
    since?: number;
  }): ConsoleMessage[];

  /**
   * Clear messages for a session
   */
  clearMessages(sessionId?: SessionId): void;

  /**
   * Enable console message collection for a session
   */
  enableSession(sessionId: SessionId): void;

  /**
   * Disable console message collection for a session
   */
  disableSession(sessionId: SessionId): void;

  /**
   * Check if a session is enabled for message collection
   */
  isSessionEnabled(sessionId: SessionId): boolean;
}

export class ConsoleBufferService implements IConsoleBufferService {
  private readonly messages: ConsoleMessage[] = [];
  private readonly enabledSessions = new Set<SessionId>();
  private readonly maxBufferSize = 1000;

  constructor(private readonly logger: ILogger) {}

  addMessage(message: ConsoleMessage): void {
    // Only buffer messages from enabled sessions
    if (!this.isSessionEnabled(message.sessionId)) {
      return;
    }

    this.messages.push(message);
    
    // Trim buffer if it gets too large
    if (this.messages.length > this.maxBufferSize) {
      const toRemove = this.messages.length - this.maxBufferSize;
      this.messages.splice(0, toRemove);
      this.logger.debug(
        { removed: toRemove, currentSize: this.messages.length },
        'Trimmed console message buffer'
      );
    }

    this.logger.debug(
      { 
        level: message.level, 
        sessionId: message.sessionId,
        text: message.text.slice(0, 100) 
      },
      'Added console message to buffer'
    );
  }

  getMessages(options?: {
    sessionId?: SessionId;
    level?: ConsoleMessage['level'];
    limit?: number;
    since?: number;
  }): ConsoleMessage[] {
    let filtered = [...this.messages];

    if (options?.sessionId) {
      filtered = filtered.filter(msg => msg.sessionId === options.sessionId);
    }

    if (options?.level) {
      filtered = filtered.filter(msg => msg.level === options.level);
    }

    if (options?.since !== undefined) {
      const since = options.since;
      filtered = filtered.filter(msg => msg.timestamp > since);
    }

    // Sort by timestamp (newest first)
    filtered.sort((a, b) => b.timestamp - a.timestamp);

    // Apply limit
    if (options?.limit && options.limit > 0) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  clearMessages(sessionId?: SessionId): void {
    if (sessionId) {
      const before = this.messages.length;
      const filtered = this.messages.filter(msg => msg.sessionId !== sessionId);
      this.messages.length = 0;
      this.messages.push(...filtered);
      
      this.logger.debug(
        { sessionId, removed: before - this.messages.length },
        'Cleared messages for session'
      );
    } else {
      const before = this.messages.length;
      this.messages.length = 0;
      
      this.logger.debug(
        { removed: before },
        'Cleared all console messages'
      );
    }
  }

  enableSession(sessionId: SessionId): void {
    this.enabledSessions.add(sessionId);
    this.logger.debug({ sessionId }, 'Enabled console message collection for session');
  }

  disableSession(sessionId: SessionId): void {
    this.enabledSessions.delete(sessionId);
    this.clearMessages(sessionId);
    this.logger.debug({ sessionId }, 'Disabled console message collection for session');
  }

  isSessionEnabled(sessionId: SessionId): boolean {
    return this.enabledSessions.has(sessionId);
  }
}