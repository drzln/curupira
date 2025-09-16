/**
 * Resource Types - Level 2 (MCP Core)
 * Type definitions for resource handling
 */

export interface ResourceHandler {
  uri: string;
  name: string;
  description?: string;
  read(): Promise<ResourceContent>;
}

export interface ResourceContent {
  uri: string;
  mimeType?: string;
  text?: string;
  data?: any;
}