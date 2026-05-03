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
