import Link from 'next/link'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Email doğrulama bekleniyor — BREACH LAB',
  description: 'Email kutuna gönderilen doğrulama bağlantısına tıkla.',
}

/**
 * Post-register landing page (Phase 3 of email foundation milestone).
 *
 * Reached after successful registration. As of Phase 4.5, register no
 * longer mints a session cookie — the user has NO active session here;
 * the screen exists only to prompt them to check their inbox. After they
 * click the verification link, /verify flips emailVerified=true and
 * directs them to /login to obtain a session.
 *
 * Hacker-terminal style matches /login + /register. No client interactivity
 * — pure server component. The verify-pending screen is treated as a
 * chromeless gateway by AppShellClient (no nav, no footer).
 */
export default function VerifyPendingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#020604]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#08331c_0%,#020604_55%,#010101_100%)]" />
      <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,255,65,0.025)_2px,rgba(0,0,0,0.12)_4px)]" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4 py-12">
        <div className="w-full rounded-[28px] border border-emerald-400/20 bg-black/40 p-8 shadow-[0_0_60px_rgba(0,255,65,0.08)] backdrop-blur-xl md:p-12">
          <div className="mb-6 flex items-center gap-3">
            <div className="h-3 w-3 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(74,222,128,0.9)]" />
            <span className="font-mono text-[11px] uppercase tracking-[0.42em] text-emerald-300/80">
              Email Verification Pending
            </span>
          </div>

          <h1 className="text-3xl font-semibold tracking-[0.04em] text-slate-100 md:text-4xl">
            Email kutunu kontrol et
          </h1>
          <p className="mt-4 text-sm leading-7 text-slate-300/80 md:text-base">
            Hesap kaydın oluşturuldu. Doğrulama bağlantısını kayıt sırasında girdiğin email
            adresine gönderdim. Bağlantıya tıkladığında hesabın aktive olacak; ardından
            giriş ekranından oturum açabilirsin.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-emerald-400/10 bg-emerald-400/[0.04] p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-emerald-300/60">
                01 — Inbox
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Bağlantı gelene kadar 30-60 saniye bekleyebilir. Spam/junk klasörünü de
                kontrol et — bazen Resend mailleri orada belirir.
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-400/10 bg-emerald-400/[0.04] p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-emerald-300/60">
                02 — Süre
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Doğrulama bağlantısı 24 saat geçerli. Bu süre içinde tıklamazsan, yeni bir
                bağlantı talep etmen gerekir.
              </p>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-amber-400/15 bg-amber-400/[0.04] p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-amber-300/70">
              Bağlantı gelmedi mi?
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Tekrar gönderim akışı yakında geliyor. Şimdilik birkaç dakika bekle ve spam
              klasörünü kontrol et. Yine de gelmezse{' '}
              <Link href="/login" className="text-emerald-300 underline">
                giriş ekranı
              </Link>
              {' '}üzerinden destek talep edebilirsin.
            </p>
          </div>

          <div className="mt-8 flex items-center justify-between gap-4 border-t border-emerald-400/10 pt-5 text-xs text-slate-500">
            <span className="font-mono tracking-[0.24em] text-emerald-300/35">
              EMAIL VERIFICATION REQUIRED
            </span>
            <Link
              href="/login"
              className="font-mono uppercase tracking-[0.28em] text-emerald-300/60 transition hover:text-emerald-200"
            >
              Giriş ekranı
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
