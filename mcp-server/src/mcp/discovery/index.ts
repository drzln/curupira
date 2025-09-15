/**
 * Resource Discovery and Dynamic Registration System
 * Provides automatic detection and registration of debugging capabilities
 * 
 * Level 3: Integration Layer (depends on Level 0-2)
 */

import type { SessionId } from '@curupira/shared/types'
import { ChromeManager } from '../../chrome/manager.js'
import { logger } from '../../config/logger.js'
import { ChromeCDPResourceProvider } from '../resources/providers/cdp.js'
import { ReactFrameworkProvider } from '../resources/providers/react.js'
import { StateManagementResourceProvider } from '../resources/providers/state.js'
import { ConnectivityTroubleshootingProvider } from '../resources/providers/connectivity.js'

export interface DiscoveredFramework {
  name: string
  version?: string
  detected: boolean
  confidence: number // 0-1 score
  capabilities: string[]
  resources: string[]
  tools: string[]
}

export interface DiscoveredLibrary {
  name: string
  version?: string
  namespace?: string
  detected: boolean
  type: 'ui' | 'state' | 'routing' | 'testing' | 'build' | 'utility' | 'unknown'
}

export interface DiscoveredEnvironment {
  runtime: 'browser' | 'node' | 'webworker' | 'unknown'
  development: boolean
  buildTool?: string
  bundler?: string
  typescript: boolean
  sourceMap: boolean
  hotReload: boolean
}

export interface DiscoveryReport {
  timestamp: number
  sessionId: SessionId
  environment: DiscoveredEnvironment
  frameworks: DiscoveredFramework[]
  libraries: DiscoveredLibrary[]
  capabilities: {
    debugging: string[]
    profiling: string[]
    inspection: string[]
    modification: string[]
  }
  recommendations: string[]
  registeredResources: number
  registeredTools: number
}

export interface ResourceRegistration {
  uri: string
  name: string
  description: string
  mimeType: string
  dynamic: boolean
  provider: 'cdp' | 'react' | 'state' | 'connectivity' | 'custom'
  dependencies: string[]
}

export interface ToolRegistration {
  name: string
  description: string
  category: 'debugging' | 'inspection' | 'modification' | 'performance' | 'network' | 'framework'
  inputSchema: unknown
  provider: 'cdp' | 'react' | 'state' | 'connectivity' | 'custom'
  dependencies: string[]
}

export interface DiscoveryService {
  discoverEnvironment(sessionId: SessionId): Promise<DiscoveredEnvironment>
  discoverFrameworks(sessionId: SessionId): Promise<DiscoveredFramework[]>
  discoverLibraries(sessionId: SessionId): Promise<DiscoveredLibrary[]>
  generateReport(sessionId: SessionId): Promise<DiscoveryReport>
  registerDynamicResources(sessionId: SessionId, frameworks: DiscoveredFramework[]): Promise<ResourceRegistration[]>
  registerDynamicTools(sessionId: SessionId, frameworks: DiscoveredFramework[]): Promise<ToolRegistration[]>
  getRecommendations(report: DiscoveryReport): string[]
}

export class CurupiraDiscoveryService implements DiscoveryService {
  private chromeManager: ChromeManager
  private cdpProvider: ChromeCDPResourceProvider
  private reactProvider: ReactFrameworkProvider
  private stateProvider: StateManagementResourceProvider
  private connectivityProvider: ConnectivityTroubleshootingProvider
  private registeredResources: Map<string, ResourceRegistration> = new Map()
  private registeredTools: Map<string, ToolRegistration> = new Map()

  constructor() {
    this.chromeManager = ChromeManager.getInstance()
    this.cdpProvider = new ChromeCDPResourceProvider()
    this.reactProvider = new ReactFrameworkProvider()
    this.stateProvider = new StateManagementResourceProvider()
    this.connectivityProvider = new ConnectivityTroubleshootingProvider()
  }

