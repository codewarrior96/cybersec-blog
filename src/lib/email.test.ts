// SENIOR ARCHITECT NOTE: email.ts integrates Resend SDK + renderVerification/
// renderPasswordReset templates + writeAuditLog (via audit-helpers). Tests
// here probe the R-12 audit log integration path: on email send failure OR
// URL validation failure, writeAuditLog must be called with the
// 'email.failure' action shape + recipient_hash privacy primitive.
//
// REJECTED ALTERNATIVE: mock email.ts's internal helpers (writeAuditLogSafely,
// recipientHash). Rejected — that would bypass the integration we want to
// verify. Mocking only Resend (external network) + writeAuditLog (storage
// boundary) exercises the real audit-helpers + email-templates code paths.
//
// SENIOR ARCHITECT NOTE: vi.hoisted pattern shares the mockSend reference
// between the vi.mock factory (creates Resend class with .emails.send =
// mockSend) and the test bodies (configure per-test resolution via
// mockSend.mockResolvedValueOnce). Without vi.hoisted, the factory would
// run before test imports and the mockSend reference would not be in scope.
const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn(),
}))

vi.mock('resend', () => ({
  Resend: class MockResend {
    emails = { send: mockSend }
  },
}))

vi.mock('@/lib/soc-store-adapter', () => ({
  writeAuditLog: vi.fn(),
}))

import { writeAuditLog } from '@/lib/soc-store-adapter'
import { sendPasswordResetEmail, sendVerificationEmail } from './email'

beforeEach(() => {
  vi.mocked(writeAuditLog).mockReset()
  vi.mocked(writeAuditLog).mockResolvedValue(undefined as never)
  mockSend.mockReset()
})

describe('email — R-12 audit log on failure', () => {
  it('T-EM01: verification email Resend send failure → email.failure audit log (R-12 FIXED in db48dfd)', async () => {
    // FIX EVIDENCE: Phase 1.5.11 R-12 — when Resend SDK returns an error
    // response, sendVerificationEmail returns { ok: false, error } AND
    // writes an audit log entry with action='email.failure',
    // entityType='email', entityId='verification' purpose tag.
    //
    // Privacy: recipient_hash is 16-char SHA-256 hex prefix of the
    // normalized recipient email; the full email NEVER appears in
    // details. sanitizeErrorMessage filters error message through
    // allowlist; 'Email send failed' is allowlisted so it passes
    // through.
    //
    // SENIOR ARCHITECT NOTE: writeAuditLogSafely (internal wrapper)
    // catches writeAuditLog exceptions — but in this test the mock is
    // configured to resolve normally, so we verify the happy-path
    // audit log shape.
    mockSend.mockResolvedValue({
      data: null,
      error: { message: 'Email send failed' },
    })

    const result = await sendVerificationEmail({
      to: 'victim@example.com',
      verifyUrl: 'https://siberlab.dev/verify/abc',
      username: 'salim',
    })

    expect(result.ok).toBe(false)
    expect(writeAuditLog).toHaveBeenCalled()
    const call = vi.mocked(writeAuditLog).mock.calls[0][0]
    expect(call.action).toBe('email.failure')
    expect(call.entityType).toBe('email')
    expect(call.entityId).toBe('verification')
    expect(call.actorUserId).toBeNull()
    expect(call.details?.purpose).toBe('verification')
    expect(call.details?.recipient_hash).toMatch(/^[0-9a-f]{16}$/)
    expect(call.details?.error_message).toBe('Email send failed')
    // Privacy: full email NEVER in details
    expect(JSON.stringify(call.details)).not.toContain('victim@example.com')
  })

  it('T-EM02: password reset email Resend send failure → email.failure audit log (R-12 FIXED in db48dfd)', async () => {
    // FIX EVIDENCE: Phase 1.5.11 R-12 — twin of T-EM01 for the password
    // reset email path. Same audit log shape; entityId='password_reset'
    // + details.purpose='password_reset'.
    mockSend.mockResolvedValue({
      data: null,
      error: { message: 'Email send failed' },
    })

    const result = await sendPasswordResetEmail({
      to: 'user@example.com',
      resetUrl: 'https://siberlab.dev/reset/xyz',
      username: 'salim',
    })

    expect(result.ok).toBe(false)
    expect(writeAuditLog).toHaveBeenCalled()
    const call = vi.mocked(writeAuditLog).mock.calls[0][0]
    expect(call.action).toBe('email.failure')
    expect(call.entityType).toBe('email')
    expect(call.entityId).toBe('password_reset')
    expect(call.details?.purpose).toBe('password_reset')
    expect(call.details?.recipient_hash).toMatch(/^[0-9a-f]{16}$/)
    expect(call.details?.error_message).toBe('Email send failed')
    expect(JSON.stringify(call.details)).not.toContain('user@example.com')
  })

  it('T-EM03: verification email URL validation failure → email.failure audit log (R-12 + R-15 integration, FIXED in db48dfd)', async () => {
    // FIX EVIDENCE: Phase 1.5.11 R-12 — when assertSafeUrl rejects a
    // poisoned URL (e.g., javascript: scheme), renderVerificationEmail
    // throws EmailUrlValidationError. sendVerificationEmail catches +
    // writes an audit log entry with the URL validation error message
    // (allowlisted via sanitizeErrorMessage's
    // '[email-templates] verifyUrl validation failed:' pattern).
    //
    // This test integrates R-12 (audit log on email failure) + R-15
    // (URL substrate trust). The javascript: scheme is rejected in
    // BOTH production and dev/test env (only https: and http: are
    // allowed in dev/test; production is https: only). Test env is
    // 'test' per setup.ts — javascript: rejected.
    const result = await sendVerificationEmail({
      to: 'victim@example.com',
      verifyUrl: 'javascript:alert(1)',
      username: 'salim',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/verifyUrl validation failed/)
    }
    expect(writeAuditLog).toHaveBeenCalled()
    const call = vi.mocked(writeAuditLog).mock.calls[0][0]
    expect(call.action).toBe('email.failure')
    expect(call.entityType).toBe('email')
    expect(call.entityId).toBe('verification')
    expect(call.details?.purpose).toBe('verification')
    expect(call.details?.recipient_hash).toMatch(/^[0-9a-f]{16}$/)
    expect(call.details?.error_message).toMatch(/verifyUrl validation failed/)
    // Privacy: full email NEVER in details
    expect(JSON.stringify(call.details)).not.toContain('victim@example.com')
    // Privacy: full poisoned URL not in details (sanitizeErrorMessage
    // matched allowlist pattern and passed the error message through,
    // which includes the scheme but truncated URL preview by design
    // in EmailUrlValidationError construction)
  })
})
