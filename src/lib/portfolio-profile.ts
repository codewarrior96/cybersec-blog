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
    headline: 'Breach Operator',
    bio: 'Siber guvenlik alaninda kendini gelistiren, arastirma odakli bir operator profili.',
    location: 'Istanbul, Turkiye',
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

const GHOST_PROFILE: PortfolioProfileSeed = {
  profile: {
    headline: 'Cybersecurity Researcher / Breach Operator',
    bio: 'Siber guvenlik alaninda arastirma yapan, CTF ortamlarinda kendini gelistiren ve ogrendiklerini duzenli olarak paylasan bir operator profili. Ilgi alanlari web guvenligi, tehdit analizi, writeup uretimi ve savunma bakis acisiyla saldiri zinciri incelemesidir.',
    location: 'Istanbul, Turkiye',
    website: 'https://cybersec.blog',
    specialties: ['Web Security', 'Threat Analysis', 'CTF', 'Writeup', 'Blue Team Thinking'],
    tools: ['Burp Suite', 'Nmap', 'Metasploit', 'Wireshark', 'Ghidra', 'Python', 'Linux', 'Sqlmap'],
    avatarPath: null,
    avatarName: null,
    avatarMimeType: null,
  },
  certifications: [
    {
      title: 'Google Cybersecurity Certificate',
      issuer: 'Google / Coursera',
      issueDate: '',
      expiryDate: '',
      credentialId: '',
      verifyUrl: 'https://www.coursera.org/professional-certificates/google-cybersecurity',
      status: 'active',
      notes: 'Belge yuklenince dogrudan sertifika onizlemesi burada gorunecek.',
      assetPath: null,
      assetName: null,
      assetMimeType: null,
      assetSize: null,
      sortOrder: 0,
    },
    {
      title: 'TryHackMe Learning Path',
      issuer: 'TryHackMe',
      issueDate: '',
      expiryDate: '',
      credentialId: '',
      verifyUrl: 'https://tryhackme.com/',
      status: 'active',
      notes: 'Tamamlama rozetini veya belge goruntusunu ekleyebilirsin.',
      assetPath: null,
      assetName: null,
      assetMimeType: null,
      assetSize: null,
      sortOrder: 1,
    },
    {
      title: 'CompTIA Security+',
      issuer: 'CompTIA',
      issueDate: '',
      expiryDate: '',
      credentialId: '',
      verifyUrl: 'https://www.comptia.org/certifications/security',
      status: 'planned',
      notes: 'Planlanan sertifika hedefi.',
      assetPath: null,
      assetName: null,
      assetMimeType: null,
      assetSize: null,
      sortOrder: 2,
    },
    {
      title: 'eJPT',
      issuer: 'INE / eLearnSecurity',
      issueDate: '',
      expiryDate: '',
      credentialId: '',
      verifyUrl: 'https://security.ine.com/certifications/ejpt-certification/',
      status: 'planned',
      notes: 'Planlanan teknik sertifika hedefi.',
      assetPath: null,
      assetName: null,
      assetMimeType: null,
      assetSize: null,
      sortOrder: 3,
    },
  ],
  education: [
    {
      institution: 'Self-Directed Learning Track',
      program: 'Linux ve Terminal Temelleri',
      degree: 'Foundation Track',
      startDate: '2024-01',
      endDate: '2024-06',
      status: 'completed',
      description: 'Terminal komutlari, dosya sistemi, temel script mantigi ve Linux calisma aliskanliklari.',
      sortOrder: 0,
    },
    {
      institution: 'Self-Directed Learning Track',
      program: 'Python ve Otomasyon Temelleri',
      degree: 'Foundation Track',
      startDate: '2024-04',
      endDate: '2024-12',
      status: 'completed',
      description: 'Dosya islemleri, fonksiyonlar, mini scriptler ve guvenlik odakli otomasyon calismalari.',
      sortOrder: 1,
    },
    {
      institution: 'Security Practice Path',
      program: 'Web Security ve OWASP Basics',
      degree: 'Practice Track',
      startDate: '2025-01',
      endDate: '',
      status: 'active',
      description: 'OWASP Top 10, Burp Suite, temel web zafiyetleri ve pratik writeup deneyimi.',
      sortOrder: 2,
    },
  ],
}

export function getPortfolioSeedForUser(user: Pick<SessionUser, 'username' | 'displayName'>): PortfolioProfileSeed {
  if (user.username === 'ghost') {
    return GHOST_PROFILE
  }

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
