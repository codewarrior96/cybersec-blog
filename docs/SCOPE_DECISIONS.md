# Mentor Scope Decisions (Z-Reference)

Consolidated list of strategic decisions made across phase audits. Each `Z.NN` entry locked a scope, methodology, or pattern at the time it was made; cycles after that point inherit the decision unless explicitly revisited.

Decisions are organized by the phase audit where they were first locked. Wave 5+ operator-confirmation decisions appended at the bottom.

---

## Phase 1.A — Security & identity

The first audit was scope-broad (22 R-XX entries) and produced its decisions during Phase 1.B / 1.C / 1.D sub-stages rather than as a single Z table. Key Phase 1 decisions, derived from `phase-1-a-final.md` and the Phase 1.5 hardening series:

- **Phase 1.5 series convention**: a hardening sweep separate from Phase 1.D test writing, organized as `Phase 1.5.X` sub-cycles (15 total). Each sub-cycle has its own commit + audit-row STATUS update.
- **R-21 lineage as defense-in-depth template**: the R-21 fix established the "Layer 1 + Layer 2" naming convention that 5 subsequent instances reuse (see [`PATTERN_CATALOG.md`](./PATTERN_CATALOG.md) § 1).
- **A-XX amendment ledger as audit-trail discipline**: every retroactive correction to a Phase 1 decision is recorded in `phase-1-a-pending-amendments.md` rather than silently overwritten in `phase-1-a-final.md`.

---

## Phase 2.A — Lab Engine

- **Z.1** R-LAB-01 severity adjusted **High → Medium**. Original framing assumed graded competition context; portfolio-demo context downgrades the severity. R-LAB-01 marked accepted-by-policy (flag strings remain in client bundle as educational reveal cues).

---

## Phase 3.A — API & Contracts

- **Z.1** Top-3 surgical targets for Phase 3.D: `profile/certifications` (R-API-01 IDOR), `alerts` (R-API-02 RBAC), `reports` (R-API-04/05 + cascade + XSS). All other API routes deferred to either Wave 5B or Phase 6.
- **Z.2** Phase 3.B + 3.C **SKIPPED**. The plan called for MSW handler scaffolding for external API integrations; Phase 3.D state gathering revealed `vi.mock('@/lib/soc-store-adapter')` at the module boundary is sufficient for the Top-3 targets. MSW infrastructure deferred until external-API E2E coverage in Phase 5.
- **Z.3** R-API-03 RLS asymmetry — initial attempt to fix; later **RECLASSIFIED** via Z.10 discovery.
- **Z.4** A-13 (direct concurrent register test) **absorbed into Phase 3.D Target #2** (alerts test file). The race-guard test lives in `src/app/api/alerts/__tests__/alerts.test.ts` bottom-of-file dedicated describe block, importing `soc-store-memory` directly (bypassing the adapter dispatcher to isolate storage-layer race semantics).
- **Z.5** A-15 (R-18 surface broaden to verify/resend) **audit-doc-only closure** — both surfaces already covered by T-FG10 + T-VR04 + T-FG11 + T-VR08. No test code change required.
- **Z.6** Severity taxonomy normalization (R-API-12) **deferred to Phase 4+**. Mentor confirmed dashboard wiring is the right forcing function. (Lifted in Wave 5B `bb488c6` — canonical 5-level normalizer in `src/lib/severity-taxonomy.ts` shipped.)
- **Z.7** Test ID prefixes for Phase 3.D: `T-PC` profile certifications, `T-AL` alerts, `T-RP` reports. Optional Target #4 prefixes pre-allocated: `T-UM` users/me, `T-PR` profile umbrella, `T-EX` external (cves/greynoise/cybernews). Some used in Wave 5B + 5C closures.
- **Z.8** R-API-05 + R-API-13 defense-in-depth pattern locked — `sanitize.ts` Layer 1 + React/MDX safe-default Layer 2. Reuse demonstrated 5th + 6th instances of the R-13 lineage (see [`PATTERN_CATALOG.md`](./PATTERN_CATALOG.md) § 1).
- **Z.9** Direct to Phase 3.D, no intermediate housekeeping cycle.
- **Z.10** **PRODUCTION STATE VERIFICATION MANDATORY** — Phase 3.D revision discovered `supabase/platform-backbone-v1.sql` (21 tables) was never applied to production. State gathering at Phase D MUST verify via `information_schema` query (Supabase Postgres), Storage JSON path read, or equivalent live probe — not just file content. **Permanent convention for Phase 4.A and beyond.**

