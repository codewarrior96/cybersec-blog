'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import MatrixRain from '@/components/MatrixRain'
import { getAuthSession, registerWithPassword } from '@/lib/auth-client'

interface EmbeddedRegisterProps {
  redirectTo?: string
}

export default function EmbeddedRegister({ redirectTo = '/portfolio?tab=profile' }: EmbeddedRegisterProps) {
  const router = useRouter()
  const [visible, setVisible] = useState(false)
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let alive = true
    const check = async () => {
      const session = await getAuthSession(false)
      if (alive && session.authenticated) {
        router.push(redirectTo)
      }
    }
    void check()
    return () => {
      alive = false
    }
  }, [redirectTo, router])

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 80)
    return () => window.clearTimeout(timer)
  }, [])

  const handleRegister = async () => {
    if (loading) return
    setLoading(true)
    setError(null)

    try {
      const result = await registerWithPassword({
        username: username.trim(),
        displayName: displayName.trim(),
        password,
        confirmPassword,
      })

      if (!result.ok) {
        setError(result.error ?? 'Kayit basarisiz oldu.')
        return
      }

      router.push(redirectTo)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#020604]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#08331c_0%,#020604_55%,#010101_100%)]" />
      <div className="absolute inset-0 opacity-25 mix-blend-screen">
        <MatrixRain />
      </div>
      <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,255,65,0.025)_2px,rgba(0,0,0,0.12)_4px)]" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl items-center justify-center px-4 py-12">
        <div
          className={`grid w-full max-w-5xl gap-8 rounded-[28px] border border-emerald-400/20 bg-black/40 p-5 shadow-[0_0_60px_rgba(0,255,65,0.08)] backdrop-blur-xl transition-all duration-700 md:grid-cols-[1.15fr_0.85fr] md:p-8 ${
            visible ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0'
          }`}
        >
          <section className="rounded-[24px] border border-emerald-400/10 bg-[linear-gradient(180deg,rgba(5,25,16,0.88),rgba(3,9,7,0.88))] p-6 md:p-8">
            <div className="mb-8 flex items-center gap-3">
              <div className="h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(74,222,128,0.9)]" />
              <span className="font-mono text-[11px] uppercase tracking-[0.42em] text-emerald-300/80">
                Operator Identity Provisioning
              </span>
            </div>

            <h1 className="max-w-xl text-3xl font-semibold tracking-[0.04em] text-slate-100 md:text-5xl">
              Portfolyo icin canli ve duzenlenebilir bir profil olusturalim.
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300/80 md:text-base">
              Kayit olduktan sonra seni dogrudan <span className="font-semibold text-emerald-300">Portfolio</span>
              {' '}alanindaki profesyonel profil hub&apos;ina goturecegim. Orada sertifikalarini belge olarak
              yukleyebilir, egitimlerini duzenleyebilir ve kendi vitrininin kontrolunu alabilirsin.
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {[
                ['01', 'Profil', 'Baslik, biyografi, uzmanlik alanlari ve kullandigin araclar.'],
                ['02', 'Sertifikalar', 'PDF veya gorsel belge onizlemeli profesyonel sertifika vitrinleri.'],
                ['03', 'Egitimler', 'Kendi egitim yolculugunu satir satir guncelleyebilecegin alan.'],
              ].map(([index, title, description]) => (
                <div
                  key={title}
                  className="rounded-2xl border border-emerald-400/10 bg-emerald-400/[0.04] p-4"
                >
                  <span className="font-mono text-[11px] tracking-[0.3em] text-emerald-300/60">{index}</span>
                  <h2 className="mt-3 text-lg font-semibold text-slate-100">{title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[24px] border border-emerald-400/12 bg-[#040807]/88 p-6 shadow-[inset_0_0_40px_rgba(0,0,0,0.55)] md:p-8">
            <div className="mb-8">
              <p className="font-mono text-[11px] uppercase tracking-[0.42em] text-emerald-300/65">
                Register
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-slate-100">Yeni operator profili</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Guvenli oturum acilisi ile hesabini olustur, sonra profiline gecelim.
              </p>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.3em] text-emerald-300/60">
                  Kullanici Adi
                </span>
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && void handleRegister()}
                  placeholder="ornek: breach.analyst"
                  className="w-full rounded-2xl border border-emerald-400/20 bg-black/55 px-4 py-3 text-sm text-emerald-100 outline-none transition focus:border-emerald-300/60 focus:shadow-[0_0_0_4px_rgba(16,185,129,0.12)]"
                />
              </label>

              <label className="block">
                <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.3em] text-emerald-300/60">
                  Gorunen Ad
                </span>
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && void handleRegister()}
                  placeholder="Profil basliginda gorunecek isim"
                  className="w-full rounded-2xl border border-emerald-400/20 bg-black/55 px-4 py-3 text-sm text-emerald-100 outline-none transition focus:border-emerald-300/60 focus:shadow-[0_0_0_4px_rgba(16,185,129,0.12)]"
                />
              </label>

              <label className="block">
                <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.3em] text-emerald-300/60">
                  Sifre
                </span>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    onKeyDown={(event) => event.key === 'Enter' && void handleRegister()}
                    placeholder="En az 8 karakter"
                    className="w-full rounded-2xl border border-emerald-400/20 bg-black/55 px-4 py-3 pr-20 text-sm text-emerald-100 outline-none transition focus:border-emerald-300/60 focus:shadow-[0_0_0_4px_rgba(16,185,129,0.12)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[11px] uppercase tracking-[0.25em] text-emerald-300/55 transition hover:text-emerald-200"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </label>

              <label className="block">
                <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.3em] text-emerald-300/60">
                  Sifre Tekrari
                </span>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    onKeyDown={(event) => event.key === 'Enter' && void handleRegister()}
                    placeholder="Sifreni tekrar gir"
                    className="w-full rounded-2xl border border-emerald-400/20 bg-black/55 px-4 py-3 pr-20 text-sm text-emerald-100 outline-none transition focus:border-emerald-300/60 focus:shadow-[0_0_0_4px_rgba(16,185,129,0.12)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[11px] uppercase tracking-[0.25em] text-emerald-300/55 transition hover:text-emerald-200"
                  >
                    {showConfirmPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </label>
            </div>

            {error && (
              <div className="mt-4 rounded-2xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={() => void handleRegister()}
              disabled={loading}
              className="mt-6 inline-flex w-full items-center justify-center rounded-2xl border border-emerald-300/35 bg-emerald-400/10 px-4 py-3 font-mono text-[12px] uppercase tracking-[0.35em] text-emerald-200 transition hover:border-emerald-200/50 hover:bg-emerald-400/16 disabled:cursor-default disabled:opacity-60"
            >
              {loading ? 'Profil olusturuluyor' : 'Kayit Ol ve Profili Ac'}
            </button>

            <div className="mt-6 flex items-center justify-between gap-4 border-t border-emerald-400/10 pt-5 text-xs text-slate-500">
              <span className="font-mono tracking-[0.24em] text-emerald-300/35">TLS 1.3 / SESSION BOOTSTRAP</span>
              <Link href="/login" className="font-mono uppercase tracking-[0.28em] text-emerald-300/60 transition hover:text-emerald-200">
                Giris ekranina don
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
