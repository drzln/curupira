#!/usr/bin/env node
/**
 * Main executable entry point for Curupira MCP Server
 * Starts the server with dependency injection
 */

import { createApplicationContainer, registerToolProviders, registerResourceProviders } from './infrastructure/container/app.container.js';
import { CurupiraServer } from './server/server.js';
import type { ILogger } from './core/interfaces/logger.interface.js';
import { LoggerToken } from './core/di/tokens.js';

async function main() {
  let logger: ILogger | undefined;
  
  try {
    // Create and configure the DI container
    const container = createApplicationContainer();
    
    // Get logger from container
    logger = container.resolve(LoggerToken);
    logger.info('Initializing Curupira MCP server...');
    
    // Register all providers
    registerToolProviders(container);
    registerResourceProviders(container);
    
    // Create and start server
    const server = new CurupiraServer(container);
    await server.start();
    
  } catch (error) {
    if (logger) {
      logger.error({ error }, 'Failed to start server');
    } else {
      console.error('Failed to start server:', error);
    }
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
main().catch(console.error);