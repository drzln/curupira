/**
 * Curupira MCP Server - Refactored with Dependency Injection
 * Main server implementation using clean architecture
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

import type { Container } from '../core/di/container.js';
import type { ILogger } from '../core/interfaces/logger.interface.js';
import type { IChromeService } from '../core/interfaces/chrome-service.interface.js';
import type { IToolRegistry } from '../core/interfaces/tool-registry.interface.js';
import type { IResourceRegistry } from '../core/interfaces/resource-registry.interface.js';
import type { ServerConfig } from '../core/di/tokens.js';

import {
  ChromeServiceToken,
  ToolRegistryToken,
  ResourceRegistryToken,
  LoggerToken,
  ServerConfigToken
} from '../core/di/tokens.js';

import { TransportManager, type TransportType } from './transport.js';
import { HealthChecker } from './health.js';
import { SecurityManager } from '../security/index.js';
import { promptHandlers } from '../mcp/prompts/index.js';

export class CurupiraServer {
  private server: Server;
  private transportManager?: TransportManager;
  private healthChecker: HealthChecker;
  private securityManager: SecurityManager;
  
  private readonly logger: ILogger;
  private readonly chromeService: IChromeService;
  private readonly toolRegistry: IToolRegistry;
  private readonly resourceRegistry: IResourceRegistry;
  private readonly config: ServerConfig;

  constructor(private readonly container: Container) {
    // Resolve dependencies from container
    this.logger = container.resolve(LoggerToken);
    this.chromeService = container.resolve(ChromeServiceToken);
    this.toolRegistry = container.resolve(ToolRegistryToken);
    this.resourceRegistry = container.resolve(ResourceRegistryToken);
    this.config = container.resolve(ServerConfigToken);

    // Initialize MCP server
    this.server = new Server(
      {
        name: 'curupira-debug',
        version: '1.1.3',
      },
      {
        capabilities: {
          resources: {
            list: true,
            read: true,
            subscribe: false,
          },
          tools: {
            list: true,
            call: true,
          },
          prompts: {
            list: true,
            get: true,
          },
        },
      }
    );

    // Initialize health checker with Chrome service
    this.healthChecker = new HealthChecker(this.chromeService);
    
    // Initialize security manager
    const environment = process.env.NODE_ENV === 'production' ? 'production' :
                       process.env.NODE_ENV === 'staging' ? 'staging' : 'development';
    
    this.securityManager = new SecurityManager({
      enabled: environment !== 'development',
      environment,
      auth: {
        enabled: environment !== 'development',
        jwtSecret: process.env.CURUPIRA_JWT_SECRET,
        jwtPublicKey: process.env.CURUPIRA_JWT_PUBLIC_KEY,
        issuer: process.env.CURUPIRA_JWT_ISSUER,
        audience: process.env.CURUPIRA_JWT_AUDIENCE,
      },
    });
  }

  /**
   * Initialize and start the server
   */
  async start(): Promise<void> {
    try {
      this.logger.info({ config: this.config }, 'Starting Curupira MCP server');

      // Setup request handlers
      this.setupRequestHandlers();

      // Initialize transport based on configuration
      const transportType = process.env.CURUPIRA_TRANSPORT || 'stdio';
      
      if (transportType !== 'stdio') {
        const port = process.env.CURUPIRA_PORT ? parseInt(process.env.CURUPIRA_PORT) : this.config.port;
        this.transportManager = new TransportManager(
          this.server,
          {
            type: transportType as TransportType,
            port,
            corsOrigins: process.env.CURUPIRA_CORS_ORIGINS?.split(',') || ['http://localhost:*'],
            enableSSE: process.env.CURUPIRA_ENABLE_SSE !== 'false',
            enableWS: process.env.CURUPIRA_ENABLE_WS !== 'false',
            healthChecker: this.healthChecker,
            securityManager: this.securityManager
          },
          this.logger
        );
        
        const serverUrl = await this.transportManager.start();
        this.logger.info({ url: serverUrl, transport: transportType }, 'Server started');
      } else {
        // Use stdio transport for standard MCP
        const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        this.logger.info('Server started with stdio transport');
      }

      // Setup graceful shutdown
      this.setupShutdownHandlers();
      
    } catch (error) {
      this.logger.error({ error }, 'Failed to start server');
      throw error;
    }
  }

  /**
   * Setup all request handlers
   */
  private setupRequestHandlers(): void {
    // Resources handlers
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      try {
        const resources = await this.resourceRegistry.listAllResources();
        return { resources };
      } catch (error) {
        this.logger.error({ error }, 'Failed to list resources');
        throw error;
      }
    });

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      try {
        const content = await this.resourceRegistry.readResource(request.params.uri);
        return {
          contents: [{
            uri: request.params.uri,
            mimeType: 'application/json',
            text: JSON.stringify(content, null, 2)
          }]
        };
      } catch (error) {
        this.logger.error({ error, uri: request.params.uri }, 'Failed to read resource');
        throw error;
      }
    });

    // Tools handlers
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      try {
        const tools = this.toolRegistry.listAllTools();
        this.logger.debug({ toolCount: tools.length }, 'Listing tools');
        return { tools };
      } catch (error) {
        this.logger.error({ error }, 'Failed to list tools');
        throw error;
      }
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        this.logger.info({ tool: name, args }, 'Executing tool');
        const result = await this.toolRegistry.executeTool(name, args || {});
        
        if (!result.success) {
          this.logger.error({ tool: name, error: result.error }, 'Tool execution failed');
          throw new Error(result.error || 'Tool execution failed');
        }
        
        this.logger.info({ tool: name }, 'Tool executed successfully');
        
        // MCP expects the tool result data directly, not wrapped
        return result.data || {};
      } catch (error) {
        this.logger.error({ error, tool: name }, 'Tool execution error');
        throw error;
      }
    });

    // Prompts handlers
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      const prompts = promptHandlers.map((p: any) => p.metadata);
      return { prompts };
    });

    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const handler = promptHandlers.find((p: any) => p.metadata.name === request.params.name);
      
      if (!handler) {
        throw new Error(`Unknown prompt: ${request.params.name}`);
      }
      
      return handler.handler(request.params.arguments || {});
    });

    this.logger.info('All request handlers registered');
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupShutdownHandlers(): void {
    const shutdown = async () => {
      this.logger.info('Shutting down server...');
      
      try {
        // Disconnect from Chrome
        await this.chromeService.disconnect();
        
        // Stop transport if running
        if (this.transportManager) {
          await this.transportManager.stop();
        }
        
        this.logger.info('Server shutdown complete');
        process.exit(0);
      } catch (error) {
        this.logger.error({ error }, 'Error during shutdown');
        process.exit(1);
      }
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }

  /**
   * Get the server instance (for testing)
   */
  getServer(): Server {
    return this.server;
  }

  /**
   * Get the container (for testing)
   */
  getContainer(): Container {
    return this.container;
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    this.logger.info('Stopping Curupira server...');
    
    if (this.transportManager) {
      await this.transportManager.stop();
    }
    
    // Disconnect Chrome
    await this.chromeService.disconnect();
    
    this.logger.info('Curupira server stopped');
  }
}

// Export types needed by CLI
export type { ServerConfig } from '../core/di/tokens.js';

export interface ServerOptions {
  host?: string;
  port?: number;
  logLevel?: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  chrome?: {
    host?: string;
    port?: number;
  };
}