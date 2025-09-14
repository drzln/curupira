/**
 * @fileoverview Enhanced Curupira CLI with advanced command parsing
 */

import chalk from 'chalk'
import updateNotifier from 'update-notifier'
import { readFileSync, existsSync } from 'fs'
import { join, resolve } from 'path'
import { createLogger } from '@curupira/shared'
import { ProjectConfigLoader } from '@curupira/shared'

import { CommandRegistry } from './parser/command-registry.js'
import { HelpSystem } from './parser/help-system.js'

import type { 
  CliConfig, 
  CliContext, 
  CommandResult,
  ParsedCommand,
  ValidationResult
} from './types.js'

const logger = createLogger({ level: 'info', name: 'curupira-cli-enhanced' })

/**
 * Enhanced Curupira CLI with advanced command parsing
 */
export class CurupiraEnhancedCLI {
  private cliConfig: CliConfig
  private packageJson: any
  private registry: CommandRegistry
  private helpSystem: HelpSystem

  constructor() {
    this.cliConfig = this.getDefaultConfig()
    this.packageJson = this.loadPackageJson()
    this.registry = new CommandRegistry()
    this.helpSystem = new HelpSystem()
  }

  /**
   * Run the CLI with provided arguments
   */
  async run(argv: string[]): Promise<CommandResult> {
    try {
      // Check for updates (non-blocking)
      this.checkUpdates()

      // Parse command
      const parsed = this.registry.getParser().parseCommand(argv)
      
      // Handle global options first
      const globalResult = this.handleGlobalOptions(parsed)
      if (globalResult) {
        return globalResult
      }

      // Update CLI config from parsed options
      this.updateConfigFromParsed(parsed)

      // Validate command
      const validation = this.registry.getParser().validateCommand(parsed)
      if (!validation.valid) {
        return await this.handleValidationErrors(validation, parsed.command)
      }

      // Handle help command
      if (parsed.command === 'help') {
        return await this.handleHelpCommand(parsed)
      }

      // Execute command
      return await this.executeCommand(parsed)

    } catch (error) {
      return this.handleError(error)
    }
  }

  /**
   * Get CLI configuration
   */
  getConfig(): CliConfig {
    return this.cliConfig
  }

  /**
   * Get command registry
   */
  getRegistry(): CommandRegistry {
    return this.registry
  }

  /**
   * Get help system
   */
  getHelpSystem(): HelpSystem {
    return this.helpSystem
  }

  /**
   * Handle global options like --help, --version, --verbose
   */
  private handleGlobalOptions(parsed: ParsedCommand): CommandResult | null {
    // Handle version
    if (parsed.flags.version || parsed.flags.V) {
      console.log(`curupira v${this.packageJson.version}`)
      return {
        success: true,
        message: 'Version displayed',
        exitCode: 0
      }
    }

    // Handle global help
    if (parsed.flags.help || parsed.flags.h) {
      if (parsed.command && parsed.command !== 'help') {
        // Show specific command help
        const commandDef = this.registry.getCommand(parsed.command)
        if (commandDef) {
          const help = this.helpSystem.generateCommandHelp(commandDef)
          const output = this.helpSystem.formatHelp(help)
          console.log(output)
        } else {
          console.log(this.helpSystem.formatError(`Unknown command: ${parsed.command}`))
        }
      } else {
        // Show general help
        const help = this.registry.getParser().generateHelp()
        const output = this.helpSystem.formatHelp(help)
        console.log(output)
      }
      
      return {
        success: true,
        message: 'Help displayed',
        exitCode: 0
      }
    }

    return null
  }

  /**
   * Update CLI config from parsed command options
   */
  private updateConfigFromParsed(parsed: ParsedCommand): void {
    if (parsed.flags.verbose || parsed.flags.v) {
      this.cliConfig.verbose = true
    }

    if (parsed.flags.silent || parsed.flags.s) {
      this.cliConfig.silent = true
    }

    if (parsed.options['log-level']) {
      this.cliConfig.logLevel = parsed.options['log-level'] as CliConfig['logLevel']
    }

    if (parsed.options.config) {
      this.cliConfig.configPath = String(parsed.options.config)
    }
  }

  /**
   * Handle validation errors
   */
  private async handleValidationErrors(validation: ValidationResult, commandName: string): Promise<CommandResult> {
    if (!this.cliConfig.silent) {
      const errorOutput = this.helpSystem.formatValidationErrors(validation.errors, commandName)
      console.error(errorOutput)
    }

    return {
      success: false,
      message: `Command validation failed: ${validation.errors.join(', ')}`,
      error: new Error(validation.errors.join(', ')),
      exitCode: 1
    }
  }

  /**
   * Handle help command
   */
  private async handleHelpCommand(parsed: ParsedCommand): Promise<CommandResult> {
    const targetCommand = parsed.args[0]
    
    if (targetCommand) {
      const commandDef = this.registry.getCommand(targetCommand)
      if (commandDef) {
        const help = this.helpSystem.generateCommandHelp(commandDef)
        return await this.helpSystem.displayHelp(help)
      } else {
        const suggestions = this.helpSystem.formatSuggestions(
          targetCommand, 
          this.registry.getAllCommands().map(cmd => cmd.name)
        )
        console.error(suggestions)
        return {
          success: false,
          message: `Unknown command: ${targetCommand}`,
          exitCode: 1
        }
      }
    } else {
      const help = this.registry.getParser().generateHelp()
      return await this.helpSystem.displayHelp(help)
    }
  }

