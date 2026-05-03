'use client'

import Link from 'next/link'
import { useState } from 'react'

type Status = 'idle' | 'submitting' | 'sent' | 'error'

/**
 * Phase 5: forgot-password client form. Lives inside the chromeless
 * /forgot page (server component shell handles layout/branding).
 *
 * Two visible states:
 *   - idle/submitting/error: input + submit button
 *   - sent: replace form with the generic success message + link back
 *     to /login. We never reveal whether the email is registered or
 *     verified — anti-enumeration matches the endpoint contract.
 *
 * Network errors (fetch threw, no response) surface as a retry-friendly
 * error; 4xx/5xx from the endpoint are treated as success because the
 * endpoint already returns 200 for the legitimate-but-unregistered
 * case. The only real failure modes here are 400 INVALID_EMAIL (caught
 * before submit by client validation) and 429 RATE_LIMITED (worth
 * surfacing so the user knows to wait).
 */
export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (status === 'submitting') return

    const target = email.trim()
    if (!target) {
      setStatus('error')
      setErrorMsg('E-posta adresi gerekli.')
      return
    }

    setStatus('submitting')
    setErrorMsg(null)

    try {
      const response = await fetch('/api/auth/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: target }),
      })

      if (response.status === 429) {
        setStatus('error')
        setErrorMsg('Çok fazla deneme. Bir saat sonra tekrar deneyin.')
        return
      }

      if (response.status === 400) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string }
        setStatus('error')
        setErrorMsg(payload.error === 'INVALID_EMAIL' ? 'Geçersiz e-posta formatı.' : 'İstek geçersiz.')
        return
      }

      // Anything else (200, 500) we treat as the generic-success path —
      // the endpoint deliberately returns 200 for unregistered emails
      // and even masks internal failures as 200 to preserve the
      // anti-enumeration property.
      setStatus('sent')
    } catch {
      setStatus('error')
      setErrorMsg('Bağlantı hatası. Tekrar deneyin.')
    }
  }

  if (status === 'sent') {
    return (
      <div
        className="rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.05] p-5"
        role="status"
        aria-live="polite"
      >
        <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-emerald-300/80">
          İstek alındı
        </p>
        <p className="mt-3 text-sm leading-6 text-slate-200">
          Eğer bu e-posta kayıtlıysa, şifre sıfırlama bağlantısı gönderildi. E-posta
          kutunuzu (ve spam klasörünü) kontrol edin. Bağlantı 1 saat geçerli.
        </p>
        <p className="mt-3 text-xs leading-5 text-slate-400">
          E-posta gelmediyse: kayıt sırasında kullandığınız e-posta adresini kontrol edin
          veya birkaç dakika sonra tekrar deneyin.
        </p>
        <div className="mt-5">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-2xl border border-emerald-300/35 bg-emerald-400/10 px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.32em] text-emerald-200 transition hover:border-emerald-200/50 hover:bg-emerald-400/16"
          >
            Giriş ekranına dön
          </Link>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div>
        <label
          htmlFor="forgot-email"
          className="font-mono text-[10px] uppercase tracking-[0.3em] text-emerald-300/60"
        >
          E-posta adresi
        </label>
        <input
          id="forgot-email"
          type="email"
          autoComplete="email"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="send"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={status === 'submitting'}
          placeholder="ornek@email.com"
          className="mt-2 w-full rounded-lg border border-emerald-400/30 bg-black/60 px-4 py-3 font-mono text-sm text-emerald-200 placeholder:text-emerald-300/25 focus:border-emerald-400/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 disabled:opacity-60"
        />
      </div>

      {status === 'error' && errorMsg && (
        <p className="font-mono text-[11px] tracking-wide text-rose-400" role="alert">
          {errorMsg}
        </p>
      )}

      <button
        type="submit"
        disabled={status === 'submitting'}
        className="w-full rounded-2xl border border-emerald-300/40 bg-emerald-400/10 px-6 py-3 font-mono text-[12px] uppercase tracking-[0.35em] text-emerald-200 transition hover:border-emerald-200/55 hover:bg-emerald-400/16 disabled:opacity-60"
      >
        {status === 'submitting' ? 'Gönderiliyor...' : 'Sıfırlama bağlantısı gönder'}
      </button>

      <div className="flex items-center justify-start pt-2 text-xs text-slate-500">
        <Link href="/login" className="font-mono uppercase tracking-[0.24em] text-emerald-300/55 hover:text-emerald-200">
          ← Giriş ekranı
        </Link>
      </div>
    </form>
  )
}
