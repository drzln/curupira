/**
 * Tool Registry Interface - Level 0 (Foundation)
 * Defines the contract for MCP tool management
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { ToolResult, ToolHandler, ToolProvider } from '../../mcp/tools/registry.js';

export interface IToolRegistry {
  /**
   * Register a tool provider
   * @param provider The tool provider to register
   */
  register(provider: ToolProvider): void;

  /**
   * List all available tools
   * @returns Array of tool definitions
   */
  listAllTools(): Tool[];

  /**
   * Execute a tool by name
   * @param name The tool name
   * @param args The tool arguments
   * @returns The tool execution result
   */
  executeTool(name: string, args: Record<string, unknown>): Promise<ToolResult>;

  /**
   * Get all registered providers
   * @returns Array of tool providers
   */
  getProviders(): ToolProvider[];

  /**
   * Get a specific tool handler by name
   * @param name The tool name
   * @returns The tool handler or undefined if not found
   */
  getHandler(name: string): ToolHandler | undefined;
}