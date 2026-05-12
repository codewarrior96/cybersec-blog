import {
  __resetAllInSupabaseForTests,
  checkRateLimitFromSupabase,
  clearAttemptsInSupabase,
  isSupabaseRateLimitsEnabled,
  recordFailureToSupabase,
} from './supabase-rate-limits'

// R-02 hardening (Phase 1.5.9 <COMMIT_HASH_TBD>): rate-limiter dispatches to
// Supabase Postgres (public.rate_limits) for cross-instance-coherent shared
// state when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are configured.
// Closes R-02 (per-process globalThis Map → Supabase Postgres).
//
// Fallback: when Supabase env unset (local dev, test env without remote
// backend), retains globalThis Map for single-instance correctness. The
// fallback path preserves backward compatibility with existing test
// infrastructure and offline development workflows.
//
// R-08 closure (this commit): __resetAllForTests now guards against
// production execution via NODE_ENV check at entry. The export is retained
// (no signature change for test consumers); production calls throw an
// explicit Error rather than silently wiping rate-limit state.
//
// API change: all public functions are async (Promise<...> return type).
// Callers (5 route handlers + 1 setup file) updated to await.
// Test mocks (6 files, ~50 sites) updated to mockResolvedValue.
//
// SENIOR ARCHITECT NOTE: dispatcher evaluates isSupabaseRateLimitsEnabled()
// per call (not module-load-cached). This lets tests dynamically swap
// behavior via vi.mock without re-importing the module. The env-read
// inside isSupabaseRateLimitsEnabled() is itself cached at supabase-
// rate-limits.ts module-load, so the per-call cost is one boolean check.

interface RateLimitEntry {
  count: number
  resetAt: number
}

interface RateLimitBucket {
  store: Map<string, RateLimitEntry>
}

const GLOBAL_KEY = Symbol.for('soc.rate.limiter.buckets')

type Globals = typeof globalThis & {
  [GLOBAL_KEY]?: Map<string, RateLimitBucket>
}

function buckets(): Map<string, RateLimitBucket> {
  const g = globalThis as Globals
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = new Map()
  }
  return g[GLOBAL_KEY]!
}

function getBucket(name: string): RateLimitBucket {
  const map = buckets()
  let bucket = map.get(name)
  if (!bucket) {
    bucket = { store: new Map() }
    map.set(name, bucket)
  }
  return bucket
}

export interface RateLimitOptions {
  bucket: string
  max: number
  windowMs: number
}

export interface RateLimitResult {
  limited: boolean
  remaining: number
  resetAt: number
}

export async function checkRateLimit(
  key: string,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  if (isSupabaseRateLimitsEnabled()) {
    return checkRateLimitFromSupabase(options.bucket, key, options.max)
  }
  // Fallback: globalThis Map (local dev + test env without Supabase)
  const { store } = getBucket(options.bucket)
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    return { limited: false, remaining: options.max, resetAt: now + options.windowMs }
  }

  return {
    limited: entry.count >= options.max,
    remaining: Math.max(0, options.max - entry.count),
    resetAt: entry.resetAt,
  }
}

export async function recordFailure(
  key: string,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  if (isSupabaseRateLimitsEnabled()) {
    return recordFailureToSupabase(options.bucket, key, options.max, options.windowMs)
  }
  // Fallback: globalThis Map
  const { store } = getBucket(options.bucket)
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    const next: RateLimitEntry = { count: 1, resetAt: now + options.windowMs }
    store.set(key, next)
    return { limited: false, remaining: options.max - 1, resetAt: next.resetAt }
  }

  entry.count++
  return {
    limited: entry.count >= options.max,
    remaining: Math.max(0, options.max - entry.count),
    resetAt: entry.resetAt,
  }
}

export async function clearAttempts(key: string, bucketName: string): Promise<void> {
  if (isSupabaseRateLimitsEnabled()) {
    await clearAttemptsInSupabase(bucketName, key)
    return
  }
  // Fallback: globalThis Map
  getBucket(bucketName).store.delete(key)
}

export async function __resetAllForTests(): Promise<void> {
  // R-08 closure (Phase 1.5.9 <COMMIT_HASH_TBD>): production NODE_ENV guard.
  // Export retained for test consumers (test/setup.ts global afterEach +
  // rate-limiter.test.ts per-test beforeEach). Production calls throw to
  // prevent supply-chain-compromise abuse — an attacker with code-execution
  // capability can no longer call this to wipe rate-limit state silently.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('__resetAllForTests prohibited in production (R-08 guard)')
  }

  // Clear Supabase state (if configured) — handles cross-instance shared
  // state cleanup so tests are hermetic across module reloads.
  if (isSupabaseRateLimitsEnabled()) {
    await __resetAllInSupabaseForTests()
  }

  // Always clear globalThis Map fallback (test isolation independent of
  // Supabase availability; setup.ts afterEach relies on this for test
  // hermeticity in both Supabase-enabled and -disabled paths).
  const g = globalThis as Globals
  g[GLOBAL_KEY] = new Map()
}
