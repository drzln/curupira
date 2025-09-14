/**
 * @fileoverview Advanced command parser for Curupira CLI
 */

import { createLogger } from '@curupira/shared'
import type { 
  CliContext, 
  CommandResult, 
  BaseCommand,
  ParsedCommand,
  CommandDefinition,
  ValidationResult,
  HelpInfo
} from '../types.js'

const logger = createLogger({ level: 'info', name: 'command-parser' })

/**
 * Enhanced command parser with validation and help generation
 */
export class CommandParser {
  private commands: Map<string, CommandDefinition> = new Map()
  private aliases: Map<string, string> = new Map()

  /**
   * Register a command with the parser
   */
  registerCommand(definition: CommandDefinition): void {
    logger.debug({ command: definition.name }, 'Registering command')
    
    this.commands.set(definition.name, definition)
    
    // Register aliases
    if (definition.aliases) {
      for (const alias of definition.aliases) {
        this.aliases.set(alias, definition.name)
      }
    }
  }

  /**
   * Parse command line arguments into structured command
   */
  parseCommand(args: string[]): ParsedCommand {
    if (args.length < 3) {
      return {
        command: 'help',
        args: [],
        flags: {},
        options: {},
        raw: args
      }
    }

    const [, , commandName, ...rest] = args
    const resolvedCommand = this.resolveCommand(commandName)

    const parsed = this.parseArguments(rest)
    
    return {
      command: resolvedCommand,
      args: parsed.args,
      flags: parsed.flags,  
      options: parsed.options,
      raw: args
    }
  }

