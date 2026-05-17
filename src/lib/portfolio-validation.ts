import type {
  CertificationStatus,
  EducationStatus,
  PortfolioProfileFields,
  SocialLinks,
} from '@/lib/portfolio-profile'
import type {
  PortfolioCertificationInput,
  PortfolioEducationInput,
  PortfolioProfilePatchInput,
} from '@/lib/soc-store-adapter'

const CERTIFICATION_STATUSES: CertificationStatus[] = ['verified', 'active', 'planned', 'expired']
const EDUCATION_STATUSES: EducationStatus[] = ['completed', 'active', 'planned', 'paused']

// A-25 closure (Wave 11): per-platform username regex. Conservative
// alphanumeric + underscore + hyphen + dot for handles up to 39 chars
// (GitHub max). Permissive enough for LinkedIn / TryHackMe / HackTheBox
// / X-Twitter usernames; strict enough to reject HTML / URL / whitespace
// injection. Empty values are SKIPPED by validateSocialLinks (all
// platform fields opsiyonel).
const SOCIAL_USERNAME_RE = /^[a-zA-Z0-9._-]{1,39}$/

// A-25: personal field stores a full URL (no canonical platform host).
// Accept http:// or https:// only — assertSafeUrl-style scheme allowlist
// applied inline (no import dependency on email-templates module). Cap
// at 200 chars to bound payload size.
const PERSONAL_URL_MAX_LEN = 200

function isValidPersonalUrl(value: string): boolean {
  if (value.length > PERSONAL_URL_MAX_LEN) return false
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function parseSocialLinks(value: unknown): SocialLinks {
  if (!value || typeof value !== 'object') return {}
  const source = value as Record<string, unknown>
  const next: SocialLinks = {}
  for (const key of ['github', 'linkedin', 'tryhackme', 'hackthebox', 'twitter', 'personal'] as const) {
    const raw = source[key]
    if (typeof raw === 'string') {
      const trimmed = raw.trim()
      if (trimmed) {
        next[key] = trimmed
      }
    }
  }
  return next
}

export function normalizeListInput(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .flatMap((item) => item.split(/[\n,]/))
      .map((item) => item.trim())
      .filter(Boolean)
  }

  if (typeof value === 'string') {
    return value
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean)
  }

  return []
}

export function parseProfilePayload(body: Record<string, unknown>): PortfolioProfilePatchInput {
  return {
    headline: asString(body.headline),
    bio: asString(body.bio),
    location: asString(body.location),
    socialLinks: parseSocialLinks(body.socialLinks),
    specialties: normalizeListInput(body.specialties),
    tools: normalizeListInput(body.tools),
  }
}

export function validateProfilePayload(payload: PortfolioProfileFields): string | null {
  if (!payload.headline) return 'Profil basligi zorunlu.'
  if (!payload.bio) return 'Profil ozeti zorunlu.'
  // A-25 closure (Wave 11): per-platform social link validation. Skip
  // empty fields (all opsiyonel). 5 platforms validate against
  // SOCIAL_USERNAME_RE (alphanumeric + . _ - up to 39 chars). `personal`
  // validates as http(s) URL up to 200 chars.
  const links = payload.socialLinks ?? {}
  const platformChecks: Array<['github' | 'linkedin' | 'tryhackme' | 'hackthebox' | 'twitter', string]> = [
    ['github', 'GitHub'],
    ['linkedin', 'LinkedIn'],
    ['tryhackme', 'TryHackMe'],
    ['hackthebox', 'HackTheBox'],
    ['twitter', 'X/Twitter'],
  ]
  for (const [key, label] of platformChecks) {
    const value = links[key]
    if (value && !SOCIAL_USERNAME_RE.test(value)) {
      return `${label} kullanici adi gecersiz (sadece harf, rakam, nokta, alt cizgi, tire — en fazla 39 karakter).`
    }
  }
  if (links.personal && !isValidPersonalUrl(links.personal)) {
    return 'Kisisel website tam URL olmalidir (http:// veya https://, en fazla 200 karakter).'
  }
  return null
}

export function parseCertificationStatus(value: unknown): CertificationStatus {
  if (typeof value === 'string' && CERTIFICATION_STATUSES.includes(value as CertificationStatus)) {
    return value as CertificationStatus
  }
  return 'active'
}

export function parseEducationStatus(value: unknown): EducationStatus {
  if (typeof value === 'string' && EDUCATION_STATUSES.includes(value as EducationStatus)) {
    return value as EducationStatus
  }
  return 'active'
}

export function parseCertificationInput(formData: FormData): {
  input: PortfolioCertificationInput
  assetFile: File | null
} {
  const assetCandidate = formData.get('asset')
  const assetFile = assetCandidate instanceof File && assetCandidate.size > 0 ? assetCandidate : null

  return {
    input: {
      title: asString(formData.get('title')),
      issuer: asString(formData.get('issuer')),
      issueDate: asString(formData.get('issueDate')),
      expiryDate: asString(formData.get('expiryDate')),
      credentialId: asString(formData.get('credentialId')),
      verifyUrl: asString(formData.get('verifyUrl')),
      status: parseCertificationStatus(formData.get('status')),
      notes: asString(formData.get('notes')),
      sortOrder: Number.parseInt(asString(formData.get('sortOrder')), 10) || 0,
    },
    assetFile,
  }
}

export function validateCertificationInput(input: PortfolioCertificationInput): string | null {
  if (!input.title) return 'Sertifika basligi zorunlu.'
  if (!input.issuer) return 'Sertifikayi veren kurum zorunlu.'
  return null
}

export function parseEducationInput(body: Record<string, unknown>): PortfolioEducationInput {
  return {
    institution: asString(body.institution),
    program: asString(body.program),
    degree: asString(body.degree),
    startDate: asString(body.startDate),
    endDate: asString(body.endDate),
    status: parseEducationStatus(body.status),
    description: asString(body.description),
    sortOrder: Number.parseInt(asString(body.sortOrder), 10) || 0,
  }
}

export function validateEducationInput(input: PortfolioEducationInput): string | null {
  if (!input.institution) return 'Kurum bilgisi zorunlu.'
  if (!input.program) return 'Program bilgisi zorunlu.'
  return null
}
