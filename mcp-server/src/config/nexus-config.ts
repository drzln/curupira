/**
 * Nexus Configuration System
 * Implements the standard Nexus pattern: Base YAML → Environment YAML → Environment Variables
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';
import { z } from 'zod';

// Configuration Schema following Nexus patterns
const ConfigSchema = z.object({
  version: z.string().optional(),
  
  server: z.object({
    name: z.string().default('curupira-mcp-server'),
    version: z.string().default('1.1.3'),
    host: z.string().default('localhost'),
    port: z.number().default(8080),
    environment: z.enum(['development', 'staging', 'production']).default('development'),
  }),
  
  logging: z.object({
    level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
    pretty: z.boolean().default(true),
    format: z.enum(['json', 'text']).default('json'),
  }),
  
  transports: z.object({
    websocket: z.object({
      enabled: z.boolean().default(true),
      path: z.string().default('/mcp'),
      pingInterval: z.number().default(30000),
      pongTimeout: z.number().default(5000),
    }),
    http: z.object({
      enabled: z.boolean().default(true),
      path: z.string().default('/mcp'),
      timeout: z.number().default(30000),
    }),
    sse: z.object({
      enabled: z.boolean().default(true),
      path: z.string().default('/mcp/sse'),
      keepAliveInterval: z.number().default(30000),
    }),
  }),
  
  healthCheck: z.object({
    enabled: z.boolean().default(true),
    path: z.string().default('/health'),
    interval: z.number().default(30000),
  }),
  
  cors: z.object({
    origins: z.array(z.string()).default(['http://localhost:3000']),
    credentials: z.boolean().default(true),
  }),
  
  rateLimit: z.object({
    enabled: z.boolean().default(true),
    max: z.number().default(100),
    window: z.number().default(60000),
  }),
  
  auth: z.object({
    enabled: z.boolean().default(false),
    jwtSecret: z.string().default('development-secret'),
    tokenExpiry: z.string().default('24h'),
  }),
  
  chrome: z.object({
    enabled: z.boolean().default(true),
    serviceUrl: z.string().default('http://localhost:9222'),
    connectTimeout: z.number().default(5000),
    pageTimeout: z.number().default(30000),
    defaultViewport: z.object({
      width: z.number().default(1920),
      height: z.number().default(1080),
    }),
    discovery: z.object({
      enabled: z.boolean().default(true),
      hosts: z.array(z.string()).default(['localhost', '127.0.0.1']),
      ports: z.array(z.number()).default([9222, 9223, 9224, 9225, 9226]),
      timeout: z.number().default(5000),
      autoConnect: z.boolean().default(false),
      preferredPatterns: z.array(z.string()).default(['localhost', 'react', 'vite', 'next']),
    }),
  }),
  
  performance: z.object({
    maxMessageSize: z.number().default(10485760),
    debounceMs: z.number().default(100),
    throttleMs: z.number().default(1000),
  }),
  
  resources: z.object({
    maxConsoleLogEntries: z.number().default(1000),
    maxNetworkRequests: z.number().default(500),
    cacheSize: z.number().default(100),
  }),
});

export type CurupiraConfig = z.infer<typeof ConfigSchema>;

export class NexusConfigLoader {
  private configDir: string;
  
  constructor(configDir?: string) {
    // If a specific config path is provided via environment, use its directory
    if (process.env.CURUPIRA_CONFIG_PATH) {
      const configPath = process.env.CURUPIRA_CONFIG_PATH;
      if (configPath.endsWith('.yaml') || configPath.endsWith('.yml')) {
        // If it's a file path, use its directory
        this.configDir = join(configPath, '..');
      } else {
        // If it's a directory, use it directly
        this.configDir = configPath;
      }
    } else {
      // Default to the provided configDir or 'config' directory
      this.configDir = configDir || join(process.cwd(), 'config');
    }
  }
  
  /**
   * Load configuration following Nexus hierarchy:
   * 1. Load base.yaml or specific config file
   * 2. Load environment-specific YAML (development.yaml, staging.yaml, production.yaml)
   * 3. Apply environment variable overrides
   */
  async load(): Promise<CurupiraConfig> {
    let baseConfig = {};
    
    // Check if we should load a specific config file
    if (process.env.CURUPIRA_CONFIG_PATH && 
        (process.env.CURUPIRA_CONFIG_PATH.endsWith('.yaml') || 
         process.env.CURUPIRA_CONFIG_PATH.endsWith('.yml'))) {
      // Load the specific config file directly
      baseConfig = this.loadYamlDirect(process.env.CURUPIRA_CONFIG_PATH);
    } else {
      // 1. Load base YAML configuration
      baseConfig = this.loadYaml('base.yaml');
      
      // 2. Load environment-specific YAML
      const environment = process.env.NODE_ENV || process.env.ENVIRONMENT || 'development';
      const envConfig = this.loadYaml(`${environment}.yaml`);
      
      // 3. Merge configurations (env overrides base)
      baseConfig = this.mergeConfigs(baseConfig, envConfig);
    }
    
    // 4. Apply environment variable overrides
    const finalConfig = this.applyEnvOverrides(baseConfig);
    
    // 5. Validate and return
    return ConfigSchema.parse(finalConfig);
  }
  
  private loadYaml(filename: string): any {
    const filepath = join(this.configDir, filename);
    
    if (!existsSync(filepath)) {
      if (filename === 'base.yaml') {
        // Return empty config instead of throwing for base.yaml
        return {};
      }
      // Environment-specific configs are optional
      return {};
    }
    
    try {
      const content = readFileSync(filepath, 'utf-8');
      return yaml.load(content) || {};
    } catch (error) {
      throw new Error(`Failed to load ${filename}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  private loadYamlDirect(filepath: string): any {
    if (!existsSync(filepath)) {
      throw new Error(`Configuration file not found: ${filepath}`);
    }
    
    try {
      const content = readFileSync(filepath, 'utf-8');
      return yaml.load(content) || {};
    } catch (error) {
      throw new Error(`Failed to load ${filepath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  private mergeConfigs(base: any, override: any): any {
    if (!override || typeof override !== 'object') {
      return base;
    }
    
    const result = { ...base };
    
    for (const [key, value] of Object.entries(override)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = this.mergeConfigs(result[key] || {}, value);
      } else {
        result[key] = value;
      }
    }
    
    return result;
  }
  
  /**
   * Apply environment variable overrides following Nexus pattern
   * Environment variables use format: CONFIG_SECTION_KEY=value
   * Maps to config.section.key
   */
  private applyEnvOverrides(config: any): any {
    const result = JSON.parse(JSON.stringify(config)); // Deep clone
    
    // Define environment variable mappings
    const envMappings = [
      // Server config
      { env: 'SERVER_HOST', path: 'server.host' },
      { env: 'SERVER_PORT', path: 'server.port', type: 'number' },
      { env: 'SERVER_ENVIRONMENT', path: 'server.environment' },
      
      // Logging config
      { env: 'LOGGING_LEVEL', path: 'logging.level' },
      { env: 'LOGGING_PRETTY', path: 'logging.pretty', type: 'boolean' },
      
      // Transport config
      { env: 'TRANSPORT_WEBSOCKET_ENABLED', path: 'transports.websocket.enabled', type: 'boolean' },
      { env: 'TRANSPORT_HTTP_ENABLED', path: 'transports.http.enabled', type: 'boolean' },
      { env: 'TRANSPORT_SSE_ENABLED', path: 'transports.sse.enabled', type: 'boolean' },
      
      // Auth config
      { env: 'AUTH_ENABLED', path: 'auth.enabled', type: 'boolean' },
      { env: 'AUTH_JWT_SECRET', path: 'auth.jwtSecret' },
      
      // Chrome config
      { env: 'CHROME_ENABLED', path: 'chrome.enabled', type: 'boolean' },
      { env: 'CHROME_SERVICE_URL', path: 'chrome.serviceUrl' },
      { env: 'CHROME_DISCOVERY_ENABLED', path: 'chrome.discovery.enabled', type: 'boolean' },
      { env: 'CHROME_DISCOVERY_TIMEOUT', path: 'chrome.discovery.timeout', type: 'number' },
      { env: 'CHROME_DISCOVERY_HOSTS', path: 'chrome.discovery.hosts', type: 'array' },
      { env: 'CHROME_DISCOVERY_PORTS', path: 'chrome.discovery.ports', type: 'array', arrayType: 'number' },
      
      // Rate limiting
      { env: 'RATE_LIMIT_ENABLED', path: 'rateLimit.enabled', type: 'boolean' },
      { env: 'RATE_LIMIT_MAX', path: 'rateLimit.max', type: 'number' },
      
      // CORS
      { env: 'CORS_ORIGINS', path: 'cors.origins', type: 'array' },
      
      // Performance
      { env: 'PERFORMANCE_MAX_MESSAGE_SIZE', path: 'performance.maxMessageSize', type: 'number' },
    ];
    
    for (const mapping of envMappings) {
      const envValue = process.env[mapping.env];
      if (envValue !== undefined) {
        this.setNestedValue(result, mapping.path, this.parseEnvValue(envValue, mapping.type, mapping.arrayType));
      }
    }
    
    return result;
  }
  
  private parseEnvValue(value: string, type?: string, arrayType?: string): any {
    switch (type) {
      case 'boolean':
        return value.toLowerCase() === 'true';
      case 'number':
        const num = Number(value);
        if (isNaN(num)) throw new Error(`Invalid number value: ${value}`);
        return num;
      case 'array':
        const items = value.split(',').map(item => item.trim());
        if (arrayType === 'number') {
          return items.map(item => {
            const num = Number(item);
            if (isNaN(num)) throw new Error(`Invalid number in array: ${item}`);
            return num;
          });
        }
        return items;
      default:
        return value;
    }
  }
  
  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    let current = obj;
    
    for (const key of keys) {
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[lastKey] = value;
  }
}

// Export a singleton instance
export const configLoader = new NexusConfigLoader();

// Export convenience function
export async function loadConfig(): Promise<CurupiraConfig> {
  return configLoader.load();
}