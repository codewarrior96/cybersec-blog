'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

interface ResetPasswordFormProps {
  token: string
}

type ValidationState =
  | { phase: 'loading' }
  | { phase: 'valid' }
  | { phase: 'expired' }
  | { phase: 'invalid' }
  | { phase: 'network-error' }

type SubmitState = 'idle' | 'submitting' | 'success' | 'error'

const MIN_PASSWORD = 8

/**
 * Phase 5: reset-password client component.
 *
 * Mount sequence:
 *   1. If token is empty → render "invalid" UI immediately (no API
 *      call needed)
 *   2. Otherwise call GET /api/auth/reset/validate?token=... and
 *      branch on the response
 *
 * The form (rendered when validation succeeds) requires:
 *   - Two password fields (newPassword + confirm)
 *   - Both must match
 *   - Both must be ≥ 8 characters (matches identity-validation.ts)
 *
 * On successful POST, render a confirmation block that auto-redirects
 * to /login via meta refresh after 3s. We don't redirect via
 * router.push so the user can read the message; the meta tag fires
 * even if JS becomes unresponsive after submit (e.g. heavy session
 * invalidation traffic).
 */
export default function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const [validation, setValidation] = useState<ValidationState>({ phase: 'loading' })
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitState, setSubmitState] = useState<SubmitState>('idle')
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      if (!token) {
        if (!cancelled) setValidation({ phase: 'invalid' })
        return
      }
      try {
        const response = await fetch(
          `/api/auth/reset/validate?token=${encodeURIComponent(token)}`,
          { cache: 'no-store' },
        )
        const payload = (await response.json().catch(() => null)) as {
          ok?: boolean
          valid?: boolean
          reason?: 'expired' | 'invalid'
        } | null

        if (cancelled) return

        if (payload?.valid === true) {
          setValidation({ phase: 'valid' })
          return
        }
        if (payload?.reason === 'expired') {
          setValidation({ phase: 'expired' })
          return
        }
        setValidation({ phase: 'invalid' })
      } catch {
        if (!cancelled) setValidation({ phase: 'network-error' })
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [token])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitState === 'submitting') return

    if (newPassword.length < MIN_PASSWORD) {
      setSubmitState('error')
      setSubmitError(`Şifre en az ${MIN_PASSWORD} karakter olmalı.`)
      return
    }
    if (newPassword !== confirmPassword) {
      setSubmitState('error')
      setSubmitError('Şifreler birbiriyle eşleşmiyor.')
      return
    }

    setSubmitState('submitting')
    setSubmitError(null)

    try {
      const response = await fetch('/api/auth/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      })

      if (response.ok) {
        setSubmitState('success')
        return
      }

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string
        message?: string
      }

      if (payload.error === 'TOKEN_EXPIRED') {
        // Token raced past expiry between validate-on-mount and submit.
        // Bump the validation phase so the UI swaps to the expired
        // branch with the "request a new link" CTA.
        setValidation({ phase: 'expired' })
        return
      }
      if (payload.error === 'TOKEN_INVALID') {
        setValidation({ phase: 'invalid' })
        return
      }
      if (payload.error === 'WEAK_PASSWORD') {
        setSubmitState('error')
        setSubmitError(payload.message ?? `Şifre en az ${MIN_PASSWORD} karakter olmalı.`)
        return
      }
      if (response.status === 429) {
        setSubmitState('error')
        setSubmitError(payload.message ?? 'Çok fazla deneme. Birkaç dakika sonra tekrar deneyin.')
        return
      }
      setSubmitState('error')
      setSubmitError(payload.message ?? 'Şifre sıfırlanamadı. Tekrar deneyin.')
    } catch {
      setSubmitState('error')
      setSubmitError('Bağlantı hatası. Tekrar deneyin.')
    }
  }

  if (validation.phase === 'loading') {
    return (
      <>
        <h1 className="text-3xl font-semibold tracking-[0.04em] text-slate-100 md:text-4xl">
          Bağlantı doğrulanıyor
        </h1>
        <p className="mt-4 font-mono text-sm leading-7 text-emerald-300/70" aria-live="polite">
          Doğrulanıyor...
        </p>
      </>
    )
  }

  if (validation.phase === 'expired') {
    return (
      <>
        <div className="mb-4 flex items-center gap-3">
          <span className="text-3xl text-amber-400">⚠</span>
          <h1 className="text-3xl font-semibold tracking-[0.04em] text-slate-100 md:text-4xl">
            Bağlantı süresi doldu
          </h1>
        </div>
        <p className="text-sm leading-7 text-slate-300/80 md:text-base">
          Bu şifre sıfırlama bağlantısı 1 saat geçerliydi ve süresi doldu. Yeni bir bağlantı
          talep edin — mevcut hesabınız için geçerli olacak.
        </p>
        <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/[0.05] p-4 text-sm text-slate-300">
          Güvenlik gereği şifre sıfırlama bağlantıları kısa süreli olarak çalışır.
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/forgot"
            className="inline-flex items-center justify-center rounded-2xl border border-amber-300/35 bg-amber-400/10 px-6 py-3 font-mono text-[12px] uppercase tracking-[0.35em] text-amber-200 transition hover:border-amber-200/50 hover:bg-amber-400/16"
          >
            Yeni bağlantı talep et
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-2xl border border-emerald-300/20 bg-transparent px-6 py-3 font-mono text-[12px] uppercase tracking-[0.35em] text-emerald-300/70 transition hover:border-emerald-300/40 hover:text-emerald-200"
          >
            Giriş ekranı
          </Link>
        </div>
      </>
    )
  }

  if (validation.phase === 'invalid' || validation.phase === 'network-error') {
    return (
      <>
        <div className="mb-4 flex items-center gap-3">
          <span className="text-3xl text-rose-400">✕</span>
          <h1 className="text-3xl font-semibold tracking-[0.04em] text-slate-100 md:text-4xl">
            {validation.phase === 'network-error' ? 'Bağlantı doğrulanamadı' : 'Geçersiz bağlantı'}
          </h1>
        </div>
        <p className="text-sm leading-7 text-slate-300/80 md:text-base">
          {validation.phase === 'network-error'
            ? 'Bağlantı doğrulama servisi şu anda yanıt vermiyor. Birkaç dakika sonra tekrar deneyin veya yeni bir bağlantı talep edin.'
            : 'Bu bağlantı geçersiz veya zaten kullanılmış. Yeni bir bağlantı talep edin.'}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/forgot"
            className="inline-flex items-center justify-center rounded-2xl border border-emerald-300/35 bg-emerald-400/10 px-6 py-3 font-mono text-[12px] uppercase tracking-[0.35em] text-emerald-200 transition hover:border-emerald-200/50 hover:bg-emerald-400/16"
          >
            Yeni bağlantı talep et
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-2xl border border-emerald-300/20 bg-transparent px-6 py-3 font-mono text-[12px] uppercase tracking-[0.35em] text-emerald-300/70 transition hover:border-emerald-300/40 hover:text-emerald-200"
          >
            Giriş ekranı
          </Link>
        </div>
      </>
    )
  }

  if (submitState === 'success') {
    return (
      <>
        {/* Auto-redirect to /login after 3s. Meta refresh works even if
            the React tree gets stuck post-submit (e.g. session
            invalidation network burst), so the user always lands
            somewhere. */}
        <meta httpEquiv="refresh" content="3;url=/login" />
        <div className="mb-4 flex items-center gap-3">
          <span className="text-3xl text-emerald-400">✓</span>
          <h1 className="text-3xl font-semibold tracking-[0.04em] text-slate-100 md:text-4xl">
            Şifreniz güncellendi
          </h1>
        </div>
        <p className="text-sm leading-7 text-slate-300/80 md:text-base">
          Tüm cihazlardaki oturumlarınız sonlandırıldı. 3 saniye içinde giriş ekranına
          yönlendiriliyorsunuz; yeni şifrenizle oturum açabilirsiniz.
        </p>
        <div className="mt-8">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-2xl border border-emerald-300/35 bg-emerald-400/10 px-6 py-3 font-mono text-[12px] uppercase tracking-[0.35em] text-emerald-200 transition hover:border-emerald-200/50 hover:bg-emerald-400/16"
          >
            Giriş ekranı
          </Link>
        </div>
      </>
    )
  }

  return (
    <>
      <h1 className="text-3xl font-semibold tracking-[0.04em] text-slate-100 md:text-4xl">
        Yeni şifre belirleyin
      </h1>
      <p className="mt-4 text-sm leading-7 text-slate-300/80 md:text-base">
        Yeni şifreniz en az {MIN_PASSWORD} karakter olmalı. Sıfırlama tamamlandığında tüm
        cihazlardaki oturumlarınız sonlandırılacak.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
        <div>
          <label
            htmlFor="reset-new"
            className="font-mono text-[10px] uppercase tracking-[0.3em] text-emerald-300/60"
          >
            Yeni şifre
          </label>
          <input
            id="reset-new"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            disabled={submitState === 'submitting'}
            placeholder="••••••••"
            className="mt-2 w-full rounded-lg border border-emerald-400/30 bg-black/60 px-4 py-3 font-mono text-sm text-emerald-200 placeholder:text-emerald-300/25 focus:border-emerald-400/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 disabled:opacity-60"
          />
        </div>

        <div>
          <label
            htmlFor="reset-confirm"
            className="font-mono text-[10px] uppercase tracking-[0.3em] text-emerald-300/60"
          >
            Yeni şifre (tekrar)
          </label>
          <input
            id="reset-confirm"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            disabled={submitState === 'submitting'}
            placeholder="••••••••"
            className="mt-2 w-full rounded-lg border border-emerald-400/30 bg-black/60 px-4 py-3 font-mono text-sm text-emerald-200 placeholder:text-emerald-300/25 focus:border-emerald-400/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 disabled:opacity-60"
          />
        </div>

        <label className="flex items-center gap-2 text-xs text-slate-400">
          <input
            type="checkbox"
            checked={showPassword}
            onChange={(event) => setShowPassword(event.target.checked)}
            className="h-3.5 w-3.5 rounded border-emerald-400/30 bg-black/60"
          />
          <span className="font-mono uppercase tracking-[0.18em] text-emerald-300/55">Şifreleri göster</span>
        </label>

        {submitState === 'error' && submitError && (
          <p className="font-mono text-[11px] tracking-wide text-rose-400" role="alert">
            {submitError}
          </p>
        )}

        <button
          type="submit"
          disabled={submitState === 'submitting'}
          className="w-full rounded-2xl border border-emerald-300/40 bg-emerald-400/10 px-6 py-3 font-mono text-[12px] uppercase tracking-[0.35em] text-emerald-200 transition hover:border-emerald-200/55 hover:bg-emerald-400/16 disabled:opacity-60"
        >
          {submitState === 'submitting' ? 'Kaydediliyor...' : 'Şifreyi güncelle'}
        </button>
      </form>
    </>
  )
}
