import {
  isAllowedUsername,
  isValidPassword,
  isValidEmail,
  validateEmail,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  EMAIL_MAX_LENGTH,
} from './identity-validation'

describe('identity-validation', () => {
  // ─── Username ────────────────────────────────────────────────────────────────
  // NOTE: audit referenced `isValidUsername`; actual export is `isAllowedUsername`.
  // Same behavior, different name.

  describe('isAllowedUsername', () => {
    it('T-IV01: username 3 chars (min boundary) is valid', () => {
      expect(isAllowedUsername('abc')).toBe(true)
    })

    it('T-IV02: username 32 chars (max boundary) is valid', () => {
      expect(isAllowedUsername('a'.repeat(32))).toBe(true)
    })

    it('T-IV03: username 2 chars (below min) is invalid', () => {
      expect(isAllowedUsername('ab')).toBe(false)
    })

    it('T-IV04: username 33 chars (above max) is invalid', () => {
      expect(isAllowedUsername('a'.repeat(33))).toBe(false)
    })

    it('T-IV05: username with Unicode character is rejected (R-10)', () => {
      // USERNAME_RE = /^[a-zA-Z0-9_.-]{3,32}$/ — Unicode chars outside ASCII
      // are not in the character class, so they are rejected. This is correct
      // behavior and should remain protected against regression.
      expect(isAllowedUsername('üser')).toBe(false)
      expect(isAllowedUsername('αβγ')).toBe(false)
    })

    it('T-IV06: username a..b consecutive dots accepted — gap (R-09)', () => {
      // GAP DOCUMENTATION: USERNAME_RE = /^[a-zA-Z0-9_.-]{3,32}$/ has no
      // constraint against consecutive dots. `a..b` matches because each `.`
      // individually satisfies the character class.
      //
      // R-09 risk: while this is not a security-critical gap on its own, a
      // username like `a..b` can cause confusion in audit logs, report attribution,
      // and may conflict with filesystem or DNS conventions if usernames are ever
      // used as path segments. Combined with the short reserved-username list
      // (only 3 entries), a social-engineering vector exists.
      //
      // This test asserts CURRENT behavior (accepted). It will fail intentionally
      // when the validator is hardened to reject consecutive dots — that failure
      // is the expected regression signal for Phase 1.5 hardening.
      expect(isAllowedUsername('a..b')).toBe(true) // gap: should be false
    })
  })

  // ─── Email ───────────────────────────────────────────────────────────────────

  describe('validateEmail', () => {
    it('T-IV07: validateEmail trims whitespace and lowercases, returns canonical string', () => {
      // validateEmail returns ValidateResult<string> — on success, `value` is the
      // trimmed + lowercased canonical form. This is stronger than a boolean check:
      // it verifies that callers who store `result.value` directly get the correct
      // emailKey for uniqueness lookups.
      const result = validateEmail('  USER@EXAMPLE.COM  ')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toBe('user@example.com')
      }
    })

    it('T-IV08: email > 254 chars (RFC 5321 cap) is invalid', () => {
      // local = 64 chars, @ = 1, domain = 190 chars = 255 total > EMAIL_MAX_LENGTH
      const local = 'a'.repeat(64)
      const domain = 'b'.repeat(186) + '.com'
      const email = `${local}@${domain}`
      expect(email.length).toBeGreaterThan(EMAIL_MAX_LENGTH)
      expect(isValidEmail(email)).toBe(false)
    })

    it('T-IV09: email with no TLD is invalid', () => {
      // EMAIL_RE requires `.tld` with TLD ≥ 2 chars after the domain.
      expect(isValidEmail('user@localhost')).toBe(false)
      expect(isValidEmail('user@nodot')).toBe(false)
    })
  })

  // ─── Password ─────────────────────────────────────────────────────────────────

  describe('isValidPassword', () => {
    it('T-IV10: password 8 chars (min boundary) is valid', () => {
      expect(isValidPassword('a'.repeat(PASSWORD_MIN_LENGTH))).toBe(true)
    })

    it('T-IV11: password 256 chars (max boundary) is valid', () => {
      expect(isValidPassword('a'.repeat(PASSWORD_MAX_LENGTH))).toBe(true)
    })

    it('T-IV12: password 7 chars (below min) is invalid', () => {
      expect(isValidPassword('a'.repeat(PASSWORD_MIN_LENGTH - 1))).toBe(false)
    })

    it('T-IV13: password 257 chars (above max) is invalid', () => {
      expect(isValidPassword('a'.repeat(PASSWORD_MAX_LENGTH + 1))).toBe(false)
    })
  })
})
