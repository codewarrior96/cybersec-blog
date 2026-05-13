import { keyPreview, recipientHash, sanitizeErrorMessage } from './audit-helpers'

describe('audit-helpers', () => {
  // ─── keyPreview (R-06 privacy primitive) ────────────────────────────────────

  describe('keyPreview', () => {
    it('T-AH01: keyPreview returns deterministic 8-char lowercase hex prefix (R-06 FIXED in 5d2f6cc)', () => {
      // FIX EVIDENCE: Phase 1.5.11 R-06 — keyPreview hashes IP/emailKey
      // via SHA-256 + returns first 8 hex chars. Deterministic: same input
      // → same prefix. Privacy: full identifier never logged but rotation
      // patterns detectable (counting distinct previews across log entries).
      //
      // SENIOR ARCHITECT NOTE: 8 chars = 32 bits of entropy = ~4B unique
      // values before collision probability >50% (birthday paradox at
      // ~65K unique inputs). Sufficient for forensic correlation at our
      // scale; deliberately too short for reverse-lookup attempts.
      const a = keyPreview('192.0.2.1')
      const b = keyPreview('192.0.2.1')
      expect(a).toBe(b) // deterministic
      expect(a).toMatch(/^[0-9a-f]{8}$/) // 8 lowercase hex chars
    })

    it('T-AH02: keyPreview empty input returns "<empty>" sentinel', () => {
      // Edge case: empty string input. Returns sentinel rather than
      // attempting SHA-256 on empty (which would still produce a valid
      // hash but mask the "no key" semantic).
      expect(keyPreview('')).toBe('<empty>')
    })

    it('T-AH03: keyPreview different inputs produce different prefixes', () => {
      // Sanity: hash collision probability for two random strings is
      // negligible. This test confirms SHA-256 is actually being used
      // (not a constant return). Catches regression where keyPreview
      // accidentally returns a fixed value.
      const a = keyPreview('192.0.2.1')
      const b = keyPreview('192.0.2.2')
      expect(a).not.toBe(b)
    })
  })

  // ─── recipientHash (R-12 privacy primitive) ─────────────────────────────────

  describe('recipientHash', () => {
    it('T-AH04: recipientHash returns 16-char hex prefix + normalizes case/whitespace (R-12 FIXED in 5d2f6cc)', () => {
      // FIX EVIDENCE: Phase 1.5.11 R-12 — recipientHash normalizes email
      // (lowercase + trim) BEFORE hashing, so "User@Example.com" and
      // "user@example.com" produce the same hash. This lets forensic
      // correlation work even when users register/login with case
      // variants. 16-char prefix = 64 bits of entropy (wider than
      // keyPreview because email cardinality exceeds IP cardinality at
      // our scale).
      const a = recipientHash('user@example.com')
      const b = recipientHash('User@Example.com')
      const c = recipientHash('  user@example.com  ')
      expect(a).toBe(b) // case-normalized
      expect(a).toBe(c) // whitespace-normalized
      expect(a).toMatch(/^[0-9a-f]{16}$/) // 16 lowercase hex chars
    })
  })

  // ─── sanitizeErrorMessage (R-12 PII filter) ─────────────────────────────────

  describe('sanitizeErrorMessage', () => {
    it('T-AH05: sanitizeErrorMessage allowlist match returns raw message', () => {
      // FIX EVIDENCE: Phase 1.5.11 R-12 — sanitizeErrorMessage filters
      // error messages through an allowlist of known-PII-free patterns
      // before they reach the audit log. Known-safe Resend errors
      // (RESEND_API_KEY missing, Email send failed, etc.) pass through
      // unchanged; unknown messages collapse to 'unknown' to prevent
      // accidental PII disclosure via novel error paths.
      expect(sanitizeErrorMessage(new Error('RESEND_API_KEY missing'))).toBe(
        'RESEND_API_KEY missing',
      )
      expect(sanitizeErrorMessage(new Error('Email send failed'))).toBe('Email send failed')
      expect(
        sanitizeErrorMessage(new Error('[email-templates] verifyUrl validation failed: scheme rejected')),
      ).toBe('[email-templates] verifyUrl validation failed: scheme rejected')
    })

    it('T-AH06: sanitizeErrorMessage unknown pattern returns "unknown" fallback', () => {
      // FIX EVIDENCE: messages not matching any allowlist pattern collapse
      // to 'unknown'. This is the conservative-by-default policy: a novel
      // error path that hasn't been audited for PII content gets a
      // generic placeholder rather than leaking potentially-sensitive
      // string content into the audit log.
      //
      // REJECTED ALTERNATIVE: regex-strip email/IP/URL patterns. Rejected
      // because adversarial inputs can encode identifiers in non-canonical
      // forms (URL-encoded, base64, JSON, etc.). Allowlist + fallback is
      // strictly conservative.
      expect(
        sanitizeErrorMessage(new Error('Resend API error: 500 — user@example.com bounced')),
      ).toBe('unknown')
      expect(sanitizeErrorMessage(new Error('some other unexpected error'))).toBe('unknown')
      expect(sanitizeErrorMessage(undefined)).toBe('unknown')
      expect(sanitizeErrorMessage(null)).toBe('unknown')
    })
  })
})
