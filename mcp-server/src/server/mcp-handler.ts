/**
 * MCP protocol handler
 * 
 * Manages resources, tools, and prompts for the MCP server
 */

import type { Resource, Tool, Prompt } from '@modelcontextprotocol/sdk/types.js'
import type { ResourceProviders } from '../resources/index.js'
import { logger } from '../config/logger.js'
import { z } from 'zod'

// Request schemas
const readResourceSchema = z.object({
  uri: z.string().url(),
})

const callToolSchema = z.object({
  name: z.string(),
  arguments: z.unknown().optional(),
})

const getPromptSchema = z.object({
  name: z.string(),
  arguments: z.record(z.string()).optional(),
})

export class MCPHandler {
  private resourceProviders?: ResourceProviders
  private prompts: Map<string, Prompt> = new Map()
  private securityManager?: any // Will be set by server

  constructor() {
    this.initializePrompts()
  }

  /**
   * Set security manager
   */
  setSecurityManager(securityManager: any) {
    this.securityManager = securityManager
  }

  /**
   * Initialize with providers
   */
  initialize(resourceProviders: ResourceProviders) {
    this.resourceProviders = resourceProviders
    logger.info('MCP handler initialized (tools handled by setupMCPHandlers)')
  }

  /**
   * List available resources
   */
  async listResources(): Promise<{ resources: Resource[] }> {
    if (!this.resourceProviders) {
      throw new Error('Resource providers not initialized')
    }

    try {
      const resources = await this.resourceProviders.listResources()
      logger.debug({ count: resources.length }, 'Listed resources')
      
      return { resources }
    } catch (error) {
      logger.error({ error }, 'Failed to list resources')
      throw error
    }
  }

  /**
   * Read a specific resource
   */
  async readResource(params: unknown): Promise<{ content: string; mimeType: string }> {
    if (!this.resourceProviders) {
      throw new Error('Resource providers not initialized')
    }

    try {
      const { uri } = readResourceSchema.parse(params)
      logger.debug({ uri }, 'Reading resource')
      
      const result = await this.resourceProviders.readResource(uri)
      
      return {
        content: result.content,
        mimeType: result.mimeType,
      }
    } catch (error) {
      logger.error({ error, params }, 'Failed to read resource')
      throw error
    }
  }

  /**
   * List available tools - now handled by setupMCPHandlers
   */
  async listTools(): Promise<{ tools: Tool[] }> {
    logger.debug('Tool listing now handled by setupMCPHandlers')
    return { tools: [] }
  }

  /**
   * Call a tool - now handled by setupMCPHandlers
   */
  async callTool(params: unknown): Promise<any> {
    logger.debug('Tool calls now handled by setupMCPHandlers')
    throw new Error('Tool calls are handled by the unified tool handlers')
  }

  /**
   * List available prompts
   */
  async listPrompts(): Promise<{ prompts: Prompt[] }> {
    try {
      const prompts = Array.from(this.prompts.values())
      logger.debug({ count: prompts.length }, 'Listed prompts')
      
      return { prompts }
    } catch (error) {
      logger.error({ error }, 'Failed to list prompts')
      throw error
    }
  }

  /**
   * Get a specific prompt
   */
  async getPrompt(params: unknown): Promise<{ prompt: string }> {
    try {
      const { name, arguments: args } = getPromptSchema.parse(params)
      logger.debug({ name, args }, 'Getting prompt')
      
      const promptTemplate = this.prompts.get(name)
      if (!promptTemplate) {
        throw new Error(`Prompt not found: ${name}`)
      }

      // Replace template variables
      let prompt = String(promptTemplate.prompt)
      if (args) {
        for (const [key, value] of Object.entries(args)) {
          prompt = prompt.replace(`{{${key}}}`, String(value))
        }
      }

      return { prompt }
    } catch (error) {
      logger.error({ error, params }, 'Failed to get prompt')
      throw error
    }
  }

