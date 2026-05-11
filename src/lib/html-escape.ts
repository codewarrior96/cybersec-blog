/**
 * HTML escape utility for safe interpolation of untrusted strings into
 * HTML body text or attribute contexts.
 *
 * Escapes the 5 characters that have HTML-syntactic meaning:
 *   &  →  &amp;   (must be first; other escapes contain &)
 *   <  →  &lt;
 *   >  →  &gt;
 *   "  →  &quot;
 *   '  →  &#39;   (numeric entity; &apos; is XML-only, not legacy-HTML safe)
 *
 * Use whenever interpolating user-controlled or untrusted strings into
 * server-rendered HTML output. For client-side React, default text
 * rendering is already safe — use this only for server templates.
 *
 * Introduced: Phase 1.5.2 R-13 hardening (HTML injection in email templates).
 * Surface today: src/lib/email-templates.ts (renderVerificationEmail,
 * renderPasswordResetEmail). Future surfaces (admin UI server-render, etc.)
 * should also adopt this helper rather than re-implementing.
 */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
