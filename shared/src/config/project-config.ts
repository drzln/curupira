/**
 * @fileoverview Project-level configuration support for Curupira
 */

import { readFileSync, existsSync } from 'fs'
import { join, resolve } from 'path'
import yaml from 'js-yaml'
import { z } from 'zod'
import { createLogger } from '../logging/index.js'

const logger = createLogger({ 
  level: 'info',
  name: 'project-config' 
})

/**
 * State management library configuration
 */
const StateManagementConfigSchema = z.object({
  react: z.object({
    enabled: z.boolean().default(true),
    devtools: z.boolean().default(true),
    profiling: z.boolean().default(true),
    strictMode: z.boolean().default(false)
  }).default({}),
  xstate: z.object({
    enabled: z.boolean().default(false),
    inspector: z.boolean().default(true),
    devtools: z.boolean().default(true)
  }).default({}),
  zustand: z.object({
    enabled: z.boolean().default(false),
    devtools: z.boolean().default(true),
    persist: z.boolean().default(true)
  }).default({}),
  apollo: z.object({
    enabled: z.boolean().default(false),
    devtools: z.boolean().default(true),
    cacheInspection: z.boolean().default(true)
  }).default({})
})

/**
 * Performance monitoring configuration
 */
const PerformanceConfigSchema = z.object({
  enabled: z.boolean().default(true),
  thresholds: z.object({
    slowRender: z.number().default(16), // milliseconds
    memoryLeak: z.number().default(1024 * 1024), // bytes (1MB)
    slowNetwork: z.number().default(1000), // milliseconds
    largeBundle: z.number().default(500 * 1024), // bytes (500KB)
  }).default({}),
  coreWebVitals: z.object({
    enabled: z.boolean().default(true),
    fcp: z.number().default(1800), // First Contentful Paint
    lcp: z.number().default(2500), // Largest Contentful Paint
    fid: z.number().default(100),  // First Input Delay
    cls: z.number().default(0.1)   // Cumulative Layout Shift
  }).default({}),
  profiling: z.object({
    renders: z.boolean().default(true),
    memory: z.boolean().default(true),
    network: z.boolean().default(true),
    customMetrics: z.boolean().default(true)
  }).default({})
})

/**
 * Debugging configuration
 */
const DebuggingConfigSchema = z.object({
  timeTravel: z.object({
    enabled: z.boolean().default(true),
    maxSnapshots: z.number().default(100),
    autoSnapshot: z.boolean().default(true),
    snapshotInterval: z.number().default(5000) // milliseconds
  }).default({}),
  console: z.object({
    capture: z.boolean().default(true),
    levels: z.array(z.enum(['log', 'warn', 'error', 'debug', 'info'])).default(['log', 'warn', 'error']),
    maxEntries: z.number().default(1000),
    sanitize: z.boolean().default(true)
  }).default({}),
  network: z.object({
    capture: z.boolean().default(true),
    captureHeaders: z.boolean().default(false),
    captureBody: z.boolean().default(false),
    maxEntries: z.number().default(500),
    filters: z.array(z.string()).default([])
  }).default({})
})

/**
 * Security and privacy configuration
 */
const SecurityConfigSchema = z.object({
  sanitization: z.object({
    enabled: z.boolean().default(true),
    piiDetection: z.boolean().default(true),
    customPatterns: z.array(z.string()).default([]),
    maskingChar: z.string().default('*')
  }).default({}),
  allowedDomains: z.array(z.string()).default(['localhost', '127.0.0.1']),
  auth: z.object({
    required: z.boolean().default(false),
    providers: z.array(z.enum(['local', 'google', 'github'])).default(['local']),
    sessionTimeout: z.number().default(24 * 60 * 60 * 1000) // 24 hours
  }).default({})
})

/**
 * Project-specific custom configuration
 */
const CustomConfigSchema = z.object({
  components: z.record(z.object({
    monitor: z.boolean().default(true),
    performance: z.boolean().default(true),
    stateTracking: z.boolean().default(true)
  })).default({}),
  pages: z.record(z.object({
    url: z.string(),
    name: z.string(),
    criticalPath: z.boolean().default(false),
    performanceTarget: z.number().optional()
  })).default({}),
  customMetrics: z.record(z.object({
    name: z.string(),
    description: z.string(),
    threshold: z.number().optional(),
    unit: z.string().default('ms')
  })).default({})
})

/**
 * Main project configuration schema
 */
const ProjectConfigSchema = z.object({
  // Project metadata
  project: z.object({
    name: z.string(),
    version: z.string().default('1.0.0'),
    description: z.string().optional(),
    framework: z.enum(['react', 'next', 'gatsby', 'vite']).default('react'),
    typescript: z.boolean().default(true)
  }),

  // MCP server connection
  server: z.object({
    url: z.string().default('ws://localhost:8080/mcp'),
    auth: z.object({
      enabled: z.boolean().default(false),
      token: z.string().optional(),
      apiKey: z.string().optional()
    }).default({})
  }).default({}),

  // State management
  stateManagement: StateManagementConfigSchema.default({}),

  // Performance monitoring
  performance: PerformanceConfigSchema.default({}),

  // Debugging features
  debugging: DebuggingConfigSchema.default({}),

  // Security settings
  security: SecurityConfigSchema.default({}),

  // Custom project settings
  custom: CustomConfigSchema.default({})
})

export type ProjectConfig = z.infer<typeof ProjectConfigSchema>

/**
 * Load project configuration from various possible locations
 */
