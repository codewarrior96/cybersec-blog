# Phase 1.A — Pending Amendments

Pending audit revisions discovered during Phase 1.D test writing. To be applied in next audit revision turn.

## Status: pending review by Salim

## Items

### A-01 — T-IR02/T-IR03 mapping correction  [RESOLVED in Wave 1 housekeeping]
- **Discovered in:** Phase 1.D.4 (identity-rules.test.ts)
- **Issue:** Audit Section 5 → identity-rules.ts table maps T-IR02 (case) and T-IR03 (whitespace) to R-09. This is incorrect — `normalizeIdentityUsername` already applies `trim().toLowerCase()` before Set lookup, so case+whitespace variants ARE detected. These are happy-path tests, not gap tests.
- **Action:** Update Section 5 → identity-rules.ts table → T-IR02 and T-IR03 rows → "Maps to" column → `—` (empty).
- **Resolution (Wave 1 housekeeping commit `7032a17`):** Section 5 identity-rules.ts table "Maps to" column corrected for T-IR02 and T-IR03 entries (set to `—`; rules are evaluated transitively via T-IV* tests on identity-validation.ts consumers, NOT directly mapped to R-09). Type column already correctly labels them as "Edge" tests, not exploit / gap.

### A-02 — R-21 new risk: truncated hash storage attack  [RESOLVED in Phase 1.5.4]
- **Discovered in:** Phase 1.D.1 (security.test.ts T-S09)
- **Issue:** While documenting the L19 dead-code gap, agent identified a real exploit: an attacker with storage write access can write a truncated hashHex to any user's record. verifyPassword then accepts any password whose first-N-byte scrypt output matches the truncated stored prefix. Requires prior storage compromise, not a remote vector.
- **Severity:** Low (requires storage write access)
- **OWASP:** A02 Cryptographic Failures
- **File(s):** security.ts (downstream of L19 dead code)
- **Related test:** T-S09 currently documents the L19 dead-code gap. R-21 is downstream of that gap.
- **Action:** Add R-21 to Section 2 risk register. Currently tested by T-S09 indirectly — consider whether a separate explicit T-S10 test is needed (e.g. write truncated hash directly to mock store, attempt login with arbitrary password, verify acceptance).
- **Resolution:** Phase 1.5.4 commit `ed403df` — R-21 added to Section 2 risk register with `✅ FIXED` status from inception (satisfying the original "add to Section 2" action and the fix closure in one commit). Two-layer integrity guard implemented in `src/lib/security.ts`: `HASH_FORMAT_RE = /^[0-9a-f]{32}:[0-9a-f]{128}$/` module constant + `assertHashFormat` helper. `hashPassword` self-validates output before return (write-time, Option β single chokepoint); `verifyPassword` invokes `assertHashFormat(storedHash)` as first action inside try-block, with throw caught → returns false (read-time silent reject). T-S09 corrected from prior R-07 mislabel (Section 5 mapping R-07 → R-21; body flipped from `.toBe(true)` gap-doc to `.toBe(false)` regression guard); T-S13 added as explicit write-time conformance + multi-shape read-time probe. R-04's DUMMY_PASSWORD_HASH format compatible with new invariant — preserved without regen. Test count: 199 → 200 (+1 T-S13). A-02 retained for audit trail (not deleted) — pattern: any amendment resolved by a fix cycle gets RESOLVED marker + Resolution paragraph cross-reference to the commit.

### A-03 — R-01 scope correction (Vercel-specific → all production)  [RESOLVED in Phase 1.5.5]
- **Discovered in:** Phase 1.D.5 (client-ip.test.ts T-CI11a)
- **Issue:** Audit R-01 description focuses on "Vercel multi-instance dispatch." Actual code at client-ip.ts L24: `return process.env.VERCEL === '1' || process.env.NODE_ENV === 'production'`. NODE_ENV=production alone triggers trustProxy=true. R-01 affects every production deployment (AWS, DigitalOcean, VPS, bare-metal, self-hosted), not just Vercel.
- **Action:** Update Section 2 → R-01 row → File(s) and Risk columns to reflect broader scope. Consider whether severity should escalate to Critical given the wider attack surface.
- **Resolution:** Phase 1.5.5 commit `bb11ae6` — A-03's scope-broadening concern resolved in the same commit as the R-01 trust-gating fix. `trustProxy()` refactored to require explicit `TRUST_PROXY_HEADERS=1` opt-in; both the implicit `VERCEL=1` and `NODE_ENV=production` fallbacks removed. R-01 Section 2 row updated to reflect the all-production scope + ✅ FIXED status. Severity-escalation question (Critical?) is now moot — the fix closes the broader scope directly. R-01 remains at High severity for the documented opt-in-with-known-limitation case (residual sub-vector 2: chain extraction returns spoofable first-token even when operator opts in; T-CI04 + T-LG11 retain gap status). Path X 3-commit deploy-safe ordering used to mitigate R-20-deploy-fail-risk pattern — Phase 1.5.5.0 (commit `3630057`) documented `TRUST_PROXY_HEADERS` in `.env.example` + `CLAUDE.md`, operator set the env in Vercel Production+Preview, then this fix landed.

### A-04 — Test count update for client-ip.test.ts  [RESOLVED in Phase 1.5.12]
- **Discovered in:** Phase 1.D.5
- **Issue:** Audit Section 5 → client-ip.ts table lists T-CI11 as single test. Phase 1.D.5 split it into T-CI11a (production gap, R-01 broader scope) and T-CI11b (safe baseline). File now has 13 tests, not 12.
- **Action:** Update Section 5 → client-ip.ts table to add T-CI11a and T-CI11b rows. Update Section 1 / Section 7 if test counts referenced.
- **Resolution:** Phase 1.5.12 commit `61e8492` — Section 5 `client-ip.ts` table T-CI11 row split into T-CI11a + T-CI11b distinct rows, each mapped to the corresponding `it()` block at `src/lib/client-ip.test.ts` L110 (T-CI11a — production gap regression guard) and L148 (T-CI11b — non-prod safe baseline). Both rows retain `R-01 ✅ FIXED` mapping (R-01 closed in Phase 1.5.5 `bb11ae6`); the split is audit-doc consistency hygiene only — no code/test logic change. Section 1 / Section 7 test count references were not affected (those reference vitest totals which already reflect both T-CI11a and T-CI11b).

### A-05 — T-IV06 consecutive dots gap (R-09 broader)  [RESOLVED in Wave 1 housekeeping]
- **Discovered in:** Phase 1.D.3 (identity-validation.test.ts)
- **Issue:** USERNAME_RE = /^[a-zA-Z0-9_.-]{3,32}$/ has no constraint against consecutive dots. `a..b` is accepted. Audit had T-IV06 as gap test mapped to R-09, but R-09's narrative focused on reserved-list completeness. Consecutive dots are a separate vector under the same risk category — confusion in audit logs, conflicts with filesystem/DNS conventions if usernames are ever used as path segments.
- **Action:** Update Section 2 → R-09 row → Risk column to mention consecutive-dot acceptance as a sub-vector. No new R-NN needed; R-09 broadens.
- **Resolution (Wave 1 housekeeping commit `7032a17`):** Section 2 R-09 row "Risk" column expanded to note consecutive-dots gap is broader than T-IV06 single-case captures (general repeat-character semantics in local-part of username regex). No new R-NN; R-09 broadens. T-IV06 retained as the gap-test for the specific `..` case.

### A-06 — API name correction: isAllowedUsername (not isValidUsername)  [RESOLVED in Wave 1 housekeeping]
- **Discovered in:** Phase 1.D.3 (identity-validation.test.ts)
- **Issue:** Audit Section 5 → identity-validation.ts sub-section refers to `isValidUsername`. Actual export is `isAllowedUsername`. Other API names are correct (isValidPassword, isValidDisplayName, isValidEmail, validateEmail).
- **Action:** Update Section 5 → identity-validation.ts narrative wherever `isValidUsername` appears → replace with `isAllowedUsername`.
- **Resolution (Wave 1 housekeeping commit `7032a17`):** Audit-completeness verification confirmed no `isValidUsername` references remain in `docs/audit/phase-1-a-final.md` (likely corrected during a prior Phase 1.5.X cycle without explicit marker flip). Marker flipped Wave 1 per amendment-register completeness.

### A-07 — Phase 1.D.6 prompt drift  [ACKNOWLEDGED — informational, no audit error]

- **Discovered in:** Phase 1.D.6 plan review
- **Issue:** Phase 1.D.6 prompt drafted by mentor used assumed function names (roleAtLeast, canEdit, canDelete, getRoleHierarchy) that did not match audit Section 5 (which correctly specifies hasRoleAtLeast and canWriteAlerts, matching actual source). Agent caught the drift during plan phase.
- **Action:** NO audit change needed — audit is correct. Entry documents prompt drift for future mentor-prompt hygiene. Lesson: re-read audit Section 5 verbatim when drafting sub-stage prompts.
- **Status (Wave 1 housekeeping):** Prompt-drift record acknowledged. No audit content change needed. Pattern note for Phase 5.A+: sub-stage prompt protocol explicitly states A→B→C→D discipline; future audit-doc may cross-reference CLAUDE.md L175 narrative. NO CLAUDE.md edit this cycle (Wave 1 audit-doc-only scope).

### A-08 — auth-shared T-AS09 defensive default test (added in Phase 1.D.6)  [RESOLVED in Wave 1 housekeeping]

- **Discovered in:** Phase 1.D.6 plan review (agent observation)
- **Issue:** hasRoleAtLeast(unknownRole, validRequired) returns false because ROLE_ORDER.indexOf(unknownRole) === -1, and -1 >= validIndex is false. This is correct OWASP A01-aligned defense-in-depth behavior but not in original audit Section 5.
- **Test added:** T-AS09 (file: src/lib/auth-shared.test.ts).
- **Action:** Next audit revision — update Section 5 → auth-shared.ts table to include T-AS09. Update Section 1/7 references from 8 to 9.
- **Resolution (Wave 1 housekeeping commit `7032a17`):** Section 5 auth-shared.ts table now includes T-AS09 entry (defensive default: hasRoleAtLeast(unknownRole, validRequired) returns false per ROLE_ORDER.indexOf === -1 fall-through). Test already present in `src/lib/auth-shared.test.ts` (Phase 1.D.6 commit); audit row was the lagging artifact.

### A-09 — Phase 1.D.7 prompt drift (third occurrence)  [ACKNOWLEDGED — informational, no audit error]

- **Discovered in:** Phase 1.D.7 plan review
- **Issue:** Mentor-drafted Phase 1.D.7 prompt drifted from audit Section 5 in three places: (1) param name `displayName` vs actual `username`, (2) R-15 attack model used `vi.stubEnv('NEXT_PUBLIC_APP_URL')` but module does not read this env — URL arrives as direct parameter, (3) T-ET07 prompt premise (trailing-slash handling) has no source-code surface — module performs raw URL interpolation only.
- **Action:** NO audit change needed — audit Section 5 is correct on all three counts. Entry documents third drift occurrence (after A-07 in Phase 1.D.6, and original prompt drift fixed in T-S09/T-IR02-03/T-CI11 audit corrections). Pattern is now systemic — recommend adding to CLAUDE.md a sub-stage prompt protocol: "When drafting sub-stage prompts, copy audit Section 5 row verbatim. Do not paraphrase from memory."
- **Status (Wave 1 housekeeping):** Prompt-drift record acknowledged (third occurrence). Same pattern as A-07. No audit content change needed. CLAUDE.md sub-stage prompt protocol note deferred to a focused CLAUDE.md edit cycle (not bundled in Wave 1 audit-doc-only scope).

