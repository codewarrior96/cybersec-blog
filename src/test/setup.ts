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

afterEach(() => {
  server.resetHandlers()
  __resetAllForTests()
})

afterAll(() => {
  server.close()
})
