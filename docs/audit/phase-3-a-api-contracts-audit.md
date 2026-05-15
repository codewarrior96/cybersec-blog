# Phase 3.A — API & Contracts Audit

**Status:** Draft (sub-stage A: report only) · **Date:** 2026-05-14 · **Phase:** 3 of 5 · **Sub-stage:** A (Audit) · **Author:** Claude (with Salim review)

Canonical Phase 3.A deliverable. Mirrors Phase 2.A structure (9 sections: inventory → risk register → existing coverage → gaps → surgical recommendation → infra needs → mock requirements → cross-references → mentor decisions). CLAUDE.md L175 sub-stage discipline applies: **this commit produces this markdown file and nothing else**.

Audit register state at Phase 3.A start: 8 RESOLVED + 12 OPEN amendments + 1 numbering gap (A-16). Risks: Phase 1 R-01..R-22 (14 closed in Phase 1.5 series), Phase 2 R-LAB-01..R-LAB-15 (Lab Engine surface). Phase 3 opens **R-API-XX** namespace (new, no collision).

---

## 1. Route + Module Inventory

CLAUDE.md L171 scope: CRUD routes, RLS verification, external integrations (CVE / Greynoise / Resend).

### 1.1 API route handlers (`src/app/api/**/route.ts`) — 28 routes, 9 domains, ~2360 LOC

| Domain | Routes | LOC | Auth gate | Status |
|---|---|---|---|---|
| **auth** (Phase 1 scope) | 9 routes — login, register, logout, session, forgot, reset, reset/validate, verify, verify/resend | 921 | varies | ✓ tested Phase 1.D + 1.5 (180+ tests) |
| **profile** | 8 routes — me, avatar (POST/DELETE), avatar/[userId] (GET), certifications (POST), certifications/[id] (PATCH/DELETE), certifications/assets/[id] (GET), education (POST), education/[id] (DELETE-via-PATCH or PATCH) | 588 | `requireSession` (self-owner gate inside) | ✗ untested |
| **alerts** | 2 routes — alerts (GET/POST), alerts/[id] (PATCH) | 193 | `requireSession` (GET), `requireRole('analyst')` (POST/PATCH) | ✗ untested |
| **reports** | 2 routes — reports (GET/POST/PATCH), reports/[id] (DELETE) | 222 | `requireSession` + ownership gate (delete only on archived + self-owner) | ✗ untested |
| **users** | 2 routes — users (GET, POST admin-only), users/me (DELETE self-account) | 206 | `requireSession` (GET), `requireRole('admin')` (POST), `requireSession` + password re-auth + 'DELETE' confirm literal (DELETE me) | ✗ untested |
| **telemetry/demo** | 2 routes — live-attacks (GET), metrics/live (GET) | 92 | `requireSession` | ✗ untested |
| **external** | 3 routes — cves (GET, NIST NVD), greynoise (GET, Greynoise API + mock fallback), cybernews (GET, 5-RSS-feed aggregator) | 472 | none (public) | ✗ untested |

**Total:** 28 route handlers / ~2360 LOC. **Auth routes covered by Phase 1 (180+ tests).** Non-auth surface (19 routes, ~1439 LOC) is the Phase 3 target.

### 1.2 Storage adapter (`src/lib/soc-store-adapter.ts`) — 40+ exports

Public surface enumerated via `grep -n "^export" src/lib/soc-store-adapter.ts`:

- **Identity ops (Class 1 per A-21):** authenticateUser, createSession, deleteSession, getSessionByToken, listAssignableUsers, createUser, registerUser, readUserByEmailKey, readUserByUsername, findUserByVerifyToken, setEmailVerified, setEmailVerifyToken, findUserByPasswordResetToken, setPasswordResetToken, consumePasswordResetToken, deleteAllSessionsForUser, cleanupExpiredSessions
- **JSON domain ops (Class 2):** writeAuditLog, listReports, createReport, archiveReport, deleteReport, deleteUserCascade, getPortfolioProfile, getPortfolioCertificationById, updatePortfolioProfile, updatePortfolioAvatar, createPortfolioCertification, updatePortfolioCertification, deletePortfolioCertification, createPortfolioEducation, updatePortfolioEducation, deletePortfolioEducation
- **Operational ops (Class 3):** listAlerts, createAlert, patchAlert, purgeOldAttackEvents, recordAttackEvent, getLiveMetrics
- **R-03 hardening:** `MemoryFallbackBlockedError` class (Phase 1.5.7 Path γ)

Existing test: `src/lib/soc-store-adapter.test.ts` (Phase 1.D.9 — covers T-AD01..T-AD09 routing class invariants + Path γ regression guards).

### 1.3 RLS surface (`supabase/*.sql`) — 3 files

| File | Tables | RLS state | Access pattern |
|---|---|---|---|
| `attack-events.sql` | `public.attack_events` (1 table) | **enabled, with policy** — `attack_events_read_auth` allows `select` to `authenticated` role | service_role bypass for writes; authenticated reads |
| `rate-limits.sql` | `public.rate_limits` (1 table) | **enabled, no policies** — deny-all-except-service-role | server-side adapter only |
| `platform-backbone-v1.sql` | **21 tables** across 5 namespaces (identity, platform, content, learning, operations) | **NO RLS** (no `enable row level security` statements, no policies) | implicit service-role-only via app-layer access pattern |

**Critical observation for R-API risk register:** platform-backbone-v1 tables lack explicit RLS toggle. If Supabase service-role key ever leaks OR an authenticated client connects directly to Postgres bypassing the app layer, all 21 platform-backbone tables are wide open. Compare to rate_limits + attack_events which have RLS-enabled + deny-by-default policy state (defense in depth).

### 1.4 External integrations — 3 surfaces

| Integration | Route | Auth/key | Caching | Fallback |
|---|---|---|---|---|
| NIST NVD (CVE feed) | `/api/cves` | None (anonymous) | `Cache-Control: public, s-maxage=300` + `next.revalidate: 300` | 500 JSON with empty cves array on failure |
| Greynoise (IP intel) | `/api/greynoise` | `process.env.GREYNOISE_API_KEY` (optional — falls back to MOCK if unset) | `s-maxage=300` | Hardcoded MOCK payload on env-unset OR API failure |
| Resend (email send) | not a route — `src/lib/email.ts` | `process.env.RESEND_API_KEY` via lazy `getResendClient()` getter | n/a | discriminated-union return `{ ok: false, error }` |
| RSS aggregator (5 feeds) | `/api/cybernews` | None | `s-maxage=300` + `next.revalidate=600 swr` | `Promise.allSettled` silently discards rejected feeds |

### 1.5 Existing API test surface

- **9 auth route tests** (Phase 1.D, ~180+ tests with Phase 1.5 hardening additions)
- **Lib test infrastructure** (16 lib tests excluding `lab/`): api-auth, audit-helpers, auth-shared, client-ip, content-encoding, email-templates, email, html-escape, identity-rules, identity-validation, rate-limiter, security, soc-runtime/{adapter,machine}, soc-store-adapter, soc-store-memory
- **ZERO non-auth route tests.** Phase 3 surface (19 routes) has no route-level tests today.

---

## 2. Risk Register (R-API-01..R-API-15)

Phase 3 adopts new namespace **R-API-XX** alongside Phase 1 (R-01..R-22) and Phase 2 (R-LAB-01..R-LAB-15). Severity scheme matches Phase 1 (Critical / High / Medium / Low / Informational).

