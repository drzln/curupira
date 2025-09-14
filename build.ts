#!/usr/bin/env tsx
/**
 * Build script for Curupira
 * Handles building all packages in the correct order
 */

import { execSync } from 'child_process'
import { existsSync, rmSync } from 'fs'
import { join } from 'path'

const packages = ['shared', 'mcp-server', 'cli']

function clean() {
  console.log('🧹 Cleaning build artifacts...')
  
  // Clean dist directories
  for (const pkg of packages) {
    const distPath = join(pkg, 'dist')
    if (existsSync(distPath)) {
      rmSync(distPath, { recursive: true, force: true })
      console.log(`  ✓ Cleaned ${pkg}/dist`)
    }
  }
  
  // Clean tsbuildinfo files
  execSync('find . -name "*.tsbuildinfo" -type f -delete', { stdio: 'inherit' })
}

function build() {
  console.log('🔨 Building packages...')
  
  // Build in dependency order
  for (const pkg of packages) {
    console.log(`\n📦 Building ${pkg}...`)
    execSync(`cd ${pkg} && npm run build`, { stdio: 'inherit' })
    console.log(`  ✅ ${pkg} built successfully`)
  }
}

function main() {
  const args = process.argv.slice(2)
  const shouldClean = args.includes('--clean') || args.includes('-c')
  
  if (shouldClean) {
    clean()
  }
  
  build()
  
  console.log('\n✨ Build completed successfully!')
}

// Run the build
main()