  /**
   * Execute a parsed command
   */
  private async executeCommand(parsed: ParsedCommand): Promise<CommandResult> {
    const commandDef = this.registry.getCommand(parsed.command)
    
    if (!commandDef) {
      if (!this.cliConfig.silent) {
        const suggestions = this.helpSystem.formatSuggestions(
          parsed.command,
          this.registry.getAllCommands().map(cmd => cmd.name)
        )
        console.error(suggestions)
      }
      
      return {
        success: false,
        message: `Unknown command: ${parsed.command}`,
        error: new Error(`Unknown command: ${parsed.command}`),
        exitCode: 1
      }
    }

    // Create execution context
    const context = await this.createContext()

    // Convert parsed options to command-specific options
    const commandOptions = this.convertParsedOptions(parsed, commandDef)

    // Execute command
    logger.debug({ command: parsed.command, options: commandOptions }, 'Executing command')
    
    try {
      const result = await commandDef.handler.execute(context, commandOptions)
      
      if (this.cliConfig.verbose && result.success) {
        console.log(chalk.green(`✓ Command '${parsed.command}' completed successfully`))
      }
      
      return result
    } catch (error) {
      logger.error({ error, command: parsed.command }, 'Command execution failed')
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error),
        error: error instanceof Error ? error : new Error(String(error)),
        exitCode: 1
      }
    }
  }

  /**
   * Convert parsed options to command-specific options format
   */
  private convertParsedOptions(parsed: ParsedCommand, commandDef: any): any {
    const options: any = {}

    // Copy flags
    for (const [key, value] of Object.entries(parsed.flags)) {
      options[key] = value
    }

    // Copy options with type conversion
    for (const [key, value] of Object.entries(parsed.options)) {
      options[key] = value
    }

    // Add positional arguments if the command expects them
    if (parsed.args.length > 0) {
      options._args = parsed.args
    }

    return options
  }

  /**
   * Create CLI context for command execution
   */
  private async createContext(): Promise<CliContext> {
    const cwd = process.cwd()
    const projectRoot = this.cliConfig.configPath ? 
      resolve(cwd, this.cliConfig.configPath, '..') : cwd

    // Load project configuration
    let projectConfig
    try {
      projectConfig = await ProjectConfigLoader.loadConfig(projectRoot)
    } catch (error) {
      if (this.cliConfig.verbose) {
        logger.warn({ error }, 'Failed to load project config')
      }
    }

    return {
      config: this.cliConfig,
      projectConfig,
      cwd,
      packageJson: this.packageJson
    }
  }

  /**
   * Handle errors
   */
  private handleError(error: unknown): CommandResult {
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    if (!this.cliConfig.silent) {
      console.error(chalk.red('✗ Error:'), errorMessage)
      
      if (this.cliConfig.verbose && error instanceof Error && error.stack) {
        console.error(chalk.gray(error.stack))
      }
    }

    logger.error({ error }, 'CLI execution failed')

    return {
      success: false,
      message: errorMessage,
      error: error instanceof Error ? error : new Error(String(error)),
      exitCode: 1
    }
  }

  /**
   * Get default CLI configuration
   */
  private getDefaultConfig(): CliConfig {
    return {
      version: this.packageJson?.version || '1.0.0',
      verbose: false,
      silent: false,
      logLevel: 'info',
      projectRoot: process.cwd()
    }
  }

  /**
   * Load package.json
   */
  private loadPackageJson(): any {
    try {
      const packagePath = join(import.meta.dirname, '..', 'package.json')
      if (existsSync(packagePath)) {
        return JSON.parse(readFileSync(packagePath, 'utf-8'))
      }
    } catch (error) {
      logger.debug({ error }, 'Failed to load package.json')
    }
    
    return { name: 'curupira', version: '1.0.0' }
  }

  /**
   * Check for updates (non-blocking)
   */
  private checkUpdates(): void {
    if (this.cliConfig.silent) return

    try {
      const notifier = updateNotifier({
        pkg: this.packageJson,
        updateCheckInterval: 1000 * 60 * 60 * 24 // 24 hours
      })

      if (notifier.update) {
        console.log(chalk.yellow('\n💡 Update available:'))
        console.log(chalk.gray(`   Current: ${notifier.update.current}`))
        console.log(chalk.green(`   Latest:  ${notifier.update.latest}`))
        console.log(chalk.cyan(`   Run: npm install -g curupira@latest\n`))
      }
    } catch (error) {
      // Silently ignore update check errors
      logger.debug({ error }, 'Update check failed')
    }
  }

  /**
   * Validate CLI setup
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    // Validate registry
    const registryValidation = this.registry.validateRegistry()
    if (!registryValidation.valid) {
      errors.push(...registryValidation.errors)
    }

    // Validate package.json
    if (!this.packageJson.name || !this.packageJson.version) {
      errors.push('Invalid package.json: missing name or version')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Get CLI statistics
   */
  getStats() {
    const registryStats = this.registry.getStats()
    const validation = this.validate()
    
    return {
      ...registryStats,
      version: this.packageJson.version,
      valid: validation.valid,
      errors: validation.errors
    }
  }
}