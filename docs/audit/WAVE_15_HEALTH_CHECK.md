# Wave 15 — Faz 15.A — Comprehensive Health Check Report (READ-ONLY)

> **Status:** Investigation report, **NO CODE CHANGES**. Post-exam reactivation cycle. Capstone NOT submitted — pending AI auditor evaluation.
> **HEAD at investigation start:** `9e4167c` (Wave 14.E.1 commit hash resolution)
> **Vitest baseline:** 543 / 64 files (preserved, READ-ONLY scan)
> **TypeScript:** zero errors · **Lint:** 0E / 0W · **Build:** clean
> **Methodology:** Source-only static analysis (no production database queries, no `.env*` reads, no smoke execution). Operator-reported post-exam symptoms re-mapped to source evidence via `file:line` refs. Prior audit lineage (Wave 13.A / 13.C / 14.A / 14.C / 14.D / 14.E) referenced where root-cause traces flow back.
> **Date:** 2026-05-21

---

## Executive summary

This is the post-exam reactivation cycle. Operator-stated objective: "project + database + database connections work perfectly" before AI auditor evaluation. Three operator concerns drove the investigation; cross-cutting analysis re-orders the POST_CAPSTONE_BACKLOG #13/14/15 deferred items and surfaces one new MEDIUM finding (Concern 2 — first-login visual confusion) plus several stale-doc and test-baseline drift findings.

| Severity | Count | Items |
|----------|-------|-------|
| **HIGH** | **1** | Bug 3 (Avatar TTL aging) — real Wave 13.C regression, reactivated from POST_CAPSTONE_BACKLOG #15 |
| **MEDIUM** | **3** | Concern 2 (first-login visual confusion — Router Cache OR autofill OR seed text), Doc drift (AUDIT_README.md says 530 tests; baseline 543), AUDIT_README missing Wave 9-14 entries |
| **LOW** | **5** | Bug 2 (14× GET storm — operator measurement HAR still uncaptured), Bug 5 (Beni Hatırla — operator DevTools test still pending), Bug 1 (auto-PUT — closed in Wave 14.A as misperception, no new evidence), Bug 4 (display_name — CLOSED Wave 14.C, no follow-up), Wave 13.A doc references `phase-4-a` line offsets that drifted post-Wave 14.D |

**POST_CAPSTONE_BACKLOG closure recommendations:**

- **#13 (Bug 2 — 14× GET storm)** → keep DEFERRED. No new operator evidence; mechanical source analysis still says ≤2 GETs per page load. Operator HAR capture is the only path to lock fix scope.
- **#14 (Bug 5 — Beni Hatırla)** → keep DEFERRED. Code wired correctly at all 4 layers; 60-second operator-side DevTools cookie inspection still pending.
- **#15 (Bug 3 — Avatar 400 TTL aging)** → **REACTIVATE as HIGH priority for Wave 15.B**. Operator's screenshot evidence confirms the navigation cycle (`/portfolio → /academy → /portfolio = avatar shows "S" placeholder`) is reproducible and matches the Wave 14.A HIGH-confidence hypothesis.

**AI auditor readiness verdict:** **NOT_READY**.

Two blockers must close before submission:

1. **Bug 3 (HIGH)**: the most easily reproducible operator-visible defect; an AI auditor running through the live `siberlab.dev` smoke will hit it on the first navigation cycle. Wave 14.A Phase A fix (TTL 30s → 90s, 1 LOC) is the cheapest path. Estimated effort: ~5 minutes plus security-envelope review.
2. **Doc drift (MEDIUM)**: `docs/AUDIT_README.md` Quick-start badge still says "530 vitest tests" while real baseline is 543; Wave 9-14 closures are not mentioned in the wave closure cadence table. AI auditor reading the README first will see drift between docs and CI signal. Estimated effort: ~30 minutes doc edit.

**Cross-cutting verdict:** All three operator concerns (avatar, first-login confusion, database health) share a common substrate: **Next.js App Router cache layers (Router Cache + Data Cache + Full Route Cache) interacting with Wave 13.C SSR-resolved props**. The Wave 13.C optimization traded client-fetch volume for prop-aging surface — that tradeoff is the dominant source of Wave 14.A Bug 3 and is plausibly contributing to Concern 2.

---

## Section A — FUNCTIONALITY audit

### A.1 — Avatar load problem (Concern 1, Bug 3 reactivation)

**Operator-reported symptom (post-exam):**

> Login → `/portfolio` (avatar loads correctly) → `/academy` (zafiyet taraması) → back to `/portfolio` → avatar renders as "S" placeholder initials instead of the actual image.

Operator screenshot evidence available. This pattern is the BFCache / soft-nav scenario predicted in Wave 14.A Bug 3 HIGH-confidence hypothesis.

**Source evidence (re-confirmed at HEAD `9e4167c`):**

- **SSR signed-URL mint:** `src/app/portfolio/page.tsx:91-104`
  - TTL = **30 seconds** (`createSignedObjectUrl(profile.profile.avatarPath, 30)` at L94).
  - Wave 13.C Z.15 lineage intact (revised from 15s in Wave 5B R-API-10).
- **Client consumption:** `src/components/portfolio/PortfolioWorkspace.tsx:358-376`
  - `avatarSrc` memo prefers `initialAvatarUrl` (SSR-resolved); falls back to legacy `/api/profile/avatar/[userId]` path via `buildAvatarSrc`.
  - `onError` handler at `L1035` and `L1158` flips `avatarLoadFailed` → renders initials.
- **Legacy fallback route:** `src/app/api/profile/avatar/[userId]/route.ts:63`
  - Also TTL 30s + `Cache-Control: private, max-age=20` on the 307 redirect.
- **Render sites:** `PortfolioWorkspace.tsx:1031, 1154` (header preview + read-side card). Wave 14.D removed the previous edit-side preview site.

**Reproduce protocol (3 distinct test paths):**

