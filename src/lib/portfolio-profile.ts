import type { SessionUser } from '@/lib/soc-types'

export type CertificationStatus = 'verified' | 'active' | 'planned' | 'expired'
export type EducationStatus = 'completed' | 'active' | 'planned' | 'paused'

/**
 * A-25 closure (Wave 11): multi-platform social handles. Replaces the
 * single `website` text field with 6 opsiyonel platform fields.
 *
 * Storage convention:
 *   - 5 platform fields (github / linkedin / tryhackme / hackthebox /
 *     twitter) store the username only (e.g. "codewarrior96"). The
 *     display layer constructs the full URL via the canonical platform
 *     host (e.g. `https://github.com/{username}`). Single source of
 *     truth + per-platform validation against a username regex.
 *   - `personal` stores a full URL because no canonical platform host
 *     applies. Validation reuses `assertSafeUrl`-style scheme allowlist.
 *
 * All fields opsiyonel. Missing/empty strings are treated as "no link"
 * by the display surface.
 */
export interface SocialLinks {
  github?: string
  linkedin?: string
  tryhackme?: string
  hackthebox?: string
  twitter?: string
  personal?: string
}

export interface PortfolioProfileFields {
  headline: string
  bio: string
  location: string
  socialLinks?: SocialLinks
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
  // R-API-14 closure (Wave 5C): two-stage archive→delete state. null while
  // the cert is "active"; ISO timestamp once archived. DELETE rejects
  // records with archivedAt === null (must archive first). Mirrors the
  // ReportRecord.archivedAt contract in soc-store-memory.ts L685.
  archivedAt: string | null
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
  // R-API-14 closure (Wave 5C): see PortfolioCertificationRecord.archivedAt.
  archivedAt: string | null
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
    socialLinks: {},
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

/**
 * A-25 closure (Wave 11): trim + drop empty values from a SocialLinks
 * patch. Empty strings collapse to an absent key so the storage layer
 * always sees a clean object (no `{ github: "" }` noise). Called by
 * every store's updatePortfolioProfile path so all 3 backends apply
 * the same normalization contract.
 */
export function normalizeSocialLinksPatch(patch: SocialLinks | undefined): SocialLinks {
  if (!patch) return {}
  const next: SocialLinks = {}
  for (const key of ['github', 'linkedin', 'tryhackme', 'hackthebox', 'twitter', 'personal'] as const) {
    const value = patch[key]
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (trimmed) {
        next[key] = trimmed
      }
    }
  }
  return next
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
