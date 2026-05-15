# Phase 5.A — E2E Playwright User Journeys Audit

**Status:** Draft (sub-stage A: report only) · **Date:** 2026-05-15 · **Phase:** 5 of 5 · **Sub-stage:** A (Audit) · **Author:** Claude (with Salim review)

Canonical Phase 5.A deliverable. Mirrors Phase 2.A + 3.A + 4.A structure (9 sections: inventory → risk register → existing coverage → gaps → surgical recommendation → infra needs → mock/fixture requirements → cross-references → mentor decisions). CLAUDE.md L173 + L175 sub-stage discipline applies: **this commit produces this markdown file and nothing else**.

Audit register state at Phase 5.A start: 10 RESOLVED + 10 OPEN amendments + 1 numbering gap (A-16) (unchanged through Phase 4). Risks accumulated: Phase 1 R-01..R-22 (closed Phase 1.5 series), Phase 2 R-LAB-01..R-LAB-15 (R-LAB-02/03/04/06 closed Phase 2.D), Phase 3 R-API-01..R-API-15 (R-API-01/02/04/05 closed Phase 3.D revision; R-API-03 RECLASSIFIED per Z.10), Phase 4 R-UI-01..R-UI-15 (R-UI-02 closed Phase 4.D; R-UI-01 PARTIAL pending Phase 5 E2E). Phase 5 opens **R-E2E-XX** namespace (new, no collision; namespace pre-reserved by Phase 2.A L295 forward-reference).

**Z.8 + Z.10 lessons APPLIED (now permanent audit conventions):**
- Z.8 (Phase 4.A): Section 1 user journey inventory carries a **production-verified column** (✅ / 🟡 / ❌) per journey.
- Z.10 (Phase 3.D revision): production state verified via `npm run build` route map + Phase 3.D revision Supabase `information_schema` findings + manual smoke evidence on `siberlab.dev`. Audit assumptions cross-checked against actual production state, not file content alone.

---

## 1. User Journey Inventory

### 1.1 — Route map (build-verified, Phase 4.A Z.8 convention)

Build output confirms 17 user-facing page routes (re-verified via Phase 4.A Section 1.2 with addition of auth flow routes). Production deployment: `siberlab.dev` (Vercel auto-deploy from `main`).

| Route | Auth | Notable | Prod URL behavior |
|---|---|---|---|
| `/` | open | redirect to `/login` (Next `redirect()`) | server-side redirect |
| `/login` | open | `EmbeddedLogin` form (server component reads cookie, hydrates client form) | renders form |
| `/register` | open | `EmbeddedRegister`, post-success redirect → `/auth/verify-pending` | renders form |
| `/auth/verify-pending` | open | "check your email" landing after register | renders message |
| `/verify?token=X` | open | server-fetches `/api/auth/verify`, 4 states (success / expired / invalid / internal / no-token); success auto-redirects to `/login` via `<meta http-equiv="refresh">` 3s | renders status |
| `/forgot` | open | password reset request form | renders form |
| `/reset?token=X` | open | password reset confirmation form | renders form |
| `/home` | required | `HomePageClient` → dynamic-import `DashboardLayout`, ssr:false | redirects unauth → `/login` (via AppShellClient gating) |
| `/community` | required | `dynamic(Terminal, ssr:false)` + Lab Engine, lesson content + CTF | hard 401-equivalent behavior for anon |
| `/portfolio` | required | `PortfolioWorkspace` (BUG-006: hard redirect for anon) | redirects unauth → `/login` |
| `/zafiyet-taramasi` | mixed | Reports tab + CVE Radar + Historical | auth-gated content within |
| `/blog` | open | post listing (SSG-able) | static-ish |
| `/blog/[slug]` | open | post detail (SSG) | static |
| `/about` | open | static page | static |
| `/breach-timeline` | open | static page | static |
| `/cve-radar` | open | redirect to `/zafiyet-taramasi?tab=cve` (legacy URL) | redirect |
| `/roadmap` | open | static page | static |

### 1.2 — Candidate user journeys with production verification (Z.8 convention)

A **journey** = an end-to-end flow that crosses ≥2 routes OR triggers ≥1 state mutation. Read-only single-page renders are NOT journeys (Phase 4.A unit-test territory).

| # | Journey | Prod-verified | Crosses | Demo-criticality | State mutation? | E2E-test ROI |
|---|---|---|---|---|---|---|
| J-1 | **Auth bootstrap full-flow:** anon → register → email verify (mocked or live) → login → land on `/home` | ✅ (live on siberlab.dev with Resend on `noreply@siberlab.dev`) | `/register` → POST `/api/auth/register` → `/auth/verify-pending` → email → `/verify?token=...` → POST `/api/auth/verify` → `/login` → POST `/api/auth/login` → `/home` | **CRITICAL** | yes (user create + session create) | HIGH — gates all downstream features |
| J-2 | **Lab L1 happy path solve:** login → `/community` → type `ls /home/operator/` → flag-submit unlocks reveal | ✅ (Lab Engine Phase 2.D fully tested; render layer untested) | `/community` route + Terminal.tsx render + Lab Engine internals | **CRITICAL** (flagship demo feature) | yes (localStorage evidence log + flag submission via callback) | HIGH — locks the "click-here-and-it-works" demo path |
| J-3 | **Portfolio certification CRUD:** login → `/portfolio?tab=certifications` → add certification → reload → certification still present | ✅ (PortfolioWorkspace + DangerZone + DeleteAccountModal in production); persistence via Supabase JSON app-state when `SOC_IDENTITY_STORE=supabase` (default) — see Section 8 Z.10 constraint analysis | `/portfolio` → POST `/api/profile/certifications` → reload → GET `/api/profile/certifications` | HIGH | yes (POST + GET round-trip) | MEDIUM-HIGH — exercises R-API-01 ownership idioms + persistence |
| J-4 | **Login → /home → dashboard renders without crash:** smoke test for DashboardLayout (2165 LOC, dynamic-imported, ssr:false) | ✅ (renders on production; specific FX cadence per Phase 1.5.14.1 demo tuning) | `/login` → POST `/api/auth/login` → `/home` → `<DashboardLayout>` mount → ResizeObserver + rAF + globe init | HIGH | no (read-only stream) | MEDIUM — locks crash-free dashboard mount; cadence timing NOT tested (E2E timeout risk) |
| J-5 | **Anon → /portfolio redirects to /login:** auth gate enforcement (BUG-006 closure) | ✅ | unauth GET `/portfolio` → server-side `redirect('/login')` | MEDIUM | no | LOW — single redirect assertion |
| J-6 | **Password recovery flow:** anon → `/login` → "forgot password" → `/forgot` → submit email → email-link → `/reset?token=...` → new password → login | ✅ (live on siberlab.dev with Resend) | `/forgot` → POST `/api/auth/forgot` → email → `/reset?token=...` → POST `/api/auth/reset` → `/login` → POST `/api/auth/login` | HIGH | yes (password mutation) | MEDIUM-HIGH — recovery is operationally critical |
| J-7 | **CSRF middleware blocks cross-origin POST:** Playwright sends POST to `/api/reports` with mismatched Origin header → expects 403 "Origin mismatch" | ✅ (middleware.ts:80-90) | edge layer only | MEDIUM | no | LOW — middleware contract test (already covered transitively at unit level; Phase 5.D could add a single explicit smoke) |
| J-8 | **Session expiry redirect:** logged-in user manually clears `soc_session` cookie → next navigation redirects to `/login` | ✅ (AppShellClient gating) | manipulate cookies + GET protected route | MEDIUM | no | LOW |
| J-9 | **Reports archive-then-delete two-stage gate (R-API-04):** login (analyst+) → submit report → archive → delete (success); attempt delete-before-archive → 409 | 🟡 uncertain (does `/zafiyet-taramasi` expose this UI flow, or is it API-only? UI verification needed) | UI within `/zafiyet-taramasi` + POST/PATCH/DELETE `/api/reports/*` | MEDIUM | yes | MEDIUM (gated by UI affordance — if UI doesn't expose archive button, journey isn't testable from browser perspective) |
| J-10 | **Multi-instance rate-limit shared state (R-02 T-R11 / Phase 5 territory):** 10 sequential failed login attempts → 11th rejected with rate-limit message, regardless of which Vercel instance served each request | ✅ (per Phase 1.5.9 R-02 closure; persistence via `public.rate_limits` Supabase table) | POST `/api/auth/login` × 10+ rapid attempts | MEDIUM | yes (rate_limits table inserts) | MEDIUM — direct closure of Phase 1.A T-R11 Phase-5 deferral comment |

