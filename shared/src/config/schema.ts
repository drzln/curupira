/**
 * @fileoverview Configuration schema validation using Zod
 * 
 * This file defines the configuration schema for Curupira using Zod
 * for runtime validation and TypeScript type generation.
 */

import { z } from 'zod'
import type { Duration } from '../types/branded.js'

/**
 * Environment validation
 */
export const EnvironmentSchema = z.enum(['development', 'staging', 'production'])

/**
 * Log level validation following RFC 5424
 */
export const LogLevelSchema = z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])

/**
 * Server configuration schema
 */
export const ServerConfigSchema = z.object({
  port: z.number().min(1024).max(65535),
  host: z.string().min(1),
  cors: z.object({
    origins: z.array(z.string().url()).min(1),
    credentials: z.boolean()
  })
})

/**
 * Authentication configuration schema
 */
export const AuthConfigSchema = z.object({
  enabled: z.boolean(),
  jwtSecret: z.string().min(32).optional(),
  tokenExpiry: z.number().positive() // Duration in milliseconds
})

/**
 * Feature flags schema
 */
export const FeatureFlagsSchema = z.object({
  timeTravel: z.boolean(),
  profiling: z.boolean(),
  breakpoints: z.boolean(),
  networkInterception: z.boolean()
})

/**
 * Resource limits schema
 */
export const LimitsSchema = z.object({
  maxSessions: z.number().positive(),
  maxEvents: z.number().positive(),
  maxRecordingDuration: z.number().positive(), // Duration in milliseconds
  maxMemoryUsage: z.number().positive() // Bytes
})

/**
 * Complete Curupira configuration schema
 */
export const CurupiraConfigSchema = z.object({
  environment: EnvironmentSchema,
  logLevel: LogLevelSchema,
  server: ServerConfigSchema,
  auth: AuthConfigSchema,
  features: FeatureFlagsSchema,
  limits: LimitsSchema
})

/**
 * Type inference from Zod schemas
 */
export type Environment = z.infer<typeof EnvironmentSchema>
export type LogLevel = z.infer<typeof LogLevelSchema>
export type ServerConfig = z.infer<typeof ServerConfigSchema>
export type AuthConfig = z.infer<typeof AuthConfigSchema>
export type FeatureFlags = z.infer<typeof FeatureFlagsSchema>
export type Limits = z.infer<typeof LimitsSchema>
export type CurupiraConfig = z.infer<typeof CurupiraConfigSchema>

/**
 * Default configurations for different environments
 */
export const DEFAULT_DEVELOPMENT_CONFIG: CurupiraConfig = {
  environment: 'development',
  logLevel: 'debug',
  server: {
    port: 8080,
    host: 'localhost',
    cors: {
      origins: [
        'http://localhost:3000',
        'http://localhost:5173',
        'http://localhost:8080'
      ],
      credentials: true
    }
  },
  auth: {
    enabled: false,
    tokenExpiry: 24 * 60 * 60 * 1000 // 24 hours
  },
  features: {
    timeTravel: true,
    profiling: true,
    breakpoints: true,
    networkInterception: true
  },
  limits: {
    maxSessions: 10,
    maxEvents: 50000,
    maxRecordingDuration: 60 * 60 * 1000, // 1 hour
    maxMemoryUsage: 200 * 1024 * 1024 // 200MB
  }
}

export const DEFAULT_STAGING_CONFIG: CurupiraConfig = {
  environment: 'staging',
  logLevel: 'info',
  server: {
    port: 8080,
    host: '0.0.0.0',
    cors: {
      origins: [
        'https://novaskyn.staging.plo.quero.local',
        'https://curupira.novaskyn.staging.plo.quero.local'
      ],
      credentials: true
    }
  },
  auth: {
    enabled: true,
    tokenExpiry: 8 * 60 * 60 * 1000 // 8 hours
  },
  features: {
    timeTravel: true,
    profiling: true,
    breakpoints: true,
    networkInterception: true
  },
  limits: {
    maxSessions: 25,
    maxEvents: 100000,
    maxRecordingDuration: 2 * 60 * 60 * 1000, // 2 hours
    maxMemoryUsage: 500 * 1024 * 1024 // 500MB
  }
}

