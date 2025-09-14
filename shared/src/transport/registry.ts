/**
 * @fileoverview Transport registry and factory
 * 
 * This file provides a registry for transport implementations and
 * a factory for creating transport instances based on configuration.
 */

import type {
  Transport,
  TransportType,
  TransportConfig,
  WebSocketTransportConfig,
  HttpTransportConfig,
  TransportFactory,
  TransportRegistry
} from './types.js'
import { ValidationErrors } from '../errors/index.js'
import { WebSocketTransport } from './websocket.js'
import { HttpTransport } from './http.js'

/**
 * Default transport registry implementation
 */
class TransportRegistryImpl implements TransportRegistry {
  private factories = new Map<TransportType, TransportFactory>()

  constructor() {
    // Register built-in transports
    this.registerBuiltinTransports()
  }

  /**
   * Register a transport factory
   */
  register(type: TransportType, factory: TransportFactory): void {
    if (this.factories.has(type)) {
      throw ValidationErrors.invalidConfiguration(
        `Transport type '${type}' is already registered`
      )
    }

    this.factories.set(type, factory)
  }

  /**
   * Unregister a transport factory
   */
  unregister(type: TransportType): void {
    this.factories.delete(type)
  }

  /**
   * Create a transport instance
   */
  create(config: TransportConfig): Transport {
    const factory = this.factories.get(config.type)

    if (!factory) {
      throw ValidationErrors.invalidConfiguration(
        `Unknown transport type: ${config.type}. Available types: ${this.types().join(', ')}`
      )
    }

    return factory(config)
  }

  /**
   * Check if transport type is registered
   */
  has(type: TransportType): boolean {
    return this.factories.has(type)
  }

  /**
   * Get all registered transport types
   */
  types(): TransportType[] {
    return Array.from(this.factories.keys())
  }

  /**
   * Register built-in transport implementations
   */
  private registerBuiltinTransports(): void {
    // WebSocket transport
    this.register('websocket', (config) => {
      if (config.type !== 'websocket') {
        throw ValidationErrors.invalidConfiguration('Invalid config for WebSocket transport')
      }
      return new WebSocketTransport(config as WebSocketTransportConfig)
    })

    // HTTP transport
    this.register('http', (config) => {
      if (config.type !== 'http') {
        throw ValidationErrors.invalidConfiguration('Invalid config for HTTP transport')
      }
      return new HttpTransport(config as HttpTransportConfig)
    })

    // Placeholder for future transports
    // IPC and STDIO will be implemented when needed for desktop/CLI scenarios
  }
}

/**
 * Global transport registry instance
 */
export const transportRegistry: TransportRegistry = new TransportRegistryImpl()

/**
 * Create a transport instance using the global registry
 */
export function createTransport(config: TransportConfig): Transport {
  return transportRegistry.create(config)
}

/**
 * Register a custom transport implementation
 */
export function registerTransport(type: TransportType, factory: TransportFactory): void {
  transportRegistry.register(type, factory)
}

/**
 * Get available transport types
 */
export function getAvailableTransports(): TransportType[] {
  return transportRegistry.types()
}

/**
 * Transport connection manager for handling multiple transports
 */
export class TransportManager {
  private transports = new Map<string, Transport>()

  /**
   * Add a transport
   */
  async add(id: string, config: TransportConfig): Promise<Transport> {
    if (this.transports.has(id)) {
      throw ValidationErrors.invalidConfiguration(
        `Transport with id '${id}' already exists`
      )
    }

    const transport = createTransport(config)
    this.transports.set(id, transport)
    
    return transport
  }

  /**
   * Get a transport by ID
   */
  get(id: string): Transport | undefined {
    return this.transports.get(id)
  }

  /**
   * Remove a transport
   */
  async remove(id: string): Promise<void> {
    const transport = this.transports.get(id)
    if (transport) {
      await transport.destroy()
      this.transports.delete(id)
    }
  }

  /**
   * Connect all transports
   */
  async connectAll(): Promise<void> {
    const promises = Array.from(this.transports.values())
      .map(transport => transport.connect())
    
    await Promise.all(promises)
  }

  /**
   * Disconnect all transports
   */
  async disconnectAll(reason?: string): Promise<void> {
    const promises = Array.from(this.transports.values())
      .map(transport => transport.disconnect(reason))
    
    await Promise.all(promises)
  }

  /**
   * Get all transport IDs
   */
  ids(): string[] {
    return Array.from(this.transports.keys())
  }

  /**
   * Get all transports
   */
  all(): Transport[] {
    return Array.from(this.transports.values())
  }

  /**
   * Clear all transports
   */
  async clear(): Promise<void> {
    await this.disconnectAll('Clearing all transports')
    
    for (const transport of this.transports.values()) {
      await transport.destroy()
    }
    
    this.transports.clear()
  }
}