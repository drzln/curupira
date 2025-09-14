/**
 * @fileoverview Message router tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MessageRouter, createMessageRouter, createMessage } from './router.js'
import { createTypeHandler, createSourceHandler } from './handlers.js'
import type { Message, MessageRoutingConfig } from './types.js'

describe('MessageRouter', () => {
  let router: MessageRouter
  let config: MessageRoutingConfig
  let handlerMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    handlerMock = vi.fn()
    config = {
      routes: [
        {
          id: 'test-route',
          name: 'Test Route',
          type: 'mcp-request',
          handler: handlerMock
        }
      ]
    }
    router = createMessageRouter(config)
  })

  afterEach(() => {
    router.stop()
  })

  describe('Core functionality', () => {
    it('should create router instance', () => {
      expect(router).toBeInstanceOf(MessageRouter)
      expect(router.getRoutes()).toHaveLength(1)
    })

    it('should process matching messages', async () => {
      const message = createMessage('mcp-request', 'client', { test: true })
      
      await router.process(message)
      
      expect(handlerMock).toHaveBeenCalledWith(message)
    })

    it('should not process non-matching messages', async () => {
      const message = createMessage('cdp-event', 'browser', { test: true })
      
      await router.process(message)
      
      expect(handlerMock).not.toHaveBeenCalled()
    })

    it('should handle route management', () => {
      const newRoute = createTypeHandler('cdp-command', vi.fn())
      
      router.addRoute(newRoute)
      expect(router.getRoutes()).toHaveLength(2)
      
      router.removeRoute(newRoute.id)
      expect(router.getRoutes()).toHaveLength(1)
    })

    it('should track statistics', async () => {
      const message = createMessage('mcp-request', 'client', { test: true })
      
      await router.process(message)
      
      const stats = router.getStatistics()
      expect(stats.received).toBe(1)
      expect(stats.routed).toBe(1)
      expect(stats.byType['mcp-request']).toBe(1)
      expect(stats.bySource['client']).toBe(1)
    })

    it('should process batch messages', async () => {
      const messages = [
        createMessage('mcp-request', 'client', { id: 1 }),
        createMessage('mcp-request', 'client', { id: 2 }),
        createMessage('mcp-request', 'client', { id: 3 })
      ]
      
      await router.processBatch(messages)
      
      expect(handlerMock).toHaveBeenCalledTimes(3)
    })
  })

  describe('Advanced routing', () => {
    it('should support priority-based routing', async () => {
      const highPriorityHandler = vi.fn()
      const lowPriorityHandler = vi.fn()
      
      router.addRoute({
        id: 'high',
        name: 'High Priority',
        type: 'mcp-request',
        handler: highPriorityHandler,
        priority: 10
      })
      
      router.addRoute({
        id: 'low',
        name: 'Low Priority',
        type: 'mcp-request',
        handler: lowPriorityHandler,
        priority: 1
      })
      
      const message = createMessage('mcp-request', 'client', {})
      await router.process(message)
      
      expect(highPriorityHandler).toHaveBeenCalled()
      expect(lowPriorityHandler).not.toHaveBeenCalled()
    })

    it('should support source-based routing', async () => {
      const browserHandler = vi.fn()
      
      router.addRoute(createSourceHandler('browser', browserHandler))
      
      const clientMessage = createMessage('cdp-event', 'client', {})
      const browserMessage = createMessage('cdp-event', 'browser', {})
      
      await router.process(clientMessage)
      await router.process(browserMessage)
      
      expect(browserHandler).toHaveBeenCalledTimes(1)
      expect(browserHandler).toHaveBeenCalledWith(browserMessage)
    })
  })
})