/**
 * @fileoverview Navigation tool implementation
 */

import type {
  ToolHandler,
  ToolMetadata,
  ToolContext,
  ToolResult,
  NavigationInput
} from './types.js'
import type { CdpClient } from '@curupira/integration'

/**
 * Navigation tool
 */
export class NavigationTool implements ToolHandler<NavigationInput, void> {
  readonly metadata: ToolMetadata = {
    name: 'navigate',
    description: 'Navigate to a URL',
    category: 'navigation',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', format: 'uri' },
        waitUntil: { 
          type: 'string', 
          enum: ['load', 'domcontentloaded', 'networkidle0', 'networkidle2'] 
        },
        referrer: { type: 'string' }
      },
      required: ['url']
    }
  }

  constructor(
    private readonly cdpClient: CdpClient
  ) {}

  async execute(
    input: NavigationInput,
    context: ToolContext
  ): Promise<ToolResult<void>> {
    try {
      const session = context.sessionId 
        ? this.cdpClient.getSession(context.sessionId as any)
        : undefined

      if (session) {
        await session.navigate(input.url)
      } else {
        await this.cdpClient.send({
          method: 'Page.navigate',
          params: {
            url: input.url,
            referrer: input.referrer
          }
        })
      }

      // Wait for navigation if specified
      if (input.waitUntil) {
        await this.waitForNavigation(input.waitUntil, context)
      }

      return {
        success: true,
        metadata: { url: input.url }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  validate(input: unknown): input is NavigationInput {
    return typeof input === 'object' && 
           input !== null && 
           'url' in input && 
           typeof (input as any).url === 'string'
  }

  private async waitForNavigation(
    waitUntil: string,
    context: ToolContext
  ): Promise<void> {
    // Simple implementation - wait for event
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => resolve(), context.timeout || 30000)
      
      // In real implementation, would listen for CDP events
      setTimeout(() => {
        clearTimeout(timeout)
        resolve()
      }, 1000)
    })
  }
}