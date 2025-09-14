#!/usr/bin/env node
/**
 * @fileoverview Curupira CLI binary entry point
 */

import { CurupiraCLI } from '../cli.js'

async function main() {
  const cli = new CurupiraCLI()
  const result = await cli.run(process.argv)
  
  if (!result.success) {
    process.exit(result.exitCode)
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
  process.exit(1)
})

// Handle uncaught exceptions  
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
  process.exit(1)
})

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Goodbye!')
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\n🛑 Terminating...')
  process.exit(0)
})

main().catch((error) => {
  console.error('CLI Error:', error)
  process.exit(1)
})