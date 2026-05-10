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

    it('T-ET04: username <img src=x onerror=alert(1)> renders literally in HTML — gap (R-13)', () => {
      // SENIOR ARCHITECT NOTE: R-13 (HTML injection) — DOWNSTREAM half of
      // the two-layer documentation pattern paired with T-IV16/T-IV17
      // (Phase 1.D.3, upstream identity-validation gap).
      //
      // Why upstream validator does not reject: isValidDisplayName performs
      // a length-only check (2-120 chars). It does NOT filter HTML tags,
      // attributes, or event handlers. A malicious displayName flows into
      // the email template's username field via register/profile-update
      // routes (the field rename does not sanitize).
      //
      // Downstream consequence: rendered email body contains literal `<img>`
      // markup with `onerror` JavaScript. Outlook desktop and many third-
      // party clients render HTML emails verbatim — the `<img>` payload
      // triggers on image-loading retry. Self-XSS in the recipient's own
      // verification email and broader stored-XSS risk wherever displayName
      // surfaces in admin UI without escape (Phase 3 audit).
      //
      // Cross-reference upstream: T-IV16, T-IV17 (Phase 1.D.3, identity-
      // validation.test.ts) — both document the validator-layer gap.
      //
      // REJECTED ALTERNATIVE: only test at validator OR template layer.
      // Rejected — a fix that escapes at one layer but not the other still
      // leaves a partial gap (e.g. legacy data already in the database with
      // unescaped payloads would render unsafely if only the validator is
      // patched). Defense-in-depth requires both layers guarded.
      //
      // Hardening landing: when this file adds HTML escaping (likely via
      // `he` package or a sanitizer), this assertion will fail. At that
      // point flip to assert the payload is HTML-encoded (e.g. result.html
      // does NOT contain raw `<img`, but contains `&lt;img`).
      const payload = '<img src=x onerror=alert(1)>'
      const result = renderVerificationEmail({
        username: payload,
        verifyUrl: 'https://siberlab.dev/verify/abc',
      })
      expect(result.html).toContain(payload)
    })

    it('T-ET06: username with CRLF produces literal \\r\\n in plain text body — gap (R-14)', () => {
      // SENIOR ARCHITECT NOTE: R-14 (CRLF injection) — DOWNSTREAM half
      // paired with T-IV18/T-IV19 (Phase 1.D.3 upstream gap).
      //
      // Why upstream validator does not reject: isValidDisplayName accepts
      // any characters within the 2-120 length window — `\r` and `\n` are
      // not filtered. Identity-validation has no control-character scan.
      //
      // Downstream consequence: text body uses `Merhaba ${safeName},`
      // template literal (email-templates.ts L116). With safeName containing
      // CRLF, the rendered text fractures across multiple lines:
      // `Merhaba Foo\r\nBar,` — phishing assist where attacker injects fake
      // siberlab footer/instructions interleaved with legitimate copy.
      // Plain-text email readers (CLI mail, accessibility tools, some
      // mobile previews) render exactly what they receive — the attacker-
      // controlled second line appears as if it were part of the
      // legitimate template body.
      //
      // Cross-reference upstream: T-IV18, T-IV19 (Phase 1.D.3) — document
      // that the validator accepts both bare \n and CRLF \r\n in
      // displayName.
      //
      // REJECTED ALTERNATIVE: assert split('\n').length > N. Rejected
      // because the text template already contains intentional newlines
      // from the array.join('\n') pattern (L115-125), so a line-count
      // assertion is brittle and noise-prone. Direct substring check on
      // the raw CRLF survival is the precise gap signal.
      //
      // Hardening landing: when validator strips control chars OR template
      // sanitizes safeName before interpolation, this assertion will fail.
      // Flip to assert the CRLF is absent from text output (e.g.
      // expect(result.text).not.toContain('\r\n') for the user portion, or
      // assert safeName is replaced with a sanitized variant).
      const result = renderVerificationEmail({
        username: 'Foo\r\nBar',
        verifyUrl: 'https://siberlab.dev/verify/abc',
      })
      expect(result.text).toContain('Foo\r\nBar')
    })

    it('T-ET07: verifyUrl javascript:alert(1) rendered as href verbatim — gap (R-15)', () => {
      // SENIOR ARCHITECT NOTE: R-15 (URL substrate trust) — CONFIGURATION-
      // level gap. Email template performs raw `<a href="${verifyUrl}">`
      // interpolation (email-templates.ts L130) with no scheme allowlist
      // or URL parser validation.
      //
      // Attack vector: NEXT_PUBLIC_APP_URL env misconfig (or Host header
      // injection in dev) → upstream route handler constructs verifyUrl
      // using the poisoned base → template renders `<a href="javascript:
      // alert(1)">`. Recipient clicks the verification button → JavaScript
      // executes in their email client's context (where supported, e.g.
      // older webmail clients) or the link silently fails. Even when
      // execution is blocked, the poisoned href has already passed all
      // server-side checks and is now in the recipient's inbox forever.
      //
      // Note: `process.env.NEXT_PUBLIC_APP_URL` is NOT read in this module
      // — the URL arrives as a direct function parameter. R-15 is therefore
      // testable here without env stubbing: pass a poisoned verifyUrl
      // directly. The route-level R-15 (env trust at URL construction
      // site) is a separate test that belongs in route-handler test files
      // (Phase 3 territory).
      //
      // REJECTED ALTERNATIVE: vi.stubEnv('NEXT_PUBLIC_APP_URL', '...').
      // Rejected because this module does not read process.env. Stubbing
      // has no effect on the rendered output. Direct parameter injection
      // is the precise template-layer test for R-15.
      //
      // Hardening landing: when the template (or its caller) adds URL
      // scheme validation (e.g. require https:// only, or allowlist match
      // against a configured origin), this assertion will fail. Flip to
      // assert either an exception is thrown OR a safe-default href (e.g.
      // about:blank, or the configured fallback origin) replaces the
      // poisoned scheme.
      const result = renderVerificationEmail({
        username: 'salim',
        verifyUrl: 'javascript:alert(1)',
      })
      expect(result.html).toContain('href="javascript:alert(1)"')
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

    it('T-ET05: username <img src=x onerror=alert(1)> renders literally in reset HTML — gap (R-13)', () => {
      // SENIOR ARCHITECT NOTE: R-13 reset-path twin of T-ET04. Same
      // template-literal interpolation pattern in renderPasswordResetEmail's
      // bodyHtml (email-templates.ts L176). Both render functions must be
      // guarded because a single-function fix would leave the other path
      // vulnerable — and the reset path is arguably MORE sensitive (an
      // unverified user receiving a reset email with embedded XSS could
      // trigger the payload before the account is even confirmed).
      //
      // Cross-reference: T-ET04 (verify path twin), T-IV16/T-IV17 (Phase
      // 1.D.3 upstream validator gap).
      //
      // Hardening landing: same as T-ET04 — flip to expect HTML-encoded
      // payload when template adds escape. The reset-path test must flip
      // in lockstep with the verify-path test; otherwise the fix is
      // incomplete.
      const payload = '<img src=x onerror=alert(1)>'
      const result = renderPasswordResetEmail({
        username: payload,
        resetUrl: 'https://siberlab.dev/reset/xyz',
      })
      expect(result.html).toContain(payload)
    })
  })
})
