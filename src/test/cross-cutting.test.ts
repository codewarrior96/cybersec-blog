// SENIOR ARCHITECT NOTE: cross-cutting / regression-guard tests per audit
// Section 5 final block. Two tests probe risks that don't fit cleanly into
// any single route's test file:
//   T-SEC01 (R-20): hardcoded HMAC fallback in memory store
//   T-AL01  (R-17): writeAuditLog .catch() swallow invariant (reset route
//                   focused probe; logout's try/catch variant covered by
//                   T-LO04 in Phase 1.D.13)
//
// File-level mocks below support T-AL01 (reset route invocation).
// T-SEC01 uses dynamic import + vi.resetModules to re-evaluate the memory
// store with manipulated env, independent of these mocks.

vi.mock('@/lib/soc-store-adapter', () => ({
  findUserByPasswordResetToken: vi.fn(),
  consumePasswordResetToken: vi.fn(),
  deleteAllSessionsForUser: vi.fn(),
  writeAuditLog: vi.fn(),
}))
vi.mock('@/lib/security', () => ({
  hashPassword: vi.fn(),
}))
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: vi.fn(),
  recordFailure: vi.fn(),
}))
vi.mock('@/lib/client-ip', () => ({
  getClientIp: vi.fn(),
}))
vi.mock('@/lib/auth-server', () => ({
  getRequestMetadata: vi.fn(),
}))

import { NextRequest } from 'next/server'
import {
  findUserByPasswordResetToken,
  consumePasswordResetToken,
  deleteAllSessionsForUser,
  writeAuditLog,
} from '@/lib/soc-store-adapter'
import { hashPassword } from '@/lib/security'
import { checkRateLimit } from '@/lib/rate-limiter'
import { getClientIp } from '@/lib/client-ip'
import { getRequestMetadata } from '@/lib/auth-server'
import { POST as resetPOST } from '@/app/api/auth/reset/route'

const FUTURE_ISO = new Date(Date.now() + 60 * 60 * 1000).toISOString()

const validResetUser = {
  id: 1,
  username: 'u1',
  displayName: 'U1',
  email: 'u@example.com',
  role: 'viewer' as const,
  passwordResetToken: 'token-xyz',
  passwordResetTokenExpiresAt: FUTURE_ISO,
}

const resetUpdatedUser = {
  id: 1,
  username: 'u1',
  email: 'u@example.com',
}

function makeResetPostRequest(body: unknown): NextRequest {
  return new NextRequest('https://localhost/api/auth/reset', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  // Reset-route happy-path baseline (T-AL01 baseline; T-SEC01 unaffected)
  vi.mocked(getClientIp).mockReturnValue('127.0.0.1')
  vi.mocked(getRequestMetadata).mockReturnValue({ ipAddress: '127.0.0.1', userAgent: 'test' })
  vi.mocked(checkRateLimit).mockResolvedValue({
    limited: false,
    remaining: 9,
    resetAt: Date.now() + 5 * 60 * 1000,
  })
  vi.mocked(hashPassword).mockReturnValue('hashed:value')
  vi.mocked(findUserByPasswordResetToken).mockResolvedValue(validResetUser as never)
  vi.mocked(consumePasswordResetToken).mockResolvedValue(resetUpdatedUser as never)
  vi.mocked(deleteAllSessionsForUser).mockResolvedValue({ deletedCount: 2 } as never)
  vi.mocked(writeAuditLog).mockResolvedValue(undefined as never)
})

