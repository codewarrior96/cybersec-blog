import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-auth'
import { getRequestMetadata } from '@/lib/auth-server'
import { createPortfolioCertification, getPortfolioProfile } from '@/lib/soc-store-adapter'
import { deleteStoredAsset, saveCertificationAsset } from '@/lib/portfolio-assets'
import { parseCertificationInput, validateCertificationInput } from '@/lib/portfolio-validation'
import {
  MAX_CERTIFICATIONS_PER_USER,
  checkCountQuota,
  quotaReasonToStatus,
} from '@/lib/quota'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const guard = await requireSession(request)
  if (guard.response) return guard.response
  if (!guard.session) {
    return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 })
  }

  const formData = await request.formData()
  const { input, assetFile } = parseCertificationInput(formData)
  const validationError = validateCertificationInput(input)
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 })
  }

  // R-API-07 closure (Wave 5B): per-user count quota gate. Prevents
  // a single authenticated user from filling the Supabase Storage
  // bucket with N × 10 MB certification uploads. UX-realistic ceiling
  // is well below MAX_CERTIFICATIONS_PER_USER (20); exceeding strongly
  // suggests automated abuse.
  // SENIOR ARCHITECT NOTE: count check runs BEFORE asset upload so a
  // would-be over-quota user doesn't even trigger storage I/O.
  // REJECTED ALTERNATIVE: rely on storage-quota at the Supabase
  // bucket level. Rejected — bucket-level quota is operational, not
  // user-level. Same bucket serves all users; one user could exhaust
  // shared quota.
  const profile = await getPortfolioProfile(guard.session.user.id)
  const currentCount = profile?.certifications.length ?? 0
  const countCheck = checkCountQuota(currentCount, MAX_CERTIFICATIONS_PER_USER)
  if (!countCheck.ok && countCheck.reason) {
    return NextResponse.json(
      {
        error: `Sertifika sayisi siniri asildi (${MAX_CERTIFICATIONS_PER_USER}).`,
        reason: countCheck.reason,
        current: countCheck.current,
        limit: countCheck.limit,
      },
      { status: quotaReasonToStatus(countCheck.reason) },
    )
  }

  let storedAssetPath: string | null = null

  try {
    if (assetFile) {
      const stored = await saveCertificationAsset(guard.session.user.id, assetFile)
      storedAssetPath = stored.assetPath
      input.assetPath = stored.assetPath
      input.assetName = stored.assetName
      input.assetMimeType = stored.assetMimeType
      input.assetSize = stored.assetSize
    }

    const certification = await createPortfolioCertification(
      guard.session.user.id,
      input,
      guard.session.user,
      getRequestMetadata(request),
    )

    if (!certification) {
      if (storedAssetPath) await deleteStoredAsset(storedAssetPath)
      return NextResponse.json({ error: 'Sertifika olusturulamadi.' }, { status: 404 })
    }

    return NextResponse.json({ certification }, { status: 201 })
  } catch (error) {
    if (storedAssetPath) {
      await deleteStoredAsset(storedAssetPath)
    }
    const message = error instanceof Error ? error.message : 'Sertifika kaydedilemedi.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
