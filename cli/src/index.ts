/**
 * @fileoverview Curupira CLI main entry point
 */

// Export CLI types and utilities for programmatic usage
export type { CliConfig, CommandResult, CliContext } from './types.js'
export type { InitCommandOptions, DevCommandOptions, ValidateCommandOptions } from './commands/index.js'

// Export main CLI class
export { CurupiraCLI } from './cli.js'

// Export command implementations for testing
export * from './commands/index.js'

// Export utilities
export * from './utils/index.js'