---

## Phase 4.A — UI & Accessibility

- **Z.1** Top-3 surgical targets for Phase 4.D: `useFocusTrap` (single primitive shared by 5 modals — highest test ROI), `AnsiText` (pure parser, Terminal-routed-to-E2E), `SearchModal` (representative consumer of useFocusTrap + axe smoke).
- **Z.2** Phase 4.B atomic separate from 4.D. 4.B installs jsdom + @testing-library/react + vitest-axe + axe-core; 4.D writes the actual component tests.
- **Z.3** **jsdom over happy-dom** chosen for Phase 4.B environment. Stability + ecosystem maturity weighed over happy-dom's perf advantage.
- **Z.4** axe-core integration via `vitest-axe` matcher. Per-modal scoping convention locked (see [`PATTERN_CATALOG.md`](./PATTERN_CATALOG.md) § 14).
- **Z.5** Test ID convention for Phase 4.D: `T-FT` useFocusTrap, `T-AT` AnsiText, `T-SM` SearchModal. Sister prefixes pre-allocated: `T-CAP` CriticalAlertPanel, `T-AR` AttackReportModal, `T-DA` DeleteAccountModal, `T-NB` NavigationBar, `T-TP` Toast, `T-HP` HomePageClient, `T-AS` AppShellClient, `T-MR` MatrixRain.
- **Z.6** OperatorSidebar dead-code deletion routed to **Wave 2A housekeeping** (not Phase 4.D). The component is referenced by zero call sites.
- **Z.7** Emoji-as-icon aria-label wrap (R-UI-04) routed to **Wave 2A** since it's a code fix rather than a test-only closure.
- **Z.8** Z.10 production-verified convention from Phase 3.A re-cited as permanent. The audit doc's "production-verified column" stays mandatory.
- **Z.9** Phase 4.C **absorbed into 4.B**. The plan called for a mock-handler stage between infra (4.B) and tests (4.D); jsdom + RTL setup makes the mock layer trivial enough to merge.

---

## Phase 5.A — End-to-end

- **Z.1** Top-3 journeys: **J-1 auth bootstrap** (R-E2E-01 Critical, register → email-verify → login → home), **J-2 Lab L1 solve** (R-E2E-02 High, Community Terminal happy-path), **J-3 portfolio cert CRUD** (R-E2E-03 High, persistence round-trip).
- **Z.2** Phase 5.B + 5.C **atomic** (Playwright config + fixtures + Chromium install land together), 5.D separate (test cases).
- **Z.3** **Chromium-only**. Cross-browser deferred to Phase 6 — surgical scope choice.
- **Z.4** Resend `page.route()` interception (Wave 4A scaffolding) — when the journey needs an email verification step, the test intercepts Resend's outbound API call to capture the verification URL inline.
- **Z.5** **Ephemeral random per-run user** — every Playwright run generates a new username via `Date.now() + Math.random()` to avoid cross-run state pollution. No fixture user.
- **Z.6** **Hybrid storageState** approach — login flow runs once at suite setup; subsequent specs reuse the storage state. Saves ~3s per spec.
- **Z.7** **GitHub Actions workflow on main push** (`.github/workflows/e2e.yml`), initially gated on `workflow_dispatch` until the first green run. Production-only baseline (siberlab.dev).
- **Z.8** Test ID prefixes: **T-E1** J-1 auth bootstrap, **T-E2** J-2 Lab L1, **T-E3** J-3 portfolio cert CRUD.
- **Z.9** 3-cycle cadence: **A** (audit) → **B+C atomic** (infra) → **D** (test cases).
- **Z.10** **Production-only baseline** (siberlab.dev). Preview deployments per branch are non-deterministic E2E baselines (R-E2E-13 documents); production is the right E2E target.
- **Z.11** `SOC_IDENTITY_STORE=supabase` mode assumed throughout Phase 5 — production deployment is Supabase Storage JSON. Sqlite/memory fallbacks not exercised in E2E.
- **Z.12** Z.8 + Z.10 conventions from Phase 4.A inherited as permanent (test ID per surface; production-verified state gathering).
- **Z.13** **Yol A pragmatic fallback** — all three paths that would unblock verified-user E2E were **declined**:
  1. **Resend sandbox** — would require Resend account upgrade or sandbox config; declined as out-of-capstone-scope operational dependency.
  2. **Pre-verified seeded user** — would require service-role-key access in CI or manual pre-seed step; declined as deployment-fragile.
  3. **SERVICE_ROLE_KEY in CI secrets** — would expand the secret blast radius if CI was ever compromised; declined as security-posture risk.

  **Consequence**: 3 journeys closed as **PARTIAL** (anon-redirect contracts + ephemeral-user fragments locked); **9 specs `test.skip()`** with explicit Phase 6 deferral notes. R-E2E-04..13 stretch journeys not started.

