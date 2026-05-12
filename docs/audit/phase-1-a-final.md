# Phase 1.A — Security & Identity Audit (Final)

**Status:** Final · **Date:** 2026-05-09 · **Phase:** 1 of 5 · **Sub-stage:** A (Audit) · **Author:** Salim (with Claude review)

This document is the canonical Phase 1.A deliverable. It supersedes the agent-produced draft of 2026-05-09. All Phase 1.B/C/D work derives from this report. Risk IDs are stable; future phases may reference R-NN by number.

---

## 1. Roadmap Critique

The Phase 1 boundary "Security & Identity" is correct, with three adjustments confirmed during review:

**Adjustment A — `auth-client.ts` is Phase 4 territory.** Browser-only APIs (`window`, `localStorage`, focus events) require jsdom. Phase 1.A reads it for context but Phase 1.D produces zero test cases for it.

**Adjustment B — `email-templates.ts` was retroactively pulled into Phase 1.A.** Manual audit performed. Template injection via `displayName` is a real vector. Phase 1.D includes a new `email-templates.test.ts` file.

**Adjustment C — 3-store backend test strategy: adapter-boundary mock only.** Tests use `vi.mock('@/lib/soc-store-adapter')` to inject deterministic return values.

**MSW decision:** install in Phase 1.B for Phase 3 reuse, but Phase 1 mocking primarily uses `vi.mock` at module boundaries.

**Concurrency strategy:** Vitest runs files in parallel; rate-limiter tests use `__resetAllForTests()` in a global `afterEach` so state never leaks.

---

## 2. Risk Assessment

