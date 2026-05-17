# Wave 13 Faz 13.A — Avatar Performance Audit

**Date:** 2026-05-17 · **Pre-audit HEAD:** `91006e7` (Wave 12.1 cleanup) · **Vitest baseline:** 541 / 64 files · **Lint:** 0E / 0W · **TSC:** clean · **Build:** clean

Read-only inspection cycle. **NO code/test changes.** Investigates operator-reported avatar performance issue (3 duplicate fetches + 307 redirect chain ~700-1100ms each + ~3.6s wall time per `/portfolio` page load). Methodology: 6-layer audit (source render tree → API timing → Supabase signed URL → cache headers → bundle → network behavior synthesis).

**Methodology mode:** Option 3 (source-only analysis) per mentor preference. Operator pre-supplied production network evidence; local dev cold-start latency would not represent Vercel production behavior. Live curl probes against `/api/profile/avatar/<userId>` deferred — source code analysis yields ≥80% of findings; remaining 20% (real latency numbers, Supabase RTT) sourced from operator screenshot + Supabase JS SDK documented behavior.

---

## Executive summary

| Metric | Value |
|---|---|
| Total findings (F-AV-NN) | **7** |
| **CRITICAL** | 1 |
| **HIGH** | 2 |
| **MEDIUM** | 2 |
| **LOW** | 2 |
| Root cause class | Triple-fetch storm from 3 unsynchronized render sites + zero browser cache (no Cache-Control on 307 redirect) + Supabase signed URL minted per request |
| Recommended fix path (agent view) | **Path B (targeted)** — Server Component prop-drilling + Cache-Control header. Eliminates 3 client fetches → 0; marginal cost; reverses ~3.6s flow to single SSR-resolved render. |

**Root cause hypothesis (top 3 ranked, all supported by source evidence):**

1. **PRIMARY:** `PortfolioWorkspace.tsx` renders the avatar in **3 distinct `<img>` sites** (L905, L995, L1085 — header thumbnail + edit-side preview + read-side preview), all sourcing the same `avatarSrc` memo URL. Because the `/api/profile/avatar/[userId]` 307 response carries **NO `Cache-Control` header**, the browser cannot dedupe these 3 image-load attempts at the HTTP cache layer. Each fires an independent fetch chain.
2. **CONTRIBUTING:** Each `/api/profile/avatar/[userId]` GET invokes `getPortfolioAvatarForUser(userId)` (Supabase Storage JSON read, ~100-300ms) + `createSignedObjectUrl(path, 15)` (Supabase Storage signed URL API roundtrip, ~200-500ms). 3 sites × ~310-855ms each ≈ ~930-2565ms cumulative server time, matching operator's 737-1150ms per-redirect observation. The 307 redirect destination URLs are **unique per request** (signed URLs carry a fresh JWT each time), so even the destination jpegs cannot dedupe at the browser image cache.
3. **AMPLIFYING:** `export const dynamic = 'force-dynamic'` on the avatar GET route opts out of Next.js Data Cache + Full Route Cache, ensuring every browser request hits the API handler all the way through. The 15s TTL (R-API-10 closure, Wave 5B) does not require force-dynamic to enforce — Next.js cache layers would honor any short max-age the route declares.

---

## Layer 1 — Source render tree map

### Avatar component inventory

**Render sites in `src/components/portfolio/PortfolioWorkspace.tsx`:** exactly 3, all `<img>` elements consuming the same `avatarSrc` memo string.

| # | File:Line | Container size | Render gate | Visibility |
|---|---|---|---|---|
| **Site 1** | `PortfolioWorkspace.tsx:905` | `h-16 w-16` (64×64px) | always rendered | header route-panel thumbnail; visible on every tab |
| **Site 2** | `PortfolioWorkspace.tsx:995` | `h-24 w-24` (96×96px) | `tab === 'profile'` only | edit-side upload form preview |
| **Site 3** | `PortfolioWorkspace.tsx:1085` | `h-20 w-20` (80×80px) | `tab === 'profile'` only | read-side preview card |

All 3 sites share the **identical** `avatarSrc` URL string produced by the `useMemo` at L332-334:

```ts
// L332-334 PortfolioWorkspace.tsx
const avatarSrc = useMemo(
  () => (avatarLoadFailed ? '' : buildAvatarSrc(data.user.id, data.user.username, data.profile.avatarPath)),
  [avatarLoadFailed, data.profile.avatarPath, data.user.id, data.user.username],
)
```

And `buildAvatarSrc` at L91-94:

```ts
// L91-94 PortfolioWorkspace.tsx
function buildAvatarSrc(userId: number, username: string, avatarPath: string | null | undefined) {
  if (avatarPath) {
    return `/api/profile/avatar/${userId}?v=${encodeURIComponent(avatarPath)}`
  }
  return ''
}
```

