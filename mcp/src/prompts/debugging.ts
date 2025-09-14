/**
 * @fileoverview Debugging prompt templates
 */

import type {
  PromptHandler,
  PromptMetadata,
  PromptTemplate
} from './types.js'
import type { JsonValue } from '@curupira/shared'

/**
 * Debug error prompt
 */
export class DebugErrorPrompt implements PromptHandler {
  readonly metadata: PromptMetadata = {
    name: 'debug-error',
    description: 'Debug a JavaScript error',
    category: 'debugging',
    arguments: [
      {
        name: 'error',
        description: 'Error message or stack trace',
        required: true
      },
      {
        name: 'context',
        description: 'Additional context about when the error occurred',
        required: false
      }
    ],
    tags: ['error', 'debug', 'troubleshoot']
  }

  getTemplate(): PromptTemplate {
    return {
      template: `I'm encountering an error in my web application:

Error: {{error}}

{{#if context}}
Context: {{context}}
{{/if}}

Please help me:
1. Understand what's causing this error
2. Identify the root cause
3. Suggest fixes or workarounds
4. Recommend debugging steps

Available tools:
- evaluate: Run JavaScript in the browser
- navigate: Navigate to URLs
- screenshot: Take screenshots
- setBreakpoint: Set debugger breakpoints

Available resources:
- console: Browser console logs
- network: Network requests
- dom: DOM elements
- storage: Browser storage
- state: Application state`,
      variables: {
        error: {
          description: 'Error message or stack trace',
          type: 'string'
        },
        context: {
          description: 'Additional context',
          type: 'string',
          default: ''
        }
      }
    }
  }

  render(variables: Record<string, JsonValue>): string {
    const template = this.getTemplate()
    let result = template.template

    // Simple template rendering
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g')
      result = result.replace(regex, String(value))
    }

    // Handle conditionals
    result = result.replace(/{{#if (\w+)}}([\s\S]*?){{\/if}}/g, (match, varName, content) => {
      return variables[varName] ? content : ''
    })

    return result
  }
}

/**
 * Memory leak prompt
 */
export class MemoryLeakPrompt implements PromptHandler {
  readonly metadata: PromptMetadata = {
    name: 'memory-leak',
    description: 'Debug potential memory leaks',
    category: 'debugging',
    tags: ['performance', 'memory', 'leak']
  }

  getTemplate(): PromptTemplate {
    return {
      template: `I suspect there's a memory leak in my application. Please help me:

1. Take a heap snapshot
2. Analyze memory usage patterns
3. Identify potential leak sources
4. Suggest fixes

Use these tools:
- evaluate: Check memory usage with performance.memory
- screenshot: Capture memory profiler
- Resources to check:
  - state: Check for accumulated state
  - console: Look for repeated errors
  - network: Check for repeated requests`,
      variables: {}
    }
  }

  render(variables: Record<string, JsonValue>): string {
    return this.getTemplate().template
  }
}