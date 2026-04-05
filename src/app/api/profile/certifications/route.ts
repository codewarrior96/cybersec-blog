import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-auth'
import { getRequestMetadata } from '@/lib/auth-server'
import { createPortfolioCertification } from '@/lib/soc-store-adapter'
import { deleteStoredAsset, saveCertificationAsset } from '@/lib/portfolio-assets'
import { parseCertificationInput, validateCertificationInput } from '@/lib/portfolio-validation'

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
