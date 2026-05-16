/**
 * Playwright config — Wave 4A (Phase 5.B per Z.2 cadence).
 *
 * Mentor decisions Z.1-Z.11 applied:
 *   Z.3 — Chromium-only project (no Firefox / WebKit)
 *   Z.7 — CI workflow gated; this config supports both local + CI runs
 *   Z.10 — PLAYWRIGHT_BASE_URL defaults to production siberlab.dev;
 *          local override via .env.test.local (gitignored)
 *
 * SENIOR ARCHITECT NOTE: testDir './e2e' deliberately separate from
 * src/ — Vitest's include pattern `src/**\/*.test.{ts,tsx}` won't sweep
 * up Playwright .spec.ts files, and Playwright's default `*.spec.ts`
 * pattern in its testDir doesn't pick up Vitest tests. The two runners
 * coexist cleanly. Browser binary path resolves via Playwright's
 * internal registry (Windows: %LOCALAPPDATA%/ms-playwright/, Linux/CI:
 * ~/.cache/ms-playwright/).
 *
 * REJECTED ALTERNATIVE: e2e specs under src/. Rejected — risks Vitest
 * config drift, breaks runner-isolation hygiene.
 */
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',

  // Allow parallel locally for speed; serial in CI to reduce flake
  // from rate-limit + shared user-fixture race against production.
  fullyParallel: false,
  workers: process.env.CI ? 1 : undefined,

  // Forbid `.only` in CI to catch accidental focused-test pushes.
  forbidOnly: !!process.env.CI,

  // Retry on CI only — locally a failure should be debugged immediately.
  retries: process.env.CI ? 2 : 0,

  // E2E tests are heavier than unit (multi-route + real network).
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },

  // Reporter: list for human terminal, html for failure artifacts
  // (--open never so CI runs don't try to launch a browser at the report).
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],

  use: {
    // Z.10: production siberlab.dev is the default baseline.
    // Local dev override via PLAYWRIGHT_BASE_URL=http://localhost:3000.
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'https://siberlab.dev',

    // Failure artifacts — retain only on failure to keep clean runs lean.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    // Reasonable viewport default; per-test override possible.
    viewport: { width: 1280, height: 720 },
  },

  // Z.3 — Chromium only. Firefox + WebKit not installed; adding here
  // without the cached binary would fail at first run.
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // SENIOR ARCHITECT NOTE: webServer is NOT configured. Z.10 locks the
  // baseline to production siberlab.dev; we never start a local dev
  // server during E2E. Local-dev override (PLAYWRIGHT_BASE_URL=
  // http://localhost:3000) assumes the dev shell is already running
  // (`npm run dev` in a separate terminal) — Playwright doesn't manage
  // its lifecycle. CI runs only against production.
})
