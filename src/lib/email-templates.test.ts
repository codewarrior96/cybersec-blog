import { renderVerificationEmail, renderPasswordResetEmail } from './email-templates'

describe('email-templates', () => {
  // ─── Verification email ────────────────────────────────────────────────────

  describe('renderVerificationEmail', () => {
    it('T-ET01: returns subject/html/text containing username and verifyUrl', () => {
      // SENIOR ARCHITECT NOTE: this is the email contract shape test —
      // a regression tripwire against accidental breakage. If a refactor
      // drops the text version, plain-text-only readers (CLI mail clients,
      // accessibility tools, screen readers in some configs) lose access.
      // If subject becomes empty, the email lands in inbox with no preview.
      // Asserting all three fields guards the multi-part contract.
      const result = renderVerificationEmail({
        username: 'salim',
        verifyUrl: 'https://siberlab.dev/verify/abc123',
      })
      expect(result.subject).toBeTruthy()
      expect(result.subject.length).toBeGreaterThan(0)
      expect(result.html).toContain('salim')
      expect(result.html).toContain('https://siberlab.dev/verify/abc123')
      expect(result.text).toContain('salim')
      expect(result.text).toContain('https://siberlab.dev/verify/abc123')
    })

    it('T-ET03: empty username falls back to "Operator"', () => {
      // SENIOR ARCHITECT NOTE: source uses `params.username || 'Operator'`
      // (email-templates.ts L112 for verify, L158 for reset). Empty string,
      // null, and undefined all coerce to falsy and trigger the fallback.
      // Regression target: a refactor to `??` would change behavior — empty
      // string would no longer fall back, leaking "Merhaba ," to recipients
      // and breaking the personalization contract for failed-form
      // submissions where the username field arrived as ''.
      // REJECTED ALTERNATIVE: also test with null/undefined casts. Rejected
      // because the source path `||` covers all three uniformly; one
      // probe (the most common runtime value) is sufficient for regression.
      const result = renderVerificationEmail({
        username: '',
        verifyUrl: 'https://siberlab.dev/verify/abc',
      })
      expect(result.html).toContain('Operator')
      expect(result.text).toContain('Operator')
    })

    it('T-ET04: username <img src=x onerror=alert(1)> HTML-escaped in verification email (R-13 FIXED in 6d78cf1)', () => {
      // FIX EVIDENCE: Phase 1.5.2 R-13 — defense-in-depth HTML injection fix.
      // email-templates.ts now uses escapeHtml (src/lib/html-escape.ts) on the
      // safeName interpolation. The payload `<img src=x onerror=alert(1)>` is
      // transformed to `&lt;img src=x onerror=alert(1)&gt;` in the rendered HTML.
      //
      // Defense-in-depth: validator layer (T-IV16/T-IV17) ALSO rejects this
      // payload at register/profile-update — but template-layer escape protects
      // any future code path that bypasses the validator (e.g. legacy DB data,
      // future surfaces, or admin tools).
      //
      // Twin assertion: raw payload absent AND escaped form present. Both
      // required — passing only the absent check could mask a different bug
      // where the payload is silently stripped instead of escaped.
      const payload = '<img src=x onerror=alert(1)>'
      const escaped = '&lt;img src=x onerror=alert(1)&gt;'
      const result = renderVerificationEmail({
        username: payload,
        verifyUrl: 'https://siberlab.dev/verify/abc',
      })
      expect(result.html).not.toContain(payload)
      expect(result.html).toContain(escaped)
    })

    it('T-ET06: username with CRLF stripped to space in plain text body (R-14 FIXED in <COMMIT_HASH_TBD>)', () => {
      // FIX EVIDENCE: Phase 1.5.10 R-14 Layer 2 — email-templates.ts now
      // applies stripCrlf() (.replace(/[\r\n]+/g, ' ')) to displayName
      // BEFORE interpolation. Even if the validator-layer R-14 fix
      // (DISPLAY_NAME_DENYLIST_RE) is bypassed by an admin tool, legacy
      // data, or future surface, the template-layer scrub still strips
      // CR/LF before the rendered output.
      //
      // Defense-in-depth duality:
      //   Layer 1 (validator, identity-validation.ts T-IV18/T-IV19):
      //     rejects \r\n at registration entry. Validator-layer gate.
      //   Layer 2 (template, this test): defensive scrub on render.
      //     Bypass-resilience for code paths that skip the validator.
      //
      // Both required (R-13 pattern lineage). Validator alone leaves
      // pre-existing or admin-injected CRLF data exposed; template
      // alone could be skipped by a refactor that interpolates the raw
      // displayName field directly.
      //
      // SENIOR ARCHITECT NOTE: stripCrlf collapses runs of CR/LF into a
      // single space. "Foo\r\nBar" → "Foo Bar" (visually contiguous
      // name preserved). "Foo\n\r\nBar" → "Foo Bar" (multi-char
      // sequences collapsed to one space, no double-spaces leaked).
      //
      // REJECTED ALTERNATIVE: drop the displayName entirely if it
      // contains CR/LF. Rejected because the template falls back to
      // 'Operator' only when username is empty — silent-drop would
      // surprise legitimate users whose name accidentally contained
      // a control character (rare but possible via copy-paste edge cases).
      const result = renderVerificationEmail({
        username: 'Foo\r\nBar',
        verifyUrl: 'https://siberlab.dev/verify/abc',
      })
      // Raw CRLF in the user-portion of plain text body must be stripped.
      // The template's own array.join('\n') still produces newlines
      // between lines — those are intentional structure, not user input.
      expect(result.text).not.toContain('Foo\r\nBar')
      expect(result.text).toContain('Foo Bar') // CRLF collapsed to space
    })

    it('T-ET07: verifyUrl javascript:alert(1) rejected by assertSafeUrl (R-15 FIXED in <COMMIT_HASH_TBD>)', () => {
      // FIX EVIDENCE: Phase 1.5.10 R-15 Layer 1 — renderVerificationEmail
      // now invokes assertSafeUrl(verifyUrl, 'verifyUrl') BEFORE any
      // template interpolation. The helper:
      //   1. new URL(url) — parses (TypeError on malformed)
      //   2. Scheme allowlist check:
      //      - production: ['https:'] only
      //      - dev/test: ['https:', 'http:']
      //   3. Throws EmailUrlValidationError on either failure mode
      //
      // The previous gap (raw `<a href="${verifyUrl}">` interpolation
      // with no scheme validation) allowed javascript:, data:, file:,
      // and other dangerous schemes through to the recipient's inbox.
      // Now: render throws before any HTML produced.
      //
      // SENIOR ARCHITECT NOTE: caller catch (email.ts
      // sendVerificationEmail) handles the throw, returns
      // { ok: false, error } — route handlers log console.warn + skip
      // email send. Anti-enumeration response shape preserved at route
      // layer (T-FG02/T-VR02 still return generic-200 for unknown
      // emails; URL validation failure caught upstream of send).
      //
      // REJECTED ALTERNATIVE: rewrite javascript: → https:// silently.
      // Rejected because silent rewriting masks deployment-level misconfig
      // (poisoned NEXT_PUBLIC_APP_URL) and produces a working-but-wrong
      // email link. Throwing surfaces the operator error and (when R-12
      // audit log integration lands in Phase 1.5.11) creates a forensic
      // record.
      expect(() =>
        renderVerificationEmail({
          username: 'salim',
          verifyUrl: 'javascript:alert(1)',
        }),
      ).toThrow(/scheme.*not in allowlist|scheme "javascript:"/i)
    })

    it('T-ET07b: verifyUrl HTTPS rendered correctly (R-15 happy-path positive control)', () => {
      // FIX EVIDENCE: positive-control pair for T-ET07. Verifies the
      // canonical production URL shape passes assertSafeUrl without
      // throwing. Pairs T-ET07 (reject malicious) + T-ET07b (accept
      // legitimate) to fully document the new contract.
      const result = renderVerificationEmail({
        username: 'salim',
        verifyUrl: 'https://siberlab.dev/verify/abc123',
      })
      expect(result.html).toContain('href="https://siberlab.dev/verify/abc123"')
      expect(result.text).toContain('https://siberlab.dev/verify/abc123')
    })

    it('T-ET07c: verifyUrl HTTP accepted in test/dev env (env-gated allowlist)', () => {
      // FIX EVIDENCE: assertSafeUrl's allowlist is env-gated.
      // Production (NODE_ENV=production): ['https:'] only — canonical
      // siberlab.dev always HTTPS. Dev/test (NODE_ENV=test as set in
      // setup.ts): ['https:', 'http:'] — local dev runs on
      // http://localhost:3000.
      //
      // This test confirms the dev/test path. Production-only HTTPS
      // enforcement is covered indirectly by T-ET07 (any non-https
      // scheme rejected in production) and would need vi.stubEnv
      // NODE_ENV=production to test directly — out of scope for the
      // template-layer test (production NODE_ENV stubbing has
      // R-08-guard cleanup interaction we already deal with in
      // T-AD07-09).
      //
      // SENIOR ARCHITECT NOTE: baseline NODE_ENV is 'test' from
      // setup.ts. The http:// URL below must succeed without
      // assertSafeUrl throwing.
      const result = renderVerificationEmail({
        username: 'salim',
        verifyUrl: 'http://localhost:3000/verify/abc123',
      })
      expect(result.html).toContain('href="http://localhost:3000/verify/abc123"')
    })
  })

  // ─── Password reset email ──────────────────────────────────────────────────

  describe('renderPasswordResetEmail', () => {
    it('T-ET02: returns subject/html/text containing username and resetUrl', () => {
      // Email contract shape test (reset variant). Same regression
      // tripwire rationale as T-ET01 for the verification path.
      const result = renderPasswordResetEmail({
        username: 'salim',
        resetUrl: 'https://siberlab.dev/reset/xyz789',
      })
      expect(result.subject).toBeTruthy()
      expect(result.subject.length).toBeGreaterThan(0)
      expect(result.html).toContain('salim')
      expect(result.html).toContain('https://siberlab.dev/reset/xyz789')
      expect(result.text).toContain('salim')
      expect(result.text).toContain('https://siberlab.dev/reset/xyz789')
    })

    it('T-ET05: username <img src=x onerror=alert(1)> HTML-escaped in password reset email (R-13 FIXED in 6d78cf1)', () => {
      // FIX EVIDENCE: Reset-path twin of T-ET04. Same escapeHtml application
      // in renderPasswordResetEmail. Both render functions must remain guarded;
      // a regression in only one path would leave half the surface exposed.
      const payload = '<img src=x onerror=alert(1)>'
      const escaped = '&lt;img src=x onerror=alert(1)&gt;'
      const result = renderPasswordResetEmail({
        username: payload,
        resetUrl: 'https://siberlab.dev/reset/xyz',
      })
      expect(result.html).not.toContain(payload)
      expect(result.html).toContain(escaped)
    })
  })
})
