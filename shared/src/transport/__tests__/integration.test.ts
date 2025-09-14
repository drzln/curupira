/**
 * @fileoverview Integration tests for transport layer
 */

import { describe, test, expect } from 'vitest'
import { createTransport, getAvailableTransports, TransportManager } from '../registry'
import type { TransportMessage } from '../types'
import { createRequestId, createTimestamp } from '../../types'

describe('Transport Integration', () => {
  test('available transports are registered', () => {
    const transports = getAvailableTransports()
    expect(transports).toContain('websocket')
    expect(transports).toContain('http')
  })

  test('creates WebSocket transport', () => {
    const transport = createTransport({
      type: 'websocket',
      url: 'ws://localhost:8080'
    })
    
    expect(transport).toBeDefined()
    expect(transport.config.type).toBe('websocket')
    expect(transport.capabilities.bidirectional).toBe(true)
  })

  test('creates HTTP transport', () => {
    const transport = createTransport({
      type: 'http',
      baseUrl: 'http://localhost:8080'
    })
    
    expect(transport).toBeDefined()
    expect(transport.config.type).toBe('http')
    expect(transport.capabilities.bidirectional).toBe(false)
  })

  test('TransportManager manages multiple transports', async () => {
    const manager = new TransportManager()
    
    // Add transports
    await manager.add('ws1', {
      type: 'websocket',
      url: 'ws://localhost:8080'
    })
    
    await manager.add('http1', {
      type: 'http',
      baseUrl: 'http://localhost:8080'
    })
    
    // Verify they exist
    expect(manager.ids()).toHaveLength(2)
    expect(manager.get('ws1')).toBeDefined()
    expect(manager.get('http1')).toBeDefined()
    
    // Clear all
    await manager.clear()
    expect(manager.ids()).toHaveLength(0)
  })

  test('transport message structure is correct', () => {
    const message: TransportMessage = {
      id: createRequestId(),
      timestamp: createTimestamp(),
      payload: { 
        type: 'test',
        data: 'Hello, World!'
      }
    }
    
    expect(message.id).toBeDefined()
    expect(message.timestamp).toBeGreaterThan(0)
    expect(message.payload).toEqual({
      type: 'test',
      data: 'Hello, World!'
    })
  })
})