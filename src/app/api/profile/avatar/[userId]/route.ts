import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-auth'
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
  request: NextRequest,
  context: { params: Promise<{ userId: string }> | { userId: string } },
) {
  const guard = await requireSession(request)
  if (guard.response) return guard.response
  if (!guard.session) {
    return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 })
  }

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
      // R-API-10 closure (Wave 5B): signed-URL TTL initially tightened
      // from 60s to 15s. Phase 3.A audit flagged the 60s window as too
      // long for a leaked URL (clipboard share / screenshot of URL bar).
      // REJECTED ALTERNATIVE: 5s — too aggressive for slow mobile
      // networks; legitimate clients would race the TTL.
      //
      // A-27 / Z.15 (Wave 13 Faz 13.C) — TTL revised 15s → 30s. Faz 13.A
      // audit (WAVE_13_AVATAR_PERF_AUDIT.md) surfaced a 3-fetch storm:
      // 3 PortfolioWorkspace render sites + no Cache-Control on the 307
      // = 3 separate Supabase signed-URL mints per page load. Path B
      // (SSR-resolve in /portfolio/page.tsx) + Path A (Cache-Control
      // on this 307) defense-in-depth combo handles it. The 30s TTL
      // preserves the short-lived-URL security envelope (Wave 5B
      // pattern intact) while doubling the cache-window arithmetic
      // (max-age=20 below stays well under TTL).
      const signedUrl = await createSignedObjectUrl(avatarMeta.assetPath, 30)
      if (!signedUrl) {
        return NextResponse.json({ error: 'Profil fotografisi bulunamadi.' }, { status: 404 })
      }
      // A-27 closure (Wave 13 Faz 13.C): Cache-Control on the 307
      // redirect lets the browser HTTP cache dedupe N <img> render
      // sites that share this source URL within the 20s window.
      // `private` keeps shared/CDN caches out (each user has a
      // different cookie-derived session → different signed URL chain).
      // `Vary: Cookie` is signal-explicit for any intermediary cache
      // that might consider keying off path alone.
      const response = NextResponse.redirect(signedUrl)
      response.headers.set('Cache-Control', 'private, max-age=20')
      response.headers.set('Vary', 'Cookie')
      return response
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
