/**
 * Per-user storage quota constants and helpers.
 * Wave 5B — R-API-07 closure (Phase 3.A audit).
 *
 * Constants centralize quota policy so it's discoverable from one
 * location (audit-friendly). Per-asset byte limits already exist in
 * `portfolio-assets.ts` (MAX_CERTIFICATION_ASSET_BYTES, MAX_AVATAR
 * _ASSET_BYTES) — this module adds the COUNT-quota layer that was
 * missing.
 *
 * SENIOR ARCHITECT NOTE: Per-user count quotas are a UX safeguard,
 * not a security boundary. The portfolio surface naturally limits
 * itself (a real user won't have 1000 certifications), but without
 * an enforced cap, a malicious authenticated user could fill the
 * Supabase Storage bucket with 10 MB × N uploads. R-API-07 audit
 * called this out as Storage-exhaustion DoS vector.
 *
 * REJECTED ALTERNATIVE: virus-scanning integration (ClamAV /
 * VirusTotal). Rejected — deferred to Phase 6 operational decision;
 * adds a new dependency tree + service integration outside Wave 5B
 * scope.
 */

/** Per-user count cap on certifications. UX-realistic; exceeding
 * this strongly suggests automated abuse. Configurable via
 * MAX_CERTIFICATIONS_PER_USER constant only — no env override
 * (security-policy boundary stays in source). */
export const MAX_CERTIFICATIONS_PER_USER = 20

/** Per-user count cap on education entries. Matches certifications
 * policy. */
export const MAX_EDUCATION_PER_USER = 20

/** Per-asset hard size cap. Aligns with the existing
 * `MAX_CERTIFICATION_ASSET_BYTES` in portfolio-assets.ts (10 MB)
 * but documented here for discoverability. R-API-07 mentor decision:
 * keep 10 MB for cert assets, tighten avatar to 5 MB (already in
 * place per portfolio-assets.ts MAX_AVATAR_ASSET_BYTES). */
export const MAX_CERTIFICATION_ASSET_BYTES = 10 * 1024 * 1024
export const MAX_AVATAR_ASSET_BYTES = 5 * 1024 * 1024

export interface QuotaResult {
  ok: boolean
  /** Reason code for client-side mapping to HTTP status. */
  reason?: 'count_exceeded' | 'size_exceeded'
  /** Current count or size when failing — useful for error messages. */
  current?: number
  /** The configured limit at decision time. */
  limit?: number
}

export function checkCountQuota(currentCount: number, limit: number): QuotaResult {
  if (currentCount >= limit) {
    return { ok: false, reason: 'count_exceeded', current: currentCount, limit }
  }
  return { ok: true }
}

export function checkSizeQuota(byteSize: number, limit: number): QuotaResult {
  if (byteSize > limit) {
    return { ok: false, reason: 'size_exceeded', current: byteSize, limit }
  }
  return { ok: true }
}

/**
 * Map a quota failure reason to its canonical HTTP status code per
 * RFC 7231:
 *   - count_exceeded → 429 Too Many Requests
 *   - size_exceeded  → 413 Payload Too Large
 */
export function quotaReasonToStatus(reason: NonNullable<QuotaResult['reason']>): 413 | 429 {
  return reason === 'size_exceeded' ? 413 : 429
}
