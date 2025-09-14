/**
 * @fileoverview Global test setup
 */

import { FullConfig } from '@playwright/test'
import { spawn, ChildProcess } from 'child_process'
import { createLogger } from '@curupira/shared'

const logger = createLogger({ name: 'e2e-setup' })

let mcpServer: ChildProcess | null = null
let testApp: ChildProcess | null = null

async function globalSetup(config: FullConfig): Promise<void> {
  logger.info('Starting global E2E test setup')

  try {
    // Start MCP server if not already running
    if (!process.env.SKIP_SERVER_START) {
      logger.info('Starting MCP server')
      mcpServer = spawn('npm', ['run', 'dev'], {
        cwd: '../mcp',
        stdio: 'inherit'
      })

      // Wait for server to start
      await waitForPort(8080, 30000)
      logger.info('MCP server started on port 8080')
    }

    // Start test application if needed
    if (!process.env.SKIP_APP_START) {
      logger.info('Starting test application')
      testApp = spawn('npm', ['run', 'dev'], {
        cwd: '../test-app',
        stdio: 'inherit'
      })

      // Wait for app to start
      await waitForPort(3000, 30000)
      logger.info('Test application started on port 3000')
    }

    // Build Chrome extension if needed
    if (!process.env.SKIP_EXTENSION_BUILD) {
      logger.info('Building Chrome extension')
      const buildProcess = spawn('npm', ['run', 'build'], {
        cwd: '../chrome-extension',
        stdio: 'inherit'
      })

      await new Promise((resolve, reject) => {
        buildProcess.on('close', (code) => {
          if (code === 0) {
            resolve(void 0)
          } else {
            reject(new Error(`Extension build failed with code ${code}`))
          }
        })
      })

      logger.info('Chrome extension built successfully')
    }

    logger.info('Global E2E test setup completed')

  } catch (error) {
    logger.error({ error }, 'Global setup failed')
    throw error
  }
}

async function waitForPort(port: number, timeout: number): Promise<void> {
  const start = Date.now()
  
  while (Date.now() - start < timeout) {
    try {
      const response = await fetch(`http://localhost:${port}/health`)
      if (response.ok) {
        return
      }
    } catch {
      // Service not ready yet
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  
  throw new Error(`Service on port ${port} did not start within ${timeout}ms`)
}

export default globalSetup