import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// R-02 hardening (Phase 1.5.9 <COMMIT_HASH_TBD>): Supabase Postgres shared
// state for rate-limit counters. Backs the rate-limiter.ts dispatcher when
// SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are configured. Closes R-02 by
// replacing per-process globalThis Map with cross-instance-coherent state
// in public.rate_limits (schema applied via supabase/rate-limits.sql,
// Phase 1.5.9.0 commit a08d8f3).
//
// Pattern mirrors supabase-attack-metrics.ts: singleton client, service-role
// credentials, throw on error (caller catches). Service-role bypasses the
// table's RLS (no policies, RLS-enabled-only → only service_role can read
// or write).
//
// SENIOR ARCHITECT NOTE: this module does NOT use soc-store-adapter routing
// (Class 1/2/3 per A-21). Rate-limiter is a standalone primitive, not a
// domain "store" — dedicated client keeps the adapter focused on identity
// + operational data while rate-limit state lives in its own surface.
//
// REJECTED ALTERNATIVE: PL/pgSQL function for atomic increment via .rpc().
// Rejected per Phase 1.5.9 spec — keeps schema function-free for simpler
// migration auditing. Read-modify-write pattern (this module) accepts rare
// race conditions in extreme concurrent load (slight under-counting,
// harmless for security rate-limiting at our scale). Migration to a true
// atomic increment via PL/pgSQL function or Postgres-side LOCK is a
// future-cycle hardening if scale demands.

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const RATE_LIMITS_TABLE = 'rate_limits'

let supabaseClient: SupabaseClient | null = null

export function isSupabaseRateLimitsEnabled(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
}

function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseRateLimitsEnabled()) return null
  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  }
  return supabaseClient
}

export interface SupabaseRateLimitResult {
  limited: boolean
  remaining: number
  resetAt: number
}

export async function checkRateLimitFromSupabase(
  bucket: string,
  key: string,
  max: number,
): Promise<SupabaseRateLimitResult> {
  const client = getSupabaseClient()
  if (!client) {
    throw new Error('[supabase-rate-limits] client not configured')
  }

  const { data, error } = await client
    .from(RATE_LIMITS_TABLE)
    .select('count, reset_at')
    .eq('bucket', bucket)
    .eq('key', key)
    .maybeSingle<{ count: number; reset_at: string }>()

  if (error) {
    throw new Error(`[supabase-rate-limits] read failed: ${error.message}`)
  }

  if (!data) {
    return { limited: false, remaining: max, resetAt: 0 }
  }

  const resetAtMs = new Date(data.reset_at).getTime()
  const now = Date.now()
  // Expired window — treat as fresh (no row mutation; recordFailure will
  // overwrite on next write if needed).
  if (resetAtMs < now) {
    return { limited: false, remaining: max, resetAt: 0 }
  }

  return {
    limited: data.count >= max,
    remaining: Math.max(0, max - data.count),
    resetAt: resetAtMs,
  }
}

export async function recordFailureToSupabase(
  bucket: string,
  key: string,
  max: number,
  windowMs: number,
): Promise<SupabaseRateLimitResult> {
  const client = getSupabaseClient()
  if (!client) {
    throw new Error('[supabase-rate-limits] client not configured')
  }

  const now = Date.now()
  const windowEndIso = new Date(now + windowMs).toISOString()

  // Read-modify-write. Race-tolerant for our scale (security rate-limiting,
  // not financial counters). Two concurrent recordFailure calls may both
  // read count=N and both write count=N+1 (one increment lost). Effect:
  // slightly under-counts under extreme parallel load, never over-counts.
  // For brute-force protection at 10/5min budgets, the failure mode is
  // "attacker gets one extra try" — acceptable.
  //
  // Strict atomic increment would require either a PL/pgSQL function (out
  // of scope per Phase 1.5.9 spec) or a serializable transaction
  // (significant per-request overhead). The PostgREST API (used by
  // supabase-js) doesn't expose raw SQL with conditional column expressions
  // in the SET clause of ON CONFLICT DO UPDATE.
  const { data: existing, error: readError } = await client
    .from(RATE_LIMITS_TABLE)
    .select('count, reset_at')
    .eq('bucket', bucket)
    .eq('key', key)
    .maybeSingle<{ count: number; reset_at: string }>()

  if (readError) {
    throw new Error(`[supabase-rate-limits] write-phase read failed: ${readError.message}`)
  }

  let newCount: number
  let newResetAt: string

  if (!existing || new Date(existing.reset_at).getTime() < now) {
    // Fresh window (no row OR existing row's window expired)
    newCount = 1
    newResetAt = windowEndIso
  } else {
    // Increment within current window
    newCount = existing.count + 1
    newResetAt = existing.reset_at
  }

  const { error: upsertError } = await client.from(RATE_LIMITS_TABLE).upsert(
    {
      bucket,
      key,
      count: newCount,
      reset_at: newResetAt,
      updated_at: new Date(now).toISOString(),
    },
    { onConflict: 'bucket,key' },
  )

  if (upsertError) {
    throw new Error(`[supabase-rate-limits] write failed: ${upsertError.message}`)
  }

  return {
    limited: newCount >= max,
    remaining: Math.max(0, max - newCount),
    resetAt: new Date(newResetAt).getTime(),
  }
}

export async function clearAttemptsInSupabase(bucket: string, key: string): Promise<void> {
  const client = getSupabaseClient()
  if (!client) {
    throw new Error('[supabase-rate-limits] client not configured')
  }

  const { error } = await client
    .from(RATE_LIMITS_TABLE)
    .delete()
    .eq('bucket', bucket)
    .eq('key', key)

  if (error) {
    throw new Error(`[supabase-rate-limits] clear failed: ${error.message}`)
  }
}

export async function purgeExpiredFromSupabase(): Promise<{ deletedCount: number }> {
  const client = getSupabaseClient()
  if (!client) {
    throw new Error('[supabase-rate-limits] client not configured')
  }

  const now = new Date().toISOString()
  const { error, count } = await client
    .from(RATE_LIMITS_TABLE)
    .delete({ count: 'exact' })
    .lt('reset_at', now)

  if (error) {
    throw new Error(`[supabase-rate-limits] purge failed: ${error.message}`)
  }

  return { deletedCount: count ?? 0 }
}

// Test-only helper. Mirrored from rate-limiter.ts __resetAllForTests
// (R-08 guard applied at caller too). Deletes ALL rows in public.rate_limits.
// Production NODE_ENV guard lives in rate-limiter.ts caller; this function
// is a low-level primitive trusting the caller's gate.
export async function __resetAllInSupabaseForTests(): Promise<void> {
  const client = getSupabaseClient()
  if (!client) return // No Supabase configured = nothing to clear (fallback path)

  // Delete ALL rows. supabase-js doesn't have a "delete all" — use a
  // tautological NEQ predicate to match every row.
  const { error } = await client
    .from(RATE_LIMITS_TABLE)
    .delete()
    .neq('bucket', '__never_match_sentinel__')

  if (error) {
    throw new Error(`[supabase-rate-limits] test reset failed: ${error.message}`)
  }
}
