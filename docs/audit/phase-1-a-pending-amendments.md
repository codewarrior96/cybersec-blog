# Phase 1.A — Pending Amendments

Pending audit revisions discovered during Phase 1.D test writing. To be applied in next audit revision turn.

## Status: pending review by Salim

## Items

### A-01 — T-IR02/T-IR03 mapping correction
- **Discovered in:** Phase 1.D.4 (identity-rules.test.ts)
- **Issue:** Audit Section 5 → identity-rules.ts table maps T-IR02 (case) and T-IR03 (whitespace) to R-09. This is incorrect — `normalizeIdentityUsername` already applies `trim().toLowerCase()` before Set lookup, so case+whitespace variants ARE detected. These are happy-path tests, not gap tests.
- **Action:** Update Section 5 → identity-rules.ts table → T-IR02 and T-IR03 rows → "Maps to" column → `—` (empty).

### A-02 — R-21 new risk: truncated hash storage attack
- **Discovered in:** Phase 1.D.1 (security.test.ts T-S09)
- **Issue:** While documenting the L19 dead-code gap, agent identified a real exploit: an attacker with storage write access can write a truncated hashHex to any user's record. verifyPassword then accepts any password whose first-N-byte scrypt output matches the truncated stored prefix. Requires prior storage compromise, not a remote vector.
- **Severity:** Low (requires storage write access)
- **OWASP:** A02 Cryptographic Failures
- **File(s):** security.ts (downstream of L19 dead code)
- **Related test:** T-S09 currently documents the L19 dead-code gap. R-21 is downstream of that gap.
- **Action:** Add R-21 to Section 2 risk register. Currently tested by T-S09 indirectly — consider whether a separate explicit T-S10 test is needed (e.g. write truncated hash directly to mock store, attempt login with arbitrary password, verify acceptance).

### A-03 — R-01 scope correction (Vercel-specific → all production)
- **Discovered in:** Phase 1.D.5 (client-ip.test.ts T-CI11a)
- **Issue:** Audit R-01 description focuses on "Vercel multi-instance dispatch." Actual code at client-ip.ts L24: `return process.env.VERCEL === '1' || process.env.NODE_ENV === 'production'`. NODE_ENV=production alone triggers trustProxy=true. R-01 affects every production deployment (AWS, DigitalOcean, VPS, bare-metal, self-hosted), not just Vercel.
- **Action:** Update Section 2 → R-01 row → File(s) and Risk columns to reflect broader scope. Consider whether severity should escalate to Critical given the wider attack surface.

### A-04 — Test count update for client-ip.test.ts
- **Discovered in:** Phase 1.D.5
- **Issue:** Audit Section 5 → client-ip.ts table lists T-CI11 as single test. Phase 1.D.5 split it into T-CI11a (production gap, R-01 broader scope) and T-CI11b (safe baseline). File now has 13 tests, not 12.
- **Action:** Update Section 5 → client-ip.ts table to add T-CI11a and T-CI11b rows. Update Section 1 / Section 7 if test counts referenced.

### A-05 — T-IV06 consecutive dots gap (R-09 broader)
- **Discovered in:** Phase 1.D.3 (identity-validation.test.ts)
- **Issue:** USERNAME_RE = /^[a-zA-Z0-9_.-]{3,32}$/ has no constraint against consecutive dots. `a..b` is accepted. Audit had T-IV06 as gap test mapped to R-09, but R-09's narrative focused on reserved-list completeness. Consecutive dots are a separate vector under the same risk category — confusion in audit logs, conflicts with filesystem/DNS conventions if usernames are ever used as path segments.
- **Action:** Update Section 2 → R-09 row → Risk column to mention consecutive-dot acceptance as a sub-vector. No new R-NN needed; R-09 broadens.

### A-06 — API name correction: isAllowedUsername (not isValidUsername)
- **Discovered in:** Phase 1.D.3 (identity-validation.test.ts)
- **Issue:** Audit Section 5 → identity-validation.ts sub-section refers to `isValidUsername`. Actual export is `isAllowedUsername`. Other API names are correct (isValidPassword, isValidDisplayName, isValidEmail, validateEmail).
- **Action:** Update Section 5 → identity-validation.ts narrative wherever `isValidUsername` appears → replace with `isAllowedUsername`.

