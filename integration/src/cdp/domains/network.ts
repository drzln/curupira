/**
 * @fileoverview Network domain implementation
 */

import type { CdpDomain } from '../types.js'
import type { SessionId } from '@curupira/shared'

/**
 * Network domain
 */
export class NetworkDomain implements CdpDomain {
  name = 'Network'
  private enabled = new Set<SessionId | 'main'>()
  private client: any

  constructor(client: any) {
    this.client = client
  }

  async enable(sessionId?: SessionId): Promise<void> {
    const key = sessionId || 'main'
    if (this.enabled.has(key)) return
    
    await this.client.send({
      method: 'Network.enable',
      sessionId
    })
    
    this.enabled.add(key)
  }

  async disable(sessionId?: SessionId): Promise<void> {
    const key = sessionId || 'main'
    if (!this.enabled.has(key)) return
    
    await this.client.send({
      method: 'Network.disable',
      sessionId
    })
    
    this.enabled.delete(key)
  }

  isEnabled(sessionId?: SessionId): boolean {
    const key = sessionId || 'main'
    return this.enabled.has(key)
  }
}