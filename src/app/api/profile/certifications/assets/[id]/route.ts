import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-auth'
import { createSignedObjectUrl, isSupabaseAppStateEnabled } from '@/lib/supabase-app-state'
import * as supabaseStore from '@/lib/soc-store-supabase'
import { getPortfolioCertificationById } from '@/lib/soc-store-adapter'
import { readStoredAsset } from '@/lib/portfolio-assets'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parseId(value: string): number | null {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export async function GET(
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

  const certification = isSupabaseAppStateEnabled()
    ? await supabaseStore.getPortfolioCertificationById(certificationId)
    : await getPortfolioCertificationById(certificationId)
  if (!certification?.assetPath) {
    return NextResponse.json({ error: 'Sertifika dokumani bulunamadi.' }, { status: 404 })
  }

  // Ownership gate. Replicates the userId check from the PATCH cert route
  // (api/profile/certifications/[id]/route.ts:37). Spec directs an explicit
  // 403 with the error string below — diverges from PATCH's 404 (which
  // collapses unauthorized into not-found to mask existence). Numeric IDs
  // are already enumerable so existence-masking has limited value here;
  // explicit 403 is clearer feedback for legitimate misuse.
  if (certification.userId !== guard.session.user.id) {
    return NextResponse.json(
      { error: 'Bu sertifikaya erisim yetkiniz yok.' },
      { status: 403 },
    )
  }

  try {
    if (isSupabaseAppStateEnabled()) {
      const signedUrl = await createSignedObjectUrl(certification.assetPath, 60)
      if (!signedUrl) {
        return NextResponse.json({ error: 'Sertifika dokumani bulunamadi.' }, { status: 404 })
      }
      return NextResponse.redirect(signedUrl)
    }

    const buffer = await readStoredAsset(certification.assetPath)
    if (!buffer) {
      return NextResponse.json({ error: 'Sertifika dokumani bulunamadi.' }, { status: 404 })
    }

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': certification.assetMimeType ?? 'application/octet-stream',
        'Content-Length': String(buffer.byteLength),
        'Content-Disposition': `inline; filename="${encodeURIComponent(
          certification.assetName ?? `certificate-${certification.id}`,
        )}"`,
        'Cache-Control': 'private, max-age=60',
      },
    })
  } catch (error) {
    console.error('[profile/certifications/assets] Failed to stream asset:', error)
    return NextResponse.json({ error: 'Sertifika dokumani okunamadi.' }, { status: 404 })
  }
}