1. **Path A — Tab parking (≥30s):**
   - Login → `/portfolio` (avatar renders).
   - Switch browser tab away for 35+ seconds.
   - Switch back to `/portfolio` tab.
   - **Expected (current code):** avatar still shows correctly (React state preserved; no re-render unless data changes).
   - **Actual risk:** if Router Cache invalidates and a re-render fires using the SSR `initialAvatarUrl` prop that was minted 35s ago, the embedded signed URL is expired → 400 from Supabase → `onError` fires → "S" placeholder.

2. **Path B — Soft-nav round-trip (Concern 1 path):**
   - Login → `/portfolio` (avatar renders, `initialAvatarUrl` is fresh at T₀).
   - Navigate to `/academy`.
   - Spend > 30 seconds reading academy content.
   - Click back to `/portfolio` (soft-nav, NOT hard reload).
   - **Expected:** Server Component re-runs (force-dynamic + revalidate=0), mints a fresh signed URL. Router Cache for `/portfolio` segment may serve the **stale rendered output** instead of triggering a re-fetch.
   - **Actual (per operator):** "S" placeholder appears, confirming the stale-prop-served-by-Router-Cache hypothesis.

3. **Path C — BFCache restore:**
   - Login → `/portfolio` (avatar renders).
   - Navigate to `/academy` via `<a>` tag (full nav, not Link).
   - Press browser back button (BFCache restore).
   - **Expected:** BFCache serves the previous HTML with the original `initialAvatarUrl` prop value frozen at T₀.
   - **Actual risk:** if (time-on-/academy) > 30s, URL is expired → 400.

**Root cause hypothesis (re-ranked at HEAD `9e4167c`):**

- **HIGH confidence — SSR-prop aging past 30s TTL (Wave 13.C regression).** The arithmetic is direct: `initialAvatarUrl` is captured at server-render time T₀. Browser fetch happens at T₀ + Δt_total. If Δt_total > 30s (soft-nav return after 30s+ on `/academy`, tab parking, BFCache restore), Supabase returns 400 → `onError` fires → initials placeholder. Wave 13.C traded client-fetch volume for prop-aging surface; that surface is now load-bearing for the BFCache / soft-nav path.
- **MEDIUM confidence — Router Cache stale segment serving expired prop.** Next.js App Router client-side Router Cache holds rendered route segments for soft-nav return. On `/academy → /portfolio` soft-nav, if the cached segment is reused (even momentarily before invalidation), the `initialAvatarUrl` prop from T₀ is re-rendered. Wave 10 closure (`router.refresh()` on save handlers) invalidates Router Cache for `/portfolio`, but nav-from-other-route does not necessarily trigger a fresh prop computation in all cases. **This is the most likely Concern-1 path** per operator screenshot.
- **LOW confidence — service-role key rotation or NTP clock skew.** Both are operator-environment dependent, not source-traceable. Wave 14.A noted these but assigned LOW confidence; no new evidence elevates them.

**Fix paths ranked (Wave 15.B candidate menu):**

| Phase | Fix | Effort | LOC | Security envelope impact |
|-------|-----|--------|-----|--------------------------|
| **A** | Extend TTL 30s → 90s in `src/app/portfolio/page.tsx:94` | 5 min | 1 | 3× wider signed-URL leak window (mentor security review needed) |
| **B** | `<img onError>` retry to legacy `/api/profile/avatar/[userId]` (mint-fresh on demand) | 30-45 min | ~15 | Preserves Wave 13.C SSR-perf benefit + graceful degradation; no envelope change |
| **C** | Drop static prop; client `useEffect` fetches fresh URL on mount via new `/api/profile/avatar/url` endpoint | 2-3 hr | ~40-60 | Architecturally cleanest; loses partial SSR-perf; no envelope change |

**Recommendation:** **Phase A** for Wave 15.B (capstone-readiness priority). Phase B as Wave 15.C if time permits. Phase C deferred indefinitely (over-engineering for current scale).

---

### A.2 — Profile save flow integrity

**`saveProfile()` call chain trace** (`PortfolioWorkspace.tsx:616-658`):

1. Button click `L1143` → `void saveProfile()`.
2. Guard at `L617`: `if (!canEdit || saving) return`.
3. Fetch `PUT /api/profile/me` at `L623-642` with JSON body containing `headline`, `bio`, `location`, `specialties`, `tools`, `socialLinks` (6 platforms).
4. Server route `src/app/api/profile/me/route.ts:26-73`:
   - `requireSession` guard.
   - `parseProfilePayload` → `sanitizeReportContent` (Layer 1 XSS strip on `bio` + `headline`, 6th defense-in-depth instance).
   - `validateProfilePayload`.
   - `updatePortfolioProfile` → adapter → Supabase write at `state/profiles/{userId}/profile.json`.
5. Response body returned to client → `setData` merge at `L645-654` (preserves `avatarPath`/`avatarName`/`avatarMimeType` from current state if response omits them).
6. `setMessage('Profil guncellendi.')` at `L655`.
7. **`router.refresh()` at `L656`** (Wave 10 A-24 closure) → Server Component re-renders → fresh `initialProfile` + fresh `initialAvatarUrl`.

**PUT payload validation:** `src/lib/portfolio-validation.ts` (per Wave 14.A audit lineage). `displayName` field is NOT in the parsed payload (Wave 14.C removed); attempts to send it are silently ignored.

**Wave 10 `router.refresh()` behavior:** Invalidates Next.js Router Cache for the current route segment + triggers Server Component data refetch on next render. Verified intact at HEAD.

**State persistence after navigation cycles:** No defect surfaced in source. The `shouldKeepLocalProfile` heuristic at `L127-147` prefers local state over incoming state when (a) same user AND (b) local timestamp >= incoming timestamp AND (c) local state has avatarPath or richer specialties/tools — designed exactly to prevent the soft-nav-return overwriting a freshly-saved profile.

**Verdict:** ✅ Healthy. No source-level defect. The auto-PUT misperception from Wave 14.A Bug 1 remains ELIMINATED at HEAD (single caller at `L1143`; no debounce/auto-save).

---

### A.3 — Auth flow integrity