---

## Wave 5 mentor defaults (operator-confirmed)

When Wave 5A/5B/5C entered, mentor defaults were locked for medium-severity items to keep the cycle surgical. Operator-confirmed:

- **R-UI-03** (WCAG AA contrast) → **mentor option (b) doc-accept** aesthetic tradeoff (Wave 5A). siberhacker neon-on-dark palette retained as project identity; AAA-leaning future iteration deferred to Phase 6 state-critical-accent-variants only.
- **R-API-07** (per-user storage quota) → **count + size quota** (Wave 5B). `src/lib/quota.ts` ships with `MAX_CERTIFICATIONS_PER_USER = 20`, `MAX_EDUCATION_PER_USER = 20`, `MAX_*_ASSET_BYTES` (10 MB cert / 5 MB avatar). Virus scan integration explicitly deferred to Phase 6 (Z.11 capstone scope decision).
- **R-LAB-08** (POSIX shell parser) → **mentor option (c) doc-only** (Wave 5C). Lab Engine shell is educational fidelity; missing features intentional scope. Future Phase 6 closure if shell-fidelity becomes graded competition requirement.
- **A-12** (register rate-limit double-count) → **mentor option (a) code fix** (Wave 5C). Refactor to failures-only — successful registrations bypass counter via `failRegister()` chokepoint helper.

---

## Wave 5C operator confirmation

- **Single-database policy**: production deployment is **Supabase only**. Sqlite is local-fallback only, not deployed. R-API-14 sqlite degradation (synthesized `archivedAt: null` → DELETE blocked) is acceptable per this confirmation. Schema migration for sqlite explicitly NOT shipped in Wave 5C; future Phase 6 if sqlite mode becomes a graded path.

---

## Wave 6 operator confirmation

