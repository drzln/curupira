/**
 * Chrome DevTools Protocol - Performance Domain Types
 * https://chromedevtools.github.io/devtools-protocol/tot/Performance/
 */

export namespace Performance {
  export interface Metric {
    name: string
    value: number
  }

  // Commands
  export interface DisableParams {
    // No parameters
  }

  export interface EnableParams {
    timeDomain?: 'timeTicks' | 'threadTicks'
  }

  export interface GetMetricsResult {
    metrics: Metric[]
  }

  // Events
  export interface MetricsEvent {
    metrics: Metric[]
    title: string
  }
}