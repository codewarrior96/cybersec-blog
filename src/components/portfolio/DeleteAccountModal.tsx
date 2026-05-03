'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const DELETE_CONFIRMATION = 'DELETE'

interface DeleteAccountModalProps {
  onClose: () => void
}

type Status = 'idle' | 'submitting' | 'error'

/**
 * F-002: banking-grade account deletion confirmation modal.
 *
 * Submit is only enabled when both:
 *   - Password field is non-empty
 *   - Confirmation field equals literal "DELETE" (case-sensitive)
 *
 * Server validates both again — UI checks are UX guardrails, not
 * security. Wrong password returns 401 → modal stays open with
 * preserved form data so the user can retry without losing their
 * place. Successful delete clears the cookie server-side and the
 * client redirects to /login.
 */
export default function DeleteAccountModal({ onClose }: DeleteAccountModalProps) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const canSubmit =
    status !== 'submitting' &&
    password.length > 0 &&
    confirmation === DELETE_CONFIRMATION

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit) return

    setStatus('submitting')
    setErrorMsg(null)

    try {
      const response = await fetch('/api/users/me', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, confirmation }),
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string }
        setStatus('error')
        setErrorMsg(payload.error ?? 'Hesap silinemedi.')
        return
      }

      // Success: redirect to /login. Cookie was cleared server-side.
      router.push('/login')
    } catch {
      setStatus('error')
      setErrorMsg('Bağlantı hatası. Tekrar deneyin.')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(6,0,15,0.92)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg border p-6 font-mono"
        style={{
          background: '#0d0018',
          borderColor: 'rgba(244,63,94,0.4)',
          boxShadow: '0 0 80px rgba(244,63,94,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-2 text-lg font-bold tracking-[0.15em] text-rose-300 uppercase">
          Hesabı Kalıcı Olarak Sil
        </h2>
        <p className="mb-5 text-xs leading-relaxed text-slate-300">
          Bu işlem geri alınamaz. Hesabınız ve tüm verileriniz
          (profil, sertifikalar, eğitimler, raporlar) kalıcı olarak
          silinecek.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label
              htmlFor="delete-password"
              className="block font-mono text-[10px] uppercase tracking-[0.3em] text-rose-300/80"
            >
              Şifreniz
            </label>
            <input
              id="delete-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={status === 'submitting'}
              placeholder="Mevcut şifrenizi giriniz"
              className="mt-2 w-full rounded-lg border border-rose-500/30 bg-black/60 px-4 py-2.5 font-mono text-sm text-rose-100 placeholder:text-rose-300/25 focus:border-rose-400/60 focus:outline-none focus:ring-2 focus:ring-rose-500/20 disabled:opacity-60"
            />
          </div>

          <div>
            <label
              htmlFor="delete-confirmation"
              className="block font-mono text-[10px] uppercase tracking-[0.3em] text-rose-300/80"
            >
              Onaylamak için &quot;DELETE&quot; yazın
            </label>
            <input
              id="delete-confirmation"
              type="text"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              disabled={status === 'submitting'}
              placeholder="DELETE"
              className="mt-2 w-full rounded-lg border border-rose-500/30 bg-black/60 px-4 py-2.5 font-mono text-sm text-rose-100 placeholder:text-rose-300/25 focus:border-rose-400/60 focus:outline-none focus:ring-2 focus:ring-rose-500/20 disabled:opacity-60"
            />
          </div>

          {status === 'error' && errorMsg && (
            <p className="font-mono text-[11px] tracking-wide text-rose-400" role="alert">
              {errorMsg}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={status === 'submitting'}
              className="rounded-lg border border-slate-600 bg-slate-800/40 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-slate-300 transition hover:border-slate-500/60 hover:bg-slate-800/70 disabled:opacity-50"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded-lg border border-rose-500/50 bg-rose-500/15 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-rose-200 transition hover:border-rose-400/70 hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {status === 'submitting' ? 'Siliniyor...' : 'Hesabı Kalıcı Sil'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
