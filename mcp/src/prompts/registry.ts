/**
 * @fileoverview Prompt registry implementation
 */

import type {
  PromptHandler,
  PromptRegistry,
  PromptMetadata
} from './types.js'
import type { JsonValue } from '@curupira/shared'
import { createLogger, type Logger } from '@curupira/shared'

/**
 * Prompt registry implementation
 */
export class PromptRegistryImpl implements PromptRegistry {
  private readonly prompts = new Map<string, PromptHandler>()
  private readonly logger: Logger

  constructor() {
    this.logger = createLogger({ level: 'info' })
  }

  /**
   * Register prompt
   */
  register(prompt: PromptHandler): void {
    const name = prompt.metadata.name
    
    if (this.prompts.has(name)) {
      throw new Error(`Prompt '${name}' already registered`)
    }

    this.prompts.set(name, prompt)
    this.logger.info({ prompt: name }, 'Prompt registered')
  }

  /**
   * Unregister prompt
   */
  unregister(name: string): void {
    this.prompts.delete(name)
    this.logger.info({ prompt: name }, 'Prompt unregistered')
  }

  /**
   * Get prompt by name
   */
  getPrompt(name: string): PromptHandler | undefined {
    return this.prompts.get(name)
  }

  /**
   * List all prompts
   */
  listPrompts(): PromptMetadata[] {
    return Array.from(this.prompts.values()).map(prompt => prompt.metadata)
  }

  /**
   * Render prompt
   */
  render(name: string, variables: Record<string, JsonValue>): string {
    const prompt = this.prompts.get(name)
    
    if (!prompt) {
      throw new Error(`Prompt not found: ${name}`)
    }

    try {
      return prompt.render(variables)
    } catch (error) {
      this.logger.error({ error, prompt: name }, 'Failed to render prompt')
      throw error
    }
  }

  /**
   * Get all prompts
   */
  getAllPrompts(): PromptHandler[] {
    return Array.from(this.prompts.values())
  }
}