| ID | Severity | OWASP | File(s) | Risk | Exploit scenario |
|---|---|---|---|---|---|
| R-01 ✅ FIXED | High | A07 | client-ip.ts, rate-limiter.ts | x-forwarded-for trust granted via implicit `VERCEL===1 \|\| NODE_ENV==='production'` fallback in `trustProxy()` — every production deployment auto-trusted proxy headers without explicit opt-in. A-03 corrected the original "Vercel-specific" framing to "all-production scope." | Attacker sends `x-forwarded-for: 10.0.0.1` per request. Without explicit operator opt-in, the trust gate was implicitly open in all NODE_ENV=production deployments. First-token extraction returns spoofed value. Rotating per-request bypasses rate limit, enabling unlimited brute-force. **STATUS:** trust-gating sub-vector FIXED in commit `bb11ae6` (Phase 1.5.5) — `trustProxy()` now returns true ONLY when `TRUST_PROXY_HEADERS` env is explicitly set to `'1'` or `'true'`. Implicit `VERCEL=1` and `NODE_ENV=production` fallbacks removed. Fail-closed default per R-20 patterning. Vercel Production+Preview env confirmed set to `TRUST_PROXY_HEADERS=1` BEFORE this commit's deploy via Path X 3-commit deploy-safe ordering (Phase 1.5.5.0 documented the requirement in commit `3630057`). T-CI11a + T-CI12 flipped from gap-doc to regression guards. A-03 marked RESOLVED. **RESIDUAL LIMITATION:** chain-extraction sub-vector 2 remains — when operator opts in, first-token extraction of `x-forwarded-for` is still spoofable (attacker prepends their IP). T-CI04 + T-LG11 retain gap status documenting this. Closing requires upstream-proxy-IP allowlist or right-token chain-depth assumption — separate hardening cycle. |
| R-02 ⏳ DEFERRED | High | A04 | rate-limiter.ts | In-memory globalThis limiter is per-process; Vercel multi-instance multiplies effective budget by N | Parallel connections distributed across warm instances; each sees count ≤ max independently. Effective budget = N × configured max. **STATUS:** DEFERRED in Phase 1.5.6 (commit `4deb361`) — architectural cluster with R-19 + R-03; requires Supabase shared-state migration (new rate_limits table, latency budget analysis, failure-mode policy). Cluster analysis + exploitability matrix: see A-20 amendment. Will be revisited after R-03 closure (Phase 1.5.7) reframes shared-state architecture decisions. |
| R-03 ✅ FIXED | **Critical** | A05 | soc-store-adapter.ts | **CORRECTED SURFACE (A-10 RESOLVED):** original audit row framed R-03 as "Supabase outage → memory fallback (auth DoS + silent data loss)" — A-10 amendment (Phase 1.D.9) documented this framing as inaccurate. Actual exploit surface: sqlite store failure under production env (`NODE_ENV=production` auto-enables `allowCriticalMemoryFallback`) silently routes Class 3 operational writes (alerts, attack events) AND Class 2 JSON-domain writes (when `useSupabaseJsonDomains=false`: audit logs, reports, portfolio) to in-memory store. Class 1 identity ops route directly through Supabase with no fallback path in current production config — auth-DoS framing inapplicable. See A-21 amendment for canonical Class 1/2/3 routing reference. | Attack scenario (corrected): sqlite primary store fails → `withStore` silently routes to memory → write succeeds against volatile in-memory state → instance recycle loses data → no operator signal. **STATUS:** FIXED in commit `9e16fbe` (Phase 1.5.7) — Path γ implemented: `withStore` accepts `isWrite` option; when set AND fallback path is active, throws `MemoryFallbackBlockedError` instead of silently routing to memory. Class 3 writes (4 methods: `recordAttackEvent`, `createAlert`, `patchAlert`, `purgeOldAttackEvents`) and Class 2 writes (12 methods: `writeAuditLog`, `createReport`, `archiveReport`, `deleteReport`, `deleteUserCascade`, 7 portfolio writes) annotated `isWrite: true`. Class 1 unchanged. Reads remain permissive during fallback — degraded-availability mode preserved (dashboards, login lookups continue to function against memory-seeded state during sqlite outage). T-AD07 comment refreshed to document Path γ read-permissive contract; T-AD08 (write-block regression guard) + T-AD09 (read-allow regression guard) added. A-10 marked RESOLVED. A-21 new amendment captures Class 1/2/3 canonical routing analysis. A-20 cluster partial closure: R-03 closed via Path γ; R-19 reframes (fallback-conditional case now indirectly closed since writes blocked → no `revokedTokens` additions during fallback — recommend Phase 1.5.8 R-19 status revisit); R-02 standalone Phase 1.5.9+. |
| R-04 ✅ FIXED | High | A07 | login/route.ts, soc-store-memory.ts, soc-store-supabase.ts, soc-store-supabase-postgres.ts, soc-store.ts | `authenticateUser` returns null early when user not found; scrypt skipped → response time reveals account existence | Attacker times login responses. Known username: ~50ms (scrypt). Unknown: ~1ms. Username harvesting before password attack. **STATUS:** FIXED in commit `9b36288` (Phase 1.5.3) — `DUMMY_PASSWORD_HASH` (precomputed scrypt-derived constant in security.ts) forces the unknown-user branch through verifyPassword(input, DUMMY_PASSWORD_HASH) in all 4 store implementations, equalizing scrypt CPU cost. Surface scope corrected — audit originally listed memory + supabase only; postgres + sqlite stores carried the identical leak and are also fixed. T-S10/T-S11/T-S12 added to security.test.ts (T-S12 is the timing-parity regression guard, N=20 median, |delta| < max(20ms, 0.3 * avg)). T-LG12 retained as response-shape parity guard (separate route-level enumeration vector, not duplicative). A-18 appended documenting the surface expansion. |
| R-05 | Medium | A04 | register/route.ts | TOCTOU between `readUserByEmailKey` and `registerUser` | Two concurrent registrations with same email both pass uniqueness check. Storage layer race-guard claimed in comments but unverified. |
| R-06 | Medium | A09 | rate-limiter.ts, all auth routes | Rate-limit exhaustion emits no log, metric, or alert | 100k 429 responses per hour produce no operator signal. First visible signal = user complaint. |
| R-07 | Low | A02 | security.ts | scrypt N=16384 (Node default); OWASP recommends N≥32768 in 2024+ | DB compromise + offline GPU cracking 2× faster vs N=32768. Conditional on prior compromise. |
| R-08 | Low | A04 | rate-limiter.ts | `__resetAllForTests` exported from prod module without NODE_ENV guard | Supply-chain compromise with code execution can wipe rate-limit state. Requires existing compromise. |
| R-09 | Medium | A04 | identity-rules.ts | Reserved username list has only 3 entries (`ghost`, `analyst1`, `viewer1`) | User registers `admin` / `root` / `support`. Audit logs and report attribution display authoritatively. Social engineering trivial. **Severity escalated from Low based on likelihood.** |
| R-10 | Low | A04 | identity-validation.ts | `displayName` length-only check; Unicode unrestricted; homoglyph possible | User sets `displayName` to `аdmin` (Cyrillic а). Visually indistinguishable from admin in attribution. |
| R-11 | Low | A05 | reset/validate/route.ts | Unauthenticated token-validity oracle; no rate limit | Token leak via log/phishing → attacker probes validity at scale. Practical impact bounded by 256-bit entropy. |
| R-12 | Low | A08 | email.ts, forgot/route.ts | Email dispatch failures swallowed; no retry queue | Resend transient 503 → token persisted, email lost. User retries; second token issued. **Mitigated:** `setPasswordResetToken` is upsert (verified), so only one valid token at a time. |
| R-13 ✅ FIXED | High | A03 | email-templates.ts, identity-validation.ts | `displayName` HTML-escape missing in email templates; saldırgan-controlled HTML/script in rendered email body | User registers with `displayName: "<img src=x onerror=alert(1)>"`. Verification email body contains literal payload. Outlook desktop and many 3rd-party clients render. Self-XSS during own verify; broader stored-XSS risk if displayName surfaces in admin UI without escape (Phase 3 audit). **STATUS:** FIXED in commit `6d78cf1` (Phase 1.5.2) — defense-in-depth: validator denylist `/[<>&"]/` (identity-validation.ts) + template HTML escape via new src/lib/html-escape.ts (email-templates.ts). T-IV16/17 + T-ET04/05 flipped to regression guards (Type: Exploit → Regression). R-14 (CRLF) and R-15 (URL substrate) remain open — separate Phase 1.5.X fix cycles. |
| R-14 | Medium | A03 | email-templates.ts, identity-validation.ts | `displayName` CRLF injection into plain-text email body; phishing assist | `displayName: "Mehmet\r\n\r\n[siberlab security] hesabın askıya alındı: evil.com"`. Plain-text reader sees fake siberlab footer/instructions interleaved with legitimate content. |
| R-15 | Medium | A05 | email-templates.ts, register/forgot/verify-resend routes | `verifyUrl` / `resetUrl` substrate trust; env misconfig poisons every email | `NEXT_PUBLIC_APP_URL=javascript:alert(1)//` or Host header injection in dev → rendered `<a href="...">` becomes attacker-controlled. |
| R-16 | Low | A04 | middleware.ts | Logout endpoint in PUBLIC_API_ROUTES; CSRF-able logout possible | Attacker iframes/links to /api/auth/logout via cross-site form; victim's session terminated. Damage = nuisance only (no privilege gained). |
| R-17 | Medium | A09 | All auth routes via writeAuditLog | `writeAuditLog` failures swallowed silently; critical events (login, password_reset, account_delete) can be lost | Audit log write throws (DB/Storage outage). Catch swallows; security event vanishes from forensic record. No alarm. |
| R-18 | Medium | A04 | forgot/route.ts | Email-keyed rate limit (3/hour) lets attacker exhaust victim's reset budget if email known | Attacker spams /api/auth/forgot with victim's email. Limit hits 429. Victim's legitimate reset attempts blocked for 1h. |
| R-19 ✅ INAPPLICABLE | High | A07 | soc-store-memory.ts (createSession, deleteSession), production fallback path | Memory store sessions are HMAC-signed self-contained tokens; revoked-tokens Set is instance-bound; logout fails distributed | If R-03 fallback activates: user clicks logout → token added to one instance's revokedTokens. Next request hits different instance → token still valid. Logout effectively no-op across cluster. **STATUS:** INAPPLICABLE in Phase 1.5.8 (commit `43d5b0c`) — R-03 closure via Path γ (Phase 1.5.7 commit `9e16fbe`) eliminates R-19's conditional exploit path through two complementary mechanisms: (1) Current production config (Class 1 identity routing per A-21) uses `supabaseStore.deleteSession` directly via file deletion — distributed-coherent across all instances, R-19's "instance-bound `revokedTokens` Set" never activates in identity path; (2) Hypothetical legacy/dev fallback under `SOC_IDENTITY_STORE=disabled`: Path γ's `isWrite: true` on `deleteSession` now throws `MemoryFallbackBlockedError` instead of silently adding to per-instance Set. Logout fails fail-loud (operator-visible 503) rather than fails-silently-distributed. R-19's exploit narrative ("token still valid on different instance") cannot materialize because writes blocked entirely during fallback. Status `INAPPLICABLE` (not `FIXED`) preserves audit honesty — no R-19-specific code change was made in 1.5.8; the exploit path was closed indirectly by R-03's Path γ mechanism. Phase 1.5.6's deferral resolved via R-03 closure. See A-20 cluster amendment Resolution paragraph + A-21 Class 1/2/3 routing analysis. |
| R-20 ✅ FIXED | **Critical** | A02 | soc-store-memory.ts | `MEMORY_SECRET = process.env.SOC_DEMO_SECRET ?? 'soc-demo-secret'` — hardcoded HMAC fallback in prod fallback path | If `SOC_DEMO_SECRET` unset in prod env AND R-03 fallback active: tokens signed with public-knowable string. Attacker forges valid session for any uid. Full account takeover, no credentials needed. **STATUS:** FIXED in commit `7baacac` (Phase 1.5.1) — `??` fallback replaced with `throw` if env unset. T-SEC01 flipped to regression guard. R-03 + R-20 compound: R-20 leg now closed, R-03 leg pending Phase 1.5.5. |
| R-21 ✅ FIXED | Low | A02 | security.ts | Truncated `hashHex` stored in DB enables first-N-byte scrypt prefix match in `verifyPassword` — the length-mismatch guard inside the try-block is dead code because `scryptSync(password, salt, expected.length)` always returns exactly `expected.length` bytes, so the length comparison trivially passes when `expected` is truncated | Storage-compromised attacker writes truncated hash to user record; `verifyPassword` derives scrypt output to the truncated length, the dead-code length check passes, `timingSafeEqual` compares only truncated bytes. Any password whose first-N-byte scrypt output matches the truncated stored prefix authenticates. Precondition: storage write access (Low severity — vector parallels the obvious replace-hash attack, fix is preventive hardening against silent storage truncation regressions). **STATUS:** FIXED in commit `ed403df` (Phase 1.5.4) — defense-in-depth: `HASH_FORMAT_RE = /^[0-9a-f]{32}:[0-9a-f]{128}$/` module constant + `assertHashFormat` helper in `security.ts`. Write-time guard: `hashPassword` self-validates its output before return (single chokepoint, Option β). Read-time guard: `verifyPassword` calls `assertHashFormat(storedHash)` as first action inside try-block — assertion throw caught → returns false (silent reject, no enumeration signal). T-S09 corrected from prior R-07 mislabel (test body always probed R-21, not scrypt cost parameter) and flipped from `.toBe(true)` gap-documenting to `.toBe(false)` regression guard. T-S13 added (write-time conformance + multi-shape read-time probes). A-02 amendment marked RESOLVED. DUMMY_PASSWORD_HASH (R-04 fix) format compatible — preserved without regen. |

