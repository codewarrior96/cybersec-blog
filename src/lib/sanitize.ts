// Phase 3.D — Input sanitization helper for user-controlled HTML-like content.
//
// R-API-05 closure (Phase 3.A audit Section 2): report `content` field
// accepts up to 50,000 chars and is stored verbatim. If a future admin
// UI surface renders content as HTML without escape, attacker injects
// <script> / javascript: URL / event handlers → stored XSS.
//
// DEFENSE-IN-DEPTH TWO-LAYER (5TH PATTERN INSTANCE, R-13 LINEAGE):
//   Layer 1 (THIS FILE — input sanitization): strip dangerous tags +
//     attributes at POST time before storage. Defense even if the UI
//     render path forgets to escape.
//   Layer 2 (existing — output escape): React/MDX defaults render text
//     content safely; `html-escape.ts` exists for server-rendered HTML
//     (email templates, R-13 Phase 1.5.2).
//
// Prior defense-in-depth instances:
//   1. R-13 (Phase 1.5.2) — identity-validation denylist + email-templates
//      HTML escape
//   2. R-21 (Phase 1.5.4) — hashPassword self-validate +
//      verifyPassword.assertHashFormat
//   3. R-15 (Phase 1.5.10) — assertSafeUrl in template +
//      EmailUrlValidationError catch
//   4. A-17 (Phase 1.5.15) — instrumentation.register() boot validator +
//      getMemorySecret() lazy getter throw
//   5. R-API-05 (Phase 3.D revision) — input sanitization (here) +
//      output escape (existing React/MDX defaults)
//   6. R-API-13 (Wave 2B) — profile bio + headline input sanitization
//      reuses `sanitizeReportContent` (signature identical: string→string,
//      same DANGEROUS_PATTERNS set covers both surfaces); profile
//      render path inherits React/MDX safe-text Layer 2 defaults.
//      Cross-reference: `src/app/api/profile/me/route.ts` PUT handler
//      sanitizes bio + headline before adapter call.
//
// SENIOR ARCHITECT NOTE: regex-based, server-safe (no DOM dep). DOMPurify
// would be a heavier dep + requires jsdom for server-side use. The threat
// model here is "remove known-dangerous patterns" not "perfect HTML
// parser" — defense-in-depth, not sole defense. UI render path remains
// React/MDX default safe-text behavior.
//
// REJECTED ALTERNATIVE: install DOMPurify + jsdom for "real" HTML parse.
// Rejected — 100KB+ dep tree, jsdom incompatibility with vitest node env,
// overkill for a deferred-stored-XSS surface where the primary defense
// (React text rendering) is already in place. Regex approach matches
// R-13's validator-denylist precedent (identity-validation L8-12).
//
// REJECTED ALTERNATIVE: strip ALL HTML tags (allow text only). Rejected —
// users legitimately use markdown-like formatting (**bold**, *italic*,
// links) in report content. Strip-all would destroy UX. Targeted strip
// of dangerous-only is the operator preference.

// Patterns matched and stripped from content. Each is a known XSS vector
// or attribute that delivers script execution in an HTML rendering
// context. Patterns are surgical, not exhaustive — a future DOMPurify
// migration would absorb the work. Today's contract: any pattern here
// MUST be stripped; legitimate markdown-like syntax MUST be preserved.

const DANGEROUS_PATTERNS: readonly RegExp[] = [
  // <script> ... </script> blocks (greedy, case-insensitive)
  /<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,
  // Self-closing or unclosed <script> tag
  /<script\b[^>]*\/?>/gi,
  // <iframe>, <object>, <embed>, <link>, <meta>, <form> — script-equivalent
  // surfaces that can execute or redirect.
  /<\/?(?:iframe|object|embed|link|meta|form)\b[^>]*>/gi,
  // javascript: URI scheme in attribute values (href, src, action, formaction).
  // Case-insensitive; allows whitespace between scheme and colon.
  /\bjavascript\s*:[^"'\s>]*/gi,
  // vbscript: and data: URI schemes (less common but historical XSS vectors)
  /\bvbscript\s*:[^"'\s>]*/gi,
  /\bdata\s*:\s*text\/html[^"'\s>]*/gi,
  // Inline event handlers: on* attributes (onclick, onload, onmouseover, etc.)
  // Match attribute=value with quoted or unquoted values.
  /\son\w+\s*=\s*"[^"]*"/gi,
  /\son\w+\s*=\s*'[^']*'/gi,
  /\son\w+\s*=\s*[^\s>]+/gi,
] as const

/**
 * Sanitize user-controlled HTML-like content for safe storage.
 *
 * Strips known XSS vectors (<script>, <iframe>, javascript: URLs, on*
 * event handlers). Preserves legitimate markdown-style and benign HTML
 * (bold, italic, links via [text](url), emphasis).
 *
 * Use at POST/PATCH time before persisting user input that will be
 * rendered as HTML in any downstream surface. Even when the renderer is
 * "safe-by-default" (React text), this provides defense-in-depth against
 * future render-path changes.
 *
 * Phase 1.5.2 R-13 lineage: input-side denylist mirrors the
 * `DISPLAY_NAME_DENYLIST_RE` pattern in `identity-validation.ts`. The
 * R-13 pattern uses a regex to REJECT invalid input at validation; this
 * helper STRIPS dangerous patterns from accepted input (different
 * semantic: reject vs. strip-and-accept). The choice depends on the
 * field's UX: identity fields reject (no markdown allowed); report
 * content strips (markdown-like content permitted).
 *
 * @param input — raw user-controlled content string
 * @returns sanitized content with dangerous patterns removed
 */
export function sanitizeReportContent(input: string): string {
  if (typeof input !== 'string' || input.length === 0) {
    return ''
  }

  let sanitized = input
  for (const pattern of DANGEROUS_PATTERNS) {
    sanitized = sanitized.replace(pattern, '')
  }
  return sanitized
}

/**
 * Test-only export of the pattern list. Used by sanitize.test.ts to
 * verify the catalog hasn't drifted silently.
 *
 * SENIOR ARCHITECT NOTE: not part of the public API contract; the
 * function above is the supported entry point. Exposing the patterns
 * is a test-coupling concession — future refactors that change the
 * pattern set will fail the catalog test, surfacing the intent review.
 */
export const __SANITIZE_PATTERNS_FOR_TESTS__: readonly RegExp[] = DANGEROUS_PATTERNS
