import { z } from 'zod'

const ConfigSchema = z.object({
  env: z.enum(['development', 'staging', 'production']).default('development'),
  port: z.number().int().positive().default(8080),
  host: z.string().default('0.0.0.0'),
  logLevel: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  
  auth: z.object({
    enabled: z.boolean().default(false),
    jwtSecret: z.string().optional(),
    tokenExpiry: z.string().default('1h'),
  }),
  
  cors: z.object({
    origins: z.array(z.string()).default(['http://localhost:3000']),
  }),
  
  rateLimit: z.object({
    max: z.number().int().positive().default(100),
    window: z.number().int().positive().default(60000), // 1 minute
  }),
  
  websocket: z.object({
    maxPayload: z.number().int().positive().default(1048576), // 1MB
    heartbeatInterval: z.number().int().positive().default(30000), // 30s
  }),
})

export type Config = z.infer<typeof ConfigSchema>

function loadConfig(): Config {
  const raw = {
    env: process.env.NODE_ENV,
    port: process.env.CURUPIRA_PORT ? parseInt(process.env.CURUPIRA_PORT, 10) : undefined,
    host: process.env.CURUPIRA_HOST,
    logLevel: process.env.CURUPIRA_LOG_LEVEL,
    
    auth: {
      enabled: process.env.CURUPIRA_AUTH_ENABLED === 'true',
      jwtSecret: process.env.CURUPIRA_JWT_SECRET,
      tokenExpiry: process.env.CURUPIRA_TOKEN_EXPIRY,
    },
    
    cors: {
      origins: process.env.CURUPIRA_ALLOWED_ORIGINS?.split(',').map(s => s.trim()),
    },
    
    rateLimit: {
      max: process.env.CURUPIRA_RATE_LIMIT_MAX ? parseInt(process.env.CURUPIRA_RATE_LIMIT_MAX, 10) : undefined,
      window: process.env.CURUPIRA_RATE_LIMIT_WINDOW ? parseInt(process.env.CURUPIRA_RATE_LIMIT_WINDOW, 10) : undefined,
    },
    
    websocket: {
      maxPayload: process.env.CURUPIRA_WS_MAX_PAYLOAD ? parseInt(process.env.CURUPIRA_WS_MAX_PAYLOAD, 10) : undefined,
      heartbeatInterval: process.env.CURUPIRA_WS_HEARTBEAT ? parseInt(process.env.CURUPIRA_WS_HEARTBEAT, 10) : undefined,
    },
  }

  try {
    return ConfigSchema.parse(raw)
  } catch (error) {
    console.error('Invalid configuration:', error)
    process.exit(1)
  }
}

export const config = loadConfig()