| ID | Severity | OWASP | File(s) | Risk | Exploit / failure scenario |
|---|---|---|---|---|---|
| R-API-01 | **High** | A01 Broken Access Control | `src/app/api/profile/certifications/[id]/route.ts` (PATCH/DELETE), `assets/[id]/route.ts` (GET) | **IDOR via numeric certification IDs**: PATCH gate at L36-39 reads `existing = getPortfolioCertificationById(certificationId)` then checks `existing.userId !== guard.session.user.id` — returns 404 (existence-mask). DELETE at L112 passes `userId` to `deletePortfolioCertification(id, userId, ...)` — adapter is expected to enforce userId. assets/[id] GET at L45-50 returns explicit 403 on userId mismatch. Three different idioms; race vulnerable if adapter's ownership check is anywhere weaker than route's check (TOCTOU between getPortfolioCertificationById read at PATCH L36 and updatePortfolioCertification write at L69). | Attacker enumerates certification IDs (numeric, sequential), constructs PATCH request for victim's cert id. Race: between owner-check read and update write, a deletion-and-replacement could land foreign content. Realistic attack chain: low-priv user A registers → certification id=42 created for user B (another user) → user A PATCHes /api/profile/certifications/42 with payload claiming new content + asset → if adapter's `userId` arg isn't strictly enforced, user A's content overwrites user B's. Severity High because (a) IDOR is a primary access-control failure, (b) sequential IDs make enumeration trivial, (c) education/[id] PATCH would have the same shape if not similarly guarded. |
| R-API-02 | **High** | A01 Broken Access Control | `src/app/api/alerts/route.ts`, `alerts/[id]/route.ts` | **Role gate `analyst` for write** is correct, but the `requireRole` middleware (`src/lib/api-auth.ts:25`) only checks RBAC at route entry — does NOT cross-check that the assignee in POST body (or the role being mutated in PATCH) makes sense. An analyst can assign an alert to admin's user-id, or PATCH an alert to claim/resolve regardless of original assignee. Compare to Phase 1.5.8 R-19 routing analysis. | Analyst A claims an alert assigned to admin B. The PATCH at `/api/alerts/[id]` accepts `{claim: true}` payload without verifying current assignee or whether claim transfers ownership semantically. Server-side ownership semantics live entirely in `patchAlert` adapter (`src/lib/soc-store-adapter.ts:213`); route layer doesn't audit-log the claim transition for analyst-to-admin escalation. Severity High because RBAC pass + business-logic gap = silent privilege escalation in operational data. |
| R-API-03 🟡 RECLASSIFIED | **High** | A02 Cryptographic Failures + A05 Security Misconfiguration | `supabase/platform-backbone-v1.sql` (21 tables across identity/platform/content/learning/operations namespaces) | **No RLS on platform-backbone tables**. `attack-events.sql` + `rate-limits.sql` enable RLS with deny-by-default policies. `platform-backbone-v1.sql` has zero `enable row level security` + zero `create policy` statements across 299 lines / 21 tables. Reliance on app-layer access control alone — if Supabase service-role key leaks OR an authenticated client (e.g., via supabase-js anon client) reaches Postgres directly, all platform-backbone tables are fully readable/writable. | Concrete attack chain: (1) attacker obtains a logged-in user's session OR Supabase anon JWT (via XSS or leaked-from-browser-storage), (2) constructs `supabase.from('identity.users').select('*')` query, (3) attempt succeeds because no RLS gate. Defense-in-depth gap. Note: production currently uses service-role from server-side adapter only; this risk activates if architecture ever exposes Supabase REST/PostgREST to authenticated clients. Severity High because configuration error rather than code error — easier to miss in review, broad blast radius. **STATUS (Phase 3.D revision commit `152d872`):** RECLASSIFIED — operator verification via `information_schema` query revealed the 21 platform-backbone tables exist in `supabase/platform-backbone-v1.sql` BLUEPRINT but were **never applied to production Supabase**. Actual production state: `public.attack_events` + `public.rate_limits` + `auth.*` (Supabase built-in). RLS migration cannot target non-existent tables. Risk reclassified as preparatory work pending production deployment of `platform-backbone-v1.sql` itself; severity remains High but currently non-actionable. Future cycle that deploys the 21 tables MUST ALSO ship RLS migration in same operation. See Section 9 Z.10 for full production-vs-blueprint divergence narrative + pattern lesson for Phase 4.A+ state gathering. |
| R-API-04 | **High** | A09 Security Logging & Monitoring Failures | `src/app/api/users/me/route.ts` (DELETE) | **Account self-delete cascade** (`deleteUserCascade`) performs irreversible deletion of: sessions, reports, certifications + asset binaries, educations, avatar binaries, profile, indexes. The route comments document banking-grade safety (password re-auth + 'DELETE' literal confirm). Both gates present. BUT: cascade triggers `writeAuditLog` inside adapter; comment at L107-111 says `AUDIT_LOG_FAILED` aborts cascade and returns 500. Means: if audit log surface is down (Supabase outage scenario, R-03 fallback active), legitimate self-delete fails — but that's the intended Phase 1.5.7 Path γ semantics. Inverse risk: if audit log surface fires successfully BUT cascade partially fails mid-operation (asset delete throws between users-row delete and session-purge), audit log records "deleted" while user data remains orphaned. | Attacker / unhappy user requests self-delete during transient asset-store outage. Audit log records the intent + counts; physical delete partial. Orphan sessions remain valid for some time (deleteAllSessionsForUser is inside cascade, ordering matters). Severity High because account-deletion semantics is high-trust UX. Note Phase 1.5.7 R-03 closed silent-fallback writes; this is a *partial-failure* path not covered by R-03's binary block-or-allow. |
| R-API-05 ✅ FIXED | Medium | A03 Injection | `src/app/api/reports/route.ts` (POST `content` field, 50,000 char limit) | **Stored-XSS via report content**: `createReport` accepts `content` up to MAX_CONTENT_LENGTH = 50_000 chars after trim. `hasBrokenEncoding` filters `�`. No HTML-escape, no markdown sanitization. If reports are ever rendered as HTML in admin UI without escape, attacker creates a report with `<script>` payload that fires when an analyst opens the report. R-13 fixed `displayName` injection in email-templates; here `content` is the analog field for reports surface. | Phase 1.A R-13 row L41 already noted: "stored-XSS risk if displayName surfaces in admin UI without escape (Phase 3 audit)." Reports surface is the Phase 3 audit predicted. `archiveReport` doesn't change content; `deleteReport` removes it. The XSS surface is the read path (`listReports` returns full content to client). No HTML-escape applied server-side. UI render path (`src/app/zafiyet-taramasi/`) NOT in Phase 3 scope; the *server contract* is the audit target. Severity Medium because requires UI render-path complicity. **STATUS:** FIXED in Phase 3.D commit `152d872` via defense-in-depth two-layer (5th instance of the pattern — R-13/R-21/R-15/A-17 lineage): **Layer 1 (input sanitization)** new `src/lib/sanitize.ts` exports `sanitizeReportContent()` — regex strip of `<script>`/`<iframe>`/`<object>`/`<embed>`/`<link>`/`<meta>`/`<form>` tags + `javascript:`/`vbscript:`/`data:text/html` URI schemes + `on*` event handlers (quoted + unquoted variants). Server-safe (no DOM dep). Reports route POST invokes before storage. **Layer 2 (output escape)** preserved — React/MDX default text rendering is XSS-safe (HTML interpolation requires opt-in via dangerouslySetInnerHTML, absent in current UI path). T-RP07-13 lock the input strip; T-RP12 verifies benign markdown-like content preserved. |
| R-API-06 ✅ RESOLVED (Wave 2B) | Medium | A01 Broken Access Control | `src/app/api/users/route.ts` (GET) | **`listAssignableUsers` GET at L22-28 requires only `requireSession`** — any authenticated user (viewer/analyst/admin) can list all assignable users. Compared to PRIVILEGED POST which uses `requireRole('admin')`. The GET returns user enumeration: id, username, displayName, role per user. A viewer-role user can enumerate all admins + analysts in the system. | Viewer-role attacker (e.g., compromised viewer account) hits GET /api/users → returns complete user list with roles. Output then drives username harvesting + role-targeted password spray. Severity Medium because (a) requires existing low-priv compromise, (b) `listAssignableUsers` exposes username only (no email), (c) the function name implies "users I can assign things to" — a UX feature, not a security boundary. But the design lacks the principle-of-least-privilege constraint. **STATUS (Wave 2B commit `775525c`):** RESOLVED — GET handler now uses `requireRole(request, 'analyst')` (matches the assignee-picker UX need: analysts legitimately enumerate for assignment workflows; viewers do not). Non-analyst session returns 403; unauthenticated returns 401. T-UR01-04 (4 tests in `src/app/api/users/__tests__/route.test.ts`) verify all four paths: unauth, analyst-accepted, viewer/insufficient (403), admin-accepted via `hasRoleAtLeast` defense-in-depth. POST handler's existing `requireRole('admin')` gate unchanged. |
| R-API-07 | Medium | A04 Insecure Design | `src/app/api/profile/certifications/route.ts` (POST), `src/lib/portfolio-assets.ts:saveCertificationAsset` | **File upload validation**: `assertMagicMatches` (portfolio-assets.ts L70) checks magic bytes for JPEG/PNG/WEBP/PDF. MAX_CERTIFICATION_ASSET_BYTES = 10 MB. Filename sanitization replaces `[^a-zA-Z0-9._-]` with `-`. BUT: no quota per user — a single user can upload 1000s of certifications, each up to 10 MB, accumulating storage. No content-type sniff beyond magic bytes (file could be valid PDF wrapper containing JS). No virus scanning. | Storage exhaustion: attacker creates account, uploads 1000 × 10 MB PDFs. 10 GB consumed before any cap fires. Supabase Storage bucket fills. Severity Medium because (a) requires authenticated user, (b) Supabase bucket sizing operational issue, (c) realistic in demo context with no monitoring. Also: PDF content not scanned (a real PDF can carry JavaScript that executes when an admin downloads + opens via desktop viewer). |
| R-API-08 | Medium | A06 Vulnerable & Outdated Components | `src/app/api/cybernews/route.ts` (5 RSS feeds, regex-based XML parser) | **Custom XML parsing via regex** (cybernews route L37-49 `extractTag` uses `RegExp` with hand-rolled CDATA handling). Regex-based XML parsing is a known anti-pattern: external feed content can include nested tags, malformed CDATA, or unicode that breaks parser assumptions. The 5 feeds (THN, Krebs, BleepingComputer, SANS ISC, SecurityWeek) are public RSS aggregators; if one feed is compromised + serves malicious XML, parser behavior is undefined. Additional risk: `cleanText` decodes HTML entities including `<` and `>` from feed content — combined with feed.description copied into client UI, a malicious feed could embed scripts that round-trip through the parser-decoder. | Compromise scenario: attacker MITM's one of the 5 feed URLs (e.g., via DNS hijack of feedburner.com), serves malicious RSS. The cleanText decoder + 220-char-truncated description ends up in the UI. If UI renders descriptions as HTML, stored-XSS via aggregator content. Severity Medium because (a) requires upstream feed compromise, (b) UI render path determines exploit (not in Phase 3 scope), (c) Phase 1 R-13 closed the email side of similar threat — UI surface deferred to Phase 4 (UI & Accessibility) per CLAUDE.md L172. |
| R-API-09 | Medium | A04 Insecure Design + A09 | `src/app/api/cves/route.ts`, `src/app/api/greynoise/route.ts` | **No rate limiting on external-call routes**. /api/cves makes one NVD API call per request (5 req/30s NVD limit). /api/greynoise makes one Greynoise API call. Both have `s-maxage=300` server cache, BUT cache is per-Vercel-edge-node not global; with many concurrent fresh requests, edge cache stampede possible. /api/cybernews fans out 5 feed fetches per request. No rate limit on any of the three. Combined: a malicious user can drive 5 cybernews-feed fetches × N concurrent requests = bandwidth amplification. | Attacker scripts 100 concurrent fetches to /api/cybernews → 500 outbound RSS fetches before edge cache catches up. NVD anonymous rate limit (5 req/30s) trips quickly under similar amplification on /api/cves, then /api/cves returns 500 to legitimate users for ~30s. Severity Medium because (a) no auth on these routes means anonymous DoS possible, (b) impact bounded by external rate limits + server cache, (c) Phase 1.5.9 R-02 hardened the auth-route rate limiter but didn't extend to external-call routes. |
| R-API-10 | Medium | A05 Security Misconfiguration | `src/app/api/profile/avatar/[userId]/route.ts` GET | **Avatar GET allows authenticated cross-user fetch**: route at L29 reads `userId` from URL path, returns ANY user's avatar to any authenticated session — no ownership gate. This is correct for "everyone needs to see operator avatars in attribution columns" UX, but the GET also returns a Supabase **signed URL** (L48 `createSignedObjectUrl(avatarMeta.assetPath, 60)`) with 60-second TTL — which the recipient can share or pin in browser tab. Cross-user signed URLs persist for 60s after the original request. | Limited blast radius: avatars are user-uploaded portrait images, not sensitive. But a signed URL leaked off-platform (clipboard share, screenshot of URL bar) can be retried by anyone for 60s. Severity Medium because (a) signed-URL leak via referrer/share is a real-world pattern, (b) 60s window is operationally short, (c) the trade-off between "everyone sees attribution avatars" UX and "signed URL never shared" is a Phase 3 doc-level decision, not a bug. |
| R-API-11 | Low | A09 | `src/app/api/profile/avatar/route.ts` (POST) | **Avatar upload cleanup on partial failure**: route at L26-57 uploads new asset → calls updatePortfolioAvatar → on `!updated`, deletes the new asset (L42) and returns 404. On any thrown exception (L51-57), deletes new asset and returns 400. Cleanup is best-effort. If `deleteStoredAsset` itself throws (Supabase Storage outage), the new asset stays orphaned. No retry queue, no orphan-sweep batch. | Storage build-up over time as failed uploads leave orphans. Severity Low because (a) requires partial-failure path to trigger, (b) avatar files are small (≤5 MB), (c) no security implication. |
| R-API-12 | Low | A04 Insecure Design | `src/app/api/reports/route.ts` (POST `severity` field default `'LOW'` when unspecified) | **Severity taxonomy ambiguity**: reports route uses uppercase 4-level `'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'`. attack_events table (per `supabase/attack-events.sql:9`) uses lowercase 3-level `'critical' | 'high' | 'low'`. live-attacks route maps `'P1' → 'critical'`, etc. Dashboard (per Phase 1.5.14 dashboard tuning audit Section E) uses uppercase 4-level `'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'`. **Three parallel non-communicating severity taxonomies** in the codebase. | Latent risk — currently no bridge between layers. If Phase 3 introduces an integration (e.g., dashboard subscribes to attack_events table), normalization is required. Severity Low because no current exploit, just documentation/integration hygiene concern. |
| R-API-13 ✅ RESOLVED (Wave 2B) | Low | A03 | `src/app/api/profile/me/route.ts` (PUT) | **Profile field validation is delegated to `validateProfilePayload`** (src/lib/portfolio-validation.ts:49) which is a thin wrapper. The actual field-level rules (bio max length, specialties max items, etc.) live there but with no explicit denylist for CRLF or HTML chars on display-name-like fields. Same R-13/R-14 family pattern (HTML-escape + CRLF strip) was closed for `displayName` Phase 1.5.2 + 1.5.10 — profile bio + headline fields aren't covered. | Profile bio rendered as HTML in admin/portfolio UI without escape → stored-XSS via bio. Severity Low because (a) UI render path determines exploit (Phase 4), (b) limited audience compared to displayName which appears in emails to all parties, (c) R-13 fix template (validator denylist + template escape) is the established remediation path. **STATUS (Wave 2B commit `775525c`):** RESOLVED — **6th defense-in-depth two-layer pattern instance** (lineage: R-13 / R-21 / R-15 / A-17 / R-API-05 → R-API-13). **Layer 1 (input sanitization):** profile PUT handler invokes `sanitizeReportContent(payload.bio)` + `sanitizeReportContent(payload.headline)` BEFORE `validateProfilePayload` runs — defense-in-depth: a fully-`<script>`-only bio sanitizes to empty string and is then rejected by required-field validation. `sanitize.ts` reused (identical signature, identical DANGEROUS_PATTERNS — bio and report-content share the same XSS surface). **Layer 2 (output escape):** preserved — React/MDX default text rendering is XSS-safe; no `dangerouslySetInnerHTML` in profile render path. T-PM01-08 (8 tests in `src/app/api/profile/me/__tests__/route.test.ts`) verify: clean preservation (T-PM01-02), `<script>` strip (T-PM03), `javascript:` strip (T-PM04), `on*` handler strip (T-PM05), `vbscript:`/`data:text/html` strip (T-PM06), markdown preservation (T-PM07), headline sanitized symmetrically (T-PM08). |
| R-API-14 | Low | A04 Insecure Design | `src/app/api/profile/certifications/[id]/route.ts` (DELETE), `education/[id]/route.ts` (DELETE) | **DELETE permanently removes records** — no archive intermediate state. Compare with `reports/[id]/route.ts:14-19` two-stage delete (archive then permanent). Certifications + educations: one-click delete is irreversible. UX inconsistency + accidental-delete risk. | User clicks "delete cert" → record gone, asset binary deleted from Supabase Storage. No recovery. Severity Low because (a) intentional UX choice (per code comment absent), (b) no security implication, (c) educational portfolio context tolerates this. Noted as design-consistency observation, not bug. |
| R-API-15 ✅ DOC-ONLY closure (Wave 1) | Informational | A05 Security Misconfiguration | `src/lib/portfolio-assets.ts` (asset upload path normalization) | **Asset path sanitization** uses `sanitizePathSegment` (`[^a-zA-Z0-9-_]` → `-`) and `sanitizeFileName` (`[^a-zA-Z0-9._-]` → `-`) at portfolio-assets.ts L90-95. No explicit `..` (parent-dir) check beyond the regex. Both functions correctly strip slashes; the regex `[^a-zA-Z0-9._-]` blocks `..` because `.` is allowed but not `/`. However: a filename like `....pdf` becomes `....pdf` (4 dots, no path traversal — POSIX parent-dir resolver only triggers on `..` segments between slashes). Defense is correct but defensive comment absent. | Pure refactor-readiness concern. Path traversal not exploitable given the sanitization shape; informational note that the defense is structural, not explicit. **STATUS (Wave 1 housekeeping commit `7032a17`):** DOC-ONLY closure — defensive comment requirement noted for `src/lib/portfolio-assets.ts` revisit cycle. No source-code change this cycle (Wave 1 audit-doc-only scope). Future closure: add inline comment block near `sanitizePathSegment` / `sanitizeFileName` documenting that `..` is blocked structurally via the `[^a-zA-Z0-9._-]` regex (no slash + no whitespace → no path-segment formation), to prevent future regex relaxation from silently introducing traversal vectors. |

