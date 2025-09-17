/**
 * Network Buffer Service - Level 1 (Chrome Core)
 * Service for buffering and managing network requests from Chrome DevTools Protocol
 */

import type { ILogger } from '../../core/interfaces/logger.interface.js';
import type { SessionId } from '@curupira/shared/types';

export interface NetworkRequest {
  requestId: string;
  sessionId: SessionId;
  timestamp: number;
  method: string;
  url: string;
  headers: Record<string, string>;
  postData?: string;
  resourceType?: string;
  priority?: string;
  referrerPolicy?: string;
}

export interface NetworkResponse {
  requestId: string;
  sessionId: SessionId;
  timestamp: number;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  mimeType?: string;
  remoteIPAddress?: string;
  remotePort?: number;
  fromDiskCache?: boolean;
  fromServiceWorker?: boolean;
  encodedDataLength?: number;
  timing?: any;
}

export interface NetworkFailure {
  requestId: string;
  sessionId: SessionId;
  timestamp: number;
  errorText: string;
  canceled: boolean;
}

export interface INetworkBufferService {
  /**
   * Add a network request to the buffer
   */
  addRequest(request: NetworkRequest): void;

  /**
   * Update request with response data
   */
  addResponse(response: NetworkResponse): void;

  /**
   * Record a failed request
   */
  addFailure(failure: NetworkFailure): void;

  /**
   * Get network requests from the buffer
   */
  getRequests(options?: {
    sessionId?: SessionId;
    method?: string;
    urlPattern?: string;
    limit?: number;
    since?: number;
    includeResponses?: boolean;
  }): Array<NetworkRequest & { response?: NetworkResponse; failure?: NetworkFailure }>;

  /**
   * Clear requests for a session
   */
  clearRequests(sessionId?: SessionId): void;

  /**
   * Enable network monitoring for a session
   */
  enableSession(sessionId: SessionId): void;

  /**
   * Disable network monitoring for a session
   */
  disableSession(sessionId: SessionId): void;

  /**
   * Check if a session is enabled for monitoring
   */
  isSessionEnabled(sessionId: SessionId): boolean;
}

export class NetworkBufferService implements INetworkBufferService {
  private readonly requests = new Map<string, NetworkRequest>();
  private readonly responses = new Map<string, NetworkResponse>();
  private readonly failures = new Map<string, NetworkFailure>();
  private readonly enabledSessions = new Set<SessionId>();
  private readonly maxBufferSize = 500;

  constructor(private readonly logger: ILogger) {}

  addRequest(request: NetworkRequest): void {
    if (!this.isSessionEnabled(request.sessionId)) {
      return;
    }

    this.requests.set(request.requestId, request);
    
    // Trim buffer if needed
    if (this.requests.size > this.maxBufferSize) {
      const toRemove = this.requests.size - this.maxBufferSize;
      const entries = Array.from(this.requests.entries());
      for (let i = 0; i < toRemove; i++) {
        const [id] = entries[i];
        this.requests.delete(id);
        this.responses.delete(id);
        this.failures.delete(id);
      }
    }

    this.logger.debug(
      { 
        requestId: request.requestId,
        method: request.method,
        url: request.url.slice(0, 100)
      },
      'Added network request to buffer'
    );
  }

  addResponse(response: NetworkResponse): void {
    if (!this.isSessionEnabled(response.sessionId)) {
      return;
    }

    this.responses.set(response.requestId, response);

    this.logger.debug(
      { 
        requestId: response.requestId,
        status: response.status,
        mimeType: response.mimeType
      },
      'Added network response to buffer'
    );
  }

  addFailure(failure: NetworkFailure): void {
    if (!this.isSessionEnabled(failure.sessionId)) {
      return;
    }

    this.failures.set(failure.requestId, failure);

    this.logger.debug(
      { 
        requestId: failure.requestId,
        errorText: failure.errorText
      },
      'Added network failure to buffer'
    );
  }

  getRequests(options?: {
    sessionId?: SessionId;
    method?: string;
    urlPattern?: string;
    limit?: number;
    since?: number;
    includeResponses?: boolean;
  }): Array<NetworkRequest & { response?: NetworkResponse; failure?: NetworkFailure }> {
    let results: Array<NetworkRequest & { response?: NetworkResponse; failure?: NetworkFailure }> = [];

    // Build results array
    for (const [id, request] of this.requests) {
      // Filter by session
      if (options?.sessionId && request.sessionId !== options.sessionId) {
        continue;
      }

      // Filter by method
      if (options?.method && request.method !== options.method) {
        continue;
      }

      // Filter by URL pattern
      if (options?.urlPattern) {
        const regex = new RegExp(options.urlPattern, 'i');
        if (!regex.test(request.url)) {
          continue;
        }
      }

      // Filter by timestamp
      if (options?.since !== undefined) {
        if (request.timestamp <= options.since) {
          continue;
        }
      }

      // Build result object
      const result: NetworkRequest & { response?: NetworkResponse; failure?: NetworkFailure } = { ...request };
      
      if (options?.includeResponses !== false) {
        const response = this.responses.get(id);
        const failure = this.failures.get(id);
        
        if (response) {
          result.response = response;
        }
        if (failure) {
          result.failure = failure;
        }
      }

      results.push(result);
    }

    // Sort by timestamp (newest first)
    results.sort((a, b) => b.timestamp - a.timestamp);

    // Apply limit
    if (options?.limit && options.limit > 0) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  clearRequests(sessionId?: SessionId): void {
    if (sessionId) {
      // Clear requests for specific session
      for (const [id, request] of this.requests) {
        if (request.sessionId === sessionId) {
          this.requests.delete(id);
          this.responses.delete(id);
          this.failures.delete(id);
        }
      }
      
      this.logger.debug({ sessionId }, 'Cleared network requests for session');
    } else {
      // Clear all requests
      const count = this.requests.size;
      this.requests.clear();
      this.responses.clear();
      this.failures.clear();
      
      this.logger.debug({ count }, 'Cleared all network requests');
    }
  }

  enableSession(sessionId: SessionId): void {
    this.enabledSessions.add(sessionId);
    this.logger.debug({ sessionId }, 'Enabled network monitoring for session');
  }

  disableSession(sessionId: SessionId): void {
    this.enabledSessions.delete(sessionId);
    this.clearRequests(sessionId);
    this.logger.debug({ sessionId }, 'Disabled network monitoring for session');
  }

  isSessionEnabled(sessionId: SessionId): boolean {
    return this.enabledSessions.has(sessionId);
  }
}