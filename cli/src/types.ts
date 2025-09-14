/**
 * @fileoverview CLI types and interfaces
 */

import type { ProjectConfig } from '@curupira/shared'

/**
 * CLI configuration
 */
export interface CliConfig {
  version: string
  verbose: boolean
  silent: boolean
  logLevel: 'error' | 'warn' | 'info' | 'debug'
  projectRoot: string
  configPath?: string
}

/**
 * Command execution result
 */
export interface CommandResult {
  success: boolean
  message: string
  data?: any
  error?: Error
  exitCode: number
}

/**
 * CLI context passed to all commands
 */
export interface CliContext {
  config: CliConfig
  projectConfig?: ProjectConfig
  cwd: string
  packageJson?: any
}

/**
 * Base command interface
 */
export interface BaseCommand {
  name: string
  description: string
  execute(context: CliContext, ...args: any[]): Promise<CommandResult>
}

/**
 * Server process info
 */
export interface ServerProcess {
  pid: number
  port: number
  url: string
  status: 'starting' | 'running' | 'stopping' | 'stopped' | 'error'
  startTime: number
  config?: ProjectConfig
}

/**
 * CLI spinner configuration
 */
export interface SpinnerConfig {
  text: string
  spinner?: string
  color?: 'black' | 'red' | 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan' | 'white'
}

/**
 * Update check result
 */
export interface UpdateInfo {
  hasUpdate: boolean
  currentVersion: string
  latestVersion: string
  updateCommand: string
}

/**
 * Project detection result
 */
export interface ProjectDetection {
  hasPackageJson: boolean
  hasReact: boolean
  hasNextJs: boolean
  hasVite: boolean
  hasGatsby: boolean
  framework: 'react' | 'next' | 'vite' | 'gatsby' | 'unknown'
  hasTypeScript: boolean
  hasCurupiraConfig: boolean
}

/**
 * File template data
 */
export interface TemplateData {
  projectName: string
  framework: string
  typescript: boolean
  hasStateManagement: {
    zustand: boolean
    xstate: boolean
    apollo: boolean
  }
  customComponents: string[]
  customPages: Array<{
    name: string
    url: string
    critical: boolean
  }>
}

/**
 * Parsed command structure
 */
export interface ParsedCommand {
  command: string
  args: string[]
  flags: Record<string, boolean>
  options: Record<string, string | boolean | number>
  raw: string[]
}

/**
 * Command argument definition
 */
export interface CommandArgument {
  name: string
  description: string
  required: boolean
  type?: 'string' | 'number' | 'boolean'
}

/**
 * Command option definition
 */
export interface CommandOption {
  name: string
  short?: string
  description: string
  type: 'string' | 'number' | 'boolean'
  required?: boolean
  default?: string | number | boolean
  choices?: string[]
}

/**
 * Command flag definition
 */
export interface CommandFlag {
  name: string
  short?: string
  description: string
}

/**
 * Complete command definition
 */
export interface CommandDefinition {
  name: string
  description: string
  aliases?: string[]
  args?: CommandArgument[]
  options?: CommandOption[]
  flags?: CommandFlag[]
  examples?: string[]
  handler: BaseCommand
}

/**
 * Command validation result
 */
export interface ValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Help information structure
 */
export interface HelpInfo {
  command: string
  description: string
  usage: string
  options: Array<{
    name: string
    description: string
    type: string
  }>
  examples: string[]
}