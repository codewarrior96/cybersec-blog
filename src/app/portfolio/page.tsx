import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import PortfolioWorkspace from '@/components/portfolio/PortfolioWorkspace'
import { getServerSessionFromCookies } from '@/lib/auth-server'
import { getPortfolioProfile } from '@/lib/soc-store-adapter'
import { getPortfolioSeedForUser } from '@/lib/portfolio-profile'
import { createSignedObjectUrl, isSupabaseAppStateEnabled } from '@/lib/supabase-app-state'
import type { SessionUser } from '@/lib/soc-types'
import type { PortfolioProfileRecord } from '@/lib/portfolio-profile'

export const metadata: Metadata = {
  title: 'Portfolio',
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

function buildProfileFromSeed(user: SessionUser): PortfolioProfileRecord {
  const seed = getPortfolioSeedForUser({
    username: user.username,
    displayName: user.displayName,
  })

  return {
    user,
    profile: {
      ...seed.profile,
      updatedAt: new Date('2026-04-05T09:00:00.000Z').toISOString(),
    },
    certifications: seed.certifications.map((item, index) => ({
      id: index + 1,
      userId: user.id,
      createdAt: new Date('2026-04-05T09:00:00.000Z').toISOString(),
      updatedAt: new Date('2026-04-05T09:00:00.000Z').toISOString(),
      ...item,
    })),
    education: seed.education.map((item, index) => ({
      id: index + 1,
      userId: user.id,
      createdAt: new Date('2026-04-05T09:00:00.000Z').toISOString(),
      updatedAt: new Date('2026-04-05T09:00:00.000Z').toISOString(),
      ...item,
    })),
  }
}

function normalizeTab(value: string | undefined): 'profile' | 'certifications' | 'education' {
  if (value === 'certifications' || value === 'education' || value === 'profile') {
    return value
  }
  return 'profile'
}

export default async function PortfolioPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }> | { tab?: string }
}) {
  const params = await Promise.resolve(searchParams ?? {})
  const initialTab = normalizeTab(params.tab)
  const cookieStore = cookies()
  const session = await getServerSessionFromCookies(cookieStore)

  // BUG-006 — Symmetric server-side auth gate. Previously this route
  // rendered a read-only "visitor" view for anon users via a helper
  // that has been removed in this same change. That visitor view
  // created an asymmetric attack surface vs sibling protected
  // routes (/academy, /zafiyet-taramasi) which now hard-redirect.
  // (A-26 Wave 12: /academy was formerly /community; same gate, new
  // path. See src/app/academy/layout.tsx.)
  // Hard redirect here closes the asymmetry and removes a dead-mode
  // code path that was never the product's actual UX intent.
  if (!session) {
    redirect('/login')
  }

  const profile =
    (await getPortfolioProfile(session.user.id)) ??
    buildProfileFromSeed(session.user)

  // A-27 closure (Wave 13 Faz 13.C): SSR-resolve avatar signed URL on the
  // server so the 3 <img> render sites in PortfolioWorkspace all consume a
  // single shared URL string — the browser dedupes natively, eliminating
  // the triple-fetch storm documented in WAVE_13_AVATAR_PERF_AUDIT.md.
  // Legacy /api/profile/avatar/[userId] fetch path preserved as fallback
  // (graceful degradation when SSR resolve fails or in sqlite-mode).
  // TTL = 30s per Z.15 (revised from 15s in Wave 5B R-API-10; security
  // envelope preserved + 2× cache window for the Cache-Control + browser
  // dedup combo to compound). Wave 10 router.refresh() on save handlers
  // triggers Server Component re-render → fresh signed URL flows down.
  let initialAvatarUrl: string | null = null
  if (isSupabaseAppStateEnabled() && profile.profile.avatarPath) {
    try {
      initialAvatarUrl = await createSignedObjectUrl(profile.profile.avatarPath, 30)
    } catch (err) {
      // SENIOR ARCHITECT NOTE: signed URL failures must not break the
      // page render. The client-side PortfolioWorkspace falls back to
      // the legacy /api/profile/avatar/[userId] fetch path when this
      // prop is null. Console.error tracks the failure for observability
      // without leaking to the user.
      console.error('[portfolio/page] SSR avatar signed URL resolve failed:', err)
      initialAvatarUrl = null
    }
  }

  return (
    <PortfolioWorkspace
      initialProfile={profile}
      initialTab={initialTab}
      editable={true}
      initialAvatarUrl={initialAvatarUrl}
    />
  )
}
