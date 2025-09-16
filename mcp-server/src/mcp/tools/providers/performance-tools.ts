/**
 * Performance Tool Provider - Performance monitoring and analysis tools
 * Level 2: MCP Core (depends on Level 0-1)
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { SessionId } from '@curupira/shared/types'
import { ChromeManager } from '../../../chrome/manager.js'
import { logger } from '../../../config/logger.js'
import type { ToolProvider, ToolHandler, ToolResult } from '../registry.js'

export class PerformanceToolProvider implements ToolProvider {
  name = 'performance'
  
  listTools(): Tool[] {
    return [
      {
        name: 'performance_start_profiling',
        description: 'Start CPU profiling',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          }
        }
      },
      {
        name: 'performance_stop_profiling',
        description: 'Stop CPU profiling and get results',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          }
        }
      },
      {
        name: 'performance_measure_render',
        description: 'Measure React render performance',
        inputSchema: {
          type: 'object',
          properties: {
            componentName: { type: 'string', description: 'Component to measure (optional)' },
            duration: { type: 'number', description: 'Measurement duration in ms (default: 5000)' },
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          }
        }
      },
      {
        name: 'performance_analyze_bundle',
        description: 'Analyze JavaScript bundle sizes',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          }
        }
      },
      {
        name: 'performance_memory_snapshot',
        description: 'Take a memory heap snapshot',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          }
        }
      },
      {
        name: 'performance_get_metrics',
        description: 'Get performance metrics (FCP, LCP, etc)',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          }
        }
      },
      {
        name: 'performance_trace_start',
        description: 'Start performance trace recording',
        inputSchema: {
          type: 'object',
          properties: {
            categories: { 
              type: 'array', 
              items: { type: 'string' },
              description: 'Trace categories (optional)' 
            },
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          }
        }
      },
      {
        name: 'performance_trace_stop',
        description: 'Stop performance trace and get data',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', description: 'Chrome session ID (optional)' }
          }
        }
      }
    ]
  }
  
  getHandler(toolName: string): ToolHandler | undefined {
    const handlers: Record<string, ToolHandler> = {
      performance_start_profiling: {
        name: 'performance_start_profiling',
        description: 'Start CPU profiling',
        async execute(args): Promise<ToolResult> {
          try {
            const { sessionId: argSessionId } = args as { sessionId?: string }
            const sessionId = await this.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const client = manager.getClient()
            
            await client.send('Profiler.enable', {}, sessionId)
            await client.send('Profiler.start', {}, sessionId)
            
            return {
              success: true,
              data: {
                status: 'profiling_started',
                sessionId,
                timestamp: new Date().toISOString()
              }
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to start profiling'
            }
          }
        }
      },
      
      performance_stop_profiling: {
        name: 'performance_stop_profiling',
        description: 'Stop CPU profiling and get results',
        async execute(args): Promise<ToolResult> {
          try {
            const { sessionId: argSessionId } = args as { sessionId?: string }
            const sessionId = await this.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const client = manager.getClient()
            
            const profile = await client.send('Profiler.stop', {}, sessionId)
            
            // Analyze profile data
            const nodes = profile.profile.nodes || []
            const samples = profile.profile.samples || []
            const timeDeltas = profile.profile.timeDeltas || []
            
            // Calculate top functions by self time
            const selfTimes = new Map<number, number>()
            for (let i = 0; i < samples.length; i++) {
              const nodeId = samples[i]
              const timeDelta = timeDeltas[i] || 0
              selfTimes.set(nodeId, (selfTimes.get(nodeId) || 0) + timeDelta)
            }
            
            // Find hot functions
            const hotFunctions = Array.from(selfTimes.entries())
              .map(([nodeId, selfTime]) => {
                const node = nodes.find(n => n.id === nodeId)
                return {
                  functionName: node?.callFrame.functionName || 'anonymous',
                  url: node?.callFrame.url || '',
                  lineNumber: node?.callFrame.lineNumber || 0,
                  selfTime
                }
              })
              .sort((a, b) => b.selfTime - a.selfTime)
              .slice(0, 10)
            
            return {
              success: true,
              data: {
                status: 'profiling_stopped',
                duration: profile.profile.endTime - profile.profile.startTime,
                sampleCount: samples.length,
                hotFunctions,
                profile: {
                  startTime: profile.profile.startTime,
                  endTime: profile.profile.endTime,
                  nodes: nodes.length
                }
              }
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to stop profiling'
            }
          }
        }
      },
      
      performance_measure_render: {
        name: 'performance_measure_render',
        description: 'Measure React render performance',
        async execute(args): Promise<ToolResult> {
          try {
            const { 
              componentName, 
              duration = 5000,
              sessionId: argSessionId 
            } = args as { 
              componentName?: string;
              duration?: number;
              sessionId?: string 
            }
            const sessionId = await this.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const client = manager.getClient()
            
            await client.send('Runtime.enable', {}, sessionId)
            
            // Install render tracking
            await client.send('Runtime.evaluate', {
              expression: `
                window.__REACT_RENDER_DATA__ = {
                  renders: [],
                  startTime: Date.now()
                };
                
                if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
                  const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
                  const originalOnCommitFiberRoot = hook.onCommitFiberRoot;
                  
                  hook.onCommitFiberRoot = function(id, root) {
                    const renderData = {
                      timestamp: Date.now(),
                      duration: root.actualDuration || 0,
                      startTime: root.actualStartTime || 0,
                      commitTime: root.commitTime || 0,
                      interactions: root.memoizedInteractions ? Array.from(root.memoizedInteractions) : []
                    };
                    
                    // Try to get component info
                    if (root.current && root.current.elementType) {
                      renderData.componentName = root.current.elementType.displayName || 
                                                root.current.elementType.name || 
                                                'Unknown';
                    }
                    
                    window.__REACT_RENDER_DATA__.renders.push(renderData);
                    
                    if (originalOnCommitFiberRoot) {
                      originalOnCommitFiberRoot.apply(this, arguments);
                    }
                  };
                  
                  'Render tracking installed';
                } else {
                  'React DevTools not found';
                }
              `,
              returnByValue: true
            }, sessionId)
            
            // Wait for measurement duration
            await new Promise(resolve => setTimeout(resolve, duration))
            
            // Collect results
            const result = await client.send('Runtime.evaluate', {
              expression: `
                (() => {
                  const data = window.__REACT_RENDER_DATA__;
                  if (!data) return { error: 'No render data collected' };
                  
                  const endTime = Date.now();
                  const totalDuration = endTime - data.startTime;
                  const renders = data.renders;
                  
                  // Filter by component if specified
                  const filteredRenders = '${componentName}' ? 
                    renders.filter(r => r.componentName && r.componentName.includes('${componentName}')) :
                    renders;
                  
                  // Calculate statistics
                  const stats = {
                    totalRenders: filteredRenders.length,
                    totalDuration,
                    averageRenderTime: filteredRenders.length > 0 ?
                      filteredRenders.reduce((sum, r) => sum + r.duration, 0) / filteredRenders.length : 0,
                    maxRenderTime: Math.max(...filteredRenders.map(r => r.duration), 0),
                    minRenderTime: Math.min(...filteredRenders.map(r => r.duration), Infinity),
                    rendersPerSecond: (filteredRenders.length / totalDuration) * 1000
                  };
                  
                  // Top components by render count
                  const componentCounts = {};
                  filteredRenders.forEach(r => {
                    const name = r.componentName || 'Unknown';
                    componentCounts[name] = (componentCounts[name] || 0) + 1;
                  });
                  
                  const topComponents = Object.entries(componentCounts)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 10)
                    .map(([name, count]) => ({ name, count }));
                  
                  // Cleanup
                  delete window.__REACT_RENDER_DATA__;
                  
                  return {
                    stats,
                    topComponents,
                    sampleRenders: filteredRenders.slice(-10)
                  };
                })()
              `,
              returnByValue: true
            }, sessionId)
            
            if (result.exceptionDetails) {
              return {
                success: false,
                error: `Error measuring renders: ${result.exceptionDetails.text}`
              }
            }
            
            const data = result.result.value as any
            if (data.error) {
              return {
                success: false,
                error: data.error
              }
            }
            
            return {
              success: true,
              data
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to measure render performance'
            }
          }
        }
      },
      
      performance_analyze_bundle: {
        name: 'performance_analyze_bundle',
        description: 'Analyze JavaScript bundle sizes',
        async execute(args): Promise<ToolResult> {
          try {
            const { sessionId: argSessionId } = args as { sessionId?: string }
            const sessionId = await this.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const client = manager.getClient()
            
            await client.send('Runtime.enable', {}, sessionId)
            
            // Get all script sources
            const scripts = await client.send('Runtime.evaluate', {
              expression: `
                (() => {
                  const scripts = Array.from(document.scripts);
                  return scripts.map(script => ({
                    src: script.src || 'inline',
                    size: script.text ? script.text.length : 0,
                    async: script.async,
                    defer: script.defer,
                    type: script.type || 'text/javascript'
                  }));
                })()
              `,
              returnByValue: true
            }, sessionId)
            
            // Get resource timing data
            const resources = await client.send('Runtime.evaluate', {
              expression: `
                (() => {
                  const resources = performance.getEntriesByType('resource')
                    .filter(r => r.initiatorType === 'script');
                  
                  return resources.map(r => ({
                    name: r.name,
                    size: r.transferSize || r.encodedBodySize || 0,
                    duration: r.duration,
                    startTime: r.startTime,
                    compressed: r.encodedBodySize !== r.decodedBodySize
                  }));
                })()
              `,
              returnByValue: true
            }, sessionId)
            
            const scriptData = scripts.result.value as any[]
            const resourceData = resources.result.value as any[]
            
            // Combine data
            const bundles = resourceData.map(resource => {
              const script = scriptData.find(s => s.src === resource.name)
              return {
                url: resource.name,
                size: resource.size,
                duration: resource.duration,
                compressed: resource.compressed,
                async: script?.async || false,
                defer: script?.defer || false
              }
            }).sort((a, b) => b.size - a.size)
            
            // Calculate totals
            const totalSize = bundles.reduce((sum, b) => sum + b.size, 0)
            const totalDuration = bundles.reduce((sum, b) => sum + b.duration, 0)
            
            return {
              success: true,
              data: {
                bundles: bundles.slice(0, 20), // Top 20 bundles
                summary: {
                  totalBundles: bundles.length,
                  totalSize,
                  totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
                  totalLoadTime: totalDuration,
                  averageBundleSize: bundles.length > 0 ? totalSize / bundles.length : 0
                }
              }
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to analyze bundle'
            }
          }
        }
      },
      
      performance_memory_snapshot: {
        name: 'performance_memory_snapshot',
        description: 'Take a memory heap snapshot',
        async execute(args): Promise<ToolResult> {
          try {
            const { sessionId: argSessionId } = args as { sessionId?: string }
            const sessionId = await this.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const client = manager.getClient()
            
            // Get memory usage before snapshot
            await client.send('Runtime.enable', {}, sessionId)
            const memoryBefore = await client.send('Runtime.evaluate', {
              expression: 'performance.memory',
              returnByValue: true
            }, sessionId)
            
            // Take heap snapshot
            await client.send('HeapProfiler.enable', {}, sessionId)
            
            // We'll collect snapshot metadata rather than full snapshot
            const sampling = await client.send('HeapProfiler.startSampling', {}, sessionId)
            
            // Wait a bit to collect samples
            await new Promise(resolve => setTimeout(resolve, 1000))
            
            const profile = await client.send('HeapProfiler.stopSampling', {}, sessionId)
            
            // Get memory usage after
            const memoryAfter = await client.send('Runtime.evaluate', {
              expression: 'performance.memory',
              returnByValue: true
            }, sessionId)
            
            return {
              success: true,
              data: {
                memory: {
                  before: memoryBefore.result.value,
                  after: memoryAfter.result.value
                },
                heapProfile: {
                  samples: profile.profile.samples?.length || 0,
                  head: profile.profile.head ? 'Available' : 'Not available'
                },
                timestamp: new Date().toISOString()
              }
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to take memory snapshot'
            }
          }
        }
      },
      
      performance_get_metrics: {
        name: 'performance_get_metrics',
        description: 'Get performance metrics',
        async execute(args): Promise<ToolResult> {
          try {
            const { sessionId: argSessionId } = args as { sessionId?: string }
            const sessionId = await this.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const client = manager.getClient()
            
            // Get CDP metrics
            await client.send('Performance.enable', {}, sessionId)
            const metrics = await client.send('Performance.getMetrics', {}, sessionId)
            
            // Get Web Vitals
            await client.send('Runtime.enable', {}, sessionId)
            const webVitals = await client.send('Runtime.evaluate', {
              expression: `
                (() => {
                  const entries = performance.getEntries();
                  const navigation = performance.getEntriesByType('navigation')[0];
                  const paint = performance.getEntriesByType('paint');
                  
                  // Get largest contentful paint
                  const lcp = performance.getEntriesByType('largest-contentful-paint')
                    .slice(-1)[0];
                  
                  // Get first input delay
                  const fid = performance.getEntriesByType('first-input')[0];
                  
                  // Calculate cumulative layout shift
                  let cls = 0;
                  const layoutShifts = performance.getEntriesByType('layout-shift');
                  layoutShifts.forEach(entry => {
                    if (!entry.hadRecentInput) {
                      cls += entry.value;
                    }
                  });
                  
                  return {
                    // Core Web Vitals
                    LCP: lcp ? lcp.startTime : null,
                    FID: fid ? fid.processingStart - fid.startTime : null,
                    CLS: cls,
                    
                    // Other metrics
                    FCP: paint.find(p => p.name === 'first-contentful-paint')?.startTime || null,
                    TTFB: navigation ? navigation.responseStart - navigation.requestStart : null,
                    
                    // Navigation timing
                    domContentLoaded: navigation ? navigation.domContentLoadedEventEnd - navigation.fetchStart : null,
                    loadComplete: navigation ? navigation.loadEventEnd - navigation.fetchStart : null,
                    
                    // Resource counts
                    resources: entries.filter(e => e.entryType === 'resource').length,
                    
                    // Memory
                    memory: performance.memory ? {
                      usedJSHeapSize: performance.memory.usedJSHeapSize,
                      totalJSHeapSize: performance.memory.totalJSHeapSize,
                      jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
                    } : null
                  };
                })()
              `,
              returnByValue: true
            }, sessionId)
            
            // Format CDP metrics
            const cdpMetrics: Record<string, number> = {}
            metrics.metrics.forEach(metric => {
              cdpMetrics[metric.name] = metric.value
            })
            
            return {
              success: true,
              data: {
                webVitals: webVitals.result.value,
                cdpMetrics,
                timestamp: new Date().toISOString()
              }
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to get metrics'
            }
          }
        }
      },
      
      performance_trace_start: {
        name: 'performance_trace_start',
        description: 'Start performance trace recording',
        async execute(args): Promise<ToolResult> {
          try {
            const { categories, sessionId: argSessionId } = args as { 
              categories?: string[];
              sessionId?: string 
            }
            const sessionId = await this.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const client = manager.getClient()
            
            const defaultCategories = [
              'devtools.timeline',
              'v8.execute',
              'blink.user_timing',
              'latencyInfo',
              'disabled-by-default-devtools.timeline.frame',
              'disabled-by-default-devtools.timeline.stack'
            ]
            
            await client.send('Tracing.start', {
              categories: (categories || defaultCategories).join(','),
              options: 'sampling-frequency=10000'
            }, sessionId)
            
            return {
              success: true,
              data: {
                status: 'trace_started',
                categories: categories || defaultCategories,
                timestamp: new Date().toISOString()
              }
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to start trace'
            }
          }
        }
      },
      
      performance_trace_stop: {
        name: 'performance_trace_stop',
        description: 'Stop performance trace and get data',
        async execute(args): Promise<ToolResult> {
          try {
            const { sessionId: argSessionId } = args as { sessionId?: string }
            const sessionId = await this.getSessionId(argSessionId)
            
            const manager = ChromeManager.getInstance()
            const client = manager.getClient()
            
            // Collect trace events
            const events: any[] = []
            
            client.on('Tracing.dataCollected', (params) => {
              events.push(...params.value)
            })
            
            await client.send('Tracing.end', {}, sessionId)
            
            // Wait a bit for all events to be collected
            await new Promise(resolve => setTimeout(resolve, 1000))
            
            // Analyze trace events
            const summary = {
              totalEvents: events.length,
              categories: new Set(events.map(e => e.cat)).size,
              duration: events.length > 0 ? 
                Math.max(...events.map(e => e.ts || 0)) - Math.min(...events.map(e => e.ts || 0)) : 0,
              
              // Event type breakdown
              eventTypes: events.reduce((acc, event) => {
                acc[event.name] = (acc[event.name] || 0) + 1
                return acc
              }, {} as Record<string, number>)
            }
            
            // Find long tasks
            const longTasks = events
              .filter(e => e.dur && e.dur > 50000) // > 50ms
              .sort((a, b) => b.dur - a.dur)
              .slice(0, 10)
              .map(e => ({
                name: e.name,
                duration: e.dur / 1000, // Convert to ms
                category: e.cat
              }))
            
            return {
              success: true,
              data: {
                status: 'trace_stopped',
                summary,
                longTasks,
                sampleEvents: events.slice(0, 100), // First 100 events
                timestamp: new Date().toISOString()
              }
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to stop trace'
            }
          }
        }
      }
    }
    
    const handler = handlers[toolName]
    if (handler) {
      // Bind the execute method to this instance to preserve context
      return {
        ...handler,
        execute: handler.execute.bind(this)
      }
    }
    return undefined
  }
  
  private async getSessionId(argSessionId?: string): Promise<SessionId> {
    if (argSessionId) {
      return argSessionId as SessionId
    }
    
    const manager = ChromeManager.getInstance()
    const client = manager.getClient()
    const sessions = client.getSessions()
    
    if (sessions.length === 0) {
      throw new Error('No active Chrome session available')
    }
    
    return sessions[0].sessionId as SessionId
  }
}
