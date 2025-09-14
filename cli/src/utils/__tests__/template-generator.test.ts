/**
 * @fileoverview Tests for template generation utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { 
  generateConfigTemplate,
  generateFrameworkTemplate,
  loadTemplateFile,
  validateTemplate
} from '../template-generator.js'
import type { TemplateData } from '../../types.js'

// Mock dependencies
vi.mock('@curupira/shared', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }))
}))

// Mock file system
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn()
}))

describe('template-generator', () => {
  const mockTemplateData: TemplateData = {
    projectName: 'Test Project',
    framework: 'react',
    typescript: true,
    hasStateManagement: {
      zustand: true,
      xstate: false,
      apollo: true
    },
    customComponents: ['Header', 'Footer', 'Navigation'],
    customPages: [
      { name: 'Home', url: '/', critical: true },
      { name: 'About', url: '/about', critical: false }
    ]
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('generateConfigTemplate()', () => {
    it('should generate complete configuration template', async () => {
      const result = await generateConfigTemplate(mockTemplateData)
      
      expect(result).toContain('name: "Test Project"')
      expect(result).toContain('framework: "react"')
      expect(result).toContain('typescript: true')
      expect(result).toContain('enabled: true') // zustand
      expect(result).toContain('enabled: false') // xstate
      expect(result).toContain('Header:')
      expect(result).toContain('Footer:')
      expect(result).toContain('Navigation:')
      expect(result).toContain('home:')
      expect(result).toContain('url: "/"')
      expect(result).toContain('about:')
      expect(result).toContain('url: "/about"')
    })

    it('should handle empty custom components', async () => {
      const data = { ...mockTemplateData, customComponents: [] }
      const result = await generateConfigTemplate(data)
      
      expect(result).toContain('# Example component monitoring')
      expect(result).toContain('# MyComponent:')
    })

    it('should handle empty custom pages', async () => {
      const data = { ...mockTemplateData, customPages: [] }
      const result = await generateConfigTemplate(data)
      
      expect(result).toContain('# Example page monitoring')
      expect(result).toContain('# home:')
    })

    it('should handle all state management disabled', async () => {
      const data = {
        ...mockTemplateData,
        hasStateManagement: {
          zustand: false,
          xstate: false,
          apollo: false
        }
      }
      const result = await generateConfigTemplate(data)
      
      expect(result).toContain('zustand:\n    enabled: false')
      expect(result).toContain('xstate:\n    enabled: false')
      expect(result).toContain('apollo:\n    enabled: false')
    })

    it('should handle TypeScript disabled', async () => {
      const data = { ...mockTemplateData, typescript: false }
      const result = await generateConfigTemplate(data)
      
      expect(result).toContain('typescript: false')
    })

    it('should format component names correctly', async () => {
      const data = {
        ...mockTemplateData,
        customComponents: ['MyComponent', 'user-profile', 'App Header']
      }
      const result = await generateConfigTemplate(data)
      
      expect(result).toContain('MyComponent:')
      expect(result).toContain('user-profile:')
      expect(result).toContain('App Header:')
    })

    it('should create safe page names from URLs', async () => {
      const data = {
        ...mockTemplateData,
        customPages: [
          { name: 'User Profile', url: '/user/profile', critical: true },
          { name: 'Settings & Config', url: '/settings', critical: false }
        ]
      }
      const result = await generateConfigTemplate(data)
      
      expect(result).toContain('userprofile:')
      expect(result).toContain('url: "/user/profile"')
      expect(result).toContain('settingsconfig:')
      expect(result).toContain('url: "/settings"')
    })
  })

  describe('generateFrameworkTemplate()', () => {
    it('should generate Next.js specific template', async () => {
      const result = await generateFrameworkTemplate('next', mockTemplateData)
      
      expect(result).toContain('# Next.js Specific Settings')
      expect(result).toContain('nextjs:')
      expect(result).toContain('ssr: true')
      expect(result).toContain('api:')
      expect(result).toContain('pages:')
    })

    it('should generate Gatsby specific template', async () => {
      const result = await generateFrameworkTemplate('gatsby', mockTemplateData)
      
      expect(result).toContain('# Gatsby Specific Settings')
      expect(result).toContain('gatsby:')
      expect(result).toContain('staticQuery: true')
      expect(result).toContain('pageQuery: true')
    })

    it('should generate Vite specific template', async () => {
      const result = await generateFrameworkTemplate('vite', mockTemplateData)
      
      expect(result).toContain('# Vite Specific Settings')
      expect(result).toContain('vite:')
      expect(result).toContain('hmr: true')
      expect(result).toContain('dev:')
    })

    it('should return base template for unknown framework', async () => {
      const result = await generateFrameworkTemplate('unknown', mockTemplateData)
      
      expect(result).not.toContain('nextjs:')
      expect(result).not.toContain('gatsby:')
      expect(result).not.toContain('vite:')
      expect(result).toContain('name: "Test Project"')
    })
  })

  describe('loadTemplateFile()', () => {
    it('should load existing template file', async () => {
      const { readFileSync, existsSync } = await import('fs')
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockReturnValue('template content')

      const result = await loadTemplateFile('/path/to/template.yml')
      
      expect(result).toBe('template content')
      expect(existsSync).toHaveBeenCalledWith('/path/to/template.yml')
      expect(readFileSync).toHaveBeenCalledWith('/path/to/template.yml', 'utf-8')
    })

    it('should return null for non-existent file', async () => {
      const { existsSync } = await import('fs')
      vi.mocked(existsSync).mockReturnValue(false)

      const result = await loadTemplateFile('/path/to/missing.yml')
      
      expect(result).toBeNull()
    })

    it('should handle file read errors gracefully', async () => {
      const { readFileSync, existsSync } = await import('fs')
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockImplementation(() => {
        throw new Error('Read error')
      })

      const result = await loadTemplateFile('/path/to/error.yml')
      
      expect(result).toBeNull()
    })
  })

  describe('validateTemplate()', () => {
    it('should validate complete template', () => {
      const template = `
project:
  name: "Test"
server:
  url: "ws://localhost"
debugging:
  timeTravel:
    enabled: true
      `
      
      const result = validateTemplate(template)
      
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should detect missing project section', () => {
      const template = `
server:
  url: "ws://localhost"
debugging:
  timeTravel:
    enabled: true
      `
      
      const result = validateTemplate(template)
      
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Missing project configuration section')
    })

    it('should detect missing server section', () => {
      const template = `
project:
  name: "Test"
debugging:
  timeTravel:
    enabled: true
      `
      
      const result = validateTemplate(template)
      
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Missing server configuration section')
    })

    it('should detect missing debugging section', () => {
      const template = `
project:
  name: "Test"
server:
  url: "ws://localhost"
      `
      
      const result = validateTemplate(template)
      
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Missing debugging configuration section')
    })

    it('should detect multiple missing sections', () => {
      const template = `
project:
  name: "Test"
      `
      
      const result = validateTemplate(template)
      
      expect(result.valid).toBe(false)
      expect(result.errors).toHaveLength(2)
      expect(result.errors).toContain('Missing server configuration section')
      expect(result.errors).toContain('Missing debugging configuration section')
    })
  })
})