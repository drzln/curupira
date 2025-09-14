/**
 * @fileoverview Global test teardown
 */

import { FullConfig } from '@playwright/test'
import { createLogger } from '@curupira/shared'

const logger = createLogger({ name: 'e2e-teardown' })

async function globalTeardown(config: FullConfig): Promise<void> {
  logger.info('Starting global E2E test teardown')

  try {
    // Cleanup processes started in setup
    // Note: In a real implementation, you would track and clean up 
    // the processes started in global-setup.ts

    logger.info('Global E2E test teardown completed')

  } catch (error) {
    logger.error({ error }, 'Global teardown failed')
    // Don't throw here as it might mask test failures
  }
}

export default globalTeardown