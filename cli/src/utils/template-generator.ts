/**
 * @fileoverview Template generation utilities for Curupira CLI
 */

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { createLogger } from '@curupira/shared'
import type { TemplateData } from '../types.js'

const logger = createLogger({ level: 'info', name: 'template-generator' })

/**
 * Generate curupira.yml configuration from template data
 */
export async function generateConfigTemplate(data: TemplateData): Promise<string> {
  logger.debug({ data }, 'Generating configuration template')

  const template = `# Curupira Configuration
# AI-assisted React debugging tool

# Project Information
project:
  name: "${data.projectName}"
  framework: "${data.framework}"  # react | next | gatsby | vite
  typescript: ${data.typescript}

# Server Configuration
server:
  url: "ws://localhost:8080/mcp"
  timeout: 30000
  retries: 3

# Debugging Features
debugging:
  timeTravel:
    enabled: true
    historySize: 50
    compactInterval: 10
  
  performance:
    enabled: true
    thresholds:
      renderTime: 100
      componentMount: 50

# State Management Integration
stateManagement:
  react:
    enabled: true
    trackHooks: true
    trackContext: true
  
  zustand:
    enabled: ${data.hasStateManagement.zustand}
    storeNames: []
  
  xstate:
    enabled: ${data.hasStateManagement.xstate}
    machineIds: []
  
  apollo:
    enabled: ${data.hasStateManagement.apollo}
    cachePolicy: "cache-first"

# Performance Monitoring
performance:
  enabled: true
  sampling: 0.1  # 10% sampling rate
  metrics:
    - "renderTime"
    - "componentLifecycle" 
    - "stateUpdates"

# Security & Privacy
security:
  sanitization:
    enabled: true
    rules:
      - "passwords"
      - "tokens"
      - "apiKeys"
      - "personalData"
  
  allowedOrigins:
    - "localhost"
    - "127.0.0.1"

# Custom Configuration
custom:
  # Components to monitor specifically
  components:${generateComponentsSection(data.customComponents)}
  
  # Pages/routes to monitor
  pages:${generatePagesSection(data.customPages)}

# Extension Settings
extension:
  icon:
    enabled: true
    showBadge: true
  
  devtools:
    enabled: true
    tabName: "Curupira"
  
  notifications:
    enabled: true
    level: "error"  # error | warn | info | debug`

  return template
}

/**
 * Generate the components section of the config
 */
function generateComponentsSection(components: string[]): string {
  if (!components.length) {
    return `
    # Example component monitoring
    # MyComponent:
    #   track: true
    #   props: true
    #   state: true
    #   lifecycle: true`
  }

  const componentEntries = components.map(name => {
    const cleanName = name.trim()
    return `    ${cleanName}:
      track: true
      props: true
      state: true
      lifecycle: true`
  }).join('\n')

  return `\n${componentEntries}`
}

/**
 * Generate the pages section of the config
 */
function generatePagesSection(pages: Array<{ name: string; url: string; critical: boolean }>): string {
  if (!pages.length) {
    return `
    # Example page monitoring
    # home:
    #   url: "/"
    #   critical: true
    #   performance: true`
  }

  const pageEntries = pages.map(page => {
    const safeName = page.name.toLowerCase().replace(/[^a-z0-9]/g, '')
    return `    ${safeName}:
      url: "${page.url}"
      critical: ${page.critical}
      performance: true`
  }).join('\n')

  return `\n${pageEntries}`
}

/**
 * Generate template for specific framework
 */
export async function generateFrameworkTemplate(framework: string, data: TemplateData): Promise<string> {
  const baseTemplate = await generateConfigTemplate(data)
  
  // Add framework-specific configurations
  switch (framework) {
    case 'next':
      return addNextJsConfig(baseTemplate)
    case 'gatsby':
      return addGatsbyConfig(baseTemplate)
    case 'vite':
      return addViteConfig(baseTemplate)
    default:
      return baseTemplate
  }
}

/**
 * Add Next.js specific configuration
 */
function addNextJsConfig(template: string): string {
  const nextConfig = `
# Next.js Specific Settings
nextjs:
  ssr: true
  api:
    enabled: true
    routes: ["/api/*"]
  
  pages:
    enabled: true
    directory: "pages"
  
  app:
    enabled: true
    directory: "app"`
  
  return template + nextConfig
}

/**
 * Add Gatsby specific configuration  
 */
function addGatsbyConfig(template: string): string {
  const gatsbyConfig = `
# Gatsby Specific Settings
gatsby:
  staticQuery: true
  pageQuery: true
  
  build:
    enabled: true
    stage: "develop"
  
  plugins:
    tracking: true`
  
  return template + gatsbyConfig
}

/**
 * Add Vite specific configuration
 */
function addViteConfig(template: string): string {
  const viteConfig = `
# Vite Specific Settings
vite:
  hmr: true
  dev:
    enabled: true
    port: 3000
  
  build:
    sourcemap: true`
  
  return template + viteConfig
}

/**
 * Load and merge with existing template file if it exists
 */
export async function loadTemplateFile(templatePath: string): Promise<string | null> {
  try {
    if (existsSync(templatePath)) {
      return readFileSync(templatePath, 'utf-8')
    }
  } catch (error) {
    logger.warn({ error, templatePath }, 'Failed to load template file')
  }
  
  return null
}

/**
 * Validate generated template
 */
export function validateTemplate(template: string): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Basic YAML structure validation
  if (!template.includes('project:')) {
    errors.push('Missing project configuration section')
  }

  if (!template.includes('server:')) {
    errors.push('Missing server configuration section')
  }

  if (!template.includes('debugging:')) {
    errors.push('Missing debugging configuration section')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}