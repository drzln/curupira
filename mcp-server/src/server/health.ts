/**
 * Health check implementation
 * 
 * Provides comprehensive health status for the MCP server
 */

import type { ChromeClient } from '../chrome/client.js'
import { logger } from '../config/logger.js'

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  uptime: number
  checks: {
    chrome: {
      connected: boolean
      version?: string
      targets?: number
    }
    memory: {
      heapUsed: number
      heapTotal: number
      external: number
      rss: number
    }
    resources: {
      available: boolean
      count?: number
    }
    tools: {
      available: boolean
      count?: number
    }
  }
  errors?: string[]
}

export class HealthChecker {
  private startTime: number = Date.now()
  private chromeClient: ChromeClient
  private resourceCount: number = 0
  private toolCount: number = 0

  constructor(chromeClient: ChromeClient) {
    this.chromeClient = chromeClient
  }

  /**
   * Update counts from providers
   */
  updateCounts(resources: number, tools: number) {
    this.resourceCount = resources
    this.toolCount = tools
  }

  /**
   * Perform health check
   */
  async check(): Promise<HealthStatus> {
    const errors: string[] = []
    const memoryUsage = process.memoryUsage()

    // Check Chrome connection
    const chromeCheck = await this.checkChrome()
    if (!chromeCheck.connected) {
      errors.push('Chrome DevTools Protocol not connected')
    }

    // Check memory usage
    const memoryCheck = this.checkMemory(memoryUsage)
    if (memoryCheck.warning) {
      errors.push(memoryCheck.warning)
    }

    // Determine overall status
    let status: HealthStatus['status'] = 'healthy'
    if (errors.length > 0) {
      status = chromeCheck.connected ? 'degraded' : 'unhealthy'
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      checks: {
        chrome: chromeCheck,
        memory: {
          heapUsed: memoryUsage.heapUsed,
          heapTotal: memoryUsage.heapTotal,
          external: memoryUsage.external,
          rss: memoryUsage.rss,
        },
        resources: {
          available: this.resourceCount > 0,
          count: this.resourceCount,
        },
        tools: {
          available: this.toolCount > 0,
          count: this.toolCount,
        },
      },
      errors: errors.length > 0 ? errors : undefined,
    }
  }

  /**
   * Check Chrome connection
   */
  private async checkChrome(): Promise<HealthStatus['checks']['chrome']> {
    try {
      const isConnected = this.chromeClient.getConnectionState() === 'connected'
      
      if (!isConnected) {
        return { connected: false }
      }

      // Try to get version info
      const version = await this.chromeClient.send('Browser.getVersion')
      const targets = await this.chromeClient.send('Target.getTargets')

      return {
        connected: true,
        version: version.product,
        targets: targets.targetInfos?.length || 0,
      }
    } catch (error) {
      logger.error({ error }, 'Chrome health check failed')
      return { connected: false }
    }
  }

  /**
   * Check memory usage
   */
  private checkMemory(usage: NodeJS.MemoryUsage): { warning?: string } {
    const heapUsedMB = usage.heapUsed / 1024 / 1024
    const heapTotalMB = usage.heapTotal / 1024 / 1024
    const heapPercentage = (usage.heapUsed / usage.heapTotal) * 100

    // Warn if heap usage is over 80%
    if (heapPercentage > 80) {
      return {
        warning: `High memory usage: ${heapUsedMB.toFixed(2)}MB / ${heapTotalMB.toFixed(2)}MB (${heapPercentage.toFixed(1)}%)`,
      }
    }

    // Warn if total heap is over 500MB
    if (heapUsedMB > 500) {
      return {
        warning: `High absolute memory usage: ${heapUsedMB.toFixed(2)}MB`,
      }
    }

    return {}
  }

  /**
   * Get simple health status
   */
  async getSimpleStatus(): Promise<{ healthy: boolean; message: string }> {
    const health = await this.check()
    
    return {
      healthy: health.status === 'healthy',
      message: health.status === 'healthy' 
        ? 'All systems operational' 
        : health.errors?.join(', ') || 'System degraded',
    }
  }

  /**
   * Get metrics for monitoring
   */
  getMetrics() {
    const memoryUsage = process.memoryUsage()
    const uptime = Date.now() - this.startTime

    return {
      uptime_seconds: Math.floor(uptime / 1000),
      memory_heap_used_bytes: memoryUsage.heapUsed,
      memory_heap_total_bytes: memoryUsage.heapTotal,
      memory_external_bytes: memoryUsage.external,
      memory_rss_bytes: memoryUsage.rss,
      chrome_connected: this.chromeClient.getConnectionState() === 'connected' ? 1 : 0,
      resources_count: this.resourceCount,
      tools_count: this.toolCount,
    }
  }
}