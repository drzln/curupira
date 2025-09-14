import type { WebSocket } from 'ws'
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import { logger } from '../config/logger.js'

export class WebSocketTransport implements Transport {
  private messageHandlers = new Set<(message: any) => void>()
  private closeHandlers = new Set<() => void>()
  private errorHandlers = new Set<(error: Error) => void>()

  constructor(private socket: WebSocket) {
    this.socket.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString())
        logger.debug({ message }, 'Received MCP message')
        
        for (const handler of this.messageHandlers) {
          handler(message)
        }
      } catch (error) {
        logger.error({ error, data: data.toString() }, 'Failed to parse message')
      }
    })

    this.socket.on('close', () => {
      logger.info('WebSocket closed')
      for (const handler of this.closeHandlers) {
        handler()
      }
    })

    this.socket.on('error', (error) => {
      logger.error({ error }, 'WebSocket error')
      for (const handler of this.errorHandlers) {
        handler(error)
      }
    })
  }

  async send(message: any): Promise<void> {
    if (this.socket.readyState !== this.socket.OPEN) {
      throw new Error('WebSocket is not open')
    }

    const data = JSON.stringify(message)
    logger.debug({ message }, 'Sending MCP message')
    
    return new Promise((resolve, reject) => {
      this.socket.send(data, (error) => {
        if (error) {
          logger.error({ error }, 'Failed to send message')
          reject(error)
        } else {
          resolve()
        }
      })
    })
  }

  onMessage(handler: (message: any) => void): void {
    this.messageHandlers.add(handler)
  }

  onClose(handler: () => void): void {
    this.closeHandlers.add(handler)
  }

  onError(handler: (error: Error) => void): void {
    this.errorHandlers.add(handler)
  }

  async close(): Promise<void> {
    this.socket.close()
  }

  async start(): Promise<void> {
    // WebSocket is already connected when passed to constructor
    // Nothing to do here
  }
}