  async discoverEnvironment(sessionId: SessionId): Promise<DiscoveredEnvironment> {
    const client = this.chromeManager.getClient()
    
    try {
      const result = await client.send('Runtime.evaluate', {
        expression: `
          (() => {
            const env = {
              runtime: 'browser',
              development: false,
              buildTool: undefined,
              bundler: undefined,
              typescript: false,
              sourceMap: false,
              hotReload: false
            };
            
            // Detect development mode
            env.development = 
              (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') ||
              window.location.hostname === 'localhost' ||
              window.location.hostname === '127.0.0.1' ||
              window.location.port !== '' ||
              !!(window.__REACT_DEVTOOLS_GLOBAL_HOOK__) ||
              !!(window.__REDUX_DEVTOOLS_EXTENSION__);
            
            // Detect TypeScript
            env.typescript = 
              document.querySelectorAll('script[src*=".ts"]').length > 0 ||
              !!window.TypeScript ||
              Array.from(document.scripts).some(script => 
                script.textContent && script.textContent.includes('__webpack_require__')
              );
            
            // Detect source maps
            env.sourceMap = 
              Array.from(document.scripts).some(script => 
                script.src.includes('.map') || 
                (script.textContent && script.textContent.includes('//# sourceMappingURL='))
              );
            
            // Detect hot reload
            env.hotReload = 
              !!(window.webpackHotUpdate) ||
              !!(window.__webpack_hmr_handler__) ||
              !!(window.module?.hot) ||
              Array.from(document.scripts).some(script => 
                script.src.includes('hot-update') ||
                script.src.includes('webpack-dev-server')
              );
            
            // Detect build tools
            if (window.__webpack_require__) {
              env.bundler = 'webpack';
            } else if (window.__vite__) {
              env.bundler = 'vite';
            } else if (window.require?.defined?.('rollup')) {
              env.bundler = 'rollup';
            } else if (window.parcelRequire) {
              env.bundler = 'parcel';
            }
            
            // Detect build tool from scripts
            const scripts = Array.from(document.scripts);
            if (scripts.some(s => s.src.includes('vite'))) {
              env.buildTool = 'vite';
            } else if (scripts.some(s => s.src.includes('webpack'))) {
              env.buildTool = 'webpack';
            } else if (scripts.some(s => s.src.includes('rollup'))) {
              env.buildTool = 'rollup';
            }
            
            return env;
          })()
        `,
        returnByValue: true
      }, sessionId)
      
      return (result as any).result?.value || {
        runtime: 'browser',
        development: false,
        typescript: false,
        sourceMap: false,
        hotReload: false
      }
    } catch (error) {
      logger.error('Failed to discover environment:', error)
      return {
        runtime: 'browser',
        development: false,
        typescript: false,
        sourceMap: false,
        hotReload: false
      }
    }
  }

  async discoverFrameworks(sessionId: SessionId): Promise<DiscoveredFramework[]> {
    const frameworks: DiscoveredFramework[] = []
    
    // Discover React
    try {
      const reactInfo = await this.reactProvider.detectReact(sessionId)
      if (reactInfo) {
        frameworks.push({
          name: 'React',
          version: reactInfo.version,
          detected: true,
          confidence: 0.95,
          capabilities: [
            'component-inspection',
            'props-state-debugging',
            'hook-debugging',
            'fiber-tree-analysis',
            'performance-profiling'
          ],
          resources: [
            'react://components',
            'react://hooks',
            'react://fiber',
            'react://renders'
          ],
          tools: [
            'react_find_component',
            'react_inspect_props',
            'react_inspect_state',
            'react_inspect_hooks',
            'react_force_rerender',
            'react_profile_renders'
          ]
        })
      }
    } catch (error) {
      logger.error('Failed to detect React:', error)
    }
    
    // Discover XState
    try {
      const xstateDetected = await this.stateProvider.detectXState(sessionId)
      if (xstateDetected) {
        frameworks.push({
          name: 'XState',
          detected: true,
          confidence: 0.9,
          capabilities: [
            'state-machine-inspection',
            'event-debugging',
            'actor-management',
            'transition-analysis'
          ],
          resources: [
            'xstate://actors',
            'xstate://machines',
            'xstate://events',
            'xstate://history'
          ],
          tools: [
            'xstate_inspect_actor',
            'xstate_send_event'
          ]
        })
      }
    } catch (error) {
      logger.error('Failed to detect XState:', error)
    }
    
    // Discover Zustand
    try {
      const zustandDetected = await this.stateProvider.detectZustand(sessionId)
      if (zustandDetected) {
        frameworks.push({
          name: 'Zustand',
          detected: true,
          confidence: 0.85,
          capabilities: [
            'store-inspection',
            'state-debugging',
            'action-dispatching',
            'time-travel-debugging'
          ],
          resources: [
            'zustand://stores',
            'zustand://history',
            'zustand://subscriptions'
          ],
          tools: [
            'zustand_inspect_store',
            'zustand_dispatch_action'
          ]
        })
      }
    } catch (error) {
      logger.error('Failed to detect Zustand:', error)
    }
    
    // Discover Apollo Client
    try {
      const apolloDetected = await this.stateProvider.detectApollo(sessionId)
      if (apolloDetected) {
        frameworks.push({
          name: 'Apollo Client',
          detected: true,
          confidence: 0.9,
          capabilities: [
            'graphql-cache-inspection',
            'query-debugging',
            'mutation-tracking',
            'subscription-monitoring'
          ],
          resources: [
            'apollo://cache',
            'apollo://queries',
            'apollo://mutations',
            'apollo://subscriptions'
          ],
          tools: [
            'apollo_inspect_cache',
            'apollo_refetch_query'
          ]
        })
      }
    } catch (error) {
      logger.error('Failed to detect Apollo:', error)
    }
    
    return frameworks
  }

