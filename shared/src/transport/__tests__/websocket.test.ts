/**
 * @fileoverview Tests for WebSocket transport
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { WebSocketTransport, createWebSocketTransport } from '../websocket.js'
import type { WebSocketTransportConfig, TransportMessage } from '../types.js'
import { createRequestId, createTimestamp } from '../../types/index.js'
import { WebSocket } from 'ws'

// Mock the ws module
vi.mock('ws', () => {
  const mockWebSocket = vi.fn()
  mockWebSocket.OPEN = 1
  mockWebSocket.CLOSED = 3
  
  return { WebSocket: mockWebSocket }
})

describe('WebSocketTransport', () => {
  let transport: WebSocketTransport
  let config: WebSocketTransportConfig
  let mockWs: any

  beforeEach(() => {
    config = {
      type: 'websocket',
      url: 'ws://localhost:8080',
      autoReconnect: false,
      enablePing: false
    }

    // Create mock WebSocket instance
    mockWs = {
      readyState: WebSocket.CLOSED,
      close: vi.fn((code, reason) => {
        mockWs.readyState = WebSocket.CLOSED
        if (mockWs.onclose) {
          mockWs.onclose({ code, reason })
        }
      }),
      send: vi.fn((data, callback) => {
        if (callback) callback()
      }),
      ping: vi.fn(),
      on: vi.fn(),
      once: vi.fn(),
      terminate: vi.fn()
    }

    // Mock WebSocket constructor
    const MockWebSocket = WebSocket as any
    MockWebSocket.mockImplementation(() => mockWs)

    transport = new WebSocketTransport(config)
  })

  afterEach(async () => {
    await transport.destroy()
    vi.clearAllMocks()
  })

  describe('Connection', () => {
    test('connects successfully', async () => {
      const connectPromise = transport.connect()
      
      // Simulate successful connection
      mockWs.readyState = WebSocket.OPEN
      mockWs.protocol = 'mcp'
      if (mockWs.onopen) mockWs.onopen()
      
      await connectPromise
      
      expect(transport.isConnected()).toBe(true)
      expect(transport.connectionInfo?.protocolVersion).toBe('mcp')
    })

    test('handles connection errors', async () => {
      const connectPromise = transport.connect()
      
      // Simulate connection error
      if (mockWs.onerror) mockWs.onerror({ message: 'Connection refused' })
      
      await expect(connectPromise).rejects.toThrow('Connection refused')
      expect(transport.isConnected()).toBe(false)
    })

    test.skip('disconnects properly', async () => {
      // Connect first
      const connectPromise = transport.connect()
      mockWs.readyState = WebSocket.OPEN
      if (mockWs.onopen) mockWs.onopen()
      await connectPromise
      
      // Disconnect
      await transport.disconnect('Test disconnect')
      
      expect(mockWs.close).toHaveBeenCalledWith(1000, 'Test disconnect')
      expect(transport.isConnected()).toBe(false)
    })

    test('handles unexpected disconnection', async () => {
      const disconnectHandler = vi.fn()
      transport.on('disconnected', disconnectHandler)
      
      // Connect first
      const connectPromise = transport.connect()
      mockWs.readyState = WebSocket.OPEN
      if (mockWs.onopen) mockWs.onopen()
      await connectPromise
      
      // Simulate unexpected close
      if (mockWs.onclose) {
        mockWs.onclose({ code: 1006, reason: 'Connection lost' })
      }
      
      expect(disconnectHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'disconnected',
          reason: 'Connection lost'
        })
      )
    })

    test('auto-reconnects on unexpected disconnection', async () => {
      const reconnectTransport = new WebSocketTransport({
        ...config,
        autoReconnect: true,
        maxReconnectAttempts: 2,
        reconnectDelay: 50
      })
      
      const reconnectHandler = vi.fn()
      reconnectTransport.on('reconnecting', reconnectHandler)
      
      // Connect first
      const connectPromise = reconnectTransport.connect()
      mockWs.readyState = WebSocket.OPEN
      if (mockWs.onopen) mockWs.onopen()
      await connectPromise
      
      // Simulate unexpected close
      if (mockWs.onclose) {
        mockWs.onclose({ code: 1006, reason: 'Connection lost' })
      }
      
      expect(reconnectHandler).toHaveBeenCalled()
      
      await reconnectTransport.destroy()
    })
  })

  describe('Message Sending', () => {
    beforeEach(async () => {
      // Connect transport
      const connectPromise = transport.connect()
      mockWs.readyState = WebSocket.OPEN
      if (mockWs.onopen) mockWs.onopen()
      await connectPromise
    })

    test('sends messages successfully', async () => {
      const message: TransportMessage = {
        id: createRequestId(),
        timestamp: createTimestamp(),
        payload: { data: 'test' }
      }
      
      await transport.send(message)
      
      expect(mockWs.send).toHaveBeenCalledWith(
        JSON.stringify(message),
        expect.any(Function)
      )
    })

    test('fails to send when not connected', async () => {
      await transport.disconnect()
      
      const message: TransportMessage = {
        id: createRequestId(),
        timestamp: createTimestamp(),
        payload: { data: 'test' }
      }
      
      await expect(transport.send(message)).rejects.toThrow('WebSocket is not open')
    })

    test('handles send errors', async () => {
      mockWs.send.mockImplementation((data, callback) => {
        if (callback) callback(new Error('Send failed'))
      })
      
      const message: TransportMessage = {
        id: createRequestId(),
        timestamp: createTimestamp(),
        payload: { data: 'test' }
      }
      
      await expect(transport.send(message)).rejects.toThrow('Failed to send message')
    })
  })

  describe('Message Receiving', () => {
    test('handles text messages', async () => {
      const messageHandler = vi.fn()
      transport.onMessage(messageHandler)
      
      // Connect
      const connectPromise = transport.connect()
      mockWs.readyState = WebSocket.OPEN
      if (mockWs.onopen) mockWs.onopen()
      await connectPromise
      
      const message: TransportMessage = {
        id: createRequestId(),
        timestamp: createTimestamp(),
        payload: { data: 'test' }
      }
      
      // Simulate incoming message
      if (mockWs.onmessage) {
        mockWs.onmessage({ data: JSON.stringify(message) })
      }
      
      expect(messageHandler).toHaveBeenCalledWith(message)
    })

    test('handles binary messages', async () => {
      const messageHandler = vi.fn()
      transport.onMessage(messageHandler)
      
      // Connect
      const connectPromise = transport.connect()
      mockWs.readyState = WebSocket.OPEN
      if (mockWs.onopen) mockWs.onopen()
      await connectPromise
      
      const message: TransportMessage = {
        id: createRequestId(),
        timestamp: createTimestamp(),
        payload: { data: 'test' }
      }
      
      // Simulate binary message
      const buffer = Buffer.from(JSON.stringify(message))
      if (mockWs.onmessage) {
        mockWs.onmessage({ data: buffer })
      }
      
      expect(messageHandler).toHaveBeenCalledWith(message)
    })

    test('handles invalid messages', async () => {
      const errorHandler = vi.fn()
      transport.onError(errorHandler)
      
      // Connect
      const connectPromise = transport.connect()
      mockWs.readyState = WebSocket.OPEN
      if (mockWs.onopen) mockWs.onopen()
      await connectPromise
      
      // Send invalid JSON
      if (mockWs.onmessage) {
        mockWs.onmessage({ data: 'invalid json' })
      }
      
      expect(errorHandler).toHaveBeenCalled()
    })

    test('validates message structure', async () => {
      const errorHandler = vi.fn()
      transport.onError(errorHandler)
      
      // Connect
      const connectPromise = transport.connect()
      mockWs.readyState = WebSocket.OPEN
      if (mockWs.onopen) mockWs.onopen()
      await connectPromise
      
      // Send message without required fields
      if (mockWs.onmessage) {
        mockWs.onmessage({ data: JSON.stringify({ data: 'test' }) })
      }
      
      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Invalid message structure')
        })
      )
    })
  })

  describe('Ping/Pong', () => {
    test.skip('sends ping when enabled', async () => {
      const pingTransport = new WebSocketTransport({
        ...config,
        enablePing: true,
        pingInterval: 100
      })
      
      // Connect
      const connectPromise = pingTransport.connect()
      mockWs.readyState = WebSocket.OPEN
      if (mockWs.onopen) mockWs.onopen()
      await connectPromise
      
      // Wait for ping
      await new Promise(resolve => setTimeout(resolve, 150))
      
      expect(mockWs.ping).toHaveBeenCalled()
      
      await pingTransport.destroy()
    })

    test.skip('handles pong timeout', async () => {
      const pingTransport = new WebSocketTransport({
        ...config,
        enablePing: true,
        pingInterval: 50,
        pongTimeout: 50
      })
      
      // Connect
      const connectPromise = pingTransport.connect()
      mockWs.readyState = WebSocket.OPEN
      if (mockWs.onopen) mockWs.onopen()
      await connectPromise
      
      // Wait for ping and pong timeout
      await new Promise(resolve => setTimeout(resolve, 150))
      
      expect(mockWs.terminate).toHaveBeenCalled()
      
      await pingTransport.destroy()
    })
  })

  describe('Factory Function', () => {
    test('creates WebSocket transport', () => {
      const transport = createWebSocketTransport(config)
      expect(transport).toBeInstanceOf(WebSocketTransport)
      expect(transport.capabilities.bidirectional).toBe(true)
    })
  })
})