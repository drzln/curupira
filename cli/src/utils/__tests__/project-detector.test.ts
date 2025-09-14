/**
 * @fileoverview Tests for project detection utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { 
  detectProject, 
  detectPackageManager, 
  checkForUpdates, 
  validateProject 
} from '../project-detector.js'

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

describe('project-detector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('detectProject()', () => {
    it('should detect React project correctly', async () => {
      const { readFileSync, existsSync } = await import('fs')
      vi.mocked(existsSync).mockImplementation((path: any) => {
        return path.includes('package.json')
      })
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        dependencies: {
          'react': '^18.0.0',
          'react-dom': '^18.0.0'
        },
        devDependencies: {
          'typescript': '^5.0.0'
        }
      }))

      const result = await detectProject('/test/project')
      
      expect(result.hasReact).toBe(true)
      expect(result.hasTypeScript).toBe(true)
      expect(result.framework).toBe('react')
      expect(result.dependencies).toEqual({ 'react': '^18.0.0', 'react-dom': '^18.0.0' })
      expect(result.devDependencies).toEqual({ 'typescript': '^5.0.0' })
    })

    it('should detect Next.js project correctly', async () => {
      const { readFileSync, existsSync } = await import('fs')
      vi.mocked(existsSync).mockImplementation((path: any) => {
        return path.includes('package.json')
      })
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        dependencies: {
          'next': '^14.0.0',
          'react': '^18.0.0'
        }
      }))

      const result = await detectProject('/test/nextjs-project')
      
      expect(result.hasNextJs).toBe(true)
      expect(result.hasReact).toBe(true)
      expect(result.framework).toBe('next')
    })

    it('should detect Vite + React project correctly', async () => {
      const { readFileSync, existsSync } = await import('fs')
      vi.mocked(existsSync).mockImplementation((path: any) => {
        return path.includes('package.json')
      })
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        dependencies: {
          'react': '^18.0.0'
        },
        devDependencies: {
          'vite': '^5.0.0'
        }
      }))

      const result = await detectProject('/test/vite-project')
      
      expect(result.hasVite).toBe(true)
      expect(result.hasReact).toBe(true)
      expect(result.framework).toBe('vite')
    })

    it('should detect Gatsby project correctly', async () => {
      const { readFileSync, existsSync } = await import('fs')
      vi.mocked(existsSync).mockImplementation((path: any) => {
        return path.includes('package.json')
      })
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        dependencies: {
          'gatsby': '^5.0.0',
          'react': '^18.0.0'
        }
      }))

      const result = await detectProject('/test/gatsby-project')
      
      expect(result.hasGatsby).toBe(true)
      expect(result.hasReact).toBe(true)
      expect(result.framework).toBe('gatsby')
    })

    it('should detect TypeScript from tsconfig.json when not in dependencies', async () => {
      const { readFileSync, existsSync } = await import('fs')
      vi.mocked(existsSync).mockImplementation((path: any) => {
        return path.includes('package.json') || path.includes('tsconfig.json')
      })
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        dependencies: {
          'react': '^18.0.0'
        }
      }))

      const result = await detectProject('/test/project')
      
      expect(result.hasTypeScript).toBe(true)
    })

    it('should return default detection when package.json is missing', async () => {
      const { existsSync } = await import('fs')
      vi.mocked(existsSync).mockReturnValue(false)

      const result = await detectProject('/test/no-package')
      
      expect(result.hasReact).toBe(false)
      expect(result.framework).toBe('unknown')
      expect(result.packageManager).toBe('unknown')
    })

    it('should handle malformed package.json gracefully', async () => {
      const { readFileSync, existsSync } = await import('fs')
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockReturnValue('invalid json')

      const result = await detectProject('/test/malformed')
      
      expect(result.framework).toBe('unknown')
    })
  })

  describe('detectPackageManager()', () => {
    it('should detect pnpm', async () => {
      const { existsSync } = await import('fs')
      vi.mocked(existsSync).mockImplementation((path: any) => {
        return path.includes('pnpm-lock.yaml')
      })

      const result = detectPackageManager('/test/project')
      expect(result).toBe('pnpm')
    })

    it('should detect yarn', async () => {
      const { existsSync } = await import('fs')
      vi.mocked(existsSync).mockImplementation((path: any) => {
        return path.includes('yarn.lock')
      })

      const result = detectPackageManager('/test/project')
      expect(result).toBe('yarn')
    })

    it('should detect npm', async () => {
      const { existsSync } = await import('fs')
      vi.mocked(existsSync).mockImplementation((path: any) => {
        return path.includes('package-lock.json')
      })

      const result = detectPackageManager('/test/project')
      expect(result).toBe('npm')
    })

    it('should return unknown when no lock files found', async () => {
      const { existsSync } = await import('fs')
      vi.mocked(existsSync).mockReturnValue(false)

      const result = detectPackageManager('/test/project')
      expect(result).toBe('unknown')
    })
  })

  describe('checkForUpdates()', () => {
    it('should return no updates available by default', async () => {
      const result = await checkForUpdates('curupira', '1.0.0')
      
      expect(result.available).toBe(false)
      expect(result.current).toBe('1.0.0')
      expect(result.latest).toBe('1.0.0')
      expect(result.type).toBe('patch')
    })
  })

  describe('validateProject()', () => {
    it('should validate React project as compatible', () => {
      const detection = {
        hasReact: true,
        hasNextJs: false,
        hasVite: false,
        hasGatsby: false,
        hasTypeScript: true,
        framework: 'react' as const,
        packageManager: 'npm' as const,
        dependencies: { 'react': '^18.0.0' },
        devDependencies: {}
      }

      const result = validateProject(detection)
      expect(result.valid).toBe(true)
      expect(result.reason).toBeUndefined()
    })

    it('should validate Next.js project as compatible', () => {
      const detection = {
        hasReact: true,
        hasNextJs: true,
        hasVite: false,
        hasGatsby: false,
        hasTypeScript: true,
        framework: 'next' as const,
        packageManager: 'npm' as const,
        dependencies: { 'next': '^14.0.0', 'react': '^18.0.0' },
        devDependencies: {}
      }

      const result = validateProject(detection)
      expect(result.valid).toBe(true)
    })

    it('should validate Vite project as compatible', () => {
      const detection = {
        hasReact: true,
        hasNextJs: false,
        hasVite: true,
        hasGatsby: false,
        hasTypeScript: false,
        framework: 'vite' as const,
        packageManager: 'npm' as const,
        dependencies: { 'react': '^18.0.0' },
        devDependencies: { 'vite': '^5.0.0' }
      }

      const result = validateProject(detection)
      expect(result.valid).toBe(true)
    })

    it('should reject non-React projects', () => {
      const detection = {
        hasReact: false,
        hasNextJs: false,
        hasVite: false,
        hasGatsby: false,
        hasTypeScript: true,
        framework: 'unknown' as const,
        packageManager: 'npm' as const,
        dependencies: { 'vue': '^3.0.0' },
        devDependencies: {}
      }

      const result = validateProject(detection)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('No React-based framework detected')
    })

    it('should handle plain Vite without React', () => {
      const detection = {
        hasReact: false,
        hasNextJs: false,
        hasVite: true,
        hasGatsby: false,
        hasTypeScript: false,
        framework: 'unknown' as const,
        packageManager: 'npm' as const,
        dependencies: {},
        devDependencies: { 'vite': '^5.0.0' }
      }

      const result = validateProject(detection)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('React-based framework')
    })
  })
})