/**
 * @fileoverview Main Curupira CLI class
 */

import { Command } from 'commander'
import chalk from 'chalk'
import updateNotifier from 'update-notifier'
import { readFileSync, existsSync } from 'fs'
import { join, resolve } from 'path'
import { createLogger } from '@curupira/shared'
import { ProjectConfigLoader } from '@curupira/shared'
import type { 
  CliConfig, 
  CliContext, 
  CommandResult, 
  UpdateInfo,
  ProjectDetection 
} from './types.js'
import { detectProject, checkForUpdates } from './utils/index.js'
import { 
  InitCommand,
  ValidateCommand,
  DevCommand,
  StartCommand,
  DebugCommand 
} from './commands/index.js'

const logger = createLogger({ level: 'info', name: 'curupira-cli' })

/**
 * Main Curupira CLI class
 */
export class CurupiraCLI {
  private program: Command
  private cliConfig: CliConfig
  private packageJson: any

  constructor() {
    this.program = new Command()
    this.cliConfig = this.getDefaultConfig()
    this.packageJson = this.loadPackageJson()
    this.setupProgram()
  }

  /**
   * Run the CLI with provided arguments
   */
  async run(argv: string[]): Promise<CommandResult> {
    try {
      // Check for updates (non-blocking)
      this.checkUpdates()

      // Parse arguments
      await this.program.parseAsync(argv)

      return {
        success: true,
        message: 'Command executed successfully',
        exitCode: 0
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      if (!this.cliConfig.silent) {
        console.error(chalk.red('✗ Error:'), errorMessage)
      }

      return {
        success: false,
        message: errorMessage,
        error: error instanceof Error ? error : new Error(String(error)),
        exitCode: 1
      }
    }
  }

  /**
   * Setup commander program
   */
  private setupProgram(): void {
    this.program
      .name('curupira')
      .description('AI-assisted React debugging tool')
      .version(this.packageJson.version, '-v, --version', 'Display version number')
      .option('-V, --verbose', 'Enable verbose output')
      .option('-s, --silent', 'Suppress output')
      .option('--log-level <level>', 'Set log level (error|warn|info|debug)', 'info')
      .option('--config <path>', 'Path to curupira config file')
      .hook('preAction', (thisCommand) => {
        // Update CLI config with parsed options
        const opts = thisCommand.opts()
        this.cliConfig = {
          ...this.cliConfig,
          verbose: opts.verbose || false,
          silent: opts.silent || false,
          logLevel: opts.logLevel || 'info',
          configPath: opts.config
        }
      })

    // Add commands
    this.addInitCommand()
    this.addValidateCommand()
    this.addDevCommand()
    this.addStartCommand()
    this.addDebugCommand()

    // Handle unknown commands
    this.program
      .action(() => {
        console.log(this.program.helpInformation())
      })
  }

  /**
   * Add 'curupira init' command
   */
  private addInitCommand(): void {
    this.program
      .command('init')
      .description('Initialize Curupira in a React project')
      .option('-f, --force', 'Overwrite existing configuration')
      .option('-t, --template <name>', 'Use specific template')
      .option('--skip-install', 'Skip dependency installation')
      .action(async (options) => {
        const context = await this.createContext()
        const command = new InitCommand()
        const result = await command.execute(context, options)
        
        if (!result.success) {
          process.exit(result.exitCode)
        }
      })
  }

  /**
   * Add 'curupira validate' command
   */
  private addValidateCommand(): void {
    this.program
      .command('validate')
      .description('Validate curupira.yml configuration')
      .option('-f, --fix', 'Auto-fix common issues')
      .action(async (options) => {
        const context = await this.createContext()
        const command = new ValidateCommand()
        const result = await command.execute(context, options)
        
        if (!result.success) {
          process.exit(result.exitCode)
        }
      })
  }

  /**
   * Add 'curupira dev' command
   */
  private addDevCommand(): void {
    this.program
      .command('dev')
      .description('Start Curupira MCP server in development mode')
      .option('-p, --port <port>', 'Server port', '8080')
      .option('--host <host>', 'Server host', 'localhost')
      .option('--open', 'Open browser extension DevTools')
      .action(async (options) => {
        const context = await this.createContext()
        const command = new DevCommand()
        const result = await command.execute(context, options)
        
        if (!result.success) {
          process.exit(result.exitCode)
        }
      })
  }

  /**
   * Add 'curupira start' command
   */
  private addStartCommand(): void {
    this.program
      .command('start')
      .description('Start Curupira MCP server in production mode')
      .option('-p, --port <port>', 'Server port', '8080')
      .option('--host <host>', 'Server host', '0.0.0.0')
      .option('-d, --daemon', 'Run as daemon process')
      .action(async (options) => {
        const context = await this.createContext()
        const command = new StartCommand()
        const result = await command.execute(context, options)
        
        if (!result.success) {
          process.exit(result.exitCode)
        }
      })
  }

  /**
   * Add 'curupira debug' command
   */
  private addDebugCommand(): void {
    this.program
      .command('debug')
      .description('Run targeted debugging session')
      .option('-c, --component <name>', 'Target specific component')
      .option('-u, --url <url>', 'Target specific page URL')
      .option('--profile', 'Enable performance profiling')
      .option('--snapshot', 'Create state snapshot')
      .action(async (options) => {
        const context = await this.createContext()
        const command = new DebugCommand()
        const result = await command.execute(context, options)
        
        if (!result.success) {
          process.exit(result.exitCode)
        }
      })
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
      projectConfig: projectConfig || undefined,
      cwd,
      packageJson: this.packageJson
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
   * Get program instance (for testing)
   */
  getProgram(): Command {
    return this.program
  }

  /**
   * Get CLI config (for testing)
   */
  getConfig(): CliConfig {
    return this.cliConfig
  }
}