### 1.3 — Production verification posture summary (Z.10 + Z.8 lessons)

**Verification methodology:**
1. Production route map confirmed via `npm run build` output (Phase 4.A Section 1.2 cross-reference, unchanged for Phase 5.A baseline)
2. Supabase production state inherited from Phase 3.D revision Z.10 finding: `public.attack_events` + `public.rate_limits` + `auth.*` exist; **platform-backbone tables NOT applied** (21 tables in `supabase/platform-backbone-v1.sql` blueprint only)
3. Identity store routing analysis: `SOC_IDENTITY_STORE=supabase` (default) → Supabase Storage JSON app-state (NOT the platform-backbone Postgres tables) → identity/users/sessions/profile DO persist in production via Storage JSON
4. Email delivery: `noreply@siberlab.dev` verified domain via Resend (May 03 2026); production sends real emails

**E2E persistence implications (Section 8 expands):**
- Auth + user identity: persistent via Supabase Storage JSON (`useSupabaseIdentityStore=true` in production)
- Sessions: persistent same path
- Profile / certifications / education: persistent same path (Supabase Storage JSON via `soc-store-supabase.ts`)
- Reports / alerts / attack events: `public.attack_events` (real table) for attack events; reports/alerts via Storage JSON
- Rate limits: `public.rate_limits` table (Phase 1.5.9 R-02 closure)
- **NOT persistent (memory fallback risk under R-03 Path γ):** if `SOC_IDENTITY_STORE=postgres` mode ever enabled, the dependent code paths would memory-fallback because platform-backbone tables don't exist. Currently `=supabase` default avoids this; documented as Phase 5.D test design constraint.

**SENIOR ARCHITECT NOTE:** the production-verified column is the direct Phase 4.A Z.8 inheritance. Three rows above are 🟡 (uncertain) or implicit-only (J-9 UI affordance question); honest signal beats over-claim. Phase 5.D may downgrade or drop journeys whose production verification can't be completed.

**REJECTED ALTERNATIVE:** assume every page renders a "fully working" journey in production. Rejected — Phase 3.D revision Z.10 lesson explicitly invalidates this approach; we name the uncertainty and let Phase 5.D scope decide.

---

## 2. R-E2E-XX Risk Register

Phase 5 adopts the pre-reserved `R-E2E-XX` namespace (Phase 2.A:295 forward-reference). Severity scheme matches prior phases. Risks are **gaps in end-to-end test coverage of production behavior**, NOT new bugs.

