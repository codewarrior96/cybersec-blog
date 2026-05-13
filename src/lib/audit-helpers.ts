import { createHash } from 'crypto'
import { writeAuditLog } from '@/lib/soc-store-adapter'
import type { RequestMetadata } from '@/lib/soc-store-memory'

// Phase 1.5.11 (db48dfd): centralized audit-log privacy helpers
// + safe-wrap wrapper. Shared between R-06 (rate-limit observability,
// route handlers) and R-12 (email failure observability, email.ts).
//
// SENIOR ARCHITECT NOTE: privacy helpers hash sensitive inputs (IP/email)
// before they reach the audit log. Full identifiers never enter the log
// store. The prefix-only return preserves enough entropy to detect rotation
// patterns (e.g., 1000 entries with the same key_preview indicates IP
// pinned; 1000 entries with distinct key_previews indicates rotation
// attack) without leaking the underlying identifier to operators reviewing
// audit data — forensic utility without privacy exposure.
//
// REJECTED ALTERNATIVE: full-length hash (64 hex chars from SHA-256).
// Rejected because 64 chars × N log entries × M operators reviewing wastes
// log surface area without forensic gain. 8 chars = 32 bits of entropy =
// 1 in 4B collision rate, sufficient to distinguish ~65K unique keys
// before collision probability >50% (birthday paradox). At our scale this
// is sufficient.

/**
 * key_preview for rate-limit audit logs. Hashes IP/emailKey + returns
 * first 8 hex chars. Rotation patterns detectable (same prefix recurring);
 * underlying identifier never logged.
 */
export function keyPreview(key: string): string {
  if (!key) return '<empty>'
  return createHash('sha256').update(key).digest('hex').slice(0, 8)
}

/**
 * recipient_hash for email failure audit logs. Normalizes email
 * (lowercase + trim) before hashing; returns first 16 hex chars (64 bits
 * of entropy — slightly wider than keyPreview because email cardinality
 * exceeds IP cardinality in operational data). Full email never logged.
 */
export function recipientHash(email: string): string {
  if (!email) return '<empty>'
  const normalized = email.trim().toLowerCase()
  return createHash('sha256').update(normalized).digest('hex').slice(0, 16)
}

// Allowlist of error-message patterns known to be PII-free. Used by
// sanitizeErrorMessage to filter what reaches the audit log. Adding a
// pattern: confirm the matching error class never contains a user
// identifier (email, IP, full URL, etc.) in its message text.
const SAFE_ERROR_PATTERNS: RegExp[] = [
  /^RESEND_API_KEY missing$/,
  /^Email send returned no id$/,
  /^Email send failed$/,
  /^supabase insert failed:/,
  /^supabase read failed:/,
  /^\[email-templates\] (verifyUrl|resetUrl) validation failed:/,
  /^\[security\] hash format invariant violated:/,
]

/**
 * sanitizeErrorMessage strips PII from error strings before they reach
 * the audit log. Falls back to 'unknown' if the message doesn't match the
 * allowlist — prevents accidental disclosure when new error paths are
 * added without updating the allowlist.
 *
 * REJECTED ALTERNATIVE: regex-strip email/IP patterns from the message.
 * Rejected because adversarial inputs can encode identifiers in
 * non-canonical forms (URL-encoded, base64-encoded, embedded in JSON,
 * etc.). Allowlist + 'unknown' fallback is conservative.
 */
export function sanitizeErrorMessage(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'unknown'
  for (const pattern of SAFE_ERROR_PATTERNS) {
    if (pattern.test(raw)) return raw
  }
  return 'unknown'
}

/**
 * writeAuditLogSafely wraps writeAuditLog with try/catch + console.error.
 * Used at integration points where the calling path is already in error
 * state (rate-limit exceeded, email send failed) and an audit-log cascade
 * failure would mask the original error.
 *
 * Failure mode: if writeAuditLog throws (Supabase down, network error,
 * etc.), log to console.error and return. Caller continues without
 * audit log entry. The 429 response or email-failure return shape is
 * unaffected — audit log is supplementary, not blocking.
 */
export async function writeAuditLogSafely(input: {
  actorUserId: number | null
  action: string
  entityType: string
  entityId?: string | number | null
  details?: Record<string, unknown>
  metadata?: RequestMetadata
}): Promise<void> {
  try {
    await writeAuditLog(input)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown'
    console.error(
      `[audit-helpers] writeAuditLog failed for action="${input.action}": ${message}`,
    )
  }
}
