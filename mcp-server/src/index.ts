/**
 * Curupira MCP Server
 * 
 * Main entry point and exports
 */

// Server components
export { CurupiraServer } from './server/index.js'
export { MCPHandler } from './server/mcp-handler.js'
export { TransportManager, type TransportType, type TransportOptions } from './server/transport.js'
export { HealthChecker, type HealthStatus } from './server/health.js'

// Chrome client and domains
export { ChromeClient } from './chrome/client.js'
export { RuntimeDomain } from './chrome/domains/runtime.js'
export { DOMDomain } from './chrome/domains/dom.js'
export { NetworkDomain } from './chrome/domains/network.js'
export { PageDomain } from './chrome/domains/page.js'

// Resource providers
export { createResourceProviders, type ResourceProviders } from './resources/index.js'
export { BrowserResourceProvider } from './resources/browser-resource.js'
export { ReactResourceProvider } from './resources/react-resource.js'
export { StateResourceProvider } from './resources/state-resource.js'
export { NetworkResourceProvider } from './resources/network-resource.js'

// Tool providers
export { createToolProviders, type ToolProviders } from './tools/index.js'
export { DOMTool } from './tools/dom-tool.js'
export { RuntimeTool } from './tools/runtime-tool.js'
export { NetworkTool } from './tools/network-tool.js'
export { PerformanceTool } from './tools/performance-tool.js'

// Framework integrations
export { createFrameworkIntegrations, type FrameworkIntegrations } from './integrations/index.js'
export type { ReactIntegration } from './integrations/react/index.js'
export type { XStateIntegration } from './integrations/xstate/index.js'
export type { ZustandIntegration } from './integrations/zustand/index.js'

// Configuration
export { loadConfig, getDefaultConfig, type CurupiraConfig } from './config/config.js'
export { logger } from './config/logger.js'

// Re-export types from shared
export type * from '@curupira/shared/types'

// Legacy exports for backward compatibility
export * from './server.js'