| Risk | Severity | OWASP / WCAG / pattern | Source surface | Description | Why severe |
|---|---|---|---|---|---|
| R-E2E-01 | **Critical** | A07 ID&A Failures | `/register` → `/auth/verify-pending` → `/verify` → `/login` → `/home` (full auth bootstrap) | **Auth bootstrap end-to-end untested.** Phase 1.D covers each route handler in isolation (~85 tests across login/register/logout/session/forgot/reset/verify/verify-resend), and Phase 1.5 hardened individual primitives (scrypt, rate-limiter, identity-validation). But the **glue between routes** — the user actually completing the register → email-verify → login → land-on-home sequence — has no test coverage. Production bug here = no one can sign up = demo-blocking. | Real attack chain risk: a regression to the verification token validation (e.g., URL-encoding mismatch between email template and verify endpoint) could silently break sign-up while individual unit tests stay green. Severity Critical because (a) it's the entire user-acquisition funnel, (b) no other test phase covers the cross-route handoff, (c) Resend email delivery is in the loop (production-only verifiable). |
| R-E2E-02 | **High** | A04 Insecure Design + WCAG 2.1.1 Keyboard | `/community` (Terminal + Lab Engine integration) | **Lab L1 happy-path solve untested end-to-end.** Phase 2.D covers Lab Engine logic (76 tests across validation/contract, reveal/detector, mutation/operations, filesystem, ctf-regression, cross-context-bypass). Phase 4.D covers AnsiText pure parser (16 tests). But **Terminal.tsx render layer + the user actually typing commands + reveal banner appearing + flag submission** is unverified together. Phase 4.A explicitly routed Terminal.tsx (861 LOC, R-UI-01) to Phase 5 E2E. | Flagship demo feature. A regression to Terminal's input handling (e.g., key binding for Tab completion, scroll-back retention) or to the engine→Terminal callback wiring would break the visible UX while engine-only tests stay green. Severity High because (a) it's the central interview-demo path, (b) unit tests can't catch the wiring layer, (c) accessibility (R-UI-01 partial) needs real-browser keyboard + screen-reader coverage. |
| R-E2E-03 | **High** | A01 Broken Access Control + persistence | `/portfolio?tab=certifications` (CRUD + R-API-01 idioms) | **Portfolio certification CRUD round-trip untested.** Phase 3.D Target #1 covers route handler IDOR closure (T-PC01-20, 20 tests). Phase 4.A routed PortfolioWorkspace (1564 LOC) to Phase 5. The user actually filling the form, submitting, navigating away, returning, and seeing the certification still present is the persistence contract — which depends on `SOC_IDENTITY_STORE=supabase` correctly persisting via Supabase Storage JSON (Z.10 critical assumption). | Production-realistic threat: if Storage JSON write succeeds but read shape drifts, the certification "saves" but doesn't appear on reload. Unit tests can't catch this because they mock the adapter. Severity High because (a) it's the user's portfolio data — losing it is demo-killing, (b) it's the simplest persistence verification that exercises Supabase Storage JSON read+write round-trip on production. |
| R-E2E-04 | High | A09 Logging + WCAG 4.1.3 Status Messages | `/home` (DashboardLayout mount + render) | **Dashboard crash-free mount on production untested.** DashboardLayout is 2165 LOC, dynamic-imported (ssr:false), uses ResizeObserver + rAF + d3-geo + topojson — surface size makes regression plausible. Phase 4.A routed it to Phase 5. Single "renders without error" smoke test would catch (a) bundle-time errors, (b) runtime errors during mount, (c) missing-dependency errors (e.g., topojson world-110m.json fetch failure). | A regression here results in `<DashboardSkeleton>` rendering forever or React error boundary firing — user sees an unusable home page after login. Severity High because (a) `/home` is the post-login landing, (b) dynamic-import + ssr:false means errors only surface in the browser (not Vercel build), (c) Phase 1.5.14.1 demo tuning recalibrates emissions — regression to tuning constants could break the perceived liveness. |
| R-E2E-05 | High | A07 ID&A Failures + R-15 lineage | `/forgot` → email → `/reset?token=...` → `/login` (recovery loop) | **Password recovery end-to-end untested.** Phase 1.D covers forgot + reset + reset/validate route handlers (~30 tests across the 3 routes). Phase 1.5.10 R-15 closed URL-escape risks in templates. Real recovery flow — user requests reset, receives email, clicks link, enters new password, logs in with new password — is unverified end-to-end. | Production-realistic: a regression to `assertSafeUrl` template logic (R-15 lineage) could make the reset link broken or maliciously redirectable. Severity High because (a) account-recovery is operationally critical, (b) Resend email delivery in loop, (c) cross-route token handoff is where unit tests have a blind spot. |
| R-E2E-06 | Medium | A04 Insecure Design | edge middleware CSRF + session-presence gates | **Middleware contract not directly tested at edge.** Phase 1.D + Phase 3.D unit tests assume middleware fires; real edge behavior (Origin/Referer header parsing, cookie cookie-presence-only check, PUBLIC_API_ROUTES exclusion list) is not directly observable in unit tests. A Playwright test that sends a cross-origin POST or a no-cookie POST verifies the actual edge layer. | Severity Medium because (a) unit tests do exercise the underlying logic indirectly, (b) middleware regression would be obvious during dev (rather than silent), (c) one or two E2E assertions cover the contract. |
| R-E2E-07 | Medium | A09 Logging + R-02 lineage | rate_limits.* table (Supabase) | **Multi-instance rate-limiter atomicity not E2E-tested.** Phase 1.5.9 R-02 closure migrated rate-limit state to `public.rate_limits` (Supabase Postgres). T-R10 + T-R11 (Phase 1.5.9 unit-level shared-state simulation) explicitly deferred "strict atomicity" to Phase 5 E2E (phase-1-a-final.md L121, L30). E2E test: rapid-fire 11+ failed login attempts against production siberlab.dev → expect 11th rejected with rate-limit error. | Severity Medium because (a) the unit-level closure already provides race-tolerant correctness for our scale, (b) E2E adds the real-Postgres+real-multi-instance assertion that unit tests can't reach, (c) closes a Phase 1 explicit Phase-5 deferral comment. |
| R-E2E-08 | Medium | A01 Broken Access Control | `/portfolio`, `/community`, `/zafiyet-taramasi`, `/home` (auth-gated routes) | **Anon-redirect contract for auth-gated routes not E2E-tested.** Each route has its own gating mechanism: `/portfolio` hard `redirect('/login')` server-side (BUG-006), `/home` via AppShellClient client-side, `/community` similar. A Playwright test that visits each gated route without a session cookie verifies all redirect paths converge to `/login`. | Severity Medium because (a) it's a uniformity assertion (all 4 routes should redirect identically), (b) regression here = security-equivalent (unauth user accidentally sees protected content), (c) tiny test surface (4 assertions). |
| R-E2E-09 | Medium | A02 Cryptographic Failures + R-API-03 lineage | session cookie + Supabase JSON Storage | **Production Supabase write path not E2E-verified.** Z.10 documented that platform-backbone tables don't exist; production identity/profile/reports persist via Supabase Storage JSON. An E2E test that creates a user via `/register`, completes verify, logs in, and then accesses profile (verifying the user record was actually written to Storage JSON) confirms the **whole adapter routing chain** works in production. | Severity Medium because (a) it's an integration-correctness check, (b) regression would be obvious very quickly in production but slow to debug (silent Storage write failure vs. unit-test mock), (c) one test absorbs Phase 3.D R-API-03 Z.10 follow-up. |
| R-E2E-10 | Medium | A06 Vulnerable & Outdated Components | external API surfaces (`/api/cves`, `/api/cybernews`, `/api/greynoise`) | **External API integration not E2E-tested.** Phase 3.A R-API-08 + R-API-09 (RSS XML parser, no rate limit on external calls) deferred MSW-based unit testing to Phase 3.C (skipped). Real production behavior — NVD upstream available, RSS feeds parseable, GreyNoise responsive — verified only by manual smoke. E2E test: navigate to `/zafiyet-taramasi?tab=cve`, expect at least 1 CVE rendered within 10s. | Severity Medium because (a) upstream failures (NVD 500, RSS feed compromise) are operational, not code, (b) E2E test detects deployment-time integration breaks (env var typo, CORS misconfig) that unit tests can't, (c) acceptable to flake on legitimate upstream outage (test design must distinguish). |
| R-E2E-11 | Low | WCAG 2.1.1 Keyboard | `/community` Terminal keyboard surface (R-UI-01 partial residual) | **Terminal full keyboard a11y not E2E-verified.** Phase 4.D AnsiText (T-AT01-16) covers parser. R-UI-01 partial closure routes Terminal full a11y (Tab completion, history navigation, scroll-back focus, screen-reader announcements) to Phase 5. A Playwright + axe-core E2E test runs against the real Terminal-mounted page and asserts no axe violations + Tab cycles through expected anchors. | Severity Low because (a) sighted UX is functional (R-UI-01 unit tests cover AnsiText), (b) full a11y is aspirational pending real screen-reader assist, (c) E2E + axe-playwright at most catches structural violations. |
| R-E2E-12 | Low | A05 Security Misconfiguration | production response headers (CSP, HSTS, X-Frame-Options, etc.) | **HTTP security headers not E2E-asserted.** Vercel auto-applies some defaults; project-side `next.config` controls others. A Playwright test that requests `siberlab.dev` and asserts presence of standard security headers (HSTS, X-Frame-Options, X-Content-Type-Options) would lock the production header contract. | Severity Low because (a) Vercel defaults are reasonable, (b) custom header config is rare in current codebase, (c) one or two assertions, locked once. |
| R-E2E-13 | Informational | — | Vercel preview URL stability | **Preview deployments per branch are non-deterministic for E2E baseline.** Each PR creates a unique preview URL; running E2E against a preview tests that branch's bundled state, but URL changes per commit. Production baseline (siberlab.dev) is the right E2E target; preview as opportunistic smoke. | Pure operational/CI consideration — no security implication. Documented for Phase 5.B CI design decision. |