export class ProjectConfigLoader {
  private static readonly CONFIG_FILENAMES = [
    'curupira.yml',
    'curupira.yaml',
    '.curupira.yml',
    '.curupira.yaml',
    '.curupira/config.yml',
    '.curupira/config.yaml'
  ]

  /**
   * Find and load project configuration
   */
  static async loadConfig(projectRoot?: string): Promise<ProjectConfig | null> {
    const searchRoot = projectRoot || process.cwd()
    
    logger.debug({ searchRoot }, 'Looking for Curupira config files')

    // Search for config files
    for (const filename of this.CONFIG_FILENAMES) {
      const configPath = join(searchRoot, filename)
      
      if (existsSync(configPath)) {
        try {
          const configContent = readFileSync(configPath, 'utf-8')
          const rawConfig = yaml.load(configContent) as any
          
          logger.info({ configPath }, 'Found Curupira config file')
          
          // Validate and parse config
          const config = ProjectConfigSchema.parse(rawConfig)
          
          logger.debug({ config }, 'Loaded project configuration')
          return config
          
        } catch (error) {
          logger.error({ error, configPath }, 'Failed to load config file')
          throw new Error(`Invalid Curupira config at ${configPath}: ${error}`)
        }
      }
    }

    logger.debug('No Curupira config file found, using defaults')
    return null
  }

  /**
   * Create a default configuration file
   */
  static async createDefaultConfig(projectRoot: string): Promise<string> {
    const configPath = join(projectRoot, 'curupira.yml')
    
    const defaultConfig = `# Curupira MCP Debugging Configuration
# https://github.com/your-org/curupira

# Project information
project:
  name: "My React App"
  version: "1.0.0"
  description: "React application debugging configuration"
  framework: "react"  # react | next | gatsby | vite
  typescript: true

# MCP Server connection
server:
  url: "ws://localhost:8080/mcp"
  auth:
    enabled: false
    # token: "your-auth-token"
    # apiKey: "your-api-key"

# State management libraries to monitor
stateManagement:
  react:
    enabled: true
    devtools: true
    profiling: true
    strictMode: false
  
  # Enable if using XState
  xstate:
    enabled: false
    inspector: true
    devtools: true
  
  # Enable if using Zustand
  zustand:
    enabled: false
    devtools: true
    persist: true
  
  # Enable if using Apollo Client
  apollo:
    enabled: false
    devtools: true
    cacheInspection: true

# Performance monitoring
performance:
  enabled: true
  
  # Performance thresholds (when to alert)
  thresholds:
    slowRender: 16      # milliseconds (60fps)
    memoryLeak: 1048576 # bytes (1MB)
    slowNetwork: 1000   # milliseconds
    largeBundle: 512000 # bytes (500KB)
  
  # Core Web Vitals targets
  coreWebVitals:
    enabled: true
    fcp: 1800  # First Contentful Paint (ms)
    lcp: 2500  # Largest Contentful Paint (ms)  
    fid: 100   # First Input Delay (ms)
    cls: 0.1   # Cumulative Layout Shift
  
  # What to profile
  profiling:
    renders: true
    memory: true
    network: true
    customMetrics: true

# Debugging features
debugging:
  # Time-travel debugging
  timeTravel:
    enabled: true
    maxSnapshots: 100
    autoSnapshot: true
    snapshotInterval: 5000  # milliseconds

  # Console monitoring
  console:
    capture: true
    levels: ["log", "warn", "error"]
    maxEntries: 1000
    sanitize: true

  # Network monitoring  
  network:
    capture: true
    captureHeaders: false
    captureBody: false
    maxEntries: 500
    # filters: ["api/", "graphql"]

# Security and privacy
security:
  # Data sanitization
  sanitization:
    enabled: true
    piiDetection: true
    # customPatterns: ["secret", "password"]
    maskingChar: "*"
  
  # Allowed domains for debugging
  allowedDomains: 
    - "localhost"
    - "127.0.0.1"
    - "*.local"
  
  # Authentication
  auth:
    required: false
    providers: ["local"]
    sessionTimeout: 86400000  # 24 hours

# Custom project-specific settings
custom:
  # Monitor specific components
  components:
    Header:
      monitor: true
      performance: true
      stateTracking: true
    ShoppingCart:
      monitor: true  
      performance: true
      stateTracking: true

  # Define important pages to monitor
  pages:
    home:
      url: "/"
      name: "Home Page"
      criticalPath: true
      performanceTarget: 1500
    checkout:
      url: "/checkout"
      name: "Checkout Flow"
      criticalPath: true
      performanceTarget: 2000

  # Custom performance metrics
  customMetrics:
    cartLoadTime:
      name: "Shopping Cart Load Time"
      description: "Time to load cart contents"
      threshold: 500
      unit: "ms"
`

    return configPath
  }

  /**
   * Get configuration for specific component
   */
  static getComponentConfig(config: ProjectConfig, componentName: string) {
    return config.custom.components[componentName] || {
      monitor: true,
      performance: true,
      stateTracking: true
    }
  }

  /**
   * Get configuration for specific page
   */
  static getPageConfig(config: ProjectConfig, pathname: string) {
    // Find matching page config - sort by URL length descending for most specific match first
    const sortedPages = Object.entries(config.custom.pages).sort(([, a], [, b]) => 
      b.url.length - a.url.length
    )
    
    for (const [key, pageConfig] of sortedPages) {
      if (pathname === pageConfig.url || pathname.startsWith(pageConfig.url + '/')) {
        return pageConfig
      }
    }
    return null
  }

  /**
   * Validate project configuration
   */
  static validateConfig(config: any): ProjectConfig {
    return ProjectConfigSchema.parse(config)
  }
}