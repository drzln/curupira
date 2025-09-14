/**
 * @fileoverview Tests for HelpSystem
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { HelpSystem } from '../help-system.js'
import type { HelpInfo, CommandDefinition } from '../../types.js'

// Mock dependencies
vi.mock('@curupira/shared', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }))
}))

// Mock console.log
const originalConsole = {
  log: console.log
}

describe('HelpSystem', () => {
  let helpSystem: HelpSystem
  let mockCommandDef: CommandDefinition

  beforeEach(() => {
    helpSystem = new HelpSystem()
    mockCommandDef = {
      name: 'test',
      description: 'Test command for unit testing',
      aliases: ['t', 'testing'],
      args: [
        { name: 'input', description: 'Input file', required: true, type: 'string' },
        { name: 'output', description: 'Output file', required: false, type: 'string' }
      ],
      options: [
        { name: 'verbose', short: 'v', description: 'Enable verbose output', type: 'boolean', default: false },
        { name: 'port', short: 'p', description: 'Port number', type: 'number', default: 3000 },
        { name: 'mode', description: 'Operation mode', type: 'string', choices: ['dev', 'prod'] }
      ],
      flags: [
        { name: 'force', short: 'f', description: 'Force operation' },
        { name: 'quiet', description: 'Quiet mode' }
      ],
      examples: [
        'curupira test input.txt                    # Basic usage',
        'curupira test input.txt output.txt --verbose  # Verbose mode',
        'curupira test input.txt -p 8080 --force      # Custom port with force'
      ],
      handler: {
        name: 'test',
        description: 'Test command',
        execute: vi.fn()
      } as any
    }

    // Mock console.log
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    console.log = originalConsole.log
  })

  describe('formatHelp', () => {
    it('should format overall help for curupira command', () => {
      const overallHelp: HelpInfo = {
        command: 'curupira',
        description: 'AI-assisted React debugging tool',
        usage: 'curupira <command> [options]',
        options: [
          { name: 'init', description: 'Initialize Curupira in a React project', type: 'command' },
          { name: 'validate', description: 'Validate configuration', type: 'command' }
        ],
        examples: [
          'curupira init          # Initialize Curupira in your project',
          'curupira validate      # Validate configuration',
          'curupira --help        # Show this help message'
        ]
      }

      const result = helpSystem.formatHelp(overallHelp)

      expect(result).toContain('Curupira CLI')
      expect(result).toContain('AI-assisted React debugging tool')
      expect(result).toContain('USAGE')
      expect(result).toContain('curupira <command> [options]')
      expect(result).toContain('COMMANDS')
      expect(result).toContain('init')
      expect(result).toContain('validate')
      expect(result).toContain('EXAMPLES')
    })

    it('should format command-specific help', () => {
      const commandHelp: HelpInfo = {
        command: 'test',
        description: 'Test command for unit testing',
        usage: 'curupira test <input> [output] [options]',
        options: [
          { name: '--verbose, -v', description: 'Enable verbose output', type: 'boolean' },
          { name: '--port, -p <number>', description: 'Port number (default: 3000)', type: 'number' },
          { name: '--force, -f', description: 'Force operation', type: 'flag' }
        ],
        examples: [
          'curupira test input.txt                    # Basic usage',
          'curupira test input.txt output.txt --verbose  # Verbose mode'
        ]
      }

      const result = helpSystem.formatHelp(commandHelp)

      expect(result).toContain('curupira test')
      expect(result).toContain('Test command for unit testing')
      expect(result).toContain('USAGE')
      expect(result).toContain('OPTIONS')
      expect(result).toContain('FLAGS')
      expect(result).toContain('EXAMPLES')
      expect(result).toContain('--verbose')
      expect(result).toContain('--port')
      expect(result).toContain('--force')
    })

    it('should format compact help without examples', () => {
      const help: HelpInfo = {
        command: 'test',
        description: 'Test command',
        usage: 'curupira test',
        options: [],
        examples: ['curupira test']
      }

      const compactResult = helpSystem.formatHelp(help, true)
      const fullResult = helpSystem.formatHelp(help, false)

      expect(compactResult.length).toBeLessThan(fullResult.length)
      expect(compactResult).not.toContain('EXAMPLES')
      expect(fullResult).toContain('EXAMPLES')
    })
  })

  describe('generateCommandHelp', () => {
    it('should generate complete help from command definition', () => {
      const help = helpSystem.generateCommandHelp(mockCommandDef)

      expect(help.command).toBe('test')
      expect(help.description).toBe('Test command for unit testing')
      expect(help.usage).toContain('curupira test')
      expect(help.usage).toContain('<input>')
      expect(help.usage).toContain('[output]')
      expect(help.usage).toContain('[options]')
      expect(help.examples).toEqual(mockCommandDef.examples)
    })

    it('should generate help with aliases in usage', () => {
      const help = helpSystem.generateCommandHelp(mockCommandDef)

      expect(help.usage).toContain('(t|testing)')
    })

    it('should generate options list with proper formatting', () => {
      const help = helpSystem.generateCommandHelp(mockCommandDef)

      const optionNames = help.options.map(opt => opt.name)
      expect(optionNames).toContain('--force, -f')
      expect(optionNames).toContain('--verbose, -v')
      expect(optionNames).toContain('--port, -p <number>')
      expect(optionNames).toContain('--mode <string>')

      const verboseOption = help.options.find(opt => opt.name.includes('verbose'))
      expect(verboseOption?.description).toContain('(default: false)')

      const modeOption = help.options.find(opt => opt.name.includes('mode'))
      expect(modeOption?.description).toContain('[dev|prod]')
    })

    it('should handle command without aliases', () => {
      const simpleCommand = {
        ...mockCommandDef,
        aliases: undefined
      }

      const help = helpSystem.generateCommandHelp(simpleCommand)

      expect(help.usage).toBe('curupira test <input> [output] [options]')
      expect(help.usage).not.toContain('(')
    })

    it('should handle command without args', () => {
      const simpleCommand = {
        ...mockCommandDef,
        args: undefined
      }

      const help = helpSystem.generateCommandHelp(simpleCommand)

      expect(help.usage).toBe('curupira test (t|testing) [options]')
      expect(help.usage).not.toContain('<')
      expect(help.usage).not.toContain('[input]')
    })
  })

  describe('displayHelp', () => {
    it('should display help and return success result', async () => {
      const help: HelpInfo = {
        command: 'test',
        description: 'Test command',
        usage: 'curupira test',
        options: [],
        examples: []
      }

      const result = await helpSystem.displayHelp(help)

      expect(result.success).toBe(true)
      expect(result.message).toBe('Help displayed successfully')
      expect(result.exitCode).toBe(0)
      expect(console.log).toHaveBeenCalled()
    })

    it('should display compact help when requested', async () => {
      const help: HelpInfo = {
        command: 'test',
        description: 'Test command',
        usage: 'curupira test',
        options: [],
        examples: ['example1', 'example2']
      }

      await helpSystem.displayHelp(help, true)

      const output = vi.mocked(console.log).mock.calls[0][0]
      expect(output).not.toContain('example1')
    })
  })

  describe('formatError', () => {
    it('should format error message with general help suggestion', () => {
      const result = helpSystem.formatError('Something went wrong')

      expect(result).toContain('Error: Something went wrong')
      expect(result).toContain('For general help, run:')
      expect(result).toContain('curupira --help')
    })

    it('should format error message with command-specific help suggestion', () => {
      const result = helpSystem.formatError('Invalid option', 'test')

      expect(result).toContain('Error: Invalid option')
      expect(result).toContain('For help with \'test\', run:')
      expect(result).toContain('curupira test --help')
    })
  })

  describe('formatValidationErrors', () => {
    it('should format validation errors with multiple errors', () => {
      const errors = [
        'Missing required argument: input',
        'Unknown option: --invalid',
        'Option --port must be a number'
      ]

      const result = helpSystem.formatValidationErrors(errors, 'test')

      expect(result).toContain('Command \'test\' validation failed:')
      expect(result).toContain('• Missing required argument: input')
      expect(result).toContain('• Unknown option: --invalid')
      expect(result).toContain('• Option --port must be a number')
      expect(result).toContain('curupira test --help')
    })

    it('should handle single validation error', () => {
      const errors = ['Missing required argument: input']

      const result = helpSystem.formatValidationErrors(errors, 'init')

      expect(result).toContain('Command \'init\' validation failed:')
      expect(result).toContain('• Missing required argument: input')
    })
  })

  describe('formatSuggestions', () => {
    it('should suggest similar commands', () => {
      const availableCommands = ['init', 'validate', 'dev', 'start', 'debug']

      const result = helpSystem.formatSuggestions('initi', availableCommands)

      expect(result).toContain('Unknown command: \'initi\'')
      expect(result).toContain('Did you mean:')
      expect(result).toContain('init')
    })

    it('should handle no similar commands found', () => {
      const availableCommands = ['init', 'validate', 'dev']

      const result = helpSystem.formatSuggestions('xyz', availableCommands)

      expect(result).toContain('Unknown command: \'xyz\'')
      expect(result).not.toContain('Did you mean:')
      expect(result).toContain('Run \'curupira --help\' to see available commands')
    })

    it('should limit suggestions to top 3', () => {
      const availableCommands = ['init', 'install', 'inspect', 'internal', 'index']

      const result = helpSystem.formatSuggestions('in', availableCommands)

      // Should not contain all 5 commands, maximum 3
      const suggestions = result.split('\n').filter(line => line.trim() && !line.includes('Unknown') && !line.includes('Did you mean') && !line.includes('Run'))
      expect(suggestions.length).toBeLessThanOrEqual(3)
    })
  })

  describe('string similarity calculation', () => {
    it('should find similar commands with simple typos', () => {
      const availableCommands = ['validate', 'init', 'dev']

      // Test various typos
      let result = helpSystem.formatSuggestions('validat', availableCommands)
      expect(result).toContain('validate')

      result = helpSystem.formatSuggestions('ini', availableCommands)
      expect(result).toContain('init')

      result = helpSystem.formatSuggestions('dv', availableCommands)
      expect(result).toContain('dev')
    })

    it('should not suggest very dissimilar commands', () => {
      const availableCommands = ['validate', 'init', 'dev']

      const result = helpSystem.formatSuggestions('completely-different', availableCommands)

      expect(result).not.toContain('Did you mean:')
    })
  })

  describe('edge cases', () => {
    it('should handle command definition without options or flags', () => {
      const simpleCommand: CommandDefinition = {
        name: 'simple',
        description: 'Simple command',
        handler: { name: 'simple', description: 'Simple command', execute: vi.fn() } as any
      }

      const help = helpSystem.generateCommandHelp(simpleCommand)

      expect(help.options).toHaveLength(0)
      expect(help.usage).toBe('curupira simple')
    })

    it('should handle command definition without examples', () => {
      const commandWithoutExamples = {
        ...mockCommandDef,
        examples: undefined
      }

      const help = helpSystem.generateCommandHelp(commandWithoutExamples)

      expect(help.examples).toEqual([])
    })

    it('should handle help info with empty options array', () => {
      const help: HelpInfo = {
        command: 'empty',
        description: 'Empty command',
        usage: 'curupira empty',
        options: [],
        examples: []
      }

      const result = helpSystem.formatHelp(help)

      expect(result).toContain('curupira empty')
      expect(result).not.toContain('OPTIONS')
      expect(result).not.toContain('FLAGS')
    })

    it('should handle very long command names and descriptions', () => {
      const longCommand: CommandDefinition = {
        name: 'very-long-command-name-with-many-characters',
        description: 'This is a very long description that should test the formatting capabilities of the help system when dealing with lengthy text content',
        options: [
          { 
            name: 'very-long-option-name', 
            description: 'This is also a very long description for an option that tests text wrapping and formatting',
            type: 'string'
          }
        ],
        handler: { name: 'long', description: 'Long command', execute: vi.fn() } as any
      }

      const help = helpSystem.generateCommandHelp(longCommand)
      const formatted = helpSystem.formatHelp(help)

      expect(formatted).toContain('very-long-command-name-with-many-characters')
      expect(formatted).toContain('very-long-option-name')
    })
  })
})