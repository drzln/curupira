import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { logger } from '../config/logger.js'

/**
 * HTTP/SSE Transport for MCP
 * Implements the Transport interface for HTTP POST requests and SSE responses
 */
export class HttpSseTransport implements Transport {
  private messageQueue: JSONRPCMessage[] = []
  private sseReply: FastifyReply | null = null
  private closed = false
  private pendingRequests = new Map<string | number, {
    resolve: (response: JSONRPCMessage) => void
    reject: (error: Error) => void
    timeout?: NodeJS.Timeout
  }>()

  // Transport callbacks - these will be set by the MCP server
  onmessage?: (message: JSONRPCMessage) => void
  onclose?: () => void
  onerror?: (error: Error) => void

  constructor() {
    // No need for EventEmitter
  }

  /**
   * Start the transport (no-op for HTTP/SSE)
   */
  async start(): Promise<void> {
    console.log('[HttpSseTransport] Transport started')
    // No-op for HTTP/SSE
  }

  /**
   * Send a message (queue it for SSE delivery or resolve pending request)
   */
  async send(message: JSONRPCMessage): Promise<void> {
    if (this.closed) {
      throw new Error('Transport is closed')
    }

    console.log('[HttpSseTransport] send() called with:', JSON.stringify(message))

    // Check if this is a response to a pending request
    if ('id' in message && message.id !== null && message.id !== undefined) {
      const pending = this.pendingRequests.get(message.id)
      console.log('[HttpSseTransport] Pending request found:', !!pending, 'for ID:', message.id)
      if (pending) {
        if (pending.timeout) {
          clearTimeout(pending.timeout)
        }
        this.pendingRequests.delete(message.id)
        pending.resolve(message)
        return
      }
    }

    // If we have an active SSE connection, send immediately
    if (this.sseReply && !this.sseReply.raw.destroyed) {
      this.sendSseMessage(message)
    } else {
      // Otherwise queue the message
      this.messageQueue.push(message)
    }
  }

  /**
   * Close the transport
   */
  async close(): Promise<void> {
    this.closed = true
    
    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests) {
      if (pending.timeout) {
        clearTimeout(pending.timeout)
      }
      pending.reject(new Error('Transport closed'))
    }
    this.pendingRequests.clear()
    
    if (this.sseReply && !this.sseReply.raw.destroyed) {
      this.sseReply.raw.end()
    }
    
    // Call the onclose callback if set
    if (this.onclose) {
      this.onclose()
    }
  }

  /**
   * Handle incoming HTTP request
   */
  handleHttpRequest(message: JSONRPCMessage): void {
    if (!this.closed && this.onmessage) {
      console.log('[HttpSseTransport] Calling onmessage callback with:', JSON.stringify(message))
      this.onmessage(message)
    }
  }

  /**
   * Handle incoming HTTP request and wait for response
   */
  async handleHttpRequestWithResponse(message: JSONRPCMessage, timeout: number = 30000): Promise<JSONRPCMessage> {
    if (this.closed) {
      throw new Error('Transport is closed')
    }

    // For requests that expect a response
    if ('id' in message && message.id !== null && message.id !== undefined) {
      return new Promise((resolve, reject) => {
        // Set up timeout
        const timeoutHandle = setTimeout(() => {
          this.pendingRequests.delete(message.id!)
          reject(new Error(`Request timeout after ${timeout}ms`))
        }, timeout)

        // Store the pending request
        this.pendingRequests.set(message.id!, {
          resolve,
          reject,
          timeout: timeoutHandle
        })

        // Call the onmessage callback to process the message by MCP server
        console.log('[HttpSseTransport] Calling onmessage callback with message:', JSON.stringify(message))
        if (this.onmessage) {
          this.onmessage(message)
        } else {
          console.error('[HttpSseTransport] No onmessage callback set!')
          reject(new Error('Transport not properly initialized'))
        }
      })
    } else {
      // For notifications (no response expected)
      if (this.onmessage) {
        this.onmessage(message)
      }
      return { jsonrpc: '2.0', id: 0, result: { status: 'accepted' } } as JSONRPCMessage
    }
  }

  /**
   * Set SSE reply stream
   */
  setSseReply(reply: FastifyReply): void {
    this.sseReply = reply

    // Send any queued messages
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()
      if (message) {
        this.sendSseMessage(message)
      }
    }

    // Handle client disconnect
    reply.raw.on('close', () => {
      this.sseReply = null
      if (!this.closed && this.onerror) {
        this.onerror(new Error('SSE connection closed'))
      }
    })
  }

  /**
   * Send message via SSE
   */
  private sendSseMessage(message: JSONRPCMessage): void {
    if (this.sseReply && !this.sseReply.raw.destroyed) {
      const data = JSON.stringify(message)
      this.sseReply.raw.write(`data: ${data}\n\n`)
    }
  }
}