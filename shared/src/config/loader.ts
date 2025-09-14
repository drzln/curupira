/**
 * @fileoverview Configuration loader with environment variable support
 * 
 * This file handles loading configuration from environment variables,
 * files, and default values.
 */

import { 
  CurupiraConfig, 
  Environment,
  validateConfig,
  getDefaultConfig,
  ENV_VAR_MAPPING,
  ConfigValidationError
} from './schema.js'

/**
 * Configuration loader options
 */
export interface ConfigLoaderOptions {
  /** Environment to load config for */
  environment?: Environment
  /** Override environment variables */
  envOverrides?: Record<string, string>
  /** Skip environment variable loading */
  skipEnvVars?: boolean
  /** Custom config object to merge */
  customConfig?: Partial<CurupiraConfig>
}

/**
 * Configuration loading error
 */
export class ConfigLoadError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message)
    this.name = 'ConfigLoadError'
  }
}

/**
 * Loads configuration from environment variables
 */
export const loadConfigFromEnv = (
  envVars: Record<string, string | undefined> = process.env
): Partial<CurupiraConfig> => {
  const config: any = {}
  
  // Helper to set nested property
  const setNestedProperty = (obj: any, path: string[], value: any) => {
    let current = obj
    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i]
      if (!(key in current)) {
        current[key] = {}
      }
      current = current[key]
    }
    current[path[path.length - 1]] = value
  }
  
  // Map environment variables
  const mappings = {
    CURUPIRA_PORT: ['server', 'port'],
    CURUPIRA_HOST: ['server', 'host'],
    CURUPIRA_CORS_ORIGINS: ['server', 'cors', 'origins'],
    CURUPIRA_AUTH_ENABLED: ['auth', 'enabled'],
    CURUPIRA_JWT_SECRET: ['auth', 'jwtSecret'],
    CURUPIRA_TOKEN_EXPIRY: ['auth', 'tokenExpiry'],
    CURUPIRA_TIME_TRAVEL: ['features', 'timeTravel'],
    CURUPIRA_PROFILING: ['features', 'profiling'],
    CURUPIRA_BREAKPOINTS: ['features', 'breakpoints'],
    CURUPIRA_NETWORK_INTERCEPTION: ['features', 'networkInterception'],
    CURUPIRA_MAX_SESSIONS: ['limits', 'maxSessions'],
    CURUPIRA_MAX_EVENTS: ['limits', 'maxEvents'],
    CURUPIRA_MAX_RECORDING_DURATION: ['limits', 'maxRecordingDuration'],
    CURUPIRA_MAX_MEMORY_USAGE: ['limits', 'maxMemoryUsage'],
    CURUPIRA_ENV: ['environment'],
    CURUPIRA_LOG_LEVEL: ['logLevel']
  }
  
  // Process each environment variable
  Object.entries(mappings).forEach(([envVar, path]) => {
    const value = envVars[envVar]
    if (value !== undefined && value !== '') {
      try {
        const transformer = ENV_VAR_MAPPING[envVar as keyof typeof ENV_VAR_MAPPING]
        const transformedValue = transformer(value)
        setNestedProperty(config, path, transformedValue)
      } catch (error) {
        throw new ConfigLoadError(
          `Failed to parse environment variable ${envVar}=${value}`,
          error as Error
        )
      }
    }
  })
  
  return config
}

/**
 * Merges configuration objects with deep merge
 */
export const mergeConfigs = (...configs: Array<Partial<CurupiraConfig>>): Partial<CurupiraConfig> => {
  const result: any = {}
  
  configs.forEach(config => {
    if (!config) return
    
    Object.keys(config).forEach(key => {
      const value = (config as any)[key]
      if (value !== undefined && value !== null) {
        if (typeof value === 'object' && !Array.isArray(value)) {
          result[key] = { ...result[key], ...value }
        } else {
          result[key] = value
        }
      }
    })
  })
  
  return result
}

/**
 * Loads and validates complete configuration
 */
export const loadConfig = (options: ConfigLoaderOptions = {}): CurupiraConfig => {
  try {
    // Determine environment
    const env = options.environment || 
                (options.envOverrides?.CURUPIRA_ENV as Environment) ||
                (process.env.CURUPIRA_ENV as Environment) ||
                (process.env.NODE_ENV === 'production' ? 'production' : 'development')
    
    // Get default config for environment
    const defaultConfig = getDefaultConfig(env)
    
    // Load environment variables
    let envConfig: Partial<CurupiraConfig> = {}
    if (!options.skipEnvVars) {
      const envVars = { ...process.env, ...options.envOverrides }
      envConfig = loadConfigFromEnv(envVars)
    }
    
    // Merge all configurations
    const mergedConfig = mergeConfigs(
      defaultConfig,
      envConfig,
      options.customConfig || {}
    )
    
    // Validate final configuration
    return validateConfig(mergedConfig)
    
  } catch (error) {
    if (error instanceof ConfigValidationError) {
      throw error
    }
    throw new ConfigLoadError(
      `Failed to load configuration: ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? error : undefined
    )
  }
}

/**
 * Reloads configuration with new environment variables
 */
export const reloadConfig = (newEnvVars: Record<string, string>): CurupiraConfig => {
  return loadConfig({
    envOverrides: newEnvVars
  })
}

/**
 * Creates a configuration validator function
 */
export const createConfigValidator = () => {
  let currentConfig: CurupiraConfig | null = null
  
  return {
    load: (options?: ConfigLoaderOptions) => {
      currentConfig = loadConfig(options)
      return currentConfig
    },
    
    get: () => {
      if (!currentConfig) {
        throw new ConfigLoadError('Configuration not loaded. Call load() first.')
      }
      return currentConfig
    },
    
    reload: (envVars?: Record<string, string>) => {
      currentConfig = reloadConfig(envVars || {})
      return currentConfig
    },
    
    isLoaded: () => currentConfig !== null
  }
}

/**
 * Global configuration instance
 */
export const globalConfig = createConfigValidator()

/**
 * Utility to get config with fallback to default
 */
export const getConfigOrDefault = (options?: ConfigLoaderOptions): CurupiraConfig => {
  try {
    return loadConfig(options)
  } catch (error) {
    console.warn('Failed to load configuration, using development defaults:', error)
    return getDefaultConfig('development')
  }
}