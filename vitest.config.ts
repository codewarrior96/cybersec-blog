import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
    clearMocks: true,
    restoreMocks: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      // SENIOR ARCHITECT NOTE: 50% threshold for Phase 1 end is intentionally permissive.
      // Phase 3 raises to 70%, Phase 5 to 80%. Setting 80% now would block PR merges
      // before any tests are written.
      // REJECTED ALTERNATIVE: 80% from day one — rejected because tests don't exist yet;
      // CI would block all merges.
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/test/**', 'src/**/*.d.ts'],
      thresholds: {
        statements: 50,
        branches: 50,
        functions: 50,
        lines: 50,
      },
    },
  },
})