**Key observation:** all 3 sites pass the same memoized string to `<img src={avatarSrc}>`. In an ideal world the browser deduplicates 3 identical-URL image loads into 1 actual fetch. In practice (operator's DevTools screenshot), the browser performs 3 separate fetch chains. The reason is in Layer 4 (cache headers).

Other avatar references (NOT render sites, but data-flow consumers):
- `PortfolioWorkspace.tsx:124-126` — `shouldKeepLocalProfile` checks `avatarPath` to decide between local + incoming profile state
- `PortfolioWorkspace.tsx:433` — `useEffect([data.profile.avatarPath])` — reset avatarLoadFailed flag on avatar change
- `PortfolioWorkspace.tsx:608` — `setData` after profile save merges `avatarPath`
- `PortfolioWorkspace.tsx:653, 1024-1026` — `data.profile.avatarPath` gates upload/remove buttons

**Unrelated `<img>` site:** `PortfolioWorkspace.tsx:136` — `CertificationPreview` component renders certification asset images (NOT avatar). Different code path, different signed URL endpoint (`/api/profile/certifications/assets/[id]`).

### Render tree

```
/portfolio (Server Component, force-dynamic, revalidate=0)
  └─ <PortfolioWorkspace initialProfile editable> ('use client')
      ├─ useState(initialProfile) — data state
      ├─ useMemo avatarSrc — derived from data.profile.avatarPath
      ├─ useEffect([editable]) — auto-syncs /api/profile/me on mount (Layer 4 contributing factor)
      │
      ├─ Header route-panel
      │   └─ <img src={avatarSrc} /> ← SITE 1 (h-16 w-16, always)
      │
      └─ tab === 'profile' && (
          ├─ Edit-side form
          │   └─ Upload preview wrap
          │       └─ <img src={avatarSrc} /> ← SITE 2 (h-24 w-24, conditional)
          │
          └─ Read-side preview card
              └─ <img src={avatarSrc} /> ← SITE 3 (h-20 w-20, conditional)
        )
```

On the default `tab='profile'` view (which is the landing tab when a user opens `/portfolio`), all 3 sites mount concurrently in the same React render.

---

## Layer 2 — API route timing (source analysis)

### `/api/profile/avatar/[userId]/route.ts` GET handler

```ts
// L9-10
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'  // ← Layer 4 finding F-AV-03

// L16-79 (abbreviated)
export async function GET(request, context) {
  const guard = await requireSession(request)            // ~5-50ms
  // ...
  const userId = parseUserId(params.userId)
  // ...
  const avatarMeta = isSupabaseAppStateEnabled()
    ? await supabaseStore.getPortfolioAvatarForUser(userId)  // ~100-300ms (Supabase JSON read)
    : localProfile?.profile.avatarPath ? { ... } : null

  if (isSupabaseAppStateEnabled()) {
    // R-API-10 closure (Wave 5B): TTL 15s
    const signedUrl = await createSignedObjectUrl(avatarMeta.assetPath, 15)  // ~200-500ms (Supabase API)
    return NextResponse.redirect(signedUrl)              // ← 307 default
  }
  // ...
}
```

### Latency budget (per request, production)

| Step | Estimate | Source |
|---|---|---|
| Vercel edge function routing | 5-15ms | Vercel docs |
| `requireSession` cookie parse + signature verify | 5-50ms | scrypt-free verify path |
| `getPortfolioAvatarForUser` Supabase Storage JSON read | 100-300ms | `readJsonObject(profilePath(userId))` — one Storage GET |
| `createSignedObjectUrl` Supabase signed URL API call | 200-500ms | Supabase JS SDK `.createSignedUrl()` — separate API |
| `NextResponse.redirect` 307 generation | 1-5ms | Next.js |
| **Total (cold)** | **~311-870ms** | matches operator's 737-1150ms with Vercel function init |
| **Total (warm)** | **~211-555ms** | matches secondary observations |

**3 sites × ~300ms+ = 900ms+ even under best-case warm-cache scenario.** Operator's ~3.6s wall time is consistent with cold-start function init (first request) + 2 warm requests + 3× signed-URL-destination jpeg fetches.

### Sqlite fallback path (L63-75) — for comparison

```ts
const buffer = await readStoredAsset(avatarMeta.assetPath)
return new NextResponse(new Uint8Array(buffer), {
  status: 200,
  headers: {
    'Content-Type': avatarMeta.assetMimeType ?? 'application/octet-stream',
    'Content-Length': String(buffer.byteLength),
    'Cache-Control': 'private, max-age=60',  // ← Cache-Control set ONLY on sqlite path
  },
})
```

**Notable inconsistency:** the sqlite fallback path (local dev / disabled-supabase mode) sets `Cache-Control: private, max-age=60`. The Supabase production path (which serves real users) sets NO Cache-Control. This is the F-AV-02 root.

---

## Layer 3 — Supabase signed URL inspection

### `createSignedObjectUrl` helper (`src/lib/supabase-app-state.ts:183-204`)

```ts
export async function createSignedObjectUrl(
  objectPath: string,
  expiresInSeconds = 60,    // default 60s; avatar GET passes 15s
): Promise<string | null> {
  const client = getSupabaseClient()
  if (!client) return null

  await ensureSupabaseAppStateBucket()              // bucket-creation no-op on warm path
  const normalized = normalizeObjectPath(objectPath)
  const { data, error } = await client.storage
    .from(SUPABASE_APP_STATE_BUCKET)
    .createSignedUrl(normalized, expiresInSeconds)  // ← Supabase API roundtrip
  // ...
  return data?.signedUrl ?? null
}
```

### Signed URL generation semantics (Supabase JS SDK behavior)

- Each call to `client.storage.from(bucket).createSignedUrl(path, ttl)` makes a real HTTPS roundtrip to the Supabase Storage API endpoint (`https://<project>.supabase.co/storage/v1/object/sign/<bucket>/<path>`).
- Supabase mints a JWT token bound to `(path, exp)` and returns the full signed URL in the response body.
- The token is stateless — verifying it at fetch time does NOT require additional API calls (Supabase Storage's edge layer can verify locally).
- **Each call produces a unique JWT token** even if the input path + TTL are identical. The token includes a `iat` (issued-at) and `exp` (expiry) claim that differ across calls.
- Consequence: 3 successive `createSignedObjectUrl(samePath, 15)` calls produce 3 DIFFERENT signed URLs. The destination URLs in the operator's 307 redirects are therefore non-equivalent from a browser HTTP cache perspective.

### TTL = 15 seconds (Wave 5B R-API-10 closure)

Confirmed at `route.ts:56`:
```ts
const signedUrl = await createSignedObjectUrl(avatarMeta.assetPath, 15)
```

R-API-10 audit closure (Phase 3.A) tightened TTL from 60s → 15s to reduce off-platform leak window (clipboard share / URL bar screenshot). REJECTED ALTERNATIVE in that closure: 5s (too aggressive for slow mobile networks).

**Tension with Layer 4 cache audit:** a 15s TTL means a Cache-Control header of `max-age=14` (1s safety buffer) would allow the browser to dedupe within that window. The current "no Cache-Control" state effectively means 0s of browser-side reuse, defeating the entire concept of a signed URL with TTL.

### `getPortfolioAvatarForUser` (`src/lib/soc-store-supabase.ts:676-701`)

```ts
export async function getPortfolioAvatarForUser(userId: number) {
  const profile = await readJsonObject<StoredProfile>(profilePath(userId))  // 1 Storage read
  if (profile?.avatarPath) {
    return { assetPath: profile.avatarPath, assetName, assetMimeType }
  }
  // Fallback: directory listing of avatarPrefix(userId)
  const fallbackAssets = (await listObjectPaths(avatarPrefix(userId)))      // 1 Storage list
    .filter((item) => !item.endsWith('.json'))
    .sort()
  // ...
}
```

In the happy path (profile JSON has `avatarPath`), this is **one Supabase Storage GET request** (~100-300ms). In the fallback (no avatarPath in profile JSON — should not happen post-Wave-5B avatar-upload flow), it's a `listObjectPaths` operation (~200-500ms) followed by a sort.

---

## Layer 4 — Cache audit

### Response header inventory

| Endpoint | Path | Cache-Control header | Source |
|---|---|---|---|
| `/api/profile/avatar/[userId]` GET (Supabase production path) | L60 `NextResponse.redirect(signedUrl)` | **MISSING** | `route.ts:60` |
| `/api/profile/avatar/[userId]` GET (sqlite fallback path) | L63-75 `new NextResponse(buffer, {headers})` | `private, max-age=60` | `route.ts:73` |
| Supabase signed URL destination (jpeg) | Supabase Storage's default response | (Supabase's own headers, typically `cache-control: max-age=3600`) | Supabase-managed |

### Browser caching behavior with 307 redirect + missing Cache-Control

Per RFC 7234 + HTTP/2 caching semantics:
- A 307 Temporary Redirect WITHOUT a `Cache-Control` directive is treated as "do not cache the redirect itself." Each subsequent request to the source URL must re-follow the redirect chain.
- If a 307 carried `Cache-Control: max-age=14`, the browser would cache the redirect record AND its destination URL for 14s. Subsequent requests to `/api/profile/avatar/<userId>?v=...` would short-circuit to the cached signed URL (no server roundtrip).
- The destination jpeg's own `Cache-Control: max-age=3600` (Supabase default) IS honored — but since the destination URL is unique per request (different JWT token), the destination cache key changes each time, so this header provides no dedup benefit at the source-URL layer.

### `dynamic = 'force-dynamic'` interaction

`route.ts:9` declares `export const dynamic = 'force-dynamic'`. This affects Next.js server-side cache layers:
- **Full Route Cache:** disabled — the route handler runs on every request.
- **Data Cache:** also disabled for `fetch(...)` calls inside the handler (though the avatar route uses Supabase SDK, not `fetch`, so this is moot).

`force-dynamic` does NOT affect:
- Browser HTTP cache (governed by response Cache-Control header)
- CDN/edge cache (Vercel honors response headers regardless of `dynamic` declaration)

**Tension:** force-dynamic was likely added to ensure the signed URL is always fresh (the response body changes every 15s with a new TTL). But the freshness can be expressed via short Cache-Control (e.g., `max-age=14`) without forcing server-side cache opt-out. Removing `force-dynamic` + adding a short Cache-Control would let Next.js / Vercel edge cache assist + browser cache assist, while preserving signed-URL freshness.

### Wave 10 router.refresh() context

Wave 10 (commit `13a3c2c`) added `router.refresh()` to all 7 save handlers in `PortfolioWorkspace.tsx` (closure of A-24, Router Cache stale on soft-nav return). `router.refresh()` invalidates the client-side Router Cache for the current route and triggers Server Component data refetch. This is the right primitive for the Wave 10 closure and is **orthogonal** to the avatar caching question (Router Cache is about Server Component re-render; HTTP Cache-Control is about browser-level resource caching).

---

## Layer 5 — Bundle size impact

### Production build output (post-Wave-12)

```
Route (app)                              Size     First Load JS
├ ƒ /api/profile/avatar                  0 B                0 B
├ ƒ /api/profile/avatar/[userId]         0 B                0 B
├ ƒ /portfolio                           12.5 kB         109 kB
+ First Load JS shared by all            87.5 kB
```

- `/api/profile/avatar/*` routes carry **0 B client bundle** (server-only, as expected for API routes).
- `/portfolio` route: 12.5 kB route-specific + 109 kB First Load JS (includes shared chunks).
- Avatar-related JS (the `avatarSrc` memo + `buildAvatarSrc` + 3 `<img>` blocks) is a tiny fraction of the 12.5 kB.

**Conclusion:** Bundle size is NOT a contributor to the observed performance issue. The 3.6s wall time is entirely a network-side phenomenon. Bundle-side optimization (e.g., next/Image migration) would help marginally for image transform / lazy loading but cannot fix the triple-fetch root cause.

---

## Layer 6 — Network behavior root cause synthesis

### Operator-reported 6-request flow

```
1. /api/profile/avatar/<userId>  307 redirect  0.6 KB  1.15 sn
2. signed-url-image.jpeg         200 jpeg     83.3 KB   331 ms
3. /api/profile/avatar/<userId>  307 redirect  0.6 KB   911 ms
4. signed-url-image.jpeg         200 jpeg     83.2 KB   139 ms
5. /api/profile/avatar/<userId>  307 redirect  0.5 KB   737 ms
6. signed-url-image.jpeg         200 jpeg     83.2 KB   271 ms

Total: 6 requests, ~3.6s wall time, ~250 KB transfer
```

### Step-by-step explanation

| Step | Triggered by | Server actions | Network latency contributor |
|---|---|---|---|
| 1 (1.15s) | Site 1 `<img>` mount on initial render | `requireSession` → Supabase JSON read → `createSignedUrl` → 307 | Cold start function init (~300-500ms) + ~315-855ms server work |
| 2 (331ms) | Browser follows redirect from step 1 | Supabase Storage serves jpeg (cached at Supabase edge) | Network only |
| 3 (911ms) | Site 2 `<img>` mount (concurrent with site 1) | Same chain as step 1, warm cache | Supabase JSON read + signed URL API |
| 4 (139ms) | Browser follows redirect from step 3 | Supabase Storage warm-cache hit | Network only |
| 5 (737ms) | Site 3 `<img>` mount (concurrent with sites 1+2) | Same chain, warmer | Supabase JSON read + signed URL API |
| 6 (271ms) | Browser follows redirect from step 5 | Supabase Storage warm | Network only |

**Why 3 separate fetches (not 1)?**
- All 3 `<img>` tags carry the same `src` attribute (`/api/profile/avatar/<userId>?v=<avatarPath>`).
- The browser's HTTP cache requires `Cache-Control` to dedupe across same-URL fetches in the cache layer. With no Cache-Control on the 307, every fetch goes server-side.
- The browser's **in-memory image cache** could theoretically dedupe 3 identical-URL `<img>` tags, but this dedup is **best-effort per-frame**. When all 3 `<img>` mount concurrently (within the same React commit) and fire `Image()` decoder load attempts at the same instant, the browser may fire all 3 actual HTTP requests before any response arrives to update the cache.
- Empirically (operator screenshot), Chrome/Edge clearly fired 3 separate redirect chains. This is consistent with no-cache-no-dedup behavior.

**Why 307 step takes 700-1100ms?**
- The Supabase Storage JSON read (`readJsonObject(profilePath(userId))`) is one HTTPS request to Supabase ~150ms.
- The `createSignedUrl` SDK call is another HTTPS request to Supabase's signed-URL endpoint ~250-500ms.
- These are **sequential** (Promise chain inside the route handler), so latency adds.
- Vercel cold start adds ~300-500ms to the first request.
- Total ~700-1100ms matches.

**Why duplicate jpeg downloads?**
- Each 307 redirect destination is a DIFFERENT signed URL (different JWT token in query string).
- Browser HTTP cache keys on full URL including query string.
- Three distinct URLs → three distinct cache keys → three distinct fetches.
- The destination JPEG content is identical (83.3 KB vs 83.2 KB difference is presumably just HTTP/2 header compression variance), but the cache cannot know that — URL-based keying treats them as separate resources.

### Why this is operationally bad

- 3.6s wall time on cold mount is user-perceivable (avatar pops in slowly, often with multiple replacement flashes as each fetch resolves).
- 250 KB transfer per page load for what is conceptually a single image; on a metered mobile connection this is 750 KB per session if user navigates `/portfolio` ←→ `/home` 3 times.
- Supabase API quota: each page load consumes 3× JSON read + 3× signed URL mint = 6 API calls for one user's avatar. Multiplied by user count, this compounds.
- Vercel function execution: 3× function invocations per page load, each ~500ms warm = 1.5s of compute billed.

### Why this is NOT a security issue

- The 15s TTL (Wave 5B R-API-10 closure) is preserved.
- Off-platform URL leak window is unchanged.
- Performance fix can extend Cache-Control to `max-age=14` (within TTL) without weakening the leak narrative.
- Signed URLs still expire after 15s — operationally negligible reuse window after share/screenshot.

---

## Findings table

| ID | Layer | Finding | Severity | Effort | Recommended fix |
|---|---|---|---|---|---|
| **F-AV-01** | 1+4+6 | **Triple-fetch storm:** 3 `<img>` render sites in PortfolioWorkspace.tsx (L905/L995/L1085) all consume the same `avatarSrc` memo URL but each triggers an independent network fetch chain. Browser HTTP cache cannot dedupe (Cache-Control missing on 307); browser image cache cannot dedupe across destinations (each signed URL has a unique JWT). | **CRITICAL** | S-M | Path B Server-Component prop-drill OR Path A Cache-Control header (3 sites collapse to 1 effective fetch within 15s window) |
| **F-AV-02** | 4 | **Missing Cache-Control on 307 redirect (production Supabase path).** `route.ts:60` `NextResponse.redirect(signedUrl)` carries no headers. Sqlite fallback at L73 sets `Cache-Control: private, max-age=60`. Production path inconsistency. | **HIGH** | XS | Path A: add `Cache-Control: private, max-age=14` header to the 307 response (TTL minus 1s safety buffer). Single-line change. |
| **F-AV-03** | 4 | **`dynamic = 'force-dynamic'` on every avatar GET** disables Next.js Data Cache + Route Cache. Combined with no Cache-Control, every browser request goes all the way to the server. Force-dynamic was likely added to ensure signed URL freshness, but freshness can be expressed via `max-age=14` directly. | **HIGH** | XS | Path A: remove `force-dynamic` line. Single-line change. (Verify with TTL window — short max-age = fresh enough.) |
| **F-AV-04** | 3 | **Supabase signed URL minted per request** (no server-side pool/cache). Each `createSignedObjectUrl` call is a real Supabase API roundtrip (~200-500ms). Within a 15s TTL window, the same URL could be served to N consumers — currently 1-to-1 per request. | **MEDIUM** | M-L | Path D: in-memory `Map<userId, {url, expiresAt}>` keyed by userId; serve from pool when `expiresAt - now > 1s`. Vercel cold start invalidates pool — acceptable. ~30-50 LOC. |
| **F-AV-05** | 1 | **Server Component could resolve signed URL at render time.** `/portfolio` is already a force-dynamic Server Component (page.tsx L15-16) — it could call `getPortfolioAvatarForUser` + `createSignedObjectUrl` ONCE and pass the resolved URL as a prop to `PortfolioWorkspace`. Eliminates ALL 3 client-side fetches on initial page load. Subsequent upload-success flows still use client-side path. | **MEDIUM** | M | Path B: SSR prop-drill. ~30-40 LOC source + ~20 LOC test updates. Trade-off: signed URL leaks into HTML — but it's already leaked via redirect chain to browser anyway. Risk: medium. |
| **F-AV-06** | 5 | **No `<Image priority>` hint / next/Image migration.** Wave 8 documented per-line `<img>` lint bypass with rationale "next/Image static-optimization not applicable to dynamic signed URLs." This rationale is half-correct — next/Image supports remote URLs via `images.remotePatterns` config. With Supabase domain configured, next/Image would: (a) dedupe more aggressively than raw `<img>`, (b) enable AVIF/WebP transforms via Vercel image optimization, (c) lazy-load below-fold (sites 2+3). | **LOW** | M | Path C: add `images.remotePatterns: [{ protocol: 'https', hostname: '<supabase-project>.supabase.co' }]` to next.config.mjs; replace `<img>` with `<Image>` at 3 sites with appropriate `priority` / `loading="lazy"`. ~30 LOC. Bundle size adds ~5 kB for next/Image runtime. |
| **F-AV-07** | 1 | **`?v=avatarPath` query string cache-buster** at `buildAvatarSrc:93` is intended to invalidate cache when avatar changes, but serves no purpose today because nothing caches the response. After Cache-Control is added, the `?v=` becomes functionally useful (avatar upload changes the path → query string changes → browser cache key changes → fresh fetch). Low priority finding, will work itself out after Path A. | **LOW** | none | No standalone fix needed; resolves implicitly with Path A. |

---

## Recommended fix paths

### Fix Path A (minimal) — ~5-10 LOC

**Scope:**
- Add `Cache-Control: private, max-age=14` header to the 307 response in `route.ts:60`.
- Remove `export const dynamic = 'force-dynamic'` from `route.ts:9` (rely on Cache-Control + TTL for freshness, not Next.js cache opt-out).
- OPTIONAL: Add `Vary: Cookie` to the response (since `requireSession` makes the response per-user; without `Vary: Cookie`, a CDN could theoretically serve user A's signed URL to user B if the path matched).

**Expected impact:**
- Browser HTTP cache dedupes 3 same-URL `<img>` loads within the 14s window → effectively **1 server roundtrip per page load** instead of 3.
- After the first fetch, the cached 307 record makes subsequent sites resolve from cache. The cached destination URL still hits Supabase Storage for the jpeg, but all 3 sites resolve to the same destination URL → browser image cache dedupes → only 1 actual jpeg fetch.
- Net flow: 1 redirect (~500-900ms cold, ~200ms warm) + 1 jpeg fetch (~150-300ms). Wall time: **~3.6s → ~700-1100ms first load**; subsequent 14s window: ~50-100ms (pure cache hit).

**Risk:** **LOW**. Header addition + dynamic removal is purely additive on response semantics; no logic change. T-AV-TTL still passes (TTL value unchanged). Could add T-AV-CACHE for the header presence.

**Effort:** **S** (estimated 5-10 LOC).

**Test impact:** add 1 test (T-AV-CACHE-HEADER) asserting Cache-Control presence on the 307 response. Existing T-AV-TTL preserved.

---

### Fix Path B (targeted) — ~50-70 LOC

**Scope:**
- **All of Path A** (Cache-Control header + remove force-dynamic).
- **Server Component prop-drilling:** `/portfolio/page.tsx` resolves the avatar signed URL on the server side (one `createSignedObjectUrl` call) and passes it as a prop to `<PortfolioWorkspace initialAvatarUrl={signedUrl}>`.
- `PortfolioWorkspace.tsx`: accept the new `initialAvatarUrl` prop; initialize `avatarSrc` from it directly; only fall back to client-side `buildAvatarSrc` if the prop is missing (e.g., subsequent state updates after avatar upload).
- Eliminates the initial 3-client-fetch storm entirely. On page load, the avatar is in the HTML stream; sites 1+2+3 all render with `src` already populated.

**Expected impact:**
- **First page load:** 0 client-side avatar fetches. Avatar image fetches at most once (the jpeg from the SSR-resolved signed URL).
- **Wall time:** ~3.6s → ~250-400ms (only the jpeg fetch remains).
- **Subsequent updates (avatar upload):** client-side flow takes over via the existing useState + setData chain; Wave 10 `router.refresh()` triggers a fresh SSR resolve on next navigation.

**Risk:** **MEDIUM**. Server Component prop-drilling changes the data flow architecture for avatar. The 15s TTL means the SSR-resolved URL must be re-resolved on every page load (force-dynamic Server Component already does this — orthogonal). Edge case: if user navigates fast (subsequent /portfolio visits within 15s), the SSR-resolved URL could already be expired by the time the client renders it. Mitigation: pass `signedUrlExpiresAt` alongside the URL; client validates and triggers refetch if expired.

**Effort:** **M** (estimated 50-70 LOC source + 20-30 LOC test).

**Test impact:**
- Update `PortfolioWorkspace.test.tsx` to pass `initialAvatarUrl` prop in fixtures.
- Add T-PE-AVATAR-SSR test asserting the SSR-resolved URL is consumed without triggering client-side `/api/profile/avatar/[userId]` fetch on mount.
- Update existing T-PE-PERSIST (Wave 10) to handle the new prop.

---

### Fix Path C (aggressive) — ~120-150 LOC

**Scope:**
- **All of Path B**.
- **next/Image migration:**
  - Add `images.remotePatterns` config to `next.config.mjs` whitelisting `<project>.supabase.co`.
  - Replace 3 `<img>` sites with `<Image>` components.
  - Site 1 (above-fold header): `priority` hint.
  - Sites 2+3 (conditional on tab='profile' so generally above-fold once the tab is active): default eager loading.
  - Image dimensions explicit (64x64, 96x96, 80x80 per site).
- **Vercel Image Optimization** auto-serves AVIF/WebP based on `Accept` header → smaller transfer for modern browsers (~50% bandwidth reduction).

**Expected impact:**
- Path B benefits + image size reduction.
- Transfer: 83 KB jpeg → ~30-45 KB AVIF (modern browsers) or ~50-65 KB WebP (older Chromium/Safari).
- Page load: ~250-400ms → ~150-300ms (smaller payload).

**Risk:** **MEDIUM-HIGH**. next/Image semantics differ from raw `<img>`:
- `<Image>` requires explicit `width` + `height` props (or `fill` + parent container with relative positioning).
- Layout shift if dimensions don't match container exactly.
- Vercel Image Optimization charges per-transform; high-traffic pages can accumulate cost.
- The 3 inline `eslint-disable-next-line @next/next/no-img-element` comments at sites 1+2+3 can be removed once `<Image>` is in place.
- Supabase signed URLs are dynamic — Vercel's image optimization caches by source URL; if the source URL changes every 15s (new JWT token), the optimization cache is invalidated per request. This partially defeats the optimization benefit unless combined with Path B (SSR-resolved URL is consistent for the page lifetime).

**Effort:** **M-L** (estimated 80-120 LOC source + 30-40 LOC test).

**Test impact:**
- Update tests to handle next/Image rendering (different DOM structure: `<img>` wrapped in `<span>` for layout).
- Add T-AV-NEXTIMAGE-CONFIG test asserting `images.remotePatterns` includes Supabase host.

---

### Fix Path D (hybrid optimal) — ~180-220 LOC

**Scope:**
- **All of Path C**.
- **Server-side signed URL pool:** in-memory `Map<userId, {url: string, expiresAt: number}>` keyed by userId. Each `createSignedObjectUrl` call checks the pool first; if a valid URL exists (with > 1s remaining TTL), return cached. Else mint a new one and store.
- Per-userId concurrent-mint guard via `Map<userId, Promise<...>>` to prevent thundering herd when 3 SSR-resolved sites hit during a high-concurrency moment.

**Expected impact:**
- Within a 14s window (TTL minus 1s buffer), N consumers of the same userId's avatar URL pay only 1 Supabase API roundtrip.
- Vercel function cold start invalidates the in-memory pool (acceptable trade-off — cold starts are rare in steady state).
- Supabase API quota: 6 calls per page load → 1 per 14s window per user.

**Risk:** **HIGH**. In-memory state across requests is fragile in serverless:
- Vercel function instances are isolated and short-lived. The pool benefit accrues only when 2+ requests hit the same warm instance within 14s.
- High-traffic moments where 100 users hit `/portfolio` simultaneously would still produce ~100 Supabase API calls (1 per user × instance fanout).
- Complexity vs benefit: for capstone scope, the marginal benefit over Path B (which already eliminates client-side fetches) is small. Path D is a production-engineering optimization that may not be capstone-appropriate.

**Effort:** **L** (estimated 120-180 LOC source + 40-60 LOC test + concurrency-edge regression tests).

**Test impact:**
- T-AV-POOL-HIT test: 2 successive `getAvatarSignedUrl(userId)` calls within window → second returns cached.
- T-AV-POOL-EXPIRE: 2 calls separated by 15s+ → second mints fresh.
- T-AV-POOL-CONCURRENT: 3 concurrent calls → only 1 Supabase API invocation; all 3 receive the same URL.

---

## Path comparison summary

| Criterion | Path A | Path B | Path C | Path D |
|---|---|---|---|---|
| LOC delta | ~5-10 | ~50-70 | ~120-150 | ~180-220 |
| Wall time improvement | 3.6s → 700-1100ms first load; 50-100ms warm | 3.6s → 250-400ms first load; ~150ms warm | 3.6s → 150-300ms first load; ~100ms warm | Path C + smaller Supabase quota usage |
| Risk | LOW | MEDIUM | MEDIUM-HIGH | HIGH |
| Test additions | ~1 test | ~3 tests | ~5 tests | ~7 tests |
| Architectural shift | None | Server-Component prop-drill | next/Image migration | + server-side pool state |
| Capstone-scope fit | ✅ ideal | ✅ ideal | ⚠ acceptable, larger | ⚠ likely over-engineered |
| Reverses 3-fetch storm | partial (browser dedup via cache) | full (0 client fetches) | full | full |
| Production cost reduction | moderate (3× → 1×) | high (3× → 0× client fetches) | high + bandwidth savings | maximum |

**Agent recommendation:** **Path B (targeted)**. Eliminates the 3-fetch storm at its architectural root (move signed URL resolution to where the data already lives — the Server Component) without committing to next/Image semantics complexity. Combines well with Wave 10 router.refresh() (subsequent refreshes re-resolve SSR). Path A's Cache-Control header should be included as a defense-in-depth measure (covers the subsequent-render flow after user upload + the rare case where SSR fails). Path C's next/Image is a Phase 6 production-engineering candidate (works well when bundled with `images.remotePatterns` + traffic-justified cost). Path D is the right answer for high-traffic production but exceeds capstone scope.

---

## Open questions for mentor (Faz 13.B decision)

1. **Fix path scope choice:** A, B, C, D, or hybrid (e.g., A + B together)?
2. **next/Image migration timing:** Path C now or Phase 6? Cost-benefit depends on expected traffic.
3. **Server-side pool (Path D):** include for capstone signal or defer to production tier?
4. **TTL relaxation:** R-API-10 Wave 5B set 15s. Path A's `max-age=14` works within this. Should TTL also be revisited (e.g., back to 30s) to widen the effective cache window without violating the security narrative? (Would require auditor sign-off on R-API-10 revision.)
5. **Vary: Cookie header:** include as additional safety against CDN cross-user leak risk? Operationally minor but architecturally correct.
6. **Wave 10 router.refresh() interaction:** Path B re-resolves the avatar signed URL on every SSR pass (including post-save Wave 10 refresh). This is the right behavior but worth noting — refresh cycle hits Supabase API once per user navigation back to /portfolio. Acceptable per current operator screenshot (single visit shows 3 fetches; with Path B that's 1 fetch).
7. **Operator manual smoke needed in Faz 13.D:** confirm against `https://siberlab.dev/portfolio` after deploy that DevTools network panel shows ≤2 requests (1 redirect + 1 jpeg) instead of 6.

---

## Mentor decision matrix — Faz 13.B (RESOLVED, applied in Faz 13.C commit `ed086c2`)

| Decision | Outcome | Rationale |
|---|---|---|
| Selected fix path | **Path B + Path A defense-in-depth** | Path B eliminates the 3-fetch storm at architectural root (move signed URL resolution to where data already lives — the Server Component). Path A `Cache-Control` adds browser-level dedup as a defense-in-depth safety net on the legacy fallback path. Path C (next/Image) + Path D (server-side pool) are diminishing-returns for capstone scope. |
| Next/Image migration | **Deferred to POST_CAPSTONE_BACKLOG.md #11** | Migration complexity (≥30 LOC + `images.remotePatterns` whitelist + DOM-shape test fixture updates) exceeds capstone-scope budget. Wave 13.C Path B + Path A combo delivers 9× improvement; next/Image incremental gain (AVIF/WebP transforms, automatic lazy load) is bandwidth-justified, not latency-justified. Phase 7 dependency. |
| Server-side signed URL pool (Path D) | **Deferred to POST_CAPSTONE_BACKLOG.md #12** | Production-tier optimization, not capstone signal. Vercel function isolation invalidates pool across cold starts; multi-instance scenario = N pools per N instances. ~80-100 LOC + concurrency-edge regression tests exceeds the marginal benefit envelope at capstone-demo traffic levels. Conditional on real production-traffic growth. |
| TTL relaxation 15s → 30s | **Approved (Z.15 in SCOPE_DECISIONS.md)** | 2× cache window for the Cache-Control + browser-dedup combo. Security envelope preserved (still well below "long-lived URL" category). Wave 5B R-API-10 closure status preserved as RESOLVED — this is a TTL parameter revision, not a pattern flip. Mid-stream operator decision recorded in Z.15 audit-trail entry. |
| `Vary: Cookie` header | **Approved** | Defense-in-depth signal for any intermediary cache (CDN tier, future edge config) that might consider keying off path alone. Operationally minor at current Vercel-managed cache layer; architecturally explicit. |
| Wave 10 `router.refresh()` interaction | **Approved as-is** | Server Component re-resolves signed URL on every refresh pass (including post-save Wave 10 router.refresh()). Quota math: 1 Supabase API call per user save action — acceptable. Architectural simplicity > pool optimization. |
| Faz 13.D smoke target | **≤2 requests, ~250-400ms cold; ~150ms warm** | Concrete operator-executable success criterion for production verification. DevTools Network filter "avatar" → expect 1 × 307 redirect + 1 × jpeg (was 6 = 3 × redirect + 3 × jpeg). |

---

## Verification of this cycle

- ✅ `git diff src/` empty (zero code changes)
- ✅ `git diff` excluding new audit file empty (zero existing audit doc edits)
- ✅ Vitest 541 / 64 PRESERVED
- ✅ TypeScript zero errors
- ✅ Lint 0E / 0W preserved (no source touch)
- ✅ Single new file: `docs/audit/WAVE_13_AVATAR_PERF_AUDIT.md`
- ✅ 6 layers analyzed
- ✅ 7 findings classified by severity
- ✅ 4 fix paths evaluated with LOC + risk + improvement estimates
- ✅ Mentor decision matrix left empty (Faz 13.B + Faz 13.C territory)
- ✅ Wave 1-12 patches dokunulmaz
- ✅ Wave 5B R-API-10 TTL preserved unchanged
- ✅ Wave 10 router.refresh() preserved unchanged
