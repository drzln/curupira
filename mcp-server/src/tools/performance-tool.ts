/**
 * Performance profiling tool
 * 
 * Provides MCP tools for performance analysis and profiling
 */

import type { RuntimeDomain } from '../chrome/domains/runtime.js'
import type { PageDomain } from '../chrome/domains/page.js'
import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { logger } from '../config/logger.js'

// Tool parameter schemas
const captureMetricsSchema = z.object({
  categories: z.array(z.enum(['paint', 'layout', 'script', 'network', 'memory']))
    .optional()
    .describe('Metric categories to capture (default: all)')
})

const startProfilingSchema = z.object({
  categories: z.array(z.enum(['js', 'rendering', 'gc']))
    .optional()
    .describe('Profiling categories (default: all)')
})

const analyzeRenderingSchema = z.object({
  duration: z.number().optional().describe('Analysis duration in ms (default: 5000)')
})

const memorySnapshotSchema = z.object({
  detailed: z.boolean().optional().describe('Include detailed object information')
})

const analyzeLongTasksSchema = z.object({
  threshold: z.number().optional().describe('Long task threshold in ms (default: 50)')
})

const lighthouse = z.object({
  categories: z.array(z.enum(['performance', 'accessibility', 'best-practices', 'seo']))
    .optional()
    .describe('Lighthouse audit categories (default: performance)')
})

export class PerformanceTool {
  private readonly toolPrefix = 'performance'
  private profilingActive = false

  constructor(
    private runtime: RuntimeDomain,
    private page: PageDomain
  ) {}

  /**
   * List available performance tools
   */
  listTools(): Tool[] {
    return [
      {
        name: `${this.toolPrefix}/captureMetrics`,
        description: 'Capture current performance metrics',
        inputSchema: captureMetricsSchema as any
      },
      {
        name: `${this.toolPrefix}/startProfiling`,
        description: 'Start performance profiling',
        inputSchema: startProfilingSchema as any
      },
      {
        name: `${this.toolPrefix}/stopProfiling`,
        description: 'Stop profiling and get results',
        inputSchema: z.object({}) as any
      },
      {
        name: `${this.toolPrefix}/analyzeRendering`,
        description: 'Analyze rendering performance',
        inputSchema: analyzeRenderingSchema as any
      },
      {
        name: `${this.toolPrefix}/memorySnapshot`,
        description: 'Take memory snapshot',
        inputSchema: memorySnapshotSchema as any
      },
      {
        name: `${this.toolPrefix}/analyzeLongTasks`,
        description: 'Analyze long-running tasks',
        inputSchema: analyzeLongTasksSchema as any
      },
      {
        name: `${this.toolPrefix}/runLighthouse`,
        description: 'Run Lighthouse audit (simulated)',
        inputSchema: lighthouse as any
      }
    ]
  }

  /**
   * Call a tool
   */
  async callTool(name: string, args: unknown): Promise<any> {
    const toolName = name.replace(`${this.toolPrefix}/`, '')

    try {
      switch (toolName) {
        case 'captureMetrics':
          return this.captureMetrics(captureMetricsSchema.parse(args))
        
        case 'startProfiling':
          return this.startProfiling(startProfilingSchema.parse(args))
        
        case 'stopProfiling':
          return this.stopProfiling()
        
        case 'analyzeRendering':
          return this.analyzeRendering(analyzeRenderingSchema.parse(args))
        
        case 'memorySnapshot':
          return this.memorySnapshot(memorySnapshotSchema.parse(args))
        
        case 'analyzeLongTasks':
          return this.analyzeLongTasks(analyzeLongTasksSchema.parse(args))
        
        case 'runLighthouse':
          return this.runLighthouse(lighthouse.parse(args))
        
        default:
          throw new Error(`Unknown tool: ${name}`)
      }
    } catch (error) {
      logger.error('Performance tool execution failed', { name, args, error })
      throw error
    }
  }

