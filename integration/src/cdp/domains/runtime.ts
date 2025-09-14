/**
 * @fileoverview Runtime domain implementation
 */

import type { CdpDomain } from '../types.js'
import type { SessionId } from '@curupira/shared'

/**
 * Runtime domain
 */
export class RuntimeDomain implements CdpDomain {
  name = 'Runtime'
  private enabled = new Set<SessionId | 'main'>()
  private client: any

  constructor(client: any) {
    this.client = client
  }

  async enable(sessionId?: SessionId): Promise<void> {
    const key = sessionId || 'main'
    if (this.enabled.has(key)) return
    
    await this.client.send({
      method: 'Runtime.enable',
      sessionId
    })
    
    this.enabled.add(key)
  }

  async disable(sessionId?: SessionId): Promise<void> {
    const key = sessionId || 'main'
    if (!this.enabled.has(key)) return
    
    await this.client.send({
      method: 'Runtime.disable',
      sessionId
    })
    
    this.enabled.delete(key)
  }

  isEnabled(sessionId?: SessionId): boolean {
    const key = sessionId || 'main'
    return this.enabled.has(key)
  }
}