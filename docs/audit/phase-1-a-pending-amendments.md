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

## Total test count revision

Audit Section 7 mentions ~140 cases. Actual planned count is now 141+ (will grow with further discoveries during Phase 1.D.6-D.20).

Current Phase 1.D progress: 6/20 files complete (security, rate-limiter, identity-validation, identity-rules, client-ip, auth-shared), 66 tests written.
