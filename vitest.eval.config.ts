import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['evals/**/*.eval.ts'],
    exclude: ['node_modules/**', 'mobile/**', 'e2e/**', '__tests__/**'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    pool: 'forks',
    fileParallelism: false,
    setupFiles: ['./evals/setup.ts'],
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