  /**
   * Capture performance metrics
   */
  private async captureMetrics(args: z.infer<typeof captureMetricsSchema>) {
    const categories = args.categories || ['paint', 'layout', 'script', 'network', 'memory']
    const metrics: any = {}

    // Paint metrics
    if (categories.includes('paint')) {
      const paintMetrics = await this.runtime.evaluate<any>(`
        (() => {
          const entries = performance.getEntriesByType('paint');
          const navigation = performance.getEntriesByType('navigation')[0];
          
          return {
            firstPaint: entries.find(e => e.name === 'first-paint')?.startTime,
            firstContentfulPaint: entries.find(e => e.name === 'first-contentful-paint')?.startTime,
            largestContentfulPaint: (() => {
              const entries = performance.getEntriesByType('largest-contentful-paint');
              return entries[entries.length - 1]?.startTime;
            })(),
            domContentLoaded: navigation?.domContentLoadedEventEnd - navigation?.fetchStart,
            load: navigation?.loadEventEnd - navigation?.fetchStart
          };
        })()
      `)
      metrics.paint = paintMetrics.value
    }

    // Layout metrics
    if (categories.includes('layout')) {
      const layoutMetrics = await this.page.getLayoutMetrics()
      metrics.layout = {
        viewport: layoutMetrics.visualViewport,
        contentSize: layoutMetrics.contentSize
      }
    }

    // Script metrics
    if (categories.includes('script')) {
      const scriptMetrics = await this.runtime.evaluate<any>(`
        (() => {
          const measures = performance.getEntriesByType('measure')
            .filter(m => m.name.includes('script') || m.name.includes('js'));
          
          return {
            totalScriptTime: measures.reduce((sum, m) => sum + m.duration, 0),
            scriptCount: measures.length,
            longTasks: performance.getEntriesByType('longtask').map(t => ({
              duration: t.duration,
              startTime: t.startTime
            }))
          };
        })()
      `)
      metrics.script = scriptMetrics.value
    }

    // Network metrics
    if (categories.includes('network')) {
      const networkMetrics = await this.runtime.evaluate<any>(`
        (() => {
          const resources = performance.getEntriesByType('resource');
          const totalSize = resources.reduce((sum, r) => sum + (r.transferSize || 0), 0);
          const totalDuration = resources.reduce((sum, r) => sum + r.duration, 0);
          
          return {
            requestCount: resources.length,
            totalSize,
            totalDuration,
            averageDuration: resources.length > 0 ? totalDuration / resources.length : 0,
            byType: resources.reduce((acc, r) => {
              acc[r.initiatorType] = (acc[r.initiatorType] || 0) + 1;
              return acc;
            }, {})
          };
        })()
      `)
      metrics.network = networkMetrics.value
    }

    // Memory metrics
    if (categories.includes('memory')) {
      const memoryMetrics = await this.runtime.evaluate<any>(`
        (() => {
          if (!performance.memory) return null;
          
          return {
            usedJSHeapSize: performance.memory.usedJSHeapSize,
            totalJSHeapSize: performance.memory.totalJSHeapSize,
            jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
            usagePercent: (performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100
          };
        })()
      `)
      metrics.memory = memoryMetrics.value
    }

    return {
      timestamp: Date.now(),
      categories,
      metrics
    }
  }

  /**
   * Start profiling
   */
  private async startProfiling(args: z.infer<typeof startProfilingSchema>) {
    if (this.profilingActive) {
      return {
        started: false,
        reason: 'Profiling already active'
      }
    }

    const categories = args.categories || ['js', 'rendering', 'gc']

    // Install performance observer
    await this.runtime.evaluate(`
      (() => {
        window.__CURUPIRA_PROFILING__ = {
          startTime: performance.now(),
          entries: [],
          categories: ${JSON.stringify(categories)}
        };

        const observer = new PerformanceObserver((list) => {
          window.__CURUPIRA_PROFILING__.entries.push(...list.getEntries());
        });

        observer.observe({ 
          entryTypes: ['measure', 'mark', 'longtask', 'layout-shift', 'largest-contentful-paint'] 
        });

        window.__CURUPIRA_PROFILING__.observer = observer;
        return true;
      })()
    `)

    this.profilingActive = true

    return {
      started: true,
      categories,
      startTime: Date.now()
    }
  }

  /**
   * Stop profiling
   */
  private async stopProfiling() {
    if (!this.profilingActive) {
      return {
        stopped: false,
        reason: 'No active profiling session'
      }
    }

    const result = await this.runtime.evaluate<any>(`
      (() => {
        const profiling = window.__CURUPIRA_PROFILING__;
        if (!profiling) return null;

        profiling.observer.disconnect();
        const duration = performance.now() - profiling.startTime;

        // Analyze collected data
        const analysis = {
          duration,
          totalEntries: profiling.entries.length,
          byType: {},
          longTasks: [],
          layoutShifts: []
        };

        profiling.entries.forEach(entry => {
          analysis.byType[entry.entryType] = (analysis.byType[entry.entryType] || 0) + 1;
          
          if (entry.entryType === 'longtask') {
            analysis.longTasks.push({
              duration: entry.duration,
              startTime: entry.startTime
            });
          }
          
          if (entry.entryType === 'layout-shift') {
            analysis.layoutShifts.push({
              value: entry.value,
              startTime: entry.startTime
            });
          }
        });

        // Clean up
        delete window.__CURUPIRA_PROFILING__;
        
        return analysis;
      })()
    `)

    this.profilingActive = false

    return {
      stopped: true,
      profile: result.value
    }
  }

