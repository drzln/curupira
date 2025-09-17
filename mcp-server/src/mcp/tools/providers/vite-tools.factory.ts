/**
 * Vite Development Tool Provider Factory - Level 2 (MCP Core)
 * Factory implementation for Vite development server debugging tools
 * Tailored for NovaSkyn's Vite build and development environment
 */

import type { IToolProviderFactory, ProviderDependencies } from '../provider.factory.js';
import { BaseProviderFactory } from '../provider.factory.js';
import type { BaseToolProviderConfig } from '../base-tool-provider.js';
import { BaseToolProvider } from '../base-tool-provider.js';
import type { Schema } from '../../../core/interfaces/validator.interface.js';
import { withCDPCommand, withScriptExecution } from '../patterns/common-handlers.js';

// Schema definitions for Vite tools
const viteDetectionSchema: Schema<{ sessionId?: string }> = {
  parse: (value) => {
    const obj = (value || {}) as any;
    return {
      sessionId: obj.sessionId
    };
  },
  safeParse: function(value) {
    try {
      const parsed = this.parse(value);
      return { success: true, data: parsed };
    } catch (error) {
      return { success: false, error };
    }
  }
};

const hmrInspectSchema: Schema<{ 
  includeModules?: boolean; 
  includeHistory?: boolean; 
  moduleFilter?: string;
  sessionId?: string;
}> = {
  parse: (value) => {
    const obj = (value || {}) as any;
    return {
      includeModules: typeof obj.includeModules === 'boolean' ? obj.includeModules : true,
      includeHistory: typeof obj.includeHistory === 'boolean' ? obj.includeHistory : false,
      moduleFilter: obj.moduleFilter,
      sessionId: obj.sessionId
    };
  },
  safeParse: function(value) {
    try {
      const parsed = this.parse(value);
      return { success: true, data: parsed };
    } catch (error) {
      return { success: false, error };
    }
  }
};

const bundleAnalysisSchema: Schema<{ 
  analyzeSize?: boolean; 
  analyzeImports?: boolean; 
  includeAssets?: boolean;
  sessionId?: string;
}> = {
  parse: (value) => {
    const obj = (value || {}) as any;
    return {
      analyzeSize: typeof obj.analyzeSize === 'boolean' ? obj.analyzeSize : true,
      analyzeImports: typeof obj.analyzeImports === 'boolean' ? obj.analyzeImports : true,
      includeAssets: typeof obj.includeAssets === 'boolean' ? obj.includeAssets : false,
      sessionId: obj.sessionId
    };
  },
  safeParse: function(value) {
    try {
      const parsed = this.parse(value);
      return { success: true, data: parsed };
    } catch (error) {
      return { success: false, error };
    }
  }
};