**Summary by severity:** Critical = 1 (R-E2E-01); High = 4 (R-E2E-02 Lab solve, R-E2E-03 portfolio CRUD, R-E2E-04 dashboard mount, R-E2E-05 password recovery); Medium = 5 (R-E2E-06..R-E2E-10); Low = 2 (R-E2E-11..R-E2E-12); Informational = 1 (R-E2E-13). **Total = 13.**

**SENIOR ARCHITECT NOTE:** the Critical entry (R-E2E-01 auth bootstrap) is the FIRST Critical risk surfaced in the 5-phase audit cycle. Prior phases capped at High because their scope was narrower (unit-level isolation). E2E exposes the cross-route bootstrap as a Critical-severity user-acquisition risk because **no other phase tests the glue**.

---

## 3. Existing E2E Test Coverage

**Direct E2E test count: 0.** No Playwright config in repo, no `.spec.ts` files (except `node_modules/` unrelated), no `@playwright/test` in `package.json`, no `e2e/` or `tests/e2e/` directories. Clean slate for Phase 5.B.

**Indirect coverage (transitive from prior phases):**

| Surface | Prior coverage |
|---|---|
| Auth route handlers | Phase 1.D (T-LG, T-RG, T-LO, T-SS, T-FG, T-RS, T-RV, T-VF, T-VR — ~85 tests across 9 route handlers + middleware) |
| Auth primitives | Phase 1.5 (T-S01-15 scrypt, T-CE01-08 client-ip, T-INSTR boot, T-VC01-06 identity-validation) — ~50 tests |
| Lab Engine logic | Phase 2.D (T-CCB, T-CTFR, T-VC, T-RD, T-MO — 76 tests across engine/validation/reveal/mutation/fs/regression) |
| API route handlers | Phase 3.D (T-PC × 20, T-AL × 21 incl T-AL-A13, T-RP × 30 — 71 tests across profile/alerts/reports + R-API-05 sanitize) |
| UI components | Phase 4.D (T-FT × 13, T-AT × 16, T-SM × 12 — 41 tests across useFocusTrap + AnsiText + SearchModal) |
| Rate-limiter Postgres shared state | Phase 1.5.9 (T-R10, T-R11 — spy-backed shared map simulation; explicit Phase 5 deferral for strict atomicity) |
| Storage adapter Class 1/2/3 routing | Phase 1.D + Phase 3.D (T-AD01-09 + transitive via API tests) |

**Total transitive coverage:** 427 / 40 files (post-Phase-4.D baseline). **Zero exercise the production browser path** — every Phase 5.D test will be net-new E2E coverage. No prior phase touches Playwright, real-Resend, real-Supabase-Storage, or real-Postgres concurrency.

### 3.1 — E2E infrastructure gap inventory

