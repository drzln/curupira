import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { EventEmitter } from 'events'

/**
 * HTTP/SSE Transport for MCP
 * Implements the Transport interface for HTTP POST requests and SSE responses
 */
export class HttpSseTransport extends EventEmitter implements Transport {
  private messageQueue: JSONRPCMessage[] = []
  private sseReply: FastifyReply | null = null
  private closed = false

  constructor() {
    super()
  }

  /**
   * Start the transport (no-op for HTTP/SSE)
   */
  async start(): Promise<void> {
    // No-op for HTTP/SSE
  }

  /**
   * Send a message (queue it for SSE delivery)
   */
  async send(message: JSONRPCMessage): Promise<void> {
    if (this.closed) {
      throw new Error('Transport is closed')
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
    if (this.sseReply && !this.sseReply.raw.destroyed) {
      this.sseReply.raw.end()
    }
    this.emit('close')
  }

  /**
   * Handle incoming HTTP request
   */
  handleHttpRequest(message: JSONRPCMessage): void {
    if (!this.closed) {
      this.emit('message', message)
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
      if (!this.closed) {
        this.emit('error', new Error('SSE connection closed'))
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