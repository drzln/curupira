/**
 * Test setup and utilities
 * Level 0: Foundation (test utilities)
 */

import { vi } from 'vitest'
import type { SessionId, TargetId } from '@curupira/shared/types'

// Mock Chrome client
export const mockChromeClient = {
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
  send: vi.fn(),
  createSession: vi.fn().mockResolvedValue('test-session-id' as SessionId),
  getSessions: vi.fn().mockReturnValue([{ sessionId: 'test-session-id' as SessionId }]),
  getTargets: vi.fn().mockReturnValue([
    { targetId: 'mock-target-id' as TargetId, type: 'page', title: 'Test Page' }
  ]),
  getState: vi.fn().mockReturnValue('connected'),
  isConnected: vi.fn().mockReturnValue(true),
  on: vi.fn(),
  off: vi.fn(),
}

// Mock logger
export const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  child: vi.fn().mockReturnThis(),
}

// Common test data
export const testSessionId = 'test-session-id' as SessionId
export const testTargetId = 'test-target-id' as TargetId

// Reset all mocks
export function resetAllMocks() {
  vi.clearAllMocks()
}

// Create mock CDP response
export function createCDPResponse<T>(result: T) {
  return {
    result: {
      value: result
    }
  }
}

// Create mock CDP error response
export function createCDPError(message: string) {
  return {
    result: undefined,
    exceptionDetails: {
      text: message,
      exception: {
        description: message,
      },
    },
  }
}