---

## 3. Infrastructure Gap Analysis

| Gap | Why it matters | Proposed fix (prose, no code) |
|---|---|---|
| No setupFiles configured | No mechanism for env overrides; rate-limiter tests have no guaranteed cleanup hook | Add `src/test/setup.ts` registered under `setupFiles`. Set test env vars (`SOC_STORAGE=memory`, `SOC_IDENTITY_STORE=disabled`, `RESEND_API_KEY=test`, `TRUST_PROXY_HEADERS=0`, `SOC_DEMO_SECRET=test-secret-do-not-use`); call `__resetAllForTests()` in global `afterEach`. |
| No coverage provider | npm run test produces no coverage; no enforceable gate | Add coverage block: provider v8, include `src/**/*.ts`, exclude tests + `src/test/**`. Graduated thresholds: Phase 1 end → 50%; Phase 3 end → 70%; Phase 5 end → 80%. |
| `@vitest/coverage-v8` not installed | Coverage command errors without provider package | Add to devDependencies. |
| `msw` not installed | Phase 1.B decision is to install; Phase 1.C handles Resend interception | Add `msw` to devDependencies; setup file registers `server.listen({ onUnhandledRequest: 'error' })` in beforeAll, `resetHandlers()` in afterEach, `close()` in afterAll. |
| No per-test env isolation | Direct `process.env.X = value` leaks between files | Use `vi.stubEnv()` exclusively; rely on `restoreMocks: true` (already configured). |
| Pool isolation for global state | rate-limiter `globalThis` state shared across files in same worker | Rely on `__resetAllForTests()` in global `afterEach`. Sufficient for Phase 1. |
| MSW lifecycle hooks needed | Without lifecycle hooks, request interception leaks between suites | Setup file: server.listen / resetHandlers / close. Above. |
| auth-client.ts environment mismatch | window/localStorage throw in Node | Excluded from Phase 1.D scope. Phase 4.B switches to happy-dom. |
| `@testing-library/*` not installed | Phase 4 needs react testing library | Document only; defer to Phase 4.B. |
| No split CI workflow | Single vitest run grows linearly | Defer to Phase 3.B: add `test:unit` and `test:routes` scripts. |

