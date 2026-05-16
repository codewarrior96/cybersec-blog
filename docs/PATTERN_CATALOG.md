# Engineering Pattern Catalog

Eighteen named patterns discovered, applied, or extended during the audit closure cycle. Each pattern documents instance count + lineage references + cycle of first application.

---

## 1. Defense-in-depth two-layer pattern (6 instances)

**Shape**: Layer 1 (input sanitization at the trust boundary) + Layer 2 (output safe-default rendering / consumer-side validation). Each layer alone is sufficient under normal conditions; together they survive a single-layer bypass.

| # | Instance | Layer 1 | Layer 2 | Cycle |
|---|---|---|---|---|
| 1 | **R-13** displayName HTML-injection | `identity-validation.ts` denylist `/[<>&"]/` | `email-templates.ts` HTML escape via `html-escape.ts` | Phase 1.5.2 (`6d78cf1`) |
| 2 | **R-21** scrypt truncated-hash | `hashPassword` self-validate output | `verifyPassword` `assertHashFormat` first-action | Phase 1.5.4 (`ed403df`) |
| 3 | **R-15** verify/reset URL substrate | `assertSafeUrl` in `email-templates.ts` (env-gated scheme allowlist) | `email.ts` catch `EmailUrlValidationError` → discriminated-union | Phase 1.5.10 (`5d2f6cc`) |
| 4 | **A-17** SOC_DEMO_SECRET lazy init | `instrumentation.ts` boot validator (`register()` hook) | `getMemorySecret()` lazy getter throws on first use | Phase 1.5.15 (`835cc3a`) |
| 5 | **R-API-05** stored-XSS via report content | `sanitize.ts` `sanitizeReportContent` regex strip at POST | React/MDX safe-default text rendering (no `dangerouslySetInnerHTML`) | Phase 3.D (`152d872`) |
| 6 | **R-API-13** profile bio + headline XSS | `sanitize.ts` reuse — same `sanitizeReportContent` invoked on `bio` + `headline` before validation | Same React/MDX safe defaults | Wave 2B (`775525c`) |

**Why six and not seven**: the pattern is consciously bounded — each instance has distinct Layer 1 + Layer 2 file pairs. A 7th instance would either duplicate an existing pair or trigger a refactor to a shared abstraction.

---

## 2. Gap-test → regression-guard lifecycle (2 transitions)

**Shape**: when a fix is out-of-scope for the current cycle but the bug is observable, write a test that LOCKS the current (buggy) behavior with a name suffix `-GAP`. A future cycle flips the assertion + drops the suffix; the test file's git history documents the transition.

| # | Gap-test (locks current state) | Regression guard (flipped assertion) | Cycle |
|---|---|---|---|
| 1 | `T-MO-CHMOD-EQ-GAP` (chmod `=` deviates from POSIX) | `T-MO-CHMOD-EQ01` (POSIX `=` clear-then-set) | Wave 2B (`775525c`) |
| 2 | `T-CAP-A11-GAP` (dismiss button missing aria-label) | `T-CAP-A11-DISMISS` (aria-label present, axe button-name passes) | Wave 6 (`fd88d15`) |

---

## 3. Z.10 production-vs-blueprint discipline

**Shape**: state gathering during Phase D MUST verify production reality via `information_schema` query (Supabase Postgres), `SELECT` from Storage JSON path, or equivalent live-state probe — not just file-read of SQL migration scripts. Discovered during Phase 3.D revision when `platform-backbone-v1.sql` was found to define 21 tables that were never applied to production.

**Locked as permanent convention** in Phase 3.A Section 9 Z.10. Re-cited as Phase 4.A Z.8 + Phase 5.A Z.10. Applies forward to every Phase D state gathering step.

**Side-effect**: R-API-03 RECLASSIFIED rather than FIXED — RLS migration cannot target non-existent tables. Future deployment cycle MUST ship `platform-backbone-v1.sql` + RLS migration together.

