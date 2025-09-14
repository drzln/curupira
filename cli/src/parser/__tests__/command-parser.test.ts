/**
 * @fileoverview Tests for CommandParser
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CommandParser } from '../command-parser.js'
import type { CommandDefinition } from '../../types.js'

// Mock dependencies
vi.mock('@curupira/shared', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }))
}))

describe('CommandParser', () => {
  let parser: CommandParser
  let mockCommand: CommandDefinition

  beforeEach(() => {
    parser = new CommandParser()
    mockCommand = {
      name: 'test',
      description: 'Test command',
      aliases: ['t', 'testing'],
      args: [
        { name: 'input', description: 'Input file', required: true, type: 'string' },
        { name: 'output', description: 'Output file', required: false, type: 'string' }
      ],
      options: [
        { name: 'verbose', short: 'v', description: 'Verbose output', type: 'boolean', default: false },
        { name: 'port', short: 'p', description: 'Port number', type: 'number', default: 3000 },
        { name: 'mode', description: 'Mode', type: 'string', choices: ['dev', 'prod'] }
      ],
      flags: [
        { name: 'force', short: 'f', description: 'Force operation' },
        { name: 'quiet', description: 'Quiet mode' }
      ],
      handler: {
        name: 'test',
        description: 'Test command',
        execute: vi.fn()
      } as any
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('registerCommand', () => {
    it('should register a command successfully', () => {
      parser.registerCommand(mockCommand)
      
      expect(parser.hasCommand('test')).toBe(true)
      expect(parser.hasCommand('t')).toBe(true)
      expect(parser.hasCommand('testing')).toBe(true)
    })

    it('should handle commands without aliases', () => {
      const simpleCommand = {
        ...mockCommand,
        aliases: undefined
      }
      
      parser.registerCommand(simpleCommand)
      
      expect(parser.hasCommand('test')).toBe(true)
    })
  })

  describe('parseCommand', () => {
    beforeEach(() => {
      parser.registerCommand(mockCommand)
    })

    it('should parse basic command with no arguments', () => {
      const result = parser.parseCommand(['node', 'curupira', 'test'])
      
      expect(result.command).toBe('test')
      expect(result.args).toEqual([])
      expect(result.flags).toEqual({})
      expect(result.options).toEqual({})
      expect(result.raw).toEqual(['node', 'curupira', 'test'])
    })

    it('should parse command with positional arguments', () => {
      const result = parser.parseCommand(['node', 'curupira', 'test', 'input.txt', 'output.txt'])
      
      expect(result.command).toBe('test')
      expect(result.args).toEqual(['input.txt', 'output.txt'])
    })

    it('should parse long options with values', () => {
      const result = parser.parseCommand(['node', 'curupira', 'test', '--port', '8080', '--mode=dev'])
      
      expect(result.options).toEqual({
        port: 8080,
        mode: 'dev'
      })
    })

    it('should parse short options', () => {
      const result = parser.parseCommand(['node', 'curupira', 'test', '-p', '3000', '-v'])
      
      expect(result.options).toEqual({ p: 3000 })
      expect(result.flags).toEqual({ v: true })
    })

    it('should parse flags correctly', () => {
      const result = parser.parseCommand(['node', 'curupira', 'test', '--force', '--quiet'])
      
      expect(result.flags).toEqual({
        force: true,
        quiet: true
      })
    })

    it('should parse combined short flags', () => {
      const result = parser.parseCommand(['node', 'curupira', 'test', '-fq'])
      
      expect(result.flags).toEqual({
        f: true,
        q: true
      })
    })

    it('should resolve command aliases', () => {
      const result = parser.parseCommand(['node', 'curupira', 't'])
      
      expect(result.command).toBe('test')
    })

    it('should handle help command for short argv', () => {
      const result = parser.parseCommand(['node', 'curupira'])
      
      expect(result.command).toBe('help')
    })

    it('should parse boolean values correctly', () => {
      const result = parser.parseCommand(['node', 'curupira', 'test', '--verbose=true', '--quiet=false'])
      
      expect(result.options).toEqual({
        verbose: true,
        quiet: false
      })
    })

    it('should parse numeric values correctly', () => {
      const result = parser.parseCommand(['node', 'curupira', 'test', '--port=8080', '--ratio=3.14'])
      
      expect(result.options).toEqual({
        port: 8080,
        ratio: 3.14
      })
    })
  })

  describe('validateCommand', () => {
    beforeEach(() => {
      parser.registerCommand(mockCommand)
    })

    it('should validate unknown command', () => {
      const parsed = {
        command: 'unknown',
        args: [],
        flags: {},
        options: {},
        raw: ['node', 'curupira', 'unknown']
      }
      
      const result = parser.validateCommand(parsed)
      
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Unknown command: unknown')
    })

    it('should validate missing required arguments', () => {
      const parsed = {
        command: 'test',
        args: [], // Missing required 'input' argument
        flags: {},
        options: {},
        raw: ['node', 'curupira', 'test']
      }
      
      const result = parser.validateCommand(parsed)
      
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('Missing required arguments: input')
    })

    it('should validate valid command with all required arguments', () => {
      const parsed = {
        command: 'test',
        args: ['input.txt'],
        flags: {},
        options: {},
        raw: ['node', 'curupira', 'test', 'input.txt']
      }
      
      const result = parser.validateCommand(parsed)
      
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should validate unknown options', () => {
      const parsed = {
        command: 'test',
        args: ['input.txt'],
        flags: {},
        options: { unknown: 'value' },
        raw: ['node', 'curupira', 'test', 'input.txt', '--unknown', 'value']
      }
      
      const result = parser.validateCommand(parsed)
      
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Unknown option: --unknown')
    })

    it('should validate option type mismatch', () => {
      const parsed = {
        command: 'test',
        args: ['input.txt'],
        flags: {},
        options: { port: 'not-a-number' },
        raw: ['node', 'curupira', 'test', 'input.txt', '--port', 'not-a-number']
      }
      
      const result = parser.validateCommand(parsed)
      
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Option --port must be a number')
    })

    it('should validate option choices', () => {
      const parsed = {
        command: 'test',
        args: ['input.txt'],
        flags: {},
        options: { mode: 'invalid' },
        raw: ['node', 'curupira', 'test', 'input.txt', '--mode', 'invalid']
      }
      
      const result = parser.validateCommand(parsed)
      
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Option --mode must be one of: dev, prod')
    })

    it('should validate unknown flags', () => {
      const parsed = {
        command: 'test',
        args: ['input.txt'],
        flags: { unknown: true },
        options: {},
        raw: ['node', 'curupira', 'test', 'input.txt', '--unknown']
      }
      
      const result = parser.validateCommand(parsed)
      
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Unknown flag: --unknown')
    })

    it('should validate valid command with options and flags', () => {
      const parsed = {
        command: 'test',
        args: ['input.txt', 'output.txt'],
        flags: { force: true, quiet: true },
        options: { port: 8080, mode: 'dev' },
        raw: ['node', 'curupira', 'test', 'input.txt', 'output.txt', '--force', '--quiet', '--port', '8080', '--mode', 'dev']
      }
      
      const result = parser.validateCommand(parsed)
      
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('generateHelp', () => {
    beforeEach(() => {
      parser.registerCommand(mockCommand)
    })

    it('should generate overall help', () => {
      const help = parser.generateHelp()
      
      expect(help.command).toBe('curupira')
      expect(help.description).toBe('AI-assisted React debugging tool')
      expect(help.usage).toBe('curupira <command> [options]')
      expect(help.examples).toContain('curupira init          # Initialize Curupira in your project')
    })

    it('should generate command-specific help', () => {
      const help = parser.generateHelp('test')
      
      expect(help.command).toBe('test')
      expect(help.description).toBe('Test command')
      expect(help.usage).toContain('curupira test')
    })

    it('should handle unknown command help', () => {
      const help = parser.generateHelp('unknown')
      
      expect(help.command).toBe('unknown')
      expect(help.description).toBe('Unknown command: unknown')
    })
  })

  describe('getCommands', () => {
    it('should return empty array when no commands registered', () => {
      const commands = parser.getCommands()
      
      expect(commands).toEqual([])
    })

    it('should return all registered commands', () => {
      parser.registerCommand(mockCommand)
      const commands = parser.getCommands()
      
      expect(commands).toHaveLength(1)
      expect(commands[0].name).toBe('test')
    })
  })

  describe('hasCommand', () => {
    beforeEach(() => {
      parser.registerCommand(mockCommand)
    })

    it('should return true for registered command', () => {
      expect(parser.hasCommand('test')).toBe(true)
    })

    it('should return true for command aliases', () => {
      expect(parser.hasCommand('t')).toBe(true)
      expect(parser.hasCommand('testing')).toBe(true)
    })

    it('should return false for unregistered command', () => {
      expect(parser.hasCommand('unknown')).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('should handle commands without options or flags', () => {
      const simpleCommand = {
        name: 'simple',
        description: 'Simple command',
        handler: { name: 'simple', description: 'Simple command', execute: vi.fn() } as any
      }
      
      parser.registerCommand(simpleCommand)
      
      const parsed = parser.parseCommand(['node', 'curupira', 'simple'])
      const result = parser.validateCommand(parsed)
      
      expect(result.valid).toBe(true)
    })

    it('should handle empty command line', () => {
      const result = parser.parseCommand([])
      
      expect(result.command).toBe('help')
    })

    it('should handle command line with only program name', () => {
      const result = parser.parseCommand(['node'])
      
      expect(result.command).toBe('help')
    })
  })
})