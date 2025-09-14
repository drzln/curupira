/**
 * @fileoverview Tests for base transport functionality
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { BaseTransport } from '../base.js'
import type {
  TransportConfig,
  TransportMessage,
  TransportCapabilities,
  ConnectionState,
  TransportEvent
} from '../types.js'
import { createRequestId, createTimestamp } from '../../types/index.js'

// Mock transport implementation for testing
class MockTransport extends BaseTransport {
  public mockConnected = false
  public mockSendError = false
  public lastSentMessage?: TransportMessage

  get capabilities(): TransportCapabilities {
    return {
      bidirectional: true,
      streaming: false,
      batching: false,
      compression: false,
      encryption: false,
      authentication: false,
      qos: false
    }
  }

  protected getConnectionString(): string {
    return 'mock://localhost'
  }

  protected async doConnect(): Promise<void> {
    if (!this.mockConnected) {
      throw new Error('Mock connection failed')
    }
  }

  protected async doDisconnect(): Promise<void> {
    // Mock disconnect
  }

  protected async doSend<T>(message: TransportMessage<T>): Promise<void> {
    if (this.mockSendError) {
      throw new Error('Mock send failed')
    }
    this.lastSentMessage = message
  }

  protected async sendKeepAlive(): Promise<void> {
    // Mock keep-alive
  }

  // Expose protected methods for testing
  public testHandleMessage<T>(message: TransportMessage<T>): Promise<void> {
    return this.handleMessage(message)
  }

  public testUpdateState(state: ConnectionState): void {
    this.updateState(state)
  }

  public testEmitEvent(event: TransportEvent): void {
    this.emitEvent(event)
  }
}

describe('BaseTransport', () => {
  let transport: MockTransport
  let config: TransportConfig

  beforeEach(() => {
    config = {
      type: 'websocket',
      autoReconnect: false, // Disable for controlled testing
      keepAlive: false
    }
    transport = new MockTransport(config)
  })

  afterEach(async () => {
    await transport.destroy()
  })

  describe('Connection Management', () => {
    test('initializes with disconnected state', () => {
      expect(transport.state).toBe('disconnected')
      expect(transport.connectionInfo).toBeNull()
      expect(transport.isConnected()).toBe(false)
    })

    test('connects successfully', async () => {
      transport.mockConnected = true
      
      const connectPromise = transport.connect()
      expect(transport.state).toBe('connecting')
      
      await connectPromise
      expect(transport.state).toBe('connected')
      expect(transport.isConnected()).toBe(true)
      expect(transport.connectionInfo).toBeDefined()
      expect(transport.connectionInfo?.sessionId).toBeDefined()
    })

    test('handles connection failure', async () => {
      transport.mockConnected = false
      
      await expect(transport.connect()).rejects.toThrow()
      expect(transport.state).toBe('error')
      expect(transport.isConnected()).toBe(false)
    })

    test('prevents duplicate connections', async () => {
      transport.mockConnected = true
      
      await transport.connect()
      const warnSpy = vi.spyOn(transport['logger'], 'warn')
      
      await transport.connect()
      expect(warnSpy).toHaveBeenCalledWith('Already connected')
    })

    test('disconnects successfully', async () => {
      transport.mockConnected = true
      await transport.connect()
      
      await transport.disconnect('Test disconnect')
      expect(transport.state).toBe('closed')
      expect(transport.isConnected()).toBe(false)
    })

    test('handles disconnect when not connected', async () => {
      const warnSpy = vi.spyOn(transport['logger'], 'warn')
      
      await transport.disconnect()
      expect(warnSpy).toHaveBeenCalledWith('Not connected')
    })

    test('connection timeout works', async () => {
      const slowTransport = new MockTransport({
        ...config,
        connectionTimeout: 100
      })
      
      // Override doConnect to be slow
      slowTransport['doConnect'] = async () => {
        await new Promise(resolve => setTimeout(resolve, 200))
      }
      
      await expect(slowTransport.connect()).rejects.toThrow('Connection timeout')
      await slowTransport.destroy()
    })
  })

  describe('Message Handling', () => {
    beforeEach(async () => {
      transport.mockConnected = true
      await transport.connect()
    })

    test('sends messages successfully', async () => {
      const message: TransportMessage = {
        id: createRequestId(),
        timestamp: createTimestamp(),
        payload: { data: 'test' }
      }
      
      await transport.send(message)
      expect(transport.lastSentMessage).toEqual(message)
      expect(transport.stats.messagesSent).toBe(1)
    })

    test('fails to send when not connected', async () => {
      await transport.disconnect()
      
      const message: TransportMessage = {
        id: createRequestId(),
        timestamp: createTimestamp(),
        payload: { data: 'test' }
      }
      
      await expect(transport.send(message)).rejects.toThrow('Transport is not connected')
    })

    test('handles send errors', async () => {
      transport.mockSendError = true
      
      const message: TransportMessage = {
        id: createRequestId(),
        timestamp: createTimestamp(),
        payload: { data: 'test' }
      }
      
      await expect(transport.send(message)).rejects.toThrow('Mock send failed')
      expect(transport.stats.errors).toBe(1)
    })

    test('validates message size', async () => {
      const largeTransport = new MockTransport({
        ...config,
        maxMessageSize: 100
      })
      largeTransport.mockConnected = true
      await largeTransport.connect()
      
      const largeMessage: TransportMessage = {
        id: createRequestId(),
        timestamp: createTimestamp(),
        payload: { data: 'x'.repeat(200) }
      }
      
      await expect(largeTransport.send(largeMessage)).rejects.toThrow('exceeds maximum')
      await largeTransport.destroy()
    })

    test('handles incoming messages', async () => {
      const messageHandler = vi.fn()
      transport.onMessage(messageHandler)
      
      const message: TransportMessage = {
        id: createRequestId(),
        timestamp: createTimestamp(),
        payload: { data: 'test' }
      }
      
      await transport.testHandleMessage(message)
      
      expect(messageHandler).toHaveBeenCalledWith(message)
      expect(transport.stats.messagesReceived).toBe(1)
    })
  })

  describe('Event Handling', () => {
    test('emits connection events', async () => {
      const eventHandler = vi.fn()
      transport.on('connected', eventHandler)
      
      transport.mockConnected = true
      await transport.connect()
      
      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'connected',
          timestamp: expect.any(Number)
        })
      )
    })

    test('emits disconnection events', async () => {
      const eventHandler = vi.fn()
      transport.on('disconnected', eventHandler)
      
      transport.mockConnected = true
      await transport.connect()
      await transport.disconnect('Test reason')
      
      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'disconnected',
          timestamp: expect.any(Number),
          reason: 'Test reason'
        })
      )
    })

    test('emits error events', async () => {
      const errorHandler = vi.fn()
      transport.onError(errorHandler)
      
      transport.mockConnected = false
      await transport.connect().catch(() => {}) // Ignore error
      
      expect(errorHandler).toHaveBeenCalled()
    })

    test('emits state change events', () => {
      const stateHandler = vi.fn()
      transport.on('state_changed', stateHandler)
      
      transport.testUpdateState('connecting')
      
      expect(stateHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'state_changed',
          from: 'disconnected',
          to: 'connecting'
        })
      )
    })

    test('removes event handlers', () => {
      const handler = vi.fn()
      transport.on('connected', handler)
      transport.off('connected', handler)
      
      transport.testEmitEvent({
        type: 'connected',
        timestamp: createTimestamp()
      })
      
      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('Statistics', () => {
    test('tracks message statistics', async () => {
      transport.mockConnected = true
      await transport.connect()
      
      const message: TransportMessage = {
        id: createRequestId(),
        timestamp: createTimestamp(),
        payload: { data: 'test' }
      }
      
      await transport.send(message)
      await transport.testHandleMessage(message)
      
      const stats = transport.stats
      expect(stats.messagesSent).toBe(1)
      expect(stats.messagesReceived).toBe(1)
      expect(stats.bytesSent).toBeGreaterThan(0)
      expect(stats.bytesReceived).toBeGreaterThan(0)
      expect(stats.lastActivityAt).toBeDefined()
    })

    test('tracks connection duration', async () => {
      transport.mockConnected = true
      await transport.connect()
      
      await new Promise(resolve => setTimeout(resolve, 100))
      
      const stats = transport.stats
      expect(stats.connectionDuration).toBeDefined()
      expect(stats.connectionDuration).toBeGreaterThan(0)
    })

    test('resets statistics', async () => {
      transport.mockConnected = true
      await transport.connect()
      
      const message: TransportMessage = {
        id: createRequestId(),
        timestamp: createTimestamp(),
        payload: { data: 'test' }
      }
      
      await transport.send(message)
      transport.resetStats()
      
      const stats = transport.stats
      expect(stats.messagesSent).toBe(0)
      expect(stats.messagesReceived).toBe(0)
      expect(stats.errors).toBe(0)
    })
  })

  describe('Auto-reconnection', () => {
    test('reconnects on failure when enabled', async () => {
      const reconnectTransport = new MockTransport({
        ...config,
        autoReconnect: true,
        maxReconnectAttempts: 2,
        reconnectDelay: 50
      })
      
      const reconnectHandler = vi.fn()
      reconnectTransport.on('reconnecting', reconnectHandler)
      
      reconnectTransport.mockConnected = false
      await reconnectTransport.connect().catch(() => {})
      
      expect(reconnectTransport.state).toBe('reconnecting')
      expect(reconnectHandler).toHaveBeenCalled()
      
      // Enable connection for next attempt
      reconnectTransport.mockConnected = true
      
      // Wait for reconnection
      await new Promise(resolve => setTimeout(resolve, 100))
      
      expect(reconnectTransport.isConnected()).toBe(true)
      await reconnectTransport.destroy()
    })

    test('stops reconnecting after max attempts', async () => {
      const reconnectTransport = new MockTransport({
        ...config,
        autoReconnect: true,
        maxReconnectAttempts: 1,
        reconnectDelay: 50
      })
      
      reconnectTransport.mockConnected = false
      await reconnectTransport.connect().catch(() => {})
      
      // Wait for reconnection attempts
      await new Promise(resolve => setTimeout(resolve, 200))
      
      expect(reconnectTransport.state).toBe('disconnected')
      expect(reconnectTransport.stats.reconnectAttempts).toBe(1)
      
      await reconnectTransport.destroy()
    })
  })

  describe('Middleware', () => {
    test('applies outgoing middleware', async () => {
      transport.mockConnected = true
      await transport.connect()
      
      const middleware = {
        name: 'test-middleware',
        outgoing: vi.fn(async (message, next) => {
          message.metadata = { ...message.metadata, modified: true }
          await next()
        })
      }
      
      transport.use(middleware)
      
      const message: TransportMessage = {
        id: createRequestId(),
        timestamp: createTimestamp(),
        payload: { data: 'test' }
      }
      
      await transport.send(message)
      expect(middleware.outgoing).toHaveBeenCalled()
    })

    test('applies incoming middleware', async () => {
      const middleware = {
        name: 'test-middleware',
        incoming: vi.fn(async (message, next) => {
          await next()
        })
      }
      
      transport.use(middleware)
      
      const message: TransportMessage = {
        id: createRequestId(),
        timestamp: createTimestamp(),
        payload: { data: 'test' }
      }
      
      await transport.testHandleMessage(message)
      expect(middleware.incoming).toHaveBeenCalled()
    })
  })

  describe('Cleanup', () => {
    test('destroys transport properly', async () => {
      transport.mockConnected = true
      await transport.connect()
      
      const handler = vi.fn()
      transport.on('disconnected', handler)
      
      await transport.destroy()
      
      expect(transport.state).toBe('closed')
      expect(handler).toHaveBeenCalled()
      
      // Verify no listeners remain
      expect(transport.listenerCount('connected')).toBe(0)
    })
  })
})