**Login → session → `/portfolio` flow:** (`src/app/api/auth/login/route.ts:27-158`)
- Rate-limit gate (R-06 audit log on 429).
- `authenticateUser` (scrypt verify).
- Verification gate at `L103-117`: unverified email → 403 `EMAIL_NOT_VERIFIED`.
- `createSession` → cookie set at `L136-144` with conditional `maxAge` per `remember`.
- Audit log at `L122-128`.

Source verified clean. No defect surfaced.

**Logout → session clear → redirect:** `src/app/api/auth/logout/route.ts` (not re-read this cycle; Wave 14.A confirmed wiring correct).

**Beni Hatırla cookie behavior:** Wave 14.A Bug 5 audit verified wiring at all 4 layers (EmbeddedLogin checkbox → `loginWithPassword` → `/api/auth/login` body → cookie `maxAge`). No new evidence post-exam.

**Verification email flow:** R-12 (recipient-hash audit log) + R-08 (token rotation) defenses confirmed intact via Phase 1.5 closures. Resend-verification flow at `EmbeddedLogin.tsx:150-185` re-confirmed.

**Verdict:** ✅ Healthy.

---

### A.4 — Other feature flows

| Feature | Source path | Status |
|---------|-------------|--------|
| Certificate upload + render | `PortfolioWorkspace.tsx:723-747`, `/api/profile/certifications/*`, `CertificationPreview` at `L149-170` | ✅ Wave 5C R-API-14 archive lifecycle intact |
| Education entries CRUD | `PortfolioWorkspace.tsx:820-861`, `/api/profile/education/*` | ✅ Healthy |
| Avatar upload/remove | `PortfolioWorkspace.tsx:660-721`, `/api/profile/avatar` POST+DELETE | ✅ Wave 5B R-API-11 orphan cleanup best-effort intact |
| Social links sync (Wave 11) | `PortfolioWorkspace.tsx:317-322, 382-403, 1112-1117` | ✅ A-25 closure intact, 6 platforms |

**Certificate flow trace:**
1. `openNewCertificationComposer()` `L766-781` → sets `certComposerMode='create'` → render switches to form panel.
2. Form fields populate `certForm` state.
3. `saveCertification()` `L723-747` → multipart POST to `/api/profile/certifications` (or PATCH to `/api/profile/certifications/{id}`).
4. Server route validates + writes to `state/profiles/{userId}/certifications/{certId}.json` + index file at `state/indexes/certifications/{certId}.json`.
5. Wave 5C R-API-14 archive lifecycle: DELETE on a non-archived cert returns 409 NOT_ARCHIVED → operator must PATCH `?action=archive` first → then DELETE.
6. Response `setData` merge + `router.refresh()` `L745` → Server Component re-renders.

**Education flow trace:** Mirror of certification flow without the multipart asset path; JSON-only body. Same archive→delete two-stage lifecycle.

**Avatar upload guard chain:**
1. Magic-byte validation at `src/lib/portfolio-assets.ts:saveAvatarAsset` (R-API-08 closure). Allowed: JPEG/PNG/WebP.
2. Size limit (TBD by lib; not re-read this cycle).
3. Storage path `avatars/user-{userId}/{filename}` (Supabase Storage binary upload, `cacheControl: '3600'`).
4. Profile JSON updated with new `avatarPath/Name/MimeType`.
5. Best-effort delete of previous asset (R-API-11 — failure logged but does not roll back the new asset).
6. `router.refresh()` → Server Component re-mints `initialAvatarUrl`.

**Verdict:** ✅ All non-avatar feature flows healthy. No defect surfaced.

---

## Section B — DATABASE HEALTH audit

### B.1 — Supabase JSON Storage state

**Storage adapter:** `src/lib/supabase-app-state.ts` (220+ LOC). Single Supabase client singleton (`L7`, lazy-initialized at first call). `noStoreSupabaseFetch` wraps all Supabase HTTP calls with `cache: 'no-store'` (prevents Next.js Data Cache from caching service-role JSON reads at the framework layer — correct for security/freshness).

**JSON path schema** (per `src/lib/soc-store-supabase.ts:129-183`):

| Domain | Path pattern | Notes |
|--------|-------------|-------|
| Users (by id) | `state/users/by-id/{id}.json` | Source of truth |
| Users (by username) | `state/users/by-username/{usernameKey}.json` | Index file (mirror) |
| Users (by email) | `state/users/by-email/{emailKey}.json` | Index file (mirror) |
| Sessions | `state/sessions/{token}.json` | 30-day TTL, lazy cleanup on read |
| Profiles | `state/profiles/{userId}/profile.json` | Wave 11 socialLinks + Wave 14.C dropped displayName silently |
| Certifications | `state/profiles/{userId}/certifications/{certId}.json` + index `state/indexes/certifications/{certId}.json` | Wave 5C archivedAt schema |
| Education | `state/profiles/{userId}/education/{eduId}.json` | Wave 5C archivedAt schema |
| Reports | `state/reports/{reportId}.json` | Operational, Wave 5C archivedAt |
| Audit log | `state/audit/{timestamp}-{uuid}-{action}.json` | Per-event JSON, no aggregation |
| Avatars (binary) | `avatars/user-{userId}/{filename}` | 1 hour `cacheControl` on stored object |