| Gap | Current state | Phase 5.B closure |
|---|---|---|
| Test runner | none for browser-driven flows | `@playwright/test` (Playwright's native test runner; standalone from vitest) |
| Browser binaries | none | `npx playwright install chromium` (minimum); Firefox + WebKit optional |
| Test config | none | `playwright.config.ts` (NEW) with: baseURL, viewport, retries, projects (chromium minimum), reporter (list + html), webServer for local dev |
| CI integration | GitHub Actions not currently running E2E | Phase 5.B decision: skip CI E2E or add a separate workflow |
| Auth state persistence | none | Playwright `storageState` pattern: one test logs in, saves cookie state to JSON, subsequent tests reuse |
| Test fixtures (users) | none | Phase 5.C: fixture strategy (see Section 7) — disposable test user per run vs. shared seed user vs. ephemeral Supabase test project |
| Network mocking (Resend) | none | Phase 5.C: `page.route()` interception OR mock-mode env var that disables real Resend in test runs |
| Production vs local dev URL | implicit (npm run dev = localhost:3000; prod = siberlab.dev) | Phase 5.B: `PLAYWRIGHT_BASE_URL` env var convention |

**REJECTED ALTERNATIVE:** use Cypress instead of Playwright. Rejected — Playwright explicitly named in CLAUDE.md L173. Migration cost not justified.

**REJECTED ALTERNATIVE:** use Vitest browser mode (vitest v3+) for E2E. Rejected — vitest browser mode targets component-level browser tests, not multi-route user journeys with persistent auth state. Playwright is the right tool.

---

## 4. Test Gaps + Priority Ranking

Ranking criteria (Phase 2/3/4.A pattern):
1. R-E2E-XX severity
2. Demo-criticality (hocaAI / interview-demo path)
3. Test ROI (one E2E covers many unit-level surfaces transitively)
4. Production-verifiability (can the journey actually be tested against siberlab.dev?)

| Rank | Journey | LOC of test (estimated) | R-E2E-XX | Phase 5.D candidacy |
|---|---|---|---|---|
| 1 | **Auth bootstrap full-flow (J-1)** | ~100-150 LOC (multi-step, conditional email handling) | R-E2E-01 (Critical) | **Strongly recommended Target #1** |
| 2 | **Lab L1 happy path solve (J-2)** | ~60-100 LOC (Terminal keyboard typing + assertion on reveal banner) | R-E2E-02 (High) | **Strongly recommended Target #2** |
| 3 | **Portfolio certification CRUD (J-3)** | ~80-120 LOC (form fill + submit + reload + verify persistence) | R-E2E-03 (High) | **Strongly recommended Target #3** |
| 4 | Login → /home dashboard renders (J-4) | ~30-50 LOC (smoke only) | R-E2E-04 (High) | Phase 5.D **stretch candidate** (small surface, high value) |
| 5 | Password recovery flow (J-6) | ~100-150 LOC (same shape as J-1, mock email handling) | R-E2E-05 (High) | Phase 5.D **stretch candidate** |
| 6 | Anon → /portfolio redirect (J-5) | ~10-20 LOC | R-E2E-08 (Medium) | Phase 5.D follow-on candidate (tiny, can be bundled) |
| 7 | CSRF middleware blocks cross-origin (J-7) | ~20-30 LOC | R-E2E-06 (Medium) | Phase 5.D follow-on |
| 8 | Rate-limit shared state (J-10) | ~40-60 LOC | R-E2E-07 (Medium) | Phase 5.D follow-on (closes Phase 1 explicit deferral) |
| 9 | External API smoke (J via R-E2E-10) | ~30-50 LOC | R-E2E-10 (Medium) | Phase 5.D follow-on |
| 10 | Reports archive-then-delete (J-9) | ~60-80 LOC (gated by UI affordance verification) | (transitive) | **Out of scope** until UI affordance confirmed |

**What we're NOT recommending and why:**
- **R-E2E-11 (Terminal full a11y):** axe-playwright integration adds non-trivial scaffolding; defer to a focused a11y E2E pass after Top-3 lands.
- **R-E2E-12 (security headers):** small assertion but operationally Vercel-dependent; can land as a single test in housekeeping.
- **R-E2E-13 (Vercel preview):** purely a CI design decision for Phase 5.B; no test code.

---

## 5. Surgical Recommendation for Phase 5.D

**Three targets, ~3-5 test files, ~250-400 LOC of E2E test code, ~30-50 individual `test()` assertions.** Significantly smaller test-count than prior Phase D cycles (Phase 3.D: 71, Phase 4.D: 41) — but each E2E test is a much heavier unit (multi-step, real browser, real network).

### Target #1 — Auth bootstrap full-flow (R-E2E-01 closure)

Single most important journey. Closes the Critical-severity risk.

- T-E1-01 — Register new user with disposable email → see `/auth/verify-pending` rendered
- T-E1-02 — POST `/api/auth/verify` with valid token → 200 OK
- T-E1-03 — Verify success page renders + auto-redirect to `/login` (via `<meta http-equiv="refresh">` 3s — Playwright `page.waitForURL('/login', { timeout: 5000 })`)
- T-E1-04 — Login with verified credentials → land on `/home` (cookie `soc_session` set + `<DashboardLayout>` mount begins)
- T-E1-05 — Invalid verify token shows "Bağlantı geçersiz" error state
- T-E1-06 — Expired verify token shows "Bağlantı süresi doldu" + "Yeniden gönder" CTA
- T-E1-07 — Login with unverified account → 403 EMAIL_NOT_VERIFIED inline error (Phase 4.5 closure)

Estimated count: 7 tests, single `.spec.ts` file. Phase 5.C must provide a strategy for email-token capture (mock vs. test-mode env injection).

### Target #2 — Lab L1 happy path solve (R-E2E-02 closure)

Flagship demo path. Closes R-UI-01 partial residual.

- T-E2-01 — login-as-test-user (storageState fixture) → navigate to `/community` → Terminal renders
- T-E2-02 — Type `ls /home/operator/` + Enter → output appears with expected files
- T-E2-03 — Type `cat /home/operator/flag.txt` (or similar L1-required read) → flag content reveals
- T-E2-04 — Submit flag via Terminal input → reveal banner appears with success
- T-E2-05 — Reveal banner shows next-level title (NOT null — last-level guard tested in Phase 2.D T-RD19)

Estimated count: 5 tests, single `.spec.ts` file. May require Terminal-specific keyboard handling (xterm-like surfaces sometimes need `page.keyboard.type` directly to focused canvas/input).

### Target #3 — Portfolio certification CRUD round-trip (R-E2E-03 closure)

Exercises Supabase Storage JSON persistence (Z.10-critical) + R-API-01 idiom (Phase 3.D).

- T-E3-01 — login → navigate to `/portfolio?tab=certifications`
- T-E3-02 — Click "add certification" → modal opens → fill required fields (title, issuer, issueDate)
- T-E3-03 — Submit → certification appears in list immediately (optimistic UI or server round-trip)
- T-E3-04 — Reload page → certification still present (persistence verified end-to-end)
- T-E3-05 — Edit certification → field change persists across reload
- T-E3-06 — Delete certification → confirmation modal → confirm → certification removed → reload → still removed

Estimated count: 6 tests, single `.spec.ts` file. Storage JSON write+read round-trip is the key contract.

### Total Phase 5.D expansion estimate

**7 + 5 + 6 = 18 net new E2E tests** across 3 `.spec.ts` files. Each is heavier than a unit test; expected runtime ~30-60s per test, ~10-15 min full suite. Baseline vitest 427 unchanged (E2E is a separate runner). **Combined project test count: 427 unit + 18 E2E = 445.**

If Phase 5.B + 5.C land cleanly, Phase 5.D may absorb stretch goals (J-4 dashboard smoke ~3 tests; J-5 anon redirect ~4 tests) to ~25 E2E tests.

### Why not Target #N (negative cases)

- **R-E2E-05 password recovery:** same shape as Target #1 with one extra route (`/forgot`); folds into a future cycle after Target #1 establishes the email-handling pattern.
- **R-E2E-04 dashboard smoke:** great ROI but mostly a tautology if Target #1 (J-1) lands on `/home` successfully. Cover transitively in Target #1's last step.
- **R-E2E-07 rate-limit atomicity:** closes Phase 1 deferral but operationally requires 11+ rapid POST attempts against production — flaky under any network jitter. Defer to a focused rate-limit cycle with explicit retry strategy.
- **R-E2E-10 external API smoke:** depends on upstream availability — test design must distinguish legitimate flake from regression. Better as a separate operational smoke test, not Phase 5.D scope.

### Phase 5.D commit cross-reference

Phase 5.D commit `<COMMIT_HASH_TBD>` will implement Targets #1-3 above. Specific test IDs (T-E1-01..T-E3-06) locked per Section 9 Z.X decisions.

---

## 6. Phase 5.B Infrastructure Needs

**Assessment: SUBSTANTIAL — comparable in scope to Phase 4.B.** Phase 5.B introduces a parallel test runner (Playwright), browser binaries, CI considerations, and production-URL configuration.

### 6.1 — Dependencies (Phase 5.B adds)

| Package | Version target | Purpose | Estimated install size |
|---|---|---|---|
| `@playwright/test` (devDependency) | ^1.50 or latest stable | Playwright test runner + assertion library | ~5 MB Node-side |
| Playwright browser binaries (Chromium) | matched to `@playwright/test` | actual browser to drive | ~150 MB (Chromium); +250 MB if Firefox + WebKit added |
| `@axe-core/playwright` (optional) | ^4 | a11y assertions in E2E context (Phase 5.D R-E2E-11 stretch) | ~3 MB |

**Total estimated devDep + browser tree:** ~150-200 MB minimum (Chromium only). Acceptable for E2E tooling; not bundled in user-facing build.

**Browser install command:** `npx playwright install chromium` (one-time post-install; CI must cache).

### 6.2 — `playwright.config.ts` (NEW file, Phase 5.B creates)

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',                          // separate from src/
  fullyParallel: false,                       // sequential by default (rate-limit + shared user-fixture safety)
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  // webServer: spawn `npm run dev` only in local dev mode (CI assumes
  // separate deployment under test)
  webServer: process.env.CI ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
```

**SENIOR ARCHITECT NOTE:** `testDir: './e2e'` keeps Playwright tests SEPARATE from vitest. vitest's `include: ['src/**/*.test.{ts,tsx}']` (Phase 4.B) won't sweep up `.spec.ts` from `e2e/`; Playwright's default `*.spec.ts` pattern in its testDir doesn't pick up vitest tests. The two runners coexist cleanly.

**REJECTED ALTERNATIVE:** put E2E specs in `src/e2e/` to keep all tests under `src/`. Rejected — risks vitest config drift (would need to exclude `*.spec.ts`); Playwright convention is a top-level `e2e/` or `tests/`.

### 6.3 — Production vs local dev URL strategy

| Environment | URL | Purpose |
|---|---|---|
| Local dev | `http://localhost:3000` (via `npm run dev`) | iterating on tests; fast feedback |
| Production | `https://siberlab.dev` (set via `PLAYWRIGHT_BASE_URL`) | primary E2E baseline |
| Vercel preview | preview URL per branch (set via PR-time CI env) | opportunistic CI smoke |

Phase 5.D writes tests parameterized via `baseURL` — `page.goto('/login')` resolves correctly across all 3 environments without hardcoded hostnames.

### 6.4 — CI integration considerations (Phase 5.B decision)

| Option | Cost | Value | Recommendation |
|---|---|---|---|
| (a) GitHub Actions runs E2E on every PR | minutes per PR + Playwright cache management | catches regressions before merge | **Recommended for production journeys (Target #1-3)** |
| (b) GitHub Actions runs E2E only on `main` push | minutes per merge | catches regressions post-merge | acceptable fallback |
| (c) Manual local run only | zero CI cost | no automated regression detection | **NOT recommended** for Critical-severity coverage (R-E2E-01) |
| (d) Vercel preview smoke run after deploy | depends on Vercel integration | catches deployment-config issues | nice-to-have, requires custom workflow |

**Phase 5.B recommendation:** start with (b) on `main`, evaluate (a) after first stable run. Per Z.13 (proposed) below.

---

## 7. Phase 5.C Mock + Fixture Requirements

**Assessment: SUBSTANTIAL but achievable.** E2E inherits unique challenges that unit tests don't have:

| Surface | Challenge | Approach |
|---|---|---|
| **Resend email delivery** | Live email goes to real inboxes; can't read in CI | Phase 5.C decision: (a) `page.route('**/resend.com/**', mock)` interception + extract verification URL from request body in real time, OR (b) test-only env var that swaps Resend client for a file-write sink, OR (c) maildev/MailHog-style local SMTP catcher. **Recommend (a)** — keeps the test self-contained, doesn't require external service. |
| **Test user lifecycle** | Each E2E run needs a known user; can't pollute production user table | Phase 5.C decision: (a) ephemeral random-username-per-run (cleanup via API call in afterAll), OR (b) shared `e2e-test@siberlab.dev` user with known password, reset between runs. **Recommend (a)** — full isolation, no contamination. |
| **Auth state persistence** | Tests after Target #1 (auth bootstrap) shouldn't all sign up + verify | Playwright `storageState` pattern: one test logs in, saves cookies to `e2e/.auth/test-user.json`, subsequent tests in same project reuse via `use: { storageState: '...' }` |
| **Database state cleanup** | Tests that create reports/certifications leave production data | Phase 5.C decision: (a) afterAll cleanup hook via API DELETE, OR (b) accept ephemeral artifacts (small surface, manual cleanup periodic). **Recommend (a)** — disciplined teardown. |
| **Rate limiter interference** | 10+ failed logins during testing trip production rate-limit | Phase 5.C decision: separate test user pool per CI run; reset rate_limits via API if available, OR shift Target #1 to retry-friendly assertion. |
| **Lab Engine localStorage state** | Terminal evidence log persists in localStorage; each test needs clean state | Playwright `context.clearCookies() + page.evaluate(() => localStorage.clear())` in beforeEach |
| **Dashboard simulation cadence** | Critical pop-up fires every 5 min (Phase 1.5.14.1); E2E can't wait | Test asserts presence-of-stream + dismiss-button-functional, NOT cadence-itself. Implementation: `page.waitForSelector('[data-testid=alert-stream-row]', { timeout: 10_000 })` |
| **xterm.js / Terminal input** | Custom input handling may not respond to standard `page.keyboard.type` | Phase 5.D test-writing time discovery; fallback to `page.locator('[data-testid=terminal-input]').fill()` or `page.evaluate(() => component.dispatchEvent(...))` |
| **NIST NVD / GreyNoise / Cybernews APIs** | Real upstream calls in E2E may rate-limit or flake | Test design: assert at-least-one-result-within-timeout, not specific content; mark flaky-tolerant if needed |

**SENIOR ARCHITECT NOTE:** Phase 5.C has the largest design surface of any sub-stage C in the project. Mock strategy must balance fidelity (real production behavior) vs. determinism (test isolation). Phase 5.B + 5.C should be sequenced carefully — 5.B installs infra, 5.C designs fixtures, 5.D writes tests.

**REJECTED ALTERNATIVE:** seed test data via direct Supabase Storage JSON manipulation. Rejected — couples tests to internal storage layout; instead, exercise the same API surface as a real user.

---

## 8. Cross-References

### 8.1 — Phase 1.A Phase 5 deferrals (inherited)

- `docs/audit/phase-1-a-final.md:30` — *R-02 STATUS suffix: "T-R10 + T-R11 added as multi-instance shared-state simulation tests (unit-level via spy-backed shared map; true E2E Postgres testing is Phase 5 scope)."* — R-E2E-07 picks up.
- `docs/audit/phase-1-a-final.md:58` — coverage threshold: *"Phase 5 end → 80%"* — Phase 5 cycle target.
- `docs/audit/phase-1-a-final.md:121` — *T-R11: "Regression | 10 sequential recordFailure calls all dispatch to Supabase (atomic-tolerant simulation; strict atomicity is Phase 5 E2E scope)"* — R-E2E-07 closure path.

### 8.2 — Phase 2.A Phase 5 forward-references (inherited)

- `docs/audit/phase-2-a-lab-engine-audit.md:295` — *"Future Phase 3/4/5 should adopt their own namespaces (R-API-XX, R-UI-XX, R-E2E-XX) for the same hygiene."* — Phase 5.A adopts R-E2E-XX (this doc).
- `docs/audit/phase-2-a-lab-engine-audit.md:307` — *"Phase 5 end → 80%"* — coverage trajectory.

### 8.3 — Phase 3.A Phase 5 forward-references (inherited)

- `docs/audit/phase-3-a-api-contracts-audit.md:128` — *"R-API-03 (no RLS on platform-backbone) | none (RLS testing requires Supabase MCP / integration env — Phase 5 territory per phase-1-a-final.md:30 T-R11 note)"* — Phase 5 territory marker. **NOTE: R-API-03 RECLASSIFIED per Phase 3.D revision Z.10** — platform-backbone tables don't exist in production, so RLS testing is currently NON-actionable (Section 8.5 below expands).
- `docs/audit/phase-3-a-api-contracts-audit.md:276` — *"Phase 5 E2E (Playwright + real-Supabase environment) closes it."* — Phase 5 closure path, contingent on platform-backbone deployment per Z.10.
- `docs/audit/phase-3-a-api-contracts-audit.md:421` Z.3 option (c) — *"Defer to Phase 5 — full E2E RLS verification with real Postgres"* — deferred; reclassified post-Z.10.

### 8.4 — Phase 4.A Phase 5 forward-references (inherited)

- `docs/audit/phase-4-a-ui-a11y-audit.md:91` R-UI-01 STATUS suffix: *"Terminal.tsx itself (861 LOC, xterm-like surface) intentionally NOT unit-tested per Phase 4.A Section 5 rationale; routed to Phase 5 E2E (Playwright) for full keyboard + screen-reader coverage."* — R-E2E-02 + R-E2E-11 cover.
- `docs/audit/phase-4-a-ui-a11y-audit.md:185-187` — DashboardLayout / PortfolioWorkspace / Terminal all "Phase 4.D out of scope (recommend Phase 5 E2E)" — R-E2E-04 + R-E2E-03 + R-E2E-02 cover.
- `docs/audit/phase-4-a-ui-a11y-audit.md:271` — *"EmbeddedLogin / EmbeddedRegister / ForgotPasswordForm / ResetPasswordForm: auth-route tests (Phase 1.D, 85 tests) cover server contract. Render layer is a thin form-control wrapper; carving tests for it duplicates Phase 1.D coverage with little new signal. Defer to Phase 5 E2E for full flow."* — R-E2E-01 + R-E2E-05 cover.

### 8.5 — Z.10 memory-fallback constraint (CRITICAL Phase 5 design input)

Phase 3.D revision Z.10 documented: 21 platform-backbone tables exist in `supabase/platform-backbone-v1.sql` blueprint but are **NOT applied to production Supabase**. Production state: `public.attack_events` + `public.rate_limits` + `auth.*` (Supabase built-in).

**Implication for Phase 5.D E2E design:**

| Adapter routing path | Production behavior | E2E test implication |
|---|---|---|
| `useSupabaseIdentityStore=true` (default: `SOC_IDENTITY_STORE=supabase`) → `soc-store-supabase.ts` → Supabase Storage JSON app-state | **Persistent** (users, sessions, profile, certifications, reports stored in Storage JSON bucket) | E2E tests CAN verify persistence across sessions (the Target #3 portfolio CRUD round-trip works because Storage JSON IS production) |
| `useSupabasePostgresIdentityStore=true` (`SOC_IDENTITY_STORE=postgres`) → `soc-store-supabase-postgres.ts` → platform-backbone Postgres tables | **Memory-fallback** because tables don't exist; under R-03 Path γ rules, writes BLOCKED with `MemoryFallbackBlockedError` | Production currently uses `=supabase` default, NOT `=postgres`. Mode-switch would break the app immediately. E2E tests don't need to test the postgres-mode path (currently unreachable). |
| `useSupabaseJsonDomains=false` (`SOC_IDENTITY_STORE=disabled` OR `SUPABASE_URL` missing) → memory-only | Memory-only (R-03 Path γ blocks writes in production); local dev fallback | NOT a production-realistic E2E target. |

**Critical Phase 5.D test-design rule:** E2E tests assume `SOC_IDENTITY_STORE=supabase` (production default). Cross-session persistence works because Supabase Storage JSON is the persistence layer, NOT the platform-backbone Postgres tables. **R-API-03 RLS verification CANNOT be E2E-tested in current production state** because there are no platform-backbone tables to apply RLS to; R-API-03 stays RECLASSIFIED per Phase 3.D revision Z.10. Future cycle that deploys `platform-backbone-v1.sql` MUST also ship RLS migration + Phase 5 RLS-verification E2E tests.

### 8.6 — Z.8 production-verified column lineage

Phase 4.A introduced the production-verified column (Section 1.1 component table). Phase 5.A inherits and extends:
- Section 1.1 route table (build-verified)
- Section 1.2 journey table (production-verified column per journey)
- Section 1.3 verification methodology paragraph (combines build map + Phase 3.D Z.10 findings + manual smoke)

Per Phase 4.A Z.8 mentor decision, this is a **permanent audit-doc convention** going forward. Phase 5.A is the second cycle to apply it; future maintenance cycles inherit.

### 8.7 — CLAUDE.md alignment

- CLAUDE.md L173 — *"Phase 5 — End-to-end (Playwright user journeys)"* — Phase 5.A audit doc covers exactly this scope (Playwright test runner, user journey definition, production target).
- CLAUDE.md L175 — *"A produces report ONLY."* — this commit ships only `docs/audit/phase-5-a-e2e-journeys-audit.md`.

### 8.8 — Pending-amendments cross-reference

The Phase 1.A pending-amendments register (10 OPEN, 1 numbering gap A-16, post-Phase-3.D-revision) contains no E2E-specific entries. R-E2E-XX risks introduced in this audit are net-new with no prior amendment lineage.

---

## 9. Mentor Decision Points (Z.X)

Mentor's call before Phase 5.B + 5.D move forward. Each marked with agent recommendation + alternatives.

### Z.1 — Phase 5.D scope (Top 3 acceptance)

Section 5 recommends Targets #1-3: auth bootstrap + Lab L1 solve + portfolio CRUD (~18 tests across 3 `.spec.ts` files). Mentor decides:
- (a) Accept Top-3 as Phase 5.D scope.
- (b) Reduce to Top-2 (drop portfolio CRUD, defer to housekeeping).
- (c) Expand to Top-5 (add dashboard smoke + password recovery).
- (d) Different ordering.

Agent recommends (a). Matches the "tight scope wins" pattern from Phase 2.D + 3.D + 4.D. Each E2E test is heavier than a unit test; 18 tests are already a substantial cycle.

### Z.2 — Phase 5.B + 5.C cycle deliverables

Phase 5.B requires REAL deliverables (unlike Phase 2.B / 3.B SKIPPED). Mentor decides:
- (a) Phase 5.B atomic separate commit (deps + config + CI consideration). Phase 5.C atomic separate commit (fixtures + auth state + mocking). Phase 5.D third commit (tests). **3-commit cycle.**
- (b) Phase 5.B + 5.C atomic, separate from 5.D. **2-commit cycle.**
- (c) Phase 5.B + 5.C + 5.D one atomic commit. **1-commit cycle (large).**

Agent recommends (b). Phase 4.B precedent (commits `d36b1f0` + `2ea4e60`) shows infrastructure absorbing both deps + mocks works cleanly when the mock surface is small. Phase 5.C's larger mock surface (Resend interception, user lifecycle, storage state) still fits in a single 5.B+C commit if test-fixtures live in `e2e/_fixtures/` (or similar) and don't include test cases.

### Z.3 — Browser project scope

Section 6.1 recommends Chromium-only. Mentor confirms or expands:
- (a) Chromium only (smallest install footprint, fastest CI)
- (b) Chromium + Firefox (cross-engine coverage)
- (c) Chromium + Firefox + WebKit (Safari engine — important for siberlab.dev demo on macOS)

Agent recommends (a). Cross-engine bugs are rare for our surface (no IE/legacy concerns); Chromium reflects 65%+ of real users + matches Vercel's render path. Add WebKit if Safari-specific regression observed post-launch.

### Z.4 — Resend email handling strategy

Section 7 lists 3 options for handling email verification in E2E. Mentor decides:
- (a) `page.route()` interception of `**/resend.com/**` — extract verification URL from request body in real time
- (b) Test-only env var (`RESEND_API_KEY=test-mode`) swaps Resend client for a file-write sink that the test reads
- (c) Local SMTP catcher (Mailpit/MailHog) — heaviest infra

Agent recommends (a). Self-contained, no extra services, no env var coupling. The verification URL is constructed server-side and POSTed to Resend's API — Playwright route interception catches the POST body, extracts the URL, and the test continues with `page.goto(url)`.

### Z.5 — Test user fixture strategy

Section 7 lists 2 options for test user lifecycle. Mentor decides:
- (a) Ephemeral per-run random user (username + email randomly generated, full register + cleanup)
- (b) Shared seed user (`e2e-test@siberlab.dev`) reset between runs via API call

Agent recommends (a). Full isolation, no contamination concerns, naturally exercises the register flow as part of every E2E run (Target #1 is the auth bootstrap by definition).

### Z.6 — Auth state persistence pattern

Section 7 names Playwright `storageState` for re-using login across tests. Mentor confirms:
- (a) Save `storageState` after Target #1's successful login → tests in Targets #2, #3 reuse
- (b) Each test does its own login (slow but clean isolation)
- (c) Hybrid: shared state for fast "happy-path" tests, fresh login for negative-path / RBAC tests

Agent recommends (c). Hybrid balances speed and isolation. Target #2 (Lab solve, demonstrably independent of auth flow) can reuse Target #1's saved state. Negative-path tests (e.g., login with wrong password) need fresh state.

### Z.7 — CI integration timing

Section 6.4 names 4 CI options. Mentor decides:
- (a) GitHub Actions on every PR (highest cost, most value)
- (b) GitHub Actions on `main` push only (medium cost)
- (c) Manual local-only (lowest cost, no automation)
- (d) Vercel preview hook (custom integration)

Agent recommends (b) for Phase 5.B initial deployment. Evaluate (a) after first stable month of green runs.

### Z.8 — Test ID convention for Phase 5.D

Phase 2.D adopted `T-VC / T-RD / T-MO`. Phase 3.D adopted `T-PC / T-AL / T-RP`. Phase 4.D adopted `T-FT / T-AT / T-SM`. Phase 5.A proposes:
- `T-E1-NN` — Target #1 (auth bootstrap)
- `T-E2-NN` — Target #2 (Lab L1 solve)
- `T-E3-NN` — Target #3 (portfolio CRUD)

Em-dash separator preserved. Two-digit numeric suffix (matches Phase 2/3/4 prefix style). Optional stretch: `T-E4` dashboard, `T-E5` password recovery, `T-E6` security headers.

Mentor confirms before Phase 5.D writes tests.

### Z.9 — Phase 5 cadence after Phase 5.A

Standard cadence options (mirror Phase 2 / 3 / 4):
- (a) Phase 5.A audit → Phase 5.B + 5.C atomic → Phase 5.D tests. **3-cycle.**
- (b) Phase 5.A → Phase 5.B (infra) → Phase 5.C (fixtures) → Phase 5.D (tests). **4-cycle.**
- (c) Phase 5.A → Phase 5.B + 5.C + 5.D atomic. **2-cycle (large).**

Agent recommends (a). Matches Phase 4 precedent (4.B absorbed 4.C); Phase 5.C mock surface, while larger than 4.C, is still well-bounded and design-compatible with a single 5.B+C commit.

### Z.10 — R-E2E-13 (Vercel preview URL stability)

Vercel previews are per-branch; URL changes per commit. Mentor decides:
- (a) Pin E2E baseline to production (siberlab.dev) only; previews informally smoke-tested
- (b) Add preview smoke as opportunistic CI step (parses URL from PR comment, runs subset)
- (c) Defer to housekeeping after Phase 5.D stable

Agent leans (a). Phase 5 establishes the baseline first; preview integration can layer on later.

### Z.11 — Memory-fallback constraint follow-through

Section 8.5 documents the Z.10 implication: production currently uses Supabase Storage JSON for identity persistence (not platform-backbone Postgres). Mentor confirms:
- (a) Phase 5.D tests assume `=supabase` mode; no `=postgres` mode E2E coverage until platform-backbone deployed
- (b) Phase 5.D also tests `=postgres` mode (would require pre-deploying platform-backbone-v1.sql — operational decision outside Phase 5.D scope)
- (c) Document as known limitation; revisit in future cycle

Agent recommends (a) + (c). Tests target current production; mode-switch is an operational decision (platform-backbone deployment), not a test-coverage decision.

### Z.12 — Inherited Z.8 + Z.10 conventions (no new decision; tracked here)

Phase 4.A Z.8 (production-verified column) + Phase 3.D revision Z.10 (production-state verification) inherited as **permanent audit conventions**. Phase 5.A applied both. No further action; Z.8 + Z.10 are now standard discipline through Phase 5.D + future audits.

---

**End of Phase 5.A audit. Section 9 mentor decision points Z.1-Z.11 await response before Phase 5.B / 5.C / 5.D proceed. Z.8 + Z.10 + Z.12 inherited conventions permanently in effect.**
