// R-API-07 closure (Wave 5B): quota helper unit tests.
//
// Validates the per-user count quota + per-asset size quota helpers
// that gate certification/education uploads against Supabase Storage
// exhaustion DoS (Phase 3.A audit R-API-07).
//
// SENIOR ARCHITECT NOTE: pure unit tests — quota.ts has no I/O, no env
// reads, no time dependence. The constants exported from the module
// are policy values; tests assert the gate-decision semantics
// (under-limit ok, at-or-above-limit blocked, size cap exact-edge).
//
// REJECTED ALTERNATIVE: parametrize a single test over a table of
// inputs. Rejected — explicit named cases produce richer failure
// diagnostics and document each gate-state behavior for auditors.

import {
  MAX_AVATAR_ASSET_BYTES,
  MAX_CERTIFICATION_ASSET_BYTES,
  MAX_CERTIFICATIONS_PER_USER,
  MAX_EDUCATION_PER_USER,
  checkCountQuota,
  checkSizeQuota,
  quotaReasonToStatus,
} from './quota'

describe('quota (R-API-07 closure)', () => {
  // ─── T-QC01: count quota — under-limit / at-limit / over-limit ─────────────

  it('T-QC01 — checkCountQuota gates at the configured limit (>= blocks, < passes)', () => {
    // Under limit: ok
    expect(checkCountQuota(0, 20)).toEqual({ ok: true })
    expect(checkCountQuota(19, 20)).toEqual({ ok: true })

    // At limit: blocked (>= semantics — the 20th add would push to 21)
    expect(checkCountQuota(20, 20)).toEqual({
      ok: false,
      reason: 'count_exceeded',
      current: 20,
      limit: 20,
    })

    // Over limit: blocked
    expect(checkCountQuota(100, 20)).toEqual({
      ok: false,
      reason: 'count_exceeded',
      current: 100,
      limit: 20,
    })
  })

  // ─── T-QC02: size quota — under-limit / at-limit / over-limit ──────────────

  it('T-QC02 — checkSizeQuota gates strictly above the byte cap (== passes, > blocks)', () => {
    const CAP = 10 * 1024 * 1024 // 10 MB — matches MAX_CERTIFICATION_ASSET_BYTES

    // Under cap: ok
    expect(checkSizeQuota(0, CAP)).toEqual({ ok: true })
    expect(checkSizeQuota(CAP - 1, CAP)).toEqual({ ok: true })

    // Exactly AT cap: ok (>-only semantics — a 10 MB upload is allowed,
    // 10 MB + 1 byte is not). Matches the prior contract in
    // portfolio-assets.ts MAX_*_ASSET_BYTES checks.
    expect(checkSizeQuota(CAP, CAP)).toEqual({ ok: true })

    // Over cap: blocked
    expect(checkSizeQuota(CAP + 1, CAP)).toEqual({
      ok: false,
      reason: 'size_exceeded',
      current: CAP + 1,
      limit: CAP,
    })
  })

  // ─── T-QC03: HTTP status mapping ───────────────────────────────────────────

  it('T-QC03 — quotaReasonToStatus maps count→429 and size→413 per RFC 7231', () => {
    // count_exceeded → 429 Too Many Requests (the user has too many
    // assets registered; rate-limit-style "back off and try later")
    expect(quotaReasonToStatus('count_exceeded')).toBe(429)

    // size_exceeded → 413 Payload Too Large (the single request payload
    // exceeds the per-asset cap; canonical RFC 7231 mapping)
    expect(quotaReasonToStatus('size_exceeded')).toBe(413)
  })

  // ─── T-QC04: policy constants — discoverability + spec invariants ──────────

  it('T-QC04 — quota constants expose the documented Wave 5B policy values', () => {
    // Per-user count caps (UX-realistic; audit-friendly source of truth)
    expect(MAX_CERTIFICATIONS_PER_USER).toBe(20)
    expect(MAX_EDUCATION_PER_USER).toBe(20)

    // Per-asset byte caps (10 MB certs, 5 MB avatars — matches
    // portfolio-assets.ts MAX_*_ASSET_BYTES; module re-export here is
    // for discoverability, not duplication of policy)
    expect(MAX_CERTIFICATION_ASSET_BYTES).toBe(10 * 1024 * 1024)
    expect(MAX_AVATAR_ASSET_BYTES).toBe(5 * 1024 * 1024)

    // Avatar cap is tighter than cert cap — invariant the audit expects
    expect(MAX_AVATAR_ASSET_BYTES).toBeLessThan(MAX_CERTIFICATION_ASSET_BYTES)
  })
})
