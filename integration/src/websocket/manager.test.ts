/**
 * @fileoverview WebSocket manager tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { WebSocketManager } from './manager.js'
import type { WebSocketConnection, WebSocketConnectionConfig } from './types.js'
import { NetworkErrors, InternalErrors } from '@curupira/shared'

// Mock WebSocket transport
vi.mock('@curupira/shared', async () => {
  const actual = await vi.importActual<typeof import('@curupira/shared')>('@curupira/shared')
  return {
    ...actual,
    NetworkErrors: actual.NetworkErrors,
    InternalErrors: actual.InternalErrors,
    createLogger: actual.createLogger,
    createWebSocketTransport: vi.fn(() => ({
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      send: vi.fn().mockResolvedValue(undefined),
      onMessage: vi.fn(),
      on: vi.fn(),
      getHealth: vi.fn().mockResolvedValue({ status: 'healthy' }),
      connectionInfo: { url: 'ws://localhost:8080' }
    }))
  }
})

describe('WebSocketManager', () => {
  let manager: WebSocketManager

  beforeEach(() => {
    manager = new WebSocketManager({
      maxConnections: 5,
      healthCheck: { enabled: false },
      pooling: { enabled: false }
    })
  })

  afterEach(async () => {
    await manager.destroy()
  })

  describe('Connection Management', () => {
    it('should add a connection', async () => {
      const config: WebSocketConnectionConfig = {
        id: 'test-1',
        url: 'ws://localhost:8080'
      }

      const connection = await manager.addConnection(config)
      
      expect(connection).toBeDefined()
      expect(connection.id).toBe('test-1')
      expect(connection.state).toBe('connected')
      expect(manager.getConnection('test-1')).toBe(connection)
    })

    it('should enforce max connections limit', async () => {
      // Fill up connections
      for (let i = 0; i < 5; i++) {
        await manager.addConnection({
          id: `test-${i}`,
          url: 'ws://localhost:8080'
        })
      }

      // Try to add one more
      await expect(
        manager.addConnection({
          id: 'test-overflow',
          url: 'ws://localhost:8080'
        })
      ).rejects.toThrow('Maximum connections')
    })

    it('should remove a connection', async () => {
      const connection = await manager.addConnection({
        id: 'test-remove',
        url: 'ws://localhost:8080'
      })

      await manager.removeConnection('test-remove')
      
      expect(manager.getConnection('test-remove')).toBeUndefined()
      expect(connection.transport.disconnect).toHaveBeenCalledWith('Connection removed')
    })
  })

  describe('Message Routing', () => {
    it('should send message to specific connection', async () => {
      const conn1 = await manager.addConnection({
        id: 'conn-1',
        url: 'ws://localhost:8080'
      })
      const conn2 = await manager.addConnection({
        id: 'conn-2',
        url: 'ws://localhost:8080'
      })

      const message = { 
        id: '123',
        jsonrpc: '2.0' as const,
        method: 'test',
        timestamp: Date.now()
      }

      await manager.send(message, { connectionId: 'conn-1' })

      expect(conn1.transport.send).toHaveBeenCalledWith(message)
      expect(conn2.transport.send).not.toHaveBeenCalled()
    })

    it('should broadcast message to all connections', async () => {
      const conn1 = await manager.addConnection({
        id: 'conn-1',
        url: 'ws://localhost:8080'
      })
      const conn2 = await manager.addConnection({
        id: 'conn-2',
        url: 'ws://localhost:8080'
      })

      const message = { 
        id: '123',
        jsonrpc: '2.0' as const,
        method: 'test',
        timestamp: Date.now()
      }

      await manager.send(message, { broadcast: true })

      expect(conn1.transport.send).toHaveBeenCalledWith(message)
      expect(conn2.transport.send).toHaveBeenCalledWith(message)
    })

    it('should throw error when no connections available', async () => {
      const message = { 
        id: '123',
        jsonrpc: '2.0' as const,
        method: 'test',
        timestamp: Date.now()
      }

      await expect(manager.send(message)).rejects.toThrow('No available connections')
    })
  })

  describe('Connection Selection', () => {
    it('should select connection using round-robin strategy', async () => {
      const conn1 = await manager.addConnection({
        id: 'conn-1',
        url: 'ws://localhost:8080'
      })
      const conn2 = await manager.addConnection({
        id: 'conn-2',
        url: 'ws://localhost:8080'
      })

      // First selection
      let selected = manager.selectConnection('round-robin')
      expect(selected?.id).toBe('conn-1')

      // Second selection
      selected = manager.selectConnection('round-robin')
      expect(selected?.id).toBe('conn-2')

      // Third selection (wraps around)
      selected = manager.selectConnection('round-robin')
      expect(selected?.id).toBe('conn-1')
    })

    it('should select least loaded connection', async () => {
      const conn1 = await manager.addConnection({
        id: 'conn-1',
        url: 'ws://localhost:8080'
      })
      const conn2 = await manager.addConnection({
        id: 'conn-2',
        url: 'ws://localhost:8080'
      })

      // Add messages to conn1's queue
      conn1.messageQueue.push(
        { id: '1', jsonrpc: '2.0' as const, method: 'test', timestamp: Date.now() },
        { id: '2', jsonrpc: '2.0' as const, method: 'test', timestamp: Date.now() }
      )

      const selected = manager.selectConnection('least-loaded')
      expect(selected?.id).toBe('conn-2')
    })
  })

  describe('Pool Statistics', () => {
    it('should return accurate pool statistics', async () => {
      await manager.addConnection({
        id: 'conn-1',
        url: 'ws://localhost:8080'
      })
      
      const stats = manager.getPoolStatistics()
      
      expect(stats.total).toBe(1)
      expect(stats.active).toBe(1)
      expect(stats.idle).toBe(0)
      expect(stats.failed).toBe(0)
      expect(stats.messagesSent).toBe(0)
      expect(stats.messagesReceived).toBe(0)
      expect(stats.averageLatency).toBe(0)
      expect(stats.uptime).toBeGreaterThan(0)
    })
  })

  describe('Health Checks', () => {
    it('should perform health check on connection', async () => {
      const connection = await manager.addConnection({
        id: 'test-health',
        url: 'ws://localhost:8080'
      })

      const result = await manager.healthCheck('test-health')
      
      expect(result).toBe(true)
      expect(connection.transport.getHealth).toHaveBeenCalled()
    })

    it('should use custom health check function', async () => {
      await manager.addConnection({
        id: 'test-custom',
        url: 'ws://localhost:8080'
      })

      const customCheck = vi.fn().mockResolvedValue(true)
      const result = await manager.healthCheck('test-custom', customCheck)
      
      expect(result).toBe(true)
      expect(customCheck).toHaveBeenCalled()
    })
  })

  describe('Lifecycle Hooks', () => {
    it('should call lifecycle hooks', async () => {
      const hooks = {
        beforeConnect: vi.fn(),
        afterConnect: vi.fn(),
        beforeDisconnect: vi.fn(),
        afterDisconnect: vi.fn()
      }

      manager.setLifecycleHooks(hooks)

      const config: WebSocketConnectionConfig = {
        id: 'test-hooks',
        url: 'ws://localhost:8080'
      }

      const connection = await manager.addConnection(config)
      expect(hooks.beforeConnect).toHaveBeenCalledWith(config)
      expect(hooks.afterConnect).toHaveBeenCalledWith(connection)

      await manager.removeConnection('test-hooks')
      expect(hooks.beforeDisconnect).toHaveBeenCalledWith(connection)
      expect(hooks.afterDisconnect).toHaveBeenCalledWith('test-hooks')
    })
  })
})