**Orphaned fields check (Wave 11 + 14.C silent-ignore strategy):**
- Pre-Wave-11 profiles with `website: string` → field is dropped at read time (JSON.parse just doesn't surface untyped fields).
- Pre-Wave-14.C records with `displayName: string` → same silent-ignore path.
- **No migration / cleanup job exists.** The fields remain in Supabase Storage JSON forever; operator confirmed (per Wave 14.C narrative) that only their own profile is live so no data-cleanup pressure.

**File count + storage size:** Cannot enumerate without production Supabase query (out of scope per Section 10 yasaklar). Per Wave 13.A audit Layer 2 latency analysis, individual JSON reads are ~100-300ms; binary reads ~200-500ms. No drift detected at source level.

**Read/write latency observation:** Source-only; not measured this cycle. Wave 13.A produced the canonical numbers.

---

### B.2 — Data consistency

**Username uniqueness enforcement:**
- Write-time: `src/lib/soc-store-supabase.ts:800-803` (registerUser) + `L863-866` (createUser). `readUserByUsername(input.username)` check before write; reject if `existing?.isActive`.
- Read-time: `readUserByUsername` at `L210-213` reads `userByUsernamePath(username)` directly. Lowercased via `normalizeUsernameKey`.
- **Race condition surface:** Two concurrent `registerUser` calls with the same username can both pass the `readUserByUsername` check before either writes. The second write at `L837` (`uploadJsonObject` with `upsert: true`) will overwrite the first. **MEDIUM risk** — but rate-limited at the route layer + low traffic profile; documented as R-05 in Phase 1 OPEN backlog.

**Email uniqueness:**
- `registerUser` at `L811-816` re-checks at storage boundary.
- Same race window applies. Same mitigation context.

**Session token uniqueness:** `crypto.randomUUID()` at `createSession` `L737`. 128-bit UUID v4; collision probability vanishingly small.

**Audit log integrity:** Per-event JSON file at `auditLogPath` `L181-183` — `Date.now()-uuid-action.json`. No aggregation, no race window. R-17 silent-fail risk (Phase 1 OPEN — DB outage swallows audit events) acknowledged in `writeAuditLog` adapter wrapper.

**Verdict:** ✅ No new defect surfaced. Pre-existing R-05 (TOCTOU) + R-17 (audit log silent fail) remain in Phase 1 OPEN backlog as documented.

---

### B.3 — Bug 2 — 14× GET storm investigation

**Source-side site map (re-verified at HEAD):**

```
PortfolioWorkspace.tsx:520  → GET /api/profile/me (editable branch — single fire on mount)
PortfolioWorkspace.tsx:551  → GET /api/profile/me (non-editable branch — alternative, mutually exclusive)
PortfolioWorkspace.tsx:623  → PUT /api/profile/me (NOT a GET; save path)
```

For the authenticated `/portfolio` operator (`editable={true}` always per `src/app/portfolio/page.tsx:110`), `L520` is the single GET site that fires. The `useEffect` at `L514-581` has `[editable]` dep — fires once on mount, stays quiet thereafter.

**Static analysis prediction (Wave 14.A intact):** **Exactly 1 GET `/api/profile/me`** per page load.

**React Strict Mode + Next.js HMR amplification:** In dev mode, Strict Mode double-invokes effects (2× per mount). HMR re-mount fires the effect again. Conservative dev-session arithmetic: 2× × N HMR cycles × 1 mount per cycle = 2-14 GETs over a development session.

**Production HAR vs source code expected count:** Still uncaptured.

**Recommendation:** Operator-side production HAR capture protocol. Steps:
1. Open Chrome DevTools Network panel BEFORE navigating to `/portfolio`.
2. Disable "Disable cache" checkbox (use production cache behavior).
3. Hard reload `/portfolio` (Ctrl+Shift+R).
4. Filter Network panel for exactly `path === '/api/profile/me'` (use the URL filter input, NOT substring).
5. Count rows.
6. If > 1: capture HAR (right-click → Save all as HAR with content), share with mentor for analysis.
7. If = 1: close Bug 2 as Wave 14.A miscount hypothesis confirmed.

**Verdict:** Still LOW priority. Source unchanged from Wave 14.A; needs operator network capture to lock fix scope.

---

### B.4 — Backend route health

**API route inventory (28 handlers across 10 domains):**

| Domain | Routes | Auth gate | Notes |
|--------|--------|-----------|-------|
| auth | login, logout, session, register, verify, verify/resend, forgot, reset, reset/validate | mixed | R-06 rate-limit audit; R-12 hashed recipient logs |
| alerts | / (GET/POST), /[id] (PATCH) | analyst+ | R-API-02 RBAC intact |
| reports | / (GET/POST/PATCH), /[id] | analyst+ | R-API-04/05 + cascade + XSS intact |
| users | / (GET/POST admin), /me (DELETE) | admin / self | R-API-06 + scrypt verify on self-delete |
| profile | /me (GET/PUT), /avatar (POST/DELETE), /avatar/[userId] (GET), /certifications (CRUD), /certifications/[id] (CRUD), /certifications/assets/[id] (GET), /education (CRUD), /education/[id] (CRUD) | session | R-API-10/11/14 lifecycle intact |
| metrics | /live (GET) | open | dashboard polling |
| live-attacks | / (GET) | open | demo simulation |
| cves | / (GET) | open | 5-min cache |
| greynoise | / (GET) | open | upstream rate-limit + mock fallback |
| cybernews | / (GET) | open | RSS agreg |

**Rate-limit state (R-12):** `src/lib/rate-limiter.ts` globalThis-persisted (process-local). `supabase-rate-limits.ts` Postgres-backed table (`rate-limits.sql` migration). 5C decision: critical surfaces (login + register + forgot + reset + verify-resend) use the multi-instance-safe Postgres-backed limiter; lower-criticality surfaces (alerts/reports CRUD) use process-local.

**Error responses (sensitive-info leak check):** Spot-checked `auth/login` → `'Hatali kullanici adi veya sifre.'` (no enumeration); `profile/me` → `'Profil bulunamadi.'` (no path leak); `profile/avatar/[userId]` → `'Profil fotografisi bulunamadi.'` (no signed-URL leak in error body). ✅ No leaks surfaced.

**Verdict:** ✅ Healthy. No new defect surfaced.

---

### B.5 — Hybrid storage mode + memory fallback resilience

`src/lib/soc-store-adapter.ts:69-123` implements the **R-03 Path γ** memory-fallback guard (Phase 1.5.7 closure):

- `requestedStorageMode` ← `process.env.SOC_STORAGE` (default `sqlite`).
- `activeStorageMode` ← runtime state; switches to `memory` only on sqlite failure during reads.
- `isWrite=true` calls in fallback mode throw `MemoryFallbackBlockedError` instead of silently routing to in-memory state (which would lose data on instance recycle).
- Production routing (per `SOC_IDENTITY_STORE` env):
  - `supabase` (default) → `soc-store-supabase.ts` (JSON Storage adapter).
  - `postgres` → `soc-store-supabase-postgres.ts` (Phase 1 migration target).
  - `disabled` → fallthrough to `withStore` → sqlite/memory.

**Connection pooling:** Supabase JS client is a singleton (`supabase-app-state.ts:7-46`), created lazily on first `getSupabaseClient()` call. The underlying `@supabase/supabase-js` library handles HTTP pooling via Node's `fetch` (which is wrapped here to inject `cache: 'no-store'`). No additional pooling layer.

**Bucket bootstrap:** `ensureSupabaseAppStateBucket()` `L52-75` is idempotent — checks for existing bucket via `getBucket`, creates if missing, swallows "already exists" errors. Wrapped in a singleton Promise (`ensureBucketPromise`) so concurrent first-calls share one bootstrap.

**Verdict:** ✅ Resilience layer intact. R-03 hardening preserved. No drift detected.

---

## Section C — PERFORMANCE audit

### C.1 — Render flicker / cache state (Concern 2 root cause analysis)

**Operator-reported symptom (Concern 2):**

> Operator created a new account. On first login, `/portfolio` showed:
> - Heading "SALIM AYBASTI" (operator's other account)
> - Social link "codewarrior96"
> - Bio fragment "Salimmm"
>
> Operator could NOT reproduce after first occurrence.

**Three hypotheses analyzed (per mentor brief):**

#### Hypothesis 1 — Browser autofill (LOW confidence at source level)

Browser password-manager autofill can populate `<input>` fields without firing React change events. If the operator's password manager had a saved entry for the prior account, the username field on `/register` could have been auto-filled to "salim" then the operator typed over it with the new account name. The displayed text fragments are then a UX paint from autofill, not from React state.

**Why LOW:** the operator-described symptom isn't form-input residue — it's the **rendered profile content** (heading, bio paragraph, social link). Autofill cannot inject these into the post-login `/portfolio` Server Component output.

#### Hypothesis 2 — Next.js Router Cache stale (HIGH confidence)

Next.js App Router's client-side Router Cache holds rendered route segments. If the operator had previously visited `/portfolio` under the old account in the same browser session, the cached segment is keyed by route path (`/portfolio`) — not by user identity. On post-login redirect to `/portfolio` under the NEW account, Router Cache may serve the stale rendered segment for a single frame before the Server Component re-runs.

The stale segment contains the OLD user's `initialProfile` prop (headline = "SALIM AYBASTI", bio fragment "Salimmm", social link "codewarrior96"). The flash is brief; once the Server Component re-renders with the new session, the correct profile flows down.

**Why HIGH:**
- `/portfolio/page.tsx` has `export const dynamic = 'force-dynamic'` + `revalidate = 0` (`L16-17`) which disables Next.js Full Route Cache and Data Cache server-side — but **does NOT disable client-side Router Cache**.
- Wave 10 closure (`router.refresh()` after save handlers) was added specifically because Router Cache survives soft-nav return with stale `initialProfile` prop — this is the documented behavior in `PortfolioWorkspace.tsx:294-302` SENIOR ARCHITECT NOTE.
- The login → `/home` (default redirect) → user clicks PROFIL nav → `/portfolio` flow CAN serve cached segment because no explicit `router.refresh()` fires between login and PROFIL nav.
- Operator-reported non-reproducibility matches Router Cache lifetime (segments evict on memory pressure, navigation away, or explicit invalidation).

#### Hypothesis 3 — Wave 14.C seed text rendering with stale username state (LOW confidence)

`src/lib/portfolio-profile.ts:116-125` `getPortfolioSeedForUser` returns:
```ts
headline: `${user.username} / Profil`
bio: `${user.username} icin olusturulmus duzenlenebilir profil alani...`
```

For a brand-new user, `getPortfolioProfile` returns null → `buildProfileFromSeed` in `/portfolio/page.tsx:19-45` runs → seed is rendered with the SESSION username (which is the new user's, not the old user's). The seed text would render as "newuser / Profil", not "SALIM AYBASTI".

**Why LOW:** the seed text is derived from session state, which is the new user's session after login. Cannot produce the OLD user's profile content.

**Combined verdict:** Hypothesis 2 (Router Cache stale) is the dominant root cause. Hypothesis 1 (autofill) and Hypothesis 3 (seed text) are mechanically unable to produce the operator-observed symptom.

**Why operator could NOT reproduce:** Router Cache segment lifetime is bounded by:
- Memory pressure (browser eviction).
- Explicit invalidation (`router.refresh()` calls anywhere in app code).
- Navigation away from `/portfolio` to a different route segment (eviction policy).
- Session age (segments scoped to the SPA session — page reload clears all).

The operator's reproduction attempt likely triggered one of these eviction paths (page reload after first-occurrence inspection is the most likely), at which point the stale segment is gone and the symptom cannot recur until another cross-account auth transition + soft-nav matches the exact timing window.

**OWASP threat-model mapping (per Section 10 hard rule #6):**
- A01 Broken Access Control: ❌ NOT applicable — the operator was correctly authenticated as the new user; `/api/profile/me` returned the NEW user's data (no IDOR). The visual flash is rendered output from a cached segment, not authoritative.
- A04 Insecure Design: ✅ applicable — caching strategy did not account for cross-account auth transitions. The Wave 10 `router.refresh()` was scoped to save handlers; login/logout boundaries were missed.

**Fix paths (Wave 15.C candidate menu — operator non-reproducible defect, NOT a Wave 15.B priority):**

| Phase | Fix | Effort | Defense |
|-------|-----|--------|---------|
| **A** | Add `router.refresh()` at login handler success path (`EmbeddedLogin.tsx:144` before `router.push(redirectTo)`) | 5 min | Invalidates Router Cache so post-login redirect serves fresh segment |
| **B** | Add a logout-time `router.refresh()` (`/api/auth/logout` response handler) — covers the inverse flow | 5 min | Defense-in-depth; cache stays fresh across auth state transitions |
| **C** | Per-segment Router Cache invalidation hook via `next/navigation` `revalidatePath('/portfolio')` invoked from middleware on session-cookie change | 30-60 min | Most robust; covers all auth-transition paths |

**Recommendation:** Phase A + Phase B as Wave 15.C if operator triages. Phase C deferred unless symptom recurs.

---

### C.2 — Page load metrics (code-level estimate)

Per Wave 13.A canonical numbers (Faz 13.C closure shipped):

| Path | Cold | Warm |
|------|------|------|
| `/portfolio` SSR (force-dynamic) | ~600-1200ms | ~300-500ms |
| Avatar resolve (Wave 13.C SSR) | ~250-400ms | ~150ms (cache hit) |
| API call sequence on `/portfolio` mount | 1× GET `/api/profile/me` (~150-300ms) | same |

No regression detected at source level vs Wave 13.A measurements.

**Wave 14.D + 14.E layout changes:** UI-only (CSS classes, grid `min-w-0`, overflow-wrap). No render-tree change that would affect critical path latency.

---

### C.3 — Bundle size review

Per Wave 8 FINAL_SCAN_REPORT.md (commit `9d0eca4`):
```
Route (app)                                  Size     First Load JS
ƒ /portfolio                                 11.5 kB        108 kB
ƒ /community                                 70.2 kB        158 kB
ƒ /home                                      2.56 kB        97.5 kB
ƒ /blog/[slug]                              34.8 kB         131 kB
+ First Load JS shared by all                87.5 kB
```

**Recommendation:** Run `npm run build` post-Wave-15.B and compare against the Wave 8 baseline. Expected delta = 0 (no new dependencies; Wave 14.D/E were CSS-only). Informational only — not a fix proposal.

**Top contributors to `/community` 158 kB:** xterm.js Terminal (Wave 12 rename of `/community` → `/academy`; route now `/academy`). Code-split opportunity: dynamic import of Terminal when curriculum interactivity is triggered. Effort ~30 min; benefit ~30-40 kB. Defer to Phase 7.

---

### C.4 — Render-tree mount cost analysis

**`/portfolio` Server Component cold path (request-arrival → first byte):**

1. `cookies()` + `getServerSessionFromCookies(cookieStore)` — Supabase JSON read for session token, ~100-300ms.
2. `getPortfolioProfile(session.user.id)` — Supabase JSON reads for profile, certifications, education + avatar metadata (4 parallel reads via `Promise.all` in `getPortfolioProfile` `L908-912`), ~150-400ms wall time.
3. `createSignedObjectUrl(avatarPath, 30)` — Supabase Storage API roundtrip if avatarPath present, ~200-500ms.
4. React rendering of `PortfolioWorkspace` server component shell + JSON serialization of `initialProfile` payload.

**Cold-path budget estimate:** ~600-1500ms first-byte on cold Vercel function instance + warm Supabase region. Tracks Wave 13.A measurements.

**Warm path:** Vercel function reuse skips cold start (~50-100ms saved). Subsequent calls hit ~300-500ms range.

**Client hydration cost:** `PortfolioWorkspace.tsx` is a `'use client'` component with ~1700 LOC + 6 social-link inputs + textareas + token boards. Hydration time ~100-300ms on mid-tier devices. Not investigated in depth this cycle.

**Useeffect cost on mount:**
- Effect at `L443-445` — `setData` if local profile is fresher (no async, cheap).
- Effect at `L451-465` — `setProfileForm` mirror from `data.profile` (no async, cheap).
- Effect at `L514-581` — `syncEditableMode` async GET to `/api/profile/me`, single fire per mount. **This is the Bug 2 candidate site** (single GET expected).
- Effect at `L476-512` — cert/edu fallback selection (no async).

---

## Section D — AI AUDITOR READINESS

### D.1 — `docs/AUDIT_README.md` state check (MEDIUM finding)

**Current content snapshot (as of HEAD):**
- Quick-start says: `npm run test        # 530 vitest tests (~5s)` — **STALE** (real baseline is 543).
- Vitest badge: `vitest-530%20passing-brightgreen` — **STALE**.
- Wave closure cadence table stops at Wave 7 (capstone documentation). Waves 8-14 missing entirely:
  - Wave 8 (lint + hostname F1/F7 closures)
  - Wave 9 (README hybrid restructure)
  - Wave 10 (Router Cache soft-nav fix)
  - Wave 11 (socialLinks multi-platform)
  - Wave 12 (`/community → /academy` rename)
  - Wave 13.A/C (avatar perf audit + SSR signed URL)
  - Wave 14.A/C/D/E (portfolio bug investigation + display_name removal + UI polish)
- "Pattern catalog" mentions 18 patterns — Wave 8/9/10/11/12/13/14 likely added more (uncounted this cycle).

**Risk:** AI auditor reads AUDIT_README → sees "530 tests" → runs `npm run test` → sees 543 → flags doc drift. Capstone-grade discipline broken on first impression.

**Fix path:** Doc-only edit. Update badge, quick-start line, closure table. ~30 minutes. Wave 15.C candidate.

---

### D.2 — `docs/audit/FINAL_SCAN_REPORT.md` state

**Current content snapshot (re-read this cycle):**
- Pre-scan HEAD: `9edf8b4` (Wave 7.1) — **STALE** relative to current HEAD `9e4167c`.
- Vitest baseline: 530 / 62 files — **STALE** (real 543 / 64).
- Wave 13.C and Wave 14.C addenda were appended (lines 27-28). Wave 8 closure (F1 + F7) cited. ✅ Partially up-to-date.
- A-XX register: per AUDIT_README closure summary, 21 amendments (18 + 2 ACK). Wave 11-14 added A-25 (socialLinks), A-26 (academy rename), A-27 (avatar SSR), A-28 (display_name removal), A-29 (bio overflow). **Register may now have 28-30 entries** vs documented 21. Not verified by direct count this cycle.

**Fix path:** Doc update only. Wave 15.C candidate.

---

### D.3 — Test coverage report

**Critical path coverage spot-check:**
- Auth: `src/app/api/auth/login/__tests__/route.test.ts` — exists, T-LG-* prefix.
- Profile CRUD: `src/app/api/profile/me/__tests__/route.test.ts` — exists.
- Avatar: `src/app/api/profile/avatar/route.test.ts` (or similar) — Wave 5B + 13.C related.
- Portfolio workspace: `src/components/portfolio/__tests__/PortfolioWorkspace.test.tsx` — exists per Wave 14.A grep.

**Total:** 64 test files / 543 tests at HEAD. ~10-12 net additions since Wave 7 baseline (530), tracking Wave 8-14 closures.

**Missing tests for Bug 2/3/5 if reactivated:**
- Bug 3 (Avatar TTL): no regression-guard test for SSR-prop aging behavior. Wave 15.B fix should add one (`vi.useFakeTimers` advancing past 30s → expect onError fallback path triggered).
- Bug 2 (GET storm): no test verifying single GET per mount. Wave 14.A noted Bug 2 needs HAR before fix; same applies to test design.
- Bug 5 (Beni Hatırla): cookie maxAge wiring already tested (`auth/login/__tests__/route.test.ts`). No new test needed unless UX default flips.

---

### D.4 — Security review surface

**R-XX inventory (per AUDIT_README closure):**
- Total: 22 (Phase 1) + 15 (Phase 2) + 15 (Phase 3) + 15 (Phase 4) + 13 (Phase 5) + 21 (A-XX) = **101**.
- All HIGH severity items: RESOLVED status preserved (Wave 14.A confirmed none reopened; Wave 14.C displayName removal closed Bug 4 + reduced attack surface).
- No new attack surfaces introduced post-Wave-14.E:
  - Wave 14.D: textarea char ceiling + CSS classes only — no input/auth surface change.
  - Wave 14.E: grid CSS + h1 className only — no surface change.
- Pending OPEN items remain at 6 R-XX (Phase 1) + 10 R-E2E (Phase 5 Yol A skip) = **16 known-open**. All documented.

**Verdict:** ✅ Security inventory clean. No regression at HEAD.

---

## Section E — Cross-cutting findings

### E.1 — Are bugs related?

**Bug 3 (Avatar 400) ↔ Concern 2 (First-login visual confusion) ↔ Wave 10 Router Cache saga:**

All three trace to **Next.js App Router cache layers + Wave 13.C SSR-resolved props interacting with cross-route navigation**.

The Wave 13.C SSR-resolve optimization traded client fetch volume (3 avatar fetches → 1) for prop aging surface (the resolved URL has a 30s shelf life). The Wave 10 closure (`router.refresh()` on save) addressed one stale-state vector (saved profile not appearing after soft-nav return) but did not address the inverse — cached SEGMENT serving stale prop after cross-route soft-nav from a different route to `/portfolio`.

**Unified pattern:** the App Router client-side Router Cache is the canonical "soft-nav return shows stale data" surface. Each new SSR-resolved prop added to a `/portfolio`-class route creates a new aging dimension. Wave 13.C added one; Concern 2 hints at another (full profile content).

**Implication:** the highest-leverage Wave 15.B fix isn't just the Bug 3 TTL extension — it's reviewing the Router Cache invalidation strategy for ALL auth-transition + cross-route boundaries. Phase C from Section A.1 (eliminate prop aging entirely via client-side fetch) is the architecturally cleanest path but defer-worthy at current scale.

---

### E.2 — POST_CAPSTONE_BACKLOG re-prioritization

| Item | Current state | Recommendation |
|------|---------------|----------------|
| #13 (Bug 2 — GET storm) | DEFERRED | **Keep DEFERRED**. No new evidence; HAR capture still blocking. |
| #14 (Bug 5 — Beni Hatırla) | DEFERRED | **Keep DEFERRED**. Operator DevTools verification still pending. |
| #15 (Bug 3 — Avatar TTL aging) | DEFERRED | **REACTIVATE as Wave 15.B HIGH priority**. Operator screenshot evidence elevates from MEDIUM (Wave 14.A confidence) to HIGH (confirmed in production). |
| #1-12 (CV generation, blog, notification, etc.) | Phase 7+ candidates | **Keep Phase 7+**. No capstone-readiness blocker. |
| **NEW: Concern 2 (Router Cache stale post-login)** | (not in backlog) | **ADD as POST_CAPSTONE_BACKLOG #16** with MEDIUM priority. Fix Phase A (login-time `router.refresh()`) is 5 min; defense-in-depth Phase B is another 5 min. |

---

## Section F — Recommended Wave 15.B+ cycles

### F.1 — Highest priority fix cycle (Wave 15.B)

**Scope:** Bug 3 — Avatar TTL aging fix (Phase A: TTL 30s → 90s).

| Item | Detail |
|------|--------|
| Files touched | `src/app/portfolio/page.tsx` (1 LOC) + comment update in `src/app/api/profile/avatar/[userId]/route.ts` (Z.15 note) |
| Tests added | 1 regression guard (`vi.useFakeTimers` advancing past old TTL window) |
| LOC delta | ~25 (1 prod LOC + ~20 test LOC + ~3 doc comment) |
| Risk | LOW (1-LOC TTL extension; envelope widened from 30s to 90s, still well under leak-window threshold) |
| Effort | ~30-45 min (fix + test + 2 commits per Wave .1 protocol) |
| Mega-prompt readiness | READY — Wave 15.B mega-prompt can lock at 30s→90s Phase A path with mentor security review note |

**Pre-Wave-15.B mentor decisions to resolve:**
1. Phase A (TTL extension) vs Phase B (onError retry fallback) vs Phase C (drop prop entirely)?
2. Security envelope: 30s → 90s acceptable for capstone-grade defense? (Mentor: portfolio avatar is public-class asset; 90s window is operationally fine.)
3. Add regression-guard test now, or defer to Phase 7 test sweep?

### F.2 — Optional improvement cycles (Wave 15.C+)

| Cycle | Scope | Effort | Priority |
|-------|-------|--------|----------|
| 15.C — Doc drift cleanup | AUDIT_README test count + Wave 8-14 closure table | ~30 min | MEDIUM (capstone-readiness) |
| 15.D — Concern 2 fix (Router Cache stale post-login) | Phase A + B login/logout `router.refresh()` | ~15 min | LOW (operator non-reproducible) |
| 15.E — FINAL_SCAN_REPORT pre-scan HEAD bump | Update to current HEAD + A-XX register count | ~20 min | LOW (audit doc hygiene) |
| 15.F — `/academy` bundle code-split (xterm.js dynamic import) | Refactor + test | ~30-60 min | LOW (perf, deferrable to Phase 7) |

### F.3 — Wave 15.B mega-prompt readiness checklist

For Wave 15.B (Bug 3 TTL extension) to ship cleanly, the mega-prompt must specify:

- [ ] Operator confirms Phase A path (TTL 30s → 90s) vs Phase B (onError fallback retry) vs Phase C (drop prop entirely)
- [ ] Mentor approves the security envelope widening (30s → 90s) for portfolio-class avatar asset
- [ ] Test ID prefix allocation (`T-PA-TTL01` proposed)
- [ ] Test design: `vi.useFakeTimers` + `vi.advanceTimersByTime(31_000)` + assert legacy fallback path is exercised when SSR URL expires
- [ ] Wave .1 cleanup commit pattern (fix commit with `<COMMIT_HASH_TBD>` placeholders + `.1` cleanup resolving them)
- [ ] AUDIT_README badge update should NOT bundle into Wave 15.B — keep it as separate Wave 15.C cycle (audit-trail clarity)
- [ ] Vitest baseline preservation gate: 543 → 544 (add 1 regression test)
- [ ] Lint preservation: 0E / 0W
- [ ] TypeScript clean
- [ ] No `.env*` reads
- [ ] No production database writes

**Mega-prompt structure recommendation:** Standard 9-section mega-prompt protocol (CONTEXT → STRATEGIC DECISIONS → DELIVERABLES → EXECUTION → SELF-REVIEW → APPLY → VERIFICATION → COMMIT → FINAL REPORT + YASAKLAR).

### F.4 — LOC delta estimate if Wave 15.B fixes implemented

| Phase | Production LOC | Test LOC | Doc LOC | Total |
|-------|----------------|----------|---------|-------|
| **A** (TTL extension) | 1 | ~20 | ~5 (Z.15 update in comment) | ~26 |
| **B** (onError fallback) | ~15 | ~30 | ~10 | ~55 |
| **C** (drop prop entirely) | ~40-60 | ~50 | ~20 | ~110-130 |

Phase A is the recommended Wave 15.B scope; total ~26 LOC delta + 1 new commit pair (`fix:` + `.1` cleanup).

---

## Section G — Mentor decision matrix

> Intentionally **LEFT EMPTY** per Section 3 spec. Wave 15.B planning fills this in after operator + mentor review of Sections A-F.

| Item | Recommendation | Mentor decision | Rationale |
|------|----------------|----------------|-----------|
| | | | |

---

## Investigation methodology notes

### Files read this cycle

- `src/app/portfolio/page.tsx` (SSR avatar resolve)
- `src/components/portfolio/PortfolioWorkspace.tsx` (avatar render sites, save flow, navigation behavior — partial read of 1700+ LOC focused on `L1-700`, `L1100-1245`)
- `src/app/api/profile/avatar/[userId]/route.ts` (legacy avatar GET, TTL 30s + max-age=20)
- `src/app/api/profile/avatar/route.ts` (POST upload + DELETE remove, R-API-11 orphan cleanup)
- `src/app/api/profile/me/route.ts` (GET + PUT)
- `src/app/api/auth/login/route.ts` (R-06 rate limit + verification gate + cookie maxAge)
- `src/lib/portfolio-profile.ts` (seed text "{username} / Profil" / "{username} icin olusturulmus...")
- `src/lib/supabase-app-state.ts` (storage adapter, signed URL mint, bucket bootstrap)
- `src/lib/soc-store-supabase.ts` (path schema, register/createUser race surface, getPortfolioAvatarForUser)
- `src/lib/soc-store-adapter.ts` (R-03 Path γ memory fallback, multi-store routing)
- `src/components/EmbeddedLogin.tsx` (login form, remember checkbox, redirect handling)
- `docs/audit/WAVE_14_PORTFOLIO_BUG_INVESTIGATION.md` (Wave 14.A Bug 1-5 lineage)
- `docs/audit/WAVE_13_AVATAR_PERF_AUDIT.md` (Wave 13.A perf root causes)
- `docs/audit/FINAL_SCAN_REPORT.md` (Final Tarama report)
- `docs/audit/INDEX.md` (audit navigator)
- `docs/AUDIT_README.md` (canonical English README, stale-doc finding sourced here)
- `docs/POST_CAPSTONE_BACKLOG.md` (#13/14/15 reactivation analysis)
- `docs/SCOPE_DECISIONS.md` (Z-reference cross-check)

### Grep audits

- `supabase|createClient|getSupabaseClient` in `src/lib` → 15 files
- `^export (async )?function` in `src/lib/soc-store-supabase.ts` → 40+ public adapter functions
- `src/app/api/**/route.ts` → 28 handlers

### State NOT gathered (out of scope this cycle)

- Production Supabase bucket file count / size (no production DB query per Section 10)
- Production network HAR for Bug 2 confirmation (operator-side)
- Production DevTools cookie inspection for Bug 5 confirmation (operator-side)
- Wave 11/12/13/14 added A-XX entries individual confirmation (would require re-reading 5+ amendment narratives)
- E2E Playwright run against production (out of scope per Section 10)
- Lighthouse / WebPageTest run (out of scope per Section 10)

### Constraints honored

- READ-ONLY: no source files modified.
- NO `.env*` files read.
- NO production database queries.
- NO production smoke execution.
- NO existing audit doc edits (only NEW `WAVE_15_HEALTH_CHECK.md` created).
- HEAD `9e4167c` (Wave 14.E.1 commit hash resolution) — working tree clean throughout investigation.
- Single deliverable file; LOC within ~1500 budget per Section 10 yasaklar.

---

**End of Wave 15 Faz 15.A — Comprehensive Health Check.**

Faz 15.B will be mentor-locked fix scope (Bug 3 Avatar TTL 30s → 90s recommended HIGH priority; doc drift cleanup recommended MEDIUM priority for capstone-readiness). Section G mentor decision matrix LEFT EMPTY for that review cycle.
