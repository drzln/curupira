import type { Server } from '@modelcontextprotocol/sdk/server/index.js'
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
        const sessions = await chromeService.getActiveSessions()
        
        const resources = await Promise.all(
          sessions.map(async (session) => {
            try {
              const tabInfo = await chromeService.getTabInfo(session.id)
              return {
                uri: `dom://session/${session.id}`,
                name: `DOM Tree - ${tabInfo.title || session.id}`,
                description: `Current DOM structure for ${tabInfo.url || 'unknown'}`,
                mimeType: 'application/json'
              }
            } catch (error) {
              logger.warn({ error, sessionId: session.id }, 'Failed to get tab info for DOM resource')
              return {
                uri: `dom://session/${session.id}`,
                name: `DOM Tree - ${session.id}`,
                description: 'Current DOM structure',
                mimeType: 'application/json'
              }
            }
          })
        )
        
        return resources
      } catch (error) {
        logger.error({ error }, 'Failed to list DOM resources')
        return []
      }
    },
    
    async readResource(uri: string) {
      try {
        const match = uri.match(/^dom:\/\/session\/(.+)$/)
        if (!match) {
          throw new Error(`Invalid DOM resource URI: ${uri}`)
        }
        
        const sessionId = match[1]
        
        // Get current DOM structure
        const domResult = await chromeService.evaluateScript(
          sessionId,
          `
            (() => {
              function serializeElement(element, maxDepth = 5, currentDepth = 0) {
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
                               ? element.textContent?.trim() 
                               : undefined,
                  attributes,
                  children: Array.from(element.children).map(child => 
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
                  selector += '.' + element.className.split(' ').join('.')
                }
                
                return selector
              }
              
              return {
                html: document.documentElement.outerHTML,
                elements: [serializeElement(document.documentElement)],
                timestamp: Date.now(),
                url: window.location.href
              }
            })()
          `
        )
        
        if (domResult.isErr()) {
          throw new Error(`Failed to evaluate DOM script: ${domResult.error.message}`)
        }
        
        const domData = domResult.unwrap() as DOMTreeResource
        
        return {
          contents: [{
            type: 'text' as const,
            text: JSON.stringify(domData, null, 2)
          }]
        }
      } catch (error) {
        logger.error({ error, uri }, 'Failed to read DOM resource')
        throw error
      }
    }
  }
}

export function setupDOMResource(server: Server) {
  // Legacy setup function - will be replaced by factory pattern
  server.setRequestHandler('resources/list', async () => {
    return {
      resources: [{
        uri: 'dom://current',
        name: 'Current DOM Tree',
        description: 'The current DOM structure of the page',
        mimeType: 'application/json'
      }]
    }
  })
  
  server.setRequestHandler('resources/read', async (request) => {
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