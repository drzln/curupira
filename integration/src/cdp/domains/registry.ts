/**
 * @fileoverview CDP domain registry implementation
 */

import type { 
  CdpDomain, 
  CdpDomainRegistry 
} from '../types.js'
import type { SessionId } from '@curupira/shared'

/**
 * Domain registry implementation
 */
export class CdpDomainRegistryImpl implements CdpDomainRegistry {
  private readonly domains = new Map<string, CdpDomain>()
  private readonly client: any // CdpClient to avoid circular dep

  constructor(client: any) {
    this.client = client
  }

  /**
   * Register domain
   */
  register(domain: CdpDomain): void {
    this.domains.set(domain.name, domain)
  }

  /**
   * Get domain
   */
  get(name: string): CdpDomain | undefined {
    return this.domains.get(name)
  }

  /**
   * Get all domains
   */
  getAll(): CdpDomain[] {
    return Array.from(this.domains.values())
  }

  /**
   * Enable domains
   */
  async enableDomains(names: string[], sessionId?: SessionId): Promise<void> {
    const promises = names.map(name => {
      const domain = this.domains.get(name)
      return domain?.enable(sessionId)
    })
    
    await Promise.all(promises)
  }

  /**
   * Disable domains
   */
  async disableDomains(names: string[], sessionId?: SessionId): Promise<void> {
    const promises = names.map(name => {
      const domain = this.domains.get(name)
      return domain?.disable(sessionId)
    })
    
    await Promise.all(promises)
  }
}