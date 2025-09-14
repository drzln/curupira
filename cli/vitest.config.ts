/**
 * @fileoverview Vitest configuration for Curupira CLI
 */

import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',
    
    // Test files patterns
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['node_modules', 'dist', 'build'],

    // Global test setup
    globals: true,
    
    // Coverage configuration
    coverage: {
      reporter: ['text', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/**/__tests__/**',
        'src/types.ts',
        'src/bin/**', // Binary entry point is tested differently
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    },

    // Test timeout
    testTimeout: 10000,
    
    // Setup files
    setupFiles: [],
    
    // Mock configuration
    clearMocks: true,
    restoreMocks: true,
    
    // Reporter configuration
    reporter: ['default']
  },

  // Module resolution
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@curupira/shared': resolve(__dirname, '../shared/src'),
      '@curupira/mcp': resolve(__dirname, '../mcp/src')
    }
  },

  // Define global constants for tests
  define: {
    'import.meta.vitest': false
  }
})