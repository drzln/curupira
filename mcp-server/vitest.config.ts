import { defineConfig } from 'vitest/config'
import { resolve } from 'path'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    timeout: 60000, // 60 seconds for integration tests
    testTimeout: 60000,
    hookTimeout: 60000,
    teardownTimeout: 60000,
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    include: [
      'src/**/*.test.ts',
      'src/__tests__/**/*.test.ts'
    ],
    exclude: [
      'node_modules/**',
      'dist/**',
      '.deps/**'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/types.ts',
        'src/**/index.ts'
      ]
    }
  },
  resolve: {
    alias: {
      '@curupira/shared': resolve(__dirname, '../shared/dist'),
      '~/': resolve(__dirname, 'src/')
    }
  }
})