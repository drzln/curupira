/**
 * @fileoverview Tests for Curupira configuration system
 * 
 * These tests ensure configuration loading, validation, and
 * environment variable processing work correctly.
 */

import { describe, test, expect, beforeEach, vi } from 'vitest'
import {
  Environment,
  CurupiraConfig,
  validateConfig,
  getDefaultConfig,
  ConfigValidationError,
  loadConfig,
  loadConfigFromEnv,
  mergeConfigs,
  ConfigLoadError,
  createConfigValidator,
  getConfigOrDefault,
  config,
  DEFAULT_DEVELOPMENT_CONFIG,
  DEFAULT_STAGING_CONFIG,
  DEFAULT_PRODUCTION_CONFIG
} from '../index.js'

describe('Configuration Schema', () => {
  test('validates correct configuration', () => {
    const validConfig: CurupiraConfig = {
      environment: 'development',
      logLevel: 'debug',
      server: {
        port: 8080,
        host: 'localhost',
        cors: {
          origins: ['http://localhost:3000'],
          credentials: true
        }
      },
      auth: {
        enabled: false,
        tokenExpiry: 3600000
      },
      features: {
        timeTravel: true,
        profiling: true,
        breakpoints: true,
        networkInterception: true
      },
      limits: {
        maxSessions: 10,
        maxEvents: 1000,
        maxRecordingDuration: 3600000,
        maxMemoryUsage: 100 * 1024 * 1024
      }
    }
    
    expect(() => validateConfig(validConfig)).not.toThrow()
    const result = validateConfig(validConfig)
    expect(result).toEqual(validConfig)
  })
  
  test('rejects invalid configuration', () => {
    const invalidConfigs = [
      // Invalid environment
      { ...DEFAULT_DEVELOPMENT_CONFIG, environment: 'invalid' },
      // Invalid port
      { ...DEFAULT_DEVELOPMENT_CONFIG, server: { ...DEFAULT_DEVELOPMENT_CONFIG.server, port: 100 } },
      // Invalid log level
      { ...DEFAULT_DEVELOPMENT_CONFIG, logLevel: 'invalid' },
      // Missing required fields
      { environment: 'development' }
    ]
    
    invalidConfigs.forEach(config => {
      expect(() => validateConfig(config)).toThrow(ConfigValidationError)
    })
  })
  
  test('ConfigValidationError contains details', () => {
    try {
      validateConfig({ environment: 'invalid' })
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigValidationError)
      expect((error as ConfigValidationError).errors).toBeDefined()
      expect((error as ConfigValidationError).message).toContain('Configuration validation failed')
    }
  })
})

describe('Default Configurations', () => {
  test('development config is valid', () => {
    expect(() => validateConfig(DEFAULT_DEVELOPMENT_CONFIG)).not.toThrow()
    expect(DEFAULT_DEVELOPMENT_CONFIG.environment).toBe('development')
    expect(DEFAULT_DEVELOPMENT_CONFIG.logLevel).toBe('debug')
    expect(DEFAULT_DEVELOPMENT_CONFIG.auth.enabled).toBe(false)
  })
  
  test('staging config is valid', () => {
    expect(() => validateConfig(DEFAULT_STAGING_CONFIG)).not.toThrow()
    expect(DEFAULT_STAGING_CONFIG.environment).toBe('staging')
    expect(DEFAULT_STAGING_CONFIG.logLevel).toBe('info')
    expect(DEFAULT_STAGING_CONFIG.auth.enabled).toBe(true)
  })
  
  test('production config is valid', () => {
    expect(() => validateConfig(DEFAULT_PRODUCTION_CONFIG)).not.toThrow()
    expect(DEFAULT_PRODUCTION_CONFIG.environment).toBe('production')
    expect(DEFAULT_PRODUCTION_CONFIG.logLevel).toBe('warn')
    expect(DEFAULT_PRODUCTION_CONFIG.auth.enabled).toBe(true)
    expect(DEFAULT_PRODUCTION_CONFIG.features.timeTravel).toBe(false)
  })
  
  test('getDefaultConfig returns correct config for environment', () => {
    expect(getDefaultConfig('development')).toEqual(DEFAULT_DEVELOPMENT_CONFIG)
    expect(getDefaultConfig('staging')).toEqual(DEFAULT_STAGING_CONFIG)
    expect(getDefaultConfig('production')).toEqual(DEFAULT_PRODUCTION_CONFIG)
  })
  
  test('getDefaultConfig throws for unknown environment', () => {
    expect(() => getDefaultConfig('unknown' as Environment)).toThrow()
  })
})

