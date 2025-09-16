/**
 * Server Configuration Types and Interfaces
 * Level 0 - Pure types with no dependencies
 */

export interface CurupiraWebSocketConfig {
  enabled?: boolean
  path?: string
  pingInterval?: number
  pongTimeout?: number
  enablePing?: boolean
}

export interface CurupiraHttpConfig {
  enabled?: boolean
  httpPath?: string
  ssePath?: string
  sseEnabled?: boolean
  timeout?: number
  keepAliveInterval?: number
  useModernTransport?: boolean // Use StreamableHTTP vs SSE
}

export interface ServerConfig {
  name?: string
  version?: string
  host?: string
  port?: number
  environment?: 'development' | 'staging' | 'production'
  logLevel?: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'
  healthCheck?: boolean
  healthCheckPath?: string
  healthCheckInterval?: number
  cors?: {
    enabled?: boolean
    origin?: string | string[] | boolean
    credentials?: boolean
    methods?: string[]
    allowedHeaders?: string[]
    exposedHeaders?: string[]
    maxAge?: number
  }
  rateLimit?: {
    enabled?: boolean
    max?: number
    timeWindow?: string
    cache?: number
    skipSuccessfulRequests?: boolean
    skipFailedRequests?: boolean
  }
  helmet?: {
    enabled?: boolean
    contentSecurityPolicy?: boolean | object
    crossOriginEmbedderPolicy?: boolean
    crossOriginOpenerPolicy?: boolean
    crossOriginResourcePolicy?: boolean | object
    dnsPrefetchControl?: boolean | object
    frameguard?: boolean | object
    hidePoweredBy?: boolean
    hsts?: boolean | object
    ieNoOpen?: boolean
    noSniff?: boolean
    originAgentCluster?: boolean
    permittedCrossDomainPolicies?: boolean | object
    referrerPolicy?: boolean | object
    xssFilter?: boolean
  }
  auth?: {
    enabled?: boolean
    jwt?: {
      secret?: string
      algorithm?: string
      expiresIn?: string
      issuer?: string
      audience?: string
    }
    cors?: {
      origin?: string | string[] | boolean
    }
  }
  mcp?: {
    websocket?: CurupiraWebSocketConfig
    http?: CurupiraHttpConfig
  }
}

export interface ServerOptions {
  config?: ServerConfig
  configPath?: string
}

// Default configurations
export const DEFAULT_CONFIG: Partial<ServerConfig> = {
  name: 'curupira-mcp-server',
  version: '1.0.0',
  host: '127.0.0.1',
  port: 8080,
  environment: 'development',
  logLevel: 'info',
  healthCheck: true,
  healthCheckPath: '/health',
  healthCheckInterval: 30000,
  cors: {
    enabled: true,
    origin: true,
    credentials: true
  },
  rateLimit: {
    enabled: true,
    max: 100,
    timeWindow: '1 minute'
  },
  helmet: {
    enabled: true
  },
  auth: {
    enabled: false
  },
  mcp: {
    websocket: {
      enabled: true,
      path: '/mcp',
      pingInterval: 30000,
      pongTimeout: 5000,
      enablePing: true
    },
    http: {
      enabled: true,
      httpPath: '/mcp/messages',
      ssePath: '/mcp/sse',
      sseEnabled: true,
      timeout: 30000,
      keepAliveInterval: 30000,
      useModernTransport: true
    }
  }
}