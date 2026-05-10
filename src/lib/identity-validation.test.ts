import {
  isAllowedUsername,
  isValidDisplayName,
  isValidPassword,
  isValidEmail,
  validateEmail,
  DISPLAY_NAME_MIN_LENGTH,
  DISPLAY_NAME_MAX_LENGTH,
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

  // ─── displayName ─────────────────────────────────────────────────────────────

  describe('isValidDisplayName', () => {
    it('T-IV14: displayName with Cyrillic accepted (homoglyph gap, R-10)', () => {
      // isValidDisplayName is length-only: `value.length >= 2 && value.length <= 120`.
      // No character-class restriction. A Cyrillic `а` (U+0430) is visually
      // indistinguishable from Latin `a` in most fonts. A user can set their
      // displayName to `аdmin` (Cyrillic а + Latin dmin) and appear as `admin`
      // in UI attribution, audit logs, and report records.
      //
      // R-10: this is accepted CURRENT behavior. Hardening would require Unicode
      // normalization + confusable-character detection or a restricted charset,
      // which is Phase 1.5 scope.
      expect(isValidDisplayName('аdmin')).toBe(true) // Cyrillic 'а', not Latin 'a'
    })

    it('T-IV15: displayName 2 and 120 chars valid; 121 chars invalid', () => {
      expect(isValidDisplayName('a'.repeat(DISPLAY_NAME_MIN_LENGTH))).toBe(true)
      expect(isValidDisplayName('a'.repeat(DISPLAY_NAME_MAX_LENGTH))).toBe(true)
      expect(isValidDisplayName('a'.repeat(DISPLAY_NAME_MAX_LENGTH + 1))).toBe(false)
    })

    it('T-IV16: displayName <script> accepted — gap (R-13)', () => {
      // GAP DOCUMENTATION: isValidDisplayName performs length-only validation.
      // The payload `<script>alert(1)</script>` (27 chars) is within the 2-120
      // range and is therefore accepted.
      //
      // R-13 downstream risk: email-templates.ts interpolates displayName directly
      // into the HTML email body without HTML-escaping. An attacker who registers
      // with this displayName receives a verification email whose HTML body contains
      // the literal script tag. Outlook desktop and many 3rd-party email clients
      // render HTML; this enables self-XSS during own verify flow and stored-XSS
      // risk if displayName surfaces in admin UI (Phase 3 audit).
      //
      // This test asserts CURRENT behavior (accepted). It will fail intentionally
      // when the validator is hardened to strip/reject HTML chars — that failure
      // is the expected regression signal.
      expect(isValidDisplayName('<script>alert(1)</script>')).toBe(true) // gap: R-13
    })

    it('T-IV17: displayName <img src=x onerror=alert(1)> accepted — gap (R-13)', () => {
      // GAP DOCUMENTATION: Same root cause as T-IV16. An img onerror payload
      // (32 chars) is within the 2-120 length range and is accepted unchanged.
      //
      // R-13: Outlook desktop and many mobile clients auto-render img tags.
      // The onerror handler fires when `src=x` fails to load. This is a more
      // reliably rendered vector than a script tag (which many clients strip).
      expect(isValidDisplayName('<img src=x onerror=alert(1)>')).toBe(true) // gap: R-13
    })

    it('T-IV18: displayName containing \\n accepted — gap (R-14)', () => {
      // GAP DOCUMENTATION: isValidDisplayName is length-only; newline characters
      // count as 1 towards length and are not rejected.
      //
      // R-14 downstream risk: email-templates.ts interpolates displayName into the
      // plain-text email body. A LF character splits the plain-text into two lines.
      // An attacker can inject fake siberlab-branded footer text after their name:
      //   displayName = "Mehmet\n\n[siberlab] Hesabın askıya alındı: evil.com"
      // Plain-text readers see the fabricated footer interleaved with legitimate content.
      expect(isValidDisplayName('Mehmet\nEvil')).toBe(true) // gap: R-14
    })

    it('T-IV19: displayName Foo\\r\\nBar accepted — gap (R-14)', () => {
      // GAP DOCUMENTATION: CRLF sequence is the canonical line-ending in email
      // headers (RFC 2822). While displayName appears in the email body (not
      // headers) in current templates, CRLF injection is a wider risk if
      // displayName is ever surfaced in a mail header (e.g. From: display name).
      // The validator accepts CRLF because length is the only constraint.
      //
      // R-14: same phishing-assist vector as T-IV18, with CRLF for Windows/email
      // clients that normalize LF to CRLF or expect CRLF line endings.
      expect(isValidDisplayName('Foo\r\nBar')).toBe(true) // gap: R-14
    })
  })
})
