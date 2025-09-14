/**
 * @fileoverview Curupira Logging and Telemetry API
 * 
 * This module provides structured logging and telemetry collection
 * for the Curupira MCP debugging tool.
 * 
 * @example Basic Logging
 * ```typescript
 * import { createLogger, initializeLogger } from '@curupira/shared/logging'
 * 
 * // Initialize global logger
 * const logger = initializeLogger({
 *   level: 'info',
 *   environment: 'development',
 *   service: 'curupira-server',
 *   version: '1.0.0',
 *   enablePerformanceLogging: true,
 *   enableRedaction: true,
 *   redactedFields: []
 * })
 * 
 * // Use contextual logging
 * logger.info({ sessionId: 'session-123' }, 'User session started')
 * ```
 * 
 * @example Performance Monitoring
 * ```typescript
 * import { withTiming, createPerformanceMonitor } from '@curupira/shared/logging'
 * 
 * // Automatic timing
 * const result = await withTiming('api-call', async () => {
 *   return await fetch('/api/data')
 * })
 * 
 * // Manual timing
 * const monitor = createPerformanceMonitor()
 * monitor.start('operation')
 * // ... do work
 * monitor.end('operation')
 * ```
 * 
 * @example Telemetry Collection
 * ```typescript
 * import { telemetry, initializeTelemetry } from '@curupira/shared/logging'
 * 
 * // Initialize telemetry
 * initializeTelemetry({
 *   enabled: true,
 *   sampling: { performance: 1.0, usage: 1.0 },
 *   endpoints: { metrics: 'https://telemetry.example.com' }
 * })
 * 
 * // Record metrics
 * telemetry.performance('api-call', 150, true)
 * telemetry.usage('debugger', 'breakpoint_set', sessionId)
 * telemetry.health('websocket', 'healthy')
 * ```
 */

// Logger exports
export {
  createLogger,
  redactSensitiveData,
  PerformanceMonitor,
  ContextualLogger,
  initializeLogger,
  getLogger,
  createPerformanceMonitor,
  withTiming,
  LOG_LEVELS,
  isValidLogLevel
} from './logger.js'

export type {
  LogContext,
  PerformanceTiming,
  CurupiraLoggerConfig,
  SimpleLoggerConfig,
  Logger
} from './logger.js'

// Telemetry exports
export {
  TelemetryCollector,
  DEFAULT_TELEMETRY_CONFIG,
  initializeTelemetry,
  getTelemetry,
  telemetry
} from './telemetry.js'

export type {
  MetricType,
  MetricPoint,
  PerformanceMetric,
  UsageMetric,
  HealthMetric,
  StateMetric,
  NetworkMetric,
  Metric,
  TelemetryConfig
} from './telemetry.js'

// Re-export types needed from config
export type { LogLevel, Environment } from '../config/index.js'

/**
 * Version information
 */
export const LOGGING_VERSION = '1.0.0'