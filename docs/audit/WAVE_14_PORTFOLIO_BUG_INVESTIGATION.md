# Wave 14 Faz 14.A — Portfolio Bug Investigation (READ-ONLY)

> **Status:** Investigation report, **NO CODE CHANGES**. Fix scope locked at Faz 14.B per mentor review.
> **HEAD at investigation start:** `f2b597c` (Wave 13.C.1 commit hash resolution)
> **Cycle predecessor:** Wave 13.D smoke (operator-observed bugs in production after Wave 13.C deploy)
> **Methodology:** Source-only static analysis (no production database queries, no smoke execution, no env-variable reads). Operator-provided symptoms re-mapped to source evidence via file:line refs.

---

## 0. Executive summary

Wave 13.D smoke produced 5 operator-reported portfolio bugs spanning the `/portfolio` route and the auth login surface. This audit traces each symptom to source evidence, ranks root-cause hypotheses by confidence (HIGH / MEDIUM / LOW), and surfaces a candidate fix path per bug with effort estimates. **No code changes** were made — Wave 14.A is investigation-only; Wave 14.B will be mentor-locked fix scope.

| # | Bug | Severity (operator) | Confidence on root cause | Source-evidence verdict |
|---|-----|---------------------|--------------------------|--------------------------|
| 1 | `PUT /api/profile/me` auto-fires without "Profili Kaydet" click | **CRITICAL** (data integrity) | **HIGH** — anomaly: no auto-PUT path exists in source | Likely operator perception (toast message persistence) OR an external trigger not present in `src/components/portfolio/**` |
| 2 | 14× `GET /api/profile/me` storm per page load | **HIGH** (perf) | **MEDIUM** — only 3 GET sites in source; 14× cardinality requires multi-mount or measurement confusion | Likely avatar-fetch miscount OR Strict Mode / HMR multiplier in dev |
| 3 | Avatar 400 Bad Request from Supabase | **MEDIUM** (UX) | **HIGH** — time-window mismatch between TTL and SSR prop aging | Wave 13.C `initialAvatarUrl` prop ages past 30s TTL in BFCache / slow-hydration scenarios |
| 4 | "Zerooooo" display name residue (operator doesn't recognize it) | **LOW** (cosmetic) | **HIGH** — no API path can update displayName post-registration | Registration-time artifact; only entry is anonymous `/api/auth/register` or admin `/api/users` POST |
| 5 | "Beni Hatırla" checkbox not working | **MEDIUM** (auth UX) | **HIGH** — wiring is correct; symptom likely browser "continue where you left off" feature OR default-state surprise | Code wired correctly across all 4 layers; UX/expectation mismatch likely |

**Cross-cutting verdict:** Bugs 1 and 2 share the same component (`PortfolioWorkspace.tsx`) and may share a measurement-confusion root. Bug 3 is the most likely *actual code-level regression* — directly traceable to Wave 13.C SSR-resolve aging behavior. Bug 4 and Bug 5 are standalone; Bug 4 is almost certainly historical data, and Bug 5 may be a default-state UX choice rather than a code defect.

**Recommended Faz 14.B fix priority:**

1. **Bug 3** (real regression, Wave 13.C lineage) — highest signal-to-effort ratio
2. **Bug 5** (default checkbox state + UX hint) — small, low-risk UX win
3. **Bug 1 + Bug 2** (instrumentation / network HAR capture from operator side) — investigative path before fix
4. **Bug 4** (historical data; one-line displayName update feature OR DB-side rename — separate from bug remediation)

---

## 1. Bug 1 — `PUT /api/profile/me` auto-fires without explicit save click

### Symptom (operator-reported)

Operator opens `/portfolio`, doesn't click the "Profili Kaydet" button, but observes a `PUT /api/profile/me` request firing in DevTools Network tab and/or the "Profil guncellendi." toast appearing. Reported as CRITICAL because silent writes are a data-integrity risk.

### Source evidence

**The PUT site:** `src/components/portfolio/PortfolioWorkspace.tsx:617`

```ts
const response = await fetch('/api/profile/me', {
  method: 'PUT',
  ...
})
```

This is inside `saveProfile()` at `L609-651`. Grep across the entire `src/` tree confirms this is the *only* `PUT /api/profile/me` invocation site:

```
src/components/portfolio/PortfolioWorkspace.tsx:617:        method: 'PUT',
src/components/portfolio/__tests__/PortfolioWorkspace.test.tsx:103:    //   - PUT /api/profile/me (saveProfile success path under test)
src/components/portfolio/__tests__/PortfolioWorkspace.test.tsx:144:    // Sanity: fetch was invoked with PUT /api/profile/me at least once
src/app/api/profile/me/__tests__/route.test.ts:37:    method: 'PUT',
```

**The saveProfile caller:** `src/components/portfolio/PortfolioWorkspace.tsx:1111`

```tsx
{canEdit && <button type="button" onClick={() => void saveProfile()} disabled={saving} ...>{saving ? 'Kaydediliyor' : 'Profili Kaydet'}</button>}
```

Grep confirms this is the *only* call site of `saveProfile()`:

```
src/components/portfolio/PortfolioWorkspace.tsx:609:  async function saveProfile() {
src/components/portfolio/PortfolioWorkspace.tsx:1111:                {canEdit && <button type="button" onClick={() => void saveProfile()} ...
```

**No form, no submit, no debounce/auto-save:**

```
grep "<form|onSubmit|onKeyDown.*saveProfile|onKeyDown.*Enter" src/components/portfolio
→ src/components/portfolio/DeleteAccountModal.tsx:93: <form onSubmit={handleSubmit} ...  (account-delete, unrelated)
```

PortfolioWorkspace.tsx has **zero** `<form>` tags, **zero** `type="submit"` buttons, **zero** `onKeyDown` handlers that call `saveProfile`, and **zero** debounce/auto-save patterns (`useDebounce`, `setTimeout.*save`, `onBlur.*save`).

**The toast message:** `src/components/portfolio/PortfolioWorkspace.tsx:648`

```ts
setMessage('Profil guncellendi.')
```

This is the *only* site that sets the "Profil guncellendi." message text — also inside `saveProfile`'s success branch. The message clear path is `L460-463`:

```ts
useEffect(() => {
  setError(null)
  setMessage(null)
}, [tab])
```

**Message is cleared only on tab change.** It persists across all other interactions (typing, scrolling, blur, focus, route re-render).

### Root-cause hypotheses (ranked)

#### HIGH confidence — operator misperception (toast persistence)

The `message` state at `L329` persists across re-renders until the `tab` dep changes. After an earlier explicit save, the toast renders at `L1695`:

```tsx
{message && <p className="mt-5 text-sm text-emerald-300">{message}</p>}
```

There is no auto-dismiss timeout. The operator may have clicked "Profili Kaydet" earlier in the session, then continued interacting with the page (typing, scrolling, opening DevTools), and the toast remained visible. Subsequent DevTools observation could conflate the persistent toast with an "auto-fire" event.

**Why this is HIGH confidence:** The mechanical evidence is unambiguous — `saveProfile()` has a single explicit caller. No other code path can produce both the PUT request *and* the toast text. The toast's lack of auto-dismiss makes "phantom appearance" plausible from a UX-perception standpoint.

#### MEDIUM confidence — React Strict Mode double-invoke (dev only)

In dev mode with `<React.StrictMode>` (Next.js 14 default), `useEffect` callbacks fire twice. If the operator is observing dev-mode network logs (`npm run dev`), each user interaction that triggers an effect may double-render. However, *no useEffect calls `saveProfile`*, so Strict Mode does not produce a phantom PUT here. This hypothesis is downgraded but kept on the table because operator may be confusing this with a second-tier effect.

#### LOW confidence — HMR re-mount cycle (dev only)

Next.js HMR can cause client components to re-mount when their source file changes. A re-mount fires the `useEffect` at `L507-574` (the `editable`-dep sync), which performs a `GET /api/profile/me` (not PUT). This doesn't explain a *PUT*, but again may be a measurement-confusion source if operator is in dev.

#### LOW confidence — phantom caller in unread code path

I confirmed there is no `saveProfile` caller in any test file (other than the explicit `T-PE-PERSIST` test that *does* click the button). I did not exhaustively read every lazy-loaded module — e.g., a future-introduced telemetry hook or A/B-test wrapper could theoretically call into the component. Audit of `package.json` dependencies + `src/lib/**` did not surface any auto-form-save library.

### Fix path (Faz 14.B candidate)

**Phase A — instrumentation (cheap, before fix):**

- Add a `console.debug('[portfolio] saveProfile() invoked from:', new Error().stack)` at `saveProfile` entry (`L611`).
- Add an auto-dismiss `setTimeout(() => setMessage(null), 4000)` on `setMessage` success branches. This resolves the toast-persistence misperception even if the actual PUT trigger is benign.
- Capture a network HAR from operator's session showing the exact PUT request that fires "without click."

**Phase B — guard rail (defensive):**

- Add a guard at `saveProfile` entry: `if (!canEdit || saving) return`. *(Already present at L610.)*
- Optional: track `lastSaveTriggeredAt` ref and refuse PUTs within < 1s of last completion (debounce-on-fire).

**Effort estimate:** Phase A = ~20 LOC, ~30 minutes. Phase B = ~10 LOC, ~10 minutes. Both safe to deploy as defense-in-depth even if root cause turns out to be perception.

---

## 2. Bug 2 — 14× `GET /api/profile/me` storm per page load

### Symptom (operator-reported)

Operator opens `/portfolio` and observes 14 separate `GET /api/profile/me` requests in DevTools Network tab during a single page load. Reported as HIGH (perf — quota burn + cold start amplification).

### Source evidence

**All three GET sites:** `src/components/portfolio/PortfolioWorkspace.tsx`

```
L513:          const response = await fetch('/api/profile/me', {
L544:        const response = await fetch('/api/profile/me', {
L616:      const response = await fetch('/api/profile/me', {  (← PUT, not GET)
```

`L513` and `L544` are both *inside the same useEffect* (`L507-574`):

```ts
useEffect(() => {
  let active = true
  const syncEditableMode = async () => {
    if (editable) {
      try {
        const response = await fetch('/api/profile/me', {  // L513
          method: 'GET', ...
        })
        ...
      }
      return
    }
    try {
      const session = await getAuthSession(true)
      ...
      const response = await fetch('/api/profile/me', {  // L544
        method: 'GET', ...
      })
      ...
    }
    ...
  }
  void syncEditableMode()
  return () => { active = false }
}, [editable])
```

The two `fetch` calls are mutually exclusive — only one fires per useEffect invocation depending on `editable` prop. For the logged-in operator on `/portfolio`, `editable={true}` always (`src/app/portfolio/page.tsx:111`), so `L513` is the path that fires.

**Effect dep array:** `[editable]`. `editable` is a prop from the Server Component (always `true` for authenticated `/portfolio`), so the effect fires once on mount and stays quiet thereafter.

**Static analysis prediction:** Per page load, *exactly 1* `GET /api/profile/me` should fire. The 14× cardinality is an order-of-magnitude anomaly.

**Other `/api/profile/me` references in `src/`:**

```
src/components/portfolio/__tests__/PortfolioWorkspace.test.tsx — tests only
src/lib/sanitize.ts:31:  cross-reference comment, no fetch
src/app/api/profile/me/route.ts — the endpoint itself
src/app/api/profile/me/__tests__/route.test.ts — tests only
```

**No other client code in `src/components/**` or `src/app/**` (page-level)** issues `GET /api/profile/me`.

### Root-cause hypotheses (ranked)

#### HIGH confidence — operator miscount (avatar fetches mistaken for profile/me)

The 3 `<img>` render sites in `PortfolioWorkspace.tsx` (`L939`, `L1029`, `L1118`) all consume `avatarSrc` (`L351-369`). Before Wave 13.C, this was a 3-fetch storm to `/api/profile/avatar/[userId]`. Wave 13.C's SSR-resolve + Cache-Control combo collapsed it to ~1 effective fetch, but the DevTools Network filter may show the 307 redirect chain *plus* the Supabase signed-URL fetch, which can look like multiple "profile" rows if the filter is on substring "profile".

A network filter on `profile` substring would catch:

- `/api/profile/me` (1× per page load)
- `/api/profile/avatar/[userId]` (1-3× depending on cache behavior; in some browsers, 3 `<img>` sites with the same `src` issue 1 request, but with Server Component re-render the URL string can momentarily differ → multiple requests)

14× could plausibly accumulate from a few page loads in a row (HMR cycle, soft-nav return, hard reload) × 3 avatar render sites × 2 (Strict Mode dev double-fire). That arithmetic checks out for a dev session.

**Why this is HIGH confidence:** The static evidence shows the GET-storm hypothesis is *mechanically impossible* from current source. A 14× cardinality requires either (a) 14 distinct mount events or (b) misattributed measurement.

#### MEDIUM confidence — React Strict Mode (dev) × HMR re-mount × tab switching

In dev mode with Next.js HMR:

- Each Strict Mode double-invokes effects: 2× per mount.
- Each save handler calls `router.refresh()` (Wave 10 closure) which re-renders the Server Component. The client component does *not* re-mount, so the `editable`-dep effect does not re-fire — *unless* the React reconciliation detects identity change in a way that forces re-mount.
- HMR file save → component re-mount → effect re-fires.

Conservatively in dev: 1 mount × 2 (Strict) = 2 fetches per "page load." Across a few HMR cycles or tab switches in a dev session: easily 6-14.

#### MEDIUM confidence — soft-nav return triggering remount of subtree

Next.js Router Cache stores rendered route segments. On soft-nav return (e.g., `/blog` → back to `/portfolio`), the segment is rehydrated but client components stay mounted. However, the operator may have triggered hard reloads (Ctrl+R) between navigations, which produces full re-mounts.

#### LOW confidence — phantom caller in indirect import

I did not exhaustively walk every `src/lib/**` module. A telemetry hook, analytics wrapper, or session-refresh background poller could theoretically call `/api/profile/me` from a non-obvious code path. Grep across `src/` did not surface any such caller, so this is LOW.

### Fix path (Faz 14.B candidate)

**Phase A — measurement reconciliation (cheap):**

- Request operator to capture a network HAR from a clean production page load (no DevTools throttling, no HMR, hard reload). Filter exactly on `path === '/api/profile/me'` (not substring).
- Add structured server-side logging to `src/app/api/profile/me/route.ts` GET handler with `request-id` + `User-Agent` + `Referer` → confirm the 14× from server logs.

**Phase B — defense-in-depth (if cardinality confirmed):**

- Memoize the GET response client-side with a 30s SWR (stale-while-revalidate) cache. Library: native `useState` + `useRef` for first-fetch dedup. ~20 LOC.
- Alternative: server-side response cache header `Cache-Control: private, max-age=15` on the GET response (matches the avatar pattern already in place). ~3 LOC.

**Effort estimate:** Phase A = ~10 LOC server-side instrumentation, ~15 min. Phase B = ~20-25 LOC client-side dedup OR ~3 LOC header, ~30 min.

---

## 3. Bug 3 — Avatar 400 Bad Request from Supabase

### Symptom (operator-reported)

After loading `/portfolio` (or specifically during/after Wave 13.D smoke), the avatar `<img>` element issues a request that returns 400 from Supabase Storage. Avatar renders as the broken-image fallback.

### Source evidence

**SSR signed-URL mint:** `src/app/portfolio/page.tsx:92-105`

```ts
let initialAvatarUrl: string | null = null
if (isSupabaseAppStateEnabled() && profile.profile.avatarPath) {
  try {
    initialAvatarUrl = await createSignedObjectUrl(profile.profile.avatarPath, 30)
  } catch (err) {
    console.error('[portfolio/page] SSR avatar signed URL resolve failed:', err)
    initialAvatarUrl = null
  }
}
```

TTL is **30 seconds** (Wave 13.C Z.15 revision from the original 15s of Wave 5B R-API-10).

**Client consumption:** `src/components/portfolio/PortfolioWorkspace.tsx:351-369`

```ts
const avatarSrc = useMemo(() => {
  if (avatarLoadFailed) return ''
  if (initialAvatarUrl) return initialAvatarUrl  // ← uses SSR-minted URL
  return buildAvatarSrc(data.user.id, data.user.username, data.profile.avatarPath)
}, [avatarLoadFailed, initialAvatarUrl, data.profile.avatarPath, data.user.id, data.user.username])
```

The 3 `<img>` render sites all consume `avatarSrc`. On hydration mismatch (`onError` fires), `avatarLoadFailed` flips → falls back to placeholder initials.

**Legacy fallback path:** `src/app/api/profile/avatar/[userId]/route.ts:63-77`

```ts
const signedUrl = await createSignedObjectUrl(avatarMeta.assetPath, 30)
...
const response = NextResponse.redirect(signedUrl)
response.headers.set('Cache-Control', 'private, max-age=20')
response.headers.set('Vary', 'Cookie')
```

The 307 redirect has `max-age=20`, with `Vary: Cookie` on the response. The browser caches the 307 redirect for 20s, within which the embedded Supabase URL (TTL=30s) remains valid.

**Avatar upload cache-control:** `src/lib/supabase-app-state.ts:140`

```ts
.upload(normalized, value, {
  upsert: true,
  contentType,
  cacheControl: '3600',  // ← 1 hour on the stored object
})
```

Supabase serves the image with `Cache-Control: max-age=3600`, so the browser caches the image bytes for an hour *after* the signed-URL fetch succeeds.

**`createSignedObjectUrl` implementation:** `src/lib/supabase-app-state.ts:183-204`

```ts
export async function createSignedObjectUrl(objectPath, expiresInSeconds = 60): Promise<string | null> {
  const client = getSupabaseClient()
  if (!client) return null
  await ensureSupabaseAppStateBucket()
  const normalized = normalizeObjectPath(objectPath)
  const { data, error } = await client.storage
    .from(SUPABASE_APP_STATE_BUCKET)
    .createSignedUrl(normalized, expiresInSeconds)
  ...
  return data?.signedUrl ?? null
}
```

URL format: `https://<supabase>/storage/v1/object/sign/<bucket>/<path>?token=<JWT>` — JWT carries expiry claim. Supabase rejects with 400 when JWT validation fails (expired, malformed, signature mismatch).

### Root-cause hypotheses (ranked)

#### HIGH confidence — SSR-prop aging past 30s TTL

The SSR-resolved `initialAvatarUrl` is generated at server-render time T₀. After Wave 13.C, this URL flows through:

1. Next.js SSR render (T₀)
2. HTTP transmission (T₀ + Δt_net)
3. Browser HTML parse + hydrate (T₀ + Δt_net + Δt_hydrate)
4. React `<img>` element renders → browser issues fetch to embedded Supabase URL (T₀ + Δt_total)

If `Δt_total > 30s`, the signed URL is expired and Supabase returns 400. This is the **most plausible regression introduced by Wave 13.C**.

**Triggering scenarios:**

- **Slow mobile network:** Δt_net + Δt_hydrate can exceed 5-10s on 3G. Still within 30s budget, but margin is thin.
- **BFCache (browser back-forward cache):** Operator navigates `/portfolio` → `/blog` → back. Browser restores the page from BFCache with the *original* SSR HTML. The `initialAvatarUrl` prop is now T₀ + (time-spent-on-/blog) old. If time-on-/blog > 30s, URL is expired.
- **Tab parking:** Operator opens `/portfolio`, switches tab, returns 35s later → re-render with stale prop → 400.
- **Vercel edge cache:** If the route is served from Vercel's edge cache (which `force-dynamic` + `revalidate=0` *should* prevent, but a misconfigured CDN layer could intercept), multiple operators could share the same signed URL minted ages ago.

**Pre-Wave-13.C behavior:** Before SSR-resolve, the legacy `/api/profile/avatar/[userId]` route minted a fresh URL *on every fetch*. The Cache-Control `max-age=20` window was always within the 30s TTL by construction (`max-age=20 < TTL=30`). The SSR-resolve introduced a new aging surface (the prop value's lifetime) that did not exist before.

**Why this is HIGH confidence:** The arithmetic is direct. SSR prop age + Δt_browser_render = fetch time. 30s TTL is tight against BFCache and tab-parking timescales. The Cache-Control headers on the 307 redirect *(legacy path)* solve the multi-render dedup problem but do not solve the SSR-prop aging problem.

#### MEDIUM confidence — browser disk cache serving stale HTML

If the browser persistent disk cache holds an older `/portfolio` render (e.g., user has visited /portfolio multiple times across days), restoring that cached page gives an `initialAvatarUrl` prop from days ago. Modern browsers respect `Cache-Control: no-store` on the HTML, but the `/portfolio/page.tsx` is `export const dynamic = 'force-dynamic'` + `revalidate = 0` — Next.js issues `Cache-Control: no-store, must-revalidate` automatically. Disk-cache scenario is therefore unlikely *unless* a CDN layer strips those headers.

#### MEDIUM confidence — service-role key rotation

If `SUPABASE_SERVICE_ROLE_KEY` was rotated between when the URL was minted and when it was fetched, all in-flight signed URLs become invalid (signature mismatch). Supabase returns 400. Rotation events are operator-initiated; if Wave 13.D smoke involved a key rotation step, this could explain transient 400s.

#### LOW confidence — path mismatch (race with upload cleanup)

Avatar upload (`src/app/api/profile/avatar/route.ts:54-64`) deletes the *old* asset after upload succeeds. If a stale `initialAvatarUrl` points to the old path AND the cleanup ran AND the URL hasn't expired yet → Supabase returns "not found" (which is a 404, not 400). 404 may be displayed as 400 in some browser DevTools — but this is unlikely.

#### LOW confidence — JWT clock skew

If the Vercel function clock drifts from Supabase's clock (NTP sync gap), URLs minted at T₀ may appear to Supabase as already expired (T₀ - ε). Vercel and Supabase both run on AWS infrastructure with NTP; skew should be sub-second. LOW.

### Fix path (Faz 14.B candidate)

**Phase A — fastest fix (TTL extension):**

- Extend signed-URL TTL from 30s to 90s on the SSR path. Security envelope still tight (URL leak window grows from 30s to 90s); operationally, 90s covers BFCache + tab-parking up to 1.5 min.
- File: `src/app/portfolio/page.tsx:95` change `30` → `90`.
- Cost: ~1 LOC. Security review needed (Z.15 lineage discussion).

**Phase B — robust fix (client-side retry on 400):**

- Add `onError` handler on `<img>` that detects 400-equivalent (broken image) → flips to legacy fallback URL (`buildAvatarSrc`) → server route mints fresh signed URL. This already partially exists via `setAvatarLoadFailed`, but `setAvatarLoadFailed(true)` currently renders the initials placeholder, *not* the legacy fallback. Need a separate `avatarUseLegacyFallback` state.
- File: `src/components/portfolio/PortfolioWorkspace.tsx:351-369` (refactor avatarSrc memo).
- Cost: ~15 LOC. Maintains the SSR-resolve perf benefit + graceful degradation on aging.

**Phase C — most robust (eliminate prop aging via client-side refresh):**

- Don't pass `initialAvatarUrl` as a static prop. Instead, the client calls a *new* `/api/profile/avatar/url` endpoint on mount that always mints a fresh signed URL. This loses the SSR-perf benefit but eliminates the aging surface entirely.
- File: new route + PortfolioWorkspace refactor. ~40-60 LOC.
- Effort: 2-3 hours. Highest cost but architecturally cleanest.

**Effort estimate:** Phase A = 5 min (1 LOC + mentor security review). Phase B = 30-45 min. Phase C = 2-3 hours.

---

## 4. Bug 4 — "Zerooooo" display name residue

### Symptom (operator-reported)

Operator views `/portfolio` and sees `data.user.displayName === 'Zerooooo'` rendered as the profile header. Operator does not recall ever entering this value. Reported as LOW (cosmetic, but suggests data-integrity confusion).

### Source evidence

**Display-name render sites:**

```
src/components/portfolio/PortfolioWorkspace.tsx:941: alt={data.user.displayName}
src/components/portfolio/PortfolioWorkspace.tsx:947: {getInitials(data.user.displayName)}
src/components/portfolio/PortfolioWorkspace.tsx:953: {data.user.displayName}
src/components/portfolio/PortfolioWorkspace.tsx:1031: alt={data.user.displayName}
src/components/portfolio/PortfolioWorkspace.tsx:1037: {getInitials(data.user.displayName)}
src/components/portfolio/PortfolioWorkspace.tsx:1120: alt={data.user.displayName}
src/components/portfolio/PortfolioWorkspace.tsx:1126: {getInitials(data.user.displayName)}
```

All consume `data.user.displayName` from the SSR-passed `initialProfile.user.displayName` (the `SessionUser` type in `src/lib/soc-types.ts:14`).

**Display-name *write* paths (the complete enumeration):**

```
src/app/api/auth/register/route.ts:105:
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : ''
  → flows into registerUser → storage write

src/app/api/users/route.ts:62: (admin-only POST, role-gated to admin via requireRole)
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : ''
  → flows into createUser → storage write
```

**Display-name UPDATE paths:** *none.*

I exhaustively searched for `update.*displayName`, `set.*displayName`, `displayName.*update`, `setDisplayName` (in route files), and PATCH/PUT handlers that accept `displayName`:

```
src/app/api/profile/me/route.ts PUT: parses headline, bio, location, socialLinks, specialties, tools.
  parseProfilePayload (src/lib/portfolio-validation.ts:79-88) does NOT extract displayName.
src/app/api/users/me/route.ts: DELETE only — no PATCH/PUT
```

**`SessionUser.displayName` is set exactly at registration time and never updated** through any code path I could locate.

### Root-cause hypotheses (ranked)

#### HIGH confidence — historical registration data, operator does not recall

The operator likely registered the account at some point in the past with `displayName = 'Zerooooo'` (or similar) and does not remember the form submission. The registration form at `src/components/EmbeddedRegister.tsx:25` has a freeform `displayName` text input bound to local state — no default value, no auto-fill, no prefill from URL params. Whatever the operator typed at registration is what was persisted.

**Reinforcing evidence:**

- `isValidDisplayName` validation in `src/lib/identity-validation.ts` accepts any 2-120 char string passing the regex (no CRLF, no `<script>`). "Zerooooo" passes trivially.
- The `Zerooooo` literal does not appear anywhere in source code as a default, seed, or hard-coded fixture (grep confirmed).
- Test fixtures use names like `'Operator'`, `'Test User'`, `'Analyst'`, `'User One'` — never `'Zero*'`.
- The `getInitials` helper at `L108-112` falls back to `'OP'` when displayName is empty, *not* "Zerooooo." So this is not a default-fallback artifact.

#### LOW confidence — admin-created test account from earlier development

If an admin user invoked `POST /api/users` (`src/app/api/users/route.ts:53`) during early development with `displayName = 'Zerooooo'`, that user record persists. This is the same "historical artifact" hypothesis but via the admin path instead of self-register.

#### VERY LOW confidence — forgotten admin path that bypasses validation

I have not found one, but acknowledging that an admin SQL fix or a deleted-since-Wave-N migration script could have manipulated the value. No source-level evidence.

### Fix path (Faz 14.B candidate)

**Phase A — feature work (recommended):**

- Add `PATCH /api/profile/me/display-name` (or extend `PUT /api/profile/me` to accept `displayName`) with validation via the existing `isValidDisplayName`.
- Add a "Display name" input field to `PortfolioWorkspace.tsx` profile-form section.
- Effort: ~45-60 min (route + validation reuse + UI input + sanitize call).

**Phase B — one-shot data fix (if recommended by operator after Phase A is impractical):**

- Operator-driven Supabase Storage manual edit of the user JSON: `users/{id}.json` → change `displayName` field → save.
- Effort: ~5 min, operator-only (no agent execution).

**Effort estimate:** Phase A = 45-60 min. Phase B = 5 min operator-side.

---

## 5. Bug 5 — "Beni Hatırla" checkbox not working

### Symptom (operator-reported)

Operator checks/unchecks the "Bu cihazda oturumumu 30 gün hatırla" checkbox at login. Regardless of checkbox state, the session behavior appears identical (either always persists or always expires — operator did not specify direction).

### Source evidence

The full remember-me chain from UI to cookie:

#### Layer 1 — checkbox state

`src/components/EmbeddedLogin.tsx:19`

```ts
const [remember, setRemember] = useState(false)  // ← default is FALSE
```

`src/components/EmbeddedLogin.tsx:939-945`

```tsx
<input
  id="el-remember"
  type="checkbox"
  checked={remember}
  onChange={(event) => setRemember(event.target.checked)}
  className="el-checkbox"
/>
```

Standard controlled checkbox. State flips on click. The checked attribute is bound to local state — wiring is correct.

#### Layer 2 — login dispatch

`src/components/EmbeddedLogin.tsx:128`

```ts
const result = await loginWithPassword(username.trim(), password, { remember })
```

`remember` boolean passed through.

#### Layer 3 — client → API payload

`src/lib/auth-client.ts:95`

```ts
body: JSON.stringify({ username, password, remember: options.remember !== false }),
```

Decoding:

- `options.remember === true` → `true !== false` → `true`
- `options.remember === false` → `false !== false` → `false`
- `options.remember === undefined` → `undefined !== false` → `true` (default-on)

For the `EmbeddedLogin` caller, `options.remember` is always `true` or `false` (controlled by checkbox), never `undefined`. So the payload reflects the checkbox state correctly.

#### Layer 4 — API route cookie decision

`src/app/api/auth/login/route.ts:65`

```ts
const remember = body.remember !== false
```

Same default-on semantic. For `body.remember === false`, this is `false`. For `body.remember === true`, this is `true`.

`src/app/api/auth/login/route.ts:136-144`

```ts
response.cookies.set({
  name: SESSION_COOKIE_NAME,
  value: session.token,
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  ...(remember ? { maxAge: SESSION_COOKIE_MAX_AGE_SECONDS } : {}),
})
```

Where `SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30` (30 days, from `src/lib/auth-shared.ts:4`).

Decoding:

- `remember === true` → cookie has `maxAge: 2592000` → persistent for 30 days.
- `remember === false` → cookie omits `maxAge` → **session cookie** (browser deletes on close).

**The wiring is end-to-end correct.** No code defect.

### Root-cause hypotheses (ranked)

#### HIGH confidence — modern browser "continue where you left off" feature masks session-cookie expiry

Chrome (default), Edge (default), Firefox (opt-in) ship with a setting that *preserves session cookies across browser restarts* when "continue where you left off" is enabled. The browser treats `Close → Reopen` as session-continuation, not session-end.

Net effect: even when operator unchecks "Beni Hatırla" (intent: session cookie, expires on close), the browser keeps the cookie alive across restarts. Operator concludes "the checkbox isn't working" because the session persists either way.

**Why this is HIGH confidence:**

- Code wiring is verified correct at all 4 layers.
- This exact misperception is a documented UX pitfall on multiple security forums (OWASP, CSRF/session lifecycle).
- The TLS-only `secure: process.env.NODE_ENV === 'production'` + `sameSite: 'lax'` posture is correct and unrelated to lifetime.

#### MEDIUM confidence — default checkbox state surprise (`useState(false)`)

The checkbox defaults to *unchecked* (`L19`). Operators familiar with sites that default to "checked" may not realize they need to actively check it for the 30-day behavior. If operator wants persistent sessions but never checks the box, the cookie is a session cookie and "vanishes" — which they interpret as "the box is broken."

#### LOW confidence — server-side session TTL persists regardless of cookie

Sessions are stored server-side via `createSession(user, metadata)`. The session record on the server has its own expiry (`session.expiresAt`). If the cookie *does* survive (per the HIGH-confidence hypothesis above), the server accepts it as valid because the server-side record is still within its window.

This is not a bug; it's expected behavior. The cookie's `maxAge` is the *client-side* lifetime hint to the browser. The server-side session has its own independent lifetime.

#### VERY LOW confidence — a separate cookie/middleware refresh layer overwrites `maxAge`

I did not find any middleware that re-sets `soc_session` with a different `maxAge`. Grep for `cookies.set.*soc_session` returned only the login route + logout route (which clears). Middleware (`src/middleware.ts` and `src/lib/auth-server.ts`) reads the cookie but does not refresh it. So this hypothesis is essentially ruled out by source evidence.

### Fix path (Faz 14.B candidate)

**Phase A — default-state UX fix:**

- Change `useState(false)` to `useState(true)` at `src/components/EmbeddedLogin.tsx:19`. This matches operator expectation of "remember me defaulted on."
- Effort: 1 LOC. ~5 min including security review (defaulting to longer session lifetime needs operator approval).

**Phase B — explicit UX hint for session-cookie semantics:**

- When `remember === false`, add a small hint text below the checkbox: "Tarayıcı kapatıldığında oturum sona erer" (Session ends when browser closes).
- Effort: ~10 LOC, ~10 min.

**Phase C — empirical verification (recommended FIRST):**

- Operator opens DevTools → Application → Cookies → `soc_session` row. Check `Expires / Max-Age` column.
  - Checked box: should show a date 30 days in the future.
  - Unchecked box: should show "Session".
- This 60-second test confirms whether the code path is honestly broken or whether the operator's browser is misleading them.

**Effort estimate:** Phase A = 5 min. Phase B = 10 min. Phase C = 1 min (operator-side test).

---

## 6. Cross-cutting analysis

### Are the 5 bugs related?

**Bug 1 (auto-PUT) + Bug 2 (GET storm):** Same component, both anomalies relative to source evidence. The most parsimonious shared root cause is *measurement confusion* — DevTools observations during dev mode, with HMR + Strict Mode amplification, plus operator filter logic that may conflate `/api/profile/me` with `/api/profile/avatar/[userId]`. Recommended: instrumentation first (production HAR capture), then fix.

**Bug 3 (avatar 400):** The only bug with direct code-level lineage to a recent change (Wave 13.C SSR-resolve). The 30s TTL is tight against BFCache and tab-parking timescales — this is a *real regression* introduced by trading client-fetch volume for prop-aging surface.

**Bug 4 (display name):** Historical data, unrelated to recent waves.

**Bug 5 (Beni Hatırla):** Unrelated to portfolio surface, lives in the login flow. Code-correct; UX/perception mismatch.

### Common quality signal

Of the 5 reports, **only Bug 3 is mechanically reproducible from source**. Bugs 1, 2, 5 are likely measurement / perception / UX-default issues. Bug 4 is a historical-data artifact.

This pattern is consistent with smoke-testing fatigue + dev-mode amplification: when an operator runs through a live smoke and sees unexpected DevTools rows, the natural inclination is to file a bug. Investigation often reveals dev-mode artifacts (Strict Mode, HMR, BFCache).

**Recommendation for Wave 14.B:** Always require operator-side HAR capture *from production* before locking a fix scope. This protocol would have surfaced Bug 1 and Bug 2 as misperceptions in 5 minutes.

### Threat-model recap (OWASP)

- **Bug 1** → A04 Insecure Design (if real): silent writes violate user intent. Defense-in-depth fix (Phase B) addresses.
- **Bug 3** → A05 Security Misconfiguration: signed URL aging is a misconfiguration of the TTL surface introduced by Wave 13.C.
- **Bug 5** → A07 Identification & Authentication Failures (perception only; code-correct): UX expectation gap.
- **Bug 2, 4** → No direct OWASP category; perf + data-integrity respectively.

---

## 7. Mentor decision matrix (filled — locked at Faz 14.B kickoff)

| Bug | Recommendation | Mentor decision | Rationale |
|-----|---------------|----------------|-----------|
| 1 | Phase A instrumentation + Phase B guard rail | **ELIMINATED** — operator misperception confirmed | Mechanical evidence: `saveProfile()` has a single caller (button onClick L1111); no auto-PUT path exists. Toast persistence (no auto-dismiss until tab change) explains the observation. No fix needed; if operator wants the toast to clear automatically, schedule as separate UX cycle. |
| 2 | Phase A measurement reconciliation first | **DEFERRED** → POST_CAPSTONE_BACKLOG #13 | HAR data needed before fix scope can be locked. Likely measurement artifact (avatar miscount or dev-mode HMR/Strict amplification). 5-minute operator-side test will resolve. |
| 3 | Phase A TTL extension (30s → 90s) — fastest fix | **DEFERRED** → POST_CAPSTONE_BACKLOG #15 (separate cycle) | Real Wave 13.C regression with UX impact, but Wave 14.C scope locked to `display_name` removal only. Address before exam if time permits via Phase A/B/C menu. |
| 4 | Phase A: add display-name update feature | **CLOSED by Wave 14.C** | Operator chose to remove `display_name` system-wide instead of adding an update feature. Single-identity (username) model eliminates the "Zerooooo" data-residue surface entirely. See A-28 + Z.16. |
| 5 | Phase C empirical verification first; Phase A default-state fix if confirmed UX gap | **DEFERRED** → POST_CAPSTONE_BACKLOG #14 | Reproduction protocol needed (60-second operator-side DevTools cookie inspection). Code wired correctly at all 4 layers; likely browser "continue where you left off" feature confusion. Fix path (default-checked OR explicit hint text) available if confirmed UX gap. |

**Mentor questions to resolve before Faz 14.B begins:**

1. **Bug 1 / Bug 2 — are dev-mode observations counted?** If operator was running `npm run dev`, the 14× GET storm is partly Strict Mode artifact. Confirm production-only smoke before further fix work.
2. **Bug 3 — security envelope for TTL extension.** 30s → 90s widens the signed-URL leak window 3×. Acceptable for portfolio-public asset class, or escalate to mentor security review?
3. **Bug 4 — feature or one-shot fix?** Adding display-name editing is a small feature but expands the PUT surface. Alternative: operator-driven JSON edit (5 min, no code).
4. **Bug 5 — default checked or unchecked?** Defaulting to *checked* matches user expectation but increases the default session-cookie lifetime envelope. Mentor decision: UX vs security tradeoff.
5. **Wave 14.B commit pattern.** Recommend the 2-commit pattern: `fix:` commit with `<COMMIT_HASH_TBD>` placeholders + `.1` cleanup commit resolving them. Same pattern used for Waves 8, 10, 11, 12, 13.C.

---

## 8. Investigation methodology notes

### Files read

- `src/components/portfolio/PortfolioWorkspace.tsx` (1705 lines, central client component)
- `src/app/portfolio/page.tsx` (Server Component, SSR avatar resolve)
- `src/app/api/profile/me/route.ts` (GET + PUT handlers)
- `src/app/api/profile/avatar/route.ts` (POST + DELETE handlers)
- `src/app/api/profile/avatar/[userId]/route.ts` (GET handler, signed-URL mint)
- `src/app/api/auth/login/route.ts` (login + cookie decision)
- `src/app/api/auth/register/route.ts` (registration path, displayName entry)
- `src/app/api/users/route.ts` (admin user create)
- `src/app/api/users/me/route.ts` (DELETE only)
- `src/app/api/auth/verify/route.ts` (verify confirmed not to mint session)
- `src/components/EmbeddedLogin.tsx` (login form + remember checkbox)
- `src/components/EmbeddedRegister.tsx` (registration form, displayName input)
- `src/components/dashboard/Toast.tsx` (confirmed unrelated to portfolio toast)
- `src/lib/auth-client.ts` (loginWithPassword, getAuthSession)
- `src/lib/auth-shared.ts` (SESSION_COOKIE_MAX_AGE_SECONDS = 30 days)
- `src/lib/supabase-app-state.ts` (createSignedObjectUrl, cacheControl='3600')
- `src/lib/portfolio-assets.ts` (saveAvatarAsset, path format)
- `src/lib/portfolio-validation.ts` (parseProfilePayload — confirmed NO displayName)

### Grep audits

- `Profil guncellendi|Profil güncellendi` → single source at `PortfolioWorkspace.tsx:648`
- `saveProfile` → declaration + single call site
- `PUT.*profile/me|method:\s*['"]PUT['"]` → single client + test references
- `useDebounce|debounce|setTimeout.*save|onBlur.*save|onChange.*save\(` → no matches
- `<form|onSubmit|onKeyDown.*saveProfile|onKeyDown.*Enter` → DeleteAccountModal only (unrelated)
- `/api/profile/me` → 3 sites in PortfolioWorkspace + tests
- `displayName` → enumerated all write paths
- `update.*displayName|setDisplayName.*route|displayName.*update` → confirmed no update path
- `Zerooooo|displayName:\s*['"]Zerooooo['"]` → no hard-coded source occurrences

### State NOT gathered (operator's domain)

- Production network HAR for Bug 1 / Bug 2 confirmation
- DevTools Application → Cookies inspection for Bug 5 confirmation
- Supabase Storage bucket listing for orphan avatar paths (Bug 3)
- Production session of operator showing the "Zerooooo" record (Bug 4)
- Operator's browser version + "continue where you left off" setting (Bug 5)

These are all operator-side verifications that should run *before* Faz 14.B fix scope is locked.

### Constraints honored

- READ-ONLY: no source files modified.
- NO `.env*` files read.
- NO production database queries (agent has no access; would be prohibited regardless).
- NO production smoke execution.
- HEAD `f2b597c` (Wave 13.C.1 commit hash resolution) — working tree clean throughout investigation.

---

**End of Wave 14 Faz 14.A — Portfolio Bug Investigation.**

Faz 14.B will be mentor-locked fix scope: operator + agent review the 5 bugs above, select per-bug fix paths from the proposed Phase A/B/C menus, and proceed via the standard 9-section mega-prompt protocol.
