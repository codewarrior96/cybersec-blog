import Link from 'next/link'
import { headers } from 'next/headers'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  // Phase 6: title only — root template appends '· siberlab'.
  title: 'Email doğrula',
  description: 'Email adresini doğrula ve hesabını aktive et.',
}

type VerifyState = 'success' | 'expired' | 'invalid' | 'internal' | 'no-token'

interface VerifyApiResponse {
  ok: boolean
  error?: 'TOKEN_INVALID' | 'TOKEN_EXPIRED' | 'INTERNAL'
}

async function callVerify(token: string): Promise<VerifyState> {
  if (!token) return 'no-token'

  // Build absolute URL so server-side fetch resolves correctly. Prefer
  // NEXT_PUBLIC_APP_URL; fall back to the request's host header (works
  // on Vercel preview deploys without env config).
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim()
  let baseUrl = configured ? configured.replace(/\/$/, '') : ''
  if (!baseUrl) {
    const hdrs = await headers()
    const host = hdrs.get('x-forwarded-host') ?? hdrs.get('host') ?? 'localhost:3000'
    const proto = hdrs.get('x-forwarded-proto') ?? (host.includes('localhost') ? 'http' : 'https')
    baseUrl = `${proto}://${host}`
  }

  try {
    const res = await fetch(`${baseUrl}/api/auth/verify?token=${encodeURIComponent(token)}`, {
      cache: 'no-store',
    })
    const json = (await res.json().catch(() => null)) as VerifyApiResponse | null
    if (json?.ok) return 'success'
    if (json?.error === 'TOKEN_EXPIRED') return 'expired'
    if (json?.error === 'TOKEN_INVALID') return 'invalid'
    return 'internal'
  } catch (err) {
    console.error('[verify-page] fetch failed:', err)
    return 'internal'
  }
}

interface PageProps {
  searchParams: Promise<{ token?: string }> | { token?: string }
}

export default async function VerifyPage({ searchParams }: PageProps) {
  const params = await Promise.resolve(searchParams)
  const token = typeof params.token === 'string' ? params.token : ''
  const state = await callVerify(token)

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#020604]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#08331c_0%,#020604_55%,#010101_100%)]" />
      <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,255,65,0.025)_2px,rgba(0,0,0,0.12)_4px)]" />

      {state === 'success' && (
        // Auto-redirect to /login after 3 seconds via meta refresh.
        // Inline so the user sees confirmation first; pure-server-component
        // safe (no client-side router needed).
        <meta httpEquiv="refresh" content="3;url=/login" />
      )}

      <div className="relative z-10 mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4 py-12">
        <div className="w-full rounded-[28px] border border-emerald-400/20 bg-black/40 p-8 shadow-[0_0_60px_rgba(0,255,65,0.08)] backdrop-blur-xl md:p-12">
          <div className="mb-6 flex items-center gap-3">
            <div
              className={`h-3 w-3 rounded-full ${
                state === 'success'
                  ? 'bg-emerald-400 shadow-[0_0_12px_rgba(74,222,128,0.9)]'
                  : state === 'expired'
                    ? 'bg-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.9)]'
                    : 'bg-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.9)]'
              }`}
            />
            <span className="font-mono text-[11px] uppercase tracking-[0.42em] text-emerald-300/80">
              Email Verification
            </span>
          </div>

          {state === 'success' && (
            <>
              <div className="mb-4 flex items-center gap-3">
                <span className="text-3xl text-emerald-400">✓</span>
                <h1 className="text-3xl font-semibold tracking-[0.04em] text-slate-100 md:text-4xl">
                  Email doğrulandı — şimdi giriş yap
                </h1>
              </div>
              <p className="text-sm leading-7 text-slate-300/80 md:text-base">
                Hesabın aktive oldu. 3 saniye içinde giriş ekranına yönlendiriliyorsun;
                kullanıcı adın ve şifrenle oturum açıp BREACH LAB&apos;e erişebilirsin.
                Yönlendirme olmazsa aşağıdaki bağlantıdan devam et.
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
          )}

          {state === 'expired' && (
            <>
              <div className="mb-4 flex items-center gap-3">
                <span className="text-3xl text-amber-400">⚠</span>
                <h1 className="text-3xl font-semibold tracking-[0.04em] text-slate-100 md:text-4xl">
                  Bağlantı süresi doldu
                </h1>
              </div>
              <p className="text-sm leading-7 text-slate-300/80 md:text-base">
                Doğrulama bağlantısı 24 saat geçerliydi ve süresi doldu. Yeni bir bağlantı
                talep et — mevcut hesabın için geçerli olacak.
              </p>
              <div className="mt-6 rounded-2xl border border-amber-400/15 bg-amber-400/[0.04] p-4 text-sm text-slate-300">
                Yeni bağlantı için verify-pending sayfasındaki yeniden gönder akışını kullan
                ya da{' '}
                <Link href="/login" className="text-emerald-300 underline">
                  giriş ekranından
                </Link>
                {' '}destek talep et.
              </div>
              <div className="mt-8">
                <Link
                  href="/auth/verify-pending"
                  className="inline-flex items-center justify-center rounded-2xl border border-amber-300/35 bg-amber-400/10 px-6 py-3 font-mono text-[12px] uppercase tracking-[0.35em] text-amber-200 transition hover:border-amber-200/50 hover:bg-amber-400/16"
                >
                  Yeniden gönder
                </Link>
              </div>
            </>
          )}

          {(state === 'invalid' || state === 'no-token') && (
            <>
              <div className="mb-4 flex items-center gap-3">
                <span className="text-3xl text-rose-400">✕</span>
                <h1 className="text-3xl font-semibold tracking-[0.04em] text-slate-100 md:text-4xl">
                  Bağlantı geçersiz
                </h1>
              </div>
              <p className="text-sm leading-7 text-slate-300/80 md:text-base">
                {state === 'no-token'
                  ? 'Bağlantıda doğrulama kodu yok. Mailinden gelen tam URL ile tekrar dene.'
                  : 'Bu bağlantı geçersiz veya zaten kullanılmış. Yeni bir bağlantı talep et veya zaten doğrulanmış bir hesapla giriş yap.'}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/auth/verify-pending"
                  className="inline-flex items-center justify-center rounded-2xl border border-emerald-300/35 bg-emerald-400/10 px-6 py-3 font-mono text-[12px] uppercase tracking-[0.35em] text-emerald-200 transition hover:border-emerald-200/50 hover:bg-emerald-400/16"
                >
                  Yeniden gönder
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center rounded-2xl border border-emerald-300/20 bg-transparent px-6 py-3 font-mono text-[12px] uppercase tracking-[0.35em] text-emerald-300/70 transition hover:border-emerald-300/40 hover:text-emerald-200"
                >
                  Giriş ekranı
                </Link>
              </div>
            </>
          )}

          {state === 'internal' && (
            <>
              <div className="mb-4 flex items-center gap-3">
                <span className="text-3xl text-rose-400">✕</span>
                <h1 className="text-3xl font-semibold tracking-[0.04em] text-slate-100 md:text-4xl">
                  Beklenmeyen hata
                </h1>
              </div>
              <p className="text-sm leading-7 text-slate-300/80 md:text-base">
                Doğrulama servisi şu anda yanıt vermiyor. Birkaç dakika sonra tekrar dene.
              </p>
              <div className="mt-8">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center rounded-2xl border border-emerald-300/20 bg-transparent px-6 py-3 font-mono text-[12px] uppercase tracking-[0.35em] text-emerald-300/70 transition hover:border-emerald-300/40 hover:text-emerald-200"
                >
                  Giriş ekranı
                </Link>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  )
}