describe('Environment Variable Loading', () => {
  test('loads configuration from environment variables', () => {
    const envVars = {
      CURUPIRA_PORT: '9090',
      CURUPIRA_HOST: '0.0.0.0',
      CURUPIRA_CORS_ORIGINS: 'http://localhost:3000,http://localhost:5173',
      CURUPIRA_AUTH_ENABLED: 'true',
      CURUPIRA_JWT_SECRET: 'super-secret-jwt-key-32-chars-min',
      CURUPIRA_TOKEN_EXPIRY: '7200000',
      CURUPIRA_TIME_TRAVEL: 'false',
      CURUPIRA_PROFILING: 'true',
      CURUPIRA_ENV: 'staging',
      CURUPIRA_LOG_LEVEL: 'warn'
    }
    
    const config = loadConfigFromEnv(envVars)
    
    expect(config.server?.port).toBe(9090)
    expect(config.server?.host).toBe('0.0.0.0')
    expect(config.server?.cors?.origins).toEqual(['http://localhost:3000', 'http://localhost:5173'])
    expect(config.auth?.enabled).toBe(true)
    expect(config.auth?.jwtSecret).toBe('super-secret-jwt-key-32-chars-min')
    expect(config.auth?.tokenExpiry).toBe(7200000)
    expect(config.features?.timeTravel).toBe(false)
    expect(config.features?.profiling).toBe(true)
    expect(config.environment).toBe('staging')
    expect(config.logLevel).toBe('warn')
  })
  
  test('handles invalid environment variables', () => {
    const invalidEnvVars = {
      CURUPIRA_PORT: 'not-a-number'
    }
    
    const config = loadConfigFromEnv(invalidEnvVars)
    // parseInt returns NaN for invalid numbers
    expect(config.server?.port).toBeNaN()
  })
  
  test('ignores empty environment variables', () => {
    const envVars = {
      CURUPIRA_PORT: '',
      CURUPIRA_HOST: undefined,
      CURUPIRA_AUTH_ENABLED: 'true'
    }
    
    const config = loadConfigFromEnv(envVars)
    
    expect(config.server?.port).toBeUndefined()
    expect(config.server?.host).toBeUndefined()
    expect(config.auth?.enabled).toBe(true)
  })
})

describe('Configuration Merging', () => {
  test('merges configurations correctly', () => {
    const base = {
      environment: 'development' as Environment,
      server: {
        port: 8080,
        host: 'localhost',
        cors: { origins: ['http://localhost:3000'], credentials: true }
      }
    }
    
    const override = {
      server: {
        port: 9090,
        cors: { origins: ['http://localhost:5173'], credentials: false }
      },
      auth: {
        enabled: true
      }
    }
    
    const merged = mergeConfigs(base, override)
    
    expect(merged.environment).toBe('development')
    expect(merged.server?.port).toBe(9090)
    expect(merged.server?.host).toBe('localhost')
    expect(merged.server?.cors?.origins).toEqual(['http://localhost:5173'])
    expect(merged.server?.cors?.credentials).toBe(false)
    expect(merged.auth?.enabled).toBe(true)
  })
  
  test('handles null and undefined values', () => {
    const base = { environment: 'development' as Environment }
    const nullConfig = null as any
    const undefinedConfig = undefined as any
    
    const merged = mergeConfigs(base, nullConfig, undefinedConfig)
    
    expect(merged).toEqual(base)
  })
})