export const DEFAULT_PRODUCTION_CONFIG: CurupiraConfig = {
  environment: 'production',
  logLevel: 'warn',
  server: {
    port: 8080,
    host: '0.0.0.0',
    cors: {
      origins: [
        'https://novaskyn.com',
        'https://curupira.novaskyn.com'
      ],
      credentials: true
    }
  },
  auth: {
    enabled: true,
    tokenExpiry: 4 * 60 * 60 * 1000 // 4 hours
  },
  features: {
    timeTravel: false, // Disabled in prod for performance
    profiling: false,  // Disabled in prod for performance
    breakpoints: false, // Disabled in prod for security
    networkInterception: false // Disabled in prod for security
  },
  limits: {
    maxSessions: 100,
    maxEvents: 10000, // Lower in prod
    maxRecordingDuration: 30 * 60 * 1000, // 30 minutes
    maxMemoryUsage: 100 * 1024 * 1024 // 100MB
  }
}

/**
 * Environment variable mapping
 */
export const ENV_VAR_MAPPING = {
  // Server
  CURUPIRA_PORT: (value: string) => parseInt(value, 10),
  CURUPIRA_HOST: (value: string) => value,
  CURUPIRA_CORS_ORIGINS: (value: string) => value.split(',').map(s => s.trim()),
  
  // Auth
  CURUPIRA_AUTH_ENABLED: (value: string) => value.toLowerCase() === 'true',
  CURUPIRA_JWT_SECRET: (value: string) => value,
  CURUPIRA_TOKEN_EXPIRY: (value: string) => parseInt(value, 10),
  
  // Features
  CURUPIRA_TIME_TRAVEL: (value: string) => value.toLowerCase() === 'true',
  CURUPIRA_PROFILING: (value: string) => value.toLowerCase() === 'true',
  CURUPIRA_BREAKPOINTS: (value: string) => value.toLowerCase() === 'true',
  CURUPIRA_NETWORK_INTERCEPTION: (value: string) => value.toLowerCase() === 'true',
  
  // Limits
  CURUPIRA_MAX_SESSIONS: (value: string) => parseInt(value, 10),
  CURUPIRA_MAX_EVENTS: (value: string) => parseInt(value, 10),
  CURUPIRA_MAX_RECORDING_DURATION: (value: string) => parseInt(value, 10),
  CURUPIRA_MAX_MEMORY_USAGE: (value: string) => parseInt(value, 10),
  
  // Environment
  CURUPIRA_ENV: (value: string) => value as Environment,
  CURUPIRA_LOG_LEVEL: (value: string) => value as LogLevel
} as const

/**
 * Configuration validation error
 */
export class ConfigValidationError extends Error {
  constructor(
    message: string,
    public readonly errors: z.ZodError
  ) {
    super(`Configuration validation failed: ${message}`)
    this.name = 'ConfigValidationError'
  }
}

/**
 * Validates a configuration object
 */
export const validateConfig = (config: unknown): CurupiraConfig => {
  try {
    return CurupiraConfigSchema.parse(config)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ConfigValidationError(
        error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', '),
        error
      )
    }
    throw error
  }
}

/**
 * Gets the default configuration for an environment
 */
export const getDefaultConfig = (env: Environment): CurupiraConfig => {
  switch (env) {
    case 'development':
      return DEFAULT_DEVELOPMENT_CONFIG
    case 'staging':
      return DEFAULT_STAGING_CONFIG
    case 'production':
      return DEFAULT_PRODUCTION_CONFIG
    default:
      throw new Error(`Unknown environment: ${env}`)
  }
}