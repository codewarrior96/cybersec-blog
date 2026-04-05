import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-auth'
import { getRequestMetadata } from '@/lib/auth-server'
import {
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
}
