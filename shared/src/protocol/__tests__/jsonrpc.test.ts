/**
 * @fileoverview Tests for JSON-RPC protocol implementation
 */

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { JsonRpcProtocol, createJsonRpcProtocol } from '../jsonrpc'
import type { 
  JsonRpcRequest, 
  JsonRpcResponse, 
  JsonRpcNotification,
  RequestHandler,
  NotificationHandler,
  RequestContext 
} from '../types'
import { createJsonRpcId } from '../../types'

describe('JsonRpcProtocol', () => {
  let protocol: JsonRpcProtocol

  beforeEach(() => {
    protocol = createJsonRpcProtocol()
  })

  describe('Handler Registration', () => {
    test('registers request handler', () => {
      const handler: RequestHandler = vi.fn()
      protocol.registerHandler('test.method', handler)
      
      expect(() => {
        protocol.registerHandler('test.method', handler)
      }).toThrow('already registered')
    })

    test('unregisters request handler', () => {
      const handler: RequestHandler = vi.fn()
      protocol.registerHandler('test.method', handler)
      protocol.unregisterHandler('test.method')
      
      // Should be able to register again
      expect(() => {
        protocol.registerHandler('test.method', handler)
      }).not.toThrow()
    })

    test('registers notification handler', () => {
      const handler: NotificationHandler = vi.fn()
      protocol.registerNotificationHandler('test.notify', handler)
      
      expect(() => {
        protocol.registerNotificationHandler('test.notify', handler)
      }).toThrow('already registered')
    })
  })

  describe('Request Handling', () => {
    test('handles request with registered handler', async () => {
      const handler = vi.fn().mockResolvedValue({ result: 'success' })
      protocol.registerHandler('test.method', handler)

      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: createJsonRpcId(),
        method: 'test.method',
        params: { value: 42 }
      }

      let response: JsonRpcResponse | undefined
      protocol.on('send', (msg) => {
        response = msg as JsonRpcResponse
      })

      await protocol.handleMessage(request)

      expect(handler).toHaveBeenCalledWith(
        { value: 42 },
        expect.objectContaining({
          requestId: request.id,
          method: 'test.method'
        })
      )

      expect(response).toEqual({
        jsonrpc: '2.0',
        id: request.id,
        result: { result: 'success' }
      })
    })

    test('returns method not found for unknown method', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: createJsonRpcId(),
        method: 'unknown.method',
        params: {}
      }

      let response: JsonRpcResponse | undefined
      protocol.on('send', (msg) => {
        response = msg as JsonRpcResponse
      })

      await protocol.handleMessage(request)

      expect(response).toEqual({
        jsonrpc: '2.0',
        id: request.id,
        error: expect.objectContaining({
          code: -32601,
          message: expect.stringContaining('Method not found')
        })
      })
    })

    test('handles handler errors', async () => {
      const handler = vi.fn().mockRejectedValue(new Error('Handler error'))
      protocol.registerHandler('test.method', handler)

      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: createJsonRpcId(),
        method: 'test.method'
      }

      let response: JsonRpcResponse | undefined
      protocol.on('send', (msg) => {
        response = msg as JsonRpcResponse
      })

      await protocol.handleMessage(request)

      expect(response).toEqual({
        jsonrpc: '2.0',
        id: request.id,
        error: expect.objectContaining({
          code: -32603,
          message: 'Handler error'
        })
      })
    })
  })

  describe('Notification Handling', () => {
    test('handles notification with registered handler', async () => {
      const handler = vi.fn()
      protocol.registerNotificationHandler('test.notify', handler)

      const notification: JsonRpcNotification = {
        jsonrpc: '2.0',
        method: 'test.notify',
        params: { data: 'test' }
      }

      await protocol.handleMessage(notification)

      expect(handler).toHaveBeenCalledWith(
        { data: 'test' },
        expect.any(Object)
      )
    })

    test('ignores notification without handler in strict mode', async () => {
      const notification: JsonRpcNotification = {
        jsonrpc: '2.0',
        method: 'unknown.notify'
      }

      // Should not throw
      await expect(
        protocol.handleMessage(notification)
      ).resolves.not.toThrow()
    })
  })

  describe('Client Methods', () => {
    test('sends request and waits for response', async () => {
      let sentMessage: JsonRpcRequest | undefined
      protocol.on('send', (msg) => {
        sentMessage = msg as JsonRpcRequest
      })

      const requestPromise = protocol.request('test.method', { value: 42 })

      // Simulate response
      setTimeout(() => {
        if (sentMessage) {
          const response: JsonRpcResponse = {
            jsonrpc: '2.0',
            id: sentMessage.id,
            result: { success: true }
          }
          protocol.handleMessage(response)
        }
      }, 10)

      const result = await requestPromise
      expect(result).toEqual({ success: true })
      expect(protocol.stats.requestsSent).toBe(1)
      expect(protocol.stats.responsesReceived).toBe(1)
    })

    test('sends notification', async () => {
      let sentMessage: JsonRpcNotification | undefined
      protocol.on('send', (msg) => {
        sentMessage = msg as JsonRpcNotification
      })

      await protocol.notify('test.notify', { data: 'test' })

      expect(sentMessage).toEqual({
        jsonrpc: '2.0',
        method: 'test.notify',
        params: { data: 'test' }
      })
      expect(protocol.stats.notificationsSent).toBe(1)
    })

    test('handles request timeout', async () => {
      const shortTimeoutProtocol = createJsonRpcProtocol({
        requestTimeout: 50
      })

      await expect(
        shortTimeoutProtocol.request('test.method')
      ).rejects.toThrow('timed out')
    })

    test('cancels pending request', async () => {
      let requestId: any
      protocol.on('send', (msg: any) => {
        requestId = msg.id
      })

      const requestPromise = protocol.request('test.method')

      // Cancel after sending
      setTimeout(() => {
        if (requestId) {
          protocol.cancelRequest(requestId)
        }
      }, 10)

      await expect(requestPromise).rejects.toThrow('cancelled')
    })
  })

  describe('Batch Operations', () => {
    test('sends batch requests', async () => {
      let sentBatch: any
      protocol.on('send', (msg) => {
        sentBatch = msg
      })

      const batchPromise = protocol.batch([
        { method: 'method1', params: { a: 1 } },
        { method: 'method2', params: { b: 2 } },
        { method: 'notify', params: { c: 3 }, isNotification: true }
      ])

      expect(Array.isArray(sentBatch)).toBe(true)
      expect(sentBatch).toHaveLength(3)
      expect(sentBatch[2].id).toBeUndefined() // Notification has no ID

      // Simulate responses
      setTimeout(() => {
        const responses = sentBatch
          .filter((msg: any) => msg.id)
          .map((req: any) => ({
            jsonrpc: '2.0',
            id: req.id,
            result: { method: req.method }
          }))
        
        protocol.handleMessage(responses)
      }, 10)

      const results = await batchPromise
      expect(results).toHaveLength(3)
      expect(results[0]).toEqual({ method: 'method1' })
      expect(results[1]).toEqual({ method: 'method2' })
      expect(results[2]).toBeUndefined() // Notification result
    })

    test('rejects batch when batching disabled', async () => {
      const noBatchProtocol = createJsonRpcProtocol({ batching: false })
      
      await expect(
        noBatchProtocol.batch([{ method: 'test' }])
      ).rejects.toThrow('Batching is not enabled')
    })

    test('rejects oversized batch', async () => {
      const limitedProtocol = createJsonRpcProtocol({ maxBatchSize: 2 })
      
      await expect(
        limitedProtocol.batch([
          { method: 'test1' },
          { method: 'test2' },
          { method: 'test3' }
        ])
      ).rejects.toThrow('batch size')
    })
  })

  describe('Middleware', () => {
    test('applies request middleware', async () => {
      const middleware = {
        name: 'test',
        handleRequest: vi.fn(async (request, context, next) => {
          const result = await next()
          return { ...result, modified: true }
        })
      }

      protocol.use(middleware)

      const handler = vi.fn().mockResolvedValue({ original: true })
      protocol.registerHandler('test.method', handler)

      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: createJsonRpcId(),
        method: 'test.method'
      }

      let response: JsonRpcResponse | undefined
      protocol.on('send', (msg) => {
        response = msg as JsonRpcResponse
      })

      await protocol.handleMessage(request)

      expect(middleware.handleRequest).toHaveBeenCalled()
      expect(response?.result).toEqual({
        original: true,
        modified: true
      })
    })
  })

  describe('Statistics', () => {
    test('tracks protocol statistics', async () => {
      const handler = vi.fn().mockResolvedValue('ok')
      protocol.registerHandler('test', handler)

      // Send request
      await protocol.request('test')

      // Handle incoming request
      await protocol.handleMessage({
        jsonrpc: '2.0',
        id: createJsonRpcId(),
        method: 'test'
      })

      // Send notification
      await protocol.notify('test')

      const stats = protocol.stats
      expect(stats.requestsSent).toBeGreaterThan(0)
      expect(stats.requestsReceived).toBeGreaterThan(0)
      expect(stats.notificationsSent).toBeGreaterThan(0)
    })
  })

  describe('Protocol Capabilities', () => {
    test('reports correct capabilities', () => {
      const caps = protocol.capabilities
      expect(caps.batch).toBe(true)
      expect(caps.notifications).toBe(true)
      expect(caps.cancellation).toBe(true)
      expect(caps.progress).toBe(true)
      expect(caps.versions).toContain('2.0')
    })
  })
})