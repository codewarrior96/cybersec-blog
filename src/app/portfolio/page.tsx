import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import PortfolioWorkspace from '@/components/portfolio/PortfolioWorkspace'
import { getServerSessionFromCookies } from '@/lib/auth-server'
import { getPortfolioProfile } from '@/lib/soc-store-adapter'
import { getPortfolioSeedForUser } from '@/lib/portfolio-profile'
import type { SessionUser } from '@/lib/soc-types'
import type { PortfolioProfileRecord } from '@/lib/portfolio-profile'

export const metadata: Metadata = {
  title: 'Profil',
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
  // routes (/community, /zafiyet-taramasi) which now hard-redirect.
  // Hard redirect here closes the asymmetry and removes a dead-mode
  // code path that was never the product's actual UX intent.
  if (!session) {
    redirect('/login')
  }

  const profile =
    (await getPortfolioProfile(session.user.id)) ??
    buildProfileFromSeed(session.user)
  return <PortfolioWorkspace initialProfile={profile} initialTab={initialTab} editable={true} />
}
