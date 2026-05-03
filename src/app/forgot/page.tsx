import type { Metadata } from 'next'
import ForgotPasswordForm from '@/components/ForgotPasswordForm'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Şifremi unuttum — BREACH LAB',
  description: 'Şifre sıfırlama bağlantısı talep et.',
}

/**
 * Phase 5: forgot-password gateway page.
 *
 * Treated as a chromeless gateway by AppShellClient (no nav, no
 * footer) — same pattern as /login, /register, /verify, and
 * /auth/verify-pending. The user has no session at this stage and
 * the global nav would link them to authenticated routes they
 * cannot reach.
 *
 * Pure server component shell — the form lives in a client
 * component (ForgotPasswordForm) so the submit handler can manage
 * its own loading/success/error state without re-renders bouncing
 * off server boundaries.
 */
export default function ForgotPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#020604]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#08331c_0%,#020604_55%,#010101_100%)]" />
      <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,255,65,0.025)_2px,rgba(0,0,0,0.12)_4px)]" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-2xl items-center justify-center px-4 py-12">
        <div className="w-full rounded-[28px] border border-emerald-400/20 bg-black/40 p-8 shadow-[0_0_60px_rgba(0,255,65,0.08)] backdrop-blur-xl md:p-12">
          <div className="mb-6 flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(74,222,128,0.9)]" />
            <span className="font-mono text-[11px] uppercase tracking-[0.42em] text-emerald-300/80">
              Password Recovery
            </span>
          </div>

          <h1 className="text-3xl font-semibold tracking-[0.04em] text-slate-100 md:text-4xl">
            Şifremi unuttum
          </h1>
          <p className="mt-4 text-sm leading-7 text-slate-300/80 md:text-base">
            Email adresini gir, şifreni sıfırlamak için sana bir bağlantı gönderelim. Bağlantı
            1 saat geçerli olacak.
          </p>

          <div className="mt-8">
            <ForgotPasswordForm />
          </div>

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
