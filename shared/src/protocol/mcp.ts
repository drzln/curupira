/**
 * @fileoverview MCP (Model Context Protocol) implementation
 * 
 * This file provides the MCP protocol implementation on top of JSON-RPC,
 * adding MCP-specific methods and lifecycle management.
 */

import { JsonRpcProtocol } from './jsonrpc.js'
import type {
  RequestHandler,
  NotificationHandler,
  RequestContext,
  ProtocolConfig,
  MCP
} from './types.js'
import type {
  Resource,
  ResourceContents,
  Tool,
  ToolCall,
  ToolResult,
  Prompt,
  PromptArgument,
  PromptMessage
} from '../types/index.js'
import { createResourceUri, createJsonRpcId } from '../types/index.js'
import { ProtocolErrors, ValidationErrors } from '../errors/index.js'
import type { Logger, LogLevel } from '../logging/index.js'
import { createLogger } from '../logging/index.js'

/**
 * MCP server state
 */
type McpState = 'uninitialized' | 'initializing' | 'initialized' | 'shutting_down' | 'shutdown'

/**
 * MCP protocol configuration
 */
export interface McpConfig extends ProtocolConfig {
  /** Server name */
  name: string
  /** Server version */
  version: string
  /** MCP capabilities */
  capabilities?: MCP.Capabilities
}

/**
 * MCP protocol implementation
 */
export class McpProtocol extends JsonRpcProtocol {
  private state: McpState = 'uninitialized'
  private readonly mcpConfig: McpConfig
  private readonly mcpLogger: Logger
  private clientCapabilities?: MCP.Capabilities

  // Resource handlers
  private readonly resources = new Map<string, Resource>()
  private resourceListHandler?: RequestHandler<void, Resource[]>
  private resourceReadHandler?: RequestHandler<{ uri: string }, ResourceContents>

  // Tool handlers
  private readonly tools = new Map<string, Tool>()
  private toolListHandler?: RequestHandler<void, Tool[]>
  private toolCallHandler?: RequestHandler<ToolCall, ToolResult>

  // Prompt handlers
  private readonly prompts = new Map<string, Prompt>()
  private promptListHandler?: RequestHandler<void, Prompt[]>
  private promptGetHandler?: RequestHandler<{ name: string; arguments?: Record<string, string> }, PromptMessage[]>

  constructor(config: McpConfig) {
    super(config)
    this.mcpConfig = config
    this.mcpLogger = createLogger({
      level: config.debug ? 'debug' : 'info'
      // SimpleLoggerConfig
    })

    // Register MCP-specific handlers
    this.registerMcpHandlers()
  }

  /**
   * Get current state
   */
  get currentState(): McpState {
    return this.state
  }

  /**
   * Get server capabilities
   */
  get serverCapabilities(): MCP.Capabilities {
    return {
      ...this.mcpConfig.capabilities,
      resources: this.resources.size > 0 || !!this.resourceListHandler,
      tools: this.tools.size > 0 || !!this.toolListHandler,
      prompts: this.prompts.size > 0 || !!this.promptListHandler,
      logging: true
    }
  }

  /**
   * Register a resource
   */
  registerResource(resource: Resource): void {
    this.resources.set(resource.uri, resource)
    this.mcpLogger.debug({ uri: resource.uri }, 'Registered resource')
  }

  /**
   * Register multiple resources
   */
  registerResources(resources: Resource[]): void {
    for (const resource of resources) {
      this.registerResource(resource)
    }
  }

  /**
   * Set dynamic resource list handler
   */
  setResourceListHandler(handler: RequestHandler<void, Resource[]>): void {
    this.resourceListHandler = handler
  }

  /**
   * Set resource read handler
   */
  setResourceReadHandler(
    handler: RequestHandler<{ uri: string }, ResourceContents>
  ): void {
    this.resourceReadHandler = handler
  }

  /**
   * Register a tool
   */
  registerTool(tool: Tool): void {
    this.tools.set(tool.name, tool)
    this.mcpLogger.debug({ name: tool.name }, 'Registered tool')
  }

  /**
   * Register multiple tools
   */
  registerTools(tools: Tool[]): void {
    for (const tool of tools) {
      this.registerTool(tool)
    }
  }

