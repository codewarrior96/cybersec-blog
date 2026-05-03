import type { Metadata } from 'next'
import ResetPasswordForm from '@/components/ResetPasswordForm'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Yeni şifre belirle — BREACH LAB',
  description: 'Şifre sıfırlama bağlantısı ile yeni bir şifre belirle.',
}

interface PageProps {
  searchParams: Promise<{ token?: string }> | { token?: string }
}

/**
 * Phase 5: reset-password gateway page.
 *
 * Treated as chromeless by AppShellClient. Reads `?token=` from the
 * URL and hands it to a client component that:
 *   1. Calls GET /api/auth/reset/validate?token=... on mount
 *   2. Branches the UI on the validation response (form / expired /
 *      invalid)
 *   3. POSTs to /api/auth/reset on submit
 *
 * Pure server shell — no token validation here. The validate endpoint
 * is the single source of truth for token state, and bouncing through
 * the client lets us avoid re-validating on every render.
 */
export default async function ResetPage({ searchParams }: PageProps) {
  const params = await Promise.resolve(searchParams)
  const token = typeof params.token === 'string' ? params.token : ''

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#020604]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#08331c_0%,#020604_55%,#010101_100%)]" />
      <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,255,65,0.025)_2px,rgba(0,0,0,0.12)_4px)]" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-2xl items-center justify-center px-4 py-12">
        <div className="w-full rounded-[28px] border border-emerald-400/20 bg-black/40 p-8 shadow-[0_0_60px_rgba(0,255,65,0.08)] backdrop-blur-xl md:p-12">
          <div className="mb-6 flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(74,222,128,0.9)]" />
            <span className="font-mono text-[11px] uppercase tracking-[0.42em] text-emerald-300/80">
              Password Reset
            </span>
          </div>

          <ResetPasswordForm token={token} />

          <div className="mt-8 flex items-center justify-between gap-4 border-t border-emerald-400/10 pt-5 text-xs text-slate-500">
            <span className="font-mono tracking-[0.24em] text-emerald-300/35">
              PASSWORD RESET CHECKPOINT
            </span>
            <a
              href="/login"
              className="font-mono uppercase tracking-[0.28em] text-emerald-300/60 transition hover:text-emerald-200"
            >
              Giriş ekranı
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
