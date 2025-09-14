/**
 * @fileoverview Tests for transport registry and factory
 */

import { describe, test, expect, vi, beforeEach } from 'vitest'
import {
  transportRegistry,
  createTransport,
  registerTransport,
  getAvailableTransports,
  TransportManager
} from '../registry.js'
import { BaseTransport } from '../base.js'
import type { TransportConfig, TransportCapabilities } from '../types.js'

// Mock transport for testing
class TestTransport extends BaseTransport {
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
    return 'test://localhost'
  }

  protected async doConnect(): Promise<void> {
    // Mock connect
  }

  protected async doDisconnect(): Promise<void> {
    // Mock disconnect
  }

  protected async doSend(): Promise<void> {
    // Mock send
  }

  protected async sendKeepAlive(): Promise<void> {
    // Mock keep-alive
  }
}

describe('Transport Registry', () => {
  describe('Built-in Transports', () => {
    test('has WebSocket transport registered', () => {
      expect(transportRegistry.has('websocket')).toBe(true)
    })

    test('has HTTP transport registered', () => {
      expect(transportRegistry.has('http')).toBe(true)
    })

    test('lists available transport types', () => {
      const types = getAvailableTransports()
      expect(types).toContain('websocket')
      expect(types).toContain('http')
    })
  })

  describe('Transport Creation', () => {
    test('creates WebSocket transport', () => {
      const transport = createTransport({
        type: 'websocket',
        url: 'ws://localhost:8080'
      })
      
      expect(transport).toBeDefined()
      expect(transport.capabilities.bidirectional).toBe(true)
    })

    test('creates HTTP transport', () => {
      const transport = createTransport({
        type: 'http',
        baseUrl: 'http://localhost:8080'
      })
      
      expect(transport).toBeDefined()
      expect(transport.capabilities.bidirectional).toBe(false)
    })

    test('throws for unknown transport type', () => {
      expect(() => {
        createTransport({
          type: 'unknown' as any
        })
      }).toThrow('Unknown transport type')
    })
  })

  describe('Custom Transport Registration', () => {
    test('registers custom transport', () => {
      const customFactory = vi.fn((config: TransportConfig) => new TestTransport(config))
      
      registerTransport('custom' as any, customFactory)
      
      expect(transportRegistry.has('custom' as any)).toBe(true)
      
      const transport = createTransport({
        type: 'custom' as any
      })
      
      expect(customFactory).toHaveBeenCalled()
      expect(transport).toBeInstanceOf(TestTransport)
    })

    test('prevents duplicate registration', () => {
      expect(() => {
        registerTransport('websocket', () => new TestTransport({ type: 'websocket' }))
      }).toThrow('already registered')
    })

    test('unregisters transport', () => {
      // Register a custom transport
      registerTransport('temp' as any, () => new TestTransport({ type: 'websocket' }))
      expect(transportRegistry.has('temp' as any)).toBe(true)
      
      // Unregister it
      transportRegistry.unregister('temp' as any)
      expect(transportRegistry.has('temp' as any)).toBe(false)
    })
  })
})

describe('TransportManager', () => {
  let manager: TransportManager

  beforeEach(() => {
    manager = new TransportManager()
  })

  describe('Transport Management', () => {
    test('adds transport', async () => {
      const transport = await manager.add('test', {
        type: 'websocket',
        url: 'ws://localhost:8080'
      })
      
      expect(transport).toBeDefined()
      expect(manager.get('test')).toBe(transport)
      expect(manager.ids()).toContain('test')
    })

    test('prevents duplicate IDs', async () => {
      await manager.add('test', {
        type: 'websocket',
        url: 'ws://localhost:8080'
      })
      
      await expect(manager.add('test', {
        type: 'http',
        baseUrl: 'http://localhost:8080'
      })).rejects.toThrow('already exists')
    })

    test('removes transport', async () => {
      const transport = await manager.add('test', {
        type: 'websocket',
        url: 'ws://localhost:8080'
      })
      
      const destroySpy = vi.spyOn(transport, 'destroy')
      
      await manager.remove('test')
      
      expect(destroySpy).toHaveBeenCalled()
      expect(manager.get('test')).toBeUndefined()
    })

    test('handles removing non-existent transport', async () => {
      await expect(manager.remove('nonexistent')).resolves.not.toThrow()
    })
  })

  describe('Bulk Operations', () => {
    beforeEach(async () => {
      await manager.add('ws1', {
        type: 'websocket',
        url: 'ws://localhost:8080'
      })
      
      await manager.add('ws2', {
        type: 'websocket',
        url: 'ws://localhost:8081'
      })
      
      await manager.add('http1', {
        type: 'http',
        baseUrl: 'http://localhost:8082'
      })
    })

    test('connects all transports', async () => {
      const transports = manager.all()
      const connectSpies = transports.map(t => vi.spyOn(t, 'connect'))
      
      await manager.connectAll()
      
      connectSpies.forEach(spy => {
        expect(spy).toHaveBeenCalled()
      })
    })

    test('disconnects all transports', async () => {
      const transports = manager.all()
      const disconnectSpies = transports.map(t => vi.spyOn(t, 'disconnect'))
      
      await manager.disconnectAll('Shutting down')
      
      disconnectSpies.forEach(spy => {
        expect(spy).toHaveBeenCalledWith('Shutting down')
      })
    })

    test('lists all transport IDs', () => {
      const ids = manager.ids()
      expect(ids).toHaveLength(3)
      expect(ids).toContain('ws1')
      expect(ids).toContain('ws2')
      expect(ids).toContain('http1')
    })

    test('gets all transports', () => {
      const transports = manager.all()
      expect(transports).toHaveLength(3)
    })

    test('clears all transports', async () => {
      const transports = manager.all()
      const destroySpies = transports.map(t => vi.spyOn(t, 'destroy'))
      
      await manager.clear()
      
      destroySpies.forEach(spy => {
        expect(spy).toHaveBeenCalled()
      })
      
      expect(manager.ids()).toHaveLength(0)
    })
  })
})