  async discoverLibraries(sessionId: SessionId): Promise<DiscoveredLibrary[]> {
    const client = this.chromeManager.getClient()
    
    try {
      const result = await client.send('Runtime.evaluate', {
        expression: `
          (() => {
            const libraries = [];
            
            // Common library detection patterns
            const detectionPatterns = {
              // UI Libraries
              'Material-UI': () => !!(window.MaterialUI || document.querySelector('[class*="MuiThemeProvider"]')),
              'Ant Design': () => !!(window.antd || document.querySelector('[class*="ant-"]')),
              'Chakra UI': () => !!(window.ChakraUI || document.querySelector('[class*="chakra-"]')),
              'Mantine': () => !!(window.Mantine || document.querySelector('[class*="mantine-"]')),
              
              // State Management
              'Redux': () => !!(window.Redux || window.__REDUX_DEVTOOLS_EXTENSION__),
              'MobX': () => !!(window.mobx || window.__mobxGlobalState),
              'Recoil': () => !!(window.Recoil),
              'Jotai': () => !!(window.jotai),
              'Valtio': () => !!(window.valtio),
              
              // Routing
              'React Router': () => !!(window.ReactRouter || document.querySelector('[data-reach-router-root]')),
              'Next.js Router': () => !!(window.next),
              'Reach Router': () => !!(window.ReachRouter),
              
              // Form Libraries
              'Formik': () => !!(window.Formik),
              'React Hook Form': () => !!(window.ReactHookForm),
              'Final Form': () => !!(window.FinalForm),
              
              // Animation
              'Framer Motion': () => !!(window.FramerMotion),
              'React Spring': () => !!(window.ReactSpring),
              'React Transition Group': () => !!(window.ReactTransitionGroup),
              
              // Testing
              'React Testing Library': () => Array.from(document.scripts).some(s => s.src.includes('testing-library')),
              'Enzyme': () => !!(window.Enzyme),
              'Jest': () => !!(window.jest),
              
              // Build Tools
              'Webpack': () => !!(window.__webpack_require__),
              'Vite': () => !!(window.__vite__),
              'Parcel': () => !!(window.parcelRequire),
              
              // Utilities
              'Lodash': () => !!(window._ && window._.VERSION),
              'Ramda': () => !!(window.R && window.R.version),
              'RxJS': () => !!(window.rxjs),
              'Moment.js': () => !!(window.moment),
              'Day.js': () => !!(window.dayjs),
              'Date-fns': () => !!(window.dateFns)
            };
            
            for (const [name, detector] of Object.entries(detectionPatterns)) {
              try {
                if (detector()) {
                  libraries.push({
                    name: name,
                    detected: true,
                    type: name.includes('UI') || name.includes('Design') ? 'ui' :
                          name.includes('Router') ? 'routing' :
                          name.includes('Redux') || name.includes('State') ? 'state' :
                          name.includes('Test') || name === 'Jest' || name === 'Enzyme' ? 'testing' :
                          name === 'Webpack' || name === 'Vite' || name === 'Parcel' ? 'build' :
                          'utility'
                  });
                }
              } catch (e) {
                // Skip if detection fails
              }
            }
            
            return libraries;
          })()
        `,
        returnByValue: true
      }, sessionId)
      
      return (result as any).result?.value || []
    } catch (error) {
      logger.error('Failed to discover libraries:', error)
      return []
    }
  }

  async generateReport(sessionId: SessionId): Promise<DiscoveryReport> {
    const timestamp = Date.now()
    
    const [environment, frameworks, libraries] = await Promise.all([
      this.discoverEnvironment(sessionId),
      this.discoverFrameworks(sessionId),
      this.discoverLibraries(sessionId)
    ])
    
    // Register dynamic resources and tools
    const [resources, tools] = await Promise.all([
      this.registerDynamicResources(sessionId, frameworks),
      this.registerDynamicTools(sessionId, frameworks)
    ])
    
    const capabilities = {
      debugging: ['javascript', 'dom', 'network', 'console'],
      profiling: ['cpu', 'memory', 'performance'],
      inspection: ['elements', 'sources', 'application'],
      modification: ['styles', 'dom', 'javascript']
    }
    
    // Add framework-specific capabilities
    for (const framework of frameworks) {
      capabilities.debugging.push(...framework.capabilities)
    }
    
    const report: DiscoveryReport = {
      timestamp,
      sessionId,
      environment,
      frameworks,
      libraries,
      capabilities,
      recommendations: [],
      registeredResources: resources.length,
      registeredTools: tools.length
    }
    
    report.recommendations = this.getRecommendations(report)
    
    return report
  }

