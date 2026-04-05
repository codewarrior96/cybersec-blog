import type {
  CertificationStatus,
  EducationStatus,
  PortfolioProfileFields,
} from '@/lib/portfolio-profile'
import type {
  PortfolioCertificationInput,
  PortfolioEducationInput,
  PortfolioProfilePatchInput,
} from '@/lib/soc-store-adapter'

const CERTIFICATION_STATUSES: CertificationStatus[] = ['verified', 'active', 'planned', 'expired']
const EDUCATION_STATUSES: EducationStatus[] = ['completed', 'active', 'planned', 'paused']

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
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
    website: asString(body.website),
    specialties: normalizeListInput(body.specialties),
    tools: normalizeListInput(body.tools),
  }
}

export function validateProfilePayload(payload: PortfolioProfileFields): string | null {
  if (!payload.headline) return 'Profil basligi zorunlu.'
  if (!payload.bio) return 'Profil ozeti zorunlu.'
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
