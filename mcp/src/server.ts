/**
 * @fileoverview MCP server implementation
 * 
 * This file provides the main MCP server that integrates
 * resources, tools, prompts, and protocol handlers.
 */

import type { 
  McpProtocol,
  WebSocketTransport,
  StorageStore,
  CdpClient
} from '@curupira/integration'
import { createLogger, type Logger } from '@curupira/shared'

// Resources
import { ResourceRegistryImpl } from './resources/registry.js'
import { ConsoleResourceHandler } from './resources/console.js'
import { NetworkResourceHandler } from './resources/network.js'
import { DomResourceHandler } from './resources/dom.js'
import { StorageResourceHandler } from './resources/storage.js'
import { StateResourceHandler } from './resources/state.js'

// Tools
import { ToolRegistryImpl } from './tools/registry.js'
import { NavigationTool } from './tools/navigation.js'
import { EvaluationTool } from './tools/evaluation.js'
import { 
  ClickTool, 
  TypeTool, 
  ScreenshotTool 
} from './tools/interaction.js'
import { 
  BreakpointTool,
  ConsoleClearTool,
  PauseTool,
  ResumeTool
} from './tools/debugging.js'

// Prompts
import { PromptRegistryImpl } from './prompts/registry.js'
import { DebugErrorPrompt, MemoryLeakPrompt } from './prompts/debugging.js'
import { ReactComponentPrompt, ReactHooksPrompt } from './prompts/react.js'
import { PerformanceAnalysisPrompt, RenderPerformancePrompt } from './prompts/performance.js'

// Handlers
import {
  createResourceListHandler,
  createResourceReadHandler,
  createResourceSubscribeHandler,
  createResourceUnsubscribeHandler
} from './handlers/resources.js'
import {
  createToolListHandler,
  createToolCallHandler
} from './handlers/tools.js'
import {
  createPromptListHandler,
  createPromptGetHandler
} from './handlers/prompts.js'

/**
 * MCP server configuration
 */
export interface McpServerConfig {
  /** Server name */
  name?: string
  /** Server version */
  version?: string
  /** Enable debug logging */
  debug?: boolean
}

/**
 * MCP server
 */
export class McpServer {
  private readonly logger: Logger
  private readonly resourceRegistry: ResourceRegistryImpl
  private readonly toolRegistry: ToolRegistryImpl
  private readonly promptRegistry: PromptRegistryImpl
  private protocol?: McpProtocol
  private cdpClient?: CdpClient
  private storage?: StorageStore

  constructor(
    private readonly config: McpServerConfig = {}
  ) {
    this.logger = createLogger({ 
      level: config.debug ? 'debug' : 'info' 
    })
    
    this.resourceRegistry = new ResourceRegistryImpl()
    this.toolRegistry = new ToolRegistryImpl()
    this.promptRegistry = new PromptRegistryImpl()
  }

  /**
   * Initialize server
   */
  async initialize(
    protocol: McpProtocol,
    cdpClient: CdpClient,
    storage: StorageStore
  ): Promise<void> {
    this.protocol = protocol
    this.cdpClient = cdpClient
    this.storage = storage
    
    // Register resources
    this.registerResources()
    
    // Register tools
    this.registerTools()
    
    // Register prompts
    this.registerPrompts()
    
    // Setup protocol handlers
    this.setupHandlers()
    
    this.logger.info('MCP server initialized')
  }

  /**
   * Register resources
   */
  private registerResources(): void {
    // Console resource
    this.resourceRegistry.register(
      new ConsoleResourceHandler(this.storage!)
    )
    
    // Network resource
    this.resourceRegistry.register(
      new NetworkResourceHandler(this.storage!)
    )
    
    // DOM resource
    this.resourceRegistry.register(
      new DomResourceHandler(this.cdpClient!)
    )
    
    // Storage resource
    this.resourceRegistry.register(
      new StorageResourceHandler(this.cdpClient!)
    )
    
    // State resource
    this.resourceRegistry.register(
      new StateResourceHandler(this.storage!)
    )
    
    this.logger.info('Resources registered')
  }

