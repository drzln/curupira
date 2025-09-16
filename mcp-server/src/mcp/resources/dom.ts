import type { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { ListResourcesRequestSchema, ReadResourceRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import type { ILogger } from '../../core/interfaces/logger.interface.js'
import type { IChromeService } from '../../core/interfaces/chrome-service.interface.js'
import { Result } from '@curupira/shared'

// DOM element information
interface DOMElementInfo {
  tagName: string
  id?: string
  className?: string
  textContent?: string
  attributes: Record<string, string>
  children: DOMElementInfo[]
  querySelector: string
}

// DOM tree resource
interface DOMTreeResource {
  html: string
  elements: DOMElementInfo[]
  timestamp: number
  url: string
}

export function createDOMResourceProvider(
  chromeService: IChromeService,
  logger: ILogger
) {
  return {
    name: 'dom',
    
    async listResources() {
      try {
        const client = chromeService.getCurrentClient()
        if (!client) {
          return [{
            uri: 'dom://current',
            name: 'DOM Tree',
            description: 'Current DOM structure (Chrome not connected)',
            mimeType: 'application/json'
          }]
        }
        
        // For now, return a single DOM resource
        // In the future, we could enumerate multiple tabs
        return [{
          uri: 'dom://current',
          name: 'DOM Tree',
          description: 'Current DOM structure of the active page',
          mimeType: 'application/json'
        }]
      } catch (error) {
        logger.error({ error }, 'Failed to list DOM resources')
        return []
      }
    },
    
    async readResource(uri: string) {
      try {
        if (uri !== 'dom://current') {
          throw new Error(`Invalid DOM resource URI: ${uri}`)
        }
        
        const client = chromeService.getCurrentClient()
        if (!client) {
          return {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              error: 'Chrome not connected',
              message: 'Unable to access DOM - Chrome DevTools connection not established'
            }, null, 2)
          }
        }
        
        try {
          // Get current DOM structure using Chrome DevTools Protocol
          const result = await client.send('Runtime.evaluate', {
            expression: `
              (() => {
                function serializeElement(element, maxDepth = 3, currentDepth = 0) {
                  if (currentDepth >= maxDepth) {
                    return {
                      tagName: element.tagName,
                      truncated: true
                    }
                  }
                  
                  const attributes = {}
                  for (const attr of element.attributes || []) {
                    attributes[attr.name] = attr.value
                  }
                  
                  return {
                    tagName: element.tagName,
                    id: element.id || undefined,
                    className: element.className || undefined,
                    textContent: element.childNodes.length === 1 && 
                                 element.childNodes[0].nodeType === 3 
                                 ? element.textContent?.trim().substring(0, 100)
                                 : undefined,
                    attributes,
                    children: Array.from(element.children).slice(0, 10).map(child => 
                      serializeElement(child, maxDepth, currentDepth + 1)
                    ),
                    querySelector: generateSelector(element)
                  }
                }
                
                function generateSelector(element) {
                  if (element.id) {
                    return '#' + element.id
                  }
                  
                  let selector = element.tagName.toLowerCase()
                  if (element.className) {
                    selector += '.' + element.className.split(' ').slice(0, 3).join('.')
                  }
                  
                  return selector
                }
                
                return {
                  title: document.title,
                  url: window.location.href,
                  elements: [serializeElement(document.documentElement)],
                  timestamp: Date.now(),
                  metadata: {
                    readyState: document.readyState,
                    characterSet: document.characterSet,
                    contentType: document.contentType
                  }
                }
              })()
            `,
            returnByValue: true
          })
          
          const domData = result.result?.value || { error: 'Failed to serialize DOM' }
          
          return {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(domData, null, 2)
          }
        } catch (evaluationError) {
          logger.error({ error: evaluationError }, 'Failed to evaluate DOM script')
          return {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              error: 'DOM evaluation failed',
              message: evaluationError instanceof Error ? evaluationError.message : String(evaluationError)
            }, null, 2)
          }
        }
      } catch (error) {
        logger.error({ error, uri }, 'Failed to read DOM resource')
        throw error
      }
    }
  }
}

export function setupDOMResource(server: Server) {
  // Legacy setup function - deprecated, use factory pattern instead
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [{
        uri: 'dom://current',
        name: 'Current DOM Tree',
        description: 'The current DOM structure of the page',
        mimeType: 'application/json'
      }]
    }
  })
  
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    if (request.params?.uri === 'dom://current') {
      return {
        contents: [{
          type: 'text' as const,
          text: JSON.stringify({
            message: 'DOM resource provider not fully connected to Chrome service yet'
          }, null, 2)
        }]
      }
    }
    throw new Error(`Unknown resource: ${request.params?.uri}`)
  })
}