/**
 * Curupira MCP Server
 * 
 * Main entry point and exports
 */

// Server components
export { CurupiraServer } from './server/server.js'
export { MCPHandler } from './server/mcp-handler.js'
export { TransportManager, type TransportType, type TransportOptions } from './server/transport.js'
export { HealthChecker, type HealthStatus } from './server/health.js'

// Dependency injection
export { createApplicationContainer, registerToolProviders, registerResourceProviders } from './infrastructure/container/app.container.js'
export { DIContainer, type Container } from './core/di/container.js'
export * from './core/di/tokens.js'

// Core interfaces
export * from './core/interfaces/index.js'

// Chrome services
export { ChromeService } from './chrome/chrome.service.js'
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

// Tool providers and registry
export { ToolRegistry } from './mcp/tools/registry.js'
export { BaseToolProvider } from './mcp/tools/base-tool-provider.js'
export * from './mcp/tools/provider.factory.js'

// Framework integrations
export { createFrameworkIntegrations, type FrameworkIntegrations } from './integrations/index.js'
export type { ReactIntegration } from './integrations/react/index.js'
export type { XStateIntegration } from './integrations/xstate/index.js'
export type { ZustandIntegration } from './integrations/zustand/index.js'

// Configuration
export { loadConfig, getDefaultConfig, type CurupiraConfig } from './config/config.js'

// Error handling
export { Result } from './core/result.js'
export * from './core/errors/index.js'

// Re-export types from shared
export type * from '@curupira/shared/types'