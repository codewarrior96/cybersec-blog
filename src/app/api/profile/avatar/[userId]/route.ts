import fs from 'fs/promises'
import { NextRequest, NextResponse } from 'next/server'
import { getPortfolioProfile } from '@/lib/soc-store-adapter'
import { resolveStoredAssetPath } from '@/lib/portfolio-assets'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parseUserId(value: string): number | null {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ userId: string }> | { userId: string } },
) {
  const params = await Promise.resolve(context.params)
  const userId = parseUserId(params.userId)
  if (!userId) {
    return NextResponse.json({ error: 'Gecersiz kullanici.' }, { status: 400 })
  }

  const profile = await getPortfolioProfile(userId)
  if (!profile?.profile.avatarPath) {
    return NextResponse.json({ error: 'Profil fotografisi bulunamadi.' }, { status: 404 })
  }

  try {
    const absolutePath = resolveStoredAssetPath(profile.profile.avatarPath)
    const buffer = await fs.readFile(absolutePath)

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': profile.profile.avatarMimeType ?? 'application/octet-stream',
        'Content-Length': String(buffer.byteLength),
        'Cache-Control': 'private, max-age=60',
      },
    })
  } catch (error) {
    console.error('[profile/avatar] Failed to stream avatar:', error)
    return NextResponse.json({ error: 'Profil fotografisi okunamadi.' }, { status: 404 })
  }
}