### A-10 — T-AD07 audit prose drift (Supabase outage vs sqlite outage)  [RESOLVED in Phase 1.5.7]

- **Discovered in:** Phase 1.D.9 plan review
- **Issue:** Audit T-AD07 scenario states "Production + Supabase outage → memory fallback silent (full R-03 reproduction)", and R-03 narrative (Section 2) likewise frames the trigger as "Supabase outage." However, the actual source has NO supabase→memory fallback path — when `useSupabaseIdentityStore=true`, identity functions early-return `supabaseStore.X(...)` with no try/catch (e.g. soc-store-adapter.ts L101-103). A supabase failure propagates to the caller as a thrown error. The real R-03 vector is: production env (auto-enables `allowCriticalMemoryFallback`) + identity store mode set to anything OTHER than 'supabase' (or supabase app state disabled) + `SOC_STORAGE=sqlite` + sqlite call throws → withStore silently routes to memory store with only a console.error log.
- **Test implementation:** T-AD07 in src/lib/soc-store-adapter.test.ts probes the real vector (production + sqlite outage chain), not the audit-prose-described "Supabase outage." Comments in the test document the prose drift inline.
- **Action:** Next audit revision — (1) update Section 2 → R-03 description "Supabase outage" → "primary store outage (sqlite or postgres backend failure under non-supabase identity mode)"; (2) update Section 5 → soc-store-adapter table T-AD07 scenario → "Production + sqlite outage → memory fallback silent (full R-03 reproduction)"; (3) consider whether a separate gap-test or future risk entry is needed to document the supabase-throws-no-fallback behavior (likely correct as-is, since fail-loud on identity store outage is preferable to silent memory fallback for supabase-deployed prod environments).
- **Resolution:** Phase 1.5.7 commit `9e16fbe` — R-03 row Section 2 description fully revised to reflect actual exploit surface (sqlite outage under production + non-supabase identity mode triggers Class 2/3 silent write fallback; Class 1 identity ops are exempt because production routing bypasses withStore entirely). T-AD07 comment block refreshed to remove the obsolete "Phase 1.5 hardening proposal will replace fallback with throw" framing and document the chosen Path γ alternative (block writes, preserve reads). T-AD07's `Maps to` Section 5 column updated to `R-03 ✅ FIXED`. A-21 new amendment captures the full Class 1/2/3 routing analysis as canonical reference for future cycles. A-10's three action items all satisfied in the same commit (R-03 description revised, T-AD07 reframed, supabase-no-fallback behavior documented in A-21).

### A-11 — R-16 severity revision (CSRF check provides full cross-origin mitigation)  [RESOLVED in Wave 1 housekeeping]

- **Discovered in:** Phase 1.D.10 plan review (T-MW06 R-16 narrative verification, mentor-prompted)
- **Issue:** R-16 (Low, A04) original description claims "Logout endpoint in PUBLIC_API_ROUTES; CSRF-able logout possible" with attack vector "Attacker iframes/links to /api/auth/logout via cross-site form; victim's session terminated." Source analysis disproves this:
  1. **Logout route exports POST only** (src/app/api/auth/logout/route.ts has no GET handler). GET-based CSRF (`<img src="https://victim/api/auth/logout">`) returns 405 Method Not Allowed — never reaches middleware or route logic.
  2. **CSRF check fires on ALL mutations** (middleware.ts L80-90), including for paths in PUBLIC_API_ROUTES. The PUBLIC_API_ROUTES bypass affects ONLY `sessionPresenceCheck` (L92-101), NOT `csrfCheck`. The middleware function runs csrfCheck FIRST (L106-107), then sessionPresenceCheck.
  3. **Cross-origin POST is blocked at the edge.** `<form action="https://victim/api/auth/logout" method="POST">` auto-submitted from attacker.com → browser sets `Origin: https://attacker.com` (Fetch spec: forbidden header, JS cannot override) → claimedHost='attacker.com', requestHost='victim.com' → mismatch → 403 'Origin mismatch'.
- **Residual attack surface:** Same-origin XSS only. A script already running on victim.com can call `fetch('/api/auth/logout', {method:'POST', credentials:'include'})` → Origin matches → CSRF passes → PUBLIC_API_ROUTES bypasses session check → logout succeeds. But this requires existing XSS, which is its own (much larger) risk class. R-16's incremental contribution beyond "you have XSS" is informational at best.
- **Test implementation:** T-MW06 in src/middleware.test.ts retains as a regression guard for the documented current behavior (PUBLIC_API_ROUTES bypasses session check on POST /api/auth/logout). Comment block explicitly walks through the corrected narrative + hardening landing if /api/auth/logout is later removed from PUBLIC_API_ROUTES.
- **Action:** Next audit revision — (1) revise R-16 severity from **Low → Informational** (or remove from risk register entirely, since CSRF check provides full cross-origin mitigation); (2) update R-16 description to acknowledge the CSRF gate fires on PUBLIC_API_ROUTES paths and that logout accepts only POST; (3) note residual surface (same-origin XSS) is out of scope of R-16's PUBLIC_API_ROUTES gap and properly attributable to a future XSS risk class; (4) audit Section 5 T-MW06 "Maps to" column may keep R-16 reference for traceability, but consider downgrading to "—" since the documented behavior is correct-by-design.
- **Resolution (Wave 1 housekeeping commit `7032a17`):** Section 2 R-16 row severity revised from Low to Informational (mentor Wave 1 scoping accepted source-evidence narrative: CSRF middleware fires on PUBLIC_API_ROUTES paths AND logout exports POST-only; cross-origin vector is fully mitigated, residual is same-origin XSS attributable to a separate risk class). Risk description appended with corrected narrative pointer + A-11 cross-reference. R-16 RETAINED in register for traceability (not deleted per "audit-trail completeness" pattern, lineage of A-02/A-10/A-13 retained-after-resolution).

**Renumbered note (Wave 1 housekeeping):** A-11 closure does NOT change the R-22 numbering decision in A-14 (R-22 added as next available R-XX number). R-21 + R-22 both exist post-Wave-1.

### A-12 — register rate-limit double-counts successful requests  [RESOLVED in Wave 5C]

- **Discovered in:** Phase 1.D.11 plan review (T-RG09 surface analysis)
- **Issue:** register/route.ts L71-73 calls recordFailure on EVERY request that passes the rate-limit check (success + validation-fail + storage-success). This is a "force record" pattern that does not differentiate. Result: 10 successful registrations from same IP exhausts the bucket, blocking legitimate retries. Likely intentional (defense against enumeration), but should be documented.
- **Severity:** Low (intentional defense, side effect is rate-limit accuracy)
- **Action:** Document in audit Section 2 as informational, OR confirm with maintainers that the design intent is "any contact from this IP counts." If the latter, add note to R-02 (rate-limiter accuracy) discussing this design choice.
- **Resolution (Wave 5C commit `7f925ac`):** Register rate-limit refactored to mentor default (a) — only FAILED attempts increment the counter; successful registrations bypass. Implementation pattern: introduce a local `failRegister(message, status)` helper inside POST handler that wraps the previous `NextResponse.json + recordFailure` pair into a single chokepoint. All synchronous validation branches (missing fields, format errors, reserved username, password mismatch, email-taken) and the outer `catch` (User already exists / Email already exists / Reserved / 503) now invoke `failRegister`. The unconditional `recordFailure` at the top of the route is removed entirely. The previous comment block at L33-38 ("counts EVERY attempt incl. success — login only counts failures") is updated to reflect the new failures-only contract + A-12 closure citation. Limit (10) + window (5 min) unchanged — only the trigger semantics shift. T-AR01-03 (3 tests in `src/app/api/auth/register/route.test.ts`) verify: T-AR01 validation failure increments counter; T-AR02 success does NOT increment; T-AR03 over-limit returns 429 without invoking recordFailure or any downstream work. T-RG01 happy-path assertion flipped from `toHaveBeenCalledOnce` to `not.toHaveBeenCalled` as A-12 regression guard (explicit comment). Mentor preference matched: simpler pattern over two-bucket split (rejected alternative documented in code comment).

### A-13 — R-05 TOCTOU lacks direct concurrent-execution test  [RESOLVED in Phase 3.D]

