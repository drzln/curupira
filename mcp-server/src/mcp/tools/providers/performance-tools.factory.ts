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
        const metricsObj: Record<string, number> = {};
        if (metrics.metrics) {
          for (const metric of metrics.metrics) {
            metricsObj[metric.name] = metric.value;
          }
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
          if (typeof obj.expression !== 'string') {
            throw new Error('expression must be a string');
          }
          return {
            expression: obj.expression,
            iterations: typeof obj.iterations === 'number' ? obj.iterations : 1,
            sessionId: obj.sessionId
          };
        },
        safeParse: (value) => {
          try {
            const obj = (value || {}) as any;
            return { 
              success: true, 
              data: {
                expression: obj.expression || '',
                iterations: typeof obj.iterations === 'number' ? obj.iterations : 1,
                sessionId: obj.sessionId
              }
            };
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
              ${args.expression};
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
        // Get memory info
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
        const performanceResult = await withCDPCommand(
          'Performance.getMetrics',
          {},
          context
        );

        const heap = jsHeapResult.unwrap() as any;
        const metrics = performanceResult.isOk() ? performanceResult.unwrap() as any : { metrics: [] };

        // Extract memory-related metrics
        const memoryMetrics: Record<string, number> = {};
        for (const metric of metrics.metrics || []) {
          if (metric.name.toLowerCase().includes('memory') || 
              metric.name.toLowerCase().includes('heap')) {
            memoryMetrics[metric.name] = metric.value;
          }
        }

        return {
          success: true,
          data: {
            jsHeapUsed: heap.usedSize,
            jsHeapTotal: heap.totalSize,
            additionalMetrics: memoryMetrics,
            timestamp: new Date().toISOString()
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