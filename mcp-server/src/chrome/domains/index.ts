/**
 * CDP Domain wrappers index
 * 
 * Re-exports all domain wrappers for easy access
 */

export { RuntimeDomain } from './runtime.js'
export { DOMDomain } from './dom.js'
export { NetworkDomain } from './network.js'
export { PageDomain } from './page.js'

// Domain manager for organizing all domains
import type { ChromeClient } from '../client.js'
import { RuntimeDomain } from './runtime.js'
import { DOMDomain } from './dom.js'
import { NetworkDomain } from './network.js'
import { PageDomain } from './page.js'

export class CDPDomains {
  public readonly runtime: RuntimeDomain
  public readonly dom: DOMDomain
  public readonly network: NetworkDomain
  public readonly page: PageDomain

  constructor(
    private client: ChromeClient,
    private sessionId: string
  ) {
    this.runtime = new RuntimeDomain(client, sessionId)
    this.dom = new DOMDomain(client, sessionId)
    this.network = new NetworkDomain(client, sessionId)
    this.page = new PageDomain(client, sessionId)
  }

  /**
   * Enable all core domains
   */
  async enableAll(): Promise<void> {
    await Promise.all([
      this.runtime.enable(),
      this.dom.enable(),
      this.network.enable(),
      this.page.enable()
    ])
  }

  /**
   * Disable all domains
   */
  async disableAll(): Promise<void> {
    await Promise.all([
      this.runtime.disable(),
      this.dom.disable(),
      this.network.disable(),
      this.page.disable()
    ])
  }
}