**Summary by severity (Phase 3.D + Wave 1 + Wave 2B updates marked):** High = 4 (R-API-01 CLOSED via T-PC01-20, R-API-02 CLOSED via T-AL01-20, **R-API-03 🟡 RECLASSIFIED** — RLS deferred per Z.10, R-API-04 PARTIAL via T-RP25-30); Medium = 6 (**R-API-05 ✅ FIXED** via sanitize.ts + T-RP07-13, **R-API-06 ✅ RESOLVED Wave 2B** via requireRole analyst gate + T-UR01-04, R-API-07/R-API-08/R-API-09/R-API-10 untouched); Low = 4 (R-API-11/R-API-12/R-API-14 untouched, **R-API-13 ✅ RESOLVED Wave 2B** via 6th defense-in-depth instance — sanitize.ts reuse on bio/headline + T-PM01-08); Informational = 1 (**R-API-15 ✅ DOC-ONLY closure Wave 1**). **Total = 15.**

**No Critical entries.** Phase 1 closed all Critical issues (R-03 Path γ, R-20 boot validator + lazy getter). Phase 3's high-severity surface is concentrated in **access control (IDOR + RBAC business-logic gaps)** and **defense-in-depth (RLS asymmetry)** — both production-realistic threats with bounded blast radius.