### A-07 — Phase 1.D.6 prompt drift (informational, not an audit error)

- **Discovered in:** Phase 1.D.6 plan review
- **Issue:** Phase 1.D.6 prompt drafted by mentor used assumed function names (roleAtLeast, canEdit, canDelete, getRoleHierarchy) that did not match audit Section 5 (which correctly specifies hasRoleAtLeast and canWriteAlerts, matching actual source). Agent caught the drift during plan phase.
- **Action:** NO audit change needed — audit is correct. Entry documents prompt drift for future mentor-prompt hygiene. Lesson: re-read audit Section 5 verbatim when drafting sub-stage prompts.

### A-08 — auth-shared T-AS09 defensive default test (added in Phase 1.D.6)

- **Discovered in:** Phase 1.D.6 plan review (agent observation)
- **Issue:** hasRoleAtLeast(unknownRole, validRequired) returns false because ROLE_ORDER.indexOf(unknownRole) === -1, and -1 >= validIndex is false. This is correct OWASP A01-aligned defense-in-depth behavior but not in original audit Section 5.
- **Test added:** T-AS09 (file: src/lib/auth-shared.test.ts).
- **Action:** Next audit revision — update Section 5 → auth-shared.ts table to include T-AS09. Update Section 1/7 references from 8 to 9.

### A-09 — Phase 1.D.7 prompt drift (informational, third occurrence)

- **Discovered in:** Phase 1.D.7 plan review
- **Issue:** Mentor-drafted Phase 1.D.7 prompt drifted from audit Section 5 in three places: (1) param name `displayName` vs actual `username`, (2) R-15 attack model used `vi.stubEnv('NEXT_PUBLIC_APP_URL')` but module does not read this env — URL arrives as direct parameter, (3) T-ET07 prompt premise (trailing-slash handling) has no source-code surface — module performs raw URL interpolation only.
- **Action:** NO audit change needed — audit Section 5 is correct on all three counts. Entry documents third drift occurrence (after A-07 in Phase 1.D.6, and original prompt drift fixed in T-S09/T-IR02-03/T-CI11 audit corrections). Pattern is now systemic — recommend adding to CLAUDE.md a sub-stage prompt protocol: "When drafting sub-stage prompts, copy audit Section 5 row verbatim. Do not paraphrase from memory."

### A-10 — T-AD07 audit prose drift (Supabase outage vs sqlite outage)

- **Discovered in:** Phase 1.D.9 plan review
- **Issue:** Audit T-AD07 scenario states "Production + Supabase outage → memory fallback silent (full R-03 reproduction)", and R-03 narrative (Section 2) likewise frames the trigger as "Supabase outage." However, the actual source has NO supabase→memory fallback path — when `useSupabaseIdentityStore=true`, identity functions early-return `supabaseStore.X(...)` with no try/catch (e.g. soc-store-adapter.ts L101-103). A supabase failure propagates to the caller as a thrown error. The real R-03 vector is: production env (auto-enables `allowCriticalMemoryFallback`) + identity store mode set to anything OTHER than 'supabase' (or supabase app state disabled) + `SOC_STORAGE=sqlite` + sqlite call throws → withStore silently routes to memory store with only a console.error log.
- **Test implementation:** T-AD07 in src/lib/soc-store-adapter.test.ts probes the real vector (production + sqlite outage chain), not the audit-prose-described "Supabase outage." Comments in the test document the prose drift inline.
- **Action:** Next audit revision — (1) update Section 2 → R-03 description "Supabase outage" → "primary store outage (sqlite or postgres backend failure under non-supabase identity mode)"; (2) update Section 5 → soc-store-adapter table T-AD07 scenario → "Production + sqlite outage → memory fallback silent (full R-03 reproduction)"; (3) consider whether a separate gap-test or future risk entry is needed to document the supabase-throws-no-fallback behavior (likely correct as-is, since fail-loud on identity store outage is preferable to silent memory fallback for supabase-deployed prod environments).

### A-11 — R-16 severity revision (CSRF check provides full cross-origin mitigation)