---

## 4. Mentor-error correction protocol (2 cycles)

**Shape**: when an audit decision is later corrected by source evidence, the original decision is **NOT silently overwritten**. Instead:
1. The original row stays intact.
2. A new amendment in `phase-1-a-pending-amendments.md` documents the source evidence + the corrected narrative.
3. The amendment closure resolution narrative is referenced from the original row's STATUS suffix.

| # | Original framing | Corrected narrative | Amendment |
|---|---|---|---|
| 1 | R-03 framed as "Supabase outage → memory fallback" | Actual surface: sqlite failure under prod env routes Class 2 + Class 3 writes silently | A-10 |
| 2 | R-16 framed as "logout CSRF-able via PUBLIC_API_ROUTES" | CSRF middleware fires on ALL mutations; logout exports POST only; severity downgraded Low → Informational | A-11 |

---

## 5. Honest deferral with explicit reason

**Shape**: every deferred item carries a reason inline, so an auditor can grep for "Phase 6" + "Yol A" + "deferred" + "DOC-ACCEPT" and find every postponement with explanation.

Instance examples:
- `test.skip()` calls in `e2e/journey-*.spec.ts` (9 total) — each carries explicit "Yol A declined" comment + Phase 6 dependency.
- `R-LAB-01` accepted-by-policy — portfolio-demo context, not graded competition.
- `R-API-03` RECLASSIFIED with Z.10 narrative attached.
- `R-UI-03` DOC-ACCEPT with aesthetic-tradeoff rationale.
- `R-LAB-08` DOC-ACCEPT with educational-fidelity rationale.
- 6 Phase 1 OPEN R-XX entries — Low/Medium severity, named, deferred to Phase 6+.

---

## 6. Surgical Top-3 scope per Phase D

**Shape**: each Phase D cycle (Phase 1.D, 2.D, 3.D, 4.D, 5.D) selected exactly **3 surgical targets** to write tests against, chosen by ROI (test coverage × audit closure impact / scaffolding cost). Z.1 of each phase audit locked the Top-3.

| Phase | Targets |
|---|---|
| 1.D | login, register, verify-resend (auth bootstrap fan-out) |
| 2.D | validation/contract, mutation/operations, ctf-regression (Lab Engine core) |
| 3.D | profile/certifications, alerts, reports (API CRUD surface) |
| 4.D | useFocusTrap, AnsiText, SearchModal (single-primitive-with-broad-blast-radius) |
| 5.D | J-1 auth bootstrap, J-2 Lab L1 solve, J-3 portfolio cert CRUD (E2E user journeys) |

---

## 7. Forward-iteration on unpushed commits (Phase 1.5.14.1 lineage)

