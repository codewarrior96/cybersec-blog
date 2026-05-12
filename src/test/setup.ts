import { beforeAll, afterEach, afterAll } from 'vitest'
import { server } from './msw/server'
import { __resetAllForTests } from '@/lib/rate-limiter'

// SENIOR ARCHITECT NOTE: vi.stubEnv (not direct process.env assignment) so
// restoreMocks: true (already in vitest.config) automatically restores between tests.
// REJECTED ALTERNATIVE: process.env.X = value — leaks across worker tests in the same file.
vi.stubEnv('SOC_STORAGE', 'memory')
vi.stubEnv('SOC_IDENTITY_STORE', 'disabled')
vi.stubEnv('RESEND_API_KEY', 'test-key-do-not-use')
vi.stubEnv('TRUST_PROXY_HEADERS', '0')
vi.stubEnv('SOC_DEMO_SECRET', 'test-secret-do-not-use')
vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000')

// SENIOR ARCHITECT NOTE: onUnhandledRequest: 'error' fails any test that hits a real
// network call we forgot to mock — this is the determinism guarantee, not paranoia.
// REJECTED ALTERNATIVE: 'warn' — silently passes tests that make real network calls,
// breaking hermetic test discipline.
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})

afterEach(async () => {
  server.resetHandlers()
  // SENIOR ARCHITECT NOTE: __resetAllForTests has an R-08 NODE_ENV guard
  // (Phase 1.5.9 hardening — throws when NODE_ENV=production). Some tests
  // transiently stub NODE_ENV=production (e.g., T-AD07/T-AD08/T-AD09 R-03
  // Path γ tests). The stub is restored by Vitest's restoreMocks: true AFTER
  // this afterEach runs, so at this point NODE_ENV may still be 'production'.
  // Cleanup is best-effort — swallow the guard's throw to keep test
  // isolation robust. Tests that legitimately verify the guard (T-R09)
  // assert the throw directly within their test body.
  try {
    await __resetAllForTests()
  } catch (err) {
    if (err instanceof Error && err.message.includes('prohibited in production')) {
      return
    }
    throw err
  }
})

afterAll(() => {
  server.close()
})
