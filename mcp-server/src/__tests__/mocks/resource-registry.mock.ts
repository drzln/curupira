/**
 * Mock Resource Registry - Test Infrastructure
 * Mock implementation of IResourceRegistry for testing
 */

import type { Resource } from '@modelcontextprotocol/sdk/types.js';
import type { IResourceRegistry } from '../../core/interfaces/resource-registry.interface.js';
import type { ResourceHandler, ResourceProvider, ResourceContent } from '../../mcp/resources/registry.js';

export class MockResourceRegistry implements IResourceRegistry {
  private providers: Map<string, ResourceProvider> = new Map();
  private resources: Map<string, Resource> = new Map();
  private resourceContent: Map<string, ResourceContent> = new Map();

  register(provider: ResourceProvider): void {
    this.providers.set(provider.name, provider);
  }

  async listAllResources(): Promise<Resource[]> {
    return Array.from(this.resources.values());
  }

  async readResource(uri: string): Promise<ResourceContent> {
    // Check for mock content
    if (this.resourceContent.has(uri)) {
      return this.resourceContent.get(uri)!;
    }

    // Try to read from provider
    const [providerName] = uri.split('/');
    const provider = this.providers.get(providerName);
    
    if (!provider) {
      throw new Error(`No provider registered for URI: ${uri}`);
    }

    try {
      const content = await provider.readResource(uri);
      return {
        uri,
        mimeType: 'text/plain',
        text: JSON.stringify(content)
      };
    } catch (error) {
      throw new Error(`Failed to read resource ${uri}: ${error}`);
    }
  }

  getProviders(): ResourceProvider[] {
    return Array.from(this.providers.values());
  }

  getHandler(uri: string): ResourceHandler | undefined {
    // Mock implementation - not used in tests typically
    return undefined;
  }

  // Test helper methods
  setResourceContent(uri: string, content: ResourceContent): void {
    this.resourceContent.set(uri, content);
  }

  hasProvider(name: string): boolean {
    return this.providers.has(name);
  }

  hasResource(uri: string): boolean {
    return this.resources.has(uri);
  }

  reset(): void {
    this.providers.clear();
    this.resources.clear();
    this.resourceContent.clear();
  }
}