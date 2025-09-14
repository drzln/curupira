/**
 * @fileoverview Project detection utilities for Curupira CLI
 */

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { createLogger } from '@curupira/shared'

const logger = createLogger({ level: 'info', name: 'project-detector' })

/**
 * Project detection result
 */
export interface ProjectDetection {
  hasReact: boolean
  hasNextJs: boolean
  hasVite: boolean
  hasGatsby: boolean
  hasTypeScript: boolean
  framework: 'react' | 'next' | 'vite' | 'gatsby' | 'unknown'
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'unknown'
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
}

/**
 * Update information from package managers
 */
export interface UpdateInfo {
  available: boolean
  current: string
  latest: string
  type: 'major' | 'minor' | 'patch'
}

/**
 * Detect project configuration and setup
 */
export async function detectProject(projectPath: string): Promise<ProjectDetection> {
  logger.debug({ projectPath }, 'Detecting project configuration')

  const packageJsonPath = join(projectPath, 'package.json')
  
  if (!existsSync(packageJsonPath)) {
    return getDefaultDetection()
  }

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
    const dependencies = packageJson.dependencies || {}
    const devDependencies = packageJson.devDependencies || {}
    const allDeps = { ...dependencies, ...devDependencies }

    // Detect React-based projects
    const hasReact = 'react' in allDeps
    const hasNextJs = 'next' in allDeps
    const hasVite = 'vite' in allDeps
    const hasGatsby = 'gatsby' in allDeps
    const hasTypeScript = 'typescript' in allDeps || existsSync(join(projectPath, 'tsconfig.json'))

    // Determine primary framework
    let framework: ProjectDetection['framework'] = 'unknown'
    if (hasNextJs) framework = 'next'
    else if (hasVite && hasReact) framework = 'vite'  
    else if (hasGatsby) framework = 'gatsby'
    else if (hasReact) framework = 'react'

    // Detect package manager
    const packageManager = detectPackageManager(projectPath)

    const detection: ProjectDetection = {
      hasReact,
      hasNextJs,
      hasVite,
      hasGatsby,
      hasTypeScript,
      framework,
      packageManager,
      dependencies,
      devDependencies
    }

    logger.debug({ detection }, 'Project detection completed')
    return detection

  } catch (error) {
    logger.warn({ error, projectPath }, 'Failed to detect project configuration')
    return getDefaultDetection()
  }
}

/**
 * Detect which package manager is being used
 */
export function detectPackageManager(projectPath: string): ProjectDetection['packageManager'] {
  if (existsSync(join(projectPath, 'pnpm-lock.yaml'))) {
    return 'pnpm'
  }
  
  if (existsSync(join(projectPath, 'yarn.lock'))) {
    return 'yarn'
  }
  
  if (existsSync(join(projectPath, 'package-lock.json'))) {
    return 'npm'
  }

  return 'unknown'
}

/**
 * Check for available updates (placeholder - would integrate with registry)
 */
export async function checkForUpdates(packageName: string, currentVersion: string): Promise<UpdateInfo> {
  // Placeholder implementation - in real world would check npm registry
  return {
    available: false,
    current: currentVersion,
    latest: currentVersion,
    type: 'patch'
  }
}

/**
 * Get default detection result when no package.json is found
 */
function getDefaultDetection(): ProjectDetection {
  return {
    hasReact: false,
    hasNextJs: false,
    hasVite: false,
    hasGatsby: false,
    hasTypeScript: false,
    framework: 'unknown',
    packageManager: 'unknown',
    dependencies: {},
    devDependencies: {}
  }
}

/**
 * Validate that the detected project is compatible with Curupira
 */
export function validateProject(detection: ProjectDetection): { valid: boolean; reason?: string } {
  // Check for React-based projects
  const hasReactFramework = detection.hasReact || detection.hasNextJs || detection.hasGatsby
  const hasViteWithReact = detection.hasVite && detection.hasReact

  if (!hasReactFramework && !hasViteWithReact) {
    return {
      valid: false,
      reason: 'No React-based framework detected. Curupira requires React, Next.js, Vite+React, or Gatsby.'
    }
  }

  return { valid: true }
}