- **Discovered in:** Phase 1.D.10 plan review (T-MW06 R-16 narrative verification, mentor-prompted)
- **Issue:** R-16 (Low, A04) original description claims "Logout endpoint in PUBLIC_API_ROUTES; CSRF-able logout possible" with attack vector "Attacker iframes/links to /api/auth/logout via cross-site form; victim's session terminated." Source analysis disproves this:
  1. **Logout route exports POST only** (src/app/api/auth/logout/route.ts has no GET handler). GET-based CSRF (`<img src="https://victim/api/auth/logout">`) returns 405 Method Not Allowed — never reaches middleware or route logic.
  2. **CSRF check fires on ALL mutations** (middleware.ts L80-90), including for paths in PUBLIC_API_ROUTES. The PUBLIC_API_ROUTES bypass affects ONLY `sessionPresenceCheck` (L92-101), NOT `csrfCheck`. The middleware function runs csrfCheck FIRST (L106-107), then sessionPresenceCheck.
  3. **Cross-origin POST is blocked at the edge.** `<form action="https://victim/api/auth/logout" method="POST">` auto-submitted from attacker.com → browser sets `Origin: https://attacker.com` (Fetch spec: forbidden header, JS cannot override) → claimedHost='attacker.com', requestHost='victim.com' → mismatch → 403 'Origin mismatch'.
- **Residual attack surface:** Same-origin XSS only. A script already running on victim.com can call `fetch('/api/auth/logout', {method:'POST', credentials:'include'})` → Origin matches → CSRF passes → PUBLIC_API_ROUTES bypasses session check → logout succeeds. But this requires existing XSS, which is its own (much larger) risk class. R-16's incremental contribution beyond "you have XSS" is informational at best.
- **Test implementation:** T-MW06 in src/middleware.test.ts retains as a regression guard for the documented current behavior (PUBLIC_API_ROUTES bypasses session check on POST /api/auth/logout). Comment block explicitly walks through the corrected narrative + hardening landing if /api/auth/logout is later removed from PUBLIC_API_ROUTES.
- **Action:** Next audit revision — (1) revise R-16 severity from **Low → Informational** (or remove from risk register entirely, since CSRF check provides full cross-origin mitigation); (2) update R-16 description to acknowledge the CSRF gate fires on PUBLIC_API_ROUTES paths and that logout accepts only POST; (3) note residual surface (same-origin XSS) is out of scope of R-16's PUBLIC_API_ROUTES gap and properly attributable to a future XSS risk class; (4) audit Section 5 T-MW06 "Maps to" column may keep R-16 reference for traceability, but consider downgrading to "—" since the documented behavior is correct-by-design.

### A-12 — register rate-limit double-counts successful requests

- **Discovered in:** Phase 1.D.11 plan review (T-RG09 surface analysis)
- **Issue:** register/route.ts L71-73 calls recordFailure on EVERY request that passes the rate-limit check (success + validation-fail + storage-success). This is a "force record" pattern that does not differentiate. Result: 10 successful registrations from same IP exhausts the bucket, blocking legitimate retries. Likely intentional (defense against enumeration), but should be documented.
- **Severity:** Low (intentional defense, side effect is rate-limit accuracy)
- **Action:** Document in audit Section 2 as informational, OR confirm with maintainers that the design intent is "any contact from this IP counts." If the latter, add note to R-02 (rate-limiter accuracy) discussing this design choice.

### A-13 — R-05 TOCTOU lacks direct concurrent-execution test

