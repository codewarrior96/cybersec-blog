'use client'

import { useState } from 'react'

type Status = 'idle' | 'submitting' | 'sent' | 'error'

/**
 * Phase 6: verify-pending resend form.
 *
 * Lives inside the chromeless /auth/verify-pending page (server
 * component shell handles layout/branding). The user has just
 * registered but no session was minted (Phase 4.5 contract), so we
 * cannot identify them from a cookie. Per Phase 6 spec Option C, we
 * ask the user to type their email — the most explicit and
 * anti-enumeration-aligned choice.
 *
 * The endpoint (/api/auth/verify/resend, Phase 4) returns the same
 * generic 200 message regardless of account state, so even if the
 * user mistypes the email or enters a non-existent address, the UI
 * branches identically. This matches the contract elsewhere in the
 * suite (forgot password, register email-uniqueness pre-check).
 *
 * Two visible states:
 *   - idle/submitting/error: input + submit button
 *   - sent: replace form with confirmation message
 *
 * Styling matches the verify-pending page chrome (emerald accents,
 * monospace heading, dark card surfaces) so the interaction reads as
 * part of the page rather than a foreign widget.
 */
export default function EmbeddedVerifyResend() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (status === 'submitting') return

    const target = email.trim()
    if (!target) {
      setStatus('error')
      setErrorMsg('Email adresi gerekli.')
      return
    }

    setStatus('submitting')
    setErrorMsg(null)

    try {
      const response = await fetch('/api/auth/verify/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: target }),
      })

      if (response.status === 429) {
        setStatus('error')
        setErrorMsg('Çok fazla deneme. Bir saat sonra tekrar dene.')
        return
      }

      if (response.status === 400) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string }
        setStatus('error')
        setErrorMsg(payload.error === 'INVALID_EMAIL' ? 'Geçersiz email formatı.' : 'İstek geçersiz.')
        return
      }

      // 200 + any other non-explicit-error path: treat as the generic
      // success branch. The endpoint already masks "user doesn't
      // exist" / "already verified" / "send failed" as 200, so we
      // honor that contract here.
      setStatus('sent')
    } catch {
      setStatus('error')
      setErrorMsg('Bağlantı hatası. Tekrar dene.')
    }
  }

  if (status === 'sent') {
    return (
      <div
        className="rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.05] p-4"
        role="status"
        aria-live="polite"
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-emerald-300/80">
          [ İSTEK ALINDI ]
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-200">
          Eğer bu email kayıtlıysa, yeni bir doğrulama bağlantısı gönderildi. Mail kutunu
          (ve spam klasörünü) birkaç saniye sonra kontrol et.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3" noValidate>
      <div>
        <label
          htmlFor="resend-email"
          className="font-mono text-[10px] uppercase tracking-[0.3em] text-emerald-300/60"
        >
          EMAIL_ADDR:
        </label>
        <input
          id="resend-email"
          type="email"
          autoComplete="email"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="send"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={status === 'submitting'}
          placeholder="kayıt sırasında girdiğin email"
          className="mt-2 w-full rounded-lg border border-emerald-400/30 bg-black/60 px-4 py-2.5 font-mono text-sm text-emerald-200 placeholder:text-emerald-300/25 focus:border-emerald-400/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 disabled:opacity-60"
        />
      </div>

      {status === 'error' && errorMsg && (
        <p className="font-mono text-[11px] tracking-wide text-rose-400" role="alert">
          [ {errorMsg} ]
        </p>
      )}

      <button
        type="submit"
        disabled={status === 'submitting'}
        className="w-full rounded-2xl border border-emerald-300/40 bg-emerald-400/10 px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.32em] text-emerald-200 transition hover:border-emerald-200/55 hover:bg-emerald-400/16 disabled:opacity-60"
      >
        {status === 'submitting' ? '[ GÖNDERİLİYOR ]' : '[ Doğrulama mailini yeniden gönder ]'}
      </button>
    </form>
  )
}
