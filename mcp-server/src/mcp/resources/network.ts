import type { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { ListResourcesRequestSchema, ReadResourceRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import type { ILogger } from '../../core/interfaces/logger.interface.js'
import type { IChromeService } from '../../core/interfaces/chrome-service.interface.js'
import { CircularBuffer } from '@curupira/shared'

// Network request resource type
interface NetworkRequestResource {
  id: string
  timestamp: number
  method: string
  url: string
  status?: number
  statusText?: string
  requestHeaders?: Record<string, string>
  responseHeaders?: Record<string, string>
  requestBody?: string
  responseBody?: string
  responseTime?: number
  error?: string
  sessionId: string
  tabUrl?: string
}

// Network monitoring state
interface NetworkMonitorState {
  isMonitoring: boolean
  sessionId?: string
  buffer: CircularBuffer<NetworkRequestResource>
}

export function createNetworkResourceProvider(
  chromeService: IChromeService,
  logger: ILogger
) {
  const networkBuffer = new CircularBuffer<NetworkRequestResource>(500)
  
  return {
    name: 'network',
    
    async listResources() {
      try {
        const client = chromeService.getCurrentClient()
        if (!client) {
          return [{
            uri: 'network://requests',
            name: 'Network Requests',
            description: 'HTTP requests and responses (Chrome not connected)',
            mimeType: 'application/json'
          }]
        }
        
        return [{
          uri: 'network://requests',
          name: 'Network Requests',
          description: 'HTTP requests and responses captured from the page',
          mimeType: 'application/json'
        }, {
          uri: 'network://performance',
          name: 'Network Performance',
          description: 'Network performance metrics and statistics',
          mimeType: 'application/json'
        }]
      } catch (error) {
        logger.error({ error }, 'Failed to list network resources')
        return []
      }
    },
    
    async readResource(uri: string) {
      try {
        const client = chromeService.getCurrentClient()
        
        if (uri === 'network://requests') {
          if (!client) {
            return {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                error: 'Chrome not connected',
                message: 'Unable to access network requests - Chrome DevTools connection not established',
                totalRequests: 0,
                requests: []
              }, null, 2)
            }
          }
          
          // For now, return a placeholder since real network monitoring requires setup
          const requests: NetworkRequestResource[] = [] // networkBuffer would have captured requests if monitoring was active
          
          return {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              totalRequests: requests.length,
              requests,
              message: 'Network monitoring is not yet fully implemented. This would capture HTTP requests in a real implementation.'
            }, null, 2)
          }
        }
        
        if (uri === 'network://performance') {
          if (!client) {
            return {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                error: 'Chrome not connected',
                message: 'Unable to access network performance - Chrome DevTools connection not established'
              }, null, 2)
            }
          }
          
          try {
            // Get basic performance metrics using Performance API
            const result = await client.send('Runtime.evaluate', {
              expression: `
                (() => {
                  if (!window.performance) {
                    return { error: 'Performance API not available' }
                  }
                  
                  const navigation = performance.getEntriesByType('navigation')[0]
                  const resources = performance.getEntriesByType('resource').slice(-20) // Last 20 resources
                  
                  return {
                    navigation: navigation ? {
                      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
                      loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
                      firstPaint: navigation.domContentLoadedEventEnd - navigation.fetchStart,
                      totalTime: navigation.loadEventEnd - navigation.fetchStart
                    } : null,
                    resources: resources.map(resource => ({
                      name: resource.name,
                      type: resource.initiatorType,
                      duration: resource.duration,
                      size: resource.transferSize || resource.encodedBodySize || 0,
                      startTime: resource.startTime
                    })),
                    summary: {
                      totalResources: resources.length,
                      averageDuration: resources.length > 0 
                        ? resources.reduce((sum, r) => sum + r.duration, 0) / resources.length 
                        : 0,
                      totalSize: resources.reduce((sum, r) => sum + (r.transferSize || r.encodedBodySize || 0), 0)
                    }
                  }
                })()
              `,
              returnByValue: true
            })
            
            const perfData = result.result?.value || { error: 'Failed to get performance data' }
            
            return {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(perfData, null, 2)
            }
          } catch (evaluationError) {
            logger.error({ error: evaluationError }, 'Failed to evaluate performance script')
            return {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                error: 'Performance evaluation failed',
                message: evaluationError instanceof Error ? evaluationError.message : String(evaluationError)
              }, null, 2)
            }
          }
        }
        
        throw new Error(`Invalid network resource URI: ${uri}`)
      } catch (error) {
        logger.error({ error, uri }, 'Failed to read network resource')
        throw error
      }
    }
  }
}

export function setupNetworkResource(server: Server) {
  const networkBuffer = new CircularBuffer<NetworkRequestResource>(500)
  
  // Legacy setup function - deprecated, use factory pattern instead
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [{
        uri: 'network://requests',
        name: 'Network Requests',
        description: 'HTTP requests and responses captured from the page',
        mimeType: 'application/json'
      }, {
        uri: 'network://performance',
        name: 'Network Performance',
        description: 'Network performance metrics and statistics',
        mimeType: 'application/json'
      }]
    }
  })
  
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    if (request.params?.uri === 'network://requests') {
      return {
        contents: [{
          type: 'text' as const,
          text: JSON.stringify({
            message: 'Network resource provider not fully connected to Chrome service yet',
            totalRequests: 0, // networkBuffer.size() is private
            recentRequests: [] // networkBuffer.getAll() may not be available
          }, null, 2)
        }]
      }
    }
    
    if (request.params?.uri === 'network://performance') {
      return {
        contents: [{
          type: 'text' as const,
          text: JSON.stringify({
            message: 'Network performance monitoring not yet implemented',
            placeholder: 'Will provide metrics like response times, success rates, etc.'
          }, null, 2)
        }]
      }
    }
    
    throw new Error(`Unknown resource: ${request.params?.uri}`)
  })
}