**Shape**: when a wave commit is created with a `<COMMIT_HASH_TBD>` placeholder, a `.1` cleanup commit is created within the same session, BEFORE the push to `origin/main`, that resolves the placeholder. The two commits are pushed together. This keeps the audit-trail honest (the closing commit's hash is the literal hash of that commit) without amending or force-pushing.

**Standard 2-commit pattern**: every wave from Wave 2B forward uses this. Cleanup commit message is always `docs(wave-NX.1): Wave NX commit hash resolution`.

---

## 8. Compensating-control composition

**Shape**: when a primary fix has acceptable residual risk, **compensating controls** are listed in the audit row STATUS suffix as activated mitigations.

**Canonical example**: R-01 sub-vector 2 (x-forwarded-for chain extraction) — sub-vector 1 was FIXED with explicit `TRUST_PROXY_HEADERS=1` opt-in; sub-vector 2 ACCEPTED with these compensating controls:
1. R-06 audit logging (Phase 1.5.11) records all 429 events with `keyPreview` for forensic IP-rotation detection.
2. R-02 Supabase-backed rate-limiter (Phase 1.5.9) accumulates state across instances — attacker cannot reset counters by instance-hopping.

---

## 9. Soft reset + replace pattern

**Shape**: when a primitive is migrated from per-process state to shared state, the old API is preserved (for test ergonomics) but its semantics shift.

**Canonical example**: rate-limiter migration (R-02). `__resetAllForTests()` was preserved as the export name, but: (a) became async (returns `Promise<void>`), (b) clears Supabase `public.rate_limits` table + globalThis Map fallback, (c) NODE_ENV=production guard throws to prevent supply-chain wipe (R-08 closure).

---

## 10. Bare SQL migration (operator manual apply)

**Shape**: when a Supabase schema change ships, the SQL file is checked into `supabase/*.sql` and the operator applies it manually via the Supabase dashboard SQL editor. NO code-driven migrations.

**Rationale**: capstone context, single-operator deploy cadence, Supabase Postgres pricing tier doesn't include schema-as-code tooling. Z.10 lesson reinforced: blueprint ≠ production state.

**Instances**:
- `supabase/attack-events.sql` — applied.
- `supabase/rate-limits.sql` — applied (Phase 1.5.9.0 commit `a08d8f3`).
- `supabase/platform-backbone-v1.sql` — NOT applied (Z.10 finding). 21 tables exist in blueprint only.

---

## 11. Content security layer (EncodedCodeBlock AV-bypass)

**Shape**: MDX-embedded code samples that mention attack payloads (XSS strings, SQL injection, reverse shells) are routed through `EncodedCodeBlock` to bypass corporate AV / proxy scanners that might block the page on payload-match. The component decodes at render time client-side; the served HTML contains only the encoded form.

**Instance**: `src/components/blog/EncodedCodeBlock.tsx` used by 8 MDX blog posts containing security examples.

---

## 12. Lazy getter + boot validator

**Shape**: a security-critical env var is consumed via a lazy getter (module-load is no-op; first use throws if env unset), paired with a fail-loud boot validator at `instrumentation.ts:register()` for production runtimes.

**Canonical instance**: A-17 closure (Phase 1.5.15) — `getMemorySecret()` lazy getter in `src/lib/soc-store-memory.ts` + `src/instrumentation.ts` Next.js `register()` hook. Pattern eliminated the build-time eager-throw at module load that was breaking `npm run build` when env unset (Phase 1.5.13/.14/.14.1 incident lineage).

---

## 13. Test ID collision detection

**Shape**: every test in the project has a unique test ID prefix (`T-XX-NN`) per surface. Per-phase prefix conventions locked in each Phase D Z (e.g., T-PC = profile certifications, T-AL = alerts, T-RP = reports). A new prefix is added only when a new feature surface is introduced. Phase audits Section 5 hold the canonical prefix table.

**Cross-phase reuse**: `T-CAP-A11` originated in Wave 2A (R-UI-04); same prefix reused in Wave 6 for `T-CAP-A11-DISMISS` because both test the same surface (CriticalAlertPanel a11y).

---

## 14. axe-smoke per-modal pattern (7 instances)

**Shape**: each modal/dialog/overlay surface has a dedicated axe-scoped smoke test covering ONLY the WCAG rules that surface owns. Broad `axe(container)` calls are intentionally avoided — they produce false-failure noise on rules the surface doesn't address.

**Instances** (one per surface):
1. `T-FT-A11` — `useFocusTrap` 5 modals' shared primitive.
2. `T-CAP-A11` — `CriticalAlertPanel`.
3. `T-CAP-A11-DISMISS` (Wave 6) — same surface, dedicated button-name guard.
4. `T-AR-A11` — `AttackReportModal`.
5. `T-DA-A11` — `DeleteAccountModal`.
6. `T-NB-A11` — `NavigationBar` mobile drawer.
7. `T-SM-A11` — `SearchModal`.

Each test enables a specific rule set + disables the rest with explanatory comments.

---

## 15. SectionErrorBoundary per-section composition

**Shape**: a generic class component `<SectionErrorBoundary section="..." fallback={...}>` provides per-panel isolation. Composed INSIDE a legacy top-level `<ErrorBoundary>` (belt + suspenders, pattern #18 below).

**Instance**: `src/components/SectionErrorBoundary.tsx` (introduced Wave 5A `3b20855`). Wraps `<DashboardLayout>` in `HomePageClient`. Future cycles can wrap individual panels (TelemetryStream, GlobalMap, CriticalAlert) without restructuring.

---

## 16. Hover/focus-pause for time-out UI

**Shape**: any UI element with an auto-dismiss timer (toast, banner, popover) MUST expose `onMouseEnter` / `onMouseLeave` (hover-pause for mouse operators) + `onFocus` / `onBlur` (focus-pause for keyboard / screen-reader operators). Timer state is held in `useRef<number | null>` for explicit clear + restart.

**Instance**: `src/components/dashboard/Toast.tsx` (R-UI-07 closure, Wave 5A). WCAG 2.2.4 (Interruptions, AAA-leaning). T-TP-HOVER / T-TP-FOCUS / T-TP-RESUME lock the contract.

---

## 17. AbortController.prototype-spy test pattern

**Shape**: when a component uses `new AbortController()` and the test needs to verify `abort()` was called, mocking the constructor with `vi.fn()` fails (native-class instantiation via `new` doesn't work with mock constructors). Instead, spy on `AbortController.prototype.abort` directly.

**Instance**: `T-AS-ABORT` + `T-AS-ABORT-RERUN` in `src/components/__tests__/AppShellClient.test.tsx` (R-UI-13 closure, Wave 5A). The pattern is documented as a comment in the test file for future tests using `AbortController`.

---

## 18. Belt-and-suspenders nested ErrorBoundary

**Shape**: a top-level legacy ErrorBoundary (catches catastrophic mount failures, plain-text English fallback) wraps a per-section `<SectionErrorBoundary>` (catches section-specific runtime errors, themed fallback). Either alone is sufficient under normal conditions; together they cover both "the whole app crashed" and "a single panel crashed" affordances.

**Instance**: `HomePageClient` authed branch (Wave 5A). Outer = legacy `ErrorBoundary`; inner = `<SectionErrorBoundary section="SOC Dashboard">`.

---

## Cross-pattern interactions

- **Pattern 1** (defense-in-depth) + **Pattern 12** (lazy getter + boot validator): A-17 is BOTH a defense-in-depth instance AND a lazy-getter instance. The boot validator is Layer 2; the lazy getter is Layer 1. Documented as 4th DiD instance specifically because the pattern's structural shape matches (two layers, each independently sufficient).
- **Pattern 2** (gap-test lifecycle) + **Pattern 4** (mentor-error correction): the gap-test pattern documents *known-unfinished work*, while mentor-error correction documents *retroactive-corrected work*. Both surface as audit-trail honesty markers; both are grep-able by suffix conventions (`-GAP` / `RESOLVED` / amendment numbers).
- **Pattern 6** (Top-3 scope) + **Pattern 5** (honest deferral): every Phase D Top-3 selection produces a "what got dropped" inverse list, which becomes the Phase 6 roadmap. The discipline is "scope IS the gate; choose deliberately."
- **Pattern 10** (bare SQL migration) + **Pattern 3** (Z.10 production-vs-blueprint): bare SQL migrations are the proximate cause of Z.10's value — manual apply means file content can drift from production state, which is precisely what the `information_schema` verification step catches.

---

## Pattern reuse outside this project

The Wave-based closure cadence, sub-stage stop-checkpoints, and audit-trail honesty markers are documented as reusable conventions in [`CLAUDE.md`](../CLAUDE.md). The Pattern Catalog above is the structural complement to that procedural documentation — patterns are *what* gets built, conventions are *how* the cycle runs.
