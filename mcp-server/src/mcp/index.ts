/**
 * MCP Index Shim - Temporary compatibility layer
 * @deprecated This file is no longer used. MCP setup is handled through DI in server/server.ts
 */

import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { logger } from '../config/logger.js';

export function setupMCPHandlers(server: Server): void {
  logger.warn('setupMCPHandlers is deprecated. MCP setup is now handled through dependency injection.');
}