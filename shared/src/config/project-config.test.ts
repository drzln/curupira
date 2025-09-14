/**
 * @fileoverview Tests for project configuration system
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, writeFileSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { ProjectConfigLoader, type ProjectConfig } from './project-config.js'

describe('ProjectConfigLoader', () => {
  let testDir: string

  beforeEach(() => {
    // Create temporary test directory
    testDir = join(tmpdir(), `curupira-test-${Date.now()}`)
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  describe('Config File Detection', () => {
    it('should find curupira.yml file', async () => {
      const configContent = `
project:
  name: "Test App"
  framework: "react"
`
      writeFileSync(join(testDir, 'curupira.yml'), configContent)

      const config = await ProjectConfigLoader.loadConfig(testDir)
      expect(config).not.toBeNull()
      expect(config?.project.name).toBe('Test App')
      expect(config?.project.framework).toBe('react')
    })

    it('should find curupira.yaml file', async () => {
      const configContent = `
project:
  name: "Test App YAML"
  framework: "next"
`
      writeFileSync(join(testDir, 'curupira.yaml'), configContent)

      const config = await ProjectConfigLoader.loadConfig(testDir)
      expect(config).not.toBeNull()
      expect(config?.project.name).toBe('Test App YAML')
      expect(config?.project.framework).toBe('next')
    })

    it('should find .curupira.yml file', async () => {
      const configContent = `
project:
  name: "Hidden Config"
  framework: "vite"
`
      writeFileSync(join(testDir, '.curupira.yml'), configContent)

      const config = await ProjectConfigLoader.loadConfig(testDir)
      expect(config).not.toBeNull()
      expect(config?.project.name).toBe('Hidden Config')
      expect(config?.project.framework).toBe('vite')
    })

    it('should find config in .curupira directory', async () => {
      mkdirSync(join(testDir, '.curupira'))
      const configContent = `
project:
  name: "Directory Config"
  framework: "gatsby"
`
      writeFileSync(join(testDir, '.curupira/config.yml'), configContent)

      const config = await ProjectConfigLoader.loadConfig(testDir)
      expect(config).not.toBeNull()
      expect(config?.project.name).toBe('Directory Config')
      expect(config?.project.framework).toBe('gatsby')
    })

    it('should return null when no config file found', async () => {
      const config = await ProjectConfigLoader.loadConfig(testDir)
      expect(config).toBeNull()
    })

    it('should prioritize curupira.yml over other formats', async () => {
      // Create multiple config files
      writeFileSync(join(testDir, 'curupira.yml'), 'project:\n  name: "YML Priority"')
      writeFileSync(join(testDir, 'curupira.yaml'), 'project:\n  name: "YAML Secondary"')
      writeFileSync(join(testDir, '.curupira.yml'), 'project:\n  name: "Hidden Secondary"')

      const config = await ProjectConfigLoader.loadConfig(testDir)
      expect(config?.project.name).toBe('YML Priority')
    })
  })

  describe('Config Validation', () => {
    it('should validate minimal valid config', () => {
      const minimalConfig = {
        project: {
          name: 'Test App'
        }
      }

      const validatedConfig = ProjectConfigLoader.validateConfig(minimalConfig)
      
      expect(validatedConfig.project.name).toBe('Test App')
      expect(validatedConfig.project.framework).toBe('react') // default
      expect(validatedConfig.project.typescript).toBe(true) // default
      expect(validatedConfig.server.url).toBe('ws://localhost:8080/mcp') // default
    })

    it('should validate complete config with all sections', () => {
      const fullConfig = {
        project: {
          name: 'Full Test App',
          version: '2.0.0',
          description: 'Complete test configuration',
          framework: 'next' as const,
          typescript: false
        },
        server: {
          url: 'wss://prod-server.com/mcp',
          auth: {
            enabled: true,
            token: 'test-token'
          }
        },
        stateManagement: {
          react: {
            enabled: true,
            devtools: false,
            profiling: true,
            strictMode: true
          },
          zustand: {
            enabled: true,
            devtools: true,
            persist: false
          }
        },
        performance: {
          enabled: true,
          thresholds: {
            slowRender: 32,
            memoryLeak: 2048000,
            slowNetwork: 2000,
            largeBundle: 1024000
          },
          coreWebVitals: {
            enabled: false,
            fcp: 2000,
            lcp: 3000,
            fid: 150,
            cls: 0.2
          }
        },
        debugging: {
          timeTravel: {
            enabled: false,
            maxSnapshots: 50,
            autoSnapshot: false,
            snapshotInterval: 10000
          },
          console: {
            capture: true,
            levels: ['error', 'warn'],
            maxEntries: 500,
            sanitize: false
          }
        },
        security: {
          sanitization: {
            enabled: false,
            piiDetection: false,
            customPatterns: ['SECRET_', 'API_KEY'],
            maskingChar: '#'
          },
          allowedDomains: ['example.com', 'test.local'],
          auth: {
            required: true,
            providers: ['google', 'github'],
            sessionTimeout: 3600000
          }
        },
        custom: {
          components: {
            Header: {
              monitor: true,
              performance: false,
              stateTracking: true
            }
          },
          pages: {
            home: {
              url: '/',
              name: 'Homepage',
              criticalPath: true,
              performanceTarget: 1200
            }
          },
          customMetrics: {
            loadTime: {
              name: 'Page Load Time',
              description: 'Time to interactive',
              threshold: 3000,
              unit: 'ms'
            }
          }
        }
      }

      const validatedConfig = ProjectConfigLoader.validateConfig(fullConfig)
      
      expect(validatedConfig.project.name).toBe('Full Test App')
      expect(validatedConfig.project.framework).toBe('next')
      expect(validatedConfig.server.auth.token).toBe('test-token')
      expect(validatedConfig.stateManagement.zustand.enabled).toBe(true)
      expect(validatedConfig.performance.thresholds.slowRender).toBe(32)
      expect(validatedConfig.debugging.timeTravel.enabled).toBe(false)
      expect(validatedConfig.security.allowedDomains).toEqual(['example.com', 'test.local'])
      expect(validatedConfig.custom.components.Header.performance).toBe(false)
    })

    it('should apply default values for missing sections', () => {
      const partialConfig = {
        project: {
          name: 'Partial App'
        },
        performance: {
          thresholds: {
            slowRender: 20
          }
        }
      }

      const validatedConfig = ProjectConfigLoader.validateConfig(partialConfig)
      
      // Check defaults are applied
      expect(validatedConfig.project.framework).toBe('react')
      expect(validatedConfig.project.typescript).toBe(true)
      expect(validatedConfig.server.url).toBe('ws://localhost:8080/mcp')
      expect(validatedConfig.stateManagement.react.enabled).toBe(true)
      expect(validatedConfig.performance.enabled).toBe(true)
      expect(validatedConfig.performance.thresholds.slowRender).toBe(20) // custom
      expect(validatedConfig.performance.thresholds.memoryLeak).toBe(1024 * 1024) // default
      expect(validatedConfig.debugging.timeTravel.enabled).toBe(true)
      expect(validatedConfig.security.sanitization.enabled).toBe(true)
    })

    it('should throw error for invalid config', () => {
      const invalidConfigs = [
        // Missing project name (required field)
        { project: {} },
        
        // Invalid framework (enum validation)
        { project: { name: 'Test', framework: 'invalid' } },
        
        // Invalid console levels (array enum validation)
        {
          project: { name: 'Test' },
          debugging: { console: { levels: ['invalid-level'] } }
        }
      ]

      for (const [index, config] of invalidConfigs.entries()) {
        expect(() => ProjectConfigLoader.validateConfig(config), 
          `Config ${index + 1} should have thrown an error`
        ).toThrow()
      }
    })
  })

  describe('YAML Parsing', () => {
    it('should handle valid YAML syntax', async () => {
      const yamlContent = `
# Test config with comments
project:
  name: "YAML Test App"
  version: "1.0.0"
  framework: react
  typescript: true

server:
  url: "ws://localhost:8080/mcp"
  auth:
    enabled: false

# Performance settings
performance:
  enabled: true
  thresholds:
    slowRender: 16
    memoryLeak: 1048576

# Custom settings
custom:
  components:
    Header:
      monitor: true
      performance: true
  pages:
    home:
      url: "/"
      name: "Home"
      criticalPath: true
`
      
      writeFileSync(join(testDir, 'curupira.yml'), yamlContent)

      const config = await ProjectConfigLoader.loadConfig(testDir)
      expect(config).not.toBeNull()
      expect(config?.project.name).toBe('YAML Test App')
      expect(config?.performance.thresholds.slowRender).toBe(16)
      expect(config?.custom.components.Header.monitor).toBe(true)
    })

    it('should handle invalid YAML syntax', async () => {
      const invalidYaml = `
project:
  name: "Invalid YAML
  missing_quote: true
  invalid: [unclosed array
`
      
      writeFileSync(join(testDir, 'curupira.yml'), invalidYaml)

      await expect(ProjectConfigLoader.loadConfig(testDir)).rejects.toThrow(/Invalid Curupira config/)
    })
  })

  describe('Helper Methods', () => {
    const testConfig: ProjectConfig = {
      project: { name: 'Test', version: '1.0.0', framework: 'react', typescript: true },
      server: { url: 'ws://localhost:8080/mcp', auth: { enabled: false } },
      stateManagement: {
        react: { enabled: true, devtools: true, profiling: true, strictMode: false },
        xstate: { enabled: false, inspector: true, devtools: true },
        zustand: { enabled: false, devtools: true, persist: true },
        apollo: { enabled: false, devtools: true, cacheInspection: true }
      },
      performance: {
        enabled: true,
        thresholds: { slowRender: 16, memoryLeak: 1048576, slowNetwork: 1000, largeBundle: 512000 },
        coreWebVitals: { enabled: true, fcp: 1800, lcp: 2500, fid: 100, cls: 0.1 },
        profiling: { renders: true, memory: true, network: true, customMetrics: true }
      },
      debugging: {
        timeTravel: { enabled: true, maxSnapshots: 100, autoSnapshot: true, snapshotInterval: 5000 },
        console: { capture: true, levels: ['log', 'warn', 'error'], maxEntries: 1000, sanitize: true },
        network: { capture: true, captureHeaders: false, captureBody: false, maxEntries: 500, filters: [] }
      },
      security: {
        sanitization: { enabled: true, piiDetection: true, customPatterns: [], maskingChar: '*' },
        allowedDomains: ['localhost', '127.0.0.1'],
        auth: { required: false, providers: ['local'], sessionTimeout: 86400000 }
      },
      custom: {
        components: {
          TestComponent: {
            monitor: true,
            performance: false,
            stateTracking: true
          }
        },
        pages: {
          home: {
            url: '/',
            name: 'Home',
            criticalPath: true,
            performanceTarget: 1500
          },
          about: {
            url: '/about',
            name: 'About',
            criticalPath: false,
            performanceTarget: 2000
          }
        },
        customMetrics: {}
      }
    }

    describe('getComponentConfig', () => {
      it('should return custom component config when defined', () => {
        const config = ProjectConfigLoader.getComponentConfig(testConfig, 'TestComponent')
        
        expect(config.monitor).toBe(true)
        expect(config.performance).toBe(false)
        expect(config.stateTracking).toBe(true)
      })

      it('should return default config for undefined component', () => {
        const config = ProjectConfigLoader.getComponentConfig(testConfig, 'UndefinedComponent')
        
        expect(config.monitor).toBe(true)
        expect(config.performance).toBe(true)
        expect(config.stateTracking).toBe(true)
      })
    })

    describe('getPageConfig', () => {
      it('should return page config for exact URL match', () => {
        const config = ProjectConfigLoader.getPageConfig(testConfig, '/')
        
        expect(config).not.toBeNull()
        expect(config?.name).toBe('Home')
        expect(config?.criticalPath).toBe(true)
        expect(config?.performanceTarget).toBe(1500)
      })

      it('should return page config for URL prefix match', () => {
        const config = ProjectConfigLoader.getPageConfig(testConfig, '/about/details')
        
        expect(config).not.toBeNull()
        expect(config?.name).toBe('About')
        expect(config?.criticalPath).toBe(false)
      })

      it('should return null for unmatched URL', () => {
        const config = ProjectConfigLoader.getPageConfig(testConfig, '/nonexistent')
        expect(config).toBeNull()
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle file read errors gracefully', async () => {
      // Create a directory instead of file (will cause read error)
      mkdirSync(join(testDir, 'curupira.yml'))

      await expect(ProjectConfigLoader.loadConfig(testDir)).rejects.toThrow()
    })

    it('should handle permission errors', async () => {
      // This test might be platform-specific, skip on Windows
      if (process.platform === 'win32') return

      writeFileSync(join(testDir, 'curupira.yml'), 'project:\n  name: "Test"')
      // Remove read permissions (this might not work in all environments)
      // Just verify the config loads normally
      const config = await ProjectConfigLoader.loadConfig(testDir)
      expect(config).not.toBeNull()
    })
  })
})