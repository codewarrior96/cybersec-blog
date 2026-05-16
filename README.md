# cybersec-blog (siberlab.dev)

> Capstone-grade cybersecurity portfolio + SOC learning platform. Built on Next.js 14, demonstrating audit-driven engineering discipline across security, accessibility, API contracts, and end-to-end testing.

[![tests](https://img.shields.io/badge/vitest-530%20passing-brightgreen)]()
[![e2e](https://img.shields.io/badge/playwright-9%20active%20%2B%209%20skip-blue)]()
[![phases](https://img.shields.io/badge/audit%20phases-5-blueviolet)]()
[![closure](https://img.shields.io/badge/inventory%20closed-50%2F60%20(83%25)-success)]()

**Live:** [siberlab.dev](https://siberlab.dev) · **Stack:** Next.js 14 (App Router) · React 18 · TypeScript 5 · Tailwind 3 · Supabase (Storage + Postgres) · Vitest · Playwright

---

## Quick start

```bash
npm install
npm run dev         # http://localhost:3000
npm run test        # 530 vitest tests (~5s)
npm run e2e         # Playwright against production
npm run build       # next build (env-free per A-17)
```

Common env vars (full reference in `.env.example`):

```env
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_APP_STATE_BUCKET=cybersec-app-state
DATABASE_URL=                          # Supabase Postgres (Phase 1+)
SOC_STORAGE=sqlite                     # sqlite | memory (fallback only; prod = supabase)
SOC_IDENTITY_STORE=supabase            # supabase | postgres | disabled
SOC_ALLOW_CRITICAL_MEMORY_FALLBACK=0
SOC_DEMO_SECRET=                       # zorunlu (R-20 boot validator + lazy getter)
TRUST_PROXY_HEADERS=                   # Vercel için zorunlu (R-01)
GREYNOISE_API_KEY=                     # opsiyonel, yoksa mock data
```

---

## What was built

A 5-phase audit-driven engineering cycle. Each phase produced its own audit report, surgical fix sub-stages, and gap-tests for in-scope-but-deferred items.

| Phase | Domain | Outcome |
|---|---|---|
| **1** | Security & identity (auth, sessions, scrypt, rate limits) | 22 risks surfaced (R-01..R-22), 16 closed via Phase 1.5 hardening + Wave 1 housekeeping |
| **2** | Lab Engine (educational Linux shell simulation) | 15 risks surfaced (R-LAB-01..15), 13 RESOLVED + 1 DOC-ACCEPT + 1 accepted-by-policy |
| **3** | API & contracts (CRUD, RLS, external integrations) | 15 risks surfaced (R-API-01..15), 14 RESOLVED + 1 RECLASSIFIED (Z.10) |
| **4** | UI & accessibility (axe-core, focus trap, landmarks) | 15 risks surfaced (R-UI-01..15), 14 RESOLVED + 1 PARTIAL |
| **5** | End-to-end (Playwright against production) | 13 risks surfaced (R-E2E-01..13), 3 PARTIAL (Yol A) + 10 DEFERRED to Phase 6 |

Phase 1.5 ran 15 hardening sub-cycles after Phase 1's first-pass audit. Phases 2-5 each followed an A → B → C → D pattern (audit → infra → mocks → test cases) with stop-checkpoints between sub-stages.

---

## Audit closure summary

Risk inventory across 6 namespaces, populated from each phase's Section 2 risk register. Closure markers come from the audit doc rows themselves (✅ RESOLVED / ✅ FIXED / 🟡 PARTIAL / 🟡 DOC-ACCEPT / 🟡 RECLASSIFIED / ✅ ACCEPTED).

| Namespace | Total | RESOLVED / FIXED | DOC-ACCEPT | PARTIAL | ACCEPTED / RECLASSIFIED | OPEN |
|---|---|---|---|---|---|---|
| **R-XX** (Phase 1) | 22 | 13 | 0 | 0 | 3 (R-16 informational, R-19 INAPPLICABLE, R-22 ACCEPTED) | 6 (R-05, R-09, R-10, R-11, R-17, R-18 — Phase 6 candidates) |
| **R-LAB** (Phase 2) | 15 | 13 | 1 (R-LAB-08) | 0 | 1 (R-LAB-01 accepted-by-policy) | 0 |
| **R-API** (Phase 3) | 15 | 14 | 0 | 0 | 1 (R-API-03 RECLASSIFIED per Z.10) | 0 |
| **R-UI** (Phase 4) | 15 | 13 | 1 (R-UI-03) | 1 (R-UI-01) | 0 | 0 |
| **R-E2E** (Phase 5) | 13 | 0 | 0 | 3 (R-E2E-01/02/03) | 0 | 10 (Phase 6 — verified-user setup) |
| **A-XX** (amendments) | 21 | 18 + 2 ACK | 0 | 0 | 0 (A-16 reserved-never-used gap) | 0 |
| **TOTAL** | 101 | 74 | 2 | 4 | 5 | 16 |

Per the wave-commit chain (`5cb6bee` → `fd88d15`), cumulative scope-bounded closure rate: **50 / 60 inventory items (83 %)**; **53 / 60 (88 %)** if PARTIAL counts as "done within capstone scope."

A namespace-by-namespace narrative lives in [`docs/audit/INDEX.md`](./docs/audit/INDEX.md). Each row's full status text (including the closing-commit hash) lives in the phase audit doc itself.

---

## Intentional scope decisions

This project deliberately scopes some risks out of capstone closure. They are documented as **DOC-ACCEPT**, **PARTIAL**, or **DEFERRED** rather than silently ignored — honest signal is the engineering posture.

- **R-LAB-01** (server-side flag validation): portfolio-demo context, NOT a graded CTF. Server-side flag refactor reserved for Phase 6 if scope shifts to graded competition.
- **R-LAB-08** (POSIX shell parser): Lab Engine shell is **educational fidelity** — supports `cd` / `ls` / `cat` / `grep` / `chmod` + pipelines + basic quoting for Linux fundamentals. Missing features (escape sequences, glob, `$()`, `>` redirection beyond echo, backtick substitution) are intentional scope per Wave 5C mentor default (c).
- **R-UI-03** (WCAG AA contrast): the siberhacker neon-on-dark palette (`#000000` + `#00ff88` + `#00d4ff`) is the project's aesthetic identity. AAA-leaning iteration deferred to Phase 6 (state-critical accent variants only). Wave 5A mentor option (b).
- **R-API-03** (RLS asymmetry, Phase 3 RECLASSIFIED via Z.10): `platform-backbone-v1.sql` blueprint defines 21 tables with no RLS; production verification revealed those tables were **never applied to Supabase**. Future deployment cycle must ship RLS migration in the same operation. See Z.10 in [`docs/SCOPE_DECISIONS.md`](./docs/SCOPE_DECISIONS.md).
- **R-UI-01** + **R-E2E** (verified-user E2E coverage): Phase 5 Yol A pragmatic fallback (Z.13) declined Resend sandbox + pre-verified user + SERVICE_ROLE_KEY setup paths. 3 journey specs PARTIAL-closed; 9 sub-specs `test.skip()` with explicit Phase 6 deferral notes.
- **6 R-XX from Phase 1 OPEN** (R-05 TOCTOU, R-09 reserved username breadth, R-10 displayName homoglyph, R-11 token-validity oracle rate-limit, R-17 audit log silent fail, R-18 email-keyed reset budget): pre-existed Phase 1.5 hardening sweep; Phase 1.5 closed the Critical/High-impact tier (R-01..R-04, R-06..R-08, R-12..R-15, R-20, R-21) and the remaining 6 are Low/Medium pending future cycles.
- **7 npm audit vulnerabilities** (after Wave 6 patch-only fix): all require `--force` semver-major bumps (`next@16`, `react-simple-maps@1.0.0`). Documented per-package with production-bundle impact assessment in [`docs/audit/phase-1-a-final.md` § 8](./docs/audit/phase-1-a-final.md#8-dependency-vulnerability-state-wave-6-housekeeping). Production bundle UNAFFECTED.

---

## Pattern catalog

Eighteen engineering patterns named, applied, or extended during the closure cycle. Full catalog: [`docs/PATTERN_CATALOG.md`](./docs/PATTERN_CATALOG.md). Highlights:

- **Defense-in-depth two-layer pattern** (6 instances): R-13 → R-21 → R-15 → A-17 → R-API-05 → R-API-13. Each pair is "input sanitization (Layer 1) + output safe-default rendering (Layer 2)" with a different pair of files implementing each layer.
- **Gap-test → regression-guard lifecycle** (2 transitions): `T-MO-CHMOD-EQ-GAP → T-MO-CHMOD-EQ01` (Wave 2B), `T-CAP-A11-GAP → T-CAP-A11-DISMISS` (Wave 6).
- **Z.10 production-vs-blueprint discipline**: state gathering MUST verify production via `information_schema` query, not file content. Made permanent convention after Phase 3.D revision discovered `platform-backbone-v1.sql` never deployed.
- **Mentor-error correction protocol** (2 cycles): protocol followed when a Phase audit decision was later corrected by source evidence (A-10 narrative correction, A-11 R-16 narrative correction).
- **Honest deferral with explicit reason** (multiple): every `test.skip()`, PARTIAL closure, and DOC-ACCEPT carries the reason inline so an auditor can grep for "Phase 6" and find every deferral.
- **axe-smoke per-modal pattern** (7 instances): each modal/dialog surface has a dedicated axe-scoped smoke test covering only the rules that surface owns.
- **Belt-and-suspenders nested ErrorBoundary** + **SectionErrorBoundary per-section composition**: the legacy top-level ErrorBoundary now wraps a `<SectionErrorBoundary>` for finer fallback affordance.

---

## Test architecture

### Vitest (530 tests, 62 files)

- **Mixed environment**: default `node` (Phase 1-3 + most lib tests, ~386 tests, fast); per-file `// @vitest-environment jsdom` opt-in for Phase 4+ component tests (axe-core + RTL + jest-dom + vitest-axe matchers).
- **MSW**: `setupServer({ onUnhandledRequest: 'error' })` — every unmocked network call fails the test. Resend handlers in `src/test/msw/handlers/resend.ts`.
- **Hermetic discipline**: `vi.stubEnv()` exclusively; `restoreMocks: true`; `__resetAllForTests()` in global afterEach for rate-limiter state; `vi.useFakeTimers()` mandatory for any time-sensitive test.
- **Coverage**: 50 % statements/branches/functions/lines (Phase 1 threshold; raises to 70 % at Phase 3, 80 % at Phase 5).
- **Determinism mandate**: no `Math.random`, no `Date.now()` without freezing, no real network, no real timers, no real filesystem.

### Playwright (9 active + 9 skip)

- **Chromium-only** (per Phase 5.A Z.3 surgical scope).
- **Production-only baseline** (`siberlab.dev` per Z.10) — preview URLs opportunistic only.
- **3 journey specs**:
  - `journey-auth-bootstrap.spec.ts` (T-E1-01..07): 6 active + 1 skip (verification-link click pending verified-user setup).
  - `journey-lab-l1-solve.spec.ts` (T-E2-01..05): 1 active (anon-redirect) + 4 skip (Yol A: verified-user blocked).
  - `journey-portfolio-cert-crud.spec.ts` (T-E3-01..06): 2 active (anon-redirect contracts) + 4 skip (Yol A: verified-user blocked).
- **GitHub Actions**: `.github/workflows/e2e.yml` (workflow_dispatch gated until first green run).

### TypeScript discipline

- Strict mode, no `any` without justification comment.
- `npx tsc --noEmit` clean on every wave commit.
- Test files colocated as `*.test.{ts,tsx}` next to the unit under test.

---

## Product surfaces

| URL | Surface | Auth |
|---|---|---|
| `/` | redirect → `/login` | ✗ |
| `/login` · `/register` · `/forgot` · `/reset` · `/verify` | Auth bootstrap (Breach Terminal aesthetic) | ✗ |
| `/home` | Sentinel Dashboard (3D globe, telemetry, alert cards) | ✓ |
| `/blog` · `/blog/[slug]` | MDX cybersecurity tutorials (Turkish, 8 posts) | ✗ |
| `/zafiyet-taramasi` | Sentinel reports · CVE Radar · historical breach DB | mixed |
| `/community` | Breach Lab (curriculum, xterm.js, CTF) | ✓ |
| `/portfolio` | Profile + certifications + education | ✓ |
| `/roadmap` | Feature roadmap | ✗ |

API routes (`src/app/api/**`) span 28 handlers across 9 domains (auth, alerts, reports, users, profile, telemetry, external, identity, attack-events). Each domain's contract is documented in the relevant phase audit doc Section 2.

---

## Data layer

Hybrid by design, controlled by `SOC_IDENTITY_STORE`:

| Mode | Identity surface | Operational surface |
|---|---|---|
| **`supabase`** (default, production) | Supabase Storage JSON app-state | Sqlite + Supabase attack-metrics |
| **`postgres`** (Phase 1 migration target) | Supabase Postgres (`identity.users` + `identity.sessions`) | Same as above |
| **`disabled`** (local dev / test) | Sqlite + memory fallback | Same |

Strategic direction (from existing roadmap):
1. Migrate identity + sessions to Supabase Postgres safely.
2. Migrate portfolio/profile data to Postgres.
3. Migrate reports to Postgres.
4. Keep Storage limited to binary assets only.

Phase 1 identity migration is implemented behind the `SOC_IDENTITY_STORE=postgres` flag with `npm run backfill:identity` for the data step. R-API-14 archive lifecycle ships in `=supabase` mode; sqlite fallback is documented as delete-blocked degradation (acceptable per Wave 5C operator confirmation: production is Supabase-only).

---

## Wave closure cadence

Audit-driven closure executed across 9 waves over 2 days. Each wave is a "fix commit + .1 cleanup commit" pair (the cleanup commit resolves `<COMMIT_HASH_TBD>` placeholders that the fix commit introduces in audit docs).

| Wave | Scope | Closures | Type |
|---|---|---|---|
| 1 | A-XX audit-doc housekeeping (12 items) | 12 | Doc-only |
| 2A | R-UI component code fixes (R-UI-04/08/11/15) | 4 | Code + tests |
| 2B | R-API server code + 6th defense-in-depth instance | 4 | Code + tests |
| 3 | R-LAB gap-tests + R-API-04 full closure + R-UI low-priority | 10 | Test additions |
| 4A | Phase 5 infra (Playwright + Chromium + fixtures) | 0 (infra) | Infrastructure |
| 4B | Phase 5 test cases (Yol A pragmatic) | 3 PARTIAL | E2E specs |
| 5A | R-UI medium fixes (R-UI-03/05/06/07/10/13) | 6 | Code + tests |
| 5B | R-API medium fixes (R-API-07/08/09/10/11/12) | 6 | Code + tests |
| 5C | R-API-14 schema + R-LAB-08 DOC-ACCEPT + A-12 code | 3 | Code + doc |
| 6 | T-CAP-A11 a11y + npm audit dev-tree | 2 | Code + dep |
| 7 | Capstone documentation (this commit) | 0 (doc) | Documentation |
| **TOTAL** | | **50 RESOLVED + 3 PARTIAL** | |

---

## How to read this repo

For AI auditors (recommended reading order):

1. This README.
2. [`docs/audit/INDEX.md`](./docs/audit/INDEX.md) — single-page audit doc navigator.
3. [`docs/SCOPE_DECISIONS.md`](./docs/SCOPE_DECISIONS.md) — Z.1..Z.13 mentor decisions consolidated.
4. [`docs/PATTERN_CATALOG.md`](./docs/PATTERN_CATALOG.md) — 18 engineering patterns with instance lineage.
5. Phase audit docs in order:
   - [`docs/audit/phase-1-a-final.md`](./docs/audit/phase-1-a-final.md) — Security & identity (R-01..R-22, plus § 8 npm audit state).
   - [`docs/audit/phase-2-a-lab-engine-audit.md`](./docs/audit/phase-2-a-lab-engine-audit.md) — Lab Engine (R-LAB-01..15).
   - [`docs/audit/phase-3-a-api-contracts-audit.md`](./docs/audit/phase-3-a-api-contracts-audit.md) — API contracts (R-API-01..15).
   - [`docs/audit/phase-4-a-ui-a11y-audit.md`](./docs/audit/phase-4-a-ui-a11y-audit.md) — UI & a11y (R-UI-01..15).
   - [`docs/audit/phase-5-a-e2e-journeys-audit.md`](./docs/audit/phase-5-a-e2e-journeys-audit.md) — E2E journeys (R-E2E-01..13).
6. [`docs/audit/phase-1-a-pending-amendments.md`](./docs/audit/phase-1-a-pending-amendments.md) — A-01..A-21 amendment ledger.
7. [`CLAUDE.md`](./CLAUDE.md) — project conventions, Phase roadmap, testing/phase discipline protocol.

Migration / architecture docs (orthogonal to audit):
- [`docs/platform-backbone-plan.md`](./docs/platform-backbone-plan.md) — Supabase Postgres backbone narrative.
- [`docs/data-flow-map-and-migration-plan.md`](./docs/data-flow-map-and-migration-plan.md) — domain-by-domain data flow audit.
- [`docs/postgres-migration-execution-roadmap.md`](./docs/postgres-migration-execution-roadmap.md) — Phase 1+ migration steps.

---

## Future Phase 6 roadmap

Explicitly NOT in capstone scope; documented here so an auditor can see the deferred work in one place.

- **R-API-03**: deploy `supabase/platform-backbone-v1.sql` (21 tables) to production Supabase **with RLS migration in the same operation**. Re-classify R-API-03 from RECLASSIFIED to FIXED after deploy. Z.10 lesson permanent.
- **R-UI-01 + R-E2E-01..05**: verified-user E2E setup. Pick one of three paths declined in Z.13: Resend sandbox / pre-verified seeded user / SERVICE_ROLE_KEY in CI. Flip 9 `test.skip()` calls to active assertions.
- **R-E2E-04..13**: stretch journey coverage (dashboard mount smoke, password recovery loop, header presence, multi-instance rate-limiter atomicity, external API integration, preview URL handling).
- **R-LAB-01**: server-side flag validation refactor if scope shifts from portfolio-demo to graded competition.
- **R-UI-03 AAA-leaning iteration**: state-critical accent variants for color-blindness operators (current palette stays as identity).
- **6 Phase 1 OPEN R-XX**: R-05 TOCTOU direct test, R-09 reserved-username breadth expansion, R-10 displayName homoglyph denylist, R-11 token-validity-oracle rate-limit, R-17 audit log retry queue, R-18 IP+email composite rate-limit.
- **npm audit `--force` cycle**: `next@14 → 16` major migration + `react-simple-maps@2.x → 1.0.0` paradox downgrade. Resolves the remaining 7 vulnerabilities (all dev-tree / Vercel-mitigated per Wave 6 doc).
- **Severity taxonomy normalization (R-API-12) UI wiring**: the canonical normalizer ships in Wave 5B; dashboard consumption is a future iteration.

---

## License

Private capstone project. License terms TBD by operator. Not currently licensed for redistribution.

---

## Acknowledgements

Built as a capstone project demonstrating mentor-guided audit discipline. The wave-based closure cadence, sub-stage stop-checkpoints, and audit-trail honesty protocol are documented in [`CLAUDE.md`](./CLAUDE.md) for reuse.
