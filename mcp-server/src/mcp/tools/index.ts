import type { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { ChromeManager } from '../../chrome/manager.js'
import { logger } from '../../config/logger.js'

// Tool input schemas
const NavigateSchema = z.object({
  url: z.string().url(),
  sessionId: z.string()
})

const ScreenshotSchema = z.object({
  sessionId: z.string(),
  fullPage: z.boolean().optional().default(false),
  selector: z.string().optional()
})

const EvaluateSchema = z.object({
  expression: z.string(),
  sessionId: z.string()
})

const InspectSchema = z.object({
  selector: z.string(),
  sessionId: z.string()
})

export function setupUnifiedToolHandlers(server: Server) {
  // Single handler for listing all tools
  server.setRequestHandler(ListToolsRequestSchema, async (request) => {
    logger.debug('Listing all available tools')
    
    return {
      tools: [
        // Chrome navigation
        {
          name: 'navigate',
          description: 'Navigate Chrome browser to a URL',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                format: 'uri',
                description: 'The URL to navigate to',
              },
              sessionId: {
                type: 'string',
                description: 'Chrome session ID',
              },
            },
            required: ['url', 'sessionId'],
          },
        },
        // Screenshot
        {
          name: 'screenshot',
          description: 'Take a screenshot of the current page',
          inputSchema: {
            type: 'object',
            properties: {
              sessionId: {
                type: 'string',
                description: 'Chrome session ID',
              },
              fullPage: {
                type: 'boolean',
                description: 'Capture full page (default: false)',
                default: false,
              },
              selector: {
                type: 'string',
                description: 'CSS selector to capture specific element',
              },
            },
            required: ['sessionId'],
          },
        },
        // Evaluate
        {
          name: 'eval',
          description: 'Evaluate JavaScript expression in page context',
          inputSchema: {
            type: 'object',
            properties: {
              expression: {
                type: 'string',
                description: 'JavaScript expression to evaluate',
              },
              sessionId: {
                type: 'string',
                description: 'Chrome session ID',
              },
            },
            required: ['expression', 'sessionId'],
          },
        },
        // Inspect
        {
          name: 'inspect',
          description: 'Inspect DOM element by selector',
          inputSchema: {
            type: 'object',
            properties: {
              selector: {
                type: 'string',
                description: 'CSS selector of element to inspect',
              },
              sessionId: {
                type: 'string',
                description: 'Chrome session ID',
              },
            },
            required: ['selector', 'sessionId'],
          },
        },
        // Debugger commands
        {
          name: 'debugger-pause',
          description: 'Pause JavaScript execution',
          inputSchema: {
            type: 'object',
            properties: {
              sessionId: {
                type: 'string',
                description: 'Chrome session ID',
              },
            },
            required: ['sessionId'],
          },
        },
        {
          name: 'debugger-resume',
          description: 'Resume JavaScript execution',
          inputSchema: {
            type: 'object',
            properties: {
              sessionId: {
                type: 'string',
                description: 'Chrome session ID',
              },
            },
            required: ['sessionId'],
          },
        },
        {
          name: 'debugger-step',
          description: 'Step through JavaScript execution',
          inputSchema: {
            type: 'object',
            properties: {
              sessionId: {
                type: 'string',
                description: 'Chrome session ID',
              },
              type: {
                type: 'string',
                enum: ['into', 'over', 'out'],
                description: 'Step type',
              },
            },
            required: ['sessionId', 'type'],
          },
        },
        // Profiler
        {
          name: 'profiler-start',
          description: 'Start CPU profiling',
          inputSchema: {
            type: 'object',
            properties: {
              sessionId: {
                type: 'string',
                description: 'Chrome session ID',
              },
            },
            required: ['sessionId'],
          },
        },
        {
          name: 'profiler-stop',
          description: 'Stop CPU profiling and get results',
          inputSchema: {
            type: 'object',
            properties: {
              sessionId: {
                type: 'string',
                description: 'Chrome session ID',
              },
            },
            required: ['sessionId'],
          },
        },
      ],
    }
  })

  // Single handler for calling any tool
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params
    
    logger.debug({ name, args }, 'Calling tool')

    try {
      const manager = ChromeManager.getInstance()
      
      switch (name) {
        case 'navigate': {
          const input = NavigateSchema.parse(args)
          const client = manager.getClient()
          await client.send('Page.navigate', { url: input.url }, input.sessionId)
          
          return {
            content: [
              {
                type: 'text',
                text: `Successfully navigated to ${input.url}`,
              },
            ],
          }
        }

        case 'screenshot': {
          const input = ScreenshotSchema.parse(args)
          const client = manager.getClient()
          
          const screenshot = await client.screenshot(input.sessionId, {
            fullPage: input.fullPage
          })
          
          return {
            content: [
              {
                type: 'text',
                text: `Screenshot captured (${screenshot.width}x${screenshot.height})`,
              },
              {
                type: 'image',
                data: screenshot.data,
                mimeType: 'image/png',
              },
            ],
          }
        }

        case 'eval': {
          const input = EvaluateSchema.parse(args)
          const client = manager.getClient()
          
          const result = await client.evaluate(input.sessionId, input.expression)
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          }
        }

        case 'inspect': {
          const input = InspectSchema.parse(args)
          const client = manager.getClient()
          
          // Inspect element using Runtime.evaluate
          const elementInfo = await client.evaluate(input.sessionId, `
            (() => {
              const element = document.querySelector('${input.selector}');
              if (!element) return null;
              const rect = element.getBoundingClientRect();
              return {
                tagName: element.tagName,
                className: element.className,
                id: element.id,
                attributes: Array.from(element.attributes).map(attr => ({ name: attr.name, value: attr.value })),
                textContent: element.textContent?.trim(),
                boundingBox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
                computedStyle: window.getComputedStyle(element).cssText
              };
            })()
          `)
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(elementInfo, null, 2),
              },
            ],
          }
        }

        case 'debugger-pause': {
          const { sessionId } = args as any
          const client = manager.getClient()
          
          await client.send('Debugger.pause', {}, sessionId)
          
          return {
            content: [
              {
                type: 'text',
                text: 'Debugger paused',
              },
            ],
          }
        }

        case 'debugger-resume': {
          const { sessionId } = args as any
          const client = manager.getClient()
          
          await client.send('Debugger.resume', {}, sessionId)
          
          return {
            content: [
              {
                type: 'text',
                text: 'Debugger resumed',
              },
            ],
          }
        }

        case 'debugger-step': {
          const { sessionId, type } = args as any
          const client = manager.getClient()
          
          const stepMethod = type === 'into' ? 'Debugger.stepInto' : 
                               type === 'over' ? 'Debugger.stepOver' : 
                               'Debugger.stepOut'
          await client.send(stepMethod, {}, sessionId)
          
          return {
            content: [
              {
                type: 'text',
                text: `Stepped ${type}`,
              },
            ],
          }
        }

        case 'profiler-start': {
          const { sessionId } = args as any
          const client = manager.getClient()
          
          await client.send('Profiler.enable', {}, sessionId)
          await client.send('Profiler.start', {}, sessionId)
          
          return {
            content: [
              {
                type: 'text',
                text: 'CPU profiling started',
              },
            ],
          }
        }

        case 'profiler-stop': {
          const { sessionId } = args as any
          const client = manager.getClient()
          
          const profile = await client.send('Profiler.stop', {}, sessionId)
          await client.send('Profiler.disable', {}, sessionId)
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(profile, null, 2),
              },
            ],
          }
        }

        default:
          throw new Error(`Unknown tool: ${name}`)
      }
    } catch (error) {
      logger.error({ error, tool: name }, 'Tool execution failed')
      
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      }
    }
  })
}