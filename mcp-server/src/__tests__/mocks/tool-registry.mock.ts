/**
 * Mock Tool Registry - Test Infrastructure
 * Mock implementation of IToolRegistry for testing
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { IToolRegistry } from '../../core/interfaces/tool-registry.interface.js';
import type { ToolResult, ToolHandler, ToolProvider } from '../../mcp/tools/registry.js';

export class MockToolRegistry implements IToolRegistry {
  private providers: Map<string, ToolProvider> = new Map();
  private tools: Map<string, ToolHandler> = new Map();
  private executionResults: Map<string, ToolResult> = new Map();

  register(provider: ToolProvider): void {
    this.providers.set(provider.name, provider);
    
    // Register tools from provider
    const tools = provider.listTools();
    for (const tool of tools) {
      const handler = provider.getHandler(tool.name);
      if (handler) {
        this.tools.set(tool.name, handler);
      }
    }
  }

  listAllTools(): Tool[] {
    const allTools: Tool[] = [];
    for (const provider of this.providers.values()) {
      allTools.push(...provider.listTools());
    }
    return allTools;
  }

  async executeTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    // Check for mock result
    if (this.executionResults.has(name)) {
      return this.executionResults.get(name)!;
    }

    // Check for actual handler
    const handler = this.tools.get(name);
    if (!handler) {
      return {
        success: false,
        error: `Unknown tool: ${name}`
      };
    }

    try {
      return await handler.execute(args);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Tool execution failed'
      };
    }
  }

  getProviders(): ToolProvider[] {
    return Array.from(this.providers.values());
  }

  getHandler(name: string): ToolHandler | undefined {
    return this.tools.get(name);
  }

  // Test helper methods
  setExecutionResult(toolName: string, result: ToolResult): void {
    this.executionResults.set(toolName, result);
  }

  hasProvider(name: string): boolean {
    return this.providers.has(name);
  }

  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  reset(): void {
    this.providers.clear();
    this.tools.clear();
    this.executionResults.clear();
  }
}