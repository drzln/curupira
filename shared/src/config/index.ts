/**
 * @fileoverview Configuration module public API
 * 
 * This is the main entry point for configuration-related functionality.
 */

// Re-export schema types and validators
export type {
  Environment,
  LogLevel,
  ServerConfig,
  AuthConfig,
  FeatureFlags,
  Limits,
  CurupiraConfig
} from './schema.js'

export {
  EnvironmentSchema,
  LogLevelSchema,
  ServerConfigSchema,
  AuthConfigSchema,
  FeatureFlagsSchema,
  LimitsSchema,
  CurupiraConfigSchema,
  DEFAULT_DEVELOPMENT_CONFIG,
  DEFAULT_STAGING_CONFIG,
  DEFAULT_PRODUCTION_CONFIG,
  ENV_VAR_MAPPING,
  ConfigValidationError,
  validateConfig,
  getDefaultConfig
} from './schema.js'

// Re-export loader functionality
export type {
  ConfigLoaderOptions
} from './loader.js'

export {
  ConfigLoadError,
  loadConfigFromEnv,
  mergeConfigs,
  loadConfig,
  reloadConfig,
  createConfigValidator,
  globalConfig,
  getConfigOrDefault
} from './loader.js'

// Re-export project configuration
export type {
  ProjectConfig
} from './project-config.js'

export {
  ProjectConfigLoader
} from './project-config.js'

// Import functions for convenience export
import {
  loadConfig,
  loadConfigFromEnv,
  mergeConfigs
} from './loader.js'
import {
  getDefaultConfig,
  validateConfig
} from './schema.js'

// Convenience exports
export const config = {
  /**
   * Load configuration with validation
   */
  load: loadConfig,
  
  /**
   * Load configuration from environment variables only
   */
  fromEnv: loadConfigFromEnv,
  
  /**
   * Get default configuration for environment
   */
  defaults: getDefaultConfig,
  
  /**
   * Validate configuration object
   */
  validate: validateConfig,
  
  /**
   * Merge multiple configuration objects
   */
  merge: mergeConfigs
}