- **Discovered in:** Phase 1.D.11 plan review
- **Issue:** R-05 (TOCTOU race window in register/route.ts L116-126 between readUserByEmailKey and registerUser) is currently tested only indirectly via T-RG12 (storage layer's race-guard returns 'Email already exists'). A direct test would simulate two concurrent register calls and verify storage prevents both from succeeding.
- **Action:** Add explicit concurrent-execution test to soc-store-adapter.test.ts (Phase 1.D.9 already complete) or create dedicated race-condition test in Phase 2 storage suite. Test would use Promise.all on two register calls with same email.

### A-14 — Login response-code enumeration via EMAIL_NOT_VERIFIED (intentional UX tradeoff)

- **Discovered in:** Phase 1.D.12 plan review (T-LG03 surface analysis)
- **Issue:** login/route.ts L83-97 distinguishes "wrong password" (401 'Hatali kullanici adi veya sifre.') from "right password, unverified email" (403 EMAIL_NOT_VERIFIED + email field). This response-code split reveals username existence for accounts in unverified state. The 403 response also includes the user's email address (best-effort lookup via readUserByUsername; supabase store returns email, memory/postgres return null), which adds an additional information leak when the supabase-JSON store is active. Documented in source comments L76-82 as an intentional UX tradeoff: "distinguishing 'wrong password' (401) from 'right password, unverified email' (403) reveals that the username exists. We accept this for UX — the alternative (silently failing an authenticated-but-unverified login) is confusing and pushes users toward password resets that won't help."
- **Severity:** Low (only enumerates accounts in unverified state — narrow window between register and verify-click; once verified, indistinguishable from non-existent account at this layer). Register-time emailKey uniqueness already provides equivalent enumeration signal, so login parity here is internally consistent.
- **OWASP:** A07 (Identification and Authentication Failures) — username enumeration sub-category. Distinct from R-04 (timing-based enumeration); this is response-shape enumeration.
- **Action:** Next audit revision — add **R-22** entry to Section 2 risk register (R-21 was previously the last reserved number per A-02 truncated-hash addition). R-22 documents this response-code enumeration as a by-design tradeoff rather than a defect; severity Low, A07. **Phase 1.5 hardening proposal:** generic 401 response for ALL wrong-credentials and unverified cases, paired with an "invisible resend" path that silently re-fires verification email on every wrong-password attempt against an unverified account. Loses the resend-prefill UX in exchange for closing the enumeration vector. Test guard via T-LG03 already in place — when hardening lands, T-LG03 must flip from asserting 403 EMAIL_NOT_VERIFIED to asserting 401 + audit-log entry showing invisible-resend dispatched. **Implementation reference:** verify/resend/route.ts is the anti-enumeration BENCHMARK in the codebase — its generic-200 collapse pattern (T-VR02/T-VR03/T-VR07 invariant trio) is the template Phase 1.5 should mirror for login hardening.

### A-15 — R-18 scope broaden (verify-resend has same email-keyed rate-limit lockout vector)

- **Discovered in:** Phase 1.D.16 plan review (T-VR04 source verification)
- **Issue:** R-18 (Medium, A04) original description specifies File(s)=`forgot/route.ts` only: "Email-keyed rate limit (3/hour) lets attacker exhaust victim's reset budget if email known. Attacker spams /api/auth/forgot with victim's email. Limit hits 429. Victim's legitimate reset attempts blocked for 1h." However, verify/resend/route.ts has the SAME vulnerability — RESEND_RATE_LIMIT (source L15-19) is keyed off emailKey with max=3/windowMs=1h, identical pattern. Audit Section 5 acknowledges this implicitly by mapping T-VR04 to R-18, but R-18's literal File(s) field doesn't include verify-resend.
- **Severity:** Same as R-18 (Medium) — vector identical, just second file affected. Same victim-lockout DoS: attacker who knows victim's email can burn through the 3-attempt budget in seconds, locking out victim's legitimate verify-resend requests for ~1 hour.
- **Action:** Next audit revision — update R-18 → File(s) column to `forgot/route.ts, verify/resend/route.ts`. Hardening proposal (combined IP+email rate-limit, deferred to Phase 1.5 or Phase 3) applies to both files identically. Test guards in place at both T-FG-? (forgot, Phase 1.D.17) and T-VR04 (verify-resend, Phase 1.D.16).

## Total test count revision

Audit Section 7 mentions ~140 cases. Actual planned count is now 141+ (will grow with further discoveries during Phase 1.D.6-D.20).

Current Phase 1.D progress: 17/20 files complete (security, rate-limiter, identity-validation, identity-rules, client-ip, auth-shared, email-templates, api-auth, soc-store-adapter, middleware, register, login, logout, session, verify, verify-resend, forgot), 155 Phase 1.D tests written, 170 total vitest tests (Phase 1.D + 15 pre-existing infrastructure).
