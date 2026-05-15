import path from 'node:path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// SENIOR ARCHITECT NOTE: @vitejs/plugin-react added Phase 4.B alongside
// .test.{ts,tsx} include widening. Required because tsconfig.json sets
// `jsx: "preserve"` (Next.js convention — Next handles JSX server-side),
// which leaves vitest/vite with no JSX transformer. The plugin provides
// JSX-to-JS transformation for .tsx test files. Phase 1-3 .test.ts
// files don't use JSX so they're unaffected by the plugin's presence.
// REJECTED ALTERNATIVE: per-file override of tsconfig jsx setting —
// fragile, requires every .test.tsx to repeat the directive.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    // SENIOR ARCHITECT NOTE: DEFAULT environment stays 'node' even after
    // Phase 4.B adds jsdom — Phase 1-3 tests (~386) run in pure Node and
    // benefit from the speed. Phase 4.D component test files opt into
    // jsdom per-file via `// @vitest-environment jsdom` header comment.
    // REJECTED ALTERNATIVE: global 'jsdom' — slows the 386-test suite
    // with no benefit (none of Phase 1-3 tests touch DOM).
    environment: 'node',
    globals: true,
    // Phase 4.B widening: capture .test.tsx component test files in
    // addition to .test.ts. Default-env-Node files unaffected.
    include: ['src/**/*.test.{ts,tsx}'],
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
