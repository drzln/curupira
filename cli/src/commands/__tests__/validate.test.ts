/**
 * @fileoverview Tests for ValidateCommand
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ValidateCommand } from '../validate.js'
import type { CliContext } from '../../types.js'

// Mock dependencies
vi.mock('@curupira/shared', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })),
  ProjectConfigLoader: {
    validateConfig: vi.fn()
  }
}))

// Mock console methods
const originalConsole = {
  log: console.log
}

describe('ValidateCommand', () => {
  let command: ValidateCommand
  let mockContext: CliContext

  const mockProjectConfig = {
    project: {
      name: 'Test Project',
      framework: 'react',
      typescript: true
    },
    server: {
      url: 'ws://localhost:8080/mcp'
    },
    stateManagement: {
      react: { enabled: true },
      zustand: { enabled: true },
      xstate: { enabled: false },
      apollo: { enabled: false }
    },
    debugging: {
      timeTravel: { enabled: true }
    },
    performance: {
      enabled: true
    },
    security: {
      sanitization: { enabled: true }
    },
    custom: {
      components: {
        'Header': { track: true },
        'Footer': { track: true }
      },
      pages: {
        'home': { url: '/', critical: true },
        'about': { url: '/about', critical: false }
      }
    }
  }

  beforeEach(() => {
    command = new ValidateCommand()
    mockContext = {
      config: {
        version: '1.0.0',
        verbose: false,
        silent: false,
        logLevel: 'info',
        projectRoot: '/test/project'
      },
      projectConfig: mockProjectConfig,
      cwd: '/test/project',
      packageJson: { name: 'test', version: '1.0.0' }
    }

    // Mock console.log
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    console.log = originalConsole.log
  })

  describe('basic properties', () => {
    it('should have correct name and description', () => {
      expect(command.name).toBe('validate')
      expect(command.description).toBe('Validate curupira.yml configuration')
    })
  })

  describe('execute()', () => {
    it('should validate configuration successfully', async () => {
      const { ProjectConfigLoader } = await import('@curupira/shared')
      vi.mocked(ProjectConfigLoader.validateConfig).mockReturnValue(mockProjectConfig)

      const result = await command.execute(mockContext)

      expect(result.success).toBe(true)
      expect(result.exitCode).toBe(0)
      expect(result.message).toContain('validated successfully')
      expect(result.data?.config).toEqual(mockProjectConfig)
      expect(ProjectConfigLoader.validateConfig).toHaveBeenCalledWith(mockProjectConfig)
    })

    it('should handle missing project config', async () => {
      const contextWithoutConfig = {
        ...mockContext,
        projectConfig: null
      }

      const result = await command.execute(contextWithoutConfig)

      expect(result.success).toBe(false)
      expect(result.exitCode).toBe(1)
      expect(result.message).toContain('No curupira.yml configuration found')
    })

    it('should handle validation errors', async () => {
      const { ProjectConfigLoader } = await import('@curupira/shared')
      const validationError = new Error('Invalid configuration: missing server.url')
      vi.mocked(ProjectConfigLoader.validateConfig).mockImplementation(() => {
        throw validationError
      })

      const result = await command.execute(mockContext)

      expect(result.success).toBe(false)
      expect(result.exitCode).toBe(1)
      expect(result.message).toContain('Configuration validation failed')
      expect(result.error).toEqual(validationError)
    })

    it('should handle validation errors with fix option', async () => {
      const { ProjectConfigLoader } = await import('@curupira/shared')
      vi.mocked(ProjectConfigLoader.validateConfig).mockImplementation(() => {
        throw new Error('Missing required field')
      })

      const result = await command.execute(mockContext, { fix: true })

      expect(result.success).toBe(false)
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Auto-fix not yet implemented'))
    })

    it('should handle silent mode correctly', async () => {
      const { ProjectConfigLoader } = await import('@curupira/shared')
      vi.mocked(ProjectConfigLoader.validateConfig).mockReturnValue(mockProjectConfig)

      const silentContext = {
        ...mockContext,
        config: { ...mockContext.config, silent: true }
      }

      const result = await command.execute(silentContext)

      expect(result.success).toBe(true)
      // Console.log should not be called in silent mode
      expect(console.log).not.toHaveBeenCalled()
    })

    it('should handle silent mode with errors', async () => {
      const { ProjectConfigLoader } = await import('@curupira/shared')
      vi.mocked(ProjectConfigLoader.validateConfig).mockImplementation(() => {
        throw new Error('Validation error')
      })

      const silentContext = {
        ...mockContext,
        config: { ...mockContext.config, silent: true }
      }

      const result = await command.execute(silentContext)

      expect(result.success).toBe(false)
      expect(console.log).not.toHaveBeenCalled()
    })

    it('should handle unexpected errors', async () => {
      const contextWithError = {
        ...mockContext,
        projectConfig: null
      }

      // Mock context creation to throw
      vi.spyOn(contextWithError, 'projectConfig', 'get').mockImplementation(() => {
        throw new Error('Unexpected error')
      })

      const result = await command.execute(mockContext)

      expect(result.success).toBe(false)
      expect(result.exitCode).toBe(1)
    })

    it('should handle non-Error exceptions in validation', async () => {
      const { ProjectConfigLoader } = await import('@curupira/shared')
      vi.mocked(ProjectConfigLoader.validateConfig).mockImplementation(() => {
        throw 'string error'
      })

      const result = await command.execute(mockContext)

      expect(result.success).toBe(false)
      expect(result.error).toBeInstanceOf(Error)
      expect(result.error?.message).toBe('string error')
    })

    it('should handle non-Error exceptions in general', async () => {
      // Force a non-Error exception
      const badContext = {
        ...mockContext,
        get projectConfig() { 
          throw 'string error'
        }
      }

      const result = await command.execute(badContext)

      expect(result.success).toBe(false)
      expect(result.error).toBeInstanceOf(Error)
      expect(result.error?.message).toBe('string error')
    })
  })

  describe('showConfigSummary()', () => {
    it('should display configuration summary', () => {
      const command = new ValidateCommand()
      
      // Call the private method through any casting for testing
      ;(command as any).showConfigSummary(mockProjectConfig)

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Configuration Summary'))
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Project: Test Project'))
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Framework: react'))
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('TypeScript: Yes'))
    })

    it('should show state management libraries', () => {
      const command = new ValidateCommand()
      
      ;(command as any).showConfigSummary(mockProjectConfig)

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('State Management: React, Zustand'))
    })

    it('should show enabled features', () => {
      const command = new ValidateCommand()
      
      ;(command as any).showConfigSummary(mockProjectConfig)

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Features: Time Travel, Performance Monitoring, Data Sanitization'))
    })

    it('should show component count', () => {
      const command = new ValidateCommand()
      
      ;(command as any).showConfigSummary(mockProjectConfig)

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Monitored Components: 2'))
    })

    it('should show page count', () => {
      const command = new ValidateCommand()
      
      ;(command as any).showConfigSummary(mockProjectConfig)

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Monitored Pages: 2'))
    })

    it('should handle config without state management', () => {
      const configWithoutState = {
        ...mockProjectConfig,
        stateManagement: {
          react: { enabled: false },
          zustand: { enabled: false },
          xstate: { enabled: false },
          apollo: { enabled: false }
        }
      }

      const command = new ValidateCommand()
      ;(command as any).showConfigSummary(configWithoutState)

      // Should not show state management line
      const calls = vi.mocked(console.log).mock.calls
      const hasStateManagementLine = calls.some(call => 
        call[0] && call[0].includes('State Management:')
      )
      expect(hasStateManagementLine).toBe(false)
    })

    it('should handle config without features', () => {
      const configWithoutFeatures = {
        ...mockProjectConfig,
        debugging: { timeTravel: { enabled: false } },
        performance: { enabled: false },
        security: { sanitization: { enabled: false } }
      }

      const command = new ValidateCommand()
      ;(command as any).showConfigSummary(configWithoutFeatures)

      // Should not show features line
      const calls = vi.mocked(console.log).mock.calls
      const hasFeaturesLine = calls.some(call => 
        call[0] && call[0].includes('Features:')
      )
      expect(hasFeaturesLine).toBe(false)
    })
  })
})