  /**
   * Validate parsed command against command definition
   */
  validateCommand(parsed: ParsedCommand): ValidationResult {
    const definition = this.commands.get(parsed.command)
    
    if (!definition) {
      return {
        valid: false,
        errors: [`Unknown command: ${parsed.command}`]
      }
    }

    const errors: string[] = []

    // Validate required arguments
    if (definition.args) {
      const requiredArgs = definition.args.filter(arg => arg.required)
      if (parsed.args.length < requiredArgs.length) {
        errors.push(`Missing required arguments: ${requiredArgs.slice(parsed.args.length).map(a => a.name).join(', ')}`)
      }
    }

    // Validate options
    if (definition.options) {
      for (const [optionName, value] of Object.entries(parsed.options)) {
        const optionDef = definition.options.find(opt => opt.name === optionName)
        
        if (!optionDef) {
          errors.push(`Unknown option: --${optionName}`)
          continue
        }

        // Type validation
        if (optionDef.type === 'number' && isNaN(Number(value))) {
          errors.push(`Option --${optionName} must be a number`)
        }

        if (optionDef.type === 'boolean' && typeof value !== 'boolean') {
          errors.push(`Option --${optionName} must be true or false`)
        }

        // Choices validation
        if (optionDef.choices && !optionDef.choices.includes(String(value))) {
          errors.push(`Option --${optionName} must be one of: ${optionDef.choices.join(', ')}`)
        }
      }
    }

    // Validate flags
    if (definition.flags) {
      for (const flagName of Object.keys(parsed.flags)) {
        const flagDef = definition.flags.find(flag => flag.name === flagName)
        
        if (!flagDef) {
          errors.push(`Unknown flag: --${flagName}`)
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Generate help information for a command
   */
  generateHelp(commandName?: string): HelpInfo {
    if (commandName) {
      const command = this.commands.get(commandName)
      if (!command) {
        return {
          command: commandName,
          description: `Unknown command: ${commandName}`,
          usage: '',
          options: [],
          examples: []
        }
      }

      return this.generateCommandHelp(command)
    }

    return this.generateOverallHelp()
  }

  /**
   * Get all registered commands
   */
  getCommands(): CommandDefinition[] {
    return Array.from(this.commands.values())
  }

  /**
   * Check if a command exists
   */
  hasCommand(name: string): boolean {
    return this.commands.has(name) || this.aliases.has(name)
  }

  /**
   * Resolve command name or alias to actual command name
   */
  private resolveCommand(name: string): string {
    if (this.commands.has(name)) {
      return name
    }

    if (this.aliases.has(name)) {
      return this.aliases.get(name)!
    }

    return name // Return as-is for validation to catch unknown commands
  }

  /**
   * Parse arguments into args, flags, and options
   */
  private parseArguments(args: string[]): {
    args: string[]
    flags: Record<string, boolean>
    options: Record<string, string | boolean | number>
  } {
    const result = {
      args: [] as string[],
      flags: {} as Record<string, boolean>,
      options: {} as Record<string, string | boolean | number>
    }

    for (let i = 0; i < args.length; i++) {
      const arg = args[i]

      if (arg.startsWith('--')) {
        // Long option
        const [optionName, value] = arg.slice(2).split('=', 2)
        
        if (value !== undefined) {
          // --option=value
          result.options[optionName] = this.parseValue(value)
        } else if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
          // --option value
          result.options[optionName] = this.parseValue(args[i + 1])
          i++ // Skip next argument
        } else {
          // --flag
          result.flags[optionName] = true
        }
      } else if (arg.startsWith('-') && arg.length > 1) {
        // Short option(s)
        const shortOpts = arg.slice(1)
        
        if (shortOpts.length === 1 && i + 1 < args.length && !args[i + 1].startsWith('-')) {
          // -o value
          result.options[shortOpts] = this.parseValue(args[i + 1])
          i++ // Skip next argument
        } else {
          // -abc (multiple flags)
          for (const char of shortOpts) {
            result.flags[char] = true
          }
        }
      } else {
        // Positional argument
        result.args.push(arg)
      }
    }

    return result
  }

  /**
   * Parse string value to appropriate type
   */
  private parseValue(value: string): string | boolean | number {
    // Boolean
    if (value === 'true') return true
    if (value === 'false') return false
    
    // Number
    if (/^\d+$/.test(value)) return parseInt(value, 10)
    if (/^\d*\.\d+$/.test(value)) return parseFloat(value)
    
    // String
    return value
  }

  /**
   * Generate help for a specific command
   */
  private generateCommandHelp(command: CommandDefinition): HelpInfo {
    const usage = this.generateUsage(command)
    const options = this.generateOptionsList(command)
    
    return {
      command: command.name,
      description: command.description,
      usage,
      options,
      examples: command.examples || []
    }
  }

  /**
   * Generate overall help for all commands
   */
  private generateOverallHelp(): HelpInfo {
    const commands = Array.from(this.commands.values())
    const usage = 'curupira <command> [options]'
    
    return {
      command: 'curupira',
      description: 'AI-assisted React debugging tool',
      usage,
      options: commands.map(cmd => ({
        name: cmd.name,
        description: cmd.description,
        type: 'command'
      })),
      examples: [
        'curupira init          # Initialize Curupira in your project',
        'curupira validate      # Validate configuration',
        'curupira dev           # Start development server',
        'curupira --help        # Show this help message'
      ]
    }
  }

  /**
   * Generate usage string for a command
   */
  private generateUsage(command: CommandDefinition): string {
    let usage = `curupira ${command.name}`

    if (command.args) {
      for (const arg of command.args) {
        if (arg.required) {
          usage += ` <${arg.name}>`
        } else {
          usage += ` [${arg.name}]`
        }
      }
    }

    if (command.options || command.flags) {
      usage += ' [options]'
    }

    return usage
  }

  /**
   * Generate options list for help display
   */
  private generateOptionsList(command: CommandDefinition): Array<{
    name: string
    description: string
    type: string
  }> {
    const options = []

    if (command.flags) {
      for (const flag of command.flags) {
        options.push({
          name: `--${flag.name}`,
          description: flag.description,
          type: 'flag'
        })
      }
    }

    if (command.options) {
      for (const option of command.options) {
        let name = `--${option.name}`
        if (option.short) {
          name += `, -${option.short}`
        }
        if (option.type !== 'boolean') {
          name += ` <${option.type}>`
        }

        options.push({
          name,
          description: option.description,
          type: option.type
        })
      }
    }

    return options
  }
}