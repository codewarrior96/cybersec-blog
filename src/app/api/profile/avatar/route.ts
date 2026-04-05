import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-auth'
import { getRequestMetadata } from '@/lib/auth-server'
import { deleteStoredAsset, saveAvatarAsset } from '@/lib/portfolio-assets'
import { getPortfolioProfile, updatePortfolioAvatar } from '@/lib/soc-store-adapter'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const guard = await requireSession(request)
  if (guard.response) return guard.response
  if (!guard.session) {
    return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 })
  }

  const formData = await request.formData()
  const avatar = formData.get('avatar')
  if (!(avatar instanceof File) || avatar.size <= 0) {
    return NextResponse.json({ error: 'Profil fotografisi secilmedi.' }, { status: 400 })
  }

  const currentProfile = await getPortfolioProfile(guard.session.user.id)
  let newAssetPath: string | null = null

  try {
    const stored = await saveAvatarAsset(guard.session.user.id, avatar)
    newAssetPath = stored.assetPath

    const updated = await updatePortfolioAvatar(
      guard.session.user.id,
      {
        avatarPath: stored.assetPath,
        avatarName: stored.assetName,
        avatarMimeType: stored.assetMimeType,
      },
      guard.session.user,
      getRequestMetadata(request),
    )

    if (!updated) {
      await deleteStoredAsset(stored.assetPath)
      return NextResponse.json({ error: 'Profil fotografisi guncellenemedi.' }, { status: 404 })
    }

    if (currentProfile?.profile.avatarPath) {
      await deleteStoredAsset(currentProfile.profile.avatarPath)
    }

    return NextResponse.json({ profile: updated })
  } catch (error) {
    if (newAssetPath) {
      await deleteStoredAsset(newAssetPath)
    }
    const message = error instanceof Error ? error.message : 'Profil fotografisi yuklenemedi.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(request: NextRequest) {
  const guard = await requireSession(request)
  if (guard.response) return guard.response
  if (!guard.session) {
    return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 })
  }

  const currentProfile = await getPortfolioProfile(guard.session.user.id)
  const currentAssetPath = currentProfile?.profile.avatarPath ?? null
  const updated = await updatePortfolioAvatar(
    guard.session.user.id,
    {
      avatarPath: null,
      avatarName: null,
      avatarMimeType: null,
    },
    guard.session.user,
    getRequestMetadata(request),
  )

  if (!updated) {
    return NextResponse.json({ error: 'Profil fotografisi kaldirilamadi.' }, { status: 404 })
  }

  await deleteStoredAsset(currentAssetPath)
  return NextResponse.json({ profile: updated })
}
