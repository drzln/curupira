/**
 * @fileoverview MCP prompt types
 */

import type { JsonValue } from '@curupira/shared'

/**
 * Prompt metadata
 */
export interface PromptMetadata {
  /** Prompt name */
  name: string
  /** Prompt description */
  description: string
  /** Prompt category */
  category: 'debugging' | 'react' | 'performance' | 'testing' | 'other'
  /** Arguments */
  arguments?: Array<{
    name: string
    description: string
    required?: boolean
    default?: JsonValue
  }>
  /** Tags */
  tags?: string[]
}

/**
 * Prompt template
 */
export interface PromptTemplate {
  /** Template string */
  template: string
  /** Variable placeholders */
  variables?: Record<string, {
    description: string
    type: string
    default?: JsonValue
  }>
  /** Examples */
  examples?: Array<{
    variables: Record<string, JsonValue>
    result: string
  }>
}

/**
 * Prompt handler
 */
export interface PromptHandler {
  /** Prompt metadata */
  metadata: PromptMetadata
  /** Get template */
  getTemplate(args?: Record<string, JsonValue>): PromptTemplate
  /** Render prompt */
  render(variables: Record<string, JsonValue>): string
}

/**
 * Prompt registry
 */
export interface PromptRegistry {
  /** Register prompt */
  register(prompt: PromptHandler): void
  /** Unregister prompt */
  unregister(name: string): void
  /** Get prompt by name */
  getPrompt(name: string): PromptHandler | undefined
  /** List all prompts */
  listPrompts(): PromptMetadata[]
  /** Render prompt */
  render(name: string, variables: Record<string, JsonValue>): string
}