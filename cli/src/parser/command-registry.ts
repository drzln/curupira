/**
 * @fileoverview Command registry for managing command definitions
 */

import { createLogger } from '@curupira/shared'
import type { CommandDefinition, BaseCommand } from '../types.js'
import { CommandParser } from './command-parser.js'

// Import command implementations
import { InitCommand } from '../commands/init.js'
import { ValidateCommand } from '../commands/validate.js'
import { StartCommand } from '../commands/start.js'

const logger = createLogger({ level: 'info', name: 'command-registry' })

/**
 * Central registry for all CLI commands
 */
export class CommandRegistry {
  private parser: CommandParser
  private definitions: Map<string, CommandDefinition> = new Map()

  constructor() {
    this.parser = new CommandParser()
    this.registerBuiltInCommands()
  }

  /**
   * Get the command parser instance
   */
  getParser(): CommandParser {
    return this.parser
  }

  /**
   * Register a command definition
   */
  registerCommand(definition: CommandDefinition): void {
    logger.debug({ command: definition.name }, 'Registering command definition')
    
    this.definitions.set(definition.name, definition)
    this.parser.registerCommand(definition)
  }

  /**
   * Get a command definition by name
   */
  getCommand(name: string): CommandDefinition | undefined {
    return this.definitions.get(name)
  }

  /**
   * Get all registered command definitions
   */
  getAllCommands(): CommandDefinition[] {
    return Array.from(this.definitions.values())
  }

  /**
   * Register all built-in commands
   */
  private registerBuiltInCommands(): void {
    logger.info('Registering built-in commands')

    // Init command
    this.registerCommand({
      name: 'init',
      description: 'Initialize Curupira in a React project',
      options: [
        {
          name: 'force',
          short: 'f',
          description: 'Overwrite existing configuration',
          type: 'boolean',
          default: false
        }
      ],
      examples: [
        'curupira init                    # Create curupira.yml',
        'curupira init --force            # Overwrite existing config'
      ],
      handler: new InitCommand()
    })

    // Validate command
    this.registerCommand({
      name: 'validate',
      description: 'Validate curupira.yml configuration',
      options: [
        {
          name: 'fix',
          short: 'f',
          description: 'Auto-fix common issues',
          type: 'boolean',
          default: false
        }
      ],
      examples: [
        'curupira validate                # Validate configuration',
        'curupira validate --fix          # Validate and attempt to fix issues'
      ],
      handler: new ValidateCommand()
    })

    // Start command
    this.registerCommand({
      name: 'start',
      description: 'Start Curupira MCP server',
      options: [
        {
          name: 'port',
          short: 'p',
          description: 'Server port',
          type: 'number'
        },
        {
          name: 'host',
          short: 'h',
          description: 'Server host',
          type: 'string'
        }
      ],
      examples: [
        'curupira start                   # Start MCP server',
        'curupira start -p 3000           # Start on specific port',
        'curupira start --host 0.0.0.0    # Start on all interfaces'
      ],
      handler: new StartCommand()
    })

    logger.info({ count: this.definitions.size }, 'Registered built-in commands')
  }

  /**
   * Create command definition from handler
   */
  static createDefinition(
    name: string,
    description: string,
    handler: BaseCommand,
    options?: Partial<CommandDefinition>
  ): CommandDefinition {
    return {
      name,
      description,
      handler,
      ...options
    }
  }

  /**
   * Validate all registered commands
   */
  validateRegistry(): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    for (const [name, definition] of this.definitions) {
      // Check handler exists
      if (!definition.handler) {
        errors.push(`Command '${name}' missing handler`)
        continue
      }

      // Check handler implements BaseCommand interface
      if (typeof definition.handler.execute !== 'function') {
        errors.push(`Command '${name}' handler missing execute method`)
      }

      if (!definition.handler.name) {
        errors.push(`Command '${name}' handler missing name property`)
      }

      if (!definition.handler.description) {
        errors.push(`Command '${name}' handler missing description property`)
      }

      // Validate options
      if (definition.options) {
        for (const option of definition.options) {
          if (!option.name || !option.description || !option.type) {
            errors.push(`Command '${name}' has invalid option definition`)
          }
        }
      }

      // Validate flags  
      if (definition.flags) {
        for (const flag of definition.flags) {
          if (!flag.name || !flag.description) {
            errors.push(`Command '${name}' has invalid flag definition`)
          }
        }
      }

      // Check for name conflicts with aliases
      if (definition.aliases) {
        for (const alias of definition.aliases) {
          if (this.definitions.has(alias)) {
            errors.push(`Command '${name}' alias '${alias}' conflicts with existing command`)
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Get command statistics
   */
  getStats(): {
    totalCommands: number
    totalAliases: number
    totalOptions: number
    totalFlags: number
  } {
    let totalAliases = 0
    let totalOptions = 0
    let totalFlags = 0

    for (const definition of this.definitions.values()) {
      totalAliases += definition.aliases?.length || 0
      totalOptions += definition.options?.length || 0
      totalFlags += definition.flags?.length || 0
    }

    return {
      totalCommands: this.definitions.size,
      totalAliases,
      totalOptions,
      totalFlags
    }
  }
}