  /**
   * Initialize built-in prompts
   */
  private initializePrompts() {
    // React debugging prompts
    this.prompts.set('debug-react-component', {
      name: 'debug-react-component',
      description: 'Debug a specific React component',
      prompt: `I need help debugging a React component called "{{componentName}}".

Please:
1. Inspect the component tree to find this component
2. Check its current props and state
3. Look for any error boundaries or console errors
4. Analyze its render performance
5. Suggest potential fixes for any issues found`,
      arguments: [
        {
          name: 'componentName',
          description: 'Name of the React component to debug',
          required: true,
        },
      ],
    })

    // State debugging prompts
    this.prompts.set('debug-state-issue', {
      name: 'debug-state-issue',
      description: 'Debug state management issues',
      prompt: `I'm experiencing state management issues in my application.

The problem: {{problem}}

Please:
1. Inspect all state management stores (Zustand, XState, etc.)
2. Look for state that might be related to: {{stateDescription}}
3. Check for any state mutations or unexpected changes
4. Trace state updates and their triggers
5. Provide recommendations for fixing the issue`,
      arguments: [
        {
          name: 'problem',
          description: 'Description of the state issue',
          required: true,
        },
        {
          name: 'stateDescription',
          description: 'Description of the state to look for',
          required: true,
        },
      ],
    })

    // Performance analysis prompts
    this.prompts.set('analyze-performance', {
      name: 'analyze-performance',
      description: 'Analyze application performance',
      prompt: `Please analyze the performance of {{targetArea}} in my application.

Steps:
1. Start performance profiling
2. Capture metrics for the specified area
3. Identify any performance bottlenecks
4. Check for unnecessary re-renders
5. Analyze network requests
6. Provide optimization recommendations`,
      arguments: [
        {
          name: 'targetArea',
          description: 'Area of the app to analyze (e.g., "checkout flow", "product list")',
          required: true,
        },
      ],
    })

    // Network debugging prompts
    this.prompts.set('debug-network-requests', {
      name: 'debug-network-requests',
      description: 'Debug network request issues',
      prompt: `I need help debugging network requests for {{endpoint}}.

Please:
1. Monitor network requests to this endpoint
2. Check request/response headers and payloads
3. Look for failed requests or long response times
4. Analyze any CORS or authentication issues
5. Suggest fixes for any problems found`,
      arguments: [
        {
          name: 'endpoint',
          description: 'API endpoint or URL pattern to debug',
          required: true,
        },
      ],
    })

    // Cart debugging prompt (specific use case)
    this.prompts.set('debug-cart-state', {
      name: 'debug-cart-state',
      description: 'Debug shopping cart state issues',
      prompt: `Help me debug shopping cart issues in my e-commerce application.

Please:
1. Find and inspect the cart state (likely in Zustand or similar)
2. Check the current cart items and total
3. Monitor cart-related actions (add, remove, update)
4. Look for any synchronization issues with the backend
5. Verify cart persistence (localStorage, session)
6. Provide specific fixes for any issues found`,
      arguments: [],
    })

    // General debugging prompt
    this.prompts.set('debug-application', {
      name: 'debug-application',
      description: 'General application debugging',
      prompt: `Please help me debug my React application.

Start by:
1. Checking the console for any errors or warnings
2. Inspecting the component tree structure
3. Reviewing active state management stores
4. Checking network requests for failures
5. Analyzing overall performance metrics

Then focus on any specific issues you discover.`,
      arguments: [],
    })

    logger.info({ count: this.prompts.size }, 'Initialized prompts')
  }

  /**
   * Get statistics about available resources and tools
   */
  async getStatistics() {
    const stats = {
      resources: {
        total: 0,
        byProvider: {} as Record<string, number>,
      },
      tools: {
        total: 0,
        byCategory: {} as Record<string, number>,
      },
      prompts: {
        total: this.prompts.size,
      },
    }

    if (this.resourceProviders) {
      const resourceStats = await this.resourceProviders.getStatistics()
      stats.resources = {
        total: resourceStats.totalResources,
        byProvider: resourceStats.byProvider
      }
    }

    // Tools are now handled by setupMCPHandlers
    stats.tools.total = 0
    stats.tools.byCategory = { unified: 0 }

    return stats
  }
}