  /**
   * Analyze rendering performance
   */
  private async analyzeRendering(args: z.infer<typeof analyzeRenderingSchema>) {
    const duration = args.duration || 5000

    // Start monitoring
    await this.runtime.evaluate(`
      (() => {
        window.__CURUPIRA_RENDERING__ = {
          frames: 0,
          paints: 0,
          layouts: 0,
          startTime: performance.now()
        };

        // Monitor animation frames
        const frameCounter = () => {
          window.__CURUPIRA_RENDERING__.frames++;
          if (performance.now() - window.__CURUPIRA_RENDERING__.startTime < ${duration}) {
            requestAnimationFrame(frameCounter);
          }
        };
        requestAnimationFrame(frameCounter);

        // Monitor paint and layout events
        const observer = new PerformanceObserver((list) => {
          list.getEntries().forEach(entry => {
            if (entry.name.includes('paint')) {
              window.__CURUPIRA_RENDERING__.paints++;
            }
          });
        });
        observer.observe({ entryTypes: ['paint', 'layout-shift'] });
        window.__CURUPIRA_RENDERING__.observer = observer;
      })()
    `)

    // Wait for duration
    await new Promise(resolve => setTimeout(resolve, duration))

    // Collect results
    const result = await this.runtime.evaluate<any>(`
      (() => {
        const data = window.__CURUPIRA_RENDERING__;
        if (!data) return null;

        data.observer.disconnect();
        const actualDuration = performance.now() - data.startTime;
        
        const analysis = {
          duration: actualDuration,
          frames: data.frames,
          fps: data.frames / (actualDuration / 1000),
          paints: data.paints,
          paintsPerSecond: data.paints / (actualDuration / 1000)
        };

        // Clean up
        delete window.__CURUPIRA_RENDERING__;
        
        return analysis;
      })()
    `)

    return {
      duration,
      rendering: result.value,
      performance: {
        smooth: result.value?.fps >= 55,
        fps: result.value?.fps
      }
    }
  }

  /**
   * Take memory snapshot
   */
  private async memorySnapshot(args: z.infer<typeof memorySnapshotSchema>) {
    const snapshot = await this.runtime.evaluate<any>(`
      (() => {
        const snapshot = {
          timestamp: Date.now(),
          memory: performance.memory ? {
            usedJSHeapSize: performance.memory.usedJSHeapSize,
            totalJSHeapSize: performance.memory.totalJSHeapSize,
            jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
          } : null
        };

        if (${args.detailed || false}) {
          // Count objects by constructor
          const objects = {};
          const countObjects = (obj, visited = new WeakSet()) => {
            if (!obj || typeof obj !== 'object' || visited.has(obj)) return;
            visited.add(obj);
            
            const constructor = obj.constructor?.name || 'Object';
            objects[constructor] = (objects[constructor] || 0) + 1;
            
            // Limit recursion
            if (visited.size < 1000) {
              Object.values(obj).forEach(val => countObjects(val, visited));
            }
          };
          
          // Sample window object
          countObjects(window);
          snapshot.objects = objects;
        }

        return snapshot;
      })()
    `)

    return snapshot.value
  }

  /**
   * Analyze long tasks
   */
  private async analyzeLongTasks(args: z.infer<typeof analyzeLongTasksSchema>) {
    const threshold = args.threshold || 50

    const result = await this.runtime.evaluate<any>(`
      (() => {
        const longTasks = performance.getEntriesByType('longtask');
        const threshold = ${threshold};
        
        const analysis = {
          threshold,
          totalLongTasks: longTasks.length,
          totalDuration: longTasks.reduce((sum, t) => sum + t.duration, 0),
          tasks: longTasks.map(task => ({
            duration: task.duration,
            startTime: task.startTime,
            attribution: task.attribution?.[0]?.name || 'unknown'
          })),
          worstTask: null
        };
        
        if (longTasks.length > 0) {
          const worst = longTasks.reduce((max, t) => t.duration > max.duration ? t : max);
          analysis.worstTask = {
            duration: worst.duration,
            startTime: worst.startTime
          };
        }
        
        return analysis;
      })()
    `)

    return result.value
  }

  /**
   * Run Lighthouse audit (simulated)
   */
  private async runLighthouse(args: z.infer<typeof lighthouse>) {
    const categories = args.categories || ['performance']

    // This is a simplified version - real Lighthouse would require more setup
    const audits: any = {}

    if (categories.includes('performance')) {
      const metrics = await this.captureMetrics({ categories: ['paint', 'network', 'script'] })
      
      audits.performance = {
        score: this.calculatePerformanceScore(metrics.metrics),
        metrics: metrics.metrics,
        opportunities: [
          {
            id: 'render-blocking-resources',
            title: 'Eliminate render-blocking resources',
            description: 'Resources are blocking first paint',
            score: 0.7
          },
          {
            id: 'uses-responsive-images',
            title: 'Properly size images',
            description: 'Images should be sized appropriately',
            score: 0.8
          }
        ]
      }
    }

    return {
      categories,
      audits,
      timestamp: Date.now()
    }
  }

  /**
   * Calculate performance score
   */
  private calculatePerformanceScore(metrics: any): number {
    let score = 1.0

    // Penalize based on metrics
    if (metrics.paint?.firstContentfulPaint > 1800) score -= 0.2
    if (metrics.paint?.largestContentfulPaint > 2500) score -= 0.2
    if (metrics.script?.longTasks?.length > 2) score -= 0.1
    if (metrics.memory?.usagePercent > 80) score -= 0.1

    return Math.max(0, Math.min(1, score))
  }
}