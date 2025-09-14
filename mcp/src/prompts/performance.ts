/**
 * @fileoverview Performance debugging prompt templates
 */

import type {
  PromptHandler,
  PromptMetadata,
  PromptTemplate
} from './types.js'
import type { JsonValue } from '@curupira/shared'

/**
 * Performance analysis prompt
 */
export class PerformanceAnalysisPrompt implements PromptHandler {
  readonly metadata: PromptMetadata = {
    name: 'performance-analysis',
    description: 'Analyze application performance',
    category: 'performance',
    tags: ['performance', 'optimization', 'speed']
  }

  getTemplate(): PromptTemplate {
    return {
      template: `Please help me analyze the performance of my web application:

1. Measure key metrics:
   - First Contentful Paint (FCP)
   - Largest Contentful Paint (LCP)
   - Time to Interactive (TTI)
   - Total Blocking Time (TBT)

2. Identify bottlenecks:
   - Slow network requests
   - Large JavaScript bundles
   - Render-blocking resources
   - Memory usage

3. Suggest optimizations

Use these tools:
- evaluate: Run performance.getEntries()
- network resources: Analyze request timing
- screenshot: Capture performance timeline

Resources to check:
- network://* - All network requests
- state://* - Application state size`,
      variables: {}
    }
  }

  render(variables: Record<string, JsonValue>): string {
    return this.getTemplate().template
  }
}

/**
 * Render performance prompt
 */
export class RenderPerformancePrompt implements PromptHandler {
  readonly metadata: PromptMetadata = {
    name: 'render-performance',
    description: 'Debug rendering performance issues',
    category: 'performance',
    arguments: [
      {
        name: 'component',
        description: 'Component or area with issues',
        required: false
      }
    ],
    tags: ['performance', 'rendering', 'react']
  }

  getTemplate(): PromptTemplate {
    return {
      template: `I'm experiencing rendering performance issues{{#if component}} in {{component}}{{/if}}.

Please help me:
1. Identify components that re-render frequently
2. Find expensive render operations
3. Detect layout thrashing
4. Suggest optimization strategies

Analyze using:
- state://react/* - Component render counts
- evaluate - Check React Profiler data
- console - Look for performance warnings
- dom - Analyze DOM mutations

Common issues to check:
- Missing React.memo
- Inline function/object creation
- Large lists without virtualization
- Expensive computations in render`,
      variables: {
        component: {
          description: 'Component name',
          type: 'string',
          default: ''
        }
      }
    }
  }

  render(variables: Record<string, JsonValue>): string {
    const template = this.getTemplate()
    let result = template.template

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g')
      result = result.replace(regex, String(value))
    }

    result = result.replace(/{{#if (\w+)}}([\s\S]*?){{\/if}}/g, (match, varName, content) => {
      return variables[varName] ? content : ''
    })

    return result
  }
}