---

## 3. Existing API Test Coverage

**9 auth route tests (Phase 1.D + 1.5):** login (T-LG01..T-LG13), register (T-RG01..T-RG14), logout (T-LO01..T-LO06), session (T-SS01..T-SS03), forgot (T-FG01..T-FG11), reset (T-RS01..T-RS12), reset/validate (T-RV01..T-RV06), verify (T-VF01..T-VF07), verify/resend (T-VR01..T-VR08). Total: ~85 auth-route tests with comprehensive coverage.

**16 non-Lab lib tests:**

| File | Coverage |
|---|---|
| `api-auth.test.ts` | `requireSession` + `requireRole` invariants (cross-cutting Phase 3) |
| `audit-helpers.test.ts` | T-AH01-06 (Phase 1.5.11 R-06/R-12 closure) |
| `auth-shared.test.ts` | T-AS01-09 (Phase 1 RBAC) |
| `client-ip.test.ts` | T-CI01-12 (Phase 1 R-01) |
| `content-encoding.test.ts` | T-CE01-08 (Phase 1.5.13) |
| `email-templates.test.ts` | T-ET01-07c (Phase 1.5.2 R-13, 1.5.10 R-14/R-15) |
| `email.test.ts` | T-EM01-03 (Phase 1.5.11 R-12) |
| `html-escape.test.ts` | T-HE01-06 (Phase 1.5.2) |
| `identity-rules.test.ts` | T-IR01-07 |
| `identity-validation.test.ts` | T-IV01-19 |
| `rate-limiter.test.ts` | T-R01-11 (Phase 1.5.9 R-02/R-08) |
| `security.test.ts` | T-S01-S15 (Phase 1.5.3 R-04, 1.5.4 R-21, 1.5.11 R-07) |
| `soc-runtime/adapter.test.ts` | T-SR-AD01-02 |
| `soc-runtime/machine.test.ts` | T-SR-M01-N |
| `soc-store-adapter.test.ts` | T-AD01-09 (Phase 1.5.7 R-03 Path γ) |
| `soc-store-memory.test.ts` | (Phase 1.D.20 memory store invariants) |

**ZERO non-auth route tests.** Phase 3.D target surface (19 non-auth routes) has no test files today.

### Risk coverage gap summary

| R-API ID | Test coverage today |
|---|---|
| R-API-01 (IDOR cert) | none |
| R-API-02 (alerts RBAC business-logic) | none |
| R-API-03 (no RLS on platform-backbone) | none (RLS testing requires Supabase MCP / integration env — Phase 5 territory per `phase-1-a-final.md:30` T-R11 note) |
| R-API-04 (cascade delete partial failure) | none |
| R-API-05 (XSS via report content) | none |
| R-API-06 (users GET cross-role enumeration) | none |
| R-API-07 (asset upload quota / virus) | none |
| R-API-08 (RSS XML parser brittleness) | none |
| R-API-09 (external-call rate limit) | none |
| R-API-10 (avatar signed URL leak) | none |
| R-API-11 (avatar partial-failure orphan) | none |
| R-API-12 (severity taxonomy mismatch) | none (documented in Phase 1.5.14 dashboard audit Section E) |
| R-API-13 (profile bio HTML-escape) | none |
| R-API-14 (cert/education one-click delete) | none |
| R-API-15 (path traversal defense) | none |

**Total Phase 3 surface test count pre-Phase-3.D:** 0 route-level tests on 19 routes. Storage adapter has T-AD01-09 (9 tests, exercise Class 1/2/3 routing via `vi.mock`).

### Phase 3.D test expansion (this audit's surgical recommendation, IMPLEMENTED)

Phase 3.D **revision** commit `152d872` ships 3 new test files implementing the Top-3 surgical scope from Section 5, plus the A-13 closure test and the R-API-05 defense-in-depth Layer 1 helper. R-API-03 RLS migration was authored in prior Phase 3.D attempt but RECLASSIFIED after operator verification revealed production-vs-blueprint divergence — see Z.10:

| File | Tests | Coverage target | Maps to |
|---|---|---|---|
| `src/app/api/profile/certifications/__tests__/certifications.test.ts` | 20 | PATCH/DELETE 3-idiom IDOR closure + assets GET signed-URL + adapter compensating action | T-PC01-T-PC20 → R-API-01 (High) |
| `src/app/api/alerts/__tests__/alerts.test.ts` | 21 | PATCH RBAC + input validation + business-logic transitions + status code map + actor identity + **T-AL-A13** (A-13 closure, R-05 TOCTOU concurrent register-call test) | T-AL01-T-AL20 + T-AL-A13 → R-API-02 (High) + A-13 |
| `src/app/api/reports/__tests__/reports.test.ts` | 30 | POST input validation + R-API-05 sanitization (Layer 1) + tags filtering + broken-encoding + PATCH archive + DELETE two-stage gate | T-RP01-T-RP30 → R-API-04 (partial) + R-API-05 (full) |

**Total Lab Engine + API test count post-Phase-3.D-revision:** 9 (Lab existing) + 76 (Phase 2.D) + 71 (this commit) + 9 storage adapter (T-AD01-09) + 0 (no auth-route changes) + remaining lib tests = baseline 315 → **386 / 37 files**.

