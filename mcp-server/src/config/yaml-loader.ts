/**
 * YAML configuration loader for Curupira MCP server
 */

import { readFileSync, existsSync } from 'fs'
import yaml from 'js-yaml'
import { z } from 'zod'
import type { ServerConfig } from '../server.js'

/**
 * YAML configuration schema
 */
const YamlConfigSchema = z.object({
  server: z.object({
    name: z.string().optional(),
    version: z.string().optional(),
    host: z.string().optional(),
    port: z.number().optional(),
    environment: z.enum(['development', 'staging', 'production']).optional(),
    logLevel: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).optional(),
  }).optional(),
  
  transports: z.object({
    websocket: z.object({
      enabled: z.boolean().default(true),
      path: z.string().default('/mcp'),
      pingInterval: z.number().optional(),
      pongTimeout: z.number().optional(),
    }).optional(),
    
    http: z.object({
      enabled: z.boolean().default(false),
      path: z.string().default('/mcp'),
      timeout: z.number().optional(),
    }).optional(),
    
    sse: z.object({
      enabled: z.boolean().default(false),
      path: z.string().default('/mcp/sse'),
      keepAliveInterval: z.number().default(30000),
    }).optional(),
  }).optional(),
  
  healthCheck: z.object({
    enabled: z.boolean().default(true),
    path: z.string().default('/health'),
    interval: z.number().default(30000),
  }).optional(),
  
  cors: z.object({
    origins: z.array(z.string()).optional(),
    credentials: z.boolean().default(true),
  }).optional(),
  
  rateLimit: z.object({
    max: z.number().default(100),
    window: z.number().default(60000),
  }).optional(),
  
  auth: z.object({
    enabled: z.boolean().default(false),
    jwtSecret: z.string().optional(),
    tokenExpiry: z.string().default('24h'),
  }).optional(),
}).strict()

export type YamlConfig = z.infer<typeof YamlConfigSchema>

/**
 * Load configuration from YAML file
 */
export function loadYamlConfig(configPath: string): Partial<ServerConfig> {
  if (!existsSync(configPath)) {
    throw new Error(`Configuration file not found: ${configPath}`)
  }
  
  try {
    const configContent = readFileSync(configPath, 'utf-8')
    const rawConfig = yaml.load(configContent)
    
    // Validate against schema
    const validatedConfig = YamlConfigSchema.parse(rawConfig)
    
    // Transform to ServerConfig format
    const serverConfig: Partial<ServerConfig> = {
      name: validatedConfig.server?.name,
      version: validatedConfig.server?.version,
      host: validatedConfig.server?.host,
      port: validatedConfig.server?.port,
      environment: validatedConfig.server?.environment,
      logLevel: validatedConfig.server?.logLevel,
      healthCheck: validatedConfig.healthCheck?.enabled,
      healthCheckPath: validatedConfig.healthCheck?.path,
      healthCheckInterval: validatedConfig.healthCheck?.interval,
    }
    
    // Configure transports based on YAML
    if (validatedConfig.transports) {
      serverConfig.transports = {}
      
      if (validatedConfig.transports.websocket?.enabled) {
        serverConfig.transports.websocket = {
          enabled: validatedConfig.transports.websocket.enabled,
          path: validatedConfig.transports.websocket.path,
          enablePing: validatedConfig.transports.websocket.pingInterval !== undefined,
          pingInterval: validatedConfig.transports.websocket.pingInterval,
          pongTimeout: validatedConfig.transports.websocket.pongTimeout,
        }
      }
      
      if (validatedConfig.transports.http?.enabled || validatedConfig.transports.sse?.enabled) {
        serverConfig.transports.http = {
          enabled: true,
          httpPath: validatedConfig.transports.http?.path || '/mcp',
          ssePath: validatedConfig.transports.sse?.path || '/mcp/sse',
          sseEnabled: validatedConfig.transports.sse?.enabled !== false, // Default to true if not explicitly disabled
          timeout: validatedConfig.transports.http?.timeout,
          keepAliveInterval: validatedConfig.transports.sse?.keepAliveInterval,
        }
      }
    }
    
    return serverConfig
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid configuration: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`)
    }
    throw new Error(`Failed to load configuration: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Merge YAML config with other config sources
 */
export function mergeWithYamlConfig(
  baseConfig: Partial<ServerConfig>,
  yamlPath?: string
): Partial<ServerConfig> {
  if (!yamlPath) {
    return baseConfig
  }
  
  const yamlConfig = loadYamlConfig(yamlPath)
  
  // Deep merge, with YAML taking precedence
  return {
    ...baseConfig,
    ...yamlConfig,
    transports: {
      ...baseConfig.transports,
      ...yamlConfig.transports,
    },
  }
}