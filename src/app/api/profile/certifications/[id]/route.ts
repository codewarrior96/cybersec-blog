import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-auth'
import { getRequestMetadata } from '@/lib/auth-server'
import {
  archivePortfolioCertification,
  deletePortfolioCertification,
  getPortfolioCertificationById,
  updatePortfolioCertification,
} from '@/lib/soc-store-adapter'
import { deleteStoredAsset, saveCertificationAsset } from '@/lib/portfolio-assets'
import { parseCertificationInput, validateCertificationInput } from '@/lib/portfolio-validation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parseId(value: string): number | null {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  const guard = await requireSession(request)
  if (guard.response) return guard.response
  if (!guard.session) {
    return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 })
  }

  const params = await Promise.resolve(context.params)
  const certificationId = parseId(params.id)
  if (!certificationId) {
    return NextResponse.json({ error: 'Gecersiz sertifika kimligi.' }, { status: 400 })
  }

  const existing = await getPortfolioCertificationById(certificationId)
  if (!existing || existing.userId !== guard.session.user.id) {
    return NextResponse.json({ error: 'Sertifika bulunamadi.' }, { status: 404 })
  }

  // R-API-14 closure (Wave 5C): archive dispatch via ?action=archive.
  // Two-stage delete safety — DELETE rejects non-archived records.
  // Mirrors the reports archive flow (PATCH /api/reports with
  // {action: 'archive'} body) but uses a query parameter here to keep
  // the existing multipart/form-data PATCH body intact for the
  // standard update path.
  // SENIOR ARCHITECT NOTE: archive does NOT consume the form body —
  // we branch BEFORE form parsing so an archive request needs no
  // payload. REJECTED ALTERNATIVE: dedicated /archive sub-route —
  // adds a new file for ~10 LOC of dispatch; query-param flag keeps
  // the PATCH surface co-located.
  const { searchParams } = new URL(request.url)
  if (searchParams.get('action') === 'archive') {
    const archived = await archivePortfolioCertification(
      certificationId,
      guard.session.user.id,
      guard.session.user,
      getRequestMetadata(request),
    )
    if (!archived) {
      return NextResponse.json({ error: 'Sertifika bulunamadi.' }, { status: 404 })
    }
    return NextResponse.json({ certification: archived })
  }

  const formData = await request.formData()
  const { input, assetFile } = parseCertificationInput(formData)
  const validationError = validateCertificationInput(input)
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 })
  }

  const removeAsset = formData.get('removeAsset') === 'true'
  let newlyStoredAssetPath: string | null = null
  let shouldDeletePreviousAsset = false

  try {
    if (assetFile) {
      const stored = await saveCertificationAsset(guard.session.user.id, assetFile)
      newlyStoredAssetPath = stored.assetPath
      input.assetPath = stored.assetPath
      input.assetName = stored.assetName
      input.assetMimeType = stored.assetMimeType
      input.assetSize = stored.assetSize
      shouldDeletePreviousAsset = Boolean(existing.assetPath)
    } else if (removeAsset) {
      input.assetPath = null
      input.assetName = null
      input.assetMimeType = null
      input.assetSize = null
      shouldDeletePreviousAsset = Boolean(existing.assetPath)
    }

    const certification = await updatePortfolioCertification(
      certificationId,
      guard.session.user.id,
      input,
      guard.session.user,
      getRequestMetadata(request),
    )

    if (!certification) {
      if (newlyStoredAssetPath) await deleteStoredAsset(newlyStoredAssetPath)
      return NextResponse.json({ error: 'Sertifika guncellenemedi.' }, { status: 404 })
    }

    if (shouldDeletePreviousAsset && existing.assetPath) {
      await deleteStoredAsset(existing.assetPath)
    }

    return NextResponse.json({ certification })
  } catch (error) {
    if (newlyStoredAssetPath) {
      await deleteStoredAsset(newlyStoredAssetPath)
    }
    const message = error instanceof Error ? error.message : 'Sertifika guncellenemedi.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  const guard = await requireSession(request)
  if (guard.response) return guard.response
  if (!guard.session) {
    return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 })
  }

  const params = await Promise.resolve(context.params)
  const certificationId = parseId(params.id)
  if (!certificationId) {
    return NextResponse.json({ error: 'Gecersiz sertifika kimligi.' }, { status: 400 })
  }

  try {
    const removed = await deletePortfolioCertification(
      certificationId,
      guard.session.user.id,
      guard.session.user,
      getRequestMetadata(request),
    )

    if (!removed) {
      return NextResponse.json({ error: 'Sertifika bulunamadi.' }, { status: 404 })
    }

    await deleteStoredAsset(removed.assetPath)
    return NextResponse.json({ certification: removed })
  } catch (error) {
    // R-API-14 closure (Wave 5C): NOT_ARCHIVED → 409 Conflict. Adapter
    // throws when archivedAt is null — caller must PATCH ?action=archive
    // before DELETE. Mirrors the reports DELETE 409 contract.
    if (error instanceof Error && error.message === 'NOT_ARCHIVED') {
      return NextResponse.json(
        { error: 'Sertifika once arsivlenmeli. Lutfen PATCH ?action=archive ile arsivleyin.' },
        { status: 409 },
      )
    }
    throw error
  }
}
