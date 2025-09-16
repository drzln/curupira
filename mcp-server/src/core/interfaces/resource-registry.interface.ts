/**
 * Resource Registry Interface - Level 0 (Foundation)
 * Defines the contract for MCP resource management
 */

import type { Resource } from '@modelcontextprotocol/sdk/types.js';
import type { ResourceHandler, ResourceProvider, ResourceContent } from '../../mcp/resources/registry.js';

export interface IResourceRegistry {
  /**
   * Register a resource provider
   * @param provider The resource provider to register
   */
  register(provider: ResourceProvider): void;

  /**
   * List all available resources
   * @returns Array of resource definitions
   */
  listAllResources(): Promise<Resource[]>;

  /**
   * Read a resource by URI
   * @param uri The resource URI
   * @returns The resource content
   */
  readResource(uri: string): Promise<ResourceContent>;

  /**
   * Get all registered providers
   * @returns Array of resource providers
   */
  getProviders(): ResourceProvider[];

  /**
   * Get a specific resource handler by URI
   * @param uri The resource URI
   * @returns The resource handler or undefined if not found
   */
  getHandler(uri: string): ResourceHandler | undefined;
}