- **Discovered in:** Phase 1.D.11 plan review
- **Issue:** R-05 (TOCTOU race window in register/route.ts L116-126 between readUserByEmailKey and registerUser) is currently tested only indirectly via T-RG12 (storage layer's race-guard returns 'Email already exists'). A direct test would simulate two concurrent register calls and verify storage prevents both from succeeding.
- **Action:** Add explicit concurrent-execution test to soc-store-adapter.test.ts (Phase 1.D.9 already complete) or create dedicated race-condition test in Phase 2 storage suite. Test would use Promise.all on two register calls with same email.
- **Resolution:** Phase 3.D commit `152d872` — T-AL-A13 added to `src/app/api/alerts/__tests__/alerts.test.ts` (Target #2 test file, bottom-of-file dedicated describe block). Imports `@/lib/soc-store-memory` directly (NOT via adapter — bypasses Class 1/2/3 dispatcher to isolate race semantics to the storage module's race-guard). Promise.all on two concurrent `registerUser` calls with identical username generated via `Date.now()+Math.random()` for per-run test isolation. Asserts at most one promise fulfills; the rejected branch (if any) carries 'already exists' message via the storage-layer race-guard contract. **Phase 2.A re-map context:** original Action text said "Phase 2 storage suite," but Phase 2 per CLAUDE.md is Lab Engine; storage adapter is structurally Phase 3 (API & Contracts) territory. Phase 2.A Section 8 documented this re-map. Phase 3.D closes A-13 per that re-mapping decision (Z.4).

### A-14 — Login response-code enumeration via EMAIL_NOT_VERIFIED (intentional UX tradeoff)  [RESOLVED in Wave 1 via new R-22 entry]

- **Discovered in:** Phase 1.D.12 plan review (T-LG03 surface analysis)
- **Issue:** login/route.ts L83-97 distinguishes "wrong password" (401 'Hatali kullanici adi veya sifre.') from "right password, unverified email" (403 EMAIL_NOT_VERIFIED + email field). This response-code split reveals username existence for accounts in unverified state. The 403 response also includes the user's email address (best-effort lookup via readUserByUsername; supabase store returns email, memory/postgres return null), which adds an additional information leak when the supabase-JSON store is active. Documented in source comments L76-82 as an intentional UX tradeoff: "distinguishing 'wrong password' (401) from 'right password, unverified email' (403) reveals that the username exists. We accept this for UX — the alternative (silently failing an authenticated-but-unverified login) is confusing and pushes users toward password resets that won't help."
- **Severity:** Low (only enumerates accounts in unverified state — narrow window between register and verify-click; once verified, indistinguishable from non-existent account at this layer). Register-time emailKey uniqueness already provides equivalent enumeration signal, so login parity here is internally consistent.
- **OWASP:** A07 (Identification and Authentication Failures) — username enumeration sub-category. Distinct from R-04 (timing-based enumeration); this is response-shape enumeration.
- **Action:** Next audit revision — add **R-22** entry to Section 2 risk register (R-21 was previously the last reserved number per A-02 truncated-hash addition). R-22 documents this response-code enumeration as a by-design tradeoff rather than a defect; severity Low, A07. **Phase 1.5 hardening proposal:** generic 401 response for ALL wrong-credentials and unverified cases, paired with an "invisible resend" path that silently re-fires verification email on every wrong-password attempt against an unverified account. Loses the resend-prefill UX in exchange for closing the enumeration vector. Test guard via T-LG03 already in place — when hardening lands, T-LG03 must flip from asserting 403 EMAIL_NOT_VERIFIED to asserting 401 + audit-log entry showing invisible-resend dispatched. **Implementation reference:** verify/resend/route.ts is the anti-enumeration BENCHMARK in the codebase — its generic-200 collapse pattern (T-VR02/T-VR03/T-VR07 invariant trio) is the template Phase 1.5 should mirror for login hardening.
- **Resolution (Wave 1 housekeeping commit `7032a17`):** New R-22 entry added to `docs/audit/phase-1-a-final.md` Section 2 risk register documenting response-code enumeration via EMAIL_NOT_VERIFIED. Severity Low (verification-state enumeration only, no credential impact; register-time emailKey uniqueness already provides equivalent enumeration signal). Status: **ACCEPTED** — Wave 1 audit-doc-only closure per the original A-14 deferral language. Future Phase 1.5 hardening cycle would mirror verify-resend invisible-resend pattern (generic 401 + silent verification-email resend on unverified accounts) — flipping T-LG03 assertion accordingly. Hardening deferred per Wave 1 audit-doc-only scope.

### A-15 — R-18 scope broaden (verify-resend has same email-keyed rate-limit lockout vector)  [RESOLVED in Phase 3.D]

- **Discovered in:** Phase 1.D.16 plan review (T-VR04 source verification)
- **Issue:** R-18 (Medium, A04) original description specifies File(s)=`forgot/route.ts` only: "Email-keyed rate limit (3/hour) lets attacker exhaust victim's reset budget if email known. Attacker spams /api/auth/forgot with victim's email. Limit hits 429. Victim's legitimate reset attempts blocked for 1h." However, verify/resend/route.ts has the SAME vulnerability — RESEND_RATE_LIMIT (source L15-19) is keyed off emailKey with max=3/windowMs=1h, identical pattern. Audit Section 5 acknowledges this implicitly by mapping T-VR04 to R-18, but R-18's literal File(s) field doesn't include verify-resend.
- **Severity:** Same as R-18 (Medium) — vector identical, just second file affected. Same victim-lockout DoS: attacker who knows victim's email can burn through the 3-attempt budget in seconds, locking out victim's legitimate verify-resend requests for ~1 hour.
- **Action:** Next audit revision — update R-18 → File(s) column to `forgot/route.ts, verify/resend/route.ts`. Hardening proposal (combined IP+email rate-limit, deferred to Phase 1.5 or Phase 3) applies to both files identically. Test guards in place at both T-FG-? (forgot, Phase 1.D.17) and T-VR04 (verify-resend, Phase 1.D.16).
- **Resolution:** Phase 3.D commit `152d872` — audit-doc-only closure (no test code change required; T-FG10 + T-VR04 + T-FG11 + T-VR08 already exercise both surfaces per Phase 1.5 R-02/R-06 hardening). The R-18 row in `phase-1-a-final.md` Section 2 already references `forgot/route.ts` and the surface implicitly extends to `verify/resend/route.ts` per the Phase 1.5.4 + 1.5.11 rate-limit hardening that landed on BOTH routes. Phase 3.D confirms the implicit scope; future audit revisions may explicitly broaden the File(s) text. Hardening proposal (combined IP+email rate-limit) remains a Phase 4+ candidate per the original Action deferral language. Z.5 absorbed this closure into Phase 3.D commit body without separate housekeeping cycle.

### A-16 — [RESERVED, NEVER USED]

Numbering gap. A-16 number reserved during audit drafting but never assigned to a tracked amendment. Documented here in Phase 1.5.12 (commit `61e8492`) for register completeness. No action.

### A-18 — R-04 fix surface expansion (postgres + sqlite stores)  [RESOLVED in Wave 1 housekeeping]

- **Discovered in:** Phase 1.5.3 state gathering (R-04 fix scope verification)
- **Source evidence:** `grep authenticateUser src/lib/soc-store*.ts` returned 4 implementations: `soc-store-memory.ts:710`, `soc-store-supabase.ts:690`, `soc-store-supabase-postgres.ts:146`, `soc-store.ts:372`. All 4 share the identical `if (!user) return null; if (!verifyPassword(...)) return null` shape — the unknown-user early-return skips scrypt in all 4. The audit's R-04 row File(s) column listed only memory + supabase, understating the surface by 2 implementations.
- **Issue:** R-04 was confirmed High because of the leak in memory + supabase; the postgres (Phase 1+) and sqlite (legacy local) stores carried the identical leak and were not flagged in the audit. Defense-in-depth fix per Phase 1.5.3 brief Section 1 #5 ("Fix in BOTH store implementations (memory + Supabase) if they exist as parallel paths. Single-store fix = partial closure.") extends naturally to all 4 — applying DUMMY_PASSWORD_HASH compare on the unknown-user branch in each.
- **Action taken in 1.5.3 fix commit:** R-04 row File(s) updated to list all 4 stores. Fix applied to all 4 in the same commit (atomic).
- **Risk if not addressed:** R-04 would remain exploitable on any deployment using SOC_IDENTITY_STORE=postgres (Phase 2 migration target) or SOC_STORAGE=sqlite (dev/legacy mode). Single-store-only fix would leave the leak open on every code path that doesn't route through the supabase or memory store.
- **OWASP:** A07 (same as R-04 parent).
- **Resolution (Wave 1 housekeeping commit `7032a17`):** Phase 1.5.3 R-04 fix already substantively covered postgres + sqlite stores; phase-1-a-final.md Section 2 R-04 row already lists all 4 store paths in File(s) column (verified Wave 1 state gathering). Header marker flipped per amendment-register completeness — the closure was implicit but lacked the explicit `[RESOLVED]` annotation in pending-amendments.md.

### A-19 — R-04 audit completeness gap: T-S10/T-S11/T-S12 missing from Section 5  [RESOLVED in Phase 1.5.5]

- **Discovered in:** Phase 1.5.4 R-21 commit Group C work (out-of-scope observation surfaced in final report). Re-confirmed during Phase 1.5.5 state gathering.
- **Issue:** Phase 1.5.3 R-04 cycle added T-S10 (`DUMMY_PASSWORD_HASH` constant shape), T-S11 (verifyPassword returns false for arbitrary input), and T-S12 (timing parity regression guard) to `src/lib/security.test.ts`, but did not add corresponding rows to `docs/audit/phase-1-a-final.md` Section 5 `security.ts` subsection. The R-04 cycle audit updates touched the R-04 risk row in Section 2 and the T-LG12 row in the login-route Section 5 subsection, but the security.ts subsection was missed. Audit Section 5 ended at T-S08, then jumped to T-S09 (R-21 added by Phase 1.5.4) and T-S13 (R-21 added by Phase 1.5.4) — silently skipping T-S10/T-S11/T-S12.
- **Severity:** Audit-doc completeness gap (no security vector); test coverage exists in source, only Section 5 mapping was missing. Not a vulnerability.
- **OWASP:** N/A (process gap, not a security risk).
- **Action:** Add T-S10/T-S11/T-S12 rows to Section 5 `security.ts` subsection.
- **Resolution:** Phase 1.5.5 commit `bb11ae6` — three rows added to Section 5 `security.ts` subsection alongside the R-01 audit work. Bundled per atomic-where-mental-model-aligns discipline (audit completeness ≈ audit completeness, same mental model + same physical table edit area). Pattern mirror: R-21 cycle's A-02 "add R-21 to Section 2 risk register" was satisfied + resolved in the same commit (R-21/A-02 pattern); A-19 follows the same shape.

### A-20 — R-02 + R-19 + R-03 architectural cluster (deferral context)  [RESOLVED in Wave 1 housekeeping]

- **Discovered in:** Phase 1.5.6 state gathering (compound exploitability analysis)
- **Status:** Active deferral marker — R-02 + R-19 DEFERRED, R-03 next priority (Phase 1.5.7)
- **Issue:** Three risks share architectural root cause: in-process state binding in memory store + per-process state in rate-limiter. Compound exploitability:

| Risk | Single-instance dev | Vercel multi-instance, Supabase healthy | Vercel multi-instance, R-03 fallback active |
|------|---------------------|------------------------------------------|---------------------------------------------|
| R-02 | not exploitable | exploitable (per-process Map across N instances) | exploitable (compounded) |
| R-19 | not exploitable | not exploitable (Supabase routing handles logout) | exploitable (memory store activates, Set instance-bound) |
| R-03 | not exploitable | not exploitable (Supabase routing) | active (data loss, broken auth — Critical) |

- **Architectural surface:**
  - R-02: `src/lib/rate-limiter.ts` standalone module, `globalThis[GLOBAL_KEY]` Map, no Supabase backing exists
  - R-19: `src/lib/soc-store-memory.ts` `revokedTokens` Set in deleteSession/getSessionByToken
  - R-03: `src/lib/soc-store-adapter.ts` fallback gate (`SOC_ALLOW_CRITICAL_MEMORY_FALLBACK=1` auto-enables in production)
- **Deferral rationale (Phase 1.5.6 mentor decision):**
  1. R-03 is the underlying enabler for R-19 compound case. Fixing R-19 without R-03 = partial closure, audit-credibility risk.
  2. R-02 standalone fix (Supabase migration) requires latency budget analysis + failure-mode policy. These decisions are downstream of R-03 fix (which determines fallback semantics framework).
  3. R-03 closure first allows R-02 + R-19 to be revisited with informed architectural context.
- **Compound resolution path (not yet executed):**
  1. Phase 1.5.7: R-03 fix — fallback policy + alerting + retry strategy. May remove memory fallback entirely (R-19 inapplicable) or retain with new policy (R-19 fix scope determined).
  2. Phase 1.5.8+: R-02 Path β decision in post-R-03 framework — Supabase rate_limits table vs alternative backend (Vercel KV / Upstash Redis noted as out-of-audit-scope future improvement).
  3. R-19 final closure either as inapplicable (memory fallback removed) or with shared-state primitives matching R-02 resolution.
- **Action:** No code action in Phase 1.5.6. Section 2 rows marked ⏳ DEFERRED in commit `4deb361`. A-20 stays OPEN until full cluster resolution (R-03 + R-02 + R-19 all closed).
- **Resolution (partial — Phase 1.5.7 commit `9e16fbe`):** R-03 closed via Path γ (memory fallback writes blocked via `MemoryFallbackBlockedError`; reads remain permissive). R-19 reframes: the audit's "if R-03 fallback activates" condition still triggers in legacy/dev paths under `SOC_IDENTITY_STORE=disabled`, but the operational consequence is mitigated — `deleteSession` is a write, so under fallback it now throws `MemoryFallbackBlockedError` rather than silently adding to the per-instance `revokedTokens` Set. Logout fails fail-loud (operator gets 503) rather than fails-silently-distributed. **Phase 1.5.8 recommendation:** revisit R-19 status with full reframing — likely closure as "inapplicable in current production config (Class 1 routing has no fallback) + fail-loud in legacy/dev fallback (Path γ blocks revokedTokens write)." R-02 remains standalone — rate-limiter is a separate module with no store-backed alternative; Phase 1.5.9+ candidate per A-20 compound resolution path. A-20 stays OPEN until R-19 + R-02 cycles complete.
- **Resolution status (post-Phase-1.5.8 commit `43d5b0c`):**
  - **R-03: ✅ FIXED** in Phase 1.5.7 commit `9e16fbe` — Path γ write-block on operational data writes; A-10 audit narrative corrected; A-21 Class 1/2/3 routing analysis canonical reference.
  - **R-19: ✅ INAPPLICABLE** in Phase 1.5.8 commit `43d5b0c` — R-03 closure mechanism (Path γ) indirectly resolves R-19's conditional exploit path. Current production config (Class 1) uses Supabase store directly for `deleteSession` (file deletion, distributed-coherent); legacy/dev fallback fail-loud via `MemoryFallbackBlockedError`. R-19's exploit narrative cannot materialize either way. Status `INAPPLICABLE` (not `FIXED`) preserves audit honesty — no R-19-specific code change was made; the path closed indirectly via R-03.
  - **R-02: ✅ FIXED** in Phase 1.5.9 commit `6e677c0` — Path β.1b architectural migration: rate-limit state moved to Supabase Postgres `public.rate_limits` table. Schema applied in Phase 1.5.9.0 commit `a08d8f3` (operator manual apply). Code dispatcher routes to `supabase-rate-limits.ts` when configured; preserves globalThis Map fallback for local dev. Sync→async cascade across 5 route handlers + 6 test files + setup.ts. T-R10 + T-R11 added as multi-instance shared-state simulation tests.
- **A-20 status: ✅ FULLY RESOLVED in Phase 1.5.9 commit `6e677c0`** — all 3 cluster members closed (R-03 ✅ FIXED in 9e16fbe, R-19 ✅ INAPPLICABLE in 43d5b0c, R-02 ✅ FIXED in this commit). A-20 retained for audit trail per established pattern (never delete resolved amendments). The compound architectural cluster (in-process state binding + per-process rate-limit Map under R-03 fallback) is fully closed: identity ops route through Supabase directly (no fallback), operational data writes throw on fallback (Path γ), rate-limit state is Postgres-backed shared.
- **Wave 1 housekeeping note (commit `7032a17`):** Header marker flip — the substantive `[RESOLVED]` lived in the body (above) but the header lacked the annotation. Marker flip bringing header in sync with body per amendment-register completeness pattern.

### A-21 — Class 1/2/3 routing canonical reference (R-03 fix surface)  [RESOLVED in Phase 1.5.7]

- **Discovered in:** Phase 1.5.7 state gathering (R-03 fix scope analysis built on A-10's prior correction)
- **Issue:** Audit Section 2 R-03 row (and prior Phase 1.5.X cycle docs) treated the soc-store-adapter routing as a single fallback gate. The actual architecture has THREE distinct routing classes with different fallback semantics. Without an explicit reference, future cycles risk repeating the misframing that A-10 had to correct.
- **Class 1 — Identity ops** (authenticateUser, createSession, deleteSession, getSessionByToken, listAssignableUsers, createUser, registerUser, readUserByEmailKey, readUserByUsername, findUserByVerifyToken, setEmailVerified, setEmailVerifyToken, findUserByPasswordResetToken, setPasswordResetToken, consumePasswordResetToken, deleteAllSessionsForUser, cleanupExpiredSessions): routes through `supabasePostgresStore` (if `SOC_IDENTITY_STORE=postgres` + product_db enabled) OR `supabaseStore` (if `SOC_IDENTITY_STORE=supabase`, the production default) with NO try/catch around the call. Supabase / Postgres failures propagate to caller as thrown errors. **No memory fallback path in current production config.** The withStore fallthrough only fires when `SOC_IDENTITY_STORE=disabled` (legacy / offline dev mode), at which point Class 1 methods inherit Path γ fallback semantics like Class 3.
- **Class 2 — JSON domain ops** (writeAuditLog, listReports, createReport, archiveReport, deleteReport, deleteUserCascade, getPortfolioProfile, getPortfolioCertificationById, updatePortfolioProfile, updatePortfolioAvatar, createPortfolioCertification, updatePortfolioCertification, deletePortfolioCertification, createPortfolioEducation, updatePortfolioEducation, deletePortfolioEducation): routes through `supabaseStore` when `useSupabaseJsonDomains=true` (derived from `SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && SOC_IDENTITY_STORE !== 'disabled'`), with NO try/catch. When `useSupabaseJsonDomains=false`, falls through to `withStore` with `allowMemoryFallback: allowCriticalMemoryFallback` — same fallback gate as Class 1's disabled path. Phase 1.5.7 R-03 fix annotated Class 2 writes (12 methods) with `isWrite: true` to engage Path γ when this fallthrough fires.
- **Class 3 — Operational ops** (listAlerts, createAlert, patchAlert, purgeOldAttackEvents, recordAttackEvent, getLiveMetrics): UNCONDITIONALLY routes through `withStore` regardless of Supabase config — these methods have NO Supabase-backed alternative. R-03's primary exploit surface lived here: in production, sqlite failure silently fell back to memory for alerts + attack-event writes. Phase 1.5.7 R-03 fix annotated Class 3 writes (4 methods: `createAlert`, `patchAlert`, `purgeOldAttackEvents`, `recordAttackEvent`) with `isWrite: true`. Reads (`listAlerts`, `getLiveMetrics`) retain fallback for degraded-availability mode.
- **Out-of-class — Standalone primitives** (added Phase 1.5.9): rate-limiter (`src/lib/rate-limiter.ts`) and its Supabase backing (`src/lib/supabase-rate-limits.ts`, new) do NOT go through `soc-store-adapter`. Rate-limiter is a security primitive (rate-limit state), not a domain "store" (identity, alerts, reports, portfolio). It has its own dedicated Supabase client (parallel to `supabase-attack-metrics.ts` and `supabase-product-db.ts` precedents). The dispatcher in `rate-limiter.ts` routes between fallback globalThis Map and `supabase-rate-limits.ts` based on env (SUPABASE_URL + SERVICE_ROLE_KEY presence). Class 1/2/3 routing model preserved; rate-limiter parallels it.
- **Why a canonical reference matters:** A-10 had to correct R-03 framing from "Supabase outage" to "sqlite outage in non-supabase mode." A-21 captures the broader routing picture so future risk evaluations (which class? what fallback semantics?) can reference one document instead of re-reading 543 lines of adapter source.
- **Action:** No code action — this amendment IS the documentation artifact. Resolves R-03 fix's "no silent omissions" discipline (Phase 1.5.3 R-04 lesson) by formalizing the routing analysis that informed Path γ's scope decision.
- **Resolution:** Phase 1.5.7 commit `9e16fbe` — A-21 added as canonical reference alongside R-03 fix. Status RESOLVED from inception (same-commit add+resolve, R-21/A-02 + A-19 lineage pattern). Future cycles (Phase 1.5.8 R-19 revisit, Phase 1.5.9 R-02 Path β) should cross-reference A-21 when discussing adapter routing decisions.

### A-17 — R-20 fix architecture refinement (lazy + boot validation)  [RESOLVED in Phase 1.5.15]

- **Status:** candidate (not blocking, future hardening)
- **Discovered in:** Phase 1.5.1 deploy (CI fail revealed module-load throw fragility)
- **Source evidence:** Vercel build log 17:23:57.006 — `/community/page.js` chunk import chain triggered eager load of `soc-store-memory` during Next.js "Collecting page data" phase. Throw fired before page data collection completed, breaking build.
- **Issue:** Current R-20 fix validates `SOC_DEMO_SECRET` at module-top-level scope. This couples Next.js build-phase static generation to runtime env presence. When env unset:
  - Local `npm run build` fails (developer onboarding friction)
  - Preview deployments without env-propagation fail
  - Build pipeline cannot complete even if env will be set at runtime
- **Empirical scope:** Only `/community/page.tsx` triggers the eager load chain during build. Auth route handlers (login/register/forgot/reset) are runtime-only and unaffected. Refactor blast radius is contained — could be addressed by lazy import in single page, or by full module-level lazy refactor with central boot validation.
- **Proposed refactor:**
  - Lazy getter pattern: `function getMemorySecret(): string` called from inside `signPayload`/`verifyPayload`, throws if env unset
  - Centralized boot validation in Next.js `instrumentation.ts` `register()` hook — validates all critical env vars at server start, fails loud before serving any request
- **Trade-off preserved:** Lazy module + boot validator achieves identical fail-loud-at-boot semantic as current R-20 design (boot validator throws if env missing), while decoupling module load from env presence. R-20 hardening intent fully maintained.
- **Action:** Defer to Phase 2 hardening pass or post-Phase-1.5 cleanup commit. Not blocking.
- **Risk if not addressed:** minor — current Option A (env always set in Vercel Production + Preview) sidesteps the issue operationally. Refinement is design quality improvement, not vulnerability.
- **Deferral:** Phase 1.5.12 commit `61e8492` — formally deferred to Phase 2 hardening pass following A-20 deferral pattern lineage. Rationale: A-17 proposes a code-level refactor (lazy getter pattern for `getMemorySecret()` + Next.js `instrumentation.ts` `register()` boot validator) that is out of scope for Phase 1.5.12 (audit-doc-only closure cycle, ABSOLUTE NO CODE per cycle yasaklar). A-17's own Action explicitly directs Phase 2 deferral; this commit honors that direction with a formal marker. R-20 itself remains ✅ FIXED in Phase 1.5.1 `7baacac` — A-17 is a refinement quality concern (initialization timing + boot-validation design pattern), NOT a vulnerability. Compensating control is operationally active: `SOC_DEMO_SECRET` is set in Vercel Production + Preview env per operator confirmation, which sidesteps the lazy-init module-load fragility issue practically. Phase 2 backlog target alongside the 11 remaining OPEN amendments (A-01, A-05, A-06, A-07 informational, A-08, A-09 informational, A-11, A-12, A-13, A-14, A-15, A-18 substantively-done-needs-late-marker).
- **Resolution:** Phase 1.5.15 commit `835cc3a` — closed as post-Phase-1.5 follow-up cycle (not Phase 2 as originally planned) after Phase 1.5.13/1.5.14/1.5.14.1 build verifications all required `SOC_DEMO_SECRET="placeholder"` inline workaround. Three consecutive cycles materializing the deferral cost provided sufficient real-world evidence to prioritize closure. Defense-in-depth two-layer implementation (4th instance of the pattern in Phase 1.5 lineage after R-13, R-21, R-15): **Layer 1 (boot validator)** in new file `src/instrumentation.ts` — Next.js 14.x `register()` hook fail-loud at server startup when env unset, gated by `NEXT_RUNTIME === 'nodejs'` + `NEXT_PHASE !== 'phase-production-build'` so build module-analysis is unaffected; **Layer 2 (lazy getter)** in `src/lib/soc-store-memory.ts` — `getMemorySecret()` with `let cachedSecret` mirrors `email.ts:getResendClient` idiom (throw-on-missing variant for security-critical use vs Resend's graceful-null variant), replaces former L32-39 module-load throw, called from `signPayload` at L476. `__resetSecretCacheForTests` export with NODE_ENV guard (R-08 pattern lineage). R-20 fundamental behavior preserved — HMAC signing logic, secret consumption point, and T-S01-S15 invariants unchanged; only initialization timing refined (module-load → first-use). T-SEC01 split into T-SEC01a (lazy getter throws at first session-token operation when env unset) + T-SEC01b (cache idempotency); new file `src/instrumentation.test.ts` covers T-INSTR01 (nodejs+env-unset throws), T-INSTR02 (edge runtime no-ops), T-INSTR03 (build phase no-ops — the actual A-17 closure regression guard). Build behavior change: `npm run build` no longer requires `SOC_DEMO_SECRET` env — verified clean both WITH env set and WITH env unset. **Empirical scope correction:** original A-17 "Source evidence" line cited `/community/page.js` as the build-failure chunk, but Phase 1.5.13/1.5.14/1.5.14.1 incidents all fired at `/api/auth/logout` collection point — the import chain `route.ts → soc-store-adapter (value import) → soc-store-memory` carries the same exposure via any API route, not just `/community`. Phase 1.5.15 fix closes both surfaces simultaneously by eliminating the eager module-load throw entirely. .env.example L13 comment updated to reflect new behavior.

### A-22 — ESLint configuration absent (Final Tarama F1)  [RESOLVED in Wave 8]

- **Discovered in:** Final Tarama AI Auditor Simulation Layer 1 (commit `fd0048c`, [`FINAL_SCAN_REPORT.md`](./FINAL_SCAN_REPORT.md) F1)
- **Issue:** Project had no `.eslintrc*`, no `eslint.config.js`, no `npm run lint` script. `next lint` entered interactive install prompt on first invocation; CI did not enforce lint. The Final Tarama scan classified this as ACTION-S (small effort, infrastructure debt).
- **Mentor-error correction lineage instance 4 (Wave 8):** the Wave 8 mega-prompt's stated precondition "eslint-config-next available via existing next dep tree, no new install" was inaccurate against repo state. Next 14.2.35 does NOT bundle `eslint` or `eslint-config-next` as dependencies — they have to be added explicitly. State gathering surfaced the discrepancy + STOP report issued to operator. Operator Option B locked: approve dev-only deps install. This is the 4th instance of the mentor-error correction protocol (Pattern Catalog § 4) — lineage 1: Phase 1.5.14.1 a1fa2b5 push status assumption; lineage 2: Phase 3.D Z.10 platform-backbone production state assumption; lineage 3: Wave 7 R-XX risk count assumption (caught pre-doc-publication via cross-check grep); lineage 4: this cycle.
- **Mentor-error correction lineage instance 5 (Wave 8 cont'd):** during Group A1 execution, initial reading of the user plan was "literal `//` → `{/* */}`" — would have erased 4 visible decorative slashes from rendered blog heading + Footer tagline + 2 Footer section labels (siberhacker aesthetic per CLAUDE.md L77-78). STOP report issued; operator confirmed A1 JSX-expression wrap interpretation `{'// '}` which preserves UX while satisfying `react/jsx-no-comment-textnodes` rule. 5th lineage instance in cycle pattern.
- **Resolution (Wave 8 commit `9d0eca4`):** RESOLVED. Steps:
  - `npm install --save-dev eslint@^8.57.1 eslint-config-next@^14.2.35` — version pinning required: initial install pulled `eslint@9.x` + `eslint-config-next@16.x` which broke against Next 14.2.35's legacy `next lint` CLI options. Pinned to v8/v14 line.
  - `.eslintrc.json` created at repo root: `{ "extends": "next/core-web-vitals" }`.
  - `package.json` scripts: added `"lint": "next lint"`.
  - **Lint baseline closure (14 findings, all mechanical):** 7 errors + 7 warnings surfaced on first run. Errors closed via: (a) JSX-expression wrap `// ` → `{'// '}` at 4 decoration sites (`src/app/blog/page.tsx:61`, `src/components/Footer.tsx:56/66/90`) — UX preserved; (b) removed 3 pre-emptive `// eslint-disable-next-line @typescript-eslint/*` comments in `src/test/setup.ts:30,32` (rules referenced are not in eslint-config-next 14 preset, so the disable comments themselves errored as rule-not-found). Warnings closed via per-line `// eslint-disable-next-line` annotations with inline rationale (Pattern Catalog § 9 bypass-with-justification existing lineage extended by 7 new instances): 5× `@next/next/no-img-element` at decorative-image / signed-URL avatar sites; 2× `react-hooks/exhaustive-deps` at Terminal.tsx stable-setter-deps sites.
  - **Final lint baseline:** `npm run lint` → **0 errors, 0 warnings**. Clean baseline established for future cycles.
- **Production-bundle impact assessment:** `eslint` + `eslint-config-next` are devDependencies only. Vercel build does not run `npm run lint`; production bundle UNAFFECTED. `npm audit` dev-tree count grew from 7 → ~10 vulnerabilities (+3 transitive eslint deps, all dev-only, all documented per Pattern Catalog § 7 forward-iteration convention).
- **Pattern catalog impact:** zero new patterns. Pattern § 9 (bypass-with-justification) instance count +7 (now consistent with prior R-13/R-21/A-17/Phase-3.D lineage of inline-disable-with-comment discipline). Mentor-error correction protocol Pattern § 4 instance count rises to 5 (this cycle contributed 2).

### A-23 — Production hostname inconsistency (Final Tarama F7)  [RESOLVED in Wave 8]

- **Discovered in:** Final Tarama AI Auditor Simulation Layer 2 (commit `fd0048c`, [`FINAL_SCAN_REPORT.md`](./FINAL_SCAN_REPORT.md) F7)
- **Issue:** Canonical production hostname per Phase 5.A Z.10 + README + `app/layout.tsx` `metadataBase` is `siberlab.dev`. Four source files survived with stale legacy domains (`cybersec-blog.com`, `cybersec.blog`) referenced from a prior naming era:
  - `src/app/robots.ts:6` — sitemap URL `https://cybersec-blog.com/sitemap.xml` (crawlers pointed at a domain that doesn't host this app)
  - `src/app/sitemap.ts:4` — `const BASE_URL = 'https://cybersec-blog.com'` (all sitemap entries used stale base)
  - `src/app/api/cybernews/route.ts:247` — outbound `User-Agent` header referenced `+https://cybersec.blog` (visible to upstream RSS feed providers' analytics only)
  - `src/components/Footer.tsx:94,97` — mailto link + visible text `hello@cybersec.blog` (broken contact path for site visitors)
- **Resolution (Wave 8 commit `9d0eca4`):** RESOLVED via 4-file text replacement. Each occurrence migrated to `siberlab.dev`:
  - `robots.ts:6`: sitemap URL → `https://siberlab.dev/sitemap.xml`
  - `sitemap.ts:4`: BASE_URL → `'https://siberlab.dev'`
  - `cybernews/route.ts:247`: User-Agent string updated to `'Mozilla/5.0 (compatible; siberlab/2.0; +https://siberlab.dev)'`
  - `Footer.tsx:94,97`: mailto + visible text → `hello@siberlab.dev`
- **Verification:** post-fix grep `grep -rn "cybersec-blog\.com\|cybersec\.blog" src/` returns 0 source matches. `npm run build` regenerates `sitemap.xml` + `robots.txt` with the canonical hostname. No tests assert old hostname (verified during state gathering).
- **Pattern catalog impact:** zero. Standard hostname-migration mechanical fix.

### A-24 — Profile edit persistence: Next.js Router Cache stale on soft-nav return  [RESOLVED in Wave 10]

- **Discovered in:** Wave 9 operator manual smoke (post-push of `06a4f34` README hybrid restructure). Operator reported: profile sayfasında değişiklik yapılıyor (örn. skill ekleme, bio güncelleme), "Kaydet" diyorum, ✓ kaydedildi gibi görünüyor; başka sekmeye geçip `/portfolio`'ya geri döndüğümde **eski değerler görünüyor**, bir an sonra **anlık olarak yeni değerlere flip ediyor**.
- **Symptom analysis:** server-side save SUCCESS (Supabase Storage JSON has new value); initial page render uses STALE data (old value); client-side fetch then overrides STALE → FRESH (visible flicker). UX bug, not data-loss bug.
- **Root cause:** Next.js App Router client-side **Router Cache** stores rendered route segments. `/portfolio` Server Component declares `dynamic = 'force-dynamic'` + `revalidate = 0` (which bypasses server-side Full Route Cache + Data Cache) but does NOT affect the client Router Cache. After a save, server data is fresh but soft-nav return to `/portfolio` reuses the cached segment with the original (now stale) `initialProfile` prop. The `useEffect([editable])` auto-sync at `PortfolioWorkspace.tsx:406` refetches `/api/profile/me` (with `cache: 'no-store'`) → `setData(fresh)` → visible stale → fresh flicker.
- **Scope decision:** operator mentor option W10-B (holistic) over W10-A (operator-reported surface only). Same Router Cache bug pattern affects ALL 7 save handlers in `PortfolioWorkspace.tsx`; mechanical fix per handler is 1 line. W10-B respects "minimal root-cause fix" yasakları (every site shares one pattern, fix is mechanical).
- **Resolution (Wave 10 commit `13a3c2c`):** RESOLVED. Steps:
  - `src/components/portfolio/PortfolioWorkspace.tsx`:
    - New import: `import { useRouter } from 'next/navigation'` (L4)
    - New hook in component body: `const router = useRouter()` (L262) with 9-line explanatory comment block referencing this A-24 entry
    - `router.refresh()` call appended to success path of all 7 save handlers:
      * `saveProfile()` (L520) — profile bio/headline/specialties/tools (operator-reported surface)
      * `uploadAvatar()` (L552) — avatar upload
      * `removeAvatar()` (L584) — avatar removal
      * `saveCertification()` (L613) — cert create/update
      * `deleteCertification()` (L638) — cert delete
      * `saveEducation()` (L708) — edu create/update
      * `deleteEducation()` (L732) — edu delete
  - `router.refresh()` invalidates Router Cache for the current route + triggers Server Component data refetch on next render — the surgical primitive matching the bug's exact mechanism.
- **Regression test:** T-PE-PERSIST in `src/components/portfolio/__tests__/PortfolioWorkspace.test.tsx` (NEW file, 1 test). Mocks `useRouter` + `getAuthSession` + global `fetch`; renders `PortfolioWorkspace` with `editable={true}`; waits for auto-sync GET; clicks "Profili Kaydet" button; asserts `router.refresh()` was called after PUT success. Call-site contract guard (jsdom does NOT simulate Next.js Router Cache; only Playwright/manual smoke can verify the actual stale→fresh elimination). Single test covers the family of 7 handlers by code-review-adjacency (uniform pattern in single file under single hook).
- **Operator post-push verification REQUIRED:** `/portfolio` profile edit → save → switch tab → return → fresh value immediately (no flicker).
- **Wave 5C archive UI note:** the cert/edu `archivePortfolioCertification` + `archivePortfolioEducation` adapter methods + PATCH `?action=archive` routes shipped in Wave 5C (commit `7f925ac`), but `PortfolioWorkspace.tsx` has NO archive UI handler yet (search returned zero matches for `archive` in the component). When archive UI ships, the corresponding handler must also call `router.refresh()` post-success.
- **Pattern catalog impact:** zero new patterns. Pattern Catalog § 4 (mentor-error correction protocol) instance count does NOT increment — Wave 10 mega-prompt explicitly framed the 3 ranked root-cause hypotheses as "agent must verify" (UNCONFIRMED), and agent state-gathering confirmed Router Cache as root cause; this is correct state-gathering protocol functioning, not a mentor-error correction.

### A-25 — Profile schema: single `website` → multi-platform `socialLinks` JSON  [RESOLVED in Wave 11]

- **Discovered in:** Wave 9 operator manual smoke. Operator observation: single "Website" field doesn't suit the cybersec student demographic (most don't have personal websites but DO have GitHub / LinkedIn / TryHackMe / HackTheBox profiles).
- **Scope:** Greenfield feature refactor. NOT an audit closure — operator-driven feature decision (Wave 11 mega-prompt). Pattern Catalog § 4 (mentor-error correction protocol) instance count does NOT increment; this is correct product evolution.
- **Operator decisions locked:**
  - **Paket B** — 6 platforms: GitHub, LinkedIn, TryHackMe, HackTheBox, X/Twitter, Personal Website.
  - **Pattern A** — sabit 6 alan (fixed schema), all opsiyonel.
  - **Storage convention** — username-only for 5 platforms (display layer constructs canonical full URL via `buildPlatformUrl`); full URL for personal field (no canonical host).
  - **Migration** — eski `website` field silindi. Operator's profile is the only live user; pre-Wave-11 website value (if any) dropped silently. No active migration logic shipped (per operator decision; Phase 6 scope cleanup if real users join).
- **Resolution (Wave 11 commit `03f3884`):** RESOLVED.
  - **Type layer** (`src/lib/portfolio-profile.ts`): new `SocialLinks` interface (6 opsiyonel fields); `PortfolioProfileFields.website` removed, replaced with `socialLinks?: SocialLinks`. New helper `normalizeSocialLinksPatch(patch)` — trims + drops empty values; shared across all 3 stores.
  - **Adapter layer:**
    - `src/lib/soc-store-memory.ts` — internal `InternalProfile.website` replaced with `socialLinks: SocialLinks`. All 4 sites (declaration, 2 seed inserts, read mapper, update path) consume the new field.
    - `src/lib/soc-store-supabase.ts` — `StoredProfile.socialLinks?: SocialLinks` added (top-level optional so pre-existing JSON files without the key parse cleanly). All 3 sites updated.
    - `src/lib/soc-store.ts` + `src/lib/db.ts` — **degraded** per Wave 5C precedent (operator confirmation: production = Supabase only; sqlite local-fallback only, not deployed). `website` column persists in DDL for backward compat with pre-existing local sqlite DBs (no destructive ALTER); INSERT/UPDATE bind `''` to it. Read mapper outputs `socialLinks: {}` empty object. Sqlite-mode users lose `socialLinks` feature silently.
  - **Validation layer** (`src/lib/portfolio-validation.ts`):
    - `parseSocialLinks(body)` helper — extracts 6 known platform keys, trims, drops empty + non-string + unknown keys.
    - `validateProfilePayload` extended with per-platform check:
      - 5 platforms (github / linkedin / tryhackme / hackthebox / twitter) validated against `SOCIAL_USERNAME_RE = /^[a-zA-Z0-9._-]{1,39}$/` (GitHub max length).
      - `personal` validated as `http://` or `https://` URL (assertSafeUrl-style scheme allowlist), max 200 chars. Rejects `javascript:` / `data:` / non-URL strings.
    - Empty fields skip validation (all opsiyonel).
  - **API layer** (`src/app/api/profile/me/route.ts`): PUT contract unchanged at handler level — `parseProfilePayload` now extracts `socialLinks` from request body and `validateProfilePayload` enforces per-platform rules. Comment block updated to reflect new sanitize scope (socialLinks per-field validation replaces former website pass-through).
  - **UI layer** (`src/components/portfolio/PortfolioWorkspace.tsx`):
    - Form state: 6 flat fields (`socialGithub` / `socialLinkedin` / `socialTryhackme` / `socialHackthebox` / `socialTwitter` / `socialPersonal`) replacing single `website` field.
    - `normalizeWebsiteUrl` helper removed; replaced with `buildPlatformUrl(platform, username)` returning the canonical full URL per platform.
    - `socialLinkEntries` memo: pre-computes display-time entries (filters empty values, constructs URLs, attaches platform labels).
    - Form input row: removed single `<input placeholder="Website">`, added 6 platform inputs with `aria-label` + `placeholder` per platform (Pattern A sabit 6 alan).
    - Display surface: removed single `Website` card, added `Sosyal Bağlantılar` strip rendering `socialLinkEntries` as `<a target="_blank" rel="noreferrer noopener" aria-label="...">` chips. Whole block hidden when no entries populated.
    - `saveProfile` PUT body now nests `socialLinks: { github, linkedin, tryhackme, hackthebox, twitter, personal }` (6-key object) and explicitly omits the legacy `website` field.
    - **Wave 10 `router.refresh()`** preserved across all 7 save handlers.
- **Tests added (10 new):**
  - `src/lib/portfolio-validation.test.ts` (NEW file, 8 tests):
    - **T-SL01** — `parseProfilePayload` extracts 6 socialLinks fields from JSON body.
    - **T-SL02** — `parseSocialLinks` drops empty strings + non-string values + unknown keys.
    - **T-SL03** — valid GitHub-style usernames accepted (boundary: 1 char, 39 chars, dots, hyphens, underscores).
    - **T-SL04** — invalid GitHub usernames rejected (special chars, whitespace, > 39 chars).
    - **T-SL05** — each of the other 4 username platforms (LinkedIn / TryHackMe / HackTheBox / Twitter) validated identically with platform-specific error message.
    - **T-SL06** — `personal` URL validation: http(s) only, ≤ 200 chars; rejects non-URL, `javascript:`, `data:` schemes.
    - **T-SL07** — empty `socialLinks` object / undefined passes validation (all opsiyonel).
    - **T-SL08** — first invalid platform short-circuits validation (returns its specific error).
  - `src/components/portfolio/__tests__/PortfolioWorkspace.test.tsx` (2 new tests appended to A-24 test file):
    - **T-SL-PERSIST** — `saveProfile` PUT body contains nested `socialLinks` with all 6 platform fields; asserts `body.website` does NOT exist.
    - **T-SL-RENDER** — display surface renders populated social links as anchor tags with correctly constructed canonical URLs per platform (verifies `buildPlatformUrl` integration).
- **Test fixture updates (existing tests):**
  - `src/app/api/profile/education/__tests__/education.test.ts` (2 sites) — fixture `website: ''` → `socialLinks: {}`.
  - `src/components/portfolio/__tests__/PortfolioWorkspace.test.tsx` `buildProfile()` helper — same swap.
  - `src/app/api/profile/me/__tests__/route.test.ts` — no fixture change needed (didn't reference website).
- **Verification:**
  - Vitest: **531 → 541** (+ 10 new tests).
  - TypeScript: zero errors.
  - Build: clean (env-free per A-17).
  - Lint: **0E / 0W** preserved (Wave 8 closure).
  - `grep -rn "website" src/` post-fix: zero references in production data flow; remaining occurrences are (a) DDL backward-compat column declarations in `db.ts` / `soc-store.ts` with inline rationale comments, (b) UI placeholder text "Kişisel website" (user-facing string for the personal field), (c) the documentation comment in `portfolio-profile.ts` referring to the removed former field.
  - All Wave 1-10 patches dokunulmaz; Wave 10 `router.refresh()` in 7 save handlers preserved.
- **Pattern catalog impact:** **zero new patterns**. This is a schema refactor + UI rewrite, NOT a security pattern. Pattern Catalog § 1 (defense-in-depth two-layer) count unchanged — the personal-URL scheme allowlist is a single-layer input gate, not paired with a render-layer second gate (React/MDX default safe-text rendering already prevents output-side injection, which is structurally the same Layer 2 as R-API-05/13 lineage — but no new pattern instance is claimed because there's no new Layer 1 file/abstraction; it's a one-off scheme check inside the validation function).
- **Operator post-push verification REQUIRED:**
  - `/portfolio` profile edit → fill GitHub username `codewarrior96` → save → switch tab → return → social link strip renders with `https://github.com/codewarrior96` anchor.
  - Validation: invalid username (e.g. `user@name` in any of 5 platforms) → save returns 400 with platform-specific error message in Turkish.
  - Personal field: paste full `https://...` URL → renders verbatim; paste plain text → 400 error.

### A-26 — Navigation rename: /community → /academy (label + route + redirect)  [RESOLVED in Wave 12]

- **Status:** RESOLVED in Wave 12 commit `964d1ed`
- **Symptom:** the "COMMUNITY" navigation label semantically mismatched with actual page content. The page hosts the Lab Engine + Curriculum + Tools + CTF Missions — a training/education surface, NOT a community forum / chat / posts surface. Operator UI review surfaced the naming dissonance during Wave 11.
- **Discovery:** Wave 11 operator UI review (post-Wave-11 socialLinks deploy).
- **Operator decision (locked):** full rename — label `[COMMUNITY]` → `[ACADEMY]`, route `/community` → `/academy`, 308 backward-compat redirect (sub-path wildcard included). Tab/sub-feature labels INSIDE the page (`[] Curriculum`, `{} Tools`, `## CTF Missions`) preserved — only the parent label + URL segment changed.
- **Closure (Wave 12 commit `964d1ed`):**
  - Directory rename: `src/app/community/` → `src/app/academy/` via `git mv` (both `layout.tsx` + `page.tsx` detected as renames `R`, history preserved). Page content (2146 LOC `'use client'` component with Lab Engine / Terminal / CTF flag UX) UNCHANGED — only the parent directory path moved.
  - **Wave 4B BUG-006 auth gate PRESERVED at the new path** (`src/app/academy/layout.tsx`). Same `cookies()` + `getServerSessionFromCookies()` + `redirect('/login')` pattern that closed BUG-006 in Wave 4B; R-E2E-02 PARTIAL closure narrative carries forward unchanged. Layout metadata title flipped `'Community'` → `'Academy'`; export name `CommunityLayout` → `AcademyLayout`. Comment block updated to reflect the rename with explicit Wave 12 cross-reference.
  - Navigation label: `src/components/NavigationBar.tsx` L15 — `{ label: 'COMMUNITY', href: '/community' }` → `{ label: 'ACADEMY', href: '/academy' }`. Brackets in the nav rendering (siberhacker visual brand per CLAUDE.md L77-78) preserved by virtue of being applied at the rendering layer, not in the label string.
  - Prefetch route array: `src/components/AppShellClient.tsx` L78 — `/community` → `/academy` (Wave 5A AbortController prefetch loop targets the new path).
  - Theme system: `src/lib/route-theme.ts` — `RouteTheme` type literal `'community'` → `'academy'`; path check + return value migrated consistently. Zero external consumers of the theme literal at rename time (grep returned only this file as a producer + consumer), so the type-level rename is safe.
  - Default route mapping: `src/lib/platform-domains.ts` L92 — `red_team` team config `defaultRoute: '/community'` → `'/academy'`.
  - Source code comment narrative (NOT audit doc): `src/app/portfolio/page.tsx` L68 BUG-006 comment narrative updated to reference `/academy` with inline Wave 12 cross-reference; preserves the audit-trail discovery context.
  - **Backward-compat redirect:** `next.config.mjs` `redirects()` async function added with two 308 permanent rules:
    1. Exact `/community` → `/academy`
    2. Sub-path wildcard `/community/:path*` → `/academy/:path*`
    Pre-Wave-12 deep links (search-engine indexed pages, bookmarks, historical audit doc narrative cross-references) keep working without manual user intervention. Auth gate still enforced at the destination by `src/app/academy/layout.tsx`.
  - E2E test update: `e2e/journey-lab-l1-solve.spec.ts` T-E2-01 assertion updated to `await page.goto('/academy')` (canonical new path); top docstring + skip-test inline narratives updated to reference `/academy` with explicit Wave 12 cross-reference (Wave 4B discovery context preserved). `e2e/journey-portfolio-cert-crud.spec.ts` cross-reference comment updated to mention "/academy layout, formerly /community per A-26 Wave 12 rename".
- **Migration safety:**
  - Wave 4B R-E2E-02 PARTIAL closure status semantically unchanged — auth gate moved with the layout, same redirect target (`/login`), same Yol A Z.13 verified-user dependency for skipped tests.
  - Audit doc historical narrative references to `/community` (in `phase-1-a-final.md`, `phase-2-a-lab-engine-audit.md`, `phase-4-a-ui-a11y-audit.md`, `phase-5-a-e2e-journeys-audit.md`, `FINAL_SCAN_REPORT.md`, `AUDIT_README.md`, `data-flow-map-and-migration-plan.md`) **left untouched per policy** — they document Wave 4B discovery, the route's pre-Wave-12 production state, and the audit-trail of the BUG-006 closure narrative. Future readers reach the current path via either the 308 redirect or the Wave 12 cross-reference in `src/app/academy/layout.tsx`.
  - Production smoke (operator post-push):
    - `siberlab.dev/community` → 308 redirect to `siberlab.dev/academy`
    - `siberlab.dev/academy` → unauthenticated user redirected to `/login` (BUG-006 gate)
    - Authed user `/academy` → Lab Engine renders with Curriculum / Tools / CTF Missions intact
    - Navigation bar shows `[ACADEMY]` (not `[COMMUNITY]`)
- **Test impact:**
  - Vitest 541 PRESERVED (route rename is invisible to existing test suite; no Vitest test asserted `/community` URL).
  - E2E suite: 9 active + 9 documented skip — same count post-rename; T-E2-01 assertion swapped from `/community` to `/academy` (BUG-006 gate logic unchanged, only target URL).
  - Lint 0E/0W PRESERVED.
  - TypeScript zero errors (after stale `.next/types/app/community/*` build artifacts cleaned — gitignored, regenerated by `npm run build`).
  - Production build: `/academy` route present (70.2 kB, dynamic, ƒ); `/community` NOT in static route list (only the redirect rule).
- **Pattern catalog impact:** **zero new patterns**. Mechanical rename + redirect, no new security or architectural pattern. Pattern Catalog instance counts unchanged.

### A-27 — Avatar performance: triple-fetch storm + missing Cache-Control + tight TTL  [RESOLVED in Wave 13 Faz 13.C]

- **Status:** RESOLVED in Wave 13 Faz 13.C commit `ed086c2`
- **Symptom:** `/portfolio` page load triggers 6 avatar-related network requests (3 × 307 redirect to signed URL + 3 × jpeg download), ~3.6s wall time, ~250 KB transfer for what is conceptually a single image. Operator-reported visual avatar lag with stale-fresh flicker. DevTools Network screenshot (Wave 13 Faz 13.A entry context) captured the 6-request flow concretely.
- **Discovery:** Wave 11 + Wave 12 operator UI review. Wave 13 Faz 13.A audit (commit `b8e812a`, [`WAVE_13_AVATAR_PERF_AUDIT.md`](./WAVE_13_AVATAR_PERF_AUDIT.md)) provided 6-layer code-level diagnosis.
- **Root cause (Faz 13.A F-AV-01..F-AV-03):**
  - 3 `<img>` render sites in `PortfolioWorkspace.tsx` (L905 header thumbnail, L995 edit form preview, L1085 read-side card) each fire independent fetch via `/api/profile/avatar/[userId]` 307 endpoint.
  - Each `/api/profile/avatar/[userId]` GET invokes `createSignedObjectUrl` which mints a UNIQUE Supabase JWT token per call → 307 destinations differ → browser cache cannot dedupe at destination layer.
  - The 307 response carries NO `Cache-Control` header in the production Supabase path (sqlite fallback path had it; production path didn't) → browser cache cannot dedupe at source-URL layer either.
  - `export const dynamic = 'force-dynamic'` on the route compounds by opting out of Next.js Data Cache + Route Cache; freshness constraint could be expressed via short `max-age` directly.
- **Faz 13.B mentor decision (locked scope):** Path B (architectural fix) + Path A defense-in-depth (Cache-Control). Path C (next/Image migration) + Path D (server-side signed URL pool) deferred to POST_CAPSTONE_BACKLOG.md #11 + #12.
- **Closure (Wave 13 Faz 13.C commit `ed086c2`):**
  - **Path B — SSR signed URL resolve:** `src/app/portfolio/page.tsx` (Server Component, force-dynamic) calls `createSignedObjectUrl(avatarPath, 30)` server-side after profile load; passes resolved URL as new `initialAvatarUrl?: string | null` prop to `PortfolioWorkspace`. Component's `avatarSrc` `useMemo` consumes the prop when present; falls back to legacy `buildAvatarSrc(...)` (`/api/profile/avatar/[userId]?v=...` pattern) when null. **3 `<img>` render sites all consume the same SSR-resolved URL string** — browser dedupes natively → **single jpeg fetch per page load** (down from 3).
  - **Path A — Cache-Control + Vary on 307:** `src/app/api/profile/avatar/[userId]/route.ts` L60 `NextResponse.redirect(signedUrl)` now sets `Cache-Control: private, max-age=20` (TTL minus 10s safety buffer) + `Vary: Cookie` (defense-in-depth signal for any intermediary cache). Even on the legacy fallback path, the 3 sites collapse to 1 effective fetch within the 20s window.
  - **TTL revision 15s → 30s** (Z.15 in `docs/SCOPE_DECISIONS.md`): widens the cache-window arithmetic for the Cache-Control + browser-dedup combo. Wave 5B R-API-10 security narrative preserved — 30s still well within "short-lived signed URL" envelope; pattern intact, parameter relaxed. Inline source-comment cross-references A-27 + Z.15 next to the constant.
  - **Graceful degradation:** SSR resolve failures log to `console.error` (operator observability) but do NOT fail the page render. Client falls back to legacy `/api` path. Sqlite-mode (no Supabase signed URLs) also routes through fallback.
- **Wave 10 `router.refresh()` interaction:** Wave 10 closure (A-24, commit `13a3c2c`) added `router.refresh()` to all 7 portfolio save handlers (saveProfile / uploadAvatar / removeAvatar / saveCertification / deleteCertification / saveEducation / deleteEducation). After save success, `router.refresh()` triggers Server Component re-render → fresh `initialAvatarUrl` flows down via prop → 3 `<img>` sites update with new SSR URL. Quota math: 1 Supabase API call per user save action (acceptable per Faz 13.B mentor review).
- **Production smoke target (Faz 13.D operator-manual, post-push):**
  - `siberlab.dev/portfolio` DevTools Network panel filter "avatar" → **≤2 requests** (1 × 307 redirect from `/api/profile/avatar/<userId>` + 1 × jpeg from Supabase Storage) instead of 6.
  - Cold wall time: **~250-400ms** (was ~3.6s — 9× improvement).
  - Warm reload within 20s cache window: **~150ms** (cache hit on 307 redirect; jpeg from Supabase edge cache).
- **Test coverage (5 new + 1 renamed assertion):**
  - **T-AV-TTL30** (renamed from T-AV-TTL; assertion 15s → 30s per Z.15): `src/app/api/profile/avatar/__tests__/avatar.test.ts` — verifies `createSignedObjectUrl` called with TTL=30. Drift back to 15s or 60s fails.
  - **T-AV-CACHE** (NEW): same file — verifies 307 response includes `Cache-Control: private, max-age=20`.
  - **T-AV-VARY** (NEW): same file — verifies 307 response includes `Vary: Cookie`.
  - **T-AV-SSR-PROP** (NEW): `src/components/portfolio/__tests__/PortfolioWorkspace.test.tsx` — verifies that when `initialAvatarUrl` prop is provided, all `<img>` `src` values consume the prop directly AND no `/api/profile/avatar/` fetch is made.
  - **T-AV-SSR-FALLBACK** (NEW): same file — verifies that when `initialAvatarUrl` prop is absent, `<img>` `src` falls back to legacy `/api/profile/avatar/<userId>?v=...` pattern (graceful degradation).
- **Pattern catalog impact:** ZERO new patterns. Browser-level perf optimization, not defense-in-depth security pattern. Pattern Catalog instance counts unchanged. Honest signal: capstone-grade audit cycle (Faz 13.A code-level 6-layer analysis → Faz 13.B mentor scope-locked path selection → Faz 13.C surgical implementation per locked scope → Faz 13.D operator-manual production smoke). The methodology itself is a capstone discipline signal.
- **Mentor-error correction lineage:** NOT incremented. Faz 13.A agent confirmed audit hypotheses without mentor mega-prompt assumption miss. Faz 13.B operator confirmed scope without revision. Faz 13.C agent implemented per locked spec.
- **Phase 6/7 deferrals (POST_CAPSTONE_BACKLOG.md):**
  - **F-AV-06 next/Image migration** → backlog item #11
  - **F-AV-04 / Path D server-side signed URL pool** → backlog item #12

### A-28 — display_name system-wide removal (Wave 14 Faz 14.C)

- **Status:** RESOLVED in Wave 14.C commit `b54cf8c`
- **Origin:** Wave 14.A Bug 4 investigation (commit `d98f76b`) — operator-observed "Zerooooo" displayName residue in production data. Investigation confirmed no API path can update displayName post-registration (historical artifact). Operator UX review escalated to: remove displayName concept entirely; username serves as primary identity (GitHub / Twitter / Discord pattern).

**Scope (44 files, ~-296 net LOC):**

- **UI:**
  - `src/components/EmbeddedRegister.tsx` — "Görünen ad" form field + `displayName` state + payload key removed; 5 fields → 4 fields (username, email, password, confirm).
  - `src/components/portfolio/PortfolioWorkspace.tsx` — 7 displayName reads → username, 2 `@username` prefixes → plain `username` (Q2-A), mini profile card (route-panel top-right duplicate) removed entirely.
- **API routes (5):** `register`, `users`, `verify`, `forgot`, `verify/resend` — payload + validation + write + email-call source migrated to `username`.
- **Storage adapters (4):** `soc-store-memory`, `soc-store-supabase` (production JSON), `soc-store` (SQLite legacy), `soc-store-supabase-postgres` (blueprint adapter, never deployed) — all `StoredUser` types + write paths + SQL `display_name` column references cleaned.
- **Types:** `SessionUser` (`soc-types.ts`), `registerWithPassword` payload (`auth-client.ts`), all `Pick<SessionUser, ...>` consumers, `getPortfolioSeedForUser` signature.
- **Validation:** `DISPLAY_NAME_MIN/MAX_LENGTH` constants + `DISPLAY_NAME_DENYLIST_RE` regex + `isValidDisplayName` function + `getDisplayNameError` helper + R-13/R-14 lineage comment blocks — all removed (Q3-A total cleanup).
- **Email templates:** `safeName` source remained `params.username` (semantically already correct); R-14 Layer 2 lineage comment narrative pivoted to username substrate.
- **Tests:**
  - `identity-validation.test.ts` — 6 dedicated cases T-IV14 through T-IV19 removed alongside the underlying code (Q6-A test drift accepted).
  - `email-templates.test.ts` — T-ET06 R-14 narrative pivoted to username substrate.
  - 22 fixture files — `displayName: 'X',` lines dropped from `SessionUser` test objects.
- **DB schema:**
  - `supabase/platform-backbone-v1.sql` — `display_name text not null,` line removed from `identity.users` blueprint (never deployed; Z.10 honesty).
  - `src/lib/db.ts` — `display_name TEXT NOT NULL,` removed from SQLite `CREATE TABLE` + all `INSERT INTO users` + `SELECT` paths.
  - `supabase/wave-14-c-drop-display-name.sql` — NEW idempotent migration file staged for future Postgres deploy (`drop column if exists display_name`).
- **Seed:** `portfolio-profile.ts:getPortfolioSeedForUser` headline/bio template literals migrated to `${user.username}` (Q4-A).
- **E2E:** `e2e/_fixtures/users.ts` + `_fixtures/auth.ts` + `journey-auth-bootstrap.spec.ts` — `displayName` fixture field + form-fill calls removed.
- **Scripts:** `scripts/backfill-identity-postgres.mjs:132` — `display_name: user.displayName` line removed (Q5-A).

**Email body change (Q1-A):** `"Merhaba {displayName},"` → `"Merhaba {username},"` in verification + password-reset emails (`renderVerificationEmail`, `renderPasswordResetEmail`).

**JSON Storage strategy (Q2-A):** Silent-ignore (Wave 11 website-field precedent). The Supabase Storage user JSON files may still contain a `displayName` key from pre-Wave-14.C writes; read path now ignores it, write path no longer emits it. **NO migration script** for production data.

**Validation cleanup (Q3-A):** Total removal. R-13 (HTML-injection denylist) + R-14 (CRLF denylist) lineage preserved in audit doc history (`phase-1-a-final.md` + `email-templates.test.ts:T-ET06`). Username regex (`^[a-zA-Z0-9_.-]{3,32}$`) is a strict superset of displayName's attack-surface defense (no `<>&"\r\n` permitted by character class).

**Seed text (Q4-A):** `headline: "${username} / Profil"` + `bio: "${username} icin..."`. New users see username-based seed copy until they edit their own bio.

**Backfill script (Q5-A):** `display_name:` line removed from `toUserPayload`. Script remains dead (Postgres never deployed); cleaning the dead code per Q3-A spirit.

**Test baseline (Q6-A):** 545 → 539. T-IV14 through T-IV19 (6 displayName-specific tests) removed alongside `isValidDisplayName`. Username coverage preserved via existing T-IV01 through T-IV13.

**LOC delta:** Pre-flight scope discovery estimated `~-135 net`. Actual `~-296 net` (78 insertions, 374 deletions, 44 files). Overrun attributable to:
  - 6 displayName-specific test cases averaged ~12 LOC each (~70 LOC removed; estimate was ~60).
  - `soc-store.ts` SQL column references repeated across multiple SELECT/INSERT statements (~30-40 LOC vs. estimated ~25).
  - Mini profile card removal in `PortfolioWorkspace.tsx` was ~30 LOC (estimate noted "20-30 LOC depending on wrapper" — landed at upper bound).
  - R-14 Layer 2 narrative comment blocks (~20 LOC) removed instead of preserved per Q3-A spirit.
  Operator notified in Wave 14.C final report. All 6 Q-decisions remained intact; over-removal is scope-aligned, not scope creep.

**Migration safety:**
  - Production runs `SOC_IDENTITY_STORE=supabase` (JSON Storage). JSON tolerate-on-read means zero production data migration required.
  - SQLite legacy (`SOC_STORAGE=sqlite`): schema edit + adapter cleanup. Current production doesn't touch this path; dev-only mode.
  - Postgres blueprint: schema edit (`platform-backbone-v1.sql` L13 removed) + NEW migration file (`wave-14-c-drop-display-name.sql`) staged for future deploy. Z.10 honest: blueprint never applied to production.

**Wave 11 lineage:** This is the 2nd "field removal" cycle following Wave 11 website-field pattern (A-25 closure). Establishes operator-approved deprecation protocol: stop write, tolerate read, document deferral. Cross-reference: Wave 11 commit `03f3884`.

**Pattern catalog impact:** **zero new patterns.** Mechanical refactor + UX simplification. Pattern Catalog instance counts unchanged.

**Production smoke target (Faz 14.D operator-manual, post-push):**
  - `/register` form: 4 fields visible (no "Görünen ad" input).
  - `/portfolio` UI: mini profile card top-right gone; large profile card heading shows headline only (no displayName-derived heading); username displayed plain (no `@` prefix).
  - Verification email (resend): "Merhaba {username}," in body.
  - Avatar SSR (Wave 13.C) still resolves; saving profile still triggers `router.refresh()` (Wave 10) → fresh Server Component render.
  - "Zerooooo" residue: invisible after refresh (silent-ignore on JSON read; UI displays username).

### A-29 — UI polish: bio overflow + preview username removal + header refactor (Wave 14 Faz 14.D)

- **Status:** RESOLVED in Wave 14.D commit `18674c5`
- **Origin:** Wave 14.C post-deploy operator smoke. Three independent UI issues surfaced after the system-wide `display_name` removal:
  1. Bio textarea accepted unbounded input; long unbroken paste-strings overflowed horizontally → broke right-column preview layout.
  2. Right preview card showed a redundant 3rd line (`<p>{data.user.username}</p>` below heading + location) — leftover from Wave 14.C's `@username` prefix removal at the same site.
  3. Page header carried `route-kicker` label ("Portfolio Control Surface") + h1 ("Profil merkezi") + subtitle paragraph — operator UX review: label was the actual descriptive heading, the h1 + subtitle were redundant noise.

**Closure (Wave 14.D commit `18674c5`):**

- **Bio overflow:** `src/components/portfolio/PortfolioWorkspace.tsx:1067-1093` — textarea wrapped in `md:col-span-2` container with `maxLength={BIO_MAX_LENGTH}` (500), `whitespace-pre-wrap break-words resize-y` classes (preserves line breaks, wraps long unbroken strings, vertical-only resize). Below it: live character counter `<p id="bio-counter" aria-live="polite">{length} / 500</p>` with tri-state color (muted slate → amber at ≥ 450 → rose at ≥ 500). `onChange` defensively `.slice(0, BIO_MAX_LENGTH)` so even paste-input above the limit is silently clamped. Preview at L1148 also gets `whitespace-pre-wrap break-words`.
- **Validator mirror:** `src/lib/portfolio-validation.ts:30-34,93-96` — `BIO_MAX_LEN = 500` constant + new check inside `validateProfilePayload`: `if (payload.bio.length > BIO_MAX_LEN) return 'Biyografi en fazla 500 karakter olabilir.'`. Direct API callers (curl / Postman / future SDK) cannot bypass the UI cap.
- **Preview username line removal:** `src/components/portfolio/PortfolioWorkspace.tsx:1111-1113` (pre-edit) — the standalone `<p className="mt-2 font-mono ... text-emerald-300/55">{data.user.username}</p>` removed entirely. Heading + location color/styling preserved unchanged. Username still appears in avatar `alt` attributes (a11y), `getInitials` placeholders, and social-link entries — all functional, not duplicate display.
- **Header refactor (Z.17):** `src/components/portfolio/PortfolioWorkspace.tsx:927-942` — pre-edit had three elements (`<p className="route-kicker">Portfolio Control Surface</p>` + `<h1 className="route-title">Profil merkezi</h1>` + subtitle `<p>`). Post-edit: single `<h1>` with mono font + ALL CAPS preserved + widened tracking (`letter-spacing: 0.24em`) + larger size (`text-2xl md:text-4xl`) + neon green palette via `color: rgb(var(--route-accent-rgb))` + glow `textShadow` for capstone-grade aesthetic. Container padding bumped from `py-6` to `py-8 md:py-10` for breathing room.

**Tests (4 new, total 543):**

- **T-BIO-LIMIT** (`src/components/portfolio/__tests__/PortfolioWorkspace.test.tsx`) — asserts `bioTextarea.maxLength === 500`.
- **T-BIO-COUNTER** (same file) — asserts initial render shows `"11 / 500"` (bio fixture is "Initial bio" = 11 chars); counter element has `id="bio-counter"`.
- **T-USERNAME-REMOVED** (same file) — asserts no `<p>` element renders the plain username `"operator"`; heading + avatar paths unaffected.
- **T-VAL-BIO-MAX** (`src/lib/portfolio-validation.test.ts`) — boundary cases: exactly 500 chars valid, 501 chars returns error matching `/Biyografi/i` and `/500/`.

**Test baseline:** 539 → **543** (+4).

**Pattern catalog:** **zero new patterns.** UI refinement only.

**Files touched (6):**
- `src/components/portfolio/PortfolioWorkspace.tsx` (header + preview + bio textarea + preview wrap)
- `src/lib/portfolio-validation.ts` (BIO_MAX_LEN + validator)
- `src/components/portfolio/__tests__/PortfolioWorkspace.test.tsx` (+3 tests)
- `src/lib/portfolio-validation.test.ts` (+1 test)
- `docs/audit/phase-1-a-pending-amendments.md` (this A-29 entry)
- `docs/SCOPE_DECISIONS.md` (Z.17 entry)

**Lineage:** Wave 14.C system-wide `display_name` removal exposed three visual redundancies that the prior heavier layout had masked. Wave 14.D closes them surgically without schema / API / storage churn. **No new defense-in-depth pattern**, just UI polish. Capstone-teslim-ready post Faz 14.E operator smoke.

**Production smoke target (Faz 14.E operator-manual, post-push):**
  - `/portfolio` page header: single big neon-green ALL CAPS "PORTFOLIO CONTROL SURFACE" heading. No "Profil merkezi". No subtitle paragraph.
  - Preview card (large): 2 lines visible (heading + location). No 3rd `@username` or plain username line.
  - Bio textarea: type 500+ chars → input clamps at 500; counter shows `500 / 500` in rose color; no horizontal overflow even with long unbroken paste strings.
  - Bio counter colors transition: muted → amber at 450 → rose at 500.
  - Avatar (Wave 13.C SSR resolve) still loads.
  - Save chain (Wave 10 router.refresh()) still triggers Server Component re-render.

## Total test count revision

Audit Section 7 mentions ~140 cases. Actual planned count is now 141+ (will grow with further discoveries during Phase 1.D.6-D.20).

Current Phase 1.D progress: **20/20 files COMPLETE — Phase 1.D FINISHED** (security, rate-limiter, identity-validation, identity-rules, client-ip, auth-shared, email-templates, api-auth, soc-store-adapter, middleware, register, login, logout, session, verify, verify-resend, forgot, reset, reset-validate, cross-cutting), 175 Phase 1.D tests written, 190 total vitest tests (Phase 1.D + 15 pre-existing infrastructure).
