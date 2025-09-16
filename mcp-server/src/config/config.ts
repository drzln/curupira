/**
 * Configuration management following Nexus standards
 * 
 * Loads configuration in order:
 * 1. Base YAML (config/base.yaml)
 * 2. Environment YAML (config/{environment}.yaml)
 * 3. Environment variable overrides
 */

import { z } from 'zod'
import type { CDPConnectionOptions } from '@curupira/shared/types'
import { loadConfig as loadNexusConfig, type CurupiraConfig as NexusConfig } from './nexus-config.js'

export interface LegacyCurupiraConfig {
  // Chrome DevTools Protocol connection
  cdp: CDPConnectionOptions
  
  // Server configuration
  server?: {
    transport?: 'stdio' | 'http' | 'sse'
    port?: number
    corsOrigins?: string[]
  }
  
  // Logging configuration
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error'
    pretty: boolean
  }
  
  // Resource configuration
  resources: {
    maxConsoleLogEntries: number
    maxNetworkRequests: number
    cacheSize: number
  }
  
  // Performance settings
  performance: {
    maxMessageSize: number
    debounceMs: number
    throttleMs: number
  }
}

// Legacy Configuration schema
const legacyConfigSchema = z.object({
  cdp: z.object({
    host: z.string().default('localhost'),
    port: z.number().default(3000),
    secure: z.boolean().default(false),
    timeout: z.number().default(10000),
    retryAttempts: z.number().default(3),
    retryDelay: z.number().default(1000),
  }),
  server: z.object({
    transport: z.enum(['stdio', 'http', 'sse']).optional(),
    port: z.number().optional(),
    corsOrigins: z.array(z.string()).optional(),
  }).optional(),
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    pretty: z.boolean().default(process.env.NODE_ENV !== 'production'),
  }),
  resources: z.object({
    maxConsoleLogEntries: z.number().default(1000),
    maxNetworkRequests: z.number().default(500),
    cacheSize: z.number().default(100),
  }),
  performance: z.object({
    maxMessageSize: z.number().default(1048576), // 1MB
    debounceMs: z.number().default(250),
    throttleMs: z.number().default(100),
  }),
})

/**
 * Load configuration from environment variables (Legacy)
 * @deprecated Use loadConfig() for Nexus-compliant configuration
 */
function loadCurupiraConfig(): LegacyCurupiraConfig {
  const env = process.env
  
  const config = {
    cdp: {
      host: env.CURUPIRA_CDP_HOST || 'localhost',
      port: parseInt(env.CURUPIRA_CDP_PORT || '3000', 10),
      secure: env.CURUPIRA_CDP_SECURE === 'true',
      timeout: parseInt(env.CURUPIRA_CDP_TIMEOUT || '10000', 10),
      retryAttempts: parseInt(env.CURUPIRA_CDP_RETRY_ATTEMPTS || '3', 10),
      retryDelay: parseInt(env.CURUPIRA_CDP_RETRY_DELAY || '1000', 10),
    },
    server: env.CURUPIRA_TRANSPORT ? {
      transport: env.CURUPIRA_TRANSPORT as any,
      port: env.CURUPIRA_PORT ? parseInt(env.CURUPIRA_PORT, 10) : undefined,
      corsOrigins: env.CURUPIRA_CORS_ORIGINS ? env.CURUPIRA_CORS_ORIGINS.split(',') : undefined,
    } : undefined,
    logging: {
      level: (env.CURUPIRA_LOG_LEVEL || 'info') as any,
      pretty: env.CURUPIRA_LOG_PRETTY !== 'false',
    },
    resources: {
      maxConsoleLogEntries: parseInt(env.CURUPIRA_MAX_CONSOLE_LOGS || '1000', 10),
      maxNetworkRequests: parseInt(env.CURUPIRA_MAX_NETWORK_REQUESTS || '500', 10),
      cacheSize: parseInt(env.CURUPIRA_CACHE_SIZE || '100', 10),
    },
    performance: {
      maxMessageSize: parseInt(env.CURUPIRA_MAX_MESSAGE_SIZE || '1048576', 10),
      debounceMs: parseInt(env.CURUPIRA_DEBOUNCE_MS || '250', 10),
      throttleMs: parseInt(env.CURUPIRA_THROTTLE_MS || '100', 10),
    },
  }
  
  // Validate configuration
  const result = legacyConfigSchema.safeParse(config)
  if (!result.success) {
    throw new Error(`Invalid configuration: ${result.error.message}`)
  }
  
  return result.data as LegacyCurupiraConfig
}

// Export Nexus configuration as the primary config system
export { type CurupiraConfig } from './nexus-config.js'

/**
 * Load configuration using Nexus standards
 * This is the recommended way to load configuration
 */
export async function loadConfig(): Promise<NexusConfig> {
  return loadNexusConfig()
}

/**
 * Legacy configuration loader for backward compatibility
 * @deprecated Use loadConfig() instead
 */
export function loadLegacyConfig(): LegacyCurupiraConfig {
  return loadCurupiraConfig()
}

/**
 * Get default configuration (Legacy)
 * @deprecated Use loadConfig() for Nexus-compliant configuration
 */
export function getDefaultConfig(): LegacyCurupiraConfig {
  return legacyConfigSchema.parse({})
}

/**
 * Configuration for different environments
 */
export const envConfigs = {
  development: {
    cdp: {
      host: 'localhost',
      port: 3000,
    },
    logging: {
      level: 'debug',
      pretty: true,
    },
  },
  staging: {
    cdp: {
      host: 'chrome-headless.shared-services.svc.cluster.local',
      port: 3000,
    },
    logging: {
      level: 'info',
      pretty: false,
    },
  },
  production: {
    cdp: {
      host: 'chrome-headless.shared-services.svc.cluster.local',
      port: 3000,
    },
    logging: {
      level: 'warn',
      pretty: false,
    },
    performance: {
      maxMessageSize: 524288, // 512KB
      debounceMs: 500,
      throttleMs: 200,
    },
  },
}