class ViteToolProvider extends BaseToolProvider {
  protected initializeTools(): void {
    // Register vite_detect tool
    this.registerTool(
      this.createTool(
        'vite_detect',
        'Detect Vite development server and build information',
        viteDetectionSchema,
        async (args, context) => {
          const detectionScript = `
            (function() {
              const viteInfo = {
                detected: false,
                devServer: null,
                hmr: null,
                build: null,
                plugins: [],
                version: null
              };
              
              // Method 1: Check for Vite HMR runtime
              if (window.__vite__ || window.__vite_global__) {
                viteInfo.detected = true;
                const viteRuntime = window.__vite__ || window.__vite_global__;
                
                viteInfo.hmr = {
                  available: true,
                  connected: !!viteRuntime.ws,
                  url: viteRuntime.ws?.url || null,
                  readyState: viteRuntime.ws?.readyState || null
                };
                
                if (viteRuntime.version) {
                  viteInfo.version = viteRuntime.version;
                }
              }
              
              // Method 2: Check for Vite client script
              const viteClientScript = document.querySelector('script[src*="@vite/client"]') ||
                                    document.querySelector('script[src*="vite/client"]');
              
              if (viteClientScript) {
                viteInfo.detected = true;
                viteInfo.devServer = {
                  client: true,
                  scriptSrc: viteClientScript.src,
                  type: viteClientScript.type || 'module'
                };
              }
              
              // Method 3: Check for Vite dev server indicators
              const scripts = Array.from(document.querySelectorAll('script'));
              const viteModules = scripts.filter(script => 
                script.src && (
                  script.src.includes('/@vite/') ||
                  script.src.includes('/@fs/') ||
                  script.type === 'module' && script.src.includes('?')
                )
              );
              
              if (viteModules.length > 0) {
                viteInfo.detected = true;
                viteInfo.devServer = {
                  ...viteInfo.devServer,
                  moduleCount: viteModules.length,
                  sampleModules: viteModules.slice(0, 5).map(script => ({
                    src: script.src,
                    type: script.type
                  }))
                };
              }
              
              // Method 4: Check for import.meta.hot (Vite HMR API)
              try {
                if (typeof import !== 'undefined' && import.meta && import.meta.hot) {
                  viteInfo.detected = true;
                  viteInfo.hmr = {
                    ...viteInfo.hmr,
                    importMetaHot: true,
                    hotApi: {
                      accept: !!import.meta.hot.accept,
                      dispose: !!import.meta.hot.dispose,
                      decline: !!import.meta.hot.decline,
                      invalidate: !!import.meta.hot.invalidate
                    }
                  };
                }
              } catch (error) {
                // import.meta may not be available in all contexts
                viteInfo.importMetaError = error.message;
              }
              
              // Method 5: Check for Vite-specific meta tags
              const viteMeta = document.querySelector('meta[name="vite-module-preload-polyfill"]') ||
                            document.querySelector('meta[name="vite"]');
              
              if (viteMeta) {
                viteInfo.detected = true;
                viteInfo.build = {
                  hasMetaTags: true,
                  preloadPolyfill: !!document.querySelector('meta[name="vite-module-preload-polyfill"]')
                };
              }
              
              // Method 6: Check for Vite plugin indicators
              const pluginIndicators = {
                react: !!document.querySelector('script[src*="react"]') && viteInfo.detected,
                vue: !!document.querySelector('script[src*="vue"]') && viteInfo.detected,
                typescript: !!document.querySelector('script[src*=".ts"]') && viteInfo.detected,
                css: !!document.querySelector('link[href*=".css?"]') && viteInfo.detected,
                pwa: !!document.querySelector('link[rel="manifest"]') && viteInfo.detected
              };
              
              viteInfo.plugins = Object.entries(pluginIndicators)
                .filter(([_, detected]) => detected)
                .map(([name]) => name);
              
              // Method 7: Check for development vs production build
              const isDev = viteInfo.hmr?.available || 
                          viteClientScript || 
                          viteModules.length > 0;
              
              const isProd = !isDev && (
                viteMeta ||
                document.querySelectorAll('script[type="module"]').length > 0 ||
                document.querySelectorAll('link[rel="modulepreload"]').length > 0
              );
              
              viteInfo.environment = {
                development: isDev,
                production: isProd,
                mode: isDev ? 'development' : isProd ? 'production' : 'unknown'
              };
              
              // Method 8: Performance and timing information
              if (window.performance) {
                const navigationEntries = performance.getEntriesByType('navigation');
                const resourceEntries = performance.getEntriesByType('resource');
                
                viteInfo.performance = {
                  domContentLoaded: navigationEntries[0]?.domContentLoadedEventEnd || 0,
                  loadComplete: navigationEntries[0]?.loadEventEnd || 0,
                  resourceCount: resourceEntries.length,
                  viteResources: resourceEntries.filter(entry => 
                    entry.name.includes('@vite') || 
                    entry.name.includes('?v=') ||
                    entry.name.includes('?t=')
                  ).length
                };
              }
              
              return {
                ...viteInfo,
                timestamp: new Date().toISOString(),
                summary: {
                  detected: viteInfo.detected,
                  environment: viteInfo.environment?.mode || 'unknown',
                  hmrAvailable: !!viteInfo.hmr?.available,
                  pluginsDetected: viteInfo.plugins.length,
                  confidence: viteInfo.hmr?.available ? 'high' : 
                            viteInfo.devServer ? 'medium' : 
                            viteInfo.detected ? 'low' : 'none'
                }
              };
            })()
          `;

          const result = await withCDPCommand(
            'Runtime.evaluate',
            {
              expression: detectionScript,
              returnByValue: true,
              generatePreview: false
            },
            context
          );

          if (result.isErr()) {
            return {
              success: false,
              error: result.unwrapErr()
            };
          }

          const unwrapped = result.unwrap() as any;
          return {
            success: true,
            data: unwrapped.result?.value || { detected: false }
          };
        },
        {
          type: 'object',
          properties: {
            sessionId: { 
              type: 'string', 
              description: 'Optional Chrome session ID'
            }
          },
          required: []
        }
      )
    );

    // Register vite_hmr_inspect tool
    this.registerTool(
      this.createTool(
        'vite_hmr_inspect',
        'Inspect Vite Hot Module Replacement state and module updates',
        hmrInspectSchema,
        async (args, context) => {
          const hmrInspectionScript = `
            (function() {
              const hmrInfo = {
                status: 'disconnected',
                modules: [],
                updates: [],
                errors: []
              };
              
              const includeModules = ${args.includeModules !== false};
              const includeHistory = ${args.includeHistory === true};
              const moduleFilter = '${args.moduleFilter || ''}';
              
              // Check Vite HMR connection
              if (window.__vite__ && window.__vite__.ws) {
                const ws = window.__vite__.ws;
                
                hmrInfo.status = ['connecting', 'open', 'closing', 'closed'][ws.readyState] || 'unknown';
                hmrInfo.connection = {
                  url: ws.url,
                  readyState: ws.readyState,
                  protocol: ws.protocol,
                  extensions: ws.extensions
                };
                
                // Monitor HMR events if not already monitored
                if (!ws._curupiraHMRMonitored) {
                  const hmrEvents = [];
                  
                  // Store original message handler
                  const originalOnMessage = ws.onmessage;
                  
                  ws.addEventListener('message', (event) => {
                    try {
                      const data = JSON.parse(event.data);
                      hmrEvents.push({
                        type: data.type,
                        timestamp: Date.now(),
                        data: data
                      });
                      
                      // Keep only recent events
                      if (hmrEvents.length > 100) {
                        hmrEvents.shift();
                      }
                    } catch (error) {
                      hmrEvents.push({
                        type: 'parse-error',
                        timestamp: Date.now(),
                        error: error.message
                      });
                    }
                  });
                  
                  ws._curupiraHMRMonitored = true;
                  ws._curupiraHMREvents = hmrEvents;
                }
                
                // Include recent HMR events
                if (ws._curupiraHMREvents) {
                  hmrInfo.recentEvents = ws._curupiraHMREvents.slice(-20);
                  hmrInfo.updates = ws._curupiraHMREvents.filter(event => 
                    event.type === 'update' || event.type === 'full-reload'
                  );
                  hmrInfo.errors = ws._curupiraHMREvents.filter(event => 
                    event.type === 'error'
                  );
                }
              }
              
              // Check for import.meta.hot modules
              if (includeModules) {
                try {
                  // This is a simplified check - real module tracking would need runtime support
                  const moduleInfo = {
                    importMetaHotSupported: typeof import !== 'undefined' && 
                                          import.meta && 
                                          !!import.meta.hot,
                    hotModules: []
                  };
                  
                  // Check for modules with HMR boundaries in script tags
                  const scripts = Array.from(document.querySelectorAll('script[type="module"]'));
                  
                  scripts.forEach((script, index) => {
                    if (script.src) {
                      const moduleUrl = script.src;
                      
                      // Apply module filter if specified
                      if (moduleFilter && !moduleUrl.includes(moduleFilter)) {
                        return;
                      }
                      
                      const moduleData = {
                        index,
                        url: moduleUrl,
                        isViteModule: moduleUrl.includes('@vite') || 
                                    moduleUrl.includes('?v=') ||
                                    moduleUrl.includes('?t='),
                        hasHMRBoundary: moduleUrl.includes('?t='), // Timestamp indicates HMR update
                        type: script.type
                      };
                      
                      moduleInfo.hotModules.push(moduleData);
                    }
                  });
                  
                  hmrInfo.modules = moduleInfo.hotModules;
                  hmrInfo.moduleStats = {
                    total: moduleInfo.hotModules.length,
                    viteModules: moduleInfo.hotModules.filter(m => m.isViteModule).length,
                    withHMR: moduleInfo.hotModules.filter(m => m.hasHMRBoundary).length
                  };
                } catch (error) {
                  hmrInfo.moduleError = error.message;
                }
              }
              
              // Check for HMR update history
              if (includeHistory && window.__vite__) {
                try {
                  // Look for Vite's internal update tracking
                  hmrInfo.updateHistory = {
                    note: 'Full update history requires Vite development server logs',
                    recentUpdates: hmrInfo.updates.length,
                    lastUpdate: hmrInfo.updates.length > 0 ? 
                      hmrInfo.updates[hmrInfo.updates.length - 1].timestamp : null
                  };
                } catch (error) {
                  hmrInfo.historyError = error.message;
                }
              }
              
              // Performance metrics for HMR
              if (window.performance) {
                const hmrMetrics = {
                  updateLatency: null,
                  moduleLoadTime: null
                };
                
                // Check for performance marks related to HMR
                const marks = performance.getEntriesByType('mark');
                const hmrMarks = marks.filter(mark => 
                  mark.name.includes('hmr') || 
                  mark.name.includes('hot') ||
                  mark.name.includes('vite')
                );
                
                if (hmrMarks.length > 0) {
                  hmrMetrics.viteMarks = hmrMarks.map(mark => ({
                    name: mark.name,
                    startTime: mark.startTime
                  }));
                }
                
                hmrInfo.performance = hmrMetrics;
              }
              
              return {
                ...hmrInfo,
                summary: {
                  connected: hmrInfo.status === 'open',
                  totalModules: hmrInfo.modules.length,
                  recentUpdates: hmrInfo.updates.length,
                  recentErrors: hmrInfo.errors.length,
                  lastActivity: hmrInfo.recentEvents && hmrInfo.recentEvents.length > 0 ? 
                    hmrInfo.recentEvents[hmrInfo.recentEvents.length - 1].timestamp : null
                }
              };
            })()
          `;

          const result = await withScriptExecution(hmrInspectionScript, context);

          if (result.isErr()) {
            return {
              success: false,
              error: result.unwrapErr()
            };
          }

          return {
            success: true,
            data: result.unwrap()
          };
        },
        {
          type: 'object',
          properties: {
            includeModules: { 
              type: 'boolean', 
              description: 'Include module information in HMR inspection',
              default: true
            },
            includeHistory: { 
              type: 'boolean', 
              description: 'Include HMR update history',
              default: false
            },
            moduleFilter: { 
              type: 'string', 
              description: 'Filter modules by URL pattern'
            },
            sessionId: { 
              type: 'string', 
              description: 'Optional Chrome session ID'
            }
          },
          required: []
        }
      )
    );

    // Register vite_bundle_analyze tool
    this.registerTool(
      this.createTool(
        'vite_bundle_analyze',
        'Analyze Vite bundle composition and module dependencies',
        bundleAnalysisSchema,
        async (args, context) => {
          const bundleAnalysisScript = `
            (function() {
              const bundleInfo = {
                modules: [],
                assets: [],
                dependencies: {},
                size: {
                  total: 0,
                  javascript: 0,
                  css: 0,
                  assets: 0
                }
              };
              
              const analyzeSize = ${args.analyzeSize !== false};
              const analyzeImports = ${args.analyzeImports !== false};
              const includeAssets = ${args.includeAssets === true};
              
              // Analyze script modules
              const scripts = Array.from(document.querySelectorAll('script'));
              
              scripts.forEach((script, index) => {
                if (script.src) {
                  const moduleInfo = {
                    index,
                    url: script.src,
                    type: script.type || 'text/javascript',
                    isModule: script.type === 'module',
                    isViteGenerated: script.src.includes('@vite') || 
                                   script.src.includes('?v=') ||
                                   script.src.includes('?t='),
                    size: 0
                  };
                  
                  // Estimate size if analyzing size
                  if (analyzeSize) {
                    try {
                      // This is a rough estimate - real size would need network inspection
                      const urlParams = new URL(script.src);
                      moduleInfo.hasQuery = urlParams.search.length > 0;
                      moduleInfo.parameters = Object.fromEntries(urlParams.searchParams);
                    } catch (error) {
                      moduleInfo.urlError = error.message;
                    }
                  }
                  
                  bundleInfo.modules.push(moduleInfo);
                }
              });
              
              // Analyze CSS assets
              const stylesheets = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
              
              stylesheets.forEach((link, index) => {
                const cssInfo = {
                  index,
                  url: link.href,
                  media: link.media || 'all',
                  isViteGenerated: link.href.includes('?v=') || link.href.includes('?t='),
                  size: 0
                };
                
                if (analyzeSize) {
                  try {
                    // Check if stylesheet has loaded and try to estimate size
                    if (link.sheet && link.sheet.cssRules) {
                      cssInfo.rules = link.sheet.cssRules.length;
                      cssInfo.size = Array.from(link.sheet.cssRules)
                        .reduce((total, rule) => total + (rule.cssText?.length || 0), 0);
                    }
                  } catch (error) {
                    cssInfo.sizeError = 'Cross-origin or security restriction';
                  }
                }
                
                bundleInfo.modules.push(cssInfo);
                bundleInfo.size.css += cssInfo.size || 0;
              });
              
              // Analyze import dependencies if requested
              if (analyzeImports) {
                const dependencyMap = {};
                
                // Check for module preload links (indicate dependencies)
                const preloads = Array.from(document.querySelectorAll('link[rel="modulepreload"]'));
                preloads.forEach(link => {
                  const moduleName = link.href.split('/').pop()?.split('?')[0] || 'unknown';
                  dependencyMap[moduleName] = {
                    url: link.href,
                    type: 'preload',
                    as: link.as || 'script'
                  };
                });
                
                bundleInfo.dependencies = dependencyMap;
                bundleInfo.dependencyCount = Object.keys(dependencyMap).length;
              }
              
              // Analyze other assets if requested
              if (includeAssets) {
                const images = Array.from(document.querySelectorAll('img'));
                const videos = Array.from(document.querySelectorAll('video, source'));
                const fonts = Array.from(document.querySelectorAll('link[rel="preload"][as="font"]'));
                
                bundleInfo.assets = {
                  images: images.map(img => ({
                    src: img.src,
                    alt: img.alt,
                    loading: img.loading,
                    isLazy: img.loading === 'lazy'
                  })),
                  videos: videos.map(video => ({
                    src: video.src,
                    type: video.type || 'unknown'
                  })),
                  fonts: fonts.map(font => ({
                    href: font.href,
                    type: font.type,
                    crossorigin: font.crossOrigin
                  }))
                };
                
                bundleInfo.assetStats = {
                  totalImages: images.length,
                  totalVideos: videos.length,
                  totalFonts: fonts.length,
                  lazyImages: images.filter(img => img.loading === 'lazy').length
                };
              }
              
              // Calculate bundle statistics
              bundleInfo.statistics = {
                totalModules: bundleInfo.modules.length,
                viteModules: bundleInfo.modules.filter(m => m.isViteGenerated).length,
                esModules: bundleInfo.modules.filter(m => m.isModule).length,
                stylesheets: stylesheets.length,
                preloadModules: bundleInfo.dependencyCount || 0
              };
              
              // Performance analysis
              if (window.performance) {
                const navigationEntry = performance.getEntriesByType('navigation')[0];
                const resourceEntries = performance.getEntriesByType('resource');
                
                bundleInfo.performance = {
                  domContentLoaded: navigationEntry?.domContentLoadedEventEnd || 0,
                  loadComplete: navigationEntry?.loadEventEnd || 0,
                  firstPaint: null,
                  firstContentfulPaint: null
                };
                
                // Get paint timings
                const paintEntries = performance.getEntriesByType('paint');
                paintEntries.forEach(entry => {
                  if (entry.name === 'first-paint') {
                    bundleInfo.performance.firstPaint = entry.startTime;
                  } else if (entry.name === 'first-contentful-paint') {
                    bundleInfo.performance.firstContentfulPaint = entry.startTime;
                  }
                });
                
                // Analyze resource loading
                bundleInfo.performance.resources = {
                  total: resourceEntries.length,
                  scripts: resourceEntries.filter(r => r.initiatorType === 'script').length,
                  stylesheets: resourceEntries.filter(r => r.initiatorType === 'link').length,
                  images: resourceEntries.filter(r => r.initiatorType === 'img').length,
                  slowestResource: resourceEntries.reduce((slowest, current) => 
                    current.duration > (slowest?.duration || 0) ? current : slowest, null
                  )
                };
              }
              
              return bundleInfo;
            })()
          `;

          const result = await withScriptExecution(bundleAnalysisScript, context);

          if (result.isErr()) {
            return {
              success: false,
              error: result.unwrapErr()
            };
          }

          return {
            success: true,
            data: result.unwrap()
          };
        },
        {
          type: 'object',
          properties: {
            analyzeSize: { 
              type: 'boolean', 
              description: 'Analyze module and asset sizes',
              default: true
            },
            analyzeImports: { 
              type: 'boolean', 
              description: 'Analyze import dependencies and relationships',
              default: true
            },
            includeAssets: { 
              type: 'boolean', 
              description: 'Include analysis of images, fonts, and other assets',
              default: false
            },
            sessionId: { 
              type: 'string', 
              description: 'Optional Chrome session ID'
            }
          },
          required: []
        }
      )
    );

    // Register vite_dev_server_info tool
    this.registerTool({
      name: 'vite_dev_server_info',
      description: 'Get Vite development server configuration and status',
      argsSchema: {
        parse: (value) => {
          const obj = (value || {}) as any;
          return {
            includeConfig: typeof obj.includeConfig === 'boolean' ? obj.includeConfig : true,
            includePlugins: typeof obj.includePlugins === 'boolean' ? obj.includePlugins : true,
            sessionId: obj.sessionId
          };
        },
        safeParse: function(value) {
          try {
            const parsed = this.parse(value);
            return { success: true, data: parsed };
          } catch (error) {
            return { success: false, error };
          }
        }
      },
      jsonSchema: {
        type: 'object',
        properties: {
          includeConfig: { 
            type: 'boolean', 
            description: 'Include Vite configuration information',
            default: true
          },
          includePlugins: { 
            type: 'boolean', 
            description: 'Include detected Vite plugins',
            default: true
          },
          sessionId: { 
            type: 'string', 
            description: 'Optional Chrome session ID'
          }
        },
        required: []
      },
      handler: async (args, context) => {
        const devServerInfoScript = `
          (function() {
            const serverInfo = {
              status: 'unknown',
              config: {},
              plugins: [],
              environment: {}
            };
            
            const includeConfig = ${args.includeConfig !== false};
            const includePlugins = ${args.includePlugins !== false};
            
            // Check for Vite development environment
            const isViteDev = !!(window.__vite__ || 
                               document.querySelector('script[src*="@vite/client"]') ||
                               document.querySelector('script[src*="?v="]'));
            
            serverInfo.status = isViteDev ? 'development' : 'production-or-unknown';
            
            // Environment information
            serverInfo.environment = {
              isDevelopment: isViteDev,
              hasHMR: !!(window.__vite__ && window.__vite__.ws),
              userAgent: navigator.userAgent,
              url: window.location.href,
              protocol: window.location.protocol,
              host: window.location.host
            };
            
            // Configuration detection
            if (includeConfig) {
              const config = {
                base: '/', // Default, could be detected from script paths
                mode: isViteDev ? 'development' : 'production',
                build: {},
                server: {}
              };
              
              // Try to detect base path from script URLs
              const scripts = Array.from(document.querySelectorAll('script[src]'));
              const viteScripts = scripts.filter(s => s.src.includes('@vite') || s.src.includes('?v='));
              
              if (viteScripts.length > 0) {
                try {
                  const sampleUrl = new URL(viteScripts[0].src);
                  const pathParts = sampleUrl.pathname.split('/');
                  
                  // Look for common base patterns
                  if (pathParts.includes('@vite')) {
                    const viteIndex = pathParts.indexOf('@vite');
                    config.base = pathParts.slice(0, viteIndex).join('/') || '/';
                  }
                } catch (error) {
                  config.baseDetectionError = error.message;
                }
              }
              
              // Detect build configuration from production indicators
              if (!isViteDev) {
                config.build = {
                  outDir: 'dist', // Common default
                  assetsDir: 'assets',
                  hasManifest: !!document.querySelector('link[rel="manifest"]'),
                  hasServiceWorker: 'serviceWorker' in navigator
                };
              }
              
              // Server configuration (development)
              if (isViteDev && window.__vite__) {
                config.server = {
                  hmr: {
                    port: window.__vite__.ws?.url ? 
                      new URL(window.__vite__.ws.url).port : 
                      window.location.port,
                    host: window.location.hostname
                  }
                };
              }
              
              serverInfo.config = config;
            }
            
            // Plugin detection
            if (includePlugins) {
              const detectedPlugins = [];
              
              // React plugin detection
              if (window.React || document.querySelector('script[src*="react"]')) {
                detectedPlugins.push({
                  name: '@vitejs/plugin-react',
                  detected: 'react-presence',
                  features: {
                    fastRefresh: isViteDev && !!window.__REACT_DEVTOOLS_GLOBAL_HOOK__,
                    jsxRuntime: 'automatic-or-classic'
                  }
                });
              }
              
              // TypeScript plugin detection
              const hasTypeScript = Array.from(document.querySelectorAll('script')).some(s => 
                s.src && (s.src.includes('.ts') || s.src.includes('.tsx'))
              );
              
              if (hasTypeScript) {
                detectedPlugins.push({
                  name: '@vitejs/plugin-typescript',
                  detected: 'typescript-modules',
                  features: {
                    typeChecking: 'runtime-or-build'
                  }
                });
              }
              
              // CSS plugins detection
              const cssFeatures = {
                modules: Array.from(document.styleSheets).some(sheet => {
                  try {
                    return Array.from(sheet.cssRules || []).some(rule => 
                      rule.selectorText && rule.selectorText.includes('_')
                    );
                  } catch (e) {
                    return false;
                  }
                }),
                postcss: document.querySelector('style[data-vite-dev-id]') !== null,
                sass: Array.from(document.querySelectorAll('link')).some(link => 
                  link.href && link.href.includes('.scss')
                )
              };
              
              Object.entries(cssFeatures).forEach(([feature, detected]) => {
                if (detected) {
                  detectedPlugins.push({
                    name: \`css-\${feature}\`,
                    detected: \`css-\${feature}-presence\`,
                    type: 'css-processing'
                  });
                }
              });
              
              // PWA plugin detection
              if (document.querySelector('link[rel="manifest"]') || 
                  'serviceWorker' in navigator) {
                detectedPlugins.push({
                  name: 'vite-plugin-pwa',
                  detected: 'pwa-features',
                  features: {
                    manifest: !!document.querySelector('link[rel="manifest"]'),
                    serviceWorker: 'serviceWorker' in navigator,
                    workbox: !!window.workbox
                  }
                });
              }
              
              serverInfo.plugins = detectedPlugins;
            }
            
            // Additional development info
            if (isViteDev) {
              serverInfo.development = {
                hotReload: !!window.__vite__,
                devtools: {
                  react: !!window.__REACT_DEVTOOLS_GLOBAL_HOOK__,
                  vue: !!window.__VUE_DEVTOOLS_GLOBAL_HOOK__,
                  apollo: !!window.__APOLLO_DEVTOOLS_GLOBAL_HOOK__
                },
                moduleGraph: {
                  note: 'Module graph requires server-side access',
                  estimatedModules: scripts.length
                }
              };
            }
            
            return {
              ...serverInfo,
              summary: {
                status: serverInfo.status,
                environment: serverInfo.environment.isDevelopment ? 'development' : 'production',
                hmrConnected: serverInfo.environment.hasHMR,
                pluginsDetected: serverInfo.plugins.length,
                timestamp: new Date().toISOString()
              }
            };
          })()
        `;

        const result = await withScriptExecution(devServerInfoScript, context);

        if (result.isErr()) {
          return {
            success: false,
            error: result.unwrapErr()
          };
        }

        return {
          success: true,
          data: result.unwrap()
        };
      }
    });
  }
}

export class ViteToolProviderFactory extends BaseProviderFactory<ViteToolProvider> {
  create(deps: ProviderDependencies): ViteToolProvider {
    const config: BaseToolProviderConfig = {
      name: 'vite',
      description: 'Vite development server and build debugging tools'
    };

    return new ViteToolProvider(
      deps.chromeService,
      this.createProviderLogger(deps, config.name),
      deps.validator,
      config
    );
  }
}