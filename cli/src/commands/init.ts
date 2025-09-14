/**
 * @fileoverview 'curupira init' command - Simple config generation
 */

import { writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { createLogger } from '@curupira/shared'
import type { BaseCommand, CliContext, CommandResult } from '../types.js'
import { detectProject, validateProject } from '../utils/project-detector.js'
import { generateConfigTemplate } from '../utils/template-generator.js'

const logger = createLogger({ level: 'info', name: 'init-command' })

/**
 * Init command options
 */
export interface InitCommandOptions {
  force?: boolean
}

/**
 * Initialize Curupira in a React project
 */
export class InitCommand implements BaseCommand {
  name = 'init'
  description = 'Initialize Curupira in a React project'

  async execute(context: CliContext, options: InitCommandOptions = {}): Promise<CommandResult> {
    try {
      const configPath = join(context.cwd, 'curupira.yml')

      // Check if config already exists
      if (existsSync(configPath) && !options.force) {
        return {
          success: true,
          message: 'curupira.yml already exists (use --force to overwrite)',
          exitCode: 0
        }
      }

      // Detect and validate project
      const detection = await detectProject(context.cwd)
      const validation = validateProject(detection)
      
      if (!validation.valid) {
        return {
          success: false,
          message: `Not a React project: ${validation.reason}`,
          exitCode: 1
        }
      }

      // Generate basic template data
      const projectName = context.cwd.split('/').pop() || 'my-react-app'
      const templateData = {
        projectName,
        framework: detection.framework,
        typescript: detection.hasTypeScript,
        hasStateManagement: {
          zustand: false,
          xstate: false,
          apollo: false
        },
        customComponents: ['App', 'Header'],
        customPages: [
          { name: 'Home', url: '/', critical: true }
        ]
      }

      // Generate configuration
      const configContent = await generateConfigTemplate(templateData)

      // Write configuration file
      writeFileSync(configPath, configContent, 'utf-8')

      if (!context.config.silent) {
        console.log(`Created curupira.yml`)
        console.log(`Next: curupira start`)
      }

      return {
        success: true,
        message: 'Created curupira.yml',
        data: { configPath },
        exitCode: 0
      }

    } catch (error) {
      logger.error({ error }, 'Init failed')
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        error: error instanceof Error ? error : new Error(String(error)),
        exitCode: 1
      }
    }
  }

}