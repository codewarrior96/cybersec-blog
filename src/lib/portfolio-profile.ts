import type { SessionUser } from '@/lib/soc-types'

export type CertificationStatus = 'verified' | 'active' | 'planned' | 'expired'
export type EducationStatus = 'completed' | 'active' | 'planned' | 'paused'

export interface PortfolioProfileFields {
  headline: string
  bio: string
  location: string
  website: string
  specialties: string[]
  tools: string[]
  avatarPath?: string | null
  avatarName?: string | null
  avatarMimeType?: string | null
}

export interface PortfolioCertificationRecord {
  id: number
  userId: number
  title: string
  issuer: string
  issueDate: string
  expiryDate: string
  credentialId: string
  verifyUrl: string
  status: CertificationStatus
  notes: string
  assetPath: string | null
  assetName: string | null
  assetMimeType: string | null
  assetSize: number | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface PortfolioEducationRecord {
  id: number
  userId: number
  institution: string
  program: string
  degree: string
  startDate: string
  endDate: string
  status: EducationStatus
  description: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface PortfolioProfileRecord {
  user: SessionUser
  profile: PortfolioProfileFields & {
    updatedAt: string
  }
  certifications: PortfolioCertificationRecord[]
  education: PortfolioEducationRecord[]
}

export interface PortfolioProfileSeed {
  profile: PortfolioProfileFields
  certifications: Array<Omit<PortfolioCertificationRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
  education: Array<Omit<PortfolioEducationRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
}

const DEFAULT_EMPTY_PROFILE: PortfolioProfileSeed = {
  profile: {
    headline: 'Profil operatoru',
    bio: 'Siber guvenlik yolculugunu, sertifikalarini ve egitimlerini bu alanda duzenli olarak yonetebilirsin.',
    location: '',
    website: '',
    specialties: [],
    tools: [],
    avatarPath: null,
    avatarName: null,
    avatarMimeType: null,
  },
  certifications: [],
  education: [],
}

export function getPortfolioSeedForUser(user: Pick<SessionUser, 'username' | 'displayName'>): PortfolioProfileSeed {
  return {
    ...DEFAULT_EMPTY_PROFILE,
    profile: {
      ...DEFAULT_EMPTY_PROFILE.profile,
      headline: `${user.displayName} / Profil`,
      bio: `${user.displayName} icin olusturulmus duzenlenebilir profil alani. Sertifikalarini, egitimlerini ve profesyonel bilgisini bu alan uzerinden yonetebilirsin.`,
    },
  }
}

export function dedupeStringList(values: string[], maxItems = 24): string[] {
  const seen = new Set<string>()
  const next: string[] = []

  for (const value of values) {
    const normalized = value.trim()
    if (!normalized) continue
    const key = normalized.toLocaleLowerCase('tr-TR')
    if (seen.has(key)) continue
    seen.add(key)
    next.push(normalized)
    if (next.length >= maxItems) break
  }

  return next
}
