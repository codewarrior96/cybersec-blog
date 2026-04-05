import { cookies } from 'next/headers'
import type { Metadata } from 'next'
import PortfolioWorkspace from '@/components/portfolio/PortfolioWorkspace'
import { getServerSessionFromCookies } from '@/lib/auth-server'
import { getPortfolioProfile } from '@/lib/soc-store-adapter'
import { getPortfolioSeedForUser } from '@/lib/portfolio-profile'
import type { PortfolioProfileRecord } from '@/lib/portfolio-profile'

export const metadata: Metadata = {
  title: 'Profil',
}

function buildProfileFromSeed(username: string, displayName: string, userId = 1): PortfolioProfileRecord {
  const seed = getPortfolioSeedForUser({ username, displayName })

  return {
    user: {
      id: userId,
      username,
      displayName,
      role: username === 'ghost' ? 'admin' : 'viewer',
    },
    profile: {
      ...seed.profile,
      updatedAt: new Date('2026-04-05T09:00:00.000Z').toISOString(),
    },
    certifications: seed.certifications.map((item, index) => ({
      id: index + 1,
      userId,
      createdAt: new Date('2026-04-05T09:00:00.000Z').toISOString(),
      updatedAt: new Date('2026-04-05T09:00:00.000Z').toISOString(),
      ...item,
    })),
    education: seed.education.map((item, index) => ({
      id: index + 1,
      userId,
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

  if (!session) {
    return <PortfolioWorkspace initialProfile={buildProfileFromSeed('ghost', 'Ghost Admin')} initialTab={initialTab} editable={false} />
  }

  const profile =
    (await getPortfolioProfile(session.user.id)) ??
    buildProfileFromSeed(session.user.username, session.user.displayName, session.user.id)
  return <PortfolioWorkspace initialProfile={profile} initialTab={initialTab} editable={true} />
}
