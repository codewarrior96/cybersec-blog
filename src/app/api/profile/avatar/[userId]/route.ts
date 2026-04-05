import { NextRequest, NextResponse } from 'next/server'
import { createSignedObjectUrl, isSupabaseAppStateEnabled } from '@/lib/supabase-app-state'
import * as supabaseStore from '@/lib/soc-store-supabase'
import { getPortfolioProfile } from '@/lib/soc-store-adapter'
import { readStoredAsset } from '@/lib/portfolio-assets'

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

  const localProfile = isSupabaseAppStateEnabled() ? null : await getPortfolioProfile(userId)
  const avatarMeta = isSupabaseAppStateEnabled()
    ? await supabaseStore.getPortfolioAvatarForUser(userId)
    : localProfile?.profile.avatarPath
      ? {
          assetPath: localProfile.profile.avatarPath,
          assetName: localProfile.profile.avatarName ?? null,
          assetMimeType: localProfile.profile.avatarMimeType ?? null,
        }
      : null
  if (!avatarMeta?.assetPath) {
    return NextResponse.json({ error: 'Profil fotografisi bulunamadi.' }, { status: 404 })
  }

  try {
    if (isSupabaseAppStateEnabled()) {
      const signedUrl = await createSignedObjectUrl(avatarMeta.assetPath, 60)
      if (!signedUrl) {
        return NextResponse.json({ error: 'Profil fotografisi bulunamadi.' }, { status: 404 })
      }
      return NextResponse.redirect(signedUrl)
    }

    const buffer = await readStoredAsset(avatarMeta.assetPath)
    if (!buffer) {
      return NextResponse.json({ error: 'Profil fotografisi bulunamadi.' }, { status: 404 })
    }

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': avatarMeta.assetMimeType ?? 'application/octet-stream',
        'Content-Length': String(buffer.byteLength),
        'Cache-Control': 'private, max-age=60',
      },
    })
  } catch (error) {
    console.error('[profile/avatar] Failed to stream avatar:', error)
    return NextResponse.json({ error: 'Profil fotografisi okunamadi.' }, { status: 404 })
  }
}
