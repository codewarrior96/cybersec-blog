import { cookies } from 'next/headers'
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

function buildReadonlyVisitorProfile(): PortfolioProfileRecord {
  return {
    user: {
      id: 0,
      username: 'visitor',
      displayName: 'Portfolio Visitor',
      role: 'viewer',
      emailVerified: true,
    },
    profile: {
      headline: 'Profil vitrini',
      bio: 'Profil, sertifika ve egitim alanlarini gormek icin oturum acabilirsin.',
      location: 'Istanbul, Turkiye',
      website: '',
      specialties: [],
      tools: [],
      avatarPath: null,
      avatarName: null,
      avatarMimeType: null,
      updatedAt: new Date('2026-04-05T09:00:00.000Z').toISOString(),
    },
    certifications: [],
    education: [],
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
    return <PortfolioWorkspace initialProfile={buildReadonlyVisitorProfile()} initialTab={initialTab} editable={false} />
  }

  const profile =
    (await getPortfolioProfile(session.user.id)) ??
    buildProfileFromSeed(session.user)
  return <PortfolioWorkspace initialProfile={profile} initialTab={initialTab} editable={true} />
}
