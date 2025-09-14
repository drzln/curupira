/**
 * @fileoverview React debugging prompt templates
 */

import type {
  PromptHandler,
  PromptMetadata,
  PromptTemplate
} from './types.js'
import type { JsonValue } from '@curupira/shared'

/**
 * React component debug prompt
 */
export class ReactComponentPrompt implements PromptHandler {
  readonly metadata: PromptMetadata = {
    name: 'react-component',
    description: 'Debug React component issues',
    category: 'react',
    arguments: [
      {
        name: 'component',
        description: 'Component name',
        required: true
      },
      {
        name: 'issue',
        description: 'Description of the issue',
        required: true
      }
    ],
    tags: ['react', 'component', 'debug']
  }

  getTemplate(): PromptTemplate {
    return {
      template: `I'm having issues with a React component:

Component: {{component}}
Issue: {{issue}}

Please help me debug by:
1. Checking the component's state and props
2. Looking for rendering issues
3. Identifying potential performance problems
4. Suggesting improvements

Use these resources:
- state://react/* - React component states
- console - Look for React warnings/errors
- dom - Inspect component DOM structure

Tools available:
- evaluate - Check React DevTools global variables
- screenshot - Capture component state`,
      variables: {
        component: {
          description: 'Component name',
          type: 'string'
        },
        issue: {
          description: 'Issue description',
          type: 'string'
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

    return result
  }
}

/**
 * React hooks debug prompt
 */
export class ReactHooksPrompt implements PromptHandler {
  readonly metadata: PromptMetadata = {
    name: 'react-hooks',
    description: 'Debug React hooks issues',
    category: 'react',
    tags: ['react', 'hooks', 'useState', 'useEffect']
  }

  getTemplate(): PromptTemplate {
    return {
      template: `I need help debugging React hooks. Common issues include:
- Infinite loops in useEffect
- Stale closures
- Missing dependencies
- Incorrect state updates

Please analyze:
1. Check for useEffect dependency issues
2. Look for state update patterns
3. Identify potential infinite loops
4. Suggest best practices

Resources:
- state://react/* - Component states and effects
- console - Hook warnings from React
- evaluate - Check hook values in DevTools`,
      variables: {}
    }
  }

  render(variables: Record<string, JsonValue>): string {
    return this.getTemplate().template
  }
}