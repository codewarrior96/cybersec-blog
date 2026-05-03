import { Resend } from 'resend'

/**
 * Centralized From address. Uses the verified `siberlab.dev` domain
 * (DKIM + SPF configured via Vercel auto-configure on May 03 2026,
 * Resend region eu-west-1). Sandbox restriction lifted — emails can
 * be dispatched to any recipient address (no longer limited to the
 * Resend account owner inbox).
 */
export const EMAIL_FROM = 'BREACH LAB <noreply@siberlab.dev>'

export interface SendEmailParams {
  to: string
  subject: string
  html: string
  text: string
}

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; error: string }

let cachedClient: Resend | null = null

/**
 * Lazy singleton. Returns null when RESEND_API_KEY is not set so callers
 * can decide their fallback policy (e.g. log + continue vs. fail-fast).
 * Avoids module-load-time crashes in environments without the key
 * configured (local dev, CI without secrets, etc.).
 */
export function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return null
  if (!cachedClient) {
    cachedClient = new Resend(apiKey)
  }
  return cachedClient
}

/**
 * Typed wrapper around Resend's send() returning a discriminated-union
 * result. Never throws — network/API failures are surfaced via
 * `{ ok: false, error }`. Callers should log and decide whether to
 * proceed (e.g. registration succeeds even if the verification email
 * fails to dispatch — user can request a resend).
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const client = getResendClient()
  if (!client) {
    return { ok: false, error: 'RESEND_API_KEY missing' }
  }

  try {
    const response = await client.emails.send({
      from: EMAIL_FROM,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    })

    if (response.error) {
      const message = typeof response.error === 'object' && response.error !== null && 'message' in response.error
        ? String((response.error as { message: unknown }).message)
        : 'Email send failed'
      return { ok: false, error: message }
    }

    const id = response.data?.id
    if (!id) {
      return { ok: false, error: 'Email send returned no id' }
    }

    return { ok: true, id }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Email send failed'
    return { ok: false, error: message }
  }
}

/**
 * Phase 5: typed helper for the password-reset email. Wraps `sendEmail`
 * with a TR-localized template (subject + HTML + plaintext fallback).
 *
 * Caller (POST /api/auth/forgot) builds the absolute resetUrl from the
 * request host so the link works in both production (siberlab.dev) and
 * preview deploys (vercel.app). The 1-hour expiry warning matches the
 * token TTL set in the forgot endpoint; updating one without the other
 * creates user-facing inconsistency, so they're both literal "1 saat".
 *
 * The "if you didn't request this, ignore this email" footer is a
 * standard anti-phishing mitigation: a legitimate user receiving an
 * unsolicited reset email is the early warning signal for a compromised
 * password (or for an attacker probing whether their email is registered
 * — which we already mitigate via the generic /forgot response).
 *
 * Phase 6 will centralize email templates; for now the inline structure
 * matches the verification-email pattern in /api/auth/register +
 * /api/auth/verify/resend so styling stays consistent across the suite.
 */
export async function sendPasswordResetEmail(params: {
  to: string
  resetUrl: string
  username: string
}): Promise<SendEmailResult> {
  const safeName = params.username || 'Operator'
  const subject = 'BREACH LAB — Şifre sıfırlama'
  const text = [
    `Merhaba ${safeName},`,
    '',
    'BREACH LAB hesabın için şifre sıfırlama talebi aldık. Yeni bir şifre belirlemek için aşağıdaki bağlantıya tıkla:',
    '',
    params.resetUrl,
    '',
    'Bu bağlantı 1 saat geçerli. Süre dolarsa yeni bir bağlantı talep etmen gerekir.',
    '',
    'Eğer bu talebi sen yapmadıysan, bu maili görmezden gelebilirsin — şifren değişmez.',
    '',
    '— BREACH LAB',
  ].join('\n')
  const html = `<!doctype html>
<html><body style="font-family:JetBrains Mono,Menlo,monospace;background:#000;color:#e2e8f0;padding:24px;">
<div style="max-width:560px;margin:0 auto;border:1px solid #00ff4140;border-radius:12px;padding:24px;background:#040806;">
<p style="color:#00ff41;letter-spacing:0.2em;font-size:11px;margin:0 0 12px;">BREACH LAB</p>
<h1 style="color:#f8fafc;font-size:18px;margin:0 0 12px;">Şifre sıfırlama</h1>
<p style="line-height:1.6;color:#cbd5e1;font-size:13px;">Merhaba ${safeName}, BREACH LAB hesabın için şifre sıfırlama talebi aldık. Yeni bir şifre belirlemek için aşağıdaki bağlantıya tıkla:</p>
<p style="margin:16px 0;"><a href="${params.resetUrl}" style="display:inline-block;background:#00ff41;color:#000;padding:10px 18px;border-radius:8px;font-weight:700;text-decoration:none;">Yeni şifre belirle</a></p>
<p style="font-size:11px;color:#94a3b8;line-height:1.6;">Bağlantı 1 saat geçerli. Süre dolarsa yeni bir bağlantı talep etmen gerekir. Bağlantı çalışmıyorsa şu URL'yi tarayıcına yapıştırabilirsin:<br/><span style="color:#00ff41;word-break:break-all;">${params.resetUrl}</span></p>
<p style="font-size:11px;color:#fbbf24;line-height:1.6;margin-top:16px;border-top:1px solid #fbbf2440;padding-top:12px;">⚠ Bu talebi sen yapmadıysan, bu maili görmezden gelebilirsin — şifren değişmez. Yine de hesabının güvende olduğundan emin değilsen, mevcut şifrenle giriş yap ve değiştir.</p>
<p style="font-size:10px;color:#64748b;margin-top:24px;">— BREACH LAB</p>
</div></body></html>`
  return sendEmail({ to: params.to, subject, html, text })
}