  async registerDynamicResources(sessionId: SessionId, frameworks: DiscoveredFramework[]): Promise<ResourceRegistration[]> {
    const registrations: ResourceRegistration[] = []
    
    for (const framework of frameworks) {
      for (const resourceUri of framework.resources) {
        const registration: ResourceRegistration = {
          uri: resourceUri,
          name: `${framework.name} ${resourceUri.split('://')[1]}`,
          description: `Dynamic resource for ${framework.name} debugging`,
          mimeType: 'application/json',
          dynamic: true,
          provider: framework.name.toLowerCase().includes('react') ? 'react' :
                   framework.name.toLowerCase().includes('state') ? 'state' :
                   framework.name.toLowerCase().includes('apollo') ? 'state' : 'custom',
          dependencies: [framework.name]
        }
        
        registrations.push(registration)
        this.registeredResources.set(resourceUri, registration)
      }
    }
    
    logger.info(`Registered ${registrations.length} dynamic resources`)
    return registrations
  }

  async registerDynamicTools(sessionId: SessionId, frameworks: DiscoveredFramework[]): Promise<ToolRegistration[]> {
    const registrations: ToolRegistration[] = []
    
    for (const framework of frameworks) {
      for (const toolName of framework.tools) {
        const registration: ToolRegistration = {
          name: toolName,
          description: `Dynamic tool for ${framework.name} debugging`,
          category: toolName.includes('inspect') ? 'inspection' :
                   toolName.includes('profile') ? 'performance' :
                   toolName.includes('force') || toolName.includes('dispatch') ? 'modification' :
                   'debugging',
          inputSchema: {
            type: 'object',
            properties: {
              sessionId: { type: 'string', description: 'Chrome session ID' }
            },
            required: ['sessionId']
          },
          provider: framework.name.toLowerCase().includes('react') ? 'react' :
                   framework.name.toLowerCase().includes('state') ? 'state' :
                   framework.name.toLowerCase().includes('apollo') ? 'state' : 'custom',
          dependencies: [framework.name]
        }
        
        registrations.push(registration)
        this.registeredTools.set(toolName, registration)
      }
    }
    
    logger.info(`Registered ${registrations.length} dynamic tools`)
    return registrations
  }

  getRecommendations(report: DiscoveryReport): string[] {
    const recommendations: string[] = []
    
    // Environment-based recommendations
    if (report.environment.development) {
      recommendations.push('Development mode detected - enhanced debugging features available')
      
      if (report.environment.hotReload) {
        recommendations.push('Hot reload detected - state may reset during development')
      }
      
      if (!report.environment.sourceMap) {
        recommendations.push('Enable source maps for better debugging experience')
      }
    } else {
      recommendations.push('Production mode detected - some debugging features may be limited')
    }
    
    // Framework-specific recommendations
    const reactFramework = report.frameworks.find(f => f.name === 'React')
    if (reactFramework) {
      recommendations.push('React detected - use React DevTools for enhanced component debugging')
      
      if (reactFramework.confidence < 0.9) {
        recommendations.push('React detection confidence low - some features may not work correctly')
      }
    }
    
    const stateFrameworks = report.frameworks.filter(f => 
      ['XState', 'Zustand', 'Apollo Client'].includes(f.name)
    )
    if (stateFrameworks.length > 1) {
      recommendations.push('Multiple state management libraries detected - consider consolidating')
    }
    
    // Library-based recommendations
    const testingLibs = report.libraries.filter(l => l.type === 'testing')
    if (testingLibs.length === 0 && report.environment.development) {
      recommendations.push('No testing libraries detected - consider adding testing tools')
    }
    
    // Performance recommendations
    if (report.frameworks.length > 5) {
      recommendations.push('Many frameworks detected - consider bundle size optimization')
    }
    
    return recommendations
  }

  // Getter methods for registered resources and tools
  getRegisteredResources(): Map<string, ResourceRegistration> {
    return this.registeredResources
  }

  getRegisteredTools(): Map<string, ToolRegistration> {
    return this.registeredTools
  }
}