---

## 4. MSW Interception Map

Phase 1 strategy: mock `@/lib/soc-store-adapter` and `@/lib/email` at module boundary via `vi.mock`. MSW required only for Resend HTTP interception in tests that exercise `email.ts` directly (rare in Phase 1).

| Endpoint | Caller | Default mock | Override variants |
|---|---|---|---|
| `POST https://api.resend.com/emails` | email.ts → Resend SDK | `200 { data: { id: 'test-email-id' }, error: null }` | (a) network error; (b) 401 invalid key; (c) 500 server error; (d) 200 with error field set; (e) 200 missing data.id; (f) 3s delayed response |
| Supabase REST `/rest/v1/...` | soc-store-supabase.ts via adapter | Not in Phase 1 | Defer to Phase 3.C |
| Supabase Postgres pool | soc-store-supabase-postgres.ts via adapter | Not in Phase 1 | Defer to Phase 3.C |
| SQLite file I/O | soc-store.ts via adapter | Not in Phase 1 | Defer to Phase 3.C |

---

## 5. Definition of Done — Test Case List

Tests are colocated as `*.test.ts` next to the unit, except route tests which colocate in `route.test.ts` next to `route.ts`. Email-templates and middleware get dedicated test files.

### security.ts (security.test.ts)

| ID | Type | Scenario | Maps to |
|---|---|---|---|
| T-S01 | Happy | hashPassword returns `salt:hash` with 32-char salt hex | — |
| T-S02 | Happy | verifyPassword true for correct password | — |
| T-S03 | Edge | verifyPassword false for wrong password | — |
| T-S04 | Edge | verifyPassword false for empty stored hash | — |
| T-S05 | Edge | verifyPassword false for hash without `:` | — |
| T-S06 | Edge | verifyPassword false for non-hex salt | — |
| T-S07 | Edge | verifyPassword false for empty password | — |
| T-S08 | Edge | Two hashes of same password produce different salts | — |
| T-S09 | Regression | verifyPassword rejects truncated hashHex (R-21 read-time regression guard; corrected from prior R-07 mislabel — test body always probed R-21's truncation vector, not scrypt cost parameter) | R-21 ✅ FIXED |
| T-S10 | Regression | DUMMY_PASSWORD_HASH is a parseable salt:hash hex pair (R-04 timing-equalization constant shape probe — invariant requires `/^[0-9a-f]{32}:[0-9a-f]{128}$/` so verifyPassword's parse-step short-circuit never bypasses scrypt on the dummy path) | R-04 ✅ FIXED |
| T-S11 | Regression | verifyPassword against DUMMY_PASSWORD_HASH returns false for arbitrary attacker input (timing equalization without authentication backdoor; deliberately omits sentinel probe per benign-by-construction note) | R-04 ✅ FIXED |
| T-S12 | Regression | verifyPassword timing parity — DUMMY_PASSWORD_HASH ≈ real hash (R-04 timing-attack regression guard; N=20 median per arm, threshold max(20ms, 0.3*avg) for CI stability) | R-04 ✅ FIXED |
| T-S13 | Regression | hashPassword output conforms to HASH_FORMAT_RE (write-time invariant); verifyPassword rejects multiple malformed storedHash shapes (read-time invariant, multi-class) | R-21 ✅ FIXED |

### rate-limiter.ts

| ID | Type | Scenario | Maps to |
|---|---|---|---|
| T-R01 | Happy | First request: not limited, remaining = max | — |
| T-R02 | Edge | After max recordFailure: limited=true | — |
| T-R03 | Edge | After window expiry (vi.advanceTimersByTime): not limited | — |
| T-R04 | Happy | clearAttempts resets counter | — |
| T-R05 | Edge | Different bucket names independent | — |
| T-R06 | Edge | Different keys in same bucket independent | — |
| T-R07 | Edge | recordFailure decreasing remaining | — |
| T-R08 | Edge | checkRateLimit idempotent (no increment) | — |
| T-R09 | Exploit | __resetAllForTests clears all buckets (documents reachability) | R-08 |

### identity-validation.ts

| ID | Type | Scenario | Maps to |
|---|---|---|---|
| T-IV01 | Edge | Username 3 chars valid | — |
| T-IV02 | Edge | Username 32 chars valid | — |
| T-IV03 | Edge | Username 2 chars invalid | — |
| T-IV04 | Edge | Username 33 chars invalid | — |
| T-IV05 | Edge | Username with Unicode rejected | R-10 |
| T-IV06 | Edge | Username `a..b` consecutive dots accepted (gap) | R-09 |
| T-IV07 | Happy | validateEmail trims + lowercases | — |
| T-IV08 | Edge | Email > 254 chars invalid | — |
| T-IV09 | Edge | Email no TLD invalid | — |
| T-IV10 | Edge | Password 8 chars valid | — |
| T-IV11 | Edge | Password 256 chars valid | — |
| T-IV12 | Edge | Password 7 chars invalid | — |
| T-IV13 | Edge | Password 257 chars invalid | — |
| T-IV14 | Edge | displayName Cyrillic accepted (homoglyph gap) | R-10 |
| T-IV15 | Edge | displayName 2/120 valid; 121 invalid | — |
| T-IV16 | Regression | displayName `<script>...` rejected by denylist `/[<>&"]/` (regression guard for R-13 fix in `6d78cf1`) | R-13 |
| T-IV17 | Regression | displayName `<img src=x onerror=alert(1)>` rejected by denylist (R-13 fix in `6d78cf1`) | R-13 |
| T-IV18 | Exploit | displayName containing `\n` accepted (gap) | R-14 |
| T-IV19 | Exploit | displayName `Foo\r\nBar` accepted (gap) | R-14 |

### identity-rules.ts

| ID | Type | Scenario | Maps to |
|---|---|---|---|
| T-IR01 | Happy | `ghost` reserved | — |
| T-IR02 | Edge | `GHOST` (case) reserved | R-09 |
| T-IR03 | Edge | ` ghost ` (whitespace) reserved | R-09 |
| T-IR04 | Exploit | `admin` NOT reserved (regression guard) | R-09 |
| T-IR05 | Exploit | `root` NOT reserved | R-09 |
| T-IR06 | Exploit | `support` NOT reserved | R-09 |
| T-IR07 | Happy | `regularuser` not reserved | — |

### client-ip.ts

| ID | Type | Scenario | Maps to |
|---|---|---|---|
| T-CI01 | Happy | TRUST_PROXY_HEADERS=0: x-forwarded-for ignored | — |
| T-CI02 | Happy | TRUST_PROXY_HEADERS=1: valid x-forwarded-for returned | — |
| T-CI03 | Edge | Chain `1.2.3.4, 5.6.7.8` returns first token | R-01 |
| T-CI04 | Exploit | Attacker-set x-forwarded-for: 9.9.9.9 returned (rate-limit spoof vector) | R-01 |
| T-CI05 | Edge | Invalid x-forwarded-for falls through to x-real-ip | — |
| T-CI06 | Edge | x-forwarded-for absent; valid x-real-ip returned | — |
| T-CI07 | Happy | Both headers absent (trustProxy=false): falls to request.ip | — |
| T-CI08 | Edge | All sources absent/invalid: returns 'unknown' | — |
| T-CI09 | Edge | Valid IPv6 accepted | — |
| T-CI10 | Edge | Malformed IPv4 (octet > 255) rejected | — |
| T-CI11 | Regression | NODE_ENV=production, VERCEL unset, flag unset → trustProxy=false (R-01 trust-gating regression guard; T-CI11a flipped from gap-doc to regression in Phase 1.5.5; A-03 closure) | R-01 ✅ FIXED |
| T-CI12 | Regression | VERCEL=1, flag unset → trustProxy=false (Vercel deploy now requires explicit TRUST_PROXY_HEADERS=1; R-01 trust-gating regression guard) | R-01 ✅ FIXED |

### auth-shared.ts

| ID | Type | Scenario | Maps to |
|---|---|---|---|
| T-AS01–05 | Happy | hasRoleAtLeast hierarchy (5 cases) | — |
| T-AS06 | Happy | canWriteAlerts(admin)=true | — |
| T-AS07 | Happy | canWriteAlerts(analyst)=true | — |
| T-AS08 | Happy | canWriteAlerts(viewer)=false | — |

### email-templates.ts (email-templates.test.ts)

| ID | Type | Scenario | Maps to |
|---|---|---|---|
| T-ET01 | Happy | renderVerificationEmail returns subject/html/text containing username + verifyUrl | — |
| T-ET02 | Happy | renderPasswordResetEmail same | — |
| T-ET03 | Edge | username '' → fallback 'Operator' | — |
| T-ET04 | Regression | username `<img src=x onerror=alert(1)>` HTML-escaped to `&lt;img src=x onerror=alert(1)&gt;` in verification HTML (regression guard for R-13 fix in `6d78cf1`) | R-13 |
| T-ET05 | Regression | same for renderPasswordResetEmail (R-13 fix in `6d78cf1`) | R-13 |
| T-ET06 | Exploit | username `Foo\r\nBar` produces 2 lines in plain text (gap) | R-14 |
| T-ET07 | Exploit | verifyUrl `javascript:alert(1)` rendered as href (gap) | R-15 |

### middleware.ts (middleware.test.ts)

| ID | Type | Scenario | Maps to |
|---|---|---|---|
| T-MW01 | Happy | POST mutation with matching Origin + session: passes | — |
| T-MW02 | Edge | Mismatched Origin: 403 | — |
| T-MW03 | Exploit | No Origin and no Referer on POST: 403 | — |
| T-MW04 | Edge | Valid Origin, no session cookie on protected route: 401 | — |
| T-MW05 | Happy | POST /api/auth/login (public): passes without cookie | — |
| T-MW06 | Happy | POST /api/auth/logout (public): passes | R-16 |
| T-MW07 | Happy | GET /api/auth/session: bypasses both gates | — |
| T-MW08 | Edge | POST with Referer matching host (no Origin): passes CSRF | — |
| T-MW09 | Edge | POST with malformed Origin: 403 | — |
| T-MW10 | Happy | DELETE with valid Origin + cookie: passes | — |
| T-MW11 | Happy | GET /home: passes, x-pathname header set | — |

### Auth routes (each in route.test.ts colocated)

**register/route.ts**

| ID | Type | Scenario | Maps to |
|---|---|---|---|
| T-RG01 | Happy | All valid fields → 200, no warning | — |
| T-RG02 | Edge | Missing field → 400 | — |
| T-RG03 | Edge | Duplicate active email → 409 | — |
| T-RG04 | Edge | Reserved username → 400 | — |
| T-RG05 | Edge | Invalid username format → 400 | — |
| T-RG06 | Edge | Weak password (7 chars) → 400 before scrypt | — |
| T-RG07 | Edge | Password mismatch → 400 | — |
| T-RG08 | Edge | Invalid email → 400 | — |
| T-RG09 | Exploit | 11th POST same IP → 429 with Retry-After | R-01, R-02 |
| T-RG10 | Edge | Email send failure → 200 with warning | — |
| T-RG11 | Edge | Store throws 'User already exists' → 409 | — |
| T-RG12 | Edge | Store throws 'Email already exists' → 409 | — |
| T-RG13 | Edge | Store throws unexpected → 503 | — |

**login/route.ts**

| ID | Type | Scenario | Maps to |
|---|---|---|---|
| T-LG01 | Happy | Correct creds → 200, cookie set, audit logged | — |
| T-LG02 | Edge | Wrong password → 401, recordFailure called | — |
| T-LG03 | Edge | Correct creds, emailVerified=false → 403 EMAIL_NOT_VERIFIED, clearAttempts called | — |
| T-LG04 | Exploit | 11th failed attempt → 429 with Retry-After | R-01, R-02 |
| T-LG05 | Happy | Successful login clears rate-limit counter | — |
| T-LG06 | Edge | Username > 64 → 400 before authenticateUser | — |
| T-LG07 | Edge | Password > 256 → 400 | — |
| T-LG08 | Edge | remember=false → cookie has no maxAge | — |
| T-LG09 | Edge | Store throws → 503; debug hint absent in prod | — |
| T-LG10 | Edge | Missing username/password → 400 | — |
| T-LG11 | Exploit | x-forwarded-for spoof bypasses rate limit | R-01 |
| T-LG12 | Regression | Unknown username and wrong password produce identical response shape (route-level R-04 enumeration guard; library-level timing parity covered by T-S10/T-S11/T-S12 in security.test.ts) | R-04 ✅ FIXED |

**logout/route.ts**

| ID | Type | Scenario | Maps to |
|---|---|---|---|
| T-LO01 | Happy | Cookie present → session deleted, audit logged, cookie cleared | — |
| T-LO02 | Edge | No cookie → 200 idempotent | — |
| T-LO03 | Edge | Cookie present but already-expired session → 200 | — |
| T-LO04 | Edge | deleteSession throws → swallowed, 200 returned | R-17 |
| T-LO05 | Happy | Cookie maxAge=0 in Set-Cookie | — |
| T-LO06 | Regression | Logout route honors deleteSession revocation contract (route-level invariant — calls deleteSession with present cookie token; multi-instance distributed-logout gap from R-19 now INAPPLICABLE per Path γ — see commit `43d5b0c` for R-19 reframing context; A-21 Class 1/2/3 routing analysis explains why fallback case no longer materializes the gap) | R-19 ✅ INAPPLICABLE |

**session/route.ts**

| ID | Type | Scenario | Maps to |
|---|---|---|---|
| T-SS01 | Happy | Valid cookie → 200 authenticated:true | — |
| T-SS02 | Edge | No cookie → 200 authenticated:false | — |
| T-SS03 | Edge | Cookie present but store returns null → 200 authenticated:false | — |

**verify/route.ts**

| ID | Type | Scenario | Maps to |
|---|---|---|---|
| T-VF01 | Happy | Valid token → 200, emailVerified:true | — |
| T-VF02 | Edge | No token → 400 TOKEN_INVALID | — |
| T-VF03 | Edge | Token not in store → 400 TOKEN_INVALID | — |
| T-VF04 | Edge | expiresAt missing → 400 TOKEN_INVALID | — |
| T-VF05 | Edge | Expired → 400 TOKEN_EXPIRED | — |
| T-VF06 | Edge | setEmailVerified returns null → 500 INTERNAL | — |
| T-VF07 | Exploit | Already-consumed token → 400 (single-use guard) | — |

**verify/resend/route.ts**

| ID | Type | Scenario | Maps to |
|---|---|---|---|
| T-VR01 | Happy | Valid unverified email → 200 generic | — |
| T-VR02 | Edge | Unknown email → 200 generic (anti-enumeration) | — |
| T-VR03 | Exploit | Already-verified email → 200 generic | — |
| T-VR04 | Exploit | 4th attempt same email → 429 | R-02, R-18 |
| T-VR05 | Edge | Invalid format → 400 INVALID_EMAIL | — |
| T-VR06 | Edge | Email send failure → 200 generic | R-12 |
| T-VR07 | Edge | Disabled user → 200 generic, no token set | — |

**forgot/route.ts**

| ID | Type | Scenario | Maps to |
|---|---|---|---|
| T-FG01 | Happy | Known verified active email → 200, token persisted, email dispatched | — |
| T-FG02 | Edge | Unknown email → 200 generic | — |
| T-FG03 | Edge | Unverified email → 200 generic | — |
| T-FG04 | Edge | Disabled user → 200 generic | — |
| T-FG05 | Exploit | 4th attempt same email → 429 | R-02 |
| T-FG06 | Edge | Invalid format → 400 INVALID_EMAIL | — |
| T-FG07 | Edge | Email send failure → 200 generic | R-12 |
| T-FG08 | Edge | setPasswordResetToken returns null → 200 generic | — |
| T-FG09 | Edge | Store throws → 200 generic (inner catch) | — |
| T-FG10 | Exploit | Email-keyed limit lets attacker exhaust victim's reset budget | R-18 |

**reset/route.ts**

| ID | Type | Scenario | Maps to |
|---|---|---|---|
| T-RS01 | Happy | Valid token + valid pw → 200, sessions deleted, audit logged | — |
| T-RS02 | Edge | Missing token → 400 TOKEN_INVALID | — |
| T-RS03 | Edge | Token > 256 chars → 400 TOKEN_INVALID | — |
| T-RS04 | Edge | Weak pw → 400 WEAK_PASSWORD, scrypt not called | — |
| T-RS05 | Edge | Token not in store → 400 | — |
| T-RS06 | Edge | Expired → 400 TOKEN_EXPIRED | — |
| T-RS07 | Edge | expiresAt missing → 400 TOKEN_INVALID | — |
| T-RS08 | Edge | consumePasswordResetToken returns null → 500 INTERNAL | — |
| T-RS09 | Exploit | 11th IP attempt → 429 | R-01, R-02 |
| T-RS10 | Happy | Success → deleteAllSessionsForUser called | — |
| T-RS11 | Exploit | Scrypt not invoked on weak-password path (DoS guard) | — |

**reset/validate/route.ts**

| ID | Type | Scenario | Maps to |
|---|---|---|---|
| T-RV01 | Happy | Valid → 200 valid:true | — |
| T-RV02 | Edge | Missing token → 200 valid:false reason:invalid | — |
| T-RV03 | Edge | Token not found → 200 invalid | — |
| T-RV04 | Edge | expiresAt missing → 200 invalid | — |
| T-RV05 | Edge | Expired → 200 expired | — |
| T-RV06 | Edge | Store throws → 200 invalid (safe fallback) | — |
| T-RV07 | Exploit | No rate limit (documents R-11) | R-11 |

### api-auth.ts

| ID | Type | Scenario | Maps to |
|---|---|---|---|
| T-AA01 | Happy | requireSession valid → {session, response:null} | — |
| T-AA02 | Edge | requireSession no session → 401 | — |
| T-AA03 | Happy | requireRole sufficient → passes | — |
| T-AA04 | Exploit | requireRole insufficient → 403 | — |
| T-AA05 | Edge | requireRole no session → 401 (auth before authz) | — |
| T-AA06 | Exploit | viewer cannot pass requireRole(analyst) | — |

### soc-store-adapter.ts (flag routing)

| ID | Type | Scenario | Maps to |
|---|---|---|---|
| T-AD01 | Happy | SOC_IDENTITY_STORE=supabase: delegates to supabaseStore | — |
| T-AD02 | Happy | SOC_IDENTITY_STORE=postgres + product_db enabled: delegates to postgres store | — |
| T-AD03 | Edge | SOC_IDENTITY_STORE=disabled: falls through to withStore | — |
| T-AD04 | Edge | NODE_ENV=production, fallback flag unset → allowCriticalMemoryFallback=true (trigger evaluation; behavior under trigger now Path γ — writes blocked, reads permitted) | R-03 ✅ FIXED |
| T-AD05 | Happy | SOC_STORAGE=memory: uses memoryStore directly | — |
| T-AD06 | Edge | sqlite failure with allowMemoryFallback=true: falls back (read path; under Path γ a write would throw — see T-AD08) | R-03 ✅ FIXED |
| T-AD07 | Regression | Production + sqlite outage → memory fallback for read (Path γ read-permissive contract; legacy/dev path under SOC_IDENTITY_STORE=disabled; identity ops in current production config exempt because they bypass withStore entirely — see A-21 routing reference) | R-03 ✅ FIXED |
| T-AD08 | Regression | Production + sqlite outage + Class 3 write → MemoryFallbackBlockedError throws (Path γ write-block regression guard; alerts/attack events cannot silently land in volatile memory state) | R-03 ✅ FIXED |
| T-AD09 | Regression | Production + sqlite outage + Class 3 read → memory fallback succeeds (Path γ read-permissive regression guard; pairs with T-AD08 to document read/write asymmetry under fallback) | R-03 ✅ FIXED |

### Cross-cutting / regression-guard tests

| ID | Type | Scenario | Maps to |
|---|---|---|---|
| T-SEC01 | Regression | SOC_DEMO_SECRET unset → soc-store-memory throws at import-time (regression guard for R-20 fix in 7baacac) | R-20 |
| T-AL01 | Edge | writeAuditLog throw → caught silently, route still returns success (documents R-17 gap) | R-17 |

---

## 6. Open Questions — Resolved

All questions from the agent's draft are answered below; no human-pending items remain for Phase 1.B.

1. **`authenticateUser` timing:** Both memory and supabase implementations early-return on missing user; scrypt is skipped. R-04 confirmed High. T-LG12 added.
2. **`setPasswordResetToken` upsert vs append:** Supabase implementation is upsert (writes whole user object); only one token active per user. R-12 mitigated.
3. **`consumePasswordResetToken` atomicity:** Single `writeUser` call writes new password hash and clears token in one Storage upload. Atomicity at object-write level. Acceptable.
4. **auth-client.ts placement:** Phase 4. Excluded from Phase 1.D.
5. **MSW vs vi.mock:** Install MSW in Phase 1.B for Phase 3 reuse; primary Phase 1 mocking is `vi.mock` at module boundaries; MSW used only for Resend interception when needed.
6. **forgot DoS (R-18):** Added to risk register as Medium. Not blocked from Phase 1 — fix proposal: combined IP+email rate-limit, defer to Phase 1.5 hardening or Phase 3.
7. **email-templates.ts:** Pulled into Phase 1.A scope. R-13/R-14/R-15 added.

---

## 7. Phase 1.B Inputs

For Phase 1.B (infrastructure setup) the following are confirmed deliverables:

- Update `vitest.config.ts` with setupFiles + coverage block + thresholds
- Create `src/test/setup.ts` with env stubs, MSW lifecycle, rate-limiter reset
- Create `src/test/msw/handlers/resend.ts` with default + override handlers
- Create `src/test/msw/server.ts` exporting setup-server instance
- Add devDependencies: `msw`, `@vitest/coverage-v8`
- Coverage threshold for Phase 1 end: 50% statements/branches/functions/lines on covered files

Phase 1.C creates Resend MSW handler variants. Phase 1.D writes test cases per Section 5 list (~140 cases total).

---

**STOP CHECKPOINT — Phase 1.A COMPLETE.**

Do not proceed to Phase 1.B until Salim explicitly approves this report and gives "Go for Phase 1.B" instruction.
