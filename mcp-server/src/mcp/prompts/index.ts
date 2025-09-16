/**
 * MCP Prompts - Prompt templates for common debugging scenarios
 */

export interface PromptHandler {
  metadata: {
    name: string;
    description: string;
    arguments: Array<{
      name: string;
      description: string;
      required: boolean;
    }>;
  };
  handler: (args: Record<string, unknown>) => {
    messages: Array<{
      role: 'user' | 'assistant';
      content: string;
    }>;
  };
}

export const promptHandlers: PromptHandler[] = [
  {
    metadata: {
      name: 'debug-lazy-loading',
      description: 'Debug lazy-loaded component issues',
      arguments: [
        {
          name: 'componentName',
          description: 'Name of the component having issues',
          required: true,
        },
      ],
    },
    handler: (args) => ({
      messages: [
        {
          role: 'user',
          content: `Help me debug lazy loading issues with the ${args.componentName} component. What should I check?`,
        },
      ],
    }),
  },
  {
    metadata: {
      name: 'trace-graphql-error',
      description: 'Trace GraphQL query errors',
      arguments: [
        {
          name: 'operation',
          description: 'GraphQL operation name',
          required: true,
        },
        {
          name: 'error',
          description: 'Error message',
          required: true,
        },
      ],
    },
    handler: (args) => ({
      messages: [
        {
          role: 'user',
          content: `I'm getting error "${args.error}" in GraphQL operation "${args.operation}". How can I trace this?`,
        },
      ],
    }),
  },
  {
    metadata: {
      name: 'profile-performance',
      description: 'Profile component render performance',
      arguments: [
        {
          name: 'component',
          description: 'Component to profile',
          required: false,
        },
      ],
    },
    handler: (args) => ({
      messages: [
        {
          role: 'user',
          content: args.component
            ? `Profile the performance of the ${args.component} component`
            : 'Profile the current page performance and identify bottlenecks',
        },
      ],
    }),
  },
];