  /**
   * Set dynamic tool list handler
   */
  setToolListHandler(handler: RequestHandler<void, Tool[]>): void {
    this.toolListHandler = handler
  }

  /**
   * Set tool call handler
   */
  setToolCallHandler(handler: RequestHandler<ToolCall, ToolResult>): void {
    this.toolCallHandler = handler
  }

  /**
   * Register a prompt
   */
  registerPrompt(prompt: Prompt): void {
    this.prompts.set(prompt.name, prompt)
    this.mcpLogger.debug({ name: prompt.name }, 'Registered prompt')
  }

  /**
   * Register multiple prompts
   */
  registerPrompts(prompts: Prompt[]): void {
    for (const prompt of prompts) {
      this.registerPrompt(prompt)
    }
  }

  /**
   * Set dynamic prompt list handler
   */
  setPromptListHandler(handler: RequestHandler<void, Prompt[]>): void {
    this.promptListHandler = handler
  }

  /**
   * Set prompt get handler
   */
  setPromptGetHandler(
    handler: RequestHandler<
      { name: string; arguments?: Record<string, string> },
      PromptMessage[]
    >
  ): void {
    this.promptGetHandler = handler
  }

  /**
   * Wait for initialization
   */
  async waitForInitialization(timeout = 30000): Promise<void> {
    const startTime = Date.now()
    
    while (this.state !== 'initialized') {
      if (Date.now() - startTime > timeout) {
        throw ProtocolErrors.timeout('Initialization timeout')
      }
      
      if (this.state === 'shutdown' || this.state === 'shutting_down') {
        throw ProtocolErrors.invalidState('Protocol is shutting down')
      }
      
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  /**
   * Register MCP-specific handlers
   */
  private registerMcpHandlers(): void {
    // Initialize handler
    this.registerHandler('initialize', async (params: unknown) => {
      const initParams = params as MCP.InitializeRequest
      if (this.state !== 'uninitialized') {
        throw this.createMcpError(
          -32003, // MCP.ErrorCode.ALREADY_INITIALIZED
          'Server already initialized'
        )
      }

      this.state = 'initializing'
      this.clientCapabilities = initParams.capabilities

      const response: MCP.InitializeResponse = {
        protocolVersion: '2024-11-05',
        capabilities: this.serverCapabilities,
        serverInfo: {
          name: this.mcpConfig.name,
          version: this.mcpConfig.version
        }
      }

      this.state = 'initialized'
      this.mcpLogger.info(
        { 
          clientInfo: initParams.clientInfo,
          capabilities: initParams.capabilities 
        },
        'MCP initialized'
      )

      return response
    })

    // Initialized notification handler
    this.registerNotificationHandler('initialized', async (params: unknown) => {
      if (this.state !== 'initialized') {
        this.mcpLogger.warn('Received initialized notification in wrong state')
      }
    })

    // Shutdown handler
    this.registerHandler('shutdown', async () => {
      if (this.state !== 'initialized') {
        throw this.createMcpError(
          -32002, // MCP.ErrorCode.NOT_INITIALIZED
          'Server not initialized'
        )
      }

      this.state = 'shutting_down'
      
      // Perform cleanup
      this.clear()
      
      this.state = 'shutdown'
      this.mcpLogger.info('MCP shutdown complete')
      
      return null
    })

    // Exit notification handler
    this.registerNotificationHandler('exit', async (params: unknown) => {
      this.mcpLogger.info('Received exit notification')
      process.exit(0)
    })

    // Resource handlers
    this.registerHandler('resources/list', async () => {
      this.ensureInitialized()
      
      if (this.resourceListHandler) {
        return this.resourceListHandler(undefined, {} as RequestContext)
      }
      
      return Array.from(this.resources.values())
    })

    this.registerHandler('resources/read', async (params: unknown) => {
      const readParams = params as { uri: string }
      this.ensureInitialized()
      
      if (!readParams?.uri) {
        throw ValidationErrors.requiredField('uri')
      }

      if (this.resourceReadHandler) {
        return this.resourceReadHandler(readParams, {} as RequestContext)
      }

      const resource = this.resources.get(readParams.uri)
      if (!resource) {
        throw this.createMcpError(
          -32010, // MCP.ErrorCode.RESOURCE_NOT_FOUND
          `Resource not found: ${readParams.uri}`
        )
      }

      // Default implementation returns empty content
      return {
        uri: createResourceUri(readParams.uri),
        contents: [],
        metadata: {}
      }
    })

    // Tool handlers
    this.registerHandler('tools/list', async () => {
      this.ensureInitialized()
      
      if (this.toolListHandler) {
        return this.toolListHandler(undefined, {} as RequestContext)
      }
      
      return Array.from(this.tools.values())
    })

    this.registerHandler('tools/call', async (params: unknown) => {
      const toolCall = params as ToolCall
      this.ensureInitialized()
      
      if (!toolCall?.name) {
        throw ValidationErrors.requiredField('name')
      }

      if (this.toolCallHandler) {
        return this.toolCallHandler(toolCall, {} as RequestContext)
      }

      const tool = this.tools.get(toolCall.name)
      if (!tool) {
        throw this.createMcpError(
          -32020, // MCP.ErrorCode.TOOL_NOT_FOUND
          `Tool not found: ${toolCall.name}`
        )
      }

      // Default implementation returns error
      throw this.createMcpError(
        -32021, // MCP.ErrorCode.TOOL_EXECUTION_FAILED
        `No handler registered for tool: ${toolCall.name}`
      )
    })

    // Prompt handlers
    this.registerHandler('prompts/list', async () => {
      this.ensureInitialized()
      
      if (this.promptListHandler) {
        return this.promptListHandler(undefined, {} as RequestContext)
      }
      
      return Array.from(this.prompts.values())
    })

    this.registerHandler(
      'prompts/get',
      async (params: unknown) => {
        const promptParams = params as { name: string; arguments?: Record<string, string> }
        this.ensureInitialized()
        
        if (!promptParams?.name) {
          throw ValidationErrors.requiredField('name')
        }

        if (this.promptGetHandler) {
          return this.promptGetHandler(promptParams, {} as RequestContext)
        }

        const prompt = this.prompts.get(promptParams.name)
        if (!prompt) {
          throw this.createMcpError(
            -32030, // MCP.ErrorCode.PROMPT_NOT_FOUND
            `Prompt not found: ${promptParams.name}`
          )
        }

        // Validate arguments
        if (prompt.arguments) {
          for (const arg of prompt.arguments) {
            if (arg.required && !promptParams.arguments?.[arg.name]) {
              throw this.createMcpError(
                -32031, // MCP.ErrorCode.INVALID_PROMPT_ARGUMENTS
                `Missing required argument: ${arg.name}`
              )
            }
          }
        }

        // Default implementation returns empty messages
        return [] as PromptMessage[]
      }
    )

    // Logging handler
    this.registerHandler(
      'logging/setLevel',
      async (params: unknown) => {
        const logParams = params as { level: LogLevel }
        this.ensureInitialized()
        
        if (!logParams?.level) {
          throw ValidationErrors.requiredField('level')
        }

        this.mcpLogger.info({ level: logParams.level }, 'Setting log level')
        
        // Update logger level if possible
        if ('level' in this.mcpLogger) {
          (this.mcpLogger as any).level = logParams.level
        }

        return null
      }
    )

    // Progress notification handler
    this.registerNotificationHandler(
      '$/progress',
      async (params: unknown) => {
        const typedParams = params as { token: string | number; value: any }
        this.mcpLogger.debug({ params: typedParams }, 'Progress notification')
        // Progress handling is done at transport level
      }
    )

    // Cancel request notification handler
    this.registerNotificationHandler(
      '$/cancelRequest',
      async (params: unknown) => {
        const typedParams = params as { id: string | number }
        this.mcpLogger.debug({ id: typedParams.id }, 'Cancel request')
        // Cancellation is handled by JSON-RPC layer
        this.cancelRequest(createJsonRpcId(typedParams.id))
      }
    )
  }

  /**
   * Ensure server is initialized
   */
  private ensureInitialized(): void {
    if (this.state !== 'initialized') {
      throw this.createMcpError(
        -32002, // MCP.ErrorCode.NOT_INITIALIZED
        'Server not initialized'
      )
    }
  }

  /**
   * Create MCP-specific error
   */
  private createMcpError(code: number, message: string, data?: any): Error {
    const error = new Error(message) as any
    error.code = code
    error.data = data
    return error
  }
}

/**
 * Create MCP protocol instance
 */
export function createMcpProtocol(config: McpConfig): McpProtocol {
  return new McpProtocol(config)
}

/**
 * MCP server builder for convenient setup
 */
export class McpServerBuilder {
  private config: McpConfig
  private resources: Resource[] = []
  private tools: Tool[] = []
  private prompts: Prompt[] = []
  private resourceListHandler?: RequestHandler<void, Resource[]>
  private resourceReadHandler?: RequestHandler<{ uri: string }, ResourceContents>
  private toolListHandler?: RequestHandler<void, Tool[]>
  private toolCallHandler?: RequestHandler<ToolCall, ToolResult>
  private promptListHandler?: RequestHandler<void, Prompt[]>
  private promptGetHandler?: RequestHandler<
    { name: string; arguments?: Record<string, string> },
    PromptMessage[]
  >

  constructor(name: string, version: string) {
    this.config = {
      name,
      version,
      capabilities: {}
    }
  }

  /**
   * Set server capabilities
   */
  withCapabilities(capabilities: MCP.Capabilities): this {
    this.config.capabilities = capabilities
    return this
  }

  /**
   * Add resources
   */
  withResources(resources: Resource[]): this {
    this.resources.push(...resources)
    return this
  }

  /**
   * Set resource handlers
   */
  withResourceHandlers(
    listHandler: RequestHandler<void, Resource[]>,
    readHandler: RequestHandler<{ uri: string }, ResourceContents>
  ): this {
    this.resourceListHandler = listHandler
    this.resourceReadHandler = readHandler
    return this
  }

  /**
   * Add tools
   */
  withTools(tools: Tool[]): this {
    this.tools.push(...tools)
    return this
  }

  /**
   * Set tool handlers
   */
  withToolHandlers(
    listHandler: RequestHandler<void, Tool[]>,
    callHandler: RequestHandler<ToolCall, ToolResult>
  ): this {
    this.toolListHandler = listHandler
    this.toolCallHandler = callHandler
    return this
  }

  /**
   * Add prompts
   */
  withPrompts(prompts: Prompt[]): this {
    this.prompts.push(...prompts)
    return this
  }

  /**
   * Set prompt handlers
   */
  withPromptHandlers(
    listHandler: RequestHandler<void, Prompt[]>,
    getHandler: RequestHandler<
      { name: string; arguments?: Record<string, string> },
      PromptMessage[]
    >
  ): this {
    this.promptListHandler = listHandler
    this.promptGetHandler = getHandler
    return this
  }

  /**
   * Set protocol configuration
   */
  withProtocolConfig(config: Partial<ProtocolConfig>): this {
    Object.assign(this.config, config)
    return this
  }

  /**
   * Build MCP protocol instance
   */
  build(): McpProtocol {
    const protocol = new McpProtocol(this.config)

    // Register static resources, tools, and prompts
    if (this.resources.length > 0) {
      protocol.registerResources(this.resources)
    }
    if (this.tools.length > 0) {
      protocol.registerTools(this.tools)
    }
    if (this.prompts.length > 0) {
      protocol.registerPrompts(this.prompts)
    }

    // Set dynamic handlers
    if (this.resourceListHandler) {
      protocol.setResourceListHandler(this.resourceListHandler)
    }
    if (this.resourceReadHandler) {
      protocol.setResourceReadHandler(this.resourceReadHandler)
    }
    if (this.toolListHandler) {
      protocol.setToolListHandler(this.toolListHandler)
    }
    if (this.toolCallHandler) {
      protocol.setToolCallHandler(this.toolCallHandler)
    }
    if (this.promptListHandler) {
      protocol.setPromptListHandler(this.promptListHandler)
    }
    if (this.promptGetHandler) {
      protocol.setPromptGetHandler(this.promptGetHandler)
    }

    return protocol
  }
}