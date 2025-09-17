/**
 * Performance Tool Provider Factory - Level 2 (MCP Core)
 * Factory implementation for performance monitoring tool provider
 */

import type { IToolProviderFactory, ProviderDependencies } from '../provider.factory.js';
import { BaseProviderFactory } from '../provider.factory.js';
import type { BaseToolProviderConfig } from '../base-tool-provider.js';
import { BaseToolProvider } from '../base-tool-provider.js';
import type { Schema } from '../../../core/interfaces/validator.interface.js';
import type { ToolResult } from '../registry.js';
import { withCDPCommand, withScriptExecution } from '../patterns/common-handlers.js';

// Schema definitions
const metricsSchema: Schema<{ sessionId?: string }> = {
  parse: (value) => {
    const obj = (value || {}) as any;
    return {
      sessionId: obj.sessionId
    };
  },
  safeParse: (value) => {
    try {
      return { success: true, data: metricsSchema.parse(value) };
    } catch (error) {
      return { success: false, error };
    }
  }
};

class PerformanceToolProvider extends BaseToolProvider {
  protected initializeTools(): void {
    // Register performance_get_metrics tool
    this.registerTool({
      name: 'performance_get_metrics',
      description: 'Get performance metrics',
      argsSchema: metricsSchema,
      handler: async (args, context) => {
        // Enable Performance domain first
        await withCDPCommand('Performance.enable', {}, context);
        
        const result = await withCDPCommand(
          'Performance.getMetrics',
          {},
          context
        );

        if (result.isErr()) {
          return {
            success: false,
            error: result.unwrapErr()
          };
        }

        const metrics = result.unwrap() as any;
        
        // Convert metrics array to object for easier access
        const metricsObj: Record<string, any> = {};
        
        // Debug: Add raw CDP metrics response
        metricsObj.cdpMetrics = metrics;
        
        if (metrics.metrics && Array.isArray(metrics.metrics)) {
          metricsObj.cdpMetricsCount = metrics.metrics.length;
          for (const metric of metrics.metrics) {
            if (metric && metric.name && metric.value !== undefined) {
              metricsObj[metric.name] = metric.value;
            }
          }
        } else {
          metricsObj.cdpMetricsCount = 0;
          metricsObj.cdpMetricsError = 'No metrics array found';
        }

        // Get comprehensive browser performance info
        const perfResult = await withCDPCommand(
          'Runtime.evaluate',
          {
            expression: `(() => {
              const timing = performance.timing || {};
              const memory = performance.memory || {};
              const navigation = performance.navigation || {};
              
              // Get performance entries
              const entries = performance.getEntriesByType ? {
                navigation: performance.getEntriesByType('navigation'),
                paint: performance.getEntriesByType('paint'),
                measure: performance.getEntriesByType('measure'),
                mark: performance.getEntriesByType('mark')
              } : {};
              
              return {
                timestamp: Date.now(),
                timing: {
                  navigationStart: timing.navigationStart,
                  domContentLoadedEventStart: timing.domContentLoadedEventStart,
                  domContentLoadedEventEnd: timing.domContentLoadedEventEnd,
                  loadEventStart: timing.loadEventStart,
                  loadEventEnd: timing.loadEventEnd,
                  domComplete: timing.domComplete,
                  domInteractive: timing.domInteractive
                },
                memory: {
                  usedJSHeapSize: memory.usedJSHeapSize,
                  totalJSHeapSize: memory.totalJSHeapSize,
                  jsHeapSizeLimit: memory.jsHeapSizeLimit
                },
                navigation: {
                  type: navigation.type,
                  redirectCount: navigation.redirectCount
                },
                performanceEntries: entries,
                now: performance.now()
              };
            })()`,
            returnByValue: true
          },
          context
        );

        if (perfResult.isOk()) {
          const result = perfResult.unwrap() as any;
          if (result.result?.value) {
            metricsObj.browserPerformance = result.result.value;
          } else {
            metricsObj.browserPerformanceError = 'Failed to get browser performance data';
            metricsObj.browserPerformanceResult = result;
          }
        } else {
          metricsObj.browserPerformanceError = perfResult.unwrapErr();
        }

        return {
          success: true,
          data: metricsObj
        };
      }
    });

    // Register performance_start_timeline tool
    this.registerTool({
      name: 'performance_start_timeline',
      description: 'Start recording performance timeline',
      argsSchema: {
        parse: (value) => value || {},
        safeParse: (value) => ({ success: true, data: value || {} })
      },
      handler: async (args, context) => {
        // Enable necessary domains
        await withCDPCommand('Page.enable', {}, context);
        
        const result = await withCDPCommand(
          'Tracing.start',
          {
            categories: 'devtools.timeline,blink.user_timing,loading,rail',
            options: 'sampling-frequency=100'
          },
          context
        );

        if (result.isErr()) {
          return {
            success: false,
            error: result.unwrapErr()
          };
        }

        return {
          success: true,
          data: { message: 'Performance timeline recording started' }
        };
      }
    });

    // Register performance_stop_timeline tool
    this.registerTool({
      name: 'performance_stop_timeline',
      description: 'Stop recording performance timeline',
      argsSchema: {
        parse: (value) => value || {},
        safeParse: (value) => ({ success: true, data: value || {} })
      },
      handler: async (args, context) => {
        const result = await withCDPCommand(
          'Tracing.end',
          {},
          context
        );

        if (result.isErr()) {
          return {
            success: false,
            error: result.unwrapErr()
          };
        }

        // Note: In real implementation, we'd collect and process the trace data
        return {
          success: true,
          data: { 
            message: 'Performance timeline recording stopped',
            hint: 'Trace data would be available via Tracing.tracingComplete event'
          }
        };
      }
    });

    // Register performance_measure_js tool
    this.registerTool({
      name: 'performance_measure_js',
      description: 'Measure JavaScript execution time',
      argsSchema: {
        parse: (value) => {
          if (typeof value !== 'object' || value === null) {
            throw new Error('Expected object');
          }
          const obj = value as any;
          const code = obj.code || obj.expression;
          if (typeof code !== 'string') {
            throw new Error('code/expression must be a string');
          }
          return {
            code,
            iterations: (() => {
              if (typeof obj.iterations === 'number') {
                return Math.max(1, obj.iterations);
              }
              if (typeof obj.iterations === 'string') {
                const parsed = parseInt(obj.iterations, 10);
                return isNaN(parsed) ? 1 : Math.max(1, parsed);
              }
              return 1;
            })(),
            sessionId: obj.sessionId
          };
        },
        safeParse: function(value) {
          try {
            const parsed = this.parse(value);
            return { success: true, data: parsed };
          } catch (error) {
            return { success: false, error };
          }
        }
      },
      handler: async (args, context) => {
        const measureScript = `
          (() => {
            const iterations = ${args.iterations};
            const times = [];
            
            for (let i = 0; i < iterations; i++) {
              const start = performance.now();
              ${args.code};
              const end = performance.now();
              times.push(end - start);
            }
            
            const total = times.reduce((a, b) => a + b, 0);
            const average = total / iterations;
            const min = Math.min(...times);
            const max = Math.max(...times);
            
            return {
              iterations,
              totalTime: total,
              averageTime: average,
              minTime: min,
              maxTime: max,
              times: times.slice(0, 10) // First 10 measurements
            };
          })()
        `;

        const result = await withScriptExecution(measureScript, context);

        if (result.isErr()) {
          return {
            success: false,
            error: result.unwrapErr()
          };
        }

        return {
          success: true,
          data: result.unwrap()
        };
      }
    });

    // Register performance_get_coverage tool
    this.registerTool({
      name: 'performance_get_coverage',
      description: 'Get code coverage information',
      argsSchema: {
        parse: (value) => value || {},
        safeParse: (value) => ({ success: true, data: value || {} })
      },
      handler: async (args, context) => {
        // Start coverage
        await withCDPCommand('Profiler.enable', {}, context);
        await withCDPCommand('Profiler.startPreciseCoverage', {
          callCount: true,
          detailed: true
        }, context);

        // Wait a bit for coverage to collect
        await new Promise(resolve => setTimeout(resolve, 100));

        // Get coverage
        const result = await withCDPCommand(
          'Profiler.takePreciseCoverage',
          {},
          context
        );

        if (result.isErr()) {
          return {
            success: false,
            error: result.unwrapErr()
          };
        }

        // Stop coverage
        await withCDPCommand('Profiler.stopPreciseCoverage', {}, context);

        return {
          success: true,
          data: result.unwrap()
        };
      }
    });

    // Register performance_memory_snapshot tool
    this.registerTool({
      name: 'performance_memory_snapshot',
      description: 'Take a memory heap snapshot',
      argsSchema: {
        parse: (value) => value || {},
        safeParse: (value) => ({ success: true, data: value || {} })
      },
      handler: async (args, context) => {
        try {
          // Enable HeapProfiler for detailed memory analysis
          await withCDPCommand('HeapProfiler.enable', {}, context);
          
          // Get memory info from Runtime
          const jsHeapResult = await withCDPCommand(
            'Runtime.getHeapUsage',
            {},
            context
          );

          if (jsHeapResult.isErr()) {
            return {
              success: false,
              error: jsHeapResult.unwrapErr()
            };
          }

          // Also get performance memory metrics
          await withCDPCommand('Performance.enable', {}, context);
          const performanceResult = await withCDPCommand(
            'Performance.getMetrics',
            {},
            context
          );

          const heap = jsHeapResult.unwrap() as any;
          const metrics = performanceResult.isOk() ? performanceResult.unwrap() as any : { metrics: [] };

          // Extract and format memory-related metrics
          const memoryMetrics: Record<string, any> = {
            summary: {
              usedMB: Math.round(heap.usedSize / 1024 / 1024 * 100) / 100,
              totalMB: Math.round(heap.totalSize / 1024 / 1024 * 100) / 100,
              percentUsed: Math.round(heap.usedSize / heap.totalSize * 100)
            },
            detailed: {}
          };
          
          for (const metric of metrics.metrics || []) {
            if (metric.name.includes('Memory') || metric.name.includes('Heap')) {
              const valueMB = Math.round(metric.value / 1024 / 1024 * 100) / 100;
              memoryMetrics.detailed[metric.name] = {
                bytes: metric.value,
                mb: valueMB
              };
            }
          }

          // Get additional memory statistics via JavaScript
          const memStatsScript = `
            (() => {
              const stats = {
                objects: {},
                arrays: {},
                functions: {}
              };
              
              // Sample object counts (in production, would use heap profiler)
              if (window.performance && window.performance.memory) {
                stats.browser = {
                  totalJSHeapSize: performance.memory.totalJSHeapSize,
                  usedJSHeapSize: performance.memory.usedJSHeapSize,
                  jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
                };
              }
              
              return stats;
            })()
          `;
          
          const statsResult = await withScriptExecution(memStatsScript, context);
          const additionalStats = statsResult.isOk() ? statsResult.unwrap() : {};

          return {
            success: true,
            data: {
              heap: {
                usedBytes: heap.usedSize,
                totalBytes: heap.totalSize,
                ...memoryMetrics.summary
              },
              metrics: memoryMetrics.detailed,
              browserMemory: additionalStats.browser,
              timestamp: new Date().toISOString(),
              recommendations: [
                heap.usedSize / heap.totalSize > 0.9 ? '⚠️ High memory usage detected' : '✅ Memory usage is healthy',
                'Use performance_analyze_runtime for detailed analysis',
                'Consider using Chrome DevTools Memory Profiler for heap snapshots'
              ]
            }
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to analyze memory'
          };
        }
      }
    });
    // Register performance_analyze_runtime tool
    this.registerTool({
      name: 'performance_analyze_runtime',
      description: 'Analyze JavaScript runtime performance',
      argsSchema: {
        parse: (value) => value || {},
        safeParse: (value) => ({ success: true, data: value || {} })
      },
      handler: async (args, context) => {
        const analysisScript = `
          (() => {
            const analysis = {
              memory: {},
              timing: {},
              resources: {},
              paint: {},
              vitals: {}
            };

            // Memory analysis
            if (window.performance && window.performance.memory) {
              const mem = performance.memory;
              analysis.memory = {
                used: Math.round(mem.usedJSHeapSize / 1024 / 1024 * 100) / 100 + ' MB',
                total: Math.round(mem.totalJSHeapSize / 1024 / 1024 * 100) / 100 + ' MB',
                limit: Math.round(mem.jsHeapSizeLimit / 1024 / 1024 * 100) / 100 + ' MB',
                usage: Math.round(mem.usedJSHeapSize / mem.totalJSHeapSize * 100) + '%'
              };
            }

            // Timing analysis
            if (window.performance && window.performance.timing) {
              const timing = performance.timing;
              const navigationStart = timing.navigationStart;
              
              analysis.timing = {
                domContentLoaded: timing.domContentLoadedEventEnd - navigationStart + ' ms',
                loadComplete: timing.loadEventEnd - navigationStart + ' ms',
                domInteractive: timing.domInteractive - navigationStart + ' ms',
                domComplete: timing.domComplete - navigationStart + ' ms'
              };
            }

            // Paint timing
            const paintEntries = performance.getEntriesByType('paint');
            paintEntries.forEach(entry => {
              if (entry.name === 'first-paint') {
                analysis.paint.firstPaint = Math.round(entry.startTime) + ' ms';
              } else if (entry.name === 'first-contentful-paint') {
                analysis.paint.firstContentfulPaint = Math.round(entry.startTime) + ' ms';
              }
            });

            // Web Vitals (simplified)
            const navEntries = performance.getEntriesByType('navigation');
            if (navEntries.length > 0) {
              const nav = navEntries[0];
              analysis.vitals.TTFB = Math.round(nav.responseStart - nav.requestStart) + ' ms';
            }

            // Resource timing
            const resources = performance.getEntriesByType('resource');
            const resourceTypes = {};
            
            resources.forEach(resource => {
              const type = resource.initiatorType || 'other';
              if (!resourceTypes[type]) {
                resourceTypes[type] = { count: 0, totalDuration: 0, totalSize: 0 };
              }
              resourceTypes[type].count++;
              resourceTypes[type].totalDuration += resource.duration;
              resourceTypes[type].totalSize += resource.transferSize || 0;
            });

            analysis.resources = {
              total: resources.length,
              byType: {}
            };

            Object.keys(resourceTypes).forEach(type => {
              analysis.resources.byType[type] = {
                count: resourceTypes[type].count,
                avgDuration: Math.round(resourceTypes[type].totalDuration / resourceTypes[type].count) + ' ms',
                totalSize: Math.round(resourceTypes[type].totalSize / 1024) + ' KB'
              };
            });

            // Long tasks
            const longTasks = performance.getEntriesByType('longtask') || [];
            if (longTasks.length > 0) {
              analysis.longTasks = {
                count: longTasks.length,
                totalDuration: Math.round(longTasks.reduce((sum, task) => sum + task.duration, 0)) + ' ms',
                average: Math.round(longTasks.reduce((sum, task) => sum + task.duration, 0) / longTasks.length) + ' ms'
              };
            }

            return analysis;
          })()
        `;

        const result = await withScriptExecution(analysisScript, context);

        if (result.isErr()) {
          return {
            success: false,
            error: result.unwrapErr()
          };
        }

        const analysis = result.unwrap();
        return {
          success: true,
          data: {
            ...analysis,
            recommendations: [
              analysis.memory?.usage > '80%' ? '⚠️ High memory usage detected' : '✅ Memory usage is healthy',
              analysis.longTasks?.count > 0 ? `⚠️ ${analysis.longTasks.count} long tasks detected` : '✅ No long tasks detected',
              'Use performance_start_timeline for detailed tracing'
            ]
          }
        };
      }
    });
  }
}

export class PerformanceToolProviderFactory extends BaseProviderFactory<PerformanceToolProvider> {
  create(deps: ProviderDependencies): PerformanceToolProvider {
    const config: BaseToolProviderConfig = {
      name: 'performance',
      description: 'Performance monitoring and profiling tools'
    };

    return new PerformanceToolProvider(
      deps.chromeService,
      this.createProviderLogger(deps, config.name),
      deps.validator,
      config
    );
  }
}