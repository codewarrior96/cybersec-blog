import fs from 'fs/promises'
import { NextRequest, NextResponse } from 'next/server'
import { getPortfolioCertificationById } from '@/lib/soc-store-adapter'
import { resolveStoredAssetPath } from '@/lib/portfolio-assets'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parseId(value: string): number | null {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  const params = await Promise.resolve(context.params)
  const certificationId = parseId(params.id)
  if (!certificationId) {
    return NextResponse.json({ error: 'Gecersiz sertifika kimligi.' }, { status: 400 })
  }

  const certification = await getPortfolioCertificationById(certificationId)
  if (!certification?.assetPath) {
    return NextResponse.json({ error: 'Sertifika dokumani bulunamadi.' }, { status: 404 })
  }

  try {
    const absolutePath = resolveStoredAssetPath(certification.assetPath)
    const buffer = await fs.readFile(absolutePath)

    return new NextResponse(buffer, {
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