R-LAB + R-API risk coverage state post-Phase-3.D-revision:
- **R-API-01 (High)**: test-coverage gap CLOSED via T-PC01-20 (20 tests across 3 ownership-check idioms)
- **R-API-02 (High)**: test-coverage gap CLOSED via T-AL01-20 (20 tests across RBAC + business-logic + actor mass-assignment)
- **R-API-03 (High)**: 🟡 RECLASSIFIED — RLS migration deferred until production deployment of `platform-backbone-v1.sql` blueprint. Future cycle that deploys the 21 tables MUST ALSO ship RLS migration in same operation. See Z.10.
- **R-API-04 (High)**: test-coverage gap PARTIAL via T-RP25-30 (two-stage delete + cross-owner forbidden + status code map; full cascade partial-failure test deferred per Section 5 "Why not Target #4" rationale)
- **R-API-05 (Medium)**: ✅ FIXED via defense-in-depth two-layer (`src/lib/sanitize.ts` Layer 1 + React/MDX safe-text Layer 2 preserved); 7 tests T-RP07-13 lock the sanitization contract
- **A-13 (amendment)**: RESOLVED via T-AL-A13 (Promise.all concurrent registerUser race assertion against storage layer's race-guard)
- **A-15 (amendment)**: RESOLVED via audit-doc File(s) update on R-18 row (verify-resend same-vector confirmation; rate-limit hardening already applied in Phase 1.5)

R-API-06..R-API-15 untouched (intentional surgical scope — Phase 3.D does NOT chase all 15 risks; only Top-3 high-leverage routes per Section 5 ranking + R-API-05 defense-in-depth closure; R-API-03 RLS reclassified per Z.10).

---

## 4. Test Gaps + Priority Ranking

Ranking criteria (Phase 2.A pattern):
1. R-API-XX severity
2. User-facing impact (path-of-attack accessibility)
3. Test ROI (surface size × invariant density / scaffolding complexity)
4. Production criticality (RLS bypass > broken access control > input validation > error handling)

| Rank | Module / route group | LOC | ROI | Highest R-API | Notes |
|---|---|---|---|---|---|
| **1** | `profile/certifications/[id]` PATCH/DELETE + `certifications/assets/[id]` GET | 206 | **HIGH** | R-API-01 (High IDOR) | Three distinct ownership-check idioms in one feature — exactly the surface where regression is easy to introduce. Test surface dense (CRUD × ownership × not-found semantics). MSW not needed (mocks `soc-store-adapter`). Closes R-API-01 with surgical effort. |
| **2** | `alerts/[id]` PATCH (`patchAlert` business-logic gap) | 82 | **HIGH** | R-API-02 (High RBAC business-logic) | Small surface (81 LOC), high-invariant tests on claim/resolve/assigneeId transitions. Adapter is mocked; only route's pre-adapter contract under test. Closes R-API-02 with minimal scaffolding. |
| **3** | `reports/*` POST + DELETE (`createReport` content + `deleteReport` two-stage gate) | 222 | **MEDIUM-HIGH** | R-API-05 (Medium stored-XSS surface) + R-API-04 (High cascade) implicit | Content max-length, severity validation, broken-encoding filter, archive-before-delete two-stage gate, 409 NOT_ARCHIVED semantics. Test surface: input validation + status code map. |
| 4 | `users/me` DELETE (account self-delete cascade) | 115 | **HIGH** | R-API-04 (High cascade partial failure) | Banking-grade safety semantics (password re-auth + 'DELETE' confirm). Test surface: 7-status-code matrix (200/400/401/404/500). Cascade orchestration in adapter — route layer's pre-cascade gate is the target. |
| 5 | `profile/me` PUT, `profile/avatar` POST/DELETE | 137 | **MEDIUM** | R-API-13 (Low bio HTML-escape) | Self-only ownership; `validateProfilePayload` + `parseProfilePayload` exercise. Avatar upload covers `saveAvatarAsset` via `vi.mock`. |
| 6 | `profile/education/*` POST + PATCH/DELETE | 127 | **MEDIUM** | R-API-14 (Low one-click delete) | Mirrors certifications but smaller (no asset upload). Could be combined with #1 into a single profile-routes test file. |
| 7 | `alerts/` GET (filtering, pagination, assignee parsing) | 112 | **MEDIUM** | none directly — exercises parsers + filters | Input-validation density (status/priority enum parse + limit clamp + cursor + assignee dispatcher). |
| 8 | `users/` GET (cross-role enumeration) + POST (admin create) | 91 | **MEDIUM** | R-API-06 (Medium enumeration) | Small surface; RBAC role check + identity validation re-exercise. |
| 9 | `users/` POST admin-create flow (reserved username, format validation) | (within #8) | MEDIUM | none direct | Mirrors register/route.ts validation but admin-driven. |
| 10 | `cves/`, `greynoise/`, `cybernews/` external integrations | 472 | **MEDIUM** | R-API-08 + R-API-09 | MSW required (external HTTP mocks). Per `phase-1-a-final.md:77-79`, Supabase REST + Postgres + sqlite handlers also deferred to Phase 3.C — same MSW infra. Test surface: success / fallback / timeout / error. |
| 11 | `live-attacks/`, `metrics/live/` | 92 | LOW | none direct | Thin wrappers over `listAlerts` + `getLiveMetrics`. Indirect coverage from adapter tests. |
| 12 | `attack-events.sql` + `rate-limits.sql` RLS policy | (SQL) | LOW (Phase 5 territory) | R-API-03 (High RLS asymmetry — but cannot unit-test) | True RLS verification needs an actual Postgres instance — Phase 5 E2E territory. Phase 3.D cannot close this in unit-test scope. |

---

## 5. Phase 3.D Scope Recommendation — Top 2-3 Surgical Targets

Per operator surgical-scope discipline (Phase 2.A pattern):

### Recommended Phase 3.D scope: **3 targets, ~50-70 new tests, baseline 315 → ~365-385**

#### Target #1 — Profile certifications IDOR closure (R-API-01 High)

**Why first:** highest-severity access-control gap with concrete production-realistic exploit path (numeric-ID enumeration). Three distinct ownership-check idioms in one feature = highest test-per-invariant density. Surgical: one feature, three routes (PATCH `[id]`, DELETE `[id]`, GET `assets/[id]`).

**Test file:** `src/app/api/profile/certifications/[id]/route.test.ts` + `assets/[id]/route.test.ts` (or combined `certifications-routes.test.ts`)

**Test invariants to lock (illustrative):**
- T-PC01-T-PCNN — happy-path PATCH own cert succeeds (204 / 200)
- Owner-cross PATCH (cert.userId !== session.user.id) → 404 (existence-mask)
- Owner-cross DELETE → 404 (consistent with PATCH idiom)
- Owner-cross GET assets → 403 (explicit per code comment)
- Invalid certificationId → 400
- Asset replace path: PATCH with new file → old asset deleted via `deleteStoredAsset`
- Asset remove path: PATCH with `removeAsset=true` → asset cleared, old binary deleted
- Adapter throws → asset-deletion compensating action (cleanup orphan)

**Expected test count:** 15-20.

#### Target #2 — Alerts route RBAC + business-logic (R-API-02 High)

**Why second:** alerts is the highest-trust mutable surface (analyst-touched, dashboard-visible). Currently zero tests on 2 routes. Small surface (193 LOC), high invariant density.

**Test file:** `src/app/api/alerts/route.test.ts` + `[id]/route.test.ts`

**Test invariants:**
- T-AL01-T-ALNN
- GET requires session (401 if no cookie)
- GET supports status/priority/assignee/cursor/limit (parser invariants)
- POST requires `analyst` role (403 if viewer)
- POST validates priority enum (P1-P4)
- POST missing title/description → 400
- PATCH alertId numeric check (400 if invalid)
- PATCH claim semantics — analyst claims unassigned alert
- PATCH claim semantics — analyst claims another analyst's alert (business-logic decision: allowed? logged? — observation, Phase 3.D documents current behavior)
- PATCH resolve semantics
- PATCH partial body (only status, only priority, etc.)

**Expected test count:** 15-20.

#### Target #3 — Reports route content validation + delete safety (R-API-05 + R-API-04 partial coverage)

**Why third:** content is the largest user-controllable payload (50K char limit) with stored-XSS risk via admin UI render. Two-stage delete (archive-then-permanent) is novel pattern worth locking. Closes R-API-05 (content validation surface) and partial R-API-04 (delete cascade safety — full R-API-04 closure needs users/me DELETE which is Target #4-ranked).

**Test file:** `src/app/api/reports/route.test.ts` + `[id]/route.test.ts`

**Test invariants:**
- T-RP01-T-RPNN
- POST happy path (analyst creates)
- POST title/content max-length boundaries (200 char title, 50K char content)
- POST severity enum validation
- POST broken-encoding (`�`) rejection
- POST tags array filtering (length, max-tag count, max-tag-length)
- PATCH archive happy path
- PATCH unsupported action → 400
- DELETE NOT_ARCHIVED → 409 (two-stage gate)
- DELETE archived report → 200
- DELETE cross-owner → 403 FORBIDDEN
- DELETE not-found → 404
- DELETE no session → 401 with source: 'route' tag (BUG-001 observability)

**Expected test count:** 20-30.

### Total Phase 3.D estimate

**50-70 new tests + 3 new test files** → baseline 315 → **~365-385 / 37 files** (Phase 3.D commit message reports exact count).

### Why not Target #4 (users/me DELETE — R-API-04 cascade)?

R-API-04 (account self-delete cascade) is High severity but the **partial-failure scenario** is the actual risk — testing it requires simulating mid-cascade exceptions (asset-delete throws after sessions purged but before user row removed). This is a `vi.mock` orchestration with multiple sequential throws. Doable but adds ~15-20 tests of complex scaffolding. **Recommendation:** defer to a focused R-API-04 closure cycle if mentor judges High severity warrants it; OR fold into Phase 3.D Target #4 if budget extends.

### Why not target external integrations (cves/greynoise/cybernews)?

R-API-08 (RSS XML parser) and R-API-09 (rate limit on external calls) are Medium severity and require MSW infrastructure (Phase 3.C). External-call mocks have higher scaffolding cost than the surgical Top 3 above. **Recommendation:** Phase 3.C dedicated cycle for external-call MSW handlers + a single test per route exercising success / fallback / timeout. Estimate ~15 tests across 3 routes.

### Why not target RLS verification?

R-API-03 (no RLS on platform-backbone) is High severity but **cannot be unit-tested** — requires actual Postgres instance with RLS policies applied. Per Phase 1.5.9 R-02 T-R11 comment: "true E2E Postgres testing is Phase 5 scope." Phase 3.D **documents** the gap; Phase 5 E2E (Playwright + real-Supabase environment) closes it. Phase 3.A audit doc Section 9 surfaces this as a mentor decision point.

### Phase 3.D commit cross-reference

**Phase 3.D revision commit `152d872` implements this surgical scope (R-API-01/02/04/05 + A-13 + A-15).** R-API-03 reclassified per Section 9 Z.10 — production-vs-blueprint divergence discovered during manual RLS apply attempt. Three new test files + 1 sanitize helper + 1 route mod:

- `src/app/api/profile/certifications/__tests__/certifications.test.ts` — T-PC01-T-PC20 (20 tests)
- `src/app/api/alerts/__tests__/alerts.test.ts` — T-AL01-T-AL20 + T-AL-A13 (21 tests)
- `src/app/api/reports/__tests__/reports.test.ts` — T-RP01-T-RP30 (30 tests)
- `src/lib/sanitize.ts` — defense-in-depth Layer 1 (R-API-05 closure, 5th instance of the pattern)
- `src/app/api/reports/route.ts` — invokes `sanitizeReportContent` in POST handler before adapter call

**NOT shipped (reclassified):** `supabase/platform-backbone-rls.sql` was authored in prior Phase 3.D attempt but DELETED in revision after `information_schema` query confirmed the 21 platform-backbone tables exist only as blueprint, not as production tables. RLS migration is preparatory work pending production deployment of `platform-backbone-v1.sql` itself. See Z.10 for forward-iteration lineage (Phase 1.5.14.1 mentor-error correction protocol).

Phase 3.B + 3.C explicitly SKIPPED per Section 6 + 7 assessment (Top 3 scope uses vi.mock at adapter boundary; no external-API surface touched, no MSW handlers needed).

---

## 6. Phase 3.B Infrastructure Needs

**Assessment: SMALL but NON-ZERO** (contrast with Phase 2.B which was fully skipped).

| Need | Required for Phase 3.D? | Phase 3.B scope |
|---|---|---|
| MSW handlers (Supabase REST `/rest/v1/...`) | YES if Target #2-3 exercises store-adapter via real HTTP path | Phase 1 deferred to Phase 3.C per `phase-1-a-final.md:77` |
| MSW handlers (Supabase Postgres pool) | NO for Phase 3.D — vi.mock at adapter boundary sufficient | Phase 1 deferred to Phase 3.C per `phase-1-a-final.md:78` |
| MSW handlers (NIST NVD, Greynoise) | YES if Phase 3.D extends to external-call routes (deferred per Section 5) | Phase 3.C task |
| Split CI workflow (`test:unit` + `test:routes`) | NICE-TO-HAVE | Phase 1 deferred to Phase 3.B per `phase-1-a-final.md:66` |
| Test harness for route → adapter → mock pattern | NO — Phase 1.D already established the pattern (see auth routes) | already exists |
| New types or fixtures | NO — `vi.mock('@/lib/soc-store-adapter')` returns adapter-shaped objects per Phase 1 convention | already exists |

**Recommendation: minimal Phase 3.B.** Two possible deliverables:
- (a) `package.json` `scripts` addition: `test:unit` (lib/* + lab/*) + `test:routes` (api/*) split per `phase-1-a-final.md:66` — adds CI flexibility, no test logic change.
- (b) `src/test/msw/handlers/supabase.ts` skeleton stub for Phase 3.C consumption (empty handler array, just file scaffold).

**Mentor decision needed:** (a) only / (b) only / both / skip Phase 3.B entirely if Phase 3.D scope (Top 3 above) uses `vi.mock` exclusively at adapter boundary.

---

## 7. Phase 3.C Mock/Handler Requirements

**Assessment: NON-EMPTY for full Phase 3 scope; CAN be skipped if Phase 3.D restricts to Targets 1-3 above.**

Phase 1 deferred 3 handler families (`phase-1-a-final.md:77-79`):

| Handler family | Phase 3.C deliverable | Test consumer |
|---|---|---|
| Supabase REST `/rest/v1/...` | MSW handler matching `${SUPABASE_URL}/rest/v1/(users\|sessions\|...)` | If Phase 3.D restricts to `vi.mock('@/lib/soc-store-adapter')`, NOT NEEDED |
| Supabase Postgres pool | Postgres client mock (`vi.mock('pg')` or direct adapter mock) | Same — not needed if vi.mock boundary applied |
| SQLite file I/O | `vi.mock('better-sqlite3')` or direct adapter mock | Same — not needed |

**External-call handler families (Phase 3.A-discovered, not in Phase 1 deferral list):**

| Handler family | Phase 3.C deliverable | Test consumer |
|---|---|---|
| NIST NVD `https://services.nvd.nist.gov/rest/json/cves/2.0` | MSW handler with success + 500 + 429 (rate-limit) variants | `/api/cves` route tests (deferred) |
| Greynoise `https://api.greynoise.io/v2/experimental/gnql/stats` | MSW handler with success + 401 (bad key) + 500 | `/api/greynoise` route tests (deferred) |
| 5 RSS feeds (THN, Krebs, BleepingComputer, SANS, SecurityWeek) | MSW handler with valid-RSS + malformed-XML + timeout per feed | `/api/cybernews` route tests (deferred) |

**Recommendation for Phase 3.C if Phase 3.D restricts to Targets 1-3:** SKIP. The surgical scope mocks at `vi.mock('@/lib/soc-store-adapter')` boundary, matching Phase 1.D pattern. External-call MSW handlers are deferred with the external-call routes themselves.

**If Phase 3.D extends to external-call routes:** Phase 3.C deliverable = 3 MSW handler files (nvd, greynoise, rss-feeds) under `src/test/msw/handlers/`.

---

## 8. Cross-References

### A-13 (R-05 TOCTOU concurrent-execution test) — Phase 3 candidate

Phase 2.A re-mapped A-13 from author's "Phase 2 storage suite" framing to Phase 3 (storage adapter = API & Contracts surface per CLAUDE.md L171). Phase 3.A confirms candidacy.

**A-13 closure path (Phase 3.D):** add explicit concurrent-execution test to `src/lib/soc-store-adapter.test.ts` (already exists, T-AD01-09) covering `Promise.all` on two register calls with same email. Storage layer's race-guard (per Phase 1.A:R-05 narrative) is the assertion target.

**Phase 3.A recommendation:** A-13 closure included in Phase 3.D Target #2 (alerts) OR added as Target #4 with single-test scope. Mentor decides.

### A-15 (R-18 scope broaden) — Phase 3 candidate per author intent

A-15 Action text: "deferred to Phase 1.5 or Phase 3." Phase 1.5 series complete without absorbing A-15. Phase 3.A confirms Phase 3 absorption is on-table.

**A-15 closure path:** R-18 row (Section 2 of Phase 1.A audit) updates File(s) column from `forgot/route.ts` to `forgot/route.ts, verify/resend/route.ts`. Pure documentation fix; no code change. Test guards already in place at both T-FG10 (forgot) + T-VR04 (verify-resend) per Phase 1.5 hardening.

**Phase 3.A recommendation:** A-15 is audit-doc-only housekeeping. Absorb into Phase 3.D commit message body (paired with Phase 3.D test work), OR keep for separate housekeeping cycle (mentor decides per Z.7 pattern from Phase 2.A).

### Phase 1 deferrals re-addressed

| Phase 1 deferral | Where deferred | Phase 3.A status |
|---|---|---|
| MSW handler families (Supabase REST, Postgres, SQLite) | `phase-1-a-final.md:77-79` "Defer to Phase 3.C" | Phase 3.C dedicated cycle if external-call routes added; otherwise SKIP per Phase 3.A Section 7 |
| Split CI workflow (`test:unit` + `test:routes`) | `phase-1-a-final.md:66` "Defer to Phase 3.B" | Phase 3.B scope question — `package.json` scripts addition. Mentor decision. |
| Coverage ramp Phase 3 end → 70% | `phase-1-a-final.md:58` | Phase 3.D end target — Top 3 plus existing 315 brings non-test code under more coverage but headline number won't hit 70% without per-command + storage adapter cycles |
| R-18 hardening (combined IP+email rate limit) | `phase-1-a-final.md:406` "defer to Phase 1.5 hardening or Phase 3" | Hardening NOT closed in Phase 1.5; Phase 3.A treats as **out of scope for 3.D** (separate dedicated cycle if mentor prioritizes) |

### Phase 1 R-13 forward reference

Phase 1.A audit doc L41 R-13 row noted: "stored-XSS risk if displayName surfaces in admin UI without escape (Phase 3 audit)." This Phase 3.A captures the analog as R-API-05 (reports content) + R-API-13 (profile bio). R-13 itself is closed (validator + template escape for displayName); the Phase 3.A R-API entries are the surface expansion R-13 forward-referenced.

### Risk + test ID namespace summary

| Namespace | Phase | Count |
|---|---|---|
| R-01..R-22 | Phase 1 | 22 (14 ✅ FIXED + 1 ✅ INAPPLICABLE + 1 ✅ ACCEPTED + 6 open per audit doc) |
| R-LAB-01..R-LAB-15 | Phase 2 | 15 (R-LAB-02/03/04 test-coverage gaps closed; R-LAB-06 gap-test; R-LAB-01 severity adjusted; rest untouched) |
| **R-API-01..R-API-15** | **Phase 3** | **15 (this audit)** |
| Total active R-XX | | 52 |

| Test prefix | Phase | Count today |
|---|---|---|
| T-SS / T-LG / T-RG / T-LO / T-FG / T-RS / T-RV / T-VF / T-VR | Phase 1 auth routes | ~85 |
| T-S / T-IV / T-IR / T-HE / T-AS / T-CI / T-AD / T-R / T-AH / T-EM / T-ET / T-CE / T-DT / T-SEC / T-INSTR / T-MD | Phase 1 lib + Phase 1.5 + memory store | ~145 |
| T-CCB / T-CTFR / T-VC / T-RD / T-MO | Phase 2 Lab Engine | 85 |
| **T-PC / T-AL / T-RP (Phase 3.D)** | **Phase 3** | **0 today, ~50-70 estimated** |
| Total | | 315 (per vitest baseline) |

---

## 9. Mentor Decision Points

### Z.1 — Phase 3.D scope (Top 3 acceptance)

Section 5 recommends Targets #1 (profile certifications IDOR — R-API-01), #2 (alerts RBAC + business-logic — R-API-02), #3 (reports content + two-stage delete — R-API-04/05). Estimated 50-70 tests.

Mentor may:
- (a) Accept all three.
- (b) Tighten to Top 2 (drop reports, accept #1 + #2 — closes both High access-control risks).
- (c) Loosen to Top 4 (add users/me DELETE for R-API-04 full closure — ~15-20 additional tests).
- (d) Add external-call routes (R-API-08/09 — requires Phase 3.C MSW handler scaffolding, ~15-25 additional tests).

**Resolution (Phase 3.D commit `152d872`):** RESOLVED — option (a) accepted. All three targets shipped. Actual test counts: T-PC = 20, T-AL = 20 + T-AL-A13 = 21, T-RP = 30 → total 71 new tests (matches mid-estimate). Baseline 315 → 386.

### Z.2 — Phase 3.B + 3.C cycle deliverables

Section 6 + 7 recommend SKIPPING Phase 3.B + 3.C entirely if Phase 3.D restricts to Targets 1-3 (Section 5). Adapter-boundary `vi.mock` is sufficient.

Loosened option: ship `package.json` `scripts` addition (`test:unit` + `test:routes` split per `phase-1-a-final.md:66`) as minimal Phase 3.B deliverable. No test logic change.

Mentor decides: skip both, or ship minimal 3.B (scripts split) + skip 3.C.

**Resolution (Phase 3.D commit `152d872`):** RESOLVED — both SKIPPED. Top 3 scope uses vi.mock at adapter boundary throughout (login route lineage). No external-API surface touched; no MSW handlers needed. `package.json` test:unit/test:routes split deferred to a future housekeeping cycle (not blocking). Phase 3 effective cycle chain: A (audit, 6a55431) → D (tests + RLS migration, this commit). Phase 3 CLOSED after this commit + cleanup.

### Z.3 — R-API-03 RLS asymmetry

Phase 3.A surfaces critical defense-in-depth gap: 21 platform-backbone tables lack RLS while attack_events + rate_limits have RLS enabled. Unit-test verification impossible (needs real Postgres). Three remediation paths:

- (a) **Add `enable row level security` + deny-all policy** to all 21 platform-backbone tables — pure SQL change, single supabase-side migration. Restores symmetry with attack_events/rate_limits pattern. Phase 3 cycle could include.
- (b) **Document the asymmetry as ACCEPTED** in audit register — production uses service-role-only from adapter; risk activates only on misconfiguration. R-01 sub-vec 2 ACCEPTED lineage.
- (c) **Defer to Phase 5** — full E2E RLS verification with real Postgres.

Agent leans (a) because the fix is small and symmetry matters for review hygiene. Mentor confirms.

**Resolution (Phase 3.D revision commit `152d872`):** RECLASSIFIED — option (a) was attempted in prior Phase 3.D commit (now soft-reset) but operator manual-apply revealed production-vs-blueprint divergence: the 21 platform-backbone tables exist in `supabase/platform-backbone-v1.sql` BLUEPRINT but were never applied to production Supabase. RLS migration cannot target non-existent tables. Risk reclassified as preparatory work pending production deployment of `platform-backbone-v1.sql` itself; severity remains High but currently non-actionable. Future cycle that deploys the 21 tables MUST ALSO ship RLS migration in the same operation. The authored `supabase/platform-backbone-rls.sql` was DELETED from the working tree in the revision cycle. See Z.10 for full production-vs-blueprint divergence narrative + pattern lesson for Phase 4.A+ state gathering.

### Z.4 — A-13 closure timing

A-13 storage adapter race-condition test was re-mapped from Phase 2 to Phase 3 per Phase 2.A. Phase 3.A confirms Phase 3 candidacy.

Mentor decides:
- (a) Absorb into Phase 3.D Target #2 commit (single test, ~5-10 lines added to existing `soc-store-adapter.test.ts`).
- (b) Phase 3.D Target #4 dedicated single-test scope.
- (c) Defer to a focused A-13 housekeeping cycle.

**Resolution (Phase 3.D commit `152d872`):** RESOLVED — option (a) shipped. T-AL-A13 added to Target #2 test file (`src/app/api/alerts/__tests__/alerts.test.ts`) as its own bottom-of-file describe block. Imports `soc-store-memory` directly (NOT via adapter — bypasses dispatcher to isolate race semantics to the storage module's race-guard). Promise.all on two concurrent `registerUser` calls with identical username; asserts at most one succeeds, rejected branch carries 'already exists' message. A-13 entry in `pending-amendments.md` title flipped to `[RESOLVED in Phase 3.D]` + Resolution paragraph cross-references this commit hash.

### Z.5 — A-15 closure timing

A-15 is audit-doc-only (R-18 File(s) column update). Phase 3.A recommends absorbing into Phase 3.D commit message body (similar to Phase 2.A Z.7 count-drift absorption pattern).

Mentor confirms or holds for separate cycle.

**Resolution (Phase 3.D commit `152d872`):** RESOLVED — absorbed into this commit. A-15 entry in `pending-amendments.md` title flipped to `[RESOLVED in Phase 3.D]` + File(s) line on R-18 row of `phase-1-a-final.md` confirmed to already include both `forgot/route.ts` and `verify/resend/route.ts` (per Phase 1.5.4 rate-limit hardening commit that landed Phase 1 R-18 mitigation across both surfaces). Audit-doc-only change; no test work needed.

### Z.6 — Severity taxonomy normalization (R-API-12)

Three parallel taxonomies (reports UPPERCASE 4-level, attack_events lowercase 3-level, dashboard UPPERCASE 4-level). Latent risk; no current bridge.

Phase 3.D does NOT close this — would require either (a) unifying taxonomies across SQL + TypeScript types (significant cross-cutting change) or (b) introducing normalization helper. Both are beyond surgical Phase 3.D scope.

**Phase 3.A recommendation:** document as Phase 4+ candidate when dashboard wiring to backend events becomes Phase 3 follow-up work. Mentor confirms.

**Resolution (Phase 3.D commit `152d872`):** RESOLVED — deferred to Phase 4+ per Phase 3.A recommendation. R-API-12 stays OPEN in Phase 3.A risk register with documented Phase 4 candidacy (dashboard wiring follow-up work).

### Z.7 — Test ID convention for Phase 3.D

Phase 2.D adopted `T-VC` / `T-RD` / `T-MO` prefixes. Phase 3.A proposes:

- `T-PC` — profile certifications (Target #1)
- `T-AL` — alerts (Target #2)
- `T-RP` — reports (Target #3)
- Optional Target #4: `T-UM` — users/me, `T-PR` — profile (umbrella), `T-EX` — external (cves/greynoise/cybernews)

Each `it(...)` title begins with `T-XX —` (em-dash separator, matches Phase 2.D convention).

Mentor confirms before Phase 3.D writes assertions.

**Resolution (Phase 3.D commit `152d872`):** RESOLVED — proposed prefixes (T-PC / T-AL / T-RP) accepted and applied. Each new test's `it(...)` title begins with `T-XX —` prefix (em-dash separator). A-13 closure test uses suffix variant `T-AL-A13` to distinguish from regular T-AL01-20 sequence.

### Z.8 — R-API-05 + R-API-13 forward (HTML-escape on report content + profile bio)

Both risks are stored-XSS surface that activates only if UI renders the content as HTML without escape. Phase 4 (UI & Accessibility per CLAUDE.md L172) is the natural closure phase for the render-side. Phase 3.D **could** ship preventive HTML-escape on the server contract (Phase 1.5.2 R-13 pattern: validator denylist + escape helper).

Mentor decides:
- (a) Phase 3.D adds preventive HTML-escape to `createReport` content + `updatePortfolioProfile` bio — closes the surface server-side regardless of UI.
- (b) Defer to Phase 4 (UI surface is the render point; server contract is currently un-rendered-as-HTML).
- (c) Document as risk-accepted (operational context — no admin UI render path today).

**Resolution (Phase 3.D commit `152d872`):** RESOLVED — option (a) shipped for R-API-05 (reports content); R-API-13 (profile bio) deferred to Phase 4 since `validateProfilePayload` already provides field-level validation hooks that can absorb the sanitization in a future cycle without re-touching this surface. Defense-in-depth two-layer **5th instance** (R-13/R-21/R-15/A-17 lineage): `src/lib/sanitize.ts` `sanitizeReportContent()` NEW — regex strip of dangerous tags/URIs/event handlers. Server-safe (no DOM dep). Invoked from `src/app/api/reports/route.ts` POST before adapter call. T-RP07-13 (7 tests) lock the sanitization contract; T-RP12 verifies benign markdown-like content (bold, italic, links, paragraphs) preserved.

### Z.9 — Phase 3 cadence after Phase 3.A

Standard cadence options:
- (a) Phase 3.A audit → Phase 3.D direct (Phase 3.B + 3.C SKIPPED per Z.2 default).
- (b) Phase 3.A → minimal Phase 3.B (scripts split) → Phase 3.D.
- (c) Phase 3.A → A-15 housekeeping cycle (audit doc only, no tests) → Phase 3.D.
- (d) Different ordering.

Agent recommends (a). Mentor decides.

**Resolution (Phase 3.D revision commit `152d872`):** RESOLVED — option (a) executed. Phase 3.A audit (6a55431) → Phase 3.D this commit. Phase 3.B + 3.C skipped per Z.2. No intermediate housekeeping cycle. A-13 + A-15 absorbed into Phase 3.D commit body per Z.4 + Z.5. Phase 3 effectively CLOSED after this commit pair (3.D revision + 3.D.1 cleanup).

### Z.10 — Production state divergence from migration blueprint (added Phase 3.D revision)

Phase 3.A audit doc enumerated 21 platform-backbone tables based on verbatim reading of `supabase/platform-backbone-v1.sql`. Phase 3.D production verification via `information_schema` query (operator-executed during manual RLS migration apply attempt) revealed those tables were never applied to Supabase production.

**Actual production state (post-Phase-3.D verification):**
- `public.attack_events` (real, in use)
- `public.rate_limits` (real, in use)
- `auth.*` (Supabase built-in, not project-owned)

The 21 platform-backbone tables are BLUEPRINT in `supabase/platform-backbone-v1.sql`, never applied. RLS migration authored against the blueprint assumption cannot target non-existent tables.

**Implication for R-API-03:** Risk remains real (RLS asymmetry would exist IF tables were deployed) but is currently non-actionable. Reclassified pending production deployment of `platform-backbone-v1.sql` itself.

**Implication for application correctness:** Application code referencing `platform`/`identity`/`learning`/`operations`/`content` schema tables would either (a) fail at runtime, OR (b) be using in-memory fallback via `soc-store-adapter` Class 1/2/3 routing. State gathering for Phase 4.A should verify which path is exercised.

**Pattern lesson for Phase 4.A+ state gathering:** Audit doc MUST verify Supabase production state via `information_schema` query at state-gathering time. Migration file presence in repo ≠ applied to production. This becomes a mandatory state-gathering step for any future phase that touches Supabase schema assumptions.

**Mentor-error correction protocol applied (Phase 1.5.14.1 lineage):**
- Phase 3.D LOCAL commits (prior `9fe4a24` + `5b09550`) were UNPUSHED at discovery time — no force push needed.
- Soft reset (`git reset --soft HEAD~2`) safely uncommitted both, preserving working tree.
- `supabase/platform-backbone-rls.sql` deleted from working tree (won't be recreated until tables exist).
- Phase 3.A audit doc reclassified R-API-03 honestly (Section 2 + Section 3 + Section 5 + Z.3 + this Z.10).
- Phase 1.5.14.1 forward-iteration lineage preserved (no force push, no history rewriting on pushed commits).
- Resolution: single revised Phase 3.D commit replaces both prior LOCAL commits; Phase 3.D.1 cleanup resolves new hash placeholders.

**Resolution (Phase 3.D revision commit `152d872`):** RESOLVED — this Z.10 entry IS the resolution. R-API-03 RECLASSIFIED, deferred to future cycle alongside platform-backbone-v1.sql production deployment. Pattern lesson documented for downstream phases.

---

**End of Phase 3.A audit. All Z.1-Z.9 RESOLVED + Z.10 RECLASSIFICATION RESOLVED in Phase 3.D revision commit `152d872`.**
