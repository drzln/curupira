/**
 * @fileoverview CDP client tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CdpClient, createCdpClient } from './client.js'
import type { CdpClientConfig } from './types.js'

// Mock chrome-remote-interface
vi.mock('chrome-remote-interface', () => {
  return {
    default: vi.fn(() => Promise.resolve({
      send: vi.fn().mockResolvedValue({}),
      on: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined)
    }))
  }
})

describe('CdpClient', () => {
  let client: CdpClient
  const config: CdpClientConfig = {
    connection: {
      host: 'localhost',
      port: 9222
    }
  }

  beforeEach(() => {
    client = createCdpClient(config)
  })

  describe('Core functionality', () => {
    it('should create client instance', () => {
      expect(client).toBeInstanceOf(CdpClient)
      expect(client.getConnectionState()).toBe('disconnected')
    })

    it('should connect to Chrome', async () => {
      await client.connect()
      expect(client.getConnectionState()).toBe('connected')
    })

    it('should send commands', async () => {
      await client.connect()
      
      const result = await client.send({
        method: 'Runtime.evaluate',
        params: { expression: '1 + 1' }
      })
      
      expect(result).toBeDefined()
    })

    it('should manage event buffer', () => {
      expect(client.getEventBuffer()).toHaveLength(0)
      
      client.clearEventBuffer()
      expect(client.getEventBuffer()).toHaveLength(0)
    })

    it('should get domain registry', () => {
      const domains = client.getDomains()
      expect(domains).toBeDefined()
      expect(domains.getAll).toBeDefined()
    })

    it('should disconnect gracefully', async () => {
      await client.connect()
      await client.disconnect()
      expect(client.getConnectionState()).toBe('disconnected')
    })
  })
})