describe('Cross-cutting / regression-guard tests', () => {
  // ─── T-SEC01: R-20 hardcoded HMAC fallback (memory store) ─────────────────

  describe('R-20 — hardcoded HMAC fallback (memory store) [FIXED Phase 1.5.1]', () => {
    it('T-SEC01: SOC_DEMO_SECRET unset → soc-store-memory throws at import (R-20 FIXED, regression guard)', async () => {
      // SENIOR ARCHITECT NOTE: R-20 (Critical, A02) — FIXED in Phase 1.5.1.
      //
      // ────────────────────────────────────────────────────────────────────
      // FIX SUMMARY
      // ────────────────────────────────────────────────────────────────────
      //
      // Phase 1.D.20 original gap test (T-SEC01 v1) asserted that the
      // literal fallback to 'soc-demo-secret' was reachable when
      // SOC_DEMO_SECRET was unset — proving the R-20 vector. After the
      // fix in commit 7baacac (Phase 1.5.1), the module throws
      // at import time instead of silently falling back. This test was
      // FLIPPED to assert the throw — now serves as a regression guard
      // against any future revert of the hardening.
      //
      // FIX (src/lib/soc-store-memory.ts L32):
      //   const memorySecret = process.env.SOC_DEMO_SECRET
      //   if (!memorySecret) {
      //     throw new Error(
      //       '[soc-store-memory] SOC_DEMO_SECRET environment variable must be set. ' +
      //       'The hardcoded fallback was removed (R-20 hardening). ' +
      //       'Set SOC_DEMO_SECRET in your .env file or deployment environment.'
      //     )
      //   }
      //   const MEMORY_SECRET = memorySecret
      //
      // BEHAVIOR: when SOC_DEMO_SECRET unset, importing the module rejects
      // with an Error whose message contains 'SOC_DEMO_SECRET' (matches
      // the new error message template). Production deployment with
      // missing env crashes at boot with a clear remediation message
      // instead of silently falling back to a public-knowable HMAC key.
      //
      // REGRESSION GUARD: if a future refactor reintroduces the fallback
      // (adds a default value, wraps the throw in a catch, lazy-defers
      // the check to first-use, etc.), this test fails — alerting the
      // reviewer that the R-20 vector has re-opened.
      //
      // ────────────────────────────────────────────────────────────────────
      // HISTORICAL RECORD — original gap analysis (Phase 1.D.20 T-SEC01 v1)
      // ────────────────────────────────────────────────────────────────────
      //
      // The `??` fallback at L32 (now removed) defaulted MEMORY_SECRET to
      // the literal string 'soc-demo-secret' when SOC_DEMO_SECRET was
      // null/undefined. This literal was PUBLIC-KNOWABLE — visible in:
      //   - The repository source code (anyone with read access)
      //   - GitHub blame history (anyone who finds the repo)
      //   - This audit document (anyone reviewing security)
      //   - Any exception trace including the source line
      //
      // CONCRETE FORGE ATTACK CHAIN (4-step compound exploit, NOW CLOSED):
      //
      //   1. Production deployment with NODE_ENV='production' AND
      //      SOC_DEMO_SECRET unset (deployment configuration oversight).
      //
      //   2. R-03 (Critical) memory fallback path activates: Supabase
      //      identity store fails, SQLite store fails, and
      //      `allowCriticalMemoryFallback=true` in production routes
      //      identity operations to the in-process memory store.
      //
      //   3. With memory store now active, MEMORY_SECRET defaulted to the
      //      hardcoded string 'soc-demo-secret'. All session tokens
      //      issued were signed with this public-knowable HMAC key.
      //
      //   4. Attacker (anyone with public source-code access) computed
      //      a forged token externally:
      //        const payload = base64url(JSON.stringify({uid: VICTIM_ID,
      //                                                   exp: Date.now()+3600*1000,
      //                                                   nonce: 'whatever'}))
      //        const signature = createHmac('sha256', 'soc-demo-secret')
      //                          .update(payload).digest('base64url')
      //        const forgedToken = `${payload}.${signature}`
      //      Submitted as Cookie: soc_session=<forgedToken>. Token
      //      validated; session reconstructed from payload's uid;
      //      attacker authenticated as ANY uid, including admin.
      //
      // R-03 + R-20 COMPOUND was the full-compromise vector. After the
      // R-20 fix (this sub-stage, Phase 1.5.1), the compound is
      // partially severed: even if R-03 activates the memory store, the
      // module fails to load without SOC_DEMO_SECRET set, so production
      // crashes at boot rather than silently issuing forge-able tokens.
      // R-03 itself remains until its own hardening sub-stage.
      //
      // ────────────────────────────────────────────────────────────────────
      // CURRENT TEST IMPLEMENTATION (post-flip)
      // ────────────────────────────────────────────────────────────────────
      //
      // 1. Save original SOC_DEMO_SECRET (set by setup.ts L12 to
      //    'test-secret-do-not-use')
      // 2. delete process.env.SOC_DEMO_SECRET (vi.stubEnv can't unset;
      //    direct delete is the only way to make `if (!memorySecret)`
      //    see undefined)
      // 3. vi.resetModules() to clear cached module
      // 4. await expect(import(...)).rejects.toThrow(/SOC_DEMO_SECRET/)
      //    — the dynamic import re-evaluates module-level code, the
      //    `if (!memorySecret) throw` fires, the import promise rejects
      //    with an Error whose message matches the regex
      // 5. finally: restore env via vi.stubEnv + vi.resetModules to wipe
      //    the test's loaded module so subsequent tests get fresh state

      const original = process.env.SOC_DEMO_SECRET

      // Direct delete — vi.stubEnv cannot set undefined; the
      // `if (!memorySecret)` check requires actual undefined (or empty
      // string) to trigger the throw
      delete process.env.SOC_DEMO_SECRET

      try {
        vi.resetModules()

        // The dynamic import must REJECT with an Error whose message
        // contains 'SOC_DEMO_SECRET' (matches the new error message
        // template at soc-store-memory.ts L32-L40)
        await expect(import('@/lib/soc-store-memory')).rejects.toThrow(
          /SOC_DEMO_SECRET/,
        )
      } finally {
        // Restore the setup.ts default (or whatever was originally there)
        if (original !== undefined) {
          vi.stubEnv('SOC_DEMO_SECRET', original)
        }
        // Wipe the test's loaded module so other tests get fresh imports
        vi.resetModules()
      }
    })
  })

  // ─── T-AL01: R-17 writeAuditLog swallow invariant (reset focused probe) ──

  describe('R-17 — writeAuditLog swallow invariant (reset route focused probe)', () => {
    it('T-AL01: writeAuditLog throw → caught silently, reset route still returns success (R-17)', async () => {
      // SENIOR ARCHITECT NOTE: R-17 (Medium, A09) — focused probe on
      // reset route's `.catch()` swallow pattern. Audit Section 5 row
      // says "writeAuditLog throw → caught silently, route still returns
      // success (documents R-17 gap)."
      //
      // writeAuditLog CALL-SITE GREP AUDIT (across src/app/api/auth/**/route.ts):
      //
      //   1. logout/route.ts L23-33:
      //        try { await writeAuditLog({...}) } catch { console.error }
      //      Pattern: try/catch around await
      //      Coverage: T-LO04 (Phase 1.D.13) — covered
      //
      //   2. login/route.ts L102:
      //        await writeAuditLog({...})
      //      Pattern: BARE await, NO swallow
      //      Behavior: writeAuditLog throws → propagates to outer try/catch
      //                at L127 → 503 INTERNAL response
      //      DIFFERENTIAL FINDING: login DOES NOT match R-17's "silently
      //                            swallowed" pattern. Login surfaces audit
      //                            log failures as 503 errors to the user.
      //      A-16 CANDIDATE (NOT yet amendment, future audit revision):
      //        Login's writeAuditLog error handling is INCONSISTENT with
      //        the R-17 pattern documented across logout (try/catch) and
      //        reset (.catch). Either:
      //          (a) intentional design — login's audit log is treated as
      //              a hard requirement (login event MUST be logged for
      //              forensic record; if log fails, reject the login and
      //              let the user retry)
      //          (b) oversight — the developer who wrote login forgot to
      //              wrap writeAuditLog in a swallow, leading to user-
      //              facing 503 on transient audit log failures
      //        Phase 1.5 audit revision should clarify the intent. If (a),
      //        document it explicitly as "login audit log MUST succeed";
      //        if (b), align with reset's .catch() pattern. Either way,
      //        T-LG01 (Phase 1.D.12) does not currently probe the
      //        writeAuditLog-throws path on login — that's a coverage gap
      //        worth flagging.
      //
      //   3. reset/route.ts L150-161:
      //        await writeAuditLog({...}).catch((err) => {
      //          console.warn('[auth/reset] audit log failed:', err)
      //        })
      //      Pattern: .catch() chained on await — silent swallow
      //      Coverage: T-AL01 (this test) — focused probe target
      //
      //   4. register/route.ts: writeAuditLog NOT imported — register
      //      does not write audit logs (gap, but not in audit Section 5
      //      scope; potential future amendment).
      //
      // FOCUSED PROBE SELECTION:
      //   Reset's .catch() pattern is the cleanest R-17 instance not yet
      //   covered (logout's try/catch covered by T-LO04; login's bare-
      //   await is a different pattern altogether per A-16 candidate).
      //   T-AL01 mocks writeAuditLog to reject, calls reset POST with
      //   valid inputs, and verifies:
      //     (1) Response is still 200 (swallow invariant — audit log
      //         failure does not surface to user)
      //     (2) body.ok === true with success message (route completes
      //         successfully despite audit log failure)
      //     (3) Other side effects (consumePasswordResetToken,
      //         deleteAllSessionsForUser) STILL fired — only the audit
      //         log failed; the password change persisted, the sessions
      //         were killed
      //     (4) console.warn captured (the .catch() swallow log — only
      //         operational signal of the failure)
      //
      // PHASE 1.5 HARDENING PROPOSAL (per T-VR06/T-FG07 R-12 pattern,
      // applied to R-17):
      //   (a) Retry queue: failed audit log writes enqueued to a
      //       background job that retries with exponential backoff.
      //       After N failures, alerting kicks in.
      //   (b) Structured error metric: counter incremented on each
      //       audit log failure → operator dashboard surfaces audit log
      //       error rate; threshold-based alert (e.g., >1% failure rate
      //       over 1h) fires PagerDuty/Slack.
      //   (c) Forensic completeness flag: when audit log fails, the
      //       successful response includes a hidden field consumed by
      //       SOC dashboards indicating "this event has incomplete
      //       audit coverage." Investigators know to cross-reference
      //       with raw application logs for the missing entry.
      //   (d) For sensitive actions (login, reset, account_delete),
      //       consider promoting audit log to a hard requirement:
      //       refuse to complete the action if the log can't be
      //       written. UX cost: occasional service degradation during
      //       audit infrastructure issues. Security gain: forensic
      //       record always complete.
      //
      // REJECTED ALTERNATIVE: cross-route probe — import register, login,
      // reset, logout, mock writeAuditLog to throw, verify each returns
      // success (200). Rejected because login WOULD return 503 (not 200,
      // per the A-16 differential finding above). Treating different
      // routes uniformly hides the design inconsistency rather than
      // surfacing it. Focused probe on reset's confirmed .catch() pattern
      // is more honest.
      //
      // HARDENING LANDING: when proposal (d) lands for reset (audit log
      // hard requirement), this test must FLIP — expect 5xx response
      // when writeAuditLog throws, instead of silent 200 success. The
      // user would then know the reset didn't fully complete and could
      // retry.
      vi.mocked(writeAuditLog).mockRejectedValueOnce(new Error('audit log unreachable'))

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const response = await resetPOST(
        makeResetPostRequest({ token: 'token-xyz', newPassword: 'newpass1234' }),
      )

      // (1) Despite writeAuditLog rejection, reset returns 200 — the
      // .catch() swallow at source L159-161 absorbs the error
      expect(response.status).toBe(200)

      // (2) body.ok === true with success message — user sees the
      // password-changed confirmation, no indication of audit failure
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.message).toContain('Şifren güncellendi')

      // (3) Other side effects STILL fired — password write succeeded,
      // sessions invalidated. Only the audit log entry was lost.
      expect(consumePasswordResetToken).toHaveBeenCalledOnce()
      expect(deleteAllSessionsForUser).toHaveBeenCalledOnce()
      expect(writeAuditLog).toHaveBeenCalledOnce() // attempted then rejected

      // (4) console.warn called from L160 (the .catch() swallow log) —
      // only operational signal of the failure, easy to miss in production
      expect(warnSpy).toHaveBeenCalled()

      warnSpy.mockRestore()
    })
  })
})