- **`npm audit fix --force` forbidden** — Wave 6 applied `npm audit fix` (patch-level only); remaining 7 vulnerabilities all require `--force` semver-major bumps (`next@16`, `react-simple-maps@1.0.0`). Each remaining vulnerability documented with **per-package production-bundle impact assessment** in [`docs/audit/phase-1-a-final.md` § 8](./audit/phase-1-a-final.md#8-dependency-vulnerability-state-wave-6-housekeeping). Production bundle UNAFFECTED.

---

## Wave 7 — operator confirmation

- **AI auditor first-read positioning**: this Z-reference, the [`PATTERN_CATALOG.md`](./PATTERN_CATALOG.md), the [`docs/audit/INDEX.md`](./audit/INDEX.md), and the rewritten capstone-grade English README collectively form the AI auditor onboarding surface. (Wave 9 update: the English README was moved from root to [`docs/AUDIT_README.md`](./AUDIT_README.md) as part of the hybrid restructure; the new root [`README.md`](../README.md) carries a hoca-friendly Türkçe project overview. Both files together form the dual onboarding surface — Türkçe for human reviewers, English for AI auditors.)

## Wave 9 — operator confirmation

- **README hybrid restructure (Yön C)**: root README.md → Türkçe capstone-friendly (hoca + human reviewer first-read with prominent production demo link + Faz 1–5 summary + scope decisions overview); docs/AUDIT_README.md → English capstone-grade audit detail preserved verbatim from Wave 7 (AI auditor first-read). Cross-references in this file + INDEX.md updated; FINAL_SCAN_REPORT.md historical references intentionally preserved (per yasaklar "no content edits"). No code/test changes.

## Wave 12 — Navigation rename

- **Z.14** — `/community` → `/academy` route + label rename (A-26 closure). Reason: "COMMUNITY" label semantically mismatched with page content (Lab Engine + Curriculum + Tools + CTF Missions = training/education surface, NOT community forum). Operator decision (Wave 11 UI review post-deploy): full rename — directory `src/app/community/` → `src/app/academy/` via `git mv` (history preserved); navigation label `[COMMUNITY]` → `[ACADEMY]` (brackets preserved at render layer per siberhacker brand); 308 permanent redirect (with sub-path wildcard) in `next.config.mjs` for backward-compat. Wave 4B BUG-006 server-side auth gate (`cookies()` + session check + `redirect('/login')`) preserved at the new path (`src/app/academy/layout.tsx`); R-E2E-02 PARTIAL closure narrative semantically unchanged. Inner tab/sub-feature labels (`[] Curriculum`, `{} Tools`, `## CTF Missions`) explicitly preserved — only the parent route + label changed. Audit doc historical narrative references to `/community` left untouched (Wave 4B discovery context); Wave 12 cross-references added in source comments (`src/app/academy/layout.tsx`, `src/app/portfolio/page.tsx`, `e2e/journey-*.spec.ts`) for future readers.

## Wave 13 — Avatar Performance Optimization

- **Z.15** — Avatar signed URL TTL revision **15s → 30s** (A-27 closure). Wave 5B R-API-10 initially set TTL = 15s as security-driven tight window (off-platform URL leak narrative: clipboard share / URL bar screenshot reuse window). Wave 13 Faz 13.B mentor revision: **30s preserves the short-lived-URL security envelope** (pattern intact: still well below "long-lived URL" category, e.g. > 60s) while **doubling the effective cache-window arithmetic** for the Wave 13.C Cache-Control + browser-dedup combo. Decision rationale: pragmatic balance over absolutist constraint — the 5B closure's "leaked URL" attack model (15s vs 30s difference) is operationally negligible compared to the 9× performance improvement (3.6s → ~250-400ms cold; ~150ms warm) that the 30s window enables. Defense-in-depth via `Cache-Control: private` (no shared/CDN cache) + `Vary: Cookie` (intermediary cache key explicit) on the 307 redirect response. R-API-10 audit row STATUS clause not flipped — closure remains RESOLVED at Wave 5B; this is a TTL parameter revision, not a pattern flip. Wave 5B `T-AV-TTL` regression test renamed to `T-AV-TTL30` with assertion 15 → 30 (drift back to 15 or 60 fails). Path C (next/Image migration) + Path D (server-side signed URL pool) explicitly deferred to POST_CAPSTONE_BACKLOG.md items #11 + #12 — both diminishing-returns for capstone scope vs Wave 13.C Path B + Path A combo.

## Wave 14 — Identity Model Simplification

- **Z.16** — `display_name` field removed system-wide (A-28 closure). Operator UX decision following Wave 14.A Bug 4 investigation ("Zerooooo" historical-data residue): username serves as the single identity (GitHub / Twitter / Discord pattern). 44-file refactor: UI form field removal + `PortfolioWorkspace` 7-site swap + mini card removal; 5 API routes cleaned (register, users, verify, forgot, verify/resend); 4 storage adapters refactored (memory + Supabase JSON + SQLite + Postgres blueprint); `isValidDisplayName` + `DISPLAY_NAME_*` constants + `getDisplayNameError` fully removed; email templates pivot to `Merhaba {username},` body interpolation. Migration safety: production storage is Supabase JSON (R-API-03 Z.10 — Postgres blueprint never deployed); silent-ignore strategy follows Wave 11 website-field precedent (A-25 lineage), no migration script for production data. Postgres blueprint cleaned at the SQL source plus NEW `supabase/wave-14-c-drop-display-name.sql` staged for future deploy. Test baseline 545 → 539 (T-IV14 through T-IV19 removed alongside `isValidDisplayName`; username coverage preserved via existing T-IV01-13). LOC delta: pre-flight estimated ~-135 net, actual ~-296 net (over-removal scope-aligned with Q3-A total cleanup — not scope creep). Wave 14.C commit `b54cf8c`. Detailed scope in `docs/audit/phase-1-a-pending-amendments.md` A-28 entry.

## Wave 14.D — UI Polish

- **Z.17** — Page header refactor + bio overflow ceiling + preview username de-duplication + Wave 14.E grid-min-width-0 layout repair (A-29 closure). Operator UX decision following Wave 14.C post-deploy smoke: the `route-kicker` label "Portfolio Control Surface" carried the actual descriptive payload; the prior `route-title` h1 ("Profil merkezi") + subtitle paragraph were redundant noise. Header collapsed to a single h1 with mono font + ALL CAPS + widened tracking (`letter-spacing: 0.24em`) + neon green palette via `--route-accent-rgb` + `text-shadow` glow — capstone-grade siberhacker aesthetic in a single element. Bio textarea hardened with 500-char `maxLength` + word-wrap classes (`whitespace-pre-wrap break-words`) + live character counter with tri-state coloring (muted → amber at 450 → rose at 500); validator-layer mirror in `portfolio-validation.ts` so direct API callers cannot bypass the UI cap. Right preview card's redundant 3rd-line plain-username paragraph (Wave 14.C `@username` prefix removal leftover) removed; heading + location color/styling preserved. **Zero new patterns** — UI refinement, no defense-in-depth claim. Test baseline 539 → 543 (+4 regression guards: T-BIO-LIMIT, T-BIO-COUNTER, T-USERNAME-REMOVED, T-VAL-BIO-MAX). Wave 14.D commit `18674c5`. Detailed scope in `docs/audit/phase-1-a-pending-amendments.md` A-29 entry.

## Wave 15 — AI Auditor Readiness

- **Z.18** — Avatar signed URL TTL revision **30s → 90s** (A-30 closure). Wave 13 Z.15 raised TTL 15s → 30s for SSR-resolve + Cache-Control + browser-dedup cache window arithmetic. Wave 15.A health check (commit `912cadb`) reproduced the operator's `/portfolio → /academy → /portfolio = "S" placeholder` path in production: the Wave 13.C SSR-resolved `initialAvatarUrl` prop ages past 30s during Next.js Router Cache lifetime on cross-route soft-nav and BFCache tab-park scenarios. **90s = 3× buffer** absorbs typical cross-route navigation timing plus a ~1-minute BFCache park window. Decision rationale: the Wave 5B "leaked URL" attack model differential (30s vs 90s) is operationally negligible for a portfolio-class public-visible avatar asset (not credential / not private document); the regression UX impact is daily and operator-visible. R-API-10 audit row STATUS clause not flipped — closure remains RESOLVED at Wave 5B; this is the second TTL parameter revision (15s → 30s → 90s) along the same Z-decision lineage (Z.15 → Z.18), not a pattern flip. Legacy fallback path (`src/app/api/profile/avatar/[userId]/route.ts`) aligned simultaneously: TTL 30s → 90s + `Cache-Control: private, max-age=20` → `max-age=60` (60 < 90 envelope preserved). Wave 13.C `T-AV-TTL30` regression test renamed to `T-AV-TTL90` with assertion 30 → 90 (drift back to 15s OR 30s OR up to 60s fails). `T-AV-CACHE` assertion `max-age=20` → `max-age=60`. Defense-in-depth via `Cache-Control: private` (no shared/CDN cache) + `Vary: Cookie` (intermediary cache key explicit) intact. **AI auditor readiness blocker 1 closed.**

## Wave 15 — AI Auditor Readiness (Doc Drift Closure)

- **AUDIT_README cleanup (Wave 15.B blocker 2):** Test count badge + quick-start `npm run test` line updated 530 → 543 (post-Wave-14.D actual baseline). Wave closure cadence table appended Wave 8 through Wave 15.B entries (Wave 8 lint baseline + hostname F1/F7 closures; Wave 9 README hybrid; Wave 10 router.refresh; Wave 11 socialLinks multi-platform; Wave 12 `/community → /academy` rename; Wave 13.A/C avatar perf audit + SSR resolve; Wave 14.A/C/D/E portfolio bug investigation + display_name removal + UI polish + layout repair; Wave 15.A health check + 15.B TTL + doc cleanup). Bundled into Wave 15.B commit as paired AI-auditor-readiness closure (both blockers shipped together; single mentor review cycle).

---

## Z-decision invariants (carry across phases)

- **Z.10** (production-vs-blueprint verification): **mandatory permanent convention** for every Phase D state gathering step. Locked Phase 3.A; re-cited Phase 4.A Z.8 + Phase 5.A Z.10/12.
- **Per-surface test ID prefix**: every Phase D adds new prefix entries; prefix collision is forbidden (cross-phase reuse is allowed when the same surface is touched, e.g., `T-CAP-A11` reused Wave 6).
- **Top-3 surgical scope**: every Phase D selects exactly 3 targets via ROI calculus. The inverse list (what got dropped) becomes the Phase 6 roadmap.
- **Honest deferral**: every postponement carries an inline reason. `test.skip()`, DOC-ACCEPT, PARTIAL, RECLASSIFIED, ACCEPTED, accepted-by-policy — all grep-able.

---

## How to add a new Z decision

When a new strategic decision is locked in a future phase audit:

1. Add a `Z.NN` entry in that phase audit's Section 9.
2. Mirror the entry into this file under the appropriate phase heading.
3. If the decision establishes a **permanent convention**, also add it under "Z-decision invariants" above.
4. Reference the Z entry from any audit row, pattern catalog item, or amendment that depends on the decision.

The convention is "decisions are first-class artifacts; future cycles inherit them by reference."
