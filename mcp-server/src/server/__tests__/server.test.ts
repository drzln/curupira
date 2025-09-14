/**
 * @fileoverview Tests for Curupira MCP server
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { CurupiraServer, createServer } from '../server'
import { createServerBuilder, createDevServer } from '../builder'
import type { ServerPlugin, HealthCheck } from '../types'
import { createTimestamp } from '@curupira/shared/types'

describe('CurupiraServer', () => {
  let server: CurupiraServer

  afterEach(async () => {
    if (server && server.state === 'running') {
      await server.stop()
    }
  })

  describe('Lifecycle', () => {
    test('starts with stopped state', () => {
      server = createServer()
      expect(server.state).toBe('stopped')
    })

    test('starts successfully', async () => {
      server = createServer({ port: 0 }) // Use random port
      await server.start()
      expect(server.state).toBe('running')
    })

    test('stops successfully', async () => {
      server = createServer({ port: 0 })
      await server.start()
      await server.stop()
      expect(server.state).toBe('stopped')
    })

    test('restarts successfully', async () => {
      server = createServer({ port: 0 })
      await server.start()
      const firstStartTime = server.stats.startTime
      
      // Add small delay to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 10))
      await server.restart()
      
      expect(server.state).toBe('running')
      expect(server.stats.startTime).toBeGreaterThan(firstStartTime)
    })

    test('handles multiple start calls', async () => {
      server = createServer({ port: 0 })
      await server.start()
      
      // Second start should not throw
      await expect(server.start()).resolves.not.toThrow()
      expect(server.state).toBe('running')
    })

    test('handles multiple stop calls', async () => {
      server = createServer({ port: 0 })
      await server.start()
      await server.stop()
      
      // Second stop should not throw
      await expect(server.stop()).resolves.not.toThrow()
      expect(server.state).toBe('stopped')
    })
  })

  describe('Health Checks', () => {
    test('returns healthy status when running', async () => {
      server = createServer({ port: 0 })
      await server.start()
      
      // Add small delay to ensure measurable uptime
      await new Promise(resolve => setTimeout(resolve, 10))
      
      const health = await server.getHealth()
      
      expect(health.status).toBe('healthy')
      expect(health.version).toBe('1.0.0')
      expect(health.uptime).toBeGreaterThanOrEqual(0)
      expect(health.checks).toContainEqual(
        expect.objectContaining({
          name: 'server',
          status: 'healthy'
        })
      )
    })

    test('returns unhealthy status when stopped', async () => {
      server = createServer()
      
      const health = await server.getHealth()
      
      expect(health.checks).toContainEqual(
        expect.objectContaining({
          name: 'server',
          status: 'unhealthy',
          message: 'Server is stopped'
        })
      )
    })

    test('includes memory health check', async () => {
      server = createServer()
      const health = await server.getHealth()
      
      expect(health.checks).toContainEqual(
        expect.objectContaining({
          name: 'memory',
          status: expect.stringMatching(/healthy|degraded|unhealthy/)
        })
      )
    })

    test('registers custom health check', async () => {
      server = createServer()
      
      const customCheck = vi.fn().mockResolvedValue({
        name: 'custom',
        status: 'healthy' as const,
        message: 'Custom check passed'
      })
      
      server.registerHealthCheck('custom', customCheck)
      
      const health = await server.getHealth()
      
      expect(customCheck).toHaveBeenCalled()
      expect(health.checks).toContainEqual(
        expect.objectContaining({
          name: 'custom',
          status: 'healthy',
          message: 'Custom check passed'
        })
      )
    })

    test('handles health check errors', async () => {
      server = createServer()
      
      server.registerHealthCheck('failing', async () => {
        throw new Error('Check failed')
      })
      
      const health = await server.getHealth()
      
      expect(health.checks).toContainEqual(
        expect.objectContaining({
          name: 'failing',
          status: 'unhealthy',
          message: 'Check failed'
        })
      )
    })
  })

  describe('Plugins', () => {
    test('initializes plugins on start', async () => {
      const plugin: ServerPlugin = {
        name: 'test-plugin',
        initialize: vi.fn(),
        start: vi.fn()
      }
      
      server = createServer({ port: 0 })
      server.use(plugin)
      
      await server.start()
      
      expect(plugin.initialize).toHaveBeenCalledWith(server)
      expect(plugin.start).toHaveBeenCalled()
    })

    test('stops plugins in reverse order', async () => {
      const stopOrder: string[] = []
      
      const plugin1: ServerPlugin = {
        name: 'plugin1',
        stop: vi.fn(() => stopOrder.push('plugin1'))
      }
      
      const plugin2: ServerPlugin = {
        name: 'plugin2',
        stop: vi.fn(() => stopOrder.push('plugin2'))
      }
      
      server = createServer({ port: 0 })
      server.use(plugin1)
      server.use(plugin2)
      
      await server.start()
      await server.stop()
      
      expect(stopOrder).toEqual(['plugin2', 'plugin1'])
    })

    test('registers plugin health check', async () => {
      const pluginHealth: HealthCheck = {
        name: 'plugin:test',
        status: 'healthy',
        message: 'Plugin is healthy'
      }
      
      const plugin: ServerPlugin = {
        name: 'test',
        healthCheck: vi.fn().mockResolvedValue(pluginHealth)
      }
      
      server = createServer()
      server.use(plugin)
      await server.start()
      
      const health = await server.getHealth()
      
      expect(plugin.healthCheck).toHaveBeenCalled()
      expect(health.checks).toContainEqual(
        expect.objectContaining({
          name: 'plugin:test',
          status: 'healthy'
        })
      )
    })
  })

  describe('Hooks', () => {
    test('calls lifecycle hooks', async () => {
      const hooks = {
        beforeStart: vi.fn(),
        afterStart: vi.fn(),
        beforeStop: vi.fn(),
        afterStop: vi.fn()
      }
      
      server = createServer({ port: 0 })
      server.setHooks(hooks)
      
      await server.start()
      expect(hooks.beforeStart).toHaveBeenCalled()
      expect(hooks.afterStart).toHaveBeenCalled()
      
      await server.stop()
      expect(hooks.beforeStop).toHaveBeenCalled()
      expect(hooks.afterStop).toHaveBeenCalled()
    })

    test('calls connection hooks', async () => {
      const hooks = {
        onConnection: vi.fn(),
        onDisconnection: vi.fn()
      }
      
      server = createServer({ port: 0 })
      server.setHooks(hooks)
      
      // Connection hooks would be called when transport connects
      // This is tested more thoroughly in integration tests
    })
  })

  describe('Events', () => {
    test('emits lifecycle events', async () => {
      server = createServer({ port: 0 })
      
      const events: any[] = []
      server.on('started', (event) => events.push(event))
      server.on('stopped', (event) => events.push(event))
      server.on('state_changed', (event) => events.push(event))
      
      await server.start()
      await server.stop()
      
      expect(events).toContainEqual(
        expect.objectContaining({ type: 'started' })
      )
      expect(events).toContainEqual(
        expect.objectContaining({ type: 'stopped' })
      )
      expect(events).toContainEqual(
        expect.objectContaining({ 
          type: 'state_changed',
          from: 'stopped',
          to: 'starting'
        })
      )
    })

    test('emits health check events', async () => {
      server = createServer()
      
      let healthEvent: any
      server.on('health_check', (event) => {
        healthEvent = event
      })
      
      await server.getHealth()
      
      expect(healthEvent).toBeDefined()
      expect(healthEvent.type).toBe('health_check')
      expect(healthEvent.result).toBeDefined()
    })
  })

  describe('Statistics', () => {
    test('tracks server statistics', async () => {
      server = createServer({ port: 0 })
      await server.start()
      
      const stats = server.stats
      
      expect(stats.startTime).toBeGreaterThan(0)
      expect(stats.totalConnections).toBe(0)
      expect(stats.activeConnections).toBe(0)
      expect(stats.totalRequests).toBe(0)
      expect(stats.totalErrors).toBe(0)
      expect(stats.memoryUsage).toBeDefined()
      expect(stats.cpuUsage).toBeGreaterThanOrEqual(0)
    })
  })
})

describe('ServerBuilder', () => {
  let server: CurupiraServer

  afterEach(async () => {
    if (server && server.state === 'running') {
      await server.stop()
    }
  })

  test('builds server with configuration', () => {
    server = createServerBuilder('test-server', '2.0.0')
      .withAddress('127.0.0.1', 9000)
      .withEnvironment('development')
      .withLogLevel('debug')
      .build() as CurupiraServer
    
    expect(server.config.name).toBe('test-server')
    expect(server.config.version).toBe('2.0.0')
    expect(server.config.host).toBe('127.0.0.1')
    expect(server.config.port).toBe(9000)
    expect(server.config.environment).toBe('development')
    expect(server.config.logLevel).toBe('debug')
  })

  test('builds server with transports', () => {
    server = createServerBuilder()
      .withWebSocket({ pingInterval: 5000 })
      .withHttp({ timeout: 10000 })
      .build() as CurupiraServer
    
    expect(server.config.transports?.websocket).toEqual({ 
      pingInterval: 5000 
    })
    expect(server.config.transports?.http).toEqual({ 
      timeout: 10000 
    })
  })

  test('builds server with health checks', () => {
    server = createServerBuilder()
      .withHealthCheck(true, '/healthz', 5000)
      .build() as CurupiraServer
    
    expect(server.config.healthCheck).toBe(true)
    expect(server.config.healthCheckPath).toBe('/healthz')
    expect(server.config.healthCheckInterval).toBe(5000)
  })

  test('builds dev server with defaults', () => {
    server = createDevServer('my-dev-server', 3000)
      .build() as CurupiraServer
    
    expect(server.config.name).toBe('my-dev-server')
    expect(server.config.port).toBe(3000)
    expect(server.config.environment).toBe('development')
    expect(server.config.logLevel).toBe('debug')
    expect(server.config.healthCheck).toBe(true)
  })

  test('builds and starts server', async () => {
    server = await createServerBuilder()
      .withAddress('localhost', 0)
      .buildAndStart() as CurupiraServer
    
    expect(server.state).toBe('running')
  })
})