describe('Configuration Loading', () => {
  beforeEach(() => {
    // Clear process.env mocks
    vi.unstubAllEnvs()
  })
  
  test('loads configuration with default environment', () => {
    const config = loadConfig()
    
    expect(config).toBeDefined()
    expect(config.environment).toBe('development') // Default
    expect(() => validateConfig(config)).not.toThrow()
  })
  
  test('loads configuration with specified environment', () => {
    const config = loadConfig({ environment: 'production' })
    
    expect(config.environment).toBe('production')
    expect(config.features.timeTravel).toBe(false) // Production settings
  })
  
  test('loads configuration with environment overrides', () => {
    const config = loadConfig({
      envOverrides: {
        CURUPIRA_ENV: 'staging',
        CURUPIRA_PORT: '9090'
      }
    })
    
    expect(config.environment).toBe('staging')
    expect(config.server.port).toBe(9090)
  })
  
  test('loads configuration with custom config', () => {
    const config = loadConfig({
      customConfig: {
        server: {
          port: 7070,
          host: 'custom-host',
          cors: { origins: ['http://custom.com'], credentials: true }
        }
      }
    })
    
    expect(config.server.port).toBe(7070)
    expect(config.server.host).toBe('custom-host')
  })
  
  test('skips environment variables when requested', () => {
    const config = loadConfig({
      skipEnvVars: true,
      envOverrides: {
        CURUPIRA_PORT: '9999' // Should be ignored
      }
    })
    
    expect(config.server.port).toBe(DEFAULT_DEVELOPMENT_CONFIG.server.port)
  })
  
  test('throws ConfigValidationError on validation failure', () => {
    expect(() => loadConfig({
      customConfig: {
        server: {
          port: 50, // Invalid port
          host: '',
          cors: { origins: [], credentials: true }
        }
      } as any
    })).toThrow(ConfigValidationError)
  })
})

describe('Configuration Validator', () => {
  test('validator loads and retrieves configuration', () => {
    const validator = createConfigValidator()
    
    const config = validator.load({ environment: 'development' })
    expect(config.environment).toBe('development')
    
    const retrievedConfig = validator.get()
    expect(retrievedConfig).toEqual(config)
    
    expect(validator.isLoaded()).toBe(true)
  })
  
  test('validator throws when getting unloaded config', () => {
    const validator = createConfigValidator()
    
    expect(() => validator.get()).toThrow(ConfigLoadError)
    expect(validator.isLoaded()).toBe(false)
  })
  
  test('validator can reload configuration', () => {
    const validator = createConfigValidator()
    
    const initial = validator.load({ environment: 'development' })
    expect(initial.server.port).toBe(8080)
    
    const reloaded = validator.reload({ CURUPIRA_PORT: '9090' })
    expect(reloaded.server.port).toBe(9090)
    
    const retrieved = validator.get()
    expect(retrieved.server.port).toBe(9090)
  })
})

describe('Utility Functions', () => {
  test('getConfigOrDefault returns config on success', () => {
    const config = getConfigOrDefault({ environment: 'staging' })
    
    expect(config.environment).toBe('staging')
  })
  
  test('getConfigOrDefault returns development default on error', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    
    const config = getConfigOrDefault({
      customConfig: {
        server: { port: -1 } // Invalid
      } as any
    })
    
    expect(config.environment).toBe('development')
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to load configuration'),
      expect.any(Error)
    )
    
    consoleSpy.mockRestore()
  })
})

describe('Convenience API', () => {
  test('config object provides all functions', () => {
    expect(typeof config.load).toBe('function')
    expect(typeof config.fromEnv).toBe('function')
    expect(typeof config.defaults).toBe('function')
    expect(typeof config.validate).toBe('function')
    expect(typeof config.merge).toBe('function')
  })
  
  test('config functions work correctly', () => {
    const envConfig = config.fromEnv({ CURUPIRA_PORT: '8888' })
    expect(envConfig.server?.port).toBe(8888)
    
    const defaultConfig = config.defaults('production')
    expect(defaultConfig.environment).toBe('production')
    
    const merged = config.merge(
      { environment: 'development' as Environment },
      { server: { port: 9999, host: 'test', cors: { origins: ['test'], credentials: true } } }
    )
    expect(merged.server?.port).toBe(9999)
    
    expect(() => config.validate(DEFAULT_DEVELOPMENT_CONFIG)).not.toThrow()
  })
})

describe('Performance', () => {
  test('configuration loading is fast', () => {
    const iterations = 1000
    const start = performance.now()
    
    for (let i = 0; i < iterations; i++) {
      loadConfig({ environment: 'development' })
    }
    
    const duration = performance.now() - start
    const loadsPerMs = iterations / duration
    
    // Should be able to load configs reasonably fast
    expect(loadsPerMs).toBeGreaterThan(1)
  })
  
  test('validation is fast', () => {
    const iterations = 10000
    const config = DEFAULT_DEVELOPMENT_CONFIG
    const start = performance.now()
    
    for (let i = 0; i < iterations; i++) {
      validateConfig(config)
    }
    
    const duration = performance.now() - start
    const validationsPerMs = iterations / duration
    
    // Should be able to validate many configs per millisecond
    expect(validationsPerMs).toBeGreaterThan(50)
  })
})