  /**
   * Register tools
   */
  private registerTools(): void {
    // Navigation
    this.toolRegistry.register(new NavigationTool(this.cdpClient!))
    
    // Evaluation
    this.toolRegistry.register(new EvaluationTool(this.cdpClient!))
    
    // Interaction
    this.toolRegistry.register(new ClickTool(this.cdpClient!))
    this.toolRegistry.register(new TypeTool(this.cdpClient!))
    this.toolRegistry.register(new ScreenshotTool(this.cdpClient!))
    
    // Debugging
    this.toolRegistry.register(new BreakpointTool(this.cdpClient!))
    this.toolRegistry.register(new ConsoleClearTool(this.cdpClient!))
    this.toolRegistry.register(new PauseTool(this.cdpClient!))
    this.toolRegistry.register(new ResumeTool(this.cdpClient!))
    
    this.logger.info('Tools registered')
  }

  /**
   * Register prompts
   */
  private registerPrompts(): void {
    // Debugging prompts
    this.promptRegistry.register(new DebugErrorPrompt())
    this.promptRegistry.register(new MemoryLeakPrompt())
    
    // React prompts
    this.promptRegistry.register(new ReactComponentPrompt())
    this.promptRegistry.register(new ReactHooksPrompt())
    
    // Performance prompts
    this.promptRegistry.register(new PerformanceAnalysisPrompt())
    this.promptRegistry.register(new RenderPerformancePrompt())
    
    this.logger.info('Prompts registered')
  }

  /**
   * Setup protocol handlers
   */
  private setupHandlers(): void {
    if (!this.protocol) {
      throw new Error('Protocol not initialized')
    }
    
    const context = {
      protocol: this.protocol,
      metadata: {}
    }
    
    // Resource handlers
    this.protocol.registerHandler(
      'resources/list',
      async (params: unknown) => createResourceListHandler(this.resourceRegistry)(params as any, context)
    )
    
    this.protocol.registerHandler(
      'resources/read',
      async (params: unknown) => createResourceReadHandler(this.resourceRegistry)(params as any, context)
    )
    
    this.protocol.registerHandler(
      'resources/subscribe',
      async (params: unknown) => createResourceSubscribeHandler(this.resourceRegistry)(params as any, context)
    )
    
    this.protocol.registerHandler(
      'resources/unsubscribe',
      async (params: unknown) => createResourceUnsubscribeHandler(this.resourceRegistry)(params as any, context)
    )
    
    // Tool handlers
    this.protocol.registerHandler(
      'tools/list',
      async (params: unknown) => createToolListHandler(this.toolRegistry)(params as any, context)
    )
    
    this.protocol.registerHandler(
      'tools/call',
      async (params: unknown) => createToolCallHandler(this.toolRegistry)(params as any, context)
    )
    
    // Prompt handlers
    this.protocol.registerHandler(
      'prompts/list',
      async (params: unknown) => createPromptListHandler(this.promptRegistry)(params as any, context)
    )
    
    this.protocol.registerHandler(
      'prompts/get',
      async (params: unknown) => createPromptGetHandler(this.promptRegistry)(params as any, context)
    )
    
    this.logger.info('Protocol handlers registered')
  }

  /**
   * Get server info
   */
  getServerInfo() {
    return {
      name: this.config.name || 'curupira-mcp',
      version: this.config.version || '1.0.0',
      protocolVersion: '1.0',
      capabilities: {
        resources: {
          subscribe: true,
          listChanged: true
        },
        tools: {},
        prompts: {},
        logging: {}
      }
    }
  }

  /**
   * Get resource registry
   */
  getResourceRegistry(): ResourceRegistryImpl {
    return this.resourceRegistry
  }

  /**
   * Get tool registry
   */
  getToolRegistry(): ToolRegistryImpl {
    return this.toolRegistry
  }

  /**
   * Get prompt registry
   */
  getPromptRegistry(): PromptRegistryImpl {
    return this.promptRegistry
  }
}

/**
 * Create MCP server
 */
export function createMcpServer(config?: McpServerConfig): McpServer {
  return new McpServer(config)
}