/**
 * @fileoverview Help system for generating formatted help output
 */

import chalk from 'chalk'
import { createLogger } from '@curupira/shared'
import type { 
  HelpInfo,
  CommandDefinition,
  CommandResult
} from '../types.js'

const logger = createLogger({ level: 'info', name: 'help-system' })

/**
 * Advanced help system with formatted output
 */
export class HelpSystem {
  private maxWidth = 80
  private indentSize = 2

  /**
   * Format and display help information
   */
  formatHelp(help: HelpInfo, compact = false): string {
    if (help.command === 'curupira') {
      return this.formatOverallHelp(help, compact)
    }
    
    return this.formatCommandHelp(help, compact)
  }

  /**
   * Generate help for a specific command from definition
   */
  generateCommandHelp(definition: CommandDefinition): HelpInfo {
    const usage = this.generateUsage(definition)
    const options = this.generateOptionsList(definition)
    
    return {
      command: definition.name,
      description: definition.description,
      usage,
      options,
      examples: definition.examples || []
    }
  }

  /**
   * Display help and return success result
   */
  async displayHelp(help: HelpInfo, compact = false): Promise<CommandResult> {
    const output = this.formatHelp(help, compact)
    console.log(output)
    
    return {
      success: true,
      message: 'Help displayed successfully',
      exitCode: 0
    }
  }

  /**
   * Format overall help for all commands
   */
  private formatOverallHelp(help: HelpInfo, compact: boolean): string {
    const lines: string[] = []
    
    // Header
    lines.push(chalk.bold.cyan('Curupira CLI'))
    lines.push(chalk.gray('AI-assisted React debugging tool'))
    lines.push('')
    
    // Usage
    lines.push(chalk.bold('USAGE'))
    lines.push(`  ${chalk.green(help.usage)}`)
    lines.push('')
    
    // Available commands
    lines.push(chalk.bold('COMMANDS'))
    
    const commands = help.options.filter(opt => opt.type === 'command')
    const maxCommandLength = Math.max(...commands.map(cmd => cmd.name.length))
    
    for (const command of commands) {
      const padding = ' '.repeat(Math.max(0, maxCommandLength - command.name.length + 2))
      lines.push(`  ${chalk.cyan(command.name)}${padding}${chalk.gray(command.description)}`)
    }
    
    if (!compact) {
      lines.push('')
      
      // Global options
      lines.push(chalk.bold('GLOBAL OPTIONS'))
      lines.push(`  ${chalk.green('--verbose, -v')}     Enable verbose output`)
      lines.push(`  ${chalk.green('--silent, -s')}      Suppress output`)
      lines.push(`  ${chalk.green('--help, -h')}        Show help`)
      lines.push(`  ${chalk.green('--version, -V')}     Show version`)
      lines.push('')
      
      // Examples
      if (help.examples.length > 0) {
        lines.push(chalk.bold('EXAMPLES'))
        for (const example of help.examples) {
          lines.push(`  ${chalk.gray('$')} ${chalk.cyan(example)}`)
        }
        lines.push('')
      }
    }
    
    // Footer
    lines.push(chalk.gray('For more information on a specific command, run:'))
    lines.push(chalk.gray('  curupira <command> --help'))
    
    return lines.join('\n')
  }

  /**
   * Format help for a specific command
   */
  private formatCommandHelp(help: HelpInfo, compact: boolean): string {
    const lines: string[] = []
    
    // Header
    lines.push(chalk.bold.cyan(`curupira ${help.command}`))
    lines.push(chalk.gray(help.description))
    lines.push('')
    
    // Usage
    lines.push(chalk.bold('USAGE'))
    lines.push(`  ${chalk.green(help.usage)}`)
    lines.push('')
    
    if (help.options.length > 0) {
      // Group options by type
      const flags = help.options.filter(opt => opt.type === 'flag')
      const options = help.options.filter(opt => opt.type !== 'flag' && opt.type !== 'command')
      
      if (options.length > 0) {
        lines.push(chalk.bold('OPTIONS'))
        const maxOptionLength = Math.max(...options.map(opt => opt.name.length))
        
        for (const option of options) {
          const padding = ' '.repeat(Math.max(0, maxOptionLength - option.name.length + 2))
          lines.push(`  ${chalk.green(option.name)}${padding}${chalk.gray(option.description)}`)
        }
        lines.push('')
      }
      
      if (flags.length > 0) {
        lines.push(chalk.bold('FLAGS'))
        const maxFlagLength = Math.max(...flags.map(flag => flag.name.length))
        
        for (const flag of flags) {
          const padding = ' '.repeat(Math.max(0, maxFlagLength - flag.name.length + 2))
          lines.push(`  ${chalk.green(flag.name)}${padding}${chalk.gray(flag.description)}`)
        }
        lines.push('')
      }
    }
    
    if (!compact && help.examples.length > 0) {
      lines.push(chalk.bold('EXAMPLES'))
      for (const example of help.examples) {
        lines.push(`  ${chalk.gray('$')} ${chalk.cyan(example)}`)
      }
      lines.push('')
    }
    
    return lines.join('\n')
  }

