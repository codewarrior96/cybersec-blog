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

import { createHmac } from 'crypto'

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
  vi.mocked(checkRateLimit).mockReturnValue({
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

  describe('R-20 — hardcoded HMAC fallback (memory store)', () => {
    it('T-SEC01: SOC_DEMO_SECRET unset → memory store falls back to "soc-demo-secret" — tokens forge-able (R-20)', async () => {
      // SENIOR ARCHITECT NOTE: R-20 (Critical, A02) — LITERAL gap test.
      //
      // Source: src/lib/soc-store-memory.ts L32:
      //   const MEMORY_SECRET = process.env.SOC_DEMO_SECRET ?? 'soc-demo-secret'
      //
      // The `??` fallback means: if SOC_DEMO_SECRET is null/undefined,
      // MEMORY_SECRET defaults to the literal string 'soc-demo-secret'.
      // This literal is PUBLIC-KNOWABLE — it appears in:
      //   - The repository source code (visible to anyone with read access)
      //   - GitHub blame history (visible to anyone who finds the repo)
      //   - This audit document (visible to anyone reviewing security)
      //   - Any exception trace that includes the source line
      //
      // CONCRETE FORGE ATTACK CHAIN (4-step compound exploit):
      //
      //   1. Production deployment with NODE_ENV='production' AND
      //      SOC_DEMO_SECRET environment variable UNSET (deployment
      //      configuration oversight; .env.production missing the key,
      //      or operator forgot to set it during initial setup).
      //
      //   2. R-03 (Critical) memory fallback path activates: the Supabase
      //      identity store fails (or wasn't configured), the route handler
      //      falls back to the SQLite store, the SQLite store also fails
      //      (database connection issue, file-permission error, etc.),
      //      and `allowCriticalMemoryFallback=true` in production routes
      //      identity operations to the in-process memory store. (This
      //      compound with R-03 is critical — see audit Section 2 R-03 for
      //      the trigger conditions, and Phase 1.D.9 T-AD04/T-AD07 for
      //      the test coverage.)
      //
      //   3. With memory store now active, MEMORY_SECRET defaults to the
      //      hardcoded string 'soc-demo-secret' (this test's literal
      //      assertion). All session tokens issued by the memory store
      //      are signed with this public-knowable HMAC key.
      //
      //   4. Attacker (anyone — no prior compromise needed, just public
      //      source-code access) computes:
      //        const payload = base64url(JSON.stringify({uid: VICTIM_ID,
      //                                                   exp: Date.now()+3600*1000,
      //                                                   nonce: 'whatever'}))
      //        const signature = createHmac('sha256', 'soc-demo-secret')
      //                          .update(payload).digest('base64url')
      //        const forgedToken = `${payload}.${signature}`
      //      Submits forgedToken via Cookie: soc_session=<forgedToken>.
      //      decodeToken (memory-store.ts L429-456) verifies the signature
      //      using timing-safe comparison; since the attacker used the
      //      correct fallback secret, the signature MATCHES.
      //      Token validates; session reconstructed from payload's uid;
      //      attacker is authenticated as ANY uid they choose, including
      //      uid=1 (typically admin).
      //
      // R-03 + R-20 COMPOUND:
      //   R-03 (Critical) silently activates memory fallback in production
      //   without operator opt-in (NODE_ENV=production alone enables it).
      //   R-20 (Critical) makes that memory store cryptographically
      //   forge-able by anyone with public source access. Together: full
      //   compromise of the authentication system, no prior credential
      //   leak required, no privilege escalation chain — just a forged
      //   token submitted as Cookie.
      //
      // PHASE 1.5 HARDENING PROPOSAL:
      //   Replace the `??` fallback at L32 with:
      //     const MEMORY_SECRET = process.env.SOC_DEMO_SECRET
      //     if (!MEMORY_SECRET) {
      //       throw new Error('[soc-store-memory] SOC_DEMO_SECRET must be set')
      //     }
      //   FAIL-LOUD at boot vs silent prod compromise. The deployment
      //   crashes immediately with a clear error message; operator fixes
      //   env config before service comes up. Refusing to start is the
      //   correct default for security-critical secrets.
      //
      //   When this hardening lands, T-SEC01 must FLIP: assert that
      //   importing soc-store-memory with SOC_DEMO_SECRET unset THROWS,
      //   not that the literal fallback applies.
      //
      // TEST DESIGN — OPTION A (behavioral fallback assertion via re-import):
      //   1. Save original SOC_DEMO_SECRET (set by setup.ts L12 to
      //      'test-secret-do-not-use')
      //   2. delete process.env.SOC_DEMO_SECRET (vi.stubEnv can't unset;
      //      direct delete is the only way to make `??` see undefined)
      //   3. vi.resetModules() + dynamic import — re-evaluates the module
      //      with new env, picking up the fallback path
      //   4. Call createSession(user, metadata) — exercises signPayload
      //      internally via encodeToken
      //   5. Token format per source L426: `${payloadBase64}.${signature}`
      //   6. Externally compute HMAC with literal 'soc-demo-secret' over
      //      the same payloadBase64
      //   7. Assert externally-computed sig == module's sig → PROVES the
      //      module defaulted to 'soc-demo-secret' literal
      //   8. finally block: restore env via vi.stubEnv to setup.ts default
      //      + vi.resetModules to wipe the test's loaded module so
      //      subsequent test files re-import fresh
      //
      // REJECTED ALTERNATIVE (OPTION B): forge token externally → submit
      // via getSessionByToken → expect session reconstruction. Rejected —
      // requires deeper module-internal knowledge (revokedTokens Set
      // semantics, expiresAt validation, payload schema), more brittle.
      // OPTION A's direct sig comparison is cleaner and probes the same
      // gap with less surface area.
      //
      // REJECTED ALTERNATIVE (text-source assertion): readFileSync the
      // module source, regex-match the literal `'soc-demo-secret'`.
      // Rejected — brittle to formatting changes (single vs double quote,
      // `??` vs `||`, whitespace), doesn't probe behavior. OPTION A
      // catches both literal-string regressions AND fallback-mechanism
      // regressions in one assertion.

      // Save the env stub setup.ts placed (vi.stubEnv-tracked value)
      const original = process.env.SOC_DEMO_SECRET

      // Direct delete — vi.stubEnv cannot set undefined; the `??` operator
      // requires actual undefined to trigger the fallback path
      delete process.env.SOC_DEMO_SECRET

      try {
        // Re-evaluate the memory store with fresh env (MEMORY_SECRET is
        // computed at module-import time; existing import has the old value)
        vi.resetModules()
        const memoryStore = await import('@/lib/soc-store-memory')

        // SessionUser shape per soc-types.ts L11-23
        const user = {
          id: 999,
          username: 'forge-test',
          displayName: 'Forge Test',
          role: 'viewer' as const,
          emailVerified: true,
        }
        const metadata = { ipAddress: null, userAgent: null }

        // Exercise signPayload via createSession (the public surface that
        // produces a signed token). Token format per source L426:
        // `${payloadBase64}.${signature}`
        const session = await memoryStore.createSession(user, metadata)

        const dotIdx = session.token.lastIndexOf('.')
        expect(dotIdx).toBeGreaterThan(0)
        const payloadBase64 = session.token.substring(0, dotIdx)
        const actualSig = session.token.substring(dotIdx + 1)

        // Externally compute the HMAC using the literal 'soc-demo-secret'
        // — exactly what an attacker would do given source-code access
        const expectedSig = createHmac('sha256', 'soc-demo-secret')
          .update(payloadBase64)
          .digest('base64url')

        // PROOF: when SOC_DEMO_SECRET is unset, MEMORY_SECRET defaults to
        // the literal 'soc-demo-secret' — the externally-computed signature
        // matches the module's signature exactly. R-20 vector confirmed.
        expect(actualSig).toBe(expectedSig)
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
