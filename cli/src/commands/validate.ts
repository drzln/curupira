/**
 * @fileoverview 'curupira validate' command implementation
 */

import chalk from 'chalk'
import { createLogger, ProjectConfigLoader } from '@curupira/shared'
import type { BaseCommand, CliContext, CommandResult } from '../types.js'

const logger = createLogger({ level: 'info', name: 'validate-command' })

/**
 * Validate command options
 */
export interface ValidateCommandOptions {
  fix?: boolean
}

/**
 * Validate curupira.yml configuration
 */
export class ValidateCommand implements BaseCommand {
  name = 'validate'
  description = 'Validate curupira.yml configuration'

  async execute(context: CliContext, options: ValidateCommandOptions = {}): Promise<CommandResult> {
    try {
      if (!context.config.silent) {
        console.log(chalk.blue('🔍 Validating configuration...'))
      }

      // Try to load project configuration
      if (!context.projectConfig) {
        return {
          success: false,
          message: 'No curupira.yml configuration found. Run "curupira init" first.',
          exitCode: 1
        }
      }

      // Validate configuration structure
      try {
        const validatedConfig = ProjectConfigLoader.validateConfig(context.projectConfig)
        
        if (!context.config.silent) {
          console.log(chalk.green('✓ Configuration is valid'))
          this.showConfigSummary(validatedConfig)
        }

        return {
          success: true,
          message: 'Configuration validated successfully',
          data: { config: validatedConfig },
          exitCode: 0
        }

      } catch (validationError) {
        if (!context.config.silent) {
          console.log(chalk.red('✗ Configuration validation failed:'))
          console.log(chalk.gray(`  ${validationError}`))

          if (options.fix) {
            console.log(chalk.yellow('⚠ Auto-fix not yet implemented'))
            console.log(chalk.gray('  Please fix the issues manually'))
          }
        }

        return {
          success: false,
          message: `Configuration validation failed: ${validationError}`,
          error: validationError instanceof Error ? validationError : new Error(String(validationError)),
          exitCode: 1
        }
      }

    } catch (error) {
      logger.error({ error }, 'Validate command failed')
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        error: error instanceof Error ? error : new Error(String(error)),
        exitCode: 1
      }
    }
  }

  /**
   * Show configuration summary
   */
  private showConfigSummary(config: any): void {
    console.log()
    console.log(chalk.cyan('Configuration Summary:'))
    console.log(chalk.gray(`  Project: ${config.project.name}`))
    console.log(chalk.gray(`  Framework: ${config.project.framework}`))
    console.log(chalk.gray(`  TypeScript: ${config.project.typescript ? 'Yes' : 'No'}`))
    
    // State management
    const stateLibs = []
    if (config.stateManagement.react.enabled) stateLibs.push('React')
    if (config.stateManagement.zustand.enabled) stateLibs.push('Zustand')
    if (config.stateManagement.xstate.enabled) stateLibs.push('XState')
    if (config.stateManagement.apollo.enabled) stateLibs.push('Apollo')
    
    if (stateLibs.length > 0) {
      console.log(chalk.gray(`  State Management: ${stateLibs.join(', ')}`))
    }

    // Features
    const features = []
    if (config.debugging.timeTravel.enabled) features.push('Time Travel')
    if (config.performance.enabled) features.push('Performance Monitoring')
    if (config.security.sanitization.enabled) features.push('Data Sanitization')
    
    if (features.length > 0) {
      console.log(chalk.gray(`  Features: ${features.join(', ')}`))
    }

    // Custom components
    const componentCount = Object.keys(config.custom.components).length
    if (componentCount > 0) {
      console.log(chalk.gray(`  Monitored Components: ${componentCount}`))
    }

    // Custom pages
    const pageCount = Object.keys(config.custom.pages).length
    if (pageCount > 0) {
      console.log(chalk.gray(`  Monitored Pages: ${pageCount}`))
    }

    console.log()
  }
}