  /**
   * Generate usage string for a command
   */
  private generateUsage(definition: CommandDefinition): string {
    let usage = `curupira ${definition.name}`

    // Add aliases in usage
    if (definition.aliases && definition.aliases.length > 0) {
      usage += ` (${definition.aliases.join('|')})`
    }

    if (definition.args) {
      for (const arg of definition.args) {
        if (arg.required) {
          usage += ` <${arg.name}>`
        } else {
          usage += ` [${arg.name}]`
        }
      }
    }

    if (definition.options || definition.flags) {
      usage += ' [options]'
    }

    return usage
  }

  /**
   * Generate options list for help display
   */
  private generateOptionsList(definition: CommandDefinition): Array<{
    name: string
    description: string
    type: string
  }> {
    const options = []

    if (definition.flags) {
      for (const flag of definition.flags) {
        let name = `--${flag.name}`
        if (flag.short) {
          name += `, -${flag.short}`
        }

        options.push({
          name,
          description: flag.description,
          type: 'flag'
        })
      }
    }

    if (definition.options) {
      for (const option of definition.options) {
        let name = `--${option.name}`
        if (option.short) {
          name += `, -${option.short}`
        }
        
        if (option.type !== 'boolean') {
          name += ` <${option.type}>`
        }

        let description = option.description
        if (option.default !== undefined) {
          description += ` (default: ${option.default})`
        }
        if (option.choices && option.choices.length > 0) {
          description += ` [${option.choices.join('|')}]`
        }

        options.push({
          name,
          description,
          type: option.type
        })
      }
    }

    return options
  }

  /**
   * Create error help message
   */
  formatError(error: string, commandName?: string): string {
    const lines: string[] = []
    
    lines.push(chalk.red(`Error: ${error}`))
    lines.push('')
    
    if (commandName) {
      lines.push(chalk.gray(`For help with '${commandName}', run:`))
      lines.push(chalk.gray(`  curupira ${commandName} --help`))
    } else {
      lines.push(chalk.gray('For general help, run:'))
      lines.push(chalk.gray('  curupira --help'))
    }
    
    return lines.join('\n')
  }

  /**
   * Format validation errors
   */
  formatValidationErrors(errors: string[], commandName: string): string {
    const lines: string[] = []
    
    lines.push(chalk.red(`Command '${commandName}' validation failed:`))
    lines.push('')
    
    for (const error of errors) {
      lines.push(chalk.red(`  • ${error}`))
    }
    
    lines.push('')
    lines.push(chalk.gray(`For help with '${commandName}', run:`))
    lines.push(chalk.gray(`  curupira ${commandName} --help`))
    
    return lines.join('\n')
  }

  /**
   * Format command suggestions for unknown commands
   */
  formatSuggestions(unknownCommand: string, availableCommands: string[]): string {
    const lines: string[] = []
    
    lines.push(chalk.red(`Unknown command: '${unknownCommand}'`))
    lines.push('')
    
    // Find similar commands using simple string similarity
    const suggestions = this.findSimilarCommands(unknownCommand, availableCommands)
    
    if (suggestions.length > 0) {
      lines.push(chalk.yellow('Did you mean:'))
      for (const suggestion of suggestions) {
        lines.push(`  ${chalk.cyan(suggestion)}`)
      }
      lines.push('')
    }
    
    lines.push(chalk.gray('Run \'curupira --help\' to see available commands'))
    
    return lines.join('\n')
  }

  /**
   * Find similar commands using simple string similarity
   */
  private findSimilarCommands(input: string, commands: string[]): string[] {
    const suggestions = commands
      .map(cmd => ({
        command: cmd,
        similarity: this.calculateSimilarity(input, cmd)
      }))
      .filter(item => item.similarity > 0.4)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3)
      .map(item => item.command)
    
    return suggestions
  }

  /**
   * Calculate string similarity (simple Levenshtein-based)
   */
  private calculateSimilarity(a: string, b: string): number {
    if (a.length === 0) return b.length === 0 ? 1 : 0
    if (b.length === 0) return 0
    
    const matrix: number[][] = []
    
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i]
    }
    
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j
    }
    
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          )
        }
      }
    }
    
    const maxLength = Math.max(a.length, b.length)
    return 1 - matrix[b.length][a.length] / maxLength
  }
}