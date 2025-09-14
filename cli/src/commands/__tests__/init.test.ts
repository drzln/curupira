/**
 * @fileoverview Tests for InitCommand
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { InitCommand } from '../init.js'
import type { CliContext, TemplateData } from '../../types.js'

// Mock dependencies
vi.mock('@curupira/shared', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }))
}))

vi.mock('fs', () => ({
  writeFileSync: vi.fn(),
  existsSync: vi.fn()
}))

vi.mock('prompts', () => ({
  default: vi.fn()
}))

vi.mock('../../utils/project-detector.js', () => ({
  detectProject: vi.fn(),
  validateProject: vi.fn()
}))

vi.mock('../../utils/template-generator.js', () => ({
  generateConfigTemplate: vi.fn(),
  validateTemplate: vi.fn()
}))

// Mock console methods
const originalConsole = {
  log: console.log
}

describe('InitCommand', () => {
  let command: InitCommand
  let mockContext: CliContext

  beforeEach(() => {
    command = new InitCommand()
    mockContext = {
      config: {
        version: '1.0.0',
        verbose: false,
        silent: false,
        logLevel: 'info',
        projectRoot: '/test/project'
      },
      projectConfig: null,
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
      expect(command.name).toBe('init')
      expect(command.description).toBe('Initialize Curupira in a React project')
    })
  })

  describe('execute()', () => {
    it('should initialize successfully in React project', async () => {
      const { existsSync, writeFileSync } = await import('fs')
      const { detectProject, validateProject } = await import('../../utils/project-detector.js')
      const { generateConfigTemplate, validateTemplate } = await import('../../utils/template-generator.js')

      // Setup mocks
      vi.mocked(existsSync).mockImplementation((path: any) => !path.includes('curupira.yml')) // No existing config
      vi.mocked(detectProject).mockResolvedValue({
        hasReact: true,
        hasNextJs: false,
        hasVite: false,
        hasGatsby: false,
        hasTypeScript: true,
        framework: 'react',
        packageManager: 'npm',
        dependencies: {},
        devDependencies: {}
      })

      vi.mocked(validateProject).mockReturnValue({ valid: true })
      vi.mocked(generateConfigTemplate).mockResolvedValue('generated config content')
      vi.mocked(validateTemplate).mockReturnValue({ valid: true, errors: [] })

      const result = await command.execute(mockContext)

      expect(result.success).toBe(true)
      expect(result.exitCode).toBe(0)
      expect(writeFileSync).toHaveBeenCalledWith(
        '/test/project/curupira.yml',
        'generated config content',
        'utf-8'
      )
    })

    it('should handle existing config with force option', async () => {
      const { existsSync, writeFileSync } = await import('fs')
      const prompts = await import('prompts')
      const { detectProject } = await import('../../utils/project-detector.js')
      const { generateConfigTemplate } = await import('../../utils/template-generator.js')

      vi.mocked(existsSync).mockReturnValue(true) // Existing config
      vi.mocked(detectProject).mockResolvedValue({
        hasReact: true,
        hasNextJs: false,
        hasVite: false,
        hasGatsby: false,
        hasTypeScript: true,
        framework: 'react',
        packageManager: 'npm',
        dependencies: {},
        devDependencies: {}
      })

      // Add validateProject mock
      const { validateProject } = await import('../../utils/project-detector.js')
      vi.mocked(validateProject).mockReturnValue({ valid: true })

      // Add validateTemplate mock
      const { validateTemplate } = await import('../../utils/template-generator.js')
      vi.mocked(validateTemplate).mockReturnValue({ valid: true, errors: [] })

      vi.mocked(generateConfigTemplate).mockResolvedValue('config content')

      const result = await command.execute(mockContext, { force: true })

      expect(result.success).toBe(true)
      expect(writeFileSync).toHaveBeenCalled()
    })

    it('should handle existing config without force', async () => {
      const { existsSync } = await import('fs')

      vi.mocked(existsSync).mockReturnValue(true)

      const result = await command.execute(mockContext)

      expect(result.success).toBe(true)
      expect(result.message).toContain('already exists')
    })

    it('should handle existing config with force flag', async () => {
      const { existsSync, writeFileSync } = await import('fs')
      const { detectProject, validateProject } = await import('../../utils/project-detector.js')
      const { generateConfigTemplate } = await import('../../utils/template-generator.js')

      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(detectProject).mockResolvedValue({
        hasReact: true,
        hasNextJs: false,
        hasVite: false,
        hasGatsby: false,
        hasTypeScript: true,
        framework: 'react',
        packageManager: 'npm',
        dependencies: {},
        devDependencies: {}
      })
      vi.mocked(validateProject).mockReturnValue({ valid: true })
      vi.mocked(generateConfigTemplate).mockResolvedValue('config')

      const result = await command.execute(mockContext, { force: true })

      expect(result.success).toBe(true)
      expect(writeFileSync).toHaveBeenCalled()
    })

    it('should reject non-React projects', async () => {
      const { existsSync } = await import('fs')
      const { detectProject, validateProject } = await import('../../utils/project-detector.js')

      vi.mocked(existsSync).mockReturnValue(false)
      vi.mocked(detectProject).mockResolvedValue({
        hasReact: false,
        hasNextJs: false,
        hasVite: false,
        hasGatsby: false,
        hasTypeScript: true,
        framework: 'unknown',
        packageManager: 'npm',
        dependencies: {},
        devDependencies: {}
      })
      vi.mocked(validateProject).mockReturnValue({ 
        valid: false, 
        reason: 'No React-based framework detected' 
      })

      const result = await command.execute(mockContext)

      expect(result.success).toBe(false)
      expect(result.message).toContain('Not a React project')
      expect(result.exitCode).toBe(1)
    })

    it('should handle silent mode correctly', async () => {
      const silentContext = {
        ...mockContext,
        config: { ...mockContext.config, silent: true }
      }

      const { existsSync, writeFileSync } = await import('fs')
      const { detectProject, validateProject } = await import('../../utils/project-detector.js')
      const { generateConfigTemplate } = await import('../../utils/template-generator.js')

      vi.mocked(existsSync).mockReturnValue(false)
      vi.mocked(detectProject).mockResolvedValue({
        hasReact: true,
        hasNextJs: false,
        hasVite: false,
        hasGatsby: false,
        hasTypeScript: false,
        framework: 'react',
        packageManager: 'npm',
        dependencies: {},
        devDependencies: {}
      })
      vi.mocked(validateProject).mockReturnValue({ valid: true })
      vi.mocked(generateConfigTemplate).mockResolvedValue('config')

      const result = await command.execute(silentContext)

      expect(result.success).toBe(true)
      // Console.log should not be called in silent mode
      expect(console.log).not.toHaveBeenCalled()
    })

    it('should handle errors gracefully', async () => {
      const { existsSync } = await import('fs')
      const { detectProject } = await import('../../utils/project-detector.js')

      vi.mocked(existsSync).mockReturnValue(false)
      vi.mocked(detectProject).mockRejectedValue(new Error('Detection failed'))

      const result = await command.execute(mockContext)

      expect(result.success).toBe(false)
      expect(result.error).toBeInstanceOf(Error)
      expect(result.exitCode).toBe(1)
    })

    it('should handle non-Error exceptions', async () => {
      const { existsSync } = await import('fs')
      const { detectProject } = await import('../../utils/project-detector.js')

      vi.mocked(existsSync).mockReturnValue(false)
      vi.mocked(detectProject).mockRejectedValue('string error')

      const result = await command.execute(mockContext)

      expect(result.success).toBe(false)
      expect(result.error).toBeInstanceOf(Error)